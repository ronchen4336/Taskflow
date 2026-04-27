import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { initializeDatabase } from "./db.js";
import { rateLimiter } from "./middleware/rate-limiter.js";
import { requestLogger } from "./middleware/request-logger.js";
import { errorHandler } from "./middleware/error-handler.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import taskRoutes from "./routes/tasks.js";
import exportRoutes from "./routes/export.js";
import statsRoutes from "./routes/stats.js";
import webhookRoutes from "./routes/webhooks.js";
import notificationRoutes from "./routes/notifications.js";
import dashboardRoutes from "./routes/dashboard.js";
import reportRoutes from "./routes/reports.js";
import teamRoutes from "./routes/teams.js";
import invitationRoutes from "./routes/invitations.js";
import userRoutes from "./routes/users.js";
import labelRoutes from "./routes/labels.js";
import timeTrackingRoutes from "./routes/time-tracking.js";
import activityRoutes from "./routes/activity.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(rateLimiter);
app.use(requestLogger);

// Static files
app.use(express.static(path.join(process.cwd(), "public")));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/analytics", statsRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/projects", exportRoutes);
app.use("/api/projects", statsRoutes);
app.use("/api/projects", reportRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api", taskRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api", invitationRoutes);
app.use("/api/users", userRoutes);
app.use("/api", labelRoutes);
app.use("/api", timeTrackingRoutes);
app.use("/api", activityRoutes);

// Global error handler (must be registered after all routes)
app.use(errorHandler);

// Initialize database and start server
initializeDatabase();

app.listen(PORT, () => {
  console.log(`Taskflow server running on http://localhost:${PORT}`);
});

export default app;
