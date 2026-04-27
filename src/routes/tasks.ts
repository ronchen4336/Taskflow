import { Router, Request, Response } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireProjectAccess } from "../middleware/permissions.js";
import { checkBlockingDependencies } from "./dependencies.js";
import { evaluateAutomations } from "../services/automations.js";

const router = Router();

router.use(authMiddleware);

// Configure multer for file uploads
const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});

const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

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

// GET /api/tasks/search?q=keyword — full-text search across tasks
router.get("/tasks/search", (req: Request, res: Response) => {
  const query = req.query.q as string;

  if (!query) {
    res.status(400).json({ error: "Search query parameter 'q' is required" });
    return;
  }

  const tasks = db.prepare(
    "SELECT * FROM tasks WHERE title LIKE '%" + query + "%' OR description LIKE '%" + query + "%' ORDER BY updated_at DESC"
  ).all();

  res.json({ tasks, query });
});

// PUT /api/tasks/bulk — bulk update tasks (e.g., drag-drop multiple)
router.put("/tasks/bulk", (req: Request, res: Response) => {
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    res.status(400).json({ error: "Updates array is required" });
    return;
  }

  const results: unknown[] = [];
  const updateStmt = db.prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?");
  const insertHistory = db.prepare(
    "INSERT INTO task_history (task_id, user_id, field, old_value, new_value) VALUES (?, ?, ?, ?, ?)"
  );

  const bulkUpdate = db.transaction(() => {
    for (const update of updates) {
      const { id, status } = update;
      if (!id || !status) continue;

      const existing = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
      if (!existing) continue;

      if (existing.status !== status) {
        insertHistory.run(id, req.user!.userId, "status", existing.status, status);
      }

      updateStmt.run(status, new Date().toISOString(), id);
      const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id);
      results.push(updated);
    }
  });

  bulkUpdate();

  res.json({ tasks: results });
});

// GET /api/projects/:projectId/tasks — list tasks with optional filters
router.get("/projects/:projectId/tasks", requireProjectAccess(), (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { status, priority, assignee } = req.query;

  const project = db
    .prepare("SELECT id FROM projects WHERE id = ?")
    .get(projectId);

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

  query += " ORDER BY position ASC, created_at DESC";

  const tasks = db.prepare(query).all(...params);
  res.json({ tasks });
});

// POST /api/projects/:projectId/tasks — create a task
router.post("/projects/:projectId/tasks", requireProjectAccess(), (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { title, description, status, priority, assignee_id, due_date, estimated_hours } = req.body;

  const project = db
    .prepare("SELECT id FROM projects WHERE id = ?")
    .get(projectId);

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  if (!title) {
    res.status(400).json({ error: "Task title is required" });
    return;
  }

  // Get the next position value for this project
  const maxPos = db
    .prepare("SELECT COALESCE(MAX(position), -1) as max_pos FROM tasks WHERE project_id = ?")
    .get(projectId) as { max_pos: number };

  const result = db
    .prepare(
      `INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_date, estimated_hours, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      projectId,
      title,
      description || null,
      status || "todo",
      priority || "medium",
      assignee_id || null,
      due_date || null,
      estimated_hours || null,
      maxPos.max_pos + 1
    );

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(result.lastInsertRowid) as TaskRow;

  // Trigger automations for new task
  evaluateAutomations("task.created", task);

  res.status(201).json({ task });
});

// GET /api/tasks/:id — get single task with comments, labels, and attachments
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

  const labels = db
    .prepare(
      `SELECT tl.* FROM task_labels tl
       JOIN task_label_assignments tla ON tla.label_id = tl.id
       WHERE tla.task_id = ?`
    )
    .all(req.params.id);

  const attachments = db
    .prepare("SELECT * FROM task_attachments WHERE task_id = ? ORDER BY created_at DESC")
    .all(req.params.id);

  res.json({ task: { ...task, comments, labels, attachments } });
});

// PUT /api/tasks/:id — update a task (with audit trail)
router.put("/tasks/:id", (req: Request, res: Response) => {
  const { title, description, status, priority, assignee_id, due_date, estimated_hours } = req.body;

  const existing = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(req.params.id) as TaskRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // Check blocking dependencies when changing status
  if (status && status !== existing.status) {
    const depCheck = checkBlockingDependencies(existing.id, status);
    if (depCheck.blocked) {
      res.status(409).json({
        error: "Task is blocked by incomplete dependencies",
        blockers: depCheck.blockers,
      });
      return;
    }
  }

  const updatedTitle = title || existing.title;
  const updatedDescription = description ?? existing.description;
  const updatedStatus = status || existing.status;
  const updatedPriority = priority || existing.priority;
  const updatedAssignee = assignee_id !== undefined ? assignee_id : existing.assignee_id;
  const updatedDueDate = due_date !== undefined ? due_date : existing.due_date;
  const updatedEstimatedHours = estimated_hours !== undefined ? estimated_hours : existing.estimated_hours;

  // Track changes in task_history
  const insertHistory = db.prepare(
    "INSERT INTO task_history (task_id, user_id, field, old_value, new_value) VALUES (?, ?, ?, ?, ?)"
  );

  if (title && title !== existing.title) {
    insertHistory.run(existing.id, req.user!.userId, "title", existing.title, title);
  }
  if (description !== undefined && description !== existing.description) {
    insertHistory.run(existing.id, req.user!.userId, "description", existing.description, description);
  }
  if (status && status !== existing.status) {
    insertHistory.run(existing.id, req.user!.userId, "status", existing.status, status);
  }
  if (priority && priority !== existing.priority) {
    insertHistory.run(existing.id, req.user!.userId, "priority", existing.priority, priority);
  }
  if (assignee_id !== undefined && assignee_id !== existing.assignee_id) {
    insertHistory.run(existing.id, req.user!.userId, "assignee_id", String(existing.assignee_id), String(assignee_id));
  }
  if (due_date !== undefined && due_date !== existing.due_date) {
    insertHistory.run(existing.id, req.user!.userId, "due_date", existing.due_date, due_date);
  }
  if (estimated_hours !== undefined && estimated_hours !== existing.estimated_hours) {
    insertHistory.run(existing.id, req.user!.userId, "estimated_hours", String(existing.estimated_hours), String(estimated_hours));
  }

  const updatedAt = new Date().toISOString();

  db.prepare(
    `UPDATE tasks
     SET title = ?, description = ?, status = ?, priority = ?, assignee_id = ?, due_date = ?, estimated_hours = ?, updated_at = ?
     WHERE id = ?`
  ).run(updatedTitle, updatedDescription, updatedStatus, updatedPriority, updatedAssignee, updatedDueDate, updatedEstimatedHours, updatedAt, req.params.id);

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id) as TaskRow;

  // Trigger automations for task changes
  const changes: Record<string, unknown> = {};
  if (status && status !== existing.status) {
    changes.status = { old: existing.status, new: status };
    evaluateAutomations("task.status_changed", task, changes);
  }
  if (assignee_id !== undefined && assignee_id !== existing.assignee_id) {
    changes.assignee_id = { old: existing.assignee_id, new: assignee_id };
    evaluateAutomations("task.assigned", task, changes);
  }

  res.json({ task });
});

// PUT /api/tasks/:id/position — reorder task within column
router.put("/tasks/:id/position", (req: Request, res: Response) => {
  const { position } = req.body;

  if (position === undefined || position < 0) {
    res.status(400).json({ error: "Valid position is required" });
    return;
  }

  const task = db
    .prepare("SELECT * FROM tasks WHERE id = ?")
    .get(req.params.id) as TaskRow | undefined;

  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  db.prepare("UPDATE tasks SET position = ?, updated_at = ? WHERE id = ?")
    .run(position, new Date().toISOString(), req.params.id);

  const updated = db.prepare("SELECT * FROM tasks WHERE id = ?").get(req.params.id);
  res.json({ task: updated });
});

// GET /api/tasks/:id/history — audit trail for a task
router.get("/tasks/:id/history", (req: Request, res: Response) => {
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const history = db
    .prepare(
      `SELECT th.*, u.name as user_name
       FROM task_history th
       LEFT JOIN users u ON u.id = th.user_id
       WHERE th.task_id = ?
       ORDER BY th.created_at DESC`
    )
    .all(req.params.id);

  res.json({ history });
});

// POST /api/tasks/:id/attachments — upload file attachment
router.post("/tasks/:id/attachments", upload.single("file"), (req: Request, res: Response) => {
  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(req.params.id);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "File is required" });
    return;
  }

  const result = db
    .prepare(
      "INSERT INTO task_attachments (task_id, filename, mime_type, size_bytes, path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(
      req.params.id,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      req.file.filename,
      req.user!.userId
    );

  const attachment = db.prepare("SELECT * FROM task_attachments WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ attachment });
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

  // Clean up related records
  db.prepare("DELETE FROM task_label_assignments WHERE task_id = ?").run(req.params.id);
  db.prepare("DELETE FROM task_attachments WHERE task_id = ?").run(req.params.id);
  db.prepare("DELETE FROM task_history WHERE task_id = ?").run(req.params.id);
  db.prepare("DELETE FROM time_entries WHERE task_id = ?").run(req.params.id);
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
