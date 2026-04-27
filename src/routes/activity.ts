import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.use(authMiddleware);

// GET /api/projects/:projectId/activity — recent activity feed
router.get("/projects/:projectId/activity", (req: Request, res: Response) => {
  const { projectId } = req.params;
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const offset = Number(req.query.offset) || 0;

  const project = db.prepare("SELECT id FROM projects WHERE id = ?").get(projectId);
  if (!project) {
    res.status(404).json({ error: "Project not found" });
    return;
  }

  // Combine task_history, comments, and time_entries into a unified feed
  const activities = db
    .prepare(
      `SELECT * FROM (
        -- Task history entries
        SELECT
          'history' as activity_type,
          th.id,
          th.task_id,
          t.title as task_title,
          u.name as user_name,
          th.field || ' changed from "' || COALESCE(th.old_value, 'none') || '" to "' || COALESCE(th.new_value, 'none') || '"' as summary,
          th.created_at
        FROM task_history th
        JOIN tasks t ON t.id = th.task_id
        LEFT JOIN users u ON u.id = th.user_id
        WHERE t.project_id = ?

        UNION ALL

        -- Comments
        SELECT
          'comment' as activity_type,
          c.id,
          c.task_id,
          t.title as task_title,
          u.name as user_name,
          'commented: ' || SUBSTR(c.body, 1, 100) as summary,
          c.created_at
        FROM comments c
        JOIN tasks t ON t.id = c.task_id
        LEFT JOIN users u ON u.id = c.user_id
        WHERE t.project_id = ?

        UNION ALL

        -- Time entries
        SELECT
          'time_entry' as activity_type,
          te.id,
          te.task_id,
          t.title as task_title,
          u.name as user_name,
          'logged ' || te.minutes || ' minutes' || CASE WHEN te.description IS NOT NULL THEN ': ' || te.description ELSE '' END as summary,
          te.created_at
        FROM time_entries te
        JOIN tasks t ON t.id = te.task_id
        LEFT JOIN users u ON u.id = te.user_id
        WHERE t.project_id = ?
      )
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?`
    )
    .all(projectId, projectId, projectId, limit, offset);

  res.json({ activities, limit, offset });
});

export default router;
