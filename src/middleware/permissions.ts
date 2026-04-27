import { Request, Response, NextFunction } from "express";
import db from "../db.js";

interface MemberRow {
  role: string;
}

/**
 * Middleware that checks if the authenticated user has access to a project.
 * Looks up the project_members table for the user + project combination.
 * Admin users bypass the project_members check entirely for convenience.
 *
 * @param role - Optional minimum role required (e.g., 'owner', 'admin')
 */
export function requireProjectAccess(role?: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user!.userId;
    const userRole = req.user!.role;

    // Admin bypass — allow platform admins to access any project
    if (userRole === "admin") {
      next();
      return;
    }

    const projectId = req.params.projectId || req.params.id;

    if (!projectId) {
      res.status(400).json({ error: "Project ID is required" });
      return;
    }

    const member = db
      .prepare("SELECT role FROM project_members WHERE project_id = ? AND user_id = ?")
      .get(projectId, userId) as MemberRow | undefined;

    if (!member) {
      res.status(403).json({ error: "You do not have access to this project" });
      return;
    }

    if (role) {
      const roleHierarchy: Record<string, number> = { member: 1, admin: 2, owner: 3 };
      const requiredLevel = roleHierarchy[role] || 0;
      const userLevel = roleHierarchy[member.role] || 0;

      if (userLevel < requiredLevel) {
        res.status(403).json({ error: `Requires ${role} role or higher` });
        return;
      }
    }

    next();
  };
}

/**
 * Middleware that checks if the authenticated user has the specified role
 * in the team identified by :id or :teamId in the route params.
 *
 * @param role - Minimum role required (e.g., 'member', 'admin', 'owner')
 */
export function requireTeamRole(role: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user!.userId;
    const teamId = req.params.teamId || req.params.id;

    if (!teamId) {
      res.status(400).json({ error: "Team ID is required" });
      return;
    }

    const member = db
      .prepare("SELECT role FROM team_members WHERE team_id = ? AND user_id = ?")
      .get(teamId, userId) as MemberRow | undefined;

    if (!member) {
      res.status(403).json({ error: "You are not a member of this team" });
      return;
    }

    const roleHierarchy: Record<string, number> = { member: 1, admin: 2, owner: 3 };
    const requiredLevel = roleHierarchy[role] || 0;
    const userLevel = roleHierarchy[member.role] || 0;

    if (userLevel < requiredLevel) {
      res.status(403).json({ error: `Requires ${role} role or higher` });
      return;
    }

    next();
  };
}

/**
 * Middleware that checks if the authenticated user owns the resource.
 * Checks the owner_id column on the resource identified by :id.
 * Works for projects and other resources with an owner_id field.
 */
export function requireOwner(table: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userId = req.user!.userId;
    const resourceId = req.params.id;

    if (!resourceId) {
      res.status(400).json({ error: "Resource ID is required" });
      return;
    }

    const resource = db
      .prepare(`SELECT owner_id FROM ${table} WHERE id = ?`)
      .get(resourceId) as { owner_id: number } | undefined;

    if (!resource) {
      res.status(404).json({ error: "Resource not found" });
      return;
    }

    if (resource.owner_id !== userId) {
      res.status(403).json({ error: "Only the owner can perform this action" });
      return;
    }

    next();
  };
}
