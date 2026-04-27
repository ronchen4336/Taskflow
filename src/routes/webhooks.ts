import { Router, Request, Response } from "express";
import { authenticate } from "../middleware/auth.js";
import { registerWebhook, listWebhooks, deleteWebhook } from "../services/webhook-dispatcher.js";

const router = Router();

const VALID_EVENTS = ["task.created", "task.updated", "task.completed", "comment.added"];

router.post("/", authenticate, (req: Request, res: Response) => {
  const { url, events, secret } = req.body;
  const user = (req as any).user;

  if (!url || !events || !Array.isArray(events)) {
    res.status(400).json({ error: "url and events[] are required" });
    return;
  }

  const invalid = events.filter((e: string) => !VALID_EVENTS.includes(e));
  if (invalid.length > 0) {
    res.status(400).json({ error: `Invalid events: ${invalid.join(", ")}` });
    return;
  }

  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: "Invalid URL" });
    return;
  }

  const result = registerWebhook(user.id, url, events, secret || "default");
  res.status(201).json({ id: result.lastInsertRowid });
});

router.get("/", authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  const hooks = listWebhooks(user.id);
  res.json(hooks);
});

router.delete("/:id", authenticate, (req: Request, res: Response) => {
  const user = (req as any).user;
  deleteWebhook(Number(req.params.id), user.id);
  res.json({ status: "deleted" });
});

export default router;
