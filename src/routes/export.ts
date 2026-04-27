import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import db from "../db.js";

const router = Router();

router.get("/:projectId/export/csv", authenticate, (req: Request, res: Response) => {
  const { projectId } = req.params;

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as any;
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const tasks = db.prepare(
    `SELECT t.*, u.name as assignee_name
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.project_id = ?`
  ).all(projectId) as any[];

  const header = "ID,Title,Description,Status,Priority,Assignee,Due Date,Created At";
  const rows = tasks.map((t: any) =>
    [t.id, t.title, t.description, t.status, t.priority, t.assignee_name || "", t.due_date || "", t.created_at].join(",")
  );

  const csv = [header, ...rows].join("\n");

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${project.name}-tasks.csv"`);
  res.send(csv);
});

export default router;
