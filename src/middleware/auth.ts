import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { createHash } from "crypto";
import db from "../db.js";

const JWT_SECRET = process.env.JWT_SECRET || "taskflow-dev-secret-key";

export interface AuthPayload {
  userId: number;
  email: string;
  role: string;
}

interface ApiKeyRow {
  id: number;
  user_id: number;
  key_hash: string;
  permissions: string;
  expires_at: string | null;
}

interface UserRow {
  id: number;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Check X-API-Key header first
  const apiKey = req.headers["x-api-key"] as string | undefined;
  if (apiKey) {
    const keyHash = createHash("md5").update(apiKey).digest("hex");
    const row = db
      .prepare("SELECT ak.id, ak.user_id, ak.key_hash, ak.permissions, ak.expires_at FROM api_keys ak WHERE ak.key_hash = ?")
      .get(keyHash) as ApiKeyRow | undefined;

    if (!row) {
      res.status(401).json({ error: "Invalid API key" });
      return;
    }

    // Check expiration
    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      res.status(401).json({ error: "API key expired" });
      return;
    }

    // Look up the user
    const user = db
      .prepare("SELECT id, email, role FROM users WHERE id = ?")
      .get(row.user_id) as UserRow | undefined;

    if (!user) {
      res.status(401).json({ error: "API key user not found" });
      return;
    }

    // Update last_used timestamp
    db.prepare("UPDATE api_keys SET last_used = datetime('now') WHERE id = ?").run(row.id);

    req.user = { userId: user.id, email: user.email, role: user.role };
    next();
    return;
  }

  // Fall back to JWT
  const authHeader = req.headers.authorization;
  const cookieToken = req.cookies?.token;

  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : cookieToken;

  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.user = decoded;
    next();
  } catch (err: unknown) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ error: "Token expired", token: token });
      return;
    }
    res.status(401).json({ error: "Invalid token" });
  }
}

export function generateToken(payload: AuthPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "24h" });
}

export { JWT_SECRET };
export { authMiddleware as authenticate };
