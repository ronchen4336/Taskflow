import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import db from "../db.js";
import { calculateBurndown, calculateVelocity, getCompletionRate, getAverageTimeToClose } from "../services/analytics.js";

// Create reports table
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    generated_by INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL DEFAULT 'snapshot',
    data TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const router = Router();

// POST /api/projects/:projectId/reports/generate — generate a snapshot report
router.post("/:projectId/reports/generate", authenticate, (req: Request, res: Response) => {
  const { projectId } = req.params;
  const userId = req.user!.userId;
  const { type } = req.body;
  const reportType = type || "snapshot";

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as any;
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Gather report data
  const tasks = db.prepare("SELECT * FROM tasks WHERE project_id = ?").all(Number(projectId)) as any[];

  const byStatus = { todo: 0, in_progress: 0, review: 0, done: 0 };
  for (const t of tasks) {
    if (t.status in byStatus) {
      byStatus[t.status as keyof typeof byStatus]++;
    }
  }

  const completionRate = getCompletionRate(Number(projectId));
  const avgTimeToClose = getAverageTimeToClose(Number(projectId));
  const burndown = calculateBurndown(Number(projectId), 30);
  const velocity = calculateVelocity(Number(projectId), 8);

  const today = new Date().toISOString().split("T")[0];
  const overdueTasks = tasks.filter(
    (t: any) => t.due_date && t.status !== "done" && t.due_date < today
  );

  const reportData = {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
    },
    summary: {
      totalTasks: tasks.length,
      byStatus,
      completionRate,
      avgTimeToCloseDays: avgTimeToClose,
      overdueCount: overdueTasks.length,
    },
    burndown,
    velocity,
    overdueTasks: overdueTasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      due_date: t.due_date,
      priority: t.priority,
      status: t.status,
    })),
    generatedAt: new Date().toISOString(),
  };

  const result = db.prepare(
    "INSERT INTO reports (project_id, generated_by, type, data) VALUES (?, ?, ?, ?)"
  ).run(Number(projectId), userId, reportType, JSON.stringify(reportData));

  const report = db.prepare("SELECT * FROM reports WHERE id = ?").get(result.lastInsertRowid) as any;

  res.status(201).json({
    report: {
      id: report.id,
      project_id: report.project_id,
      generated_by: report.generated_by,
      type: report.type,
      data: JSON.parse(report.data),
      created_at: report.created_at,
    },
  });
});

// GET /api/projects/:projectId/reports — list generated reports
router.get("/:projectId/reports", authenticate, (req: Request, res: Response) => {
  const { projectId } = req.params;

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as any;
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const reports = db.prepare(
    `SELECT r.id, r.project_id, r.generated_by, r.type, r.created_at, u.name as generated_by_name
     FROM reports r
     JOIN users u ON r.generated_by = u.id
     WHERE r.project_id = ?
     ORDER BY r.created_at DESC`
  ).all(Number(projectId)) as any[];

  res.json({ reports });
});

// GET /api/reports/:id — get single report with full data
router.get("/:id", authenticate, (req: Request, res: Response) => {
  const report = db.prepare(
    `SELECT r.*, u.name as generated_by_name
     FROM reports r
     JOIN users u ON r.generated_by = u.id
     WHERE r.id = ?`
  ).get(req.params.id) as any;

  if (!report) {
    res.status(404).json({ error: "Report not found" });
    return;
  }

  res.json({
    report: {
      id: report.id,
      project_id: report.project_id,
      generated_by: report.generated_by,
      generated_by_name: report.generated_by_name,
      type: report.type,
      data: JSON.parse(report.data),
      created_at: report.created_at,
    },
  });
});

export default router;
