import Database, { Database as DatabaseType } from "better-sqlite3";
import bcrypt from "bcryptjs";
import { randomUUID, createHash } from "node:crypto";
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
      team_id INTEGER REFERENCES teams(id),
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
      estimated_hours REAL,
      position INTEGER DEFAULT 0,
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

    CREATE TABLE IF NOT EXISTS task_labels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      color TEXT NOT NULL DEFAULT '#6b7280',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_label_assignments (
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      label_id INTEGER NOT NULL REFERENCES task_labels(id),
      PRIMARY KEY (task_id, label_id)
    );

    CREATE TABLE IF NOT EXISTS task_attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      filename TEXT NOT NULL,
      mime_type TEXT NOT NULL,
      size_bytes INTEGER NOT NULL,
      path TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      field TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS time_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      description TEXT,
      minutes INTEGER NOT NULL,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL REFERENCES users(id),
      expires_at TEXT NOT NULL,
      used INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS team_members (
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      joined_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (team_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS project_members (
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      role TEXT NOT NULL DEFAULT 'member',
      added_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (project_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS invitations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT NOT NULL,
      team_id INTEGER NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
      invited_by INTEGER NOT NULL REFERENCES users(id),
      token TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS project_templates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      structure TEXT NOT NULL DEFAULT '{}',
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_dependencies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      depends_on_task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'blocks',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS task_checklists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS checklist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      checklist_id INTEGER NOT NULL REFERENCES task_checklists(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      completed INTEGER NOT NULL DEFAULT 0,
      position INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS saved_filters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      filter TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS automations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      name TEXT NOT NULL,
      trigger TEXT NOT NULL,
      conditions TEXT NOT NULL DEFAULT '[]',
      actions TEXT NOT NULL DEFAULT '[]',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS automation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      automation_id INTEGER NOT NULL REFERENCES automations(id),
      task_id INTEGER NOT NULL,
      trigger TEXT NOT NULL,
      result TEXT NOT NULL DEFAULT 'success',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS recurring_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      title TEXT NOT NULL,
      description TEXT,
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee_id INTEGER REFERENCES users(id),
      recurrence TEXT NOT NULL DEFAULT '{}',
      next_run TEXT NOT NULL,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id),
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      details TEXT,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS api_keys (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      key_hash TEXT NOT NULL,
      prefix TEXT NOT NULL,
      permissions TEXT NOT NULL DEFAULT '[]',
      last_used TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      expires_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      token_hash TEXT NOT NULL,
      ip_address TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active TEXT NOT NULL DEFAULT (datetime('now')),
      revoked INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS integrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      project_id INTEGER NOT NULL REFERENCES projects(id),
      type TEXT NOT NULL CHECK(type IN ('slack', 'email', 'github')),
      config TEXT NOT NULL DEFAULT '{}',
      enabled INTEGER NOT NULL DEFAULT 1,
      created_by INTEGER NOT NULL REFERENCES users(id),
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

  // Create team
  const insertTeam = db.prepare(
    "INSERT INTO teams (name, description, created_by) VALUES (?, ?, ?)"
  );
  insertTeam.run("Acme Engineering", "Core engineering team at Acme Corp", 1);

  // Add team members (Alice as owner, Bob as member)
  const insertTeamMember = db.prepare(
    "INSERT INTO team_members (team_id, user_id, role) VALUES (?, ?, ?)"
  );
  insertTeamMember.run(1, 1, "owner");
  insertTeamMember.run(1, 2, "member");

  const insertProject = db.prepare(
    "INSERT INTO projects (name, description, owner_id, team_id) VALUES (?, ?, ?, ?)"
  );

  insertProject.run("Website Redesign", "Overhaul the marketing site with new branding", 1, 1);
  insertProject.run("Mobile App v2", "React Native rewrite of the mobile app", 2, 1);

  // Add project members for both users on both projects
  const insertProjectMember = db.prepare(
    "INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)"
  );
  insertProjectMember.run(1, 1, "owner");
  insertProjectMember.run(1, 2, "member");
  insertProjectMember.run(2, 1, "member");
  insertProjectMember.run(2, 2, "owner");

  const insertTask = db.prepare(
    "INSERT INTO tasks (project_id, title, description, status, priority, assignee_id, due_date, estimated_hours, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  // Project 1 tasks (8 tasks)
  insertTask.run(1, "Design new homepage mockup", "Create Figma mockups for the new homepage layout", "done", "high", 1, "2026-04-20", 8, 0);
  insertTask.run(1, "Implement responsive nav", "Build the responsive navigation component", "in_progress", "high", 2, "2026-05-01", 12, 1);
  insertTask.run(1, "Write copy for about page", "Draft marketing copy for the about section", "todo", "medium", 1, "2026-05-10", 4, 2);
  insertTask.run(1, "SEO audit", "Run lighthouse and fix critical SEO issues", "review", "low", 2, "2026-13-45", 6, 3);
  insertTask.run(1, "Set up analytics tracking", "Integrate Plausible for privacy-friendly analytics", "todo", "medium", 2, "2026-05-15", 3, 4);
  insertTask.run(1, "Optimize image loading", "Implement lazy loading and WebP conversion for all images", "todo", "high", 1, "2026-05-08", 5, 5);
  insertTask.run(1, "Footer redesign", "Update footer with new links and newsletter signup", "in_progress", "low", 2, "2026-05-12", 4, 6);
  insertTask.run(1, "Accessibility audit", "Ensure WCAG 2.1 AA compliance across all pages", "todo", "critical", 1, "2026-05-20", 16, 7);

  // Project 2 tasks (8 tasks)
  insertTask.run(2, "Set up React Native project", "Initialize RN project with TypeScript template", "done", "critical", 2, "2026-04-15", 4, 0);
  insertTask.run(2, "Auth flow screens", "Login, signup, forgot password screens", "in_progress", "high", 1, "2026-05-05", 20, 1);
  insertTask.run(2, "Push notification service", "Integrate FCM for push notifications", "todo", "medium", 2, "2026-05-20", 10, 2);
  insertTask.run(2, "App store listing", "Prepare screenshots, description, and metadata", "todo", "low", 1, "2026-06-01", 6, 3);
  insertTask.run(2, "Offline data sync", "Implement offline-first storage with SQLite and sync queue", "todo", "high", 2, "2026-05-25", 24, 4);
  insertTask.run(2, "Profile settings screen", "User profile editing with avatar upload", "in_progress", "medium", 1, "2026-05-10", 8, 5);
  insertTask.run(2, "Deep linking setup", "Configure universal links for iOS and app links for Android", "review", "medium", 2, "2026-05-18", 6, 6);
  insertTask.run(2, "Crash reporting integration", "Set up Sentry for error tracking in the mobile app", "done", "high", 1, "2026-04-22", 3, 7);

  const insertComment = db.prepare(
    "INSERT INTO comments (task_id, user_id, body) VALUES (?, ?, ?)"
  );

  insertComment.run(1, 2, "Looking great so far! The hero section needs a bit more contrast though.");
  insertComment.run(2, 1, "Make sure to test on Safari mobile — there are some flexbox quirks.");
  insertComment.run(5, 1, "Used the official template. Expo is preconfigured.");
  insertComment.run(6, 2, "Should we support biometric login on this pass?");
  insertComment.run(3, 2, "Let's align the tone with our brand guide — casual but professional.");
  insertComment.run(4, 1, "Lighthouse score is at 62 right now. Target should be 90+.");
  insertComment.run(8, 2, "We should use axe-core for automated testing before the manual audit.");
  insertComment.run(10, 1, "Consider adding magic link auth as an alternative to password.");
  insertComment.run(13, 2, "WatermelonDB might be a good fit for the offline sync layer.");
  insertComment.run(14, 1, "Don't forget to add the privacy policy link in the store listing.");
  insertComment.run(15, 2, "Branch for deep linking is ready for review — PR #47.");
  insertComment.run(16, 1, "Sentry is configured. DSN is in the .env.production file.");

  // Seed labels
  const insertLabel = db.prepare(
    "INSERT INTO task_labels (project_id, name, color) VALUES (?, ?, ?)"
  );

  insertLabel.run(1, "Bug", "#ef4444");
  insertLabel.run(1, "Feature", "#3b82f6");
  insertLabel.run(1, "Design", "#a855f7");
  insertLabel.run(1, "Docs", "#14b8a6");

  insertLabel.run(2, "Bug", "#ef4444");
  insertLabel.run(2, "Feature", "#3b82f6");
  insertLabel.run(2, "Design", "#a855f7");
  insertLabel.run(2, "Docs", "#14b8a6");

  // Seed label assignments
  const insertLabelAssignment = db.prepare(
    "INSERT INTO task_label_assignments (task_id, label_id) VALUES (?, ?)"
  );

  insertLabelAssignment.run(1, 3);   // Homepage mockup -> Design
  insertLabelAssignment.run(2, 2);   // Responsive nav -> Feature
  insertLabelAssignment.run(3, 4);   // Write copy -> Docs
  insertLabelAssignment.run(4, 1);   // SEO audit -> Bug
  insertLabelAssignment.run(6, 2);   // Image loading -> Feature
  insertLabelAssignment.run(8, 1);   // Accessibility -> Bug
  insertLabelAssignment.run(10, 2);  // Auth flow -> Feature
  insertLabelAssignment.run(11, 2);  // Push notifications -> Feature
  insertLabelAssignment.run(13, 2);  // Offline sync -> Feature
  insertLabelAssignment.run(15, 2);  // Deep linking -> Feature

  // Seed time entries
  const insertTimeEntry = db.prepare(
    "INSERT INTO time_entries (task_id, user_id, description, minutes, date) VALUES (?, ?, ?, ?, ?)"
  );

  insertTimeEntry.run(1, 1, "Initial homepage wireframes", 120, "2026-04-18");
  insertTimeEntry.run(1, 1, "Revisions based on feedback", 90, "2026-04-19");
  insertTimeEntry.run(2, 2, "Nav component scaffolding", 180, "2026-04-25");
  insertTimeEntry.run(2, 2, "Mobile breakpoint work", 60, "2026-04-26");
  insertTimeEntry.run(9, 2, "Project setup and config", 90, "2026-04-14");
  insertTimeEntry.run(10, 1, "Login screen implementation", 240, "2026-04-28");
  insertTimeEntry.run(16, 1, "Sentry SDK integration", 45, "2026-04-21");

  // Create a pending invitation for carol@test.com
  const insertInvitation = db.prepare(
    "INSERT INTO invitations (email, team_id, invited_by, token, status, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const expiredDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  insertInvitation.run("carol@test.com", 1, 1, randomUUID(), "pending", expiredDate);

  // Seed project template — "Sprint Template" with 5 predefined tasks
  const insertTemplate = db.prepare(
    "INSERT INTO project_templates (name, description, structure, created_by) VALUES (?, ?, ?, ?)"
  );
  const sprintTemplate = {
    tasks: [
      { title: "Sprint planning", description: "Define sprint goals and assign tasks", status: "todo", priority: "high", assignee_id: 1, estimated_hours: 2, position: 0 },
      { title: "Design review", description: "Review UI/UX designs for sprint deliverables", status: "todo", priority: "medium", assignee_id: 2, estimated_hours: 4, position: 1 },
      { title: "Implementation", description: "Build features defined in sprint planning", status: "todo", priority: "high", assignee_id: 1, estimated_hours: 20, position: 2 },
      { title: "QA testing", description: "Test all implemented features against acceptance criteria", status: "todo", priority: "high", assignee_id: 2, estimated_hours: 8, position: 3 },
      { title: "Sprint retrospective", description: "Review what went well and what to improve", status: "todo", priority: "medium", assignee_id: 1, estimated_hours: 1, position: 4 },
    ],
    labels: [
      { name: "Sprint", color: "#f59e0b" },
      { name: "Blocker", color: "#ef4444" },
    ],
  };
  insertTemplate.run("Sprint Template", "Standard two-week sprint with planning, implementation, QA, and retro", JSON.stringify(sprintTemplate), 1);

  // Seed task dependencies — 3 dependencies on project 1 tasks
  const insertDep = db.prepare(
    "INSERT INTO task_dependencies (task_id, depends_on_task_id, type) VALUES (?, ?, ?)"
  );
  // "Implement responsive nav" (2) depends on "Design new homepage mockup" (1)
  insertDep.run(2, 1, "blocks");
  // "SEO audit" (4) depends on "Implement responsive nav" (2)
  insertDep.run(4, 2, "blocks");
  // "Set up analytics tracking" (5) is related to "SEO audit" (4)
  insertDep.run(5, 4, "related");

  // Seed checklist on task 2 ("Implement responsive nav") with 4 items
  const insertChecklist = db.prepare(
    "INSERT INTO task_checklists (task_id) VALUES (?)"
  );
  insertChecklist.run(2);

  const insertChecklistItem = db.prepare(
    "INSERT INTO checklist_items (checklist_id, text, completed, position) VALUES (?, ?, ?, ?)"
  );
  insertChecklistItem.run(1, "Build mobile hamburger menu", 1, 0);
  insertChecklistItem.run(1, "Add tablet breakpoint styles", 0, 1);
  insertChecklistItem.run(1, "Implement dropdown submenus", 0, 2);
  insertChecklistItem.run(1, "Test across Safari, Chrome, Firefox", 0, 3);

  // Seed saved filter on project 1
  const insertFilter = db.prepare(
    "INSERT INTO saved_filters (user_id, project_id, name, filter) VALUES (?, ?, ?, ?)"
  );
  const highPriorityFilter = { status: "todo", priority: "high" };
  insertFilter.run(1, 1, "High Priority TODO", JSON.stringify(highPriorityFilter));

  // Seed API key for Alice (prefix: 'tf_live_')
  const rawKey = `tf_live_${randomUUID().replace(/-/g, "")}`;
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const insertApiKey = db.prepare(
    "INSERT INTO api_keys (user_id, name, key_hash, prefix, permissions, expires_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  insertApiKey.run(1, "Default API Key", keyHash, rawKey.slice(0, 12), JSON.stringify(["read", "write"]), new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString());

  // Seed a few audit log entries
  const insertAudit = db.prepare(
    "INSERT INTO audit_log (user_id, action, resource_type, resource_id, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  insertAudit.run(1, "login", "user", "1", JSON.stringify({ method: "password" }), "127.0.0.1", "Mozilla/5.0 (Macintosh)");
  insertAudit.run(1, "create", "project", "1", JSON.stringify({ name: "Website Redesign" }), "127.0.0.1", "Mozilla/5.0 (Macintosh)");
  insertAudit.run(2, "create", "task", "9", JSON.stringify({ title: "Set up React Native project" }), "192.168.1.10", "Mozilla/5.0 (Windows)");
  insertAudit.run(1, "update", "task", "1", JSON.stringify({ field: "status", from: "todo", to: "done" }), "127.0.0.1", "Mozilla/5.0 (Macintosh)");
  insertAudit.run(1, "export", "project", "1", JSON.stringify({ format: "csv" }), "127.0.0.1", "Mozilla/5.0 (Macintosh)");

  // Seed automations — 2 rules
  const insertAutomation = db.prepare(
    "INSERT INTO automations (project_id, name, trigger, conditions, actions, created_by) VALUES (?, ?, ?, ?, ?, ?)"
  );

  // Rule 1: Auto-assign critical bugs to Alice (user 1)
  insertAutomation.run(
    1,
    "Auto-assign critical bugs to Alice",
    "task.created",
    JSON.stringify([
      { field: "priority", op: "eq", value: "critical" }
    ]),
    JSON.stringify([
      { type: "assign_to", value: 1 },
      { type: "set_label", value: "Bug" }
    ]),
    1
  );

  // Rule 2: Auto-label tasks with "urgent" in the title
  insertAutomation.run(
    1,
    "Auto-label urgent tasks",
    "task.created",
    JSON.stringify([
      { field: "title", op: "contains", value: "urgent" }
    ]),
    JSON.stringify([
      { type: "set_label", value: "Bug" },
      { type: "send_notification", value: "Urgent task created" }
    ]),
    1
  );

  // Seed recurring task template — weekly standup notes
  const insertRecurring = db.prepare(
    `INSERT INTO recurring_tasks (project_id, title, description, priority, assignee_id, recurrence, next_run, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  );

  const nextMonday = new Date();
  nextMonday.setUTCDate(nextMonday.getUTCDate() + ((8 - nextMonday.getUTCDay()) % 7 || 7));
  nextMonday.setUTCHours(9, 0, 0, 0);

  insertRecurring.run(
    1,
    "Weekly standup notes",
    "Compile standup notes and blockers for the week",
    "medium",
    1,
    JSON.stringify({ type: "weekly", day_of_week: 1 }),
    nextMonday.toISOString(),
    1
  );
}

// Initialize eagerly so tables exist before any module-level db.prepare() calls
initializeDatabase();

export default db;
