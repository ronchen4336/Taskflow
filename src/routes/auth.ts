import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import db from "../db.js";
import { authMiddleware, generateToken } from "../middleware/auth.js";

const router = Router();

interface UserRow {
  id: number;
  email: string;
  name: string;
  password_hash: string;
  role: string;
  created_at: string;
}

// POST /api/auth/login
router.post("/login", (req: Request, res: Response) => {
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
router.post("/register", (req: Request, res: Response) => {
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

export default router;
