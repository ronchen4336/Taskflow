import db from "../db.js";

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS automations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    name TEXT NOT NULL,
    trigger TEXT NOT NULL,
    conditions TEXT NOT NULL DEFAULT '[]',
    actions TEXT NOT NULL DEFAULT '[]',
    enabled INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS automation_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    automation_id INTEGER NOT NULL REFERENCES automations(id),
    task_id INTEGER NOT NULL,
    trigger TEXT NOT NULL,
    result TEXT NOT NULL DEFAULT 'success',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

interface Condition {
  field: string;
  op: string;
  value: string | number;
}

interface Action {
  type: string;
  value: string | number;
}

interface AutomationRow {
  id: number;
  project_id: number;
  name: string;
  trigger: string;
  conditions: string;
  actions: string;
  enabled: number;
  created_by: number;
  created_at: string;
}

interface TaskRow {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: number | null;
  due_date: string | null;
  estimated_hours: number | null;
  position: number;
  created_at: string;
  updated_at: string;
}

function checkCondition(condition: Condition, task: TaskRow): boolean {
  const taskValue = (task as Record<string, unknown>)[condition.field];
  const condValue = condition.value;

  switch (condition.op) {
    case "eq":
      // Bug 19: loose equality comparison
      return taskValue == condValue;
    case "neq":
      return taskValue != condValue;
    case "contains":
      return String(taskValue).includes(String(condValue));
    case "gt":
      return Number(taskValue) > Number(condValue);
    case "lt":
      return Number(taskValue) < Number(condValue);
    default:
      return false;
  }
}

function executeAction(action: Action, task: TaskRow): string {
  switch (action.type) {
    case "assign_to": {
      db.prepare("UPDATE tasks SET assignee_id = ?, updated_at = ? WHERE id = ?")
        .run(action.value, new Date().toISOString(), task.id);
      return `Assigned task ${task.id} to user ${action.value}`;
    }
    case "set_label": {
      // Find or create the label, then assign it
      const label = db.prepare(
        "SELECT id FROM task_labels WHERE project_id = ? AND name = ?"
      ).get(task.project_id, action.value) as { id: number } | undefined;

      if (label) {
        const existing = db.prepare(
          "SELECT 1 FROM task_label_assignments WHERE task_id = ? AND label_id = ?"
        ).get(task.id, label.id);
        if (!existing) {
          db.prepare("INSERT INTO task_label_assignments (task_id, label_id) VALUES (?, ?)")
            .run(task.id, label.id);
        }
      }
      return `Set label '${action.value}' on task ${task.id}`;
    }
    case "change_status": {
      db.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?")
        .run(action.value, new Date().toISOString(), task.id);
      return `Changed task ${task.id} status to '${action.value}'`;
    }
    case "send_notification": {
      console.log(`[Automation Notification] Task ${task.id}: ${action.value}`);
      return `Sent notification for task ${task.id}: ${action.value}`;
    }
    case "add_comment": {
      db.prepare("INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)")
        .run(task.id, task.assignee_id || 1, `[Automation] ${action.value}`);
      return `Added comment to task ${task.id}`;
    }
    default:
      return `Unknown action type: ${action.type}`;
  }
}

export function evaluateAutomations(
  trigger: string,
  task: TaskRow,
  _changes?: Record<string, unknown>
): void {
  const automations = db.prepare(
    "SELECT * FROM automations WHERE project_id = ? AND trigger = ? AND enabled = 1"
  ).all(task.project_id, trigger) as AutomationRow[];

  for (const automation of automations) {
    const conditions: Condition[] = JSON.parse(automation.conditions);
    const actions: Action[] = JSON.parse(automation.actions);

    const allMatch = conditions.every((cond) => checkCondition(cond, task));

    if (allMatch) {
      const results: string[] = [];
      for (const action of actions) {
        const result = executeAction(action, task);
        results.push(result);
      }

      db.prepare(
        "INSERT INTO automation_runs (automation_id, task_id, trigger, result) VALUES (?, ?, ?, ?)"
      ).run(automation.id, task.id, trigger, results.join("; "));

      console.log(`[Automation] "${automation.name}" fired on task ${task.id}: ${results.join("; ")}`);
    }
  }
}
