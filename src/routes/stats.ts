import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import db from "../db.js";
import { calculateBurndown, calculateVelocity, getCompletionRate, getAverageTimeToClose } from "../services/analytics.js";

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

  // Tasks created this week
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());
  const weekStartStr = weekStart.toISOString().split("T")[0];

  const createdThisWeek = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND created_at >= ?"
  ).get(projectId, weekStartStr + " 00:00:00") as { count: number };

  // Tasks completed this week
  const completedThisWeek = db.prepare(
    "SELECT COUNT(*) as count FROM tasks WHERE project_id = ? AND status = 'done' AND updated_at >= ?"
  ).get(projectId, weekStartStr + " 00:00:00") as { count: number };

  // Burndown data (last 30 days)
  const burndown = calculateBurndown(Number(projectId), 30);

  res.json({
    total: tasks.length,
    byStatus,
    overdue,
    avgCompletionDays,
    createdThisWeek: createdThisWeek.count,
    completedThisWeek: completedThisWeek.count,
    burndown,
  });
});

// GET /api/projects/:projectId/burndown
router.get("/:projectId/burndown", authenticate, (req: Request, res: Response) => {
  const { projectId } = req.params;

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as any;
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const days = parseInt(req.query.days as string) || 30;
  const burndown = calculateBurndown(Number(projectId), days);

  res.json({ projectId: Number(projectId), days, burndown });
});

// GET /api/projects/:projectId/velocity
router.get("/:projectId/velocity", authenticate, (req: Request, res: Response) => {
  const { projectId } = req.params;

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as any;
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const weeks = parseInt(req.query.weeks as string) || 8;
  const velocity = calculateVelocity(Number(projectId), weeks);

  const totalCompleted = velocity.reduce((sum, w) => sum + w.completed, 0);
  const avgPerWeek = Math.round((totalCompleted / velocity.length) * 10) / 10;

  res.json({
    projectId: Number(projectId),
    weeks,
    velocity,
    totalCompleted,
    avgPerWeek,
  });
});

// GET /api/analytics/overview — cross-project analytics
router.get("/overview", authenticate, (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const totalTasks = db.prepare(
    `SELECT COUNT(*) as count FROM tasks t
     JOIN projects p ON t.project_id = p.id
     WHERE p.owner_id = ?`
  ).get(userId) as { count: number };

  const completedTasks = db.prepare(
    `SELECT COUNT(*) as count FROM tasks t
     JOIN projects p ON t.project_id = p.id
     WHERE p.owner_id = ? AND t.status = 'done'`
  ).get(userId) as { count: number };

  const completionRate = totalTasks.count > 0
    ? Math.round((completedTasks.count / totalTasks.count) * 1000) / 10
    : 0;

  const avgTimeToClose = db.prepare(
    `SELECT AVG(
      (julianday(t.updated_at) - julianday(t.created_at))
    ) as avg_days FROM tasks t
    JOIN projects p ON t.project_id = p.id
    WHERE p.owner_id = ? AND t.status = 'done'`
  ).get(userId) as { avg_days: number | null };

  const mostActiveProject = db.prepare(
    `SELECT p.id, p.name, COUNT(t.id) as task_count FROM projects p
     JOIN tasks t ON t.project_id = p.id
     WHERE p.owner_id = ?
     GROUP BY p.id
     ORDER BY task_count DESC
     LIMIT 1`
  ).get(userId) as { id: number; name: string; task_count: number } | undefined;

  res.json({
    totalTasks: totalTasks.count,
    completedTasks: completedTasks.count,
    completionRate,
    avgTimeToCloseDays: avgTimeToClose.avg_days ? Math.round(avgTimeToClose.avg_days * 10) / 10 : 0,
    mostActiveProject: mostActiveProject || null,
  });
});

export default router;
