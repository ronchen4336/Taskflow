import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.use(authMiddleware);

interface UserRow {
  id: number;
  email: string;
  name: string;
  role: string;
  created_at: string;
}

/**
 * Middleware that restricts access to admin users only.
 */
function requireAdmin(req: Request, res: Response, next: () => void): void {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Admin access required" });
    return;
  }
  next();
}

// GET /api/users — list all users (admin only)
router.get("/", requireAdmin, (_req: Request, res: Response) => {
  const users = db
    .prepare("SELECT id, email, name, role, created_at FROM users ORDER BY created_at ASC")
    .all();

  res.json({ users });
});

// GET /api/users/:id — get user profile
router.get("/:id", (req: Request, res: Response) => {
  const user = db
    .prepare("SELECT id, email, name, role, created_at FROM users WHERE id = ?")
    .get(req.params.id) as UserRow | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Include team memberships
  const teams = db
    .prepare(
      `SELECT t.id, t.name, tm.role, tm.joined_at
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id
       WHERE tm.user_id = ?
       ORDER BY tm.joined_at ASC`
    )
    .all(req.params.id);

  // Include project memberships
  const projects = db
    .prepare(
      `SELECT p.id, p.name, pm.role, pm.added_at
       FROM projects p
       JOIN project_members pm ON pm.project_id = p.id
       WHERE pm.user_id = ?
       ORDER BY pm.added_at ASC`
    )
    .all(req.params.id);

  res.json({ user, teams, projects });
});

// PUT /api/users/:id/role — change a user's role (admin only)
router.put("/:id/role", requireAdmin, (req: Request, res: Response) => {
  const { role } = req.body;

  if (!role || !["member", "admin"].includes(role)) {
    res.status(400).json({ error: "Role must be 'member' or 'admin'" });
    return;
  }

  const user = db
    .prepare("SELECT id, email, name, role FROM users WHERE id = ?")
    .get(req.params.id) as UserRow | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Prevent admin from demoting themselves
  if (Number(req.params.id) === req.user!.userId && role !== "admin") {
    res.status(400).json({ error: "Cannot change your own admin role" });
    return;
  }

  db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, req.params.id);

  res.json({ message: "User role updated", userId: Number(req.params.id), role });
});

// GET /api/users/:id/activity — user's recent activity
router.get("/:id/activity", (req: Request, res: Response) => {
  const user = db
    .prepare("SELECT id FROM users WHERE id = ?")
    .get(req.params.id) as { id: number } | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Recent tasks assigned to the user
  const recentTasks = db
    .prepare(
      `SELECT t.id, t.title, t.status, t.priority, t.updated_at, p.name as project_name
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.assignee_id = ?
       ORDER BY t.updated_at DESC
       LIMIT 20`
    )
    .all(req.params.id);

  // Recent comments by the user
  const recentComments = db
    .prepare(
      `SELECT c.id, c.body, c.created_at, t.title as task_title, t.id as task_id
       FROM comments c
       JOIN tasks t ON t.id = c.task_id
       WHERE c.user_id = ?
       ORDER BY c.created_at DESC
       LIMIT 20`
    )
    .all(req.params.id);

  res.json({
    activity: {
      recent_tasks: recentTasks,
      recent_comments: recentComments,
    },
  });
});

export default router;
