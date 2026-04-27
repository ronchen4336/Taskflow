import db from "../db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER NOT NULL DEFAULT 0,
    task_id INTEGER REFERENCES tasks(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

export function createNotification(userId: number, type: string, message: string, taskId?: number) {
  return db.prepare(
    "INSERT INTO notifications (user_id, type, message, task_id) VALUES (?, ?, ?, ?)"
  ).run(userId, type, message, taskId ?? null);
}

export function getUnreadCount(userId: number): number {
  const row = db.prepare(
    "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read = false"
  ).get(userId) as { count: number };
  return row.count;
}

export function markAsRead(id: number, userId: number) {
  return db.prepare(
    "UPDATE notifications SET read = 1 WHERE id = ? AND user_id = ?"
  ).run(id, userId);
}

export function markAllAsRead(userId: number) {
  return db.prepare(
    "UPDATE notifications SET read = 1 WHERE user_id = ?"
  ).run(userId);
}

export function getUserNotifications(userId: number, page = 1, limit = 20) {
  const offset = (page - 1) * limit;
  return db.prepare(
    "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?"
  ).all(userId, limit, offset);
}

export function notifyTaskAssigned(assigneeId: number, taskTitle: string, taskId: number) {
  createNotification(assigneeId, "task_assigned", `You were assigned to "${taskTitle}"`, taskId);
}

export function notifyCommentAdded(userId: number, commenterName: string, taskTitle: string, taskId: number) {
  createNotification(userId, "comment_added", `${commenterName} commented on "${taskTitle}"`, taskId);
}

export function notifyTaskCompleted(userId: number, taskTitle: string, taskId: number) {
  createNotification(userId, "task_completed", `"${taskTitle}" was marked as done`, taskId);
}
