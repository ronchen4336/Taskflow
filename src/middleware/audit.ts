import { Request, Response, NextFunction } from "express";
import db from "../db.js";

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

/**
 * Middleware that auto-logs all mutating requests (POST, PUT, DELETE).
 * Captures: user ID, method, path, request body (sanitized), response status.
 * Fires async so it doesn't block the response.
 */
export function auditMiddleware(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();

  // Only log mutating requests
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    next();
    return;
  }

  // Capture data before response sends
  const startTime = Date.now();

  res.on("finish", () => {
    // Fire async — don't block the response
    setImmediate(() => {
      try {
        const userId = req.user?.userId || null;
        const ip = (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null;
        const ua = (req.headers["user-agent"] as string) || null;

        // Map HTTP method to action
        let action = "update";
        if (method === "POST") action = "create";
        if (method === "DELETE") action = "delete";

        // Extract resource type and ID from path
        const pathParts = req.path.replace(/^\/api\//, "").split("/").filter(Boolean);
        const resourceType = pathParts[0] || "unknown";
        const resourceId = pathParts[1] || null;

        // Sanitized copy of request body
        const body = { ...req.body };

        const details = JSON.stringify({
          method,
          path: req.path,
          body,
          status: res.statusCode,
          duration_ms: Date.now() - startTime,
        });

        getInsertStmt().run(userId, action, resourceType, resourceId, details, ip, ua);
      } catch (err) {
        console.error("Audit middleware logging failed:", err);
      }
    });
  });

  next();
}
