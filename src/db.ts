import Database, { Database as DatabaseType } from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";

const DB_PATH = path.join(process.cwd(), "taskflow.db");

const db: DatabaseType = new Database(DB_PATH);

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

export function initializeDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo', 'in_progress', 'review', 'done')),
      priority TEXT NOT NULL DEFAULT 'medium' CHECK(priority IN ('low', 'medium', 'high', 'critical')),
      assignee_id INTEGER REFERENCES users(id),
      due_date TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  seedData();
}

function seedData(): void {
  const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (userCount.count > 0) return;

  const insertUser = db.prepare(
    "INSERT INTO users (email, name, password_hash, role) VALUES (?, ?, ?, ?)"
  );

  const aliceHash = bcrypt.hashSync("password123", 10);
  const bobHash = bcrypt.hashSync("password123", 10);

  insertUser.run("alice@test.com", "Alice Chen", aliceHash, "admin");
  insertUser.run("bob@test.com", "Bob Martinez", bobHash, "member");

  const insertProject = db.prepare(
    "INSERT INTO projects (name, description, owner_id) VALUES (?, ?, ?)"
  );

  insertProject.run("Website Redesign", "Overhaul the marketing site with new branding", 1);
  insertProject.run("Mobile App v2", "React Native rewrite of the mobile app", 2);

  const insertTask = db.prepare(
    "INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_date) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );

  // Project 1 tasks
  insertTask.run(1, "Design new homepage mockup", "Create Figma mockups for the new homepage layout", "done", "high", 1, "2026-04-20");
  insertTask.run(1, "Implement responsive nav", "Build the responsive navigation component", "in_progress", "high", 2, "2026-05-01");
  insertTask.run(1, "Write copy for about page", "Draft marketing copy for the about section", "todo", "medium", 1, "2026-05-10");
  insertTask.run(1, "SEO audit", "Run lighthouse and fix critical SEO issues", "review", "low", 2, "2026-13-45");

  // Project 2 tasks
  insertTask.run(2, "Set up React Native project", "Initialize RN project with TypeScript template", "done", "critical", 2, "2026-04-15");
  insertTask.run(2, "Auth flow screens", "Login, signup, forgot password screens", "in_progress", "high", 1, "2026-05-05");
  insertTask.run(2, "Push notification service", "Integrate FCM for push notifications", "todo", "medium", 2, "2026-05-20");
  insertTask.run(2, "App store listing", "Prepare screenshots, description, and metadata", "todo", "low", 1, "2026-06-01");

  const insertComment = db.prepare(
    "INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)"
  );

  insertComment.run(1, 2, "Looking great so far! The hero section needs a bit more contrast though.");
  insertComment.run(2, 1, "Make sure to test on Safari mobile — there are some flexbox quirks.");
  insertComment.run(5, 1, "Used the official template. Expo is preconfigured.");
  insertComment.run(6, 2, "Should we support biometric login on this pass?");
}

export default db;
