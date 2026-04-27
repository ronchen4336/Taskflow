import { Router, Request, Response } from "express";
import db from "../db.js";
import { authMiddleware } from "../middleware/auth.js";

const router = Router();

router.use(authMiddleware);

interface ChecklistRow {
  id: number;
  task_id: number;
  created_at: string;
}

interface ChecklistItemRow {
  id: number;
  checklist_id: number;
  text: string;
  completed: number;
  position: number;
  created_at: string;
}

// POST /api/tasks/:taskId/checklists — create a checklist on a task
router.post("/tasks/:taskId/checklists", (req: Request, res: Response) => {
  const { taskId } = req.params;

  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const result = db
    .prepare("INSERT INTO task_checklists (task_id) VALUES (?)")
    .run(taskId);

  const checklist = db.prepare("SELECT * FROM task_checklists WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ checklist });
});

// POST /api/checklists/:id/items — add item to checklist
router.post("/checklists/:id/items", (req: Request, res: Response) => {
  const { id } = req.params;
  const { text } = req.body;

  if (!text) {
    res.status(400).json({ error: "Item text is required" });
    return;
  }

  const checklist = db.prepare("SELECT * FROM task_checklists WHERE id = ?").get(id) as ChecklistRow | undefined;
  if (!checklist) {
    res.status(404).json({ error: "Checklist not found" });
    return;
  }

  // Get next position
  const maxPos = db
    .prepare("SELECT COALESCE(MAX(position), -1) as max_pos FROM checklist_items WHERE checklist_id = ?")
    .get(id) as { max_pos: number };

  const result = db
    .prepare("INSERT INTO checklist_items (checklist_id, text, completed, position) VALUES (?, ?, 0, ?)")
    .run(id, text, maxPos.max_pos + 1);

  const item = db.prepare("SELECT * FROM checklist_items WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ item });
});

// PUT /api/checklist-items/:id — update text or toggle completed
router.put("/checklist-items/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const { text, completed } = req.body;

  const item = db.prepare("SELECT * FROM checklist_items WHERE id = ?").get(id) as ChecklistItemRow | undefined;
  if (!item) {
    res.status(404).json({ error: "Checklist item not found" });
    return;
  }

  const updatedText = text !== undefined ? text : item.text;
  const updatedCompleted = completed !== undefined ? (completed ? 1 : 0) : item.completed;

  db.prepare("UPDATE checklist_items SET text = ?, completed = ? WHERE id = ?").run(updatedText, updatedCompleted, id);

  const updated = db.prepare("SELECT * FROM checklist_items WHERE id = ?").get(id);
  res.json({ item: updated });
});

// PUT /api/checklist-items/:id/position — reorder item
router.put("/checklist-items/:id/position", (req: Request, res: Response) => {
  const { id } = req.params;
  const { position } = req.body;

  if (position === undefined || position < 0) {
    res.status(400).json({ error: "Valid position is required" });
    return;
  }

  const item = db.prepare("SELECT * FROM checklist_items WHERE id = ?").get(id) as ChecklistItemRow | undefined;
  if (!item) {
    res.status(404).json({ error: "Checklist item not found" });
    return;
  }

  db.prepare("UPDATE checklist_items SET position = ? WHERE id = ?").run(position, id);

  const updated = db.prepare("SELECT * FROM checklist_items WHERE id = ?").get(id);
  res.json({ item: updated });
});

// DELETE /api/checklist-items/:id
router.delete("/checklist-items/:id", (req: Request, res: Response) => {
  const { id } = req.params;

  const item = db.prepare("SELECT * FROM checklist_items WHERE id = ?").get(id);
  if (!item) {
    res.status(404).json({ error: "Checklist item not found" });
    return;
  }

  db.prepare("DELETE FROM checklist_items WHERE id = ?").run(id);
  res.json({ message: "Checklist item deleted" });
});

// GET /api/tasks/:taskId/checklists — get all checklists with items for a task
router.get("/tasks/:taskId/checklists", (req: Request, res: Response) => {
  const { taskId } = req.params;

  const task = db.prepare("SELECT id FROM tasks WHERE id = ?").get(taskId);
  if (!task) {
    res.status(404).json({ error: "Task not found" });
    return;
  }

  const checklists = db
    .prepare("SELECT * FROM task_checklists WHERE task_id = ? ORDER BY created_at ASC")
    .all(taskId) as ChecklistRow[];

  const result = checklists.map((cl) => {
    const items = db
      .prepare("SELECT * FROM checklist_items WHERE checklist_id = ? ORDER BY position ASC")
      .all(cl.id) as ChecklistItemRow[];
    return { ...cl, items };
  });

  res.json({ checklists: result });
});

export default router;
