import { Router, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { requireTeamRole } from "../middleware/permissions.js";

const router = Router();

router.use(authMiddleware);

interface InvitationRow {
  id: number;
  email: string;
  team_id: number;
  invited_by: number;
  token: string;
  status: string;
  created_at: string;
  expires_at: string;
}

interface TeamRow {
  id: number;
  name: string;
}

// POST /api/teams/:teamId/invite — send an invitation to a team
router.post(
  "/teams/:teamId/invite",
  requireTeamRole("admin"),
  (req: Request, res: Response) => {
    const { teamId } = req.params;
    const { email } = req.body;

    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }

    const team = db
      .prepare("SELECT id, name FROM teams WHERE id = ?")
      .get(teamId) as TeamRow | undefined;

    if (!team) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    // Check if user is already a member
    const existingUser = db
      .prepare(
        `SELECT u.id FROM users u
         JOIN team_members tm ON tm.user_id = u.id AND tm.team_id = ?
         WHERE u.email = ?`
      )
      .get(teamId, email);

    if (existingUser) {
      res.status(409).json({ error: "User is already a member of this team" });
      return;
    }

    // Check for existing pending invitation
    const existingInvite = db
      .prepare(
        "SELECT id FROM invitations WHERE email = ? AND team_id = ? AND status = 'pending'"
      )
      .get(email, teamId);

    if (existingInvite) {
      res.status(409).json({ error: "An invitation is already pending for this email" });
      return;
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

    const result = db
      .prepare(
        "INSERT INTO invitations (email, team_id, invited_by, token, expires_at) VALUES (?, ?, ?, ?, ?)"
      )
      .run(email, teamId, req.user!.userId, token, expiresAt);

    const invitation = db
      .prepare("SELECT * FROM invitations WHERE id = ?")
      .get(result.lastInsertRowid);

    res.status(201).json({ invitation });
  }
);

// GET /api/invitations — list pending invitations for the current user's email
router.get("/invitations", (req: Request, res: Response) => {
  const user = db
    .prepare("SELECT email FROM users WHERE id = ?")
    .get(req.user!.userId) as { email: string } | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const invitations = db
    .prepare(
      `SELECT i.*, t.name as team_name, u.name as invited_by_name
       FROM invitations i
       JOIN teams t ON t.id = i.team_id
       JOIN users u ON u.id = i.invited_by
       WHERE i.email = ? AND i.status = 'pending'
       ORDER BY i.created_at DESC`
    )
    .all(user.email);

  res.json({ invitations });
});

// POST /api/invitations/:id/accept — accept an invitation
router.post("/invitations/:id/accept", (req: Request, res: Response) => {
  const invitation = db
    .prepare("SELECT * FROM invitations WHERE id = ?")
    .get(req.params.id) as InvitationRow | undefined;

  if (!invitation) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  // Verify the invitation belongs to the current user's email
  const user = db
    .prepare("SELECT email FROM users WHERE id = ?")
    .get(req.user!.userId) as { email: string } | undefined;

  if (!user || user.email !== invitation.email) {
    res.status(403).json({ error: "This invitation is not for your account" });
    return;
  }

  if (invitation.status !== "pending") {
    res.status(400).json({ error: `Invitation has already been ${invitation.status}` });
    return;
  }

  // Add user to the team
  const existingMember = db
    .prepare("SELECT * FROM team_members WHERE team_id = ? AND user_id = ?")
    .get(invitation.team_id, req.user!.userId);

  if (existingMember) {
    // Already a member, just mark invitation as accepted
    db.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?").run(req.params.id);
    res.json({ message: "You are already a member of this team" });
    return;
  }

  db.prepare("INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, 'member')").run(
    invitation.team_id,
    req.user!.userId
  );

  db.prepare("UPDATE invitations SET status = 'accepted' WHERE id = ?").run(req.params.id);

  res.json({ message: "Invitation accepted. You have been added to the team." });
});

// POST /api/invitations/:id/decline — decline an invitation
router.post("/invitations/:id/decline", (req: Request, res: Response) => {
  const invitation = db
    .prepare("SELECT * FROM invitations WHERE id = ?")
    .get(req.params.id) as InvitationRow | undefined;

  if (!invitation) {
    res.status(404).json({ error: "Invitation not found" });
    return;
  }

  const user = db
    .prepare("SELECT email FROM users WHERE id = ?")
    .get(req.user!.userId) as { email: string } | undefined;

  if (!user || user.email !== invitation.email) {
    res.status(403).json({ error: "This invitation is not for your account" });
    return;
  }

  if (invitation.status !== "pending") {
    res.status(400).json({ error: `Invitation has already been ${invitation.status}` });
    return;
  }

  db.prepare("UPDATE invitations SET status = 'declined' WHERE id = ?").run(req.params.id);

  res.json({ message: "Invitation declined" });
});

// GET /api/invitations/verify/:token — verify an invitation token is valid
router.get("/invitations/verify/:token", (req: Request, res: Response) => {
  const invitation = db
    .prepare(
      `SELECT i.*, t.name as team_name, u.name as invited_by_name
       FROM invitations i
       JOIN teams t ON t.id = i.team_id
       JOIN users u ON u.id = i.invited_by
       WHERE i.token = ?`
    )
    .get(req.params.token) as (InvitationRow & { team_name: string; invited_by_name: string }) | undefined;

  if (!invitation) {
    res.status(404).json({ error: "Invalid invitation token" });
    return;
  }

  if (invitation.status !== "pending") {
    res.status(400).json({ error: `Invitation has already been ${invitation.status}` });
    return;
  }

  res.json({
    valid: true,
    invitation: {
      id: invitation.id,
      email: invitation.email,
      team_name: invitation.team_name,
      invited_by_name: invitation.invited_by_name,
      expires_at: invitation.expires_at,
    },
  });
});

export default router;
