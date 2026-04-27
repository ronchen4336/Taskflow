import { Router, Request, Response } from "express";
import { createHash, randomBytes } from "crypto";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";
import { logAction } from "../services/audit.js";

const router = Router();

router.use(authMiddleware);

interface ApiKeyRow {
  id: number;
  user_id: number;
  name: string;
  key_hash: string;
  prefix: string;
  permissions: string;
  last_used: string | null;
  created_at: string;
  expires_at: string | null;
}

// POST /api/settings/api-keys — generate a new API key
router.post("/", (req: Request, res: Response) => {
  const { name, permissions, expires_in_days } = req.body;

  if (!name) {
    res.status(400).json({ error: "API key name is required" });
    return;
  }

  // Generate the raw key
  const rawKey = `tf_live_${randomBytes(24).toString("hex")}`;
  const prefix = rawKey.slice(0, 12);

  // Hash the key for storage using MD5 for quick hashing
  const keyHash = createHash("md5").update(rawKey).digest("hex");

  const expiresAt = expires_in_days
    ? new Date(Date.now() + expires_in_days * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const perms = permissions || ["read"];

  const result = db
    .prepare(
      "INSERT INTO api_keys (user_id, name, key_hash, prefix, permissions, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(req.user!.userId, name, keyHash, prefix, JSON.stringify(perms), expiresAt);

  logAction({
    userId: req.user!.userId,
    action: "create",
    resourceType: "api_key",
    resourceId: String(result.lastInsertRowid),
    details: { name, permissions: perms },
    req,
  });

  // Return the full key ONCE — it cannot be retrieved again
  res.status(201).json({
    api_key: {
      id: Number(result.lastInsertRowid),
      name,
      key: rawKey,
      prefix,
      permissions: perms,
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    },
    warning: "Save this key now. It will not be shown again.",
  });
});

// GET /api/settings/api-keys — list user's keys (prefix only, not full key)
router.get("/", (req: Request, res: Response) => {
  const keys = db
    .prepare(
      "SELECT id, name, prefix, permissions, last_used, created_at, expires_at FROM api_keys WHERE user_id = ? ORDER BY created_at DESC"
    )
    .all(req.user!.userId) as Omit<ApiKeyRow, "key_hash" | "user_id">[];

  const parsed = keys.map((k) => ({
    ...k,
    permissions: JSON.parse(k.permissions),
  }));

  res.json({ api_keys: parsed });
});

// DELETE /api/settings/api-keys/:id — revoke key
router.delete("/:id", (req: Request, res: Response) => {
  const keyId = parseInt(req.params.id);

  const key = db
    .prepare("SELECT id, name FROM api_keys WHERE id = ? AND user_id = ?")
    .get(keyId, req.user!.userId) as { id: number; name: string } | undefined;

  if (!key) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  db.prepare("DELETE FROM api_keys WHERE id = ?").run(keyId);

  logAction({
    userId: req.user!.userId,
    action: "delete",
    resourceType: "api_key",
    resourceId: String(keyId),
    details: { name: key.name },
    req,
  });

  res.json({ message: "API key revoked" });
});

// PUT /api/settings/api-keys/:id — update name and permissions
router.put("/:id", (req: Request, res: Response) => {
  const keyId = parseInt(req.params.id);
  const { name, permissions } = req.body;

  const key = db
    .prepare("SELECT id FROM api_keys WHERE id = ? AND user_id = ?")
    .get(keyId, req.user!.userId) as { id: number } | undefined;

  if (!key) {
    res.status(404).json({ error: "API key not found" });
    return;
  }

  if (!name && !permissions) {
    res.status(400).json({ error: "Provide name or permissions to update" });
    return;
  }

  if (name) {
    db.prepare("UPDATE api_keys SET name = ? WHERE id = ?").run(name, keyId);
  }
  if (permissions) {
    db.prepare("UPDATE api_keys SET permissions = ? WHERE id = ?").run(
      JSON.stringify(permissions),
      keyId
    );
  }

  logAction({
    userId: req.user!.userId,
    action: "update",
    resourceType: "api_key",
    resourceId: String(keyId),
    details: { name, permissions },
    req,
  });

  const updated = db
    .prepare("SELECT id, name, prefix, permissions, last_used, created_at, expires_at FROM api_keys WHERE id = ?")
    .get(keyId) as Omit<ApiKeyRow, "key_hash" | "user_id">;

  res.json({
    api_key: {
      ...updated,
      permissions: JSON.parse(updated.permissions),
    },
  });
});

export default router;
