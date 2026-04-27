import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.use(authMiddleware);

// GET /api/projects/:projectId/labels — list labels for a project
router.get("/projects/:projectId/labels", (req: Request, res: Response) => {
  const { projectId } = req.params;

  const project = db
    .prepare("SELECT id FROM projects WHERE id = ?")
    .get(projectId);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const labels = db
    .prepare("SELECT * FROM task_labels WHERE project_id = ? ORDER BY name ASC")
    .all(projectId);

  res.json({ labels });
});

// POST /api/projects/:projectId/labels — create a label
router.post("/projects/:projectId/labels", (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { name, color } = req.body;

  const project = db
    .prepare("SELECT id FROM projects WHERE id = ?")
    .get(projectId);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!name) {
    res.status(400).json({ error: "Label name is required" });
    return;
  }

  const result = db
    .prepare("INSERT INTO task_labels (project_id, name, color) VALUES (?, ?, ?)")
    .run(projectId, name, color || "#6b7280");

  const label = db.prepare("SELECT * FROM task_labels WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ label });
});

// DELETE /api/projects/:projectId/labels/:id — delete a label
router.delete("/projects/:projectId/labels/:id", (req: Request, res: Response) => {
  const { projectId, id } = req.params;

  const label = db
    .prepare("SELECT * FROM task_labels WHERE id = ? AND project_id = ?")
    .get(id, projectId);

  if (!label) {
    res.status(404).json({ error: "Label not found" });
    return;
  }

  // Remove all assignments for this label first
  db.prepare("DELETE FROM task_label_assignments WHERE label_id = ?").run(id);
  db.prepare("DELETE FROM task_labels WHERE id = ?").run(id);

  res.json({ message: "Label deleted" });
});

// POST /api/tasks/:taskId/labels — assign a label to a task
router.post("/tasks/:taskId/labels", (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { label_id } = req.body;

  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (!label_id) {
    res.status(400).json({ error: "label_id is required" });
    return;
  }

  const label = db.prepare("SELECT id FROM task_labels WHERE id = ?").get(label_id);
  if (!label) {
    res.status(404).json({ error: "Label not found" });
    return;
  }

  // Check if already assigned
  const existing = db
    .prepare("SELECT * FROM task_label_assignments WHERE task_id = ? AND label_id = ?")
    .get(taskId, label_id);

  if (existing) {
    res.status(409).json({ error: "Label already assigned to this task" });
    return;
  }

  db.prepare("INSERT INTO task_label_assignments (task_id, label_id) VALUES (?, ?)").run(taskId, label_id);

  const labels = db
    .prepare(
      `SELECT tl.* FROM task_labels tl
       JOIN task_label_assignments tla ON tla.label_id = tl.id
       WHERE tla.task_id = ?`
    )
    .all(taskId);

  res.status(201).json({ labels });
});

// DELETE /api/tasks/:taskId/labels/:labelId — remove a label from a task
router.delete("/tasks/:taskId/labels/:labelId", (req: Request, res: Response) => {
  const { taskId, labelId } = req.params;

  const assignment = db
    .prepare("SELECT * FROM task_label_assignments WHERE task_id = ? AND label_id = ?")
    .get(taskId, labelId);

  if (!assignment) {
    res.status(404).json({ error: "Label assignment not found" });
    return;
  }

  db.prepare("DELETE FROM task_label_assignments WHERE task_id = ? AND label_id = ?").run(taskId, labelId);

  res.json({ message: "Label removed from task" });
});

export default router;
