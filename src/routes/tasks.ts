import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.use(authMiddleware);

interface TaskRow {
  id: number;
  project_id: number;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  assignee_id: number | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

// GET /api/projects/:projectId/tasks — list tasks with optional filters
router.get("/projects/:projectId/tasks", (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { status, priority, assignee } = req.query;

  const project = db
    .prepare("SELECT id FROM projects WHERE id = ? AND owner_id = ?")
    .get(projectId, req.user!.userId);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  let query = "SELECT * FROM tasks WHERE project_id = ?";
  const params: unknown[] = [projectId];

  if (status) {
    query += " AND status = ?";
    params.push(status as string);
  }

  if (priority) {
    query += " AND priority = ?";
    params.push(priority as string);
  }

  if (assignee) {
    query += " AND assignee_id = ?";
    params.push(assignee as string);
  }

  query += " ORDER BY created_at DESC";

  const tasks = db.prepare(query).all(...params);
  res.json({ tasks });
});

// POST /api/projects/:projectId/tasks — create a task
router.post("/projects/:projectId/tasks", (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, description, status, priority, assignee_id, due_date } = req.body;

  const project = db
    .prepare("SELECT id FROM projects WHERE id = ? AND owner_id = ?")
    .get(projectId, req.user!.userId);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!title) {
    res.status(400).json({ error: "Task title is required" });
    return;
  }

  const result = db
    .prepare(
      `INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_date)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      projectId,
      title,
      description || null,
      status || "todo",
      priority || "medium",
      assignee_id || null,
      due_date || null
    );

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ task });
});

// GET /api/tasks/:id — get single task with comments
router.get("/tasks/:id", (req: Request, res: Response) => {
  const task = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(req.params.id) as TaskRow | undefined;

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const comments = db
    .prepare(
      `SELECT c.*, u.name as author_name
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.task_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(req.params.id);

  res.json({ task: { ...task, comments } });
});

// PUT /api/tasks/:id — update a task
router.put("/tasks/:id", (req: Request, res: Response) => {
  const { title, description, status, priority, assignee_id, due_date } = req.body;

  const existing = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(req.params.id) as TaskRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const updatedTitle = title || existing.title;
  const updatedDescription = description ?? existing.description;
  const updatedStatus = status || existing.status;
  const updatedPriority = priority || existing.priority;
  const updatedAssignee = assignee_id !== undefined ? assignee_id : existing.assignee_id;
  const updatedDueDate = due_date !== undefined ? due_date : existing.due_date;

  let updatedAt = existing.updated_at;
  if (updatedStatus === "done") {
    updatedAt = new Date().toISOString();
  }

  db.prepare(
    `UPDATE tasks
     SET title = ?, description = ?, status = ?, priority = ?, assignee_id = ?, due_date = ?, updated_at = ?
     WHERE id = ?`
  ).run(updatedTitle, updatedDescription, updatedStatus, updatedPriority, updatedAssignee, updatedDueDate, updatedAt, req.params.id);

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  res.json({ task });
});

// DELETE /api/tasks/:id — delete a task
router.delete("/tasks/:id", (req: Request, res: Response) => {
  const existing = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(req.params.id);

  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  db.prepare("DELETE FROM comments WHERE task_id = ?").run(req.params.id);
  db.prepare("DELETE FROM tasks WHERE id = ?").run(req.params.id);

  res.json({ message: "Task deleted" });
});

// POST /api/tasks/:id/comments — add a comment
router.post("/tasks/:id/comments", (req: Request, res: Response) => {
  const { body: commentBody } = req.body;

  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (!commentBody) {
    res.status(400).json({ error: "Comment body is required" });
    return;
  }

  const result = db
    .prepare("INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)")
    .run(req.params.id, req.user!.userId, commentBody);

  const comment = db
    .prepare(
      `SELECT c.*, u.name as author_name
       FROM comments c
       LEFT JOIN users u ON u.id = c.user_id
       WHERE c.id = ?`
    )
    .get(result.lastInsertRowid);

  res.status(201).json({ comment });
});

export default router;
