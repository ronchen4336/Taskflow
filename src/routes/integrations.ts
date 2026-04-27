import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireProjectAccess } from "../middleware/permissions.js";
import { testIntegration } from "../services/integrations.js";

const router = Router();

router.use(authMiddleware);

interface IntegrationRow {
  id: number;
  project_id: number;
  type: string;
  config: string;
  enabled: number;
  created_by: number;
  created_at: string;
}

// POST /api/projects/:projectId/integrations — add integration
router.post("/projects/:projectId/integrations", requireProjectAccess(), (req: Request, res: Response) => {
  const { projectId } = req.params;
  const { type, config } = req.body;

  if (!type) {
    res.status(400).json({ error: "Integration type is required" });
    return;
  }

  const validTypes = ["slack", "email", "github"];
  if (!validTypes.includes(type)) {
    res.status(400).json({ error: `Invalid integration type. Must be one of: ${validTypes.join(", ")}` });
    return;
  }

  const result = db.prepare(
    "INSERT INTO integrations (project_id, type, config, created_by) VALUES (?, ?, ?, ?)"
  ).run(projectId, type, JSON.stringify(config || {}), req.user!.userId);

  const integration = db.prepare("SELECT * FROM integrations WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ integration });
});

// GET /api/projects/:projectId/integrations — list integrations
router.get("/projects/:projectId/integrations", requireProjectAccess(), (req: Request, res: Response) => {
  const { projectId } = req.params;

  const integrations = db.prepare(
    "SELECT * FROM integrations WHERE project_id = ? ORDER BY created_at DESC"
  ).all(projectId) as IntegrationRow[];

  const parsed = integrations.map((i) => ({
    ...i,
    config: JSON.parse(i.config),
    enabled: Boolean(i.enabled),
  }));

  res.json({ integrations: parsed });
});

// PUT /api/integrations/:id — update integration config
router.put("/integrations/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { config, enabled } = req.body;

  const existing = db.prepare("SELECT * FROM integrations WHERE id = ?").get(id) as IntegrationRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }

  db.prepare(
    "UPDATE integrations SET config = ?, enabled = ? WHERE id = ?"
  ).run(
    config ? JSON.stringify(config) : existing.config,
    enabled !== undefined ? (enabled ? 1 : 0) : existing.enabled,
    id
  );

  const updated = db.prepare("SELECT * FROM integrations WHERE id = ?").get(id);
  res.json({ integration: updated });
});

// DELETE /api/integrations/:id — remove integration
router.delete("/integrations/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM integrations WHERE id = ?").get(id);
  if (!existing) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }

  db.prepare("DELETE FROM integrations WHERE id = ?").run(id);
  res.json({ message: "Integration deleted" });
});

// POST /api/integrations/:id/test — test the connection
router.post("/integrations/:id/test", async (req: Request, res: Response) => {
  const { id } = req.params;

  const existing = db.prepare("SELECT * FROM integrations WHERE id = ?").get(id) as IntegrationRow | undefined;
  if (!existing) {
    res.status(404).json({ error: "Integration not found" });
    return;
  }

  const config = JSON.parse(existing.config);
  const result = await testIntegration(existing.type, config);
  res.json(result);
});

export default router;
