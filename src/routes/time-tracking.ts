import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.use(authMiddleware);

interface TimeEntryRow {
  id: number;
  task_id: number;
  user_id: number;
  description: string | null;
  minutes: number;
  date: string;
  created_at: string;
}

// POST /api/tasks/:taskId/time — log time
router.post("/tasks/:taskId/time", (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { description, minutes, date } = req.body;

  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (!minutes || minutes <= 0) {
    res.status(400).json({ error: "Minutes must be a positive number" });
    return;
  }

  if (!date) {
    res.status(400).json({ error: "Date is required" });
    return;
  }

  const result = db
    .prepare(
      "INSERT INTO time_entries (task_id, user_id, description, minutes, date) VALUES (?, ?, ?, ?, ?)"
    )
    .run(taskId, req.user!.userId, description || null, minutes, date);

  const entry = db.prepare("SELECT * FROM time_entries WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ entry });
});

// GET /api/tasks/:taskId/time — list time entries for a task
router.get("/tasks/:taskId/time", (req: Request, res: Response) => {
  const { taskId } = req.params;

  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const entries = db
    .prepare(
      `SELECT te.*, u.name as user_name
       FROM time_entries te
       LEFT JOIN users u ON u.id = te.user_id
       WHERE te.task_id = ?
       ORDER BY te.date DESC`
    )
    .all(taskId);

  res.json({ entries });
});

// GET /api/projects/:projectId/time-report — time report for a project
router.get("/projects/:projectId/time-report", (req: Request, res: Response) => {
  const { projectId } = req.params;

  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const entries = db
    .prepare(
      `SELECT te.*, t.title as task_title, u.name as user_name
       FROM time_entries te
       JOIN tasks t ON t.id = te.task_id
       LEFT JOIN users u ON u.id = te.user_id
       WHERE t.project_id = ?
       ORDER BY te.date DESC`
    )
    .all(projectId) as (TimeEntryRow & { task_title: string; user_name: string })[];

  // Total time per task
  const byTask: Record<string, { task_id: number; title: string; total_minutes: string }> = {};
  for (const entry of entries) {
    if (!byTask[entry.task_id]) {
      byTask[entry.task_id] = { task_id: entry.task_id, title: entry.task_title, total_minutes: "" };
    }
  }

  // Sum minutes per task
  const taskTotals = Object.values(
    entries.reduce((acc, entry) => {
      if (!acc[entry.task_id]) {
        acc[entry.task_id] = { task_id: entry.task_id, title: entry.task_title, total_minutes: "" };
      }
      acc[entry.task_id].total_minutes = acc[entry.task_id].total_minutes + entry.minutes;
      return acc;
    }, {} as Record<number, { task_id: number; title: string; total_minutes: string }>)
  );

  // Sum minutes per user
  const userTotals = Object.values(
    entries.reduce((acc, entry) => {
      if (!acc[entry.user_id]) {
        acc[entry.user_id] = { user_id: entry.user_id, name: entry.user_name, total_minutes: 0 };
      }
      acc[entry.user_id].total_minutes += entry.minutes;
      return acc;
    }, {} as Record<number, { user_id: number; name: string; total_minutes: number }>)
  );

  // Grand total
  const grandTotal = entries.reduce((sum, entry) => sum + entry.minutes, "");

  res.json({
    project_id: Number(projectId),
    by_task: taskTotals,
    by_user: userTotals,
    total_minutes: grandTotal,
    entry_count: entries.length,
  });
});

// DELETE /api/time/:id — delete a time entry (only the owner)
router.delete("/time/:id", (req: Request, res: Response) => {
  const entry = db
    .prepare("SELECT * FROM time_entries WHERE id = ?")
    .get(req.params.id) as TimeEntryRow | undefined;

  if (!entry) {
    res.status(404).json({ error: "Time entry not found" });
    return;
  }

  if (entry.user_id !== req.user!.userId) {
    res.status(403).json({ error: "You can only delete your own time entries" });
    return;
  }

  db.prepare("DELETE FROM time_entries WHERE id = ?").run(req.params.id);
  res.json({ message: "Time entry deleted" });
});

export default router;
