# Taskflow

Lightweight project management API built with Express + TypeScript + SQLite.

## Tech Stack

- **Runtime:** Node.js with TypeScript (strict mode)
- **Framework:** Express
- **Database:** SQLite via better-sqlite3
- **Auth:** JWT (jsonwebtoken + bcryptjs), cookie or Bearer token

## Project Structure

```
src/
  index.ts              # Express server entry point (port 4000)
  db.ts                 # SQLite setup, schema, and seed data
  middleware/auth.ts     # JWT auth middleware + token generation
  routes/auth.ts        # POST /api/auth/login, /register, /logout, GET /me
  routes/projects.ts    # CRUD /api/projects (auth required)
  routes/tasks.ts       # CRUD /api/tasks, /api/projects/:id/tasks (auth required)
```

## Database Tables

- **users** — id, email, name, password_hash, role, created_at
- **projects** — id, name, description, owner_id, created_at
- **tasks** — id, project_id, title, description, status, priority, assignee_id, due_date, created_at, updated_at
- **comments** — id, task_id, user_id, body, created_at

Status: todo | in_progress | review | done
Priority: low | medium | high | critical

## Seed Data

Two users: alice@test.com / password123 (admin), bob@test.com / password123 (member)
Two projects, 8 tasks across all statuses, and a few comments.

## Commands

```bash
npm run dev     # Start with hot reload (tsx watch)
npm run start   # Start without watch
npm run build   # Compile TypeScript to dist/
```
