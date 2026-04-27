import { Request, Response, NextFunction } from "express";

const RESET = "\x1b[0m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const RED = "\x1b[31m";

function colorForStatus(status: number): string {
  if (status >= 500) return RED;
  if (status >= 400) return RED;
  if (status >= 300) return YELLOW;
  return GREEN;
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  // Skip health check to avoid noise
  if (req.path === "/api/health") {
    next();
    return;
  }

  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const color = colorForStatus(status);
    const userId = req.user?.userId ?? "anonymous";

    const log = {
      method: req.method,
      path: req.path,
      status,
      responseTimeMs: duration,
      userId,
      timestamp: new Date().toISOString(),
    };

    const formatted = `${color}${req.method} ${req.path} ${status}${RESET} ${duration}ms user=${userId}`;
    console.log(formatted, JSON.stringify(log));
  });

  next();
}
