import db from "../db.js";

interface BurndownDay {
  date: string;
  todo: number;
  in_progress: number;
  review: number;
  done: number;
}

interface VelocityWeek {
  week_start: string;
  week_end: string;
  completed: number;
}

export function calculateBurndown(projectId: number, days: number = 30): BurndownDay[] {
  const results: BurndownDay[] = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];

    // Bug 15: using <= instead of < causes off-by-one — tasks created on the boundary
    // date get counted in both the current day and previous day
    const todo = db.prepare(
      `SELECT COUNT(*) as count FROM tasks
       WHERE project_id = ? AND status = 'todo' AND created_at <= ?`
    ).get(projectId, dateStr + " 23:59:59") as { count: number };

    const inProgress = db.prepare(
      `SELECT COUNT(*) as count FROM tasks
       WHERE project_id = ? AND status = 'in_progress' AND created_at <= ?`
    ).get(projectId, dateStr + " 23:59:59") as { count: number };

    const review = db.prepare(
      `SELECT COUNT(*) as count FROM tasks
       WHERE project_id = ? AND status = 'review' AND created_at <= ?`
    ).get(projectId, dateStr + " 23:59:59") as { count: number };

    const done = db.prepare(
      `SELECT COUNT(*) as count FROM tasks
       WHERE project_id = ? AND status = 'done' AND created_at <= ?`
    ).get(projectId, dateStr + " 23:59:59") as { count: number };

    results.push({
      date: dateStr,
      todo: todo.count,
      in_progress: inProgress.count,
      review: review.count,
      done: done.count,
    });
  }

  return results;
}

export function calculateVelocity(projectId: number, weeks: number = 8): VelocityWeek[] {
  const results: VelocityWeek[] = [];
  const today = new Date();

  for (let i = weeks - 1; i >= 0; i--) {
    const weekEnd = new Date(today);
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 6);

    const startStr = weekStart.toISOString().split("T")[0];
    const endStr = weekEnd.toISOString().split("T")[0];

    const row = db.prepare(
      `SELECT COUNT(*) as count FROM tasks
       WHERE project_id = ? AND status = 'done'
       AND updated_at >= ? AND updated_at <= ?`
    ).get(projectId, startStr + " 00:00:00", endStr + " 23:59:59") as { count: number };

    results.push({
      week_start: startStr,
      week_end: endStr,
      completed: row.count,
    });
  }

  return results;
}

export function getCompletionRate(projectId: number): number {
  const total = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE project_id = ?"
  ).get(projectId) as { count: number };

  if (total.count === 0) return 0;

  const done = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status = 'done'"
  ).get(projectId) as { count: number };

  return Math.round((done.count / total.count) * 1000) / 10;
}

export function getAverageTimeToClose(projectId: number): number {
  const rows = db.prepare(
    `SELECT created_at, updated_at FROM tasks
     WHERE project_id = ? AND status = 'done' AND updated_at IS NOT NULL`
  ).all(projectId) as { created_at: string; updated_at: string }[];

  if (rows.length === 0) return 0;

  const totalMs = rows.reduce((sum, row) => {
    return sum + (new Date(row.updated_at).getTime() - new Date(row.created_at).getTime());
  }, 0);

  return Math.round((totalMs / rows.length / (1000 * 60 * 60 * 24)) * 10) / 10;
}
