import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireProjectAccess } from "../middleware/permissions.js";

const router = Router();

router.use(authMiddleware);

interface AutomationRow {
  id: number;
  project_id: number;
  name: string;
  trigger: string;
  conditions: string;
  actions: string;
  enabled: number;
  created_by: number;
  created_at: string;
}

// POST /api/projects/:projectId/automations — create automation rule
router.post("/projects/:projectId/automations", requireProjectAccess(), (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { name, trigger, conditions, actions } = req.body;

  if (!name || !trigger) {
    res.status(400).json({ error: "Name and trigger are required" });
    return;
  }

  const validTriggers = ["task.created", "task.status_changed", "task.assigned", "task.overdue"];
  if (!validTriggers.includes(trigger)) {
    res.status(400).json({ error: `Invalid trigger. Must be one of: ${validTriggers.join(", ")}` });
    return;
  }

  const result = db.prepare(
    "INSERT INTO automations (project_id, name, trigger, conditions, actions, created_by) VALUES (?, ?, ?, ?, ?, ?)"
  ).run(
    projectId,
    name,
    trigger,
    JSON.stringify(conditions || []),
    JSON.stringify(actions || []),
    req.user!.userId
  );

  const automation = db.prepare("SELECT * FROM automations WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ automation });
});

// GET /api/projects/:projectId/automations — list automation rules
router.get("/projects/:projectId/automations", requireProjectAccess(), (req: Request, res: Response) => {
  const { projectId } = req.params;

  const automations = db.prepare(
    "SELECT * FROM automations WHERE project_id = ? ORDER BY created_at DESC"
  ).all(projectId) as AutomationRow[];

  const parsed = automations.map((a) => ({
    ...a,
    conditions: JSON.parse(a.conditions),
    actions: JSON.parse(a.actions),
    enabled: Boolean(a.enabled),
  }));

  res.json({ automations: parsed });
});

// PUT /api/automations/:id — update automation rule
router.put("/automations/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, trigger, conditions, actions } = req.body;

  const existing = db.prepare("SELECT * FROM automations WHERE id = ?").get(id) as AutomationRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }

  db.prepare(
    "UPDATE automations SET name = ?, trigger = ?, conditions = ?, actions = ? WHERE id = ?"
  ).run(
    name || existing.name,
    trigger || existing.trigger,
    conditions ? JSON.stringify(conditions) : existing.conditions,
    actions ? JSON.stringify(actions) : existing.actions,
    id
  );

  const automation = db.prepare("SELECT * FROM automations WHERE id = ?").get(id);
  res.json({ automation });
});

// DELETE /api/automations/:id — delete automation rule
router.delete("/automations/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM automations WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }

  db.prepare("DELETE FROM automation_runs WHERE automation_id = ?").run(id);
  db.prepare("DELETE FROM automations WHERE id = ?").run(id);

  res.json({ message: "Automation deleted" });
});

// PUT /api/automations/:id/toggle — enable/disable automation
router.put("/automations/:id/toggle", (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM automations WHERE id = ?").get(id) as AutomationRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }

  const newEnabled = existing.enabled ? 0 : 1;
  db.prepare("UPDATE automations SET enabled = ? WHERE id = ?").run(newEnabled, id);

  const automation = db.prepare("SELECT * FROM automations WHERE id = ?").get(id);
  res.json({ automation });
});

// GET /api/automations/:id/history — execution log
router.get("/automations/:id/history", (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM automations WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "Automation not found" });
    return;
  }

  const runs = db.prepare(
    "SELECT * FROM automation_runs WHERE automation_id = ? ORDER BY created_at DESC"
  ).all(id);

  res.json({ runs });
});

export default router;
