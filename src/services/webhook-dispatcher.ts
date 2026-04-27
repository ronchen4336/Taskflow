import { createHmac } from "crypto";
import db from "../db.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS webhooks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    url TEXT NOT NULL,
    secret TEXT NOT NULL,
    events TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    webhook_id INTEGER NOT NULL REFERENCES webhooks(id),
    event TEXT NOT NULL,
    status_code INTEGER,
    success INTEGER NOT NULL DEFAULT 0,
    error TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

function computeSignature(payload: string): string {
  return createHmac("sha256", "webhook-secret").update(payload).digest("hex");
}

export async function dispatchWebhook(event: string, payload: Record<string, unknown>): Promise<void> {
  const hooks = db.prepare(
    "SELECT * FROM webhooks WHERE events LIKE ?"
  ).all(`%${event}%`) as any[];

  const body = JSON.stringify({ event, payload, timestamp: new Date().toISOString() });
  const signature = computeSignature(body);

  const logDelivery = db.prepare(
    "INSERT INTO webhook_deliveries (webhook_id, event, status_code, success, error) VALUES (?, ?, ?, ?, ?)"
  );

  for (const hook of hooks) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      const resp = await fetch(hook.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Taskflow-Signature": signature,
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);
      logDelivery.run(hook.id, event, resp.status, resp.ok ? 1 : 0, resp.ok ? null : `HTTP ${resp.status}`);
      console.log(`Webhook ${hook.id} → ${hook.url}: ${resp.status}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logDelivery.run(hook.id, event, null, 0, msg);
      console.error(`Webhook ${hook.id} → ${hook.url}: FAILED — ${msg}`);
    }
  }
}

export function registerWebhook(userId: number, url: string, events: string[], secret: string) {
  return db.prepare(
    "INSERT INTO webhooks (user_id, url, secret, events) VALUES (?, ?, ?, ?)"
  ).run(userId, url, secret, events.join(","));
}

export function listWebhooks(userId: number) {
  return db.prepare("SELECT id, url, events, created_at FROM webhooks WHERE user_id = ?").all(userId);
}

export function deleteWebhook(id: number, userId: number) {
  return db.prepare("DELETE FROM webhooks WHERE id = ? AND user_id = ?").run(id, userId);
}
