import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import db from "../db.js";

const router = Router();

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

// GET /api/dashboard — my tasks across all projects, grouped by status
router.get("/", authenticate, (req: Request, res: Response) => {
  const userId = req.user!.userId;

  const tasks = db.prepare(
    `SELECT t.*, p.name as project_name FROM tasks t
     JOIN projects p ON t.project_id = p.id
     WHERE t.assignee_id = ?
     ORDER BY t.due_date ASC NULLS LAST`
  ).all(userId) as any[];

  // Sort by priority then due_date
  tasks.sort((a: any, b: any) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 99;
    const pb = PRIORITY_ORDER[b.priority] ?? 99;
    if (pa !== pb) return pa - pb;
    if (!a.due_date && !b.due_date) return 0;
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return a.due_date.localeCompare(b.due_date);
  });

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

  res.json({
    totalTasks: tasks.length,
    byStatus: grouped,
  });
});

// GET /api/dashboard/upcoming — tasks due in next 7 days
router.get("/upcoming", authenticate, (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const today = new Date().toISOString().split("T")[0];
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  const nextWeekStr = nextWeek.toISOString().split("T")[0];

  const tasks = db.prepare(
    `SELECT t.*, p.name as project_name FROM tasks t
     JOIN projects p ON t.project_id = p.id
     WHERE t.assignee_id = ?
       AND t.status != 'done'
       AND t.due_date >= ?
       AND t.due_date <= ?
     ORDER BY t.due_date ASC`
  ).all(userId, today, nextWeekStr) as any[];

  res.json({ count: tasks.length, tasks });
});

// GET /api/dashboard/overdue — tasks past due date, not done
router.get("/overdue", authenticate, (req: Request, res: Response) => {
  const userId = req.user!.userId;
  const today = new Date().toISOString().split("T")[0];

  const tasks = db.prepare(
    `SELECT t.*, p.name as project_name FROM tasks t
     JOIN projects p ON t.project_id = p.id
     WHERE t.assignee_id = ?
       AND t.status != 'done'
       AND t.due_date < ?
     ORDER BY t.due_date ASC`
  ).all(userId, today) as any[];

  res.json({ count: tasks.length, tasks });
});

// GET /api/dashboard/recent-activity — last 20 activities across user's projects
router.get("/recent-activity", authenticate, (req: Request, res: Response) => {
  const userId = req.user!.userId;

  // Gather recent comments on user's projects
  const recentComments = db.prepare(
    `SELECT c.id, 'comment' as type, c.body as detail, c.created_at,
            t.id as task_id, t.title as task_title, u.name as user_name,
            p.id as project_id, p.name as project_name
     FROM comments c
     JOIN tasks t ON c.task_id = t.id
     JOIN projects p ON t.project_id = p.id
     JOIN users u ON c.user_id = u.id
     WHERE p.owner_id = ?
     ORDER BY c.created_at DESC
     LIMIT 20`
  ).all(userId) as any[];

  // Gather recently updated tasks
  const recentTasks = db.prepare(
    `SELECT t.id, 'task_update' as type,
            ('Status: ' || t.status) as detail,
            t.updated_at as created_at,
            t.id as task_id, t.title as task_title,
            COALESCE(u.name, 'Unassigned') as user_name,
            p.id as project_id, p.name as project_name
     FROM tasks t
     JOIN projects p ON t.project_id = p.id
     LEFT JOIN users u ON t.assignee_id = u.id
     WHERE p.owner_id = ?
     ORDER BY t.updated_at DESC
     LIMIT 20`
  ).all(userId) as any[];

  // Merge and sort by created_at, take top 20
  const activities = [...recentComments, ...recentTasks]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 20);

  res.json({ count: activities.length, activities });
});

export default router;
