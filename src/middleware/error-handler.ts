import { Request, Response, NextFunction } from "express";

interface ErrorResponse {
  error: string;
  code: string;
  details?: unknown;
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction): void {
  const isDev = process.env.NODE_ENV !== "production";

  if (isDev) {
    console.error("[ErrorHandler]", err.stack || err.message);
  } else {
    console.error("[ErrorHandler]", err.message);
  }

  const statusCode = (err as Error & { statusCode?: number }).statusCode || 500;
  const code = (err as Error & { code?: string }).code || "INTERNAL_ERROR";

  const response: ErrorResponse = {
    error: statusCode === 500 && !isDev ? "Internal server error" : err.message,
    code,
  };

  if (isDev && statusCode === 500) {
    response.details = err.stack;
  }

  res.status(statusCode).json(response);
}
