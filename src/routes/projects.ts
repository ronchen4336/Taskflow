import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireProjectAccess } from "../middleware/permissions.js";

const router = Router();

router.use(authMiddleware);

interface ProjectRow {
  id: number;
  name: string;
  description: string | null;
  owner_id: number;
  created_at: string;
  task_count?: number;
}

// GET /api/projects
router.get("/", (req: Request, res: Response) => {
  const projects = db
    .prepare(
      `SELECT p.*, COUNT(t.id) as task_count, pm.role as user_role
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       LEFT JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
       WHERE p.owner_id = ? OR pm.user_id = ?
       GROUP BY p.id
       ORDER BY p.created_at DESC`
    )
    .all(req.user!.userId, req.user!.userId, req.user!.userId);

  res.json({ projects });
});

// POST /api/projects
router.post("/", (req: Request, res: Response) => {
  const { name, description } = req.body;

  if (!name) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }

  const result = db
    .prepare("INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)")
    .run(name, description || null, req.user!.userId);

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ project });
});

// GET /api/projects/:id
router.get("/:id", requireProjectAccess(), (req: Request, res: Response) => {
  const project = db
    .prepare(
      `SELECT p.*, COUNT(t.id) as task_count
       FROM projects p
       LEFT JOIN tasks t ON t.project_id = p.id
       WHERE p.id = ?
       GROUP BY p.id`
    )
    .get(req.params.id) as ProjectRow | undefined;

  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  res.json({ project });
});

// PUT /api/projects/:id
router.put("/:id", requireProjectAccess("admin"), (req: Request, res: Response) => {
  const { name, description } = req.body;
  const existing = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(req.params.id) as ProjectRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  db.prepare("UPDATE projects SET name = ?, description = ? WHERE id = ?").run(
    name || existing.name,
    description ?? existing.description,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(req.params.id);
  res.json({ project: updated });
});

// DELETE /api/projects/:id
router.delete("/:id", requireProjectAccess("owner"), (req: Request, res: Response) => {
  const existing = db
    .prepare("SELECT * FROM projects WHERE id = ?")
    .get(req.params.id) as ProjectRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  db.prepare("DELETE FROM projects WHERE id = ?").run(req.params.id);

  res.json({ message: "Project deleted" });
});

export default router;
