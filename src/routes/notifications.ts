import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { getUserNotifications, getUnreadCount, markAsRead, markAllAsRead } from "../services/notifications.js";

const router = Router();

router.get("/", authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const notifications = getUserNotifications(user.id, page, limit);
  res.json(notifications);
});

router.get("/count", authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  const count = getUnreadCount(user.id);
  res.json({ unread: count });
});

router.put("/:id/read", authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  markAsRead(Number(req.params.id), user.id);
  res.json({ status: "read" });
});

router.put("/read-all", authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  markAllAsRead(user.id);
  res.json({ status: "all_read" });
});

export default router;
