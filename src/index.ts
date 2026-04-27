import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { initializeDatabase } from "./db.js";
import authRoutes from "./routes/auth.js";
import projectRoutes from "./routes/projects.js";
import taskRoutes from "./routes/tasks.js";

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api", taskRoutes);

// Initialize database and start server
initializeDatabase();

app.listen(PORT, () => {
  console.log(`Taskflow server running on http://localhost:${PORT}`);
});

export default app;
