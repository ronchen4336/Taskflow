import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import db from "../db.js";

const router = Router();

router.get("/:projectId/stats", authenticate, (req: Request, res: Response) => {
  const { projectId } = req.params;

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as any;
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const tasks = db.prepare("SELECT * FROM tasks WHERE project_id = ?").all(projectId) as any[];

  const byStatus = { todo: 0, in_progress: 0, review: 0, done: 0 };
  for (const t of tasks) {
    if (t.status in byStatus) {
      byStatus[t.status as keyof typeof byStatus]++;
    }
  }

  const today = new Date().toISOString().split("T")[0];
  const overdue = tasks.filter(
    (t: any) => t.due_date && t.status !== "done" && t.due_date < today
  ).length;

  const doneTasks = tasks.filter((t: any) => t.status === "done" && t.updated_at && t.created_at);
  let avgCompletionDays = 0;
  if (doneTasks.length > 0) {
    const totalMs = doneTasks.reduce((sum: number, t: any) => {
      return sum + (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime());
    }, 0);
    avgCompletionDays = Math.round(totalMs / doneTasks.length / (1000 * 60 * 60 * 24) * 10) / 10;
  }

  res.json({
    total: tasks.length,
    byStatus,
    overdue,
    avgCompletionDays,
  });
});

export default router;
