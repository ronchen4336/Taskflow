import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireProjectAccess } from "../middleware/permissions.js";

const router = Router();

router.use(authMiddleware);

interface DependencyRow {
  id: number;
  task_id: number;
  depends_on_task_id: number;
  type: string;
  created_at: string;
}

interface TaskRow {
  id: number;
  project_id: number;
  title: string;
  status: string;
}

// POST /api/tasks/:taskId/dependencies — add a dependency
router.post("/tasks/:taskId/dependencies", (req: Request, res: Response) => {
  const { taskId } = req.params;
  const { depends_on, type } = req.body;

  if (!depends_on) {
    res.status(400).json({ error: "depends_on task ID is required" });
    return;
  }

  const depType = type || "blocks";
  if (!["blocks", "related"].includes(depType)) {
    res.status(400).json({ error: "type must be 'blocks' or 'related'" });
    return;
  }

  const task = db.prepare("SELECT * FROM tasks WHERE id = ?").get(taskId) as TaskRow | undefined;
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const dependsOnTask = db.prepare("SELECT * FROM tasks WHERE id = ?").get(depends_on) as TaskRow | undefined;
  if (!dependsOnTask) {
    res.status(404).json({ error: "Dependency task not found" });
    return;
  }

  if (String(taskId) === String(depends_on)) {
    res.status(400).json({ error: "A task cannot depend on itself" });
    return;
  }

  // Check for duplicate
  const existing = db
    .prepare("SELECT id FROM task_dependencies WHERE task_id = ? AND depends_on_task_id = ?")
    .get(taskId, depends_on);

  if (existing) {
    res.status(409).json({ error: "This dependency already exists" });
    return;
  }

  const result = db
    .prepare("INSERT INTO task_dependencies (task_id, depends_on_task_id, type) VALUES (?, ?, ?)")
    .run(taskId, depends_on, depType);

  const dependency = db.prepare("SELECT * FROM task_dependencies WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ dependency });
});

// GET /api/tasks/:taskId/dependencies — list dependencies for a task
router.get("/tasks/:taskId/dependencies", (req: Request, res: Response) => {
  const { taskId } = req.params;

  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  // Tasks this task depends on (blockers)
  const dependsOn = db
    .prepare(
      `SELECT td.*, t.title as depends_on_title, t.status as depends_on_status
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_task_id
       WHERE td.task_id = ?`
    )
    .all(taskId);

  // Tasks that depend on this task (blocked by this)
  const blockedBy = db
    .prepare(
      `SELECT td.*, t.title as task_title, t.status as task_status
       FROM task_dependencies td
       JOIN tasks t ON t.id = td.task_id
       WHERE td.depends_on_task_id = ?`
    )
    .all(taskId);

  res.json({ depends_on: dependsOn, blocks: blockedBy });
});

// DELETE /api/tasks/:taskId/dependencies/:depId
router.delete("/tasks/:taskId/dependencies/:depId", (req: Request, res: Response) => {
  const { depId } = req.params;

  const dep = db.prepare("SELECT * FROM task_dependencies WHERE id = ?").get(depId);
  if (!dep) {
    res.status(404).json({ error: "Dependency not found" });
    return;
  }

  db.prepare("DELETE FROM task_dependencies WHERE id = ?").run(depId);
  res.json({ message: "Dependency removed" });
});

// GET /api/projects/:projectId/dependency-graph — adjacency list for visualization
router.get("/projects/:projectId/dependency-graph", requireProjectAccess(), (req: Request, res: Response) => {
  const { projectId } = req.params;

  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const tasks = db.prepare("SELECT id, title, status FROM tasks WHERE project_id = ?").all(projectId) as TaskRow[];

  const dependencies = db
    .prepare(
      `SELECT td.* FROM task_dependencies td
       JOIN tasks t ON t.id = td.task_id
       WHERE t.project_id = ?`
    )
    .all(projectId) as DependencyRow[];

  // Build adjacency list: task_id -> [depends_on_task_ids]
  const graph: Record<number, { task: { id: number; title: string; status: string }; depends_on: number[]; blocks: number[] }> = {};

  for (const task of tasks) {
    graph[task.id] = { task: { id: task.id, title: task.title, status: task.status }, depends_on: [], blocks: [] };
  }

  for (const dep of dependencies) {
    if (graph[dep.task_id]) {
      graph[dep.task_id].depends_on.push(dep.depends_on_task_id);
    }
    if (graph[dep.depends_on_task_id]) {
      graph[dep.depends_on_task_id].blocks.push(dep.task_id);
    }
  }

  res.json({ graph, tasks, dependencies });
});

/**
 * Check if blocking dependencies are complete before allowing status change.
 * Used by task update route.
 */
export function checkBlockingDependencies(taskId: number, newStatus: string): { blocked: boolean; blockers: string[] } {
  if (newStatus !== "in_progress" && newStatus !== "done") {
    return { blocked: false, blockers: [] };
  }

  const blockingDeps = db
    .prepare(
      `SELECT t.id, t.title, t.status FROM task_dependencies td
       JOIN tasks t ON t.id = td.depends_on_task_id
       WHERE td.task_id = ? AND td.type = 'blocks'`
    )
    .all(taskId) as TaskRow[];

  const incomplete = blockingDeps.filter((t) => t.status !== "done");
  return {
    blocked: incomplete.length > 0,
    blockers: incomplete.map((t) => `"${t.title}" (${t.status})`),
  };
}

export default router;
