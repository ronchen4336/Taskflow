import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.use(authMiddleware);

interface TemplateRow {
  id: number;
  name: string;
  description: string | null;
  structure: string;
  created_by: number;
  created_at: string;
}

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
}

interface LabelRow {
  id: number;
  project_id: number;
  name: string;
  color: string;
}

// POST /api/templates — create template from an existing project
router.post("/", (req: Request, res: Response) => {
  const { name, description, project_id } = req.body;

  if (!name) {
    res.status(400).json({ error: "Template name is required" });
    return;
  }

  if (!project_id) {
    res.status(400).json({ error: "Project ID is required to snapshot tasks" });
    return;
  }

  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(project_id);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Snapshot project tasks and labels
  const tasks = db.prepare("SELECT * FROM tasks WHERE project_id = ? ORDER BY position ASC").all(project_id) as TaskRow[];
  const labels = db.prepare("SELECT * FROM task_labels WHERE project_id = ?").all(project_id) as LabelRow[];

  const structure = {
    tasks: tasks.map((t) => ({
      title: t.title,
      description: t.description,
      status: "todo",
      priority: t.priority,
      assignee_id: t.assignee_id,
      estimated_hours: t.estimated_hours,
      position: t.position,
    })),
    labels: labels.map((l) => ({
      name: l.name,
      color: l.color,
    })),
  };

  const result = db
    .prepare("INSERT INTO project_templates (name, description, structure, created_by) VALUES (?, ?, ?, ?)")
    .run(name, description || null, JSON.stringify(structure), req.user!.userId);

  const template = db.prepare("SELECT * FROM project_templates WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ template });
});

// GET /api/templates — list all templates
router.get("/", (_req: Request, res: Response) => {
  const templates = db.prepare("SELECT * FROM project_templates ORDER BY created_at DESC").all();
  res.json({ templates });
});

// GET /api/templates/:id — preview a template
router.get("/:id", (req: Request, res: Response) => {
  const template = db.prepare("SELECT * FROM project_templates WHERE id = ?").get(req.params.id) as TemplateRow | undefined;

  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const parsed = { ...template, structure: JSON.parse(template.structure) };
  res.json({ template: parsed });
});

// DELETE /api/templates/:id
router.delete("/:id", (req: Request, res: Response) => {
  const template = db.prepare("SELECT * FROM project_templates WHERE id = ?").get(req.params.id);

  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  db.prepare("DELETE FROM project_templates WHERE id = ?").run(req.params.id);
  res.json({ message: "Template deleted" });
});

// POST /api/projects/from-template/:templateId — create a project from a template
router.post("/from-template/:templateId", (req: Request, res: Response) => {
  const { name, description } = req.body;
  const { templateId } = req.params;

  if (!name) {
    res.status(400).json({ error: "Project name is required" });
    return;
  }

  const template = db.prepare("SELECT * FROM project_templates WHERE id = ?").get(templateId) as TemplateRow | undefined;

  if (!template) {
    res.status(404).json({ error: "Template not found" });
    return;
  }

  const structure = JSON.parse(template.structure);

  // Create the project
  const projectResult = db
    .prepare("INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)")
    .run(name, description || null, req.user!.userId);

  const projectId = projectResult.lastInsertRowid;

  // Add the creator as project owner
  db.prepare("INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)").run(projectId, req.user!.userId, "owner");

  // Copy labels from template
  const insertLabel = db.prepare("INSERT INTO task_labels (project_id, name, color) VALUES (?, ?, ?)");
  if (structure.labels && Array.isArray(structure.labels)) {
    for (const label of structure.labels) {
      insertLabel.run(projectId, label.name, label.color);
    }
  }

  // Copy tasks from template — assignee_ids copied directly from template
  const insertTask = db.prepare(
    `INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, estimated_hours, position)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );
  if (structure.tasks && Array.isArray(structure.tasks)) {
    for (const task of structure.tasks) {
      insertTask.run(
        projectId,
        task.title,
        task.description || null,
        task.status || "todo",
        task.priority || "medium",
        task.assignee_id || null,
        task.estimated_hours || null,
        task.position ?? 0
      );
    }
  }

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId);
  const tasks = db.prepare("SELECT * FROM tasks WHERE project_id = ? ORDER BY position ASC").all(projectId);
  res.status(201).json({ project, tasks });
});

export default router;
