import { Router, Request, Response } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { authMiddleware, generateToken } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";

const router = Router();

interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  created_at: string;
}

interface ResetTokenRow {
  id: number;
  token: string;
  user_id: number;
  expires_at: string;
  used: number;
}

// POST /api/auth/login
router.post("/login", validate({ body: { email: "email", password: "string" } }), (req: Request, res: Response) => {
  const { email, password } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: "Email and password are required" });
    return;
  }

  const user = db.prepare("SELECT * FROM users WHERE email = ?").get(email) as UserRow | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    res.status(401).json({ error: "Invalid email or password" });
    return;
  }

  const token = generateToken({ userId: user.id, email: user.email, role: user.role });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

// POST /api/auth/register
router.post("/register", validate({ body: { email: "email", name: "string", password: "string" } }), (req: Request, res: Response) => {
  const { email, name, password } = req.body;

  if (!email || !name || !password) {
    res.status(400).json({ error: "Email, name, and password are required" });
    return;
  }

  if (password.length < 6) {
    res.status(400).json({ error: "Password must be at least 6 characters" });
    return;
  }

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    "INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)"
  ).run(email, name, hash);

  const token = generateToken({
    userId: Number(result.lastInsertRowid),
    email,
    role: "member",
  });

  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 24 * 60 * 60 * 1000,
  });

  res.status(201).json({
    token,
    user: { id: Number(result.lastInsertRowid), email, name, role: "member" },
  });
});

// GET /api/auth/me
router.get("/me", authMiddleware, (req: Request, res: Response) => {
  const user = db
    .prepare("SELECT id, email, name, role, created_at FROM users WHERE id = ?")
    .get(req.user!.userId) as Omit<UserRow, "password_hash"> | undefined;

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ user });
});

// POST /api/auth/logout
router.post("/logout", (_req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "Logged out" });
});

// POST /api/auth/forgot-password
router.post(
  "/forgot-password",
  validate({ body: { email: "email" } }),
  (req: Request, res: Response) => {
    const { email } = req.body;

    const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;

    // Always return success to avoid email enumeration
    if (!user) {
      res.json({ message: "If an account with that email exists, a reset link has been sent" });
      return;
    }

    // Invalidate any existing unused tokens for this user
    db.prepare(
      "UPDATE password_reset_tokens SET used = 1 WHERE user_id = ? AND used = 0"
    ).run(user.id);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    db.prepare(
      "INSERT INTO password_reset_tokens (token, user_id, expires_at) VALUES (?, ?, ?)"
    ).run(token, user.id, expiresAt);

    // In production, send email with reset link containing the token
    // For now, include the token in the response for development
    res.json({
      message: "If an account with that email exists, a reset link has been sent",
      resetToken: process.env.NODE_ENV !== "production" ? token : undefined,
    });
  }
);

// POST /api/auth/reset-password
router.post(
  "/reset-password",
  validate({ body: { token: "string", password: "string" } }),
  (req: Request, res: Response) => {
    const { token, password } = req.body;

    if (password.length < 6) {
      res.status(400).json({ error: "Password must be at least 6 characters", code: "WEAK_PASSWORD" });
      return;
    }

    const resetToken = db.prepare(
      "SELECT * FROM password_reset_tokens WHERE token = ? AND used = 0"
    ).get(token) as ResetTokenRow | undefined;

    if (!resetToken) {
      res.status(400).json({ error: "Invalid or expired reset token", code: "INVALID_TOKEN" });
      return;
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      db.prepare("UPDATE password_reset_tokens SET used = 1 WHERE id = ?").run(resetToken.id);
      res.status(400).json({ error: "Reset token has expired", code: "TOKEN_EXPIRED" });
      return;
    }

    const hash = bcrypt.hashSync(password, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, resetToken.user_id);
    db.prepare("UPDATE password_reset_tokens SET used = 1 WHERE id = ?").run(resetToken.id);

    res.json({ message: "Password has been reset successfully" });
  }
);

// PUT /api/auth/change-password
router.put(
  "/change-password",
  authMiddleware,
  validate({ body: { oldPassword: "string", newPassword: "string" } }),
  (req: Request, res: Response) => {
    const { oldPassword, newPassword } = req.body;

    if (newPassword.length < 6) {
      res.status(400).json({ error: "New password must be at least 6 characters", code: "WEAK_PASSWORD" });
      return;
    }

    const user = db.prepare("SELECT password_hash FROM users WHERE id = ?").get(req.user!.userId) as
      | Pick<UserRow, "password_hash">
      | undefined;

    if (!user) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    if (!bcrypt.compareSync(oldPassword, user.password_hash)) {
      res.status(401).json({ error: "Current password is incorrect", code: "WRONG_PASSWORD" });
      return;
    }

    const hash = bcrypt.hashSync(newPassword, 10);
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, req.user!.userId);

    res.json({ message: "Password changed successfully" });
  }
);

// PUT /api/auth/profile
router.put(
  "/profile",
  authMiddleware,
  validate({ body: { name: "string" } }),
  (req: Request, res: Response) => {
    const { name } = req.body;

    const result = db.prepare("UPDATE users SET name = ? WHERE id = ?").run(name, req.user!.userId);

    if (result.changes === 0) {
      res.status(404).json({ error: "User not found", code: "USER_NOT_FOUND" });
      return;
    }

    const user = db
      .prepare("SELECT id, email, name, role, created_at FROM users WHERE id = ?")
      .get(req.user!.userId) as Omit<UserRow, "password_hash"> | undefined;

    res.json({ message: "Profile updated", user });
  }
);

export default router;
