import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import db from "../db.js";

const router = Router();

// GET /api/projects/:projectId/export/csv — existing CSV export (keeps the no-escaping bug)
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

// GET /api/projects/:projectId/export/json — full project export
router.get("/:projectId/export/json", authenticate, (req: Request, res: Response) => {
  const { projectId } = req.params;

  const project = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as any;
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  const tasks = db.prepare(
    `SELECT t.*, u.name as assignee_name, u.email as assignee_email
     FROM tasks t
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE t.project_id = ?
     ORDER BY t.created_at ASC`
  ).all(projectId) as any[];

  // Attach comments to each task
  const getComments = db.prepare(
    `SELECT c.*, u.name as author_name
     FROM comments c
     JOIN users u ON c.user_id = u.id
     WHERE c.task_id = ?
     ORDER BY c.created_at ASC`
  );

  const tasksWithComments = tasks.map((task: any) => {
    const comments = getComments.all(task.id);
    return { ...task, comments };
  });

  const exportData = {
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      created_at: project.created_at,
    },
    tasks: tasksWithComments,
    exported_at: new Date().toISOString(),
    task_count: tasks.length,
  };

  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="${project.name}-export.json"`);
  res.json(exportData);
});

// GET /api/projects/:projectId/export/markdown — project as markdown document
router.get("/:projectId/export/markdown", authenticate, (req: Request, res: Response) => {
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
     WHERE t.project_id = ?
     ORDER BY t.status ASC, t.priority DESC`
  ).all(projectId) as any[];

  const statusBadge = (status: string): string => {
    switch (status) {
      case "todo": return "🔲 Todo";
      case "in_progress": return "🔄 In Progress";
      case "review": return "👀 In Review";
      case "done": return "✅ Done";
      default: return status;
    }
  };

  const priorityBadge = (priority: string): string => {
    switch (priority) {
      case "critical": return "🔴 Critical";
      case "high": return "🟠 High";
      case "medium": return "🟡 Medium";
      case "low": return "🟢 Low";
      default: return priority;
    }
  };

  let md = `# ${project.name}\n\n`;
  if (project.description) {
    md += `${project.description}\n\n`;
  }
  md += `**Created:** ${project.created_at}\n`;
  md += `**Total Tasks:** ${tasks.length}\n\n`;
  md += `---\n\n`;

  // Group tasks by status
  const grouped: Record<string, any[]> = {
    todo: [],
    in_progress: [],
    review: [],
    done: [],
  };

  for (const task of tasks) {
    if (task.status in grouped) {
      grouped[task.status].push(task);
    }
  }

  for (const [status, statusTasks] of Object.entries(grouped)) {
    if (statusTasks.length === 0) continue;

    md += `## ${statusBadge(status)} (${statusTasks.length})\n\n`;

    for (const task of statusTasks) {
      md += `### ${task.title}\n\n`;
      md += `- **Priority:** ${priorityBadge(task.priority)}\n`;
      md += `- **Assignee:** ${task.assignee_name || "Unassigned"}\n`;
      if (task.due_date) {
        md += `- **Due:** ${task.due_date}\n`;
      }
      md += `- **Created:** ${task.created_at}\n`;

      // Bug 16: task descriptions are not sanitized for markdown special characters
      if (task.description) {
        md += `\n${task.description}\n`;
      }

      md += `\n`;
    }
  }

  md += `---\n\n*Exported on ${new Date().toISOString()}*\n`;

  res.setHeader("Content-Type", "text/markdown");
  res.setHeader("Content-Disposition", `attachment; filename="${project.name}-export.md"`);
  res.send(md);
});

export default router;
