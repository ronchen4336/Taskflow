import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireProjectAccess } from "../middleware/permissions.js";

const router = Router();

router.use(authMiddleware);

interface FilterRow {
  id: number;
  user_id: number;
  project_id: number;
  name: string;
  filter: string;
  created_at: string;
}

interface FilterCriteria {
  status?: string;
  priority?: string;
  assignee?: string | number;
  labels?: string[];
  due_before?: string;
  due_after?: string;
}

// POST /api/projects/:projectId/filters — save a filter
router.post("/projects/:projectId/filters", requireProjectAccess(), (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { name, filter } = req.body;

  if (!name) {
    res.status(400).json({ error: "Filter name is required" });
    return;
  }

  if (!filter || typeof filter !== "object") {
    res.status(400).json({ error: "Filter criteria object is required" });
    return;
  }

  const result = db
    .prepare("INSERT INTO saved_filters (user_id, project_id, name, filter) VALUES (?, ?, ?, ?)")
    .run(req.user!.userId, projectId, name, JSON.stringify(filter));

  const saved = db.prepare("SELECT * FROM saved_filters WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ filter: saved });
});

// GET /api/projects/:projectId/filters — list saved filters
router.get("/projects/:projectId/filters", requireProjectAccess(), (req: Request, res: Response) => {
  const { projectId } = req.params;

  const filters = db
    .prepare("SELECT * FROM saved_filters WHERE project_id = ? ORDER BY created_at DESC")
    .all(projectId) as FilterRow[];

  const parsed = filters.map((f) => ({ ...f, filter: JSON.parse(f.filter) }));
  res.json({ filters: parsed });
});

// DELETE /api/filters/:id
router.delete("/filters/:id", (req: Request, res: Response) => {
  const filter = db.prepare("SELECT * FROM saved_filters WHERE id = ?").get(req.params.id);
  if (!filter) {
    res.status(404).json({ error: "Filter not found" });
    return;
  }

  db.prepare("DELETE FROM saved_filters WHERE id = ?").run(req.params.id);
  res.json({ message: "Filter deleted" });
});

// GET /api/projects/:projectId/tasks with ?filter=:filterId support
// This is an enhanced version that applies a saved filter
router.get("/projects/:projectId/tasks/filtered", requireProjectAccess(), (req: Request, res: Response) => {
  const { projectId } = req.params;
  const filterId = req.query.filter as string;

  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  let criteria: FilterCriteria = {};

  if (filterId) {
    const savedFilter = db.prepare("SELECT * FROM saved_filters WHERE id = ? AND project_id = ?").get(filterId, projectId) as FilterRow | undefined;
    if (!savedFilter) {
      res.status(404).json({ error: "Saved filter not found" });
      return;
    }
    criteria = JSON.parse(savedFilter.filter) as FilterCriteria;
  }

  let query = "SELECT * FROM tasks WHERE project_id = ?";
  const params: unknown[] = [projectId];

  if (criteria.status) {
    query += " AND status = ?";
    params.push(criteria.status);
  }

  if (criteria.priority) {
    query += " AND priority = ?";
    params.push(criteria.priority);
  }

  if (criteria.assignee) {
    query += " AND assignee_id = ?";
    params.push(criteria.assignee);
  }

  if (criteria.due_before) {
    query += " AND due_date <= ?";
    params.push(criteria.due_before);
  }

  if (criteria.due_after) {
    query += " AND due_date >= ?";
    params.push(criteria.due_after);
  }

  query += " ORDER BY position ASC, created_at DESC";

  let tasks = db.prepare(query).all(...params);

  // Filter by labels if specified (requires join lookup)
  if (criteria.labels && Array.isArray(criteria.labels) && criteria.labels.length > 0) {
    const taskIds = tasks.map((t: Record<string, unknown>) => t.id);
    if (taskIds.length > 0) {
      const placeholders = taskIds.map(() => "?").join(",");
      const labelAssignments = db
        .prepare(
          `SELECT tla.task_id, tl.name FROM task_label_assignments tla
           JOIN task_labels tl ON tl.id = tla.label_id
           WHERE tla.task_id IN (${placeholders})`
        )
        .all(...taskIds) as { task_id: number; name: string }[];

      const taskLabelMap = new Map<number, string[]>();
      for (const la of labelAssignments) {
        const existing = taskLabelMap.get(la.task_id) || [];
        existing.push(la.name);
        taskLabelMap.set(la.task_id, existing);
      }

      tasks = tasks.filter((t: Record<string, unknown>) => {
        const taskLabels = taskLabelMap.get(t.id as number) || [];
        return criteria.labels!.some((l: string) => taskLabels.includes(l));
      });
    }
  }

  res.json({ tasks, filter: criteria });
});

export default router;
