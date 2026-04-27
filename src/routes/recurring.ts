import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireProjectAccess } from "../middleware/permissions.js";
import { generateDueTasks } from "../services/recurring-tasks.js";

const router = Router();

router.use(authMiddleware);

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

// POST /api/projects/:projectId/recurring — create recurring task template
router.post("/projects/:projectId/recurring", requireProjectAccess(), (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, description, priority, assignee_id, recurrence } = req.body;

  if (!title || !recurrence) {
    res.status(400).json({ error: "Title and recurrence are required" });
    return;
  }

  const validTypes = ["daily", "weekly", "monthly"];
  if (!validTypes.includes(recurrence.type)) {
    res.status(400).json({ error: `Invalid recurrence type. Must be one of: ${validTypes.join(", ")}` });
    return;
  }

  // Calculate initial next_run
  const now = new Date();
  let nextRun = new Date(now);
  nextRun.setUTCDate(nextRun.getUTCDate() + 1); // Default: tomorrow
  nextRun.setUTCHours(9, 0, 0, 0); // 9 AM UTC

  const result = db.prepare(
    `INSERT INTO recurring_tasks (project_id, title, description, priority, assignee_id, recurrence, next_run, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    projectId,
    title,
    description || null,
    priority || "medium",
    assignee_id || null,
    JSON.stringify(recurrence),
    nextRun.toISOString(),
    req.user!.userId
  );

  const recurring = db.prepare("SELECT * FROM recurring_tasks WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ recurring_task: recurring });
});

// GET /api/projects/:projectId/recurring — list recurring task templates
router.get("/projects/:projectId/recurring", requireProjectAccess(), (req: Request, res: Response) => {
  const { projectId } = req.params;

  const templates = db.prepare(
    "SELECT * FROM recurring_tasks WHERE project_id = ? ORDER BY created_at DESC"
  ).all(projectId) as RecurringTaskRow[];

  const parsed = templates.map((t) => ({
    ...t,
    recurrence: JSON.parse(t.recurrence),
    enabled: Boolean(t.enabled),
  }));

  res.json({ recurring_tasks: parsed });
});

// PUT /api/recurring/:id — update recurring task template
router.put("/recurring/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { title, description, priority, assignee_id, recurrence, enabled } = req.body;

  const existing = db.prepare("SELECT * FROM recurring_tasks WHERE id = ?").get(id) as RecurringTaskRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Recurring task template not found" });
    return;
  }

  db.prepare(
    `UPDATE recurring_tasks SET title = ?, description = ?, priority = ?, assignee_id = ?, recurrence = ?, enabled = ?
     WHERE id = ?`
  ).run(
    title || existing.title,
    description !== undefined ? description : existing.description,
    priority || existing.priority,
    assignee_id !== undefined ? assignee_id : existing.assignee_id,
    recurrence ? JSON.stringify(recurrence) : existing.recurrence,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    id
  );

  const updated = db.prepare("SELECT * FROM recurring_tasks WHERE id = ?").get(id);
  res.json({ recurring_task: updated });
});

// DELETE /api/recurring/:id — delete recurring task template
router.delete("/recurring/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM recurring_tasks WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "Recurring task template not found" });
    return;
  }

  db.prepare("DELETE FROM recurring_tasks WHERE id = ?").run(id);
  res.json({ message: "Recurring task template deleted" });
});

// POST /api/recurring/generate — manually trigger task generation
router.post("/recurring/generate", (req: Request, res: Response) => {
  const result = generateDueTasks();
  res.json(result);
});

export default router;
