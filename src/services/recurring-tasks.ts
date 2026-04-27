import db from "../db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS recurring_tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    title TEXT NOT NULL,
    description TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    assignee_id INTEGER REFERENCES users(id),
    recurrence TEXT NOT NULL DEFAULT '{}',
    next_run TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

interface RecurrenceConfig {
  type: "daily" | "weekly" | "monthly";
  day_of_week?: number; // 0=Sunday, 1=Monday, ...
  day_of_month?: number;
}

interface RecurringTaskRow {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  priority: string;
  assignee_id: number | null;
  recurrence: string;
  next_run: string;
  enabled: number;
  created_by: number;
  created_at: string;
}

function calculateNextRun(recurrence: RecurrenceConfig, fromDate: Date): Date {
  const next = new Date(fromDate);

  switch (recurrence.type) {
    case "daily":
      next.setUTCDate(next.getUTCDate() + 1);
      break;
    case "weekly": {
      const targetDay = recurrence.day_of_week ?? 1; // Default Monday
      do {
        next.setUTCDate(next.getUTCDate() + 1);
      } while (next.getUTCDay() !== targetDay);
      break;
    }
    case "monthly": {
      const targetDom = recurrence.day_of_month ?? 1;
      next.setUTCMonth(next.getUTCMonth() + 1);
      next.setUTCDate(targetDom);
      break;
    }
  }

  return next;
}

export function generateDueTasks(): { created: number; tasks: unknown[] } {
  const now = new Date();
  const nowISO = now.toISOString();

  const dueTemplates = db.prepare(
    "SELECT * FROM recurring_tasks WHERE enabled = 1 AND next_run <= ?"
  ).all(nowISO) as RecurringTaskRow[];

  const createdTasks: unknown[] = [];

  const insertTask = db.prepare(
    `INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_date, position)
     VALUES (?, ?, ?, 'todo', ?, ?, ?, ?)`
  );

  const updateNextRun = db.prepare(
    "UPDATE recurring_tasks SET next_run = ? WHERE id = ?"
  );

  const getMaxPos = db.prepare(
    "SELECT COALESCE(MAX(position), -1) as max_pos FROM tasks WHERE project_id = ?"
  );

  for (const template of dueTemplates) {
    const recurrence: RecurrenceConfig = JSON.parse(template.recurrence);

    const maxPos = getMaxPos.get(template.project_id) as { max_pos: number };

    // Bug 20: due_date uses local time while next_run uses UTC
    const dueDate = new Date().toLocaleDateString("en-CA"); // local date YYYY-MM-DD

    const result = insertTask.run(
      template.project_id,
      `${template.title} (${new Date().toLocaleDateString()})`,
      template.description,
      template.priority,
      template.assignee_id,
      dueDate,
      maxPos.max_pos + 1
    );

    const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid);
    createdTasks.push(task);

    // Calculate next run in UTC
    const nextRun = calculateNextRun(recurrence, now);
    updateNextRun.run(nextRun.toISOString(), template.id);

    console.log(`[Recurring] Created task from template "${template.title}", next run: ${nextRun.toISOString()}`);
  }

  return { created: createdTasks.length, tasks: createdTasks };
}
