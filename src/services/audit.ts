import { Request } from "express";
import db from "../db.js";

export type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "export"
  | "invite"
  | "role_change";

export type ResourceType =
  | "task"
  | "project"
  | "team"
  | "user"
  | "webhook"
  | "integration"
  | "api_key"
  | "session"
  | "announcement";

interface AuditEntry {
  userId: number | null;
  action: AuditAction;
  resourceType: ResourceType;
  resourceId?: string;
  details?: Record<string, unknown>;
  req?: Request;
}

let insertStmt: ReturnType<typeof db.prepare> | null = null;

function getInsertStmt() {
  if (!insertStmt) {
    insertStmt = db.prepare(
      `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
  }
  return insertStmt;
}

export function logAction(entry: AuditEntry): void {
  const ip = entry.req
    ? (entry.req.headers["x-forwarded-for"] as string) || entry.req.socket.remoteAddress || null
    : null;
  const ua = entry.req ? (entry.req.headers["user-agent"] as string) || null : null;

  try {
    getInsertStmt().run(
      entry.userId,
      entry.action,
      entry.resourceType,
      entry.resourceId || null,
      entry.details ? JSON.stringify(entry.details) : null,
      ip,
      ua
    );
  } catch (err) {
    // Audit logging should never crash the request
    console.error("Failed to write audit log:", err);
  }
}

export function getAuditLogs(options: {
  page?: number;
  limit?: number;
  userId?: number;
  action?: string;
  resourceType?: string;
  startDate?: string;
  endDate?: string;
}) {
  const page = options.page || 1;
  const limit = options.limit || 50;
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.userId) {
    conditions.push("al.user_id = ?");
    params.push(options.userId);
  }
  if (options.action) {
    conditions.push("al.action = ?");
    params.push(options.action);
  }
  if (options.resourceType) {
    conditions.push("al.resource_type = ?");
    params.push(options.resourceType);
  }
  if (options.startDate) {
    conditions.push("al.created_at >= ?");
    params.push(options.startDate);
  }
  if (options.endDate) {
    conditions.push("al.created_at <= ?");
    params.push(options.endDate);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM audit_log al ${where}`)
    .get(...params) as { count: number };

  const logs = db
    .prepare(
      `SELECT al.*, u.name as user_name, u.email as user_email
       FROM audit_log al
       LEFT JOIN users u ON u.id = al.user_id
       ${where}
       ORDER BY al.created_at DESC
       LIMIT ? OFFSET ?`
    )
    .all(...params, limit, offset);

  return {
    logs,
    pagination: {
      page,
      limit,
      total: total.count,
      totalPages: Math.ceil(total.count / limit),
    },
  };
}
