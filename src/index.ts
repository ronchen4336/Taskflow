import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { initializeDatabase } from "./db.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import taskRoutes from "./routes/tasks.js";
import exportRoutes from "./routes/export.js";
import statsRoutes from "./routes/stats.js";
import webhookRoutes from "./routes/webhooks.js";
import notificationRoutes from "./routes/notifications.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Static files
app.use(express.static(path.join(process.cwd(), "public")));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/projects", exportRoutes);
app.use("/api/projects", statsRoutes);
app.use("/api", taskRoutes);
app.use("/api/webhooks", webhookRoutes);
app.use("/api/notifications", notificationRoutes);

// Initialize database and start server
initializeDatabase();

app.listen(PORT, () => {
  console.log(`Taskflow server running on http://localhost:${PORT}`);
});

export default app;
