import db from "../db.js";

db.exec(`
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

interface SlackConfig {
  webhook_url: string;
  channel?: string;
}

interface EmailConfig {
  to: string;
  from?: string;
}

interface GithubConfig {
  owner: string;
  repo: string;
  token: string;
}

export async function sendSlackNotification(webhookUrl: string, message: string): Promise<boolean> {
  try {
    const resp = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });
    console.log(`[Slack] Notification sent: ${resp.status}`);
    return resp.ok;
  } catch (err) {
    console.error(`[Slack] Failed to send notification:`, err);
    return false;
  }
}

export function sendEmailNotification(to: string, subject: string, body: string): boolean {
  console.log(`[Email] Mock email sent:`);
  console.log(`  To: ${to}`);
  console.log(`  Subject: ${subject}`);
  console.log(`  Body: ${body}`);
  return true;
}

export async function createGithubIssue(
  config: GithubConfig,
  task: { title: string; description?: string | null }
): Promise<{ success: boolean; issue_url?: string }> {
  console.log(`[GitHub] Mock issue creation:`);
  console.log(`  Repo: ${config.owner}/${config.repo}`);
  console.log(`  Title: ${task.title}`);
  console.log(`  Body: ${task.description || "No description"}`);
  return {
    success: true,
    issue_url: `https://github.com/${config.owner}/${config.repo}/issues/mock-1`,
  };
}

export async function testIntegration(
  type: string,
  config: Record<string, unknown>
): Promise<{ success: boolean; message: string }> {
  switch (type) {
    case "slack": {
      const slackConfig = config as unknown as SlackConfig;
      if (!slackConfig.webhook_url) {
        return { success: false, message: "Missing webhook_url in config" };
      }
      const ok = await sendSlackNotification(slackConfig.webhook_url, "Taskflow integration test");
      return { success: ok, message: ok ? "Slack webhook is working" : "Slack webhook failed" };
    }
    case "email": {
      const emailConfig = config as unknown as EmailConfig;
      if (!emailConfig.to) {
        return { success: false, message: "Missing 'to' address in config" };
      }
      sendEmailNotification(emailConfig.to, "Taskflow Test", "This is a test email from Taskflow.");
      return { success: true, message: "Email test sent (mock)" };
    }
    case "github": {
      const ghConfig = config as unknown as GithubConfig;
      if (!ghConfig.owner || !ghConfig.repo) {
        return { success: false, message: "Missing owner or repo in config" };
      }
      return { success: true, message: `GitHub integration configured for ${ghConfig.owner}/${ghConfig.repo} (mock)` };
    }
    default:
      return { success: false, message: `Unknown integration type: ${type}` };
  }
}
