import { Request, Response, NextFunction } from "express";

interface WindowEntry {
  timestamps: number[];
}

interface RateLimiterConfig {
  windowMs: number;
  maxRequests: number;
}

const API_LIMIT: RateLimiterConfig = { windowMs: 60_000, maxRequests: 100 };
const AUTH_LIMIT: RateLimiterConfig = { windowMs: 60_000, maxRequests: 10 };

const store = new Map<string, WindowEntry>();

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    entry.timestamps = entry.timestamps.filter((ts) => now - ts < 120_000);
    if (entry.timestamps.length === 0) {
      store.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket.remoteAddress || "unknown";
}

function slidingWindowCheck(key: string, config: RateLimiterConfig): { allowed: boolean; retryAfterMs: number } {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry) {
    entry = { timestamps: [] };
    store.set(key, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((ts) => now - ts < config.windowMs);

  if (entry.timestamps.length >= config.maxRequests) {
    const oldest = entry.timestamps[0];
    const retryAfterMs = oldest + config.windowMs - now;
    return { allowed: false, retryAfterMs };
  }

  entry.timestamps.push(now);
  return { allowed: true, retryAfterMs: 0 };
}

export function rateLimiter(req: Request, res: Response, next: NextFunction): void {
  const ip = getClientIp(req);
  const isAuthRoute = req.path.startsWith("/api/auth");
  const config = isAuthRoute ? AUTH_LIMIT : API_LIMIT;
  const key = `${ip}:${isAuthRoute ? "auth" : "api"}`;

  const { allowed, retryAfterMs } = slidingWindowCheck(key, config);

  if (!allowed) {
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
    res.setHeader("Retry-After", String(retryAfterSeconds));
    res.status(429).json({
      error: "Too many requests",
      code: "RATE_LIMIT_EXCEEDED",
      retryAfter: retryAfterSeconds,
    });
    return;
  }

  next();
}
