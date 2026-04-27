import { Router, Request, Response } from "express";
import os from "os";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { getAuditLogs, logAction } from "../services/audit.js";

const router = Router();

router.use(authMiddleware);

/**
 * Require admin role for all admin endpoints.
 */
function requireAdmin(req: Request, res: Response, next: () => void): void {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

router.use(requireAdmin);

// GET /api/admin/audit-log — paginated, filterable audit log
router.get("/audit-log", (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
  const userId = req.query.user_id ? parseInt(req.query.user_id as string) : undefined;
  const action = req.query.action as string | undefined;
  const resourceType = req.query.resource_type as string | undefined;
  const startDate = req.query.start_date as string | undefined;
  const endDate = req.query.end_date as string | undefined;

  const result = getAuditLogs({ page, limit, userId, action, resourceType, startDate, endDate });
  res.json(result);
});

// GET /api/admin/stats — system-wide statistics
router.get("/stats", (_req: Request, res: Response) => {
  const totalUsers = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  const totalProjects = db.prepare("SELECT COUNT(*) as count FROM projects").get() as { count: number };
  const totalTasks = db.prepare("SELECT COUNT(*) as count FROM tasks").get() as { count: number };
  const totalTeams = db.prepare("SELECT COUNT(*) as count FROM teams").get() as { count: number };
  const activeSessions = db
    .prepare("SELECT COUNT(*) as count FROM sessions WHERE revoked = 0")
    .get() as { count: number };

  // DB file size
  const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as { size: number };

  // Tasks by status
  const tasksByStatus = db
    .prepare("SELECT status, COUNT(*) as count FROM tasks GROUP BY status")
    .all();

  // Tasks by priority
  const tasksByPriority = db
    .prepare("SELECT priority, COUNT(*) as count FROM tasks GROUP BY priority")
    .all();

  res.json({
    stats: {
      total_users: totalUsers.count,
      total_projects: totalProjects.count,
      total_tasks: totalTasks.count,
      total_teams: totalTeams.count,
      active_sessions: activeSessions.count,
      storage_bytes: dbSize.size,
      tasks_by_status: tasksByStatus,
      tasks_by_priority: tasksByPriority,
    },
  });
});

// GET /api/admin/active-sessions — list all active sessions
router.get("/active-sessions", (_req: Request, res: Response) => {
  const sessions = db
    .prepare(
      `SELECT s.id, s.user_id, u.name as user_name, u.email as user_email,
              s.ip_address, s.user_agent, s.created_at, s.last_active
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.revoked = 0
       ORDER BY s.last_active DESC`
    )
    .all();

  res.json({ sessions });
});

// DELETE /api/admin/sessions/:id — revoke a session
router.delete("/sessions/:id", (req: Request, res: Response) => {
  const sessionId = parseInt(req.params.id);

  const session = db.prepare("SELECT id, user_id FROM sessions WHERE id = ?").get(sessionId) as
    | { id: number; user_id: number }
    | undefined;

  if (!session) {
    res.status(404).json({ error: "Session not found" });
    return;
  }

  db.prepare("UPDATE sessions SET revoked = 1 WHERE id = ?").run(sessionId);

  logAction({
    userId: req.user!.userId,
    action: "delete",
    resourceType: "session",
    resourceId: String(sessionId),
    details: { revoked_user_id: session.user_id },
    req,
  });

  res.json({ message: "Session revoked" });
});

// GET /api/admin/api-keys — list all API keys across users
router.get("/api-keys", (_req: Request, res: Response) => {
  const keys = db
    .prepare(
      `SELECT ak.id, ak.user_id, u.name as user_name, u.email as user_email,
              ak.name, ak.prefix, ak.permissions, ak.last_used, ak.created_at, ak.expires_at
       FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       ORDER BY ak.created_at DESC`
    )
    .all();

  const parsed = (keys as Array<Record<string, unknown>>).map((k) => ({
    ...k,
    permissions: JSON.parse(k.permissions as string),
  }));

  res.json({ api_keys: parsed });
});

// POST /api/admin/announce — create a system announcement
router.post("/announce", (req: Request, res: Response) => {
  const { title, body } = req.body;

  if (!title || !body) {
    res.status(400).json({ error: "Title and body are required" });
    return;
  }

  const result = db
    .prepare("INSERT INTO announcements (title, body, created_by) VALUES (?, ?, ?)")
    .run(title, body, req.user!.userId);

  logAction({
    userId: req.user!.userId,
    action: "create",
    resourceType: "announcement",
    resourceId: String(result.lastInsertRowid),
    details: { title },
    req,
  });

  res.status(201).json({
    announcement: {
      id: Number(result.lastInsertRowid),
      title,
      body,
      created_by: req.user!.userId,
      created_at: new Date().toISOString(),
    },
  });
});

// GET /api/admin/announcements — list all announcements
router.get("/announcements", (_req: Request, res: Response) => {
  const announcements = db
    .prepare(
      `SELECT a.*, u.name as author_name
       FROM announcements a
       JOIN users u ON u.id = a.created_by
       ORDER BY a.created_at DESC`
    )
    .all();

  res.json({ announcements });
});

// GET /api/admin/health — detailed system health
router.get("/health", (_req: Request, res: Response) => {
  const dbSize = db.prepare("SELECT page_count * page_size as size FROM pragma_page_count(), pragma_page_size()").get() as { size: number };

  // Row counts for all tables
  const tables = [
    "users", "projects", "tasks", "comments", "teams", "team_members",
    "project_members", "invitations", "audit_log", "api_keys", "sessions",
    "announcements", "task_labels", "task_attachments", "time_entries",
  ];

  const tableCounts: Record<string, number> = {};
  for (const table of tables) {
    const row = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
    tableCounts[table] = row.count;
  }

  res.json({
    health: {
      status: "ok",
      uptime_seconds: process.uptime(),
      memory_usage: process.memoryUsage(),
      db_size_bytes: dbSize.size,
      table_row_counts: tableCounts,
      node_version: process.version,
      platform: os.platform(),
      timestamp: new Date().toISOString(),
    },
  });
});

export default router;
