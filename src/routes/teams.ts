import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireTeamRole } from "../middleware/permissions.js";

const router = Router();

router.use(authMiddleware);

interface TeamRow {
  id: number;
  name: string;
  description: string | null;
  created_by: number;
  created_at: string;
}

interface TeamMemberRow {
  user_id: number;
  role: string;
  joined_at: string;
  name: string;
  email: string;
}

interface UserRow {
  id: number;
  email: string;
  name: string;
}

// POST /api/teams — create a new team
router.post("/", (req: Request, res: Response) => {
  const { name, description } = req.body;

  if (!name) {
    res.status(400).json({ error: "Team name is required" });
    return;
  }

  const result = db
    .prepare("INSERT INTO teams (name, description, created_by) VALUES (?, ?, ?)")
    .run(name, description || null, req.user!.userId);

  // Creator automatically becomes the team owner
  db.prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)").run(
    result.lastInsertRowid,
    req.user!.userId,
    "owner"
  );

  const team = db.prepare("SELECT * FROM teams WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ team });
});

// GET /api/teams — list the current user's teams
router.get("/", (req: Request, res: Response) => {
  const teams = db
    .prepare(
      `SELECT t.*, tm.role as user_role,
              (SELECT COUNT(*) FROM team_members WHERE team_id = t.id) as member_count
       FROM teams t
       JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ?
       ORDER BY t.created_at DESC`
    )
    .all(req.user!.userId);

  res.json({ teams });
});

// GET /api/teams/:id — team detail with members
router.get("/:id", requireTeamRole("member"), (req: Request, res: Response) => {
  const team = db
    .prepare("SELECT * FROM teams WHERE id = ?")
    .get(req.params.id) as TeamRow | undefined;

  if (!team) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const members = db
    .prepare(
      `SELECT tm.user_id, tm.role, tm.joined_at, u.name, u.email
       FROM team_members tm
       JOIN users u ON u.id = tm.user_id
       WHERE tm.team_id = ?
       ORDER BY tm.joined_at ASC`
    )
    .all(req.params.id) as TeamMemberRow[];

  const projects = db
    .prepare("SELECT id, name, description, created_at FROM projects WHERE team_id = ?")
    .all(req.params.id);

  res.json({ team, members, projects });
});

// PUT /api/teams/:id — update team name/description (owner only)
router.put("/:id", requireTeamRole("owner"), (req: Request, res: Response) => {
  const { name, description } = req.body;

  const existing = db
    .prepare("SELECT * FROM teams WHERE id = ?")
    .get(req.params.id) as TeamRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  db.prepare("UPDATE teams SET name = ?, description = ? WHERE id = ?").run(
    name || existing.name,
    description ?? existing.description,
    req.params.id
  );

  const updated = db.prepare("SELECT * FROM teams WHERE id = ?").get(req.params.id);
  res.json({ team: updated });
});

// DELETE /api/teams/:id — delete team (owner only, must have no projects)
router.delete("/:id", requireTeamRole("owner"), (req: Request, res: Response) => {
  const existing = db
    .prepare("SELECT * FROM teams WHERE id = ?")
    .get(req.params.id) as TeamRow | undefined;

  if (!existing) {
    res.status(404).json({ error: "Team not found" });
    return;
  }

  const projectCount = db
    .prepare("SELECT COUNT(*) as count FROM projects WHERE team_id = ?")
    .get(req.params.id) as { count: number };

  if (projectCount.count > 0) {
    res.status(400).json({ error: "Cannot delete a team that has projects. Remove all projects first." });
    return;
  }

  db.prepare("DELETE FROM team_members WHERE team_id = ?").run(req.params.id);
  db.prepare("DELETE FROM invitations WHERE team_id = ?").run(req.params.id);
  db.prepare("DELETE FROM teams WHERE id = ?").run(req.params.id);

  res.json({ message: "Team deleted" });
});

// POST /api/teams/:id/members — add a member by email
router.post("/:id/members", requireTeamRole("admin"), (req: Request, res: Response) => {
  const { email, role } = req.body;

  if (!email) {
    res.status(400).json({ error: "Email is required" });
    return;
  }

  const user = db
    .prepare("SELECT id, email, name FROM users WHERE email = ?")
    .get(email) as UserRow | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found with that email" });
    return;
  }

  const existingMember = db
    .prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(req.params.id, user.id);

  if (existingMember) {
    res.status(409).json({ error: "User is already a member of this team" });
    return;
  }

  const memberRole = role || "member";
  db.prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)").run(
    req.params.id,
    user.id,
    memberRole
  );

  res.status(201).json({
    member: { user_id: user.id, name: user.name, email: user.email, role: memberRole },
  });
});

// DELETE /api/teams/:id/members/:userId — remove a member (owner only)
router.delete("/:id/members/:userId", requireTeamRole("owner"), (req: Request, res: Response) => {
  const { id: teamId, userId } = req.params;

  // Prevent owner from removing themselves
  if (Number(userId) === req.user!.userId) {
    res.status(400).json({ error: "Cannot remove yourself from the team. Transfer ownership first." });
    return;
  }

  const member = db
    .prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(teamId, userId);

  if (!member) {
    res.status(404).json({ error: "Member not found" });
    return;
  }

  db.prepare("DELETE FROM team_members WHERE team_id = ? AND user_id = ?").run(teamId, userId);

  res.json({ message: "Member removed" });
});

// PUT /api/teams/:id/members/:userId/role — change a member's role
router.put(
  "/:id/members/:userId/role",
  requireTeamRole("owner"),
  (req: Request, res: Response) => {
    const { id: teamId, userId } = req.params;
    const { role } = req.body;

    if (!role || !["member", "admin", "owner"].includes(role)) {
      res.status(400).json({ error: "Role must be 'member', 'admin', or 'owner'" });
      return;
    }

    const member = db
      .prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?")
      .get(teamId, userId);

    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    db.prepare("UPDATE team_members SET role = ? WHERE team_id = ? AND user_id = ?").run(
      role,
      teamId,
      userId
    );

    res.json({ message: "Role updated", userId: Number(userId), role });
  }
);

export default router;
