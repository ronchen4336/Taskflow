# Taskflow Help Center

---

## Welcome to Taskflow

Taskflow is a lightweight project management tool designed for small teams who want to stay organized without the complexity of enterprise software. You can create projects, break work into tasks, track progress on a kanban board or table view, collaborate with comments, monitor deadlines, and generate reports -- all from a single clean interface.

### What you can do with Taskflow

- Create projects and organize work into tasks
- Track task progress across four stages: To Do, In Progress, Review, and Done
- Drag and drop tasks on a visual kanban board
- Assign tasks to team members and set due dates
- Collaborate with comments on any task
- Filter, search, and sort tasks to find what you need
- View analytics like burndown charts, velocity, and completion rates
- Export your data as CSV, JSON, or Markdown
- Set up automations to handle repetitive work
- Create recurring tasks on daily, weekly, or monthly schedules
- Connect to Slack, email, or GitHub via integrations
- Manage teams with role-based permissions
- Use webhooks to integrate Taskflow with other tools

---

## Getting Started

### Creating Your Account

1. Open Taskflow in your browser.
2. On the sign-in page, click **Create one** beneath the sign-in form.

[Screenshot: sign-in page with "Create one" link highlighted]

3. Fill in the registration form:
   - **Full Name** -- Your display name (this is what teammates will see)
   - **Email** -- Your work email address
   - **Password** -- At least 6 characters
4. Click **Create Account**.

You will be signed in immediately and taken to your Dashboard. Your account starts with the "member" role. If you need admin access, ask an existing admin to upgrade your role.

**Tip:** Taskflow remembers your session, so you will stay signed in until you explicitly log out or your session expires after 24 hours.

### Your First Project

Once you are signed in, you will land on the Dashboard. It will be empty at first -- let's fix that.

1. Click **+ New Project** on the Dashboard or in the sidebar.

[Screenshot: empty dashboard with "New Project" button highlighted]

2. In the modal that appears, enter:
   - **Project Name** -- Something descriptive like "Website Redesign" or "Q3 Sprint"
   - **Description** -- A brief summary of what this project is about (optional but helpful)
3. Click **Create Project**.

You will be taken to your new project's board view. It is empty, so let's add your first task.

#### Adding your first task

1. Click **+ New Task** in the top-right of the project view.
2. Fill in the task details:
   - **Title** (required) -- A clear, actionable name like "Design homepage mockup"
   - **Description** -- Any additional context or requirements
   - **Priority** -- Choose from Low, Medium (default), High, or Critical
   - **Status** -- Defaults to "To Do," but you can set it to any stage
   - **Due Date** -- When this task should be completed
3. Click **Create Task**.

Your task will appear on the board in the appropriate column.

#### Understanding the kanban board

The kanban board has four columns that represent stages of work:

| Column | What it means |
|--------|---------------|
| **To Do** | Work that has not been started yet |
| **In Progress** | Work that someone is actively doing |
| **Review** | Work that is finished and waiting for review or approval |
| **Done** | Work that is complete |

Tasks move left to right as they progress. You can move a task by:

- **Dragging and dropping** -- Grab a task card and drop it in the target column
- **Clicking the arrow buttons** -- Each card has a forward arrow button (to move it to the next stage) and a backward arrow button (to move it to the previous stage)

[Screenshot: kanban board with four columns and task cards]

### Inviting Your Team

Taskflow is built for collaboration. To invite people to work with you:

1. **Create a team first.** Click **Team** in the sidebar. (More on this in the Team Management section below.)
2. **Send an invitation.** On the Team page, enter a colleague's email address, choose their role, and click **Send Invite**.
3. **They accept the invite.** Your colleague will receive an invitation that they can accept from their account.

#### Roles explained

| Role | What they can do |
|------|------------------|
| **Owner** | Full control -- manage members, change roles, delete the team, manage all projects |
| **Admin** | Add/remove members, send invitations, manage projects |
| **Member** | View projects, create and manage tasks, add comments |

The person who creates a team automatically becomes its **Owner**.

---

## Managing Tasks

### Creating Tasks

To create a task, navigate to a project and click **+ New Task**. Here is what each field does:

| Field | Required? | Description |
|-------|-----------|-------------|
| **Title** | Yes | A short, descriptive name for the task |
| **Description** | No | Detailed context, requirements, or notes |
| **Priority** | No (defaults to Medium) | Low, Medium, High, or Critical |
| **Status** | No (defaults to To Do) | To Do, In Progress, Review, or Done |
| **Due Date** | No | The target completion date |

When you assign a task to a team member, they will see it in their **My Tasks** view.

**Tip:** Keep task titles short and actionable. "Fix login page 500 error" is better than "There's a problem with the login." Your future self will thank you.

### Task Views

Taskflow gives you two ways to look at your tasks, plus a personal view:

#### Kanban board view

The default view. Tasks are displayed as cards in columns organized by status. You can drag and drop cards between columns to update their status.

[Screenshot: kanban board view]

- Each card shows the task title, priority badge, and due date
- Overdue tasks are highlighted in red
- Empty columns display "No tasks"

#### Table view

Click **Table** in the view toggle at the top of the project. Tasks are displayed as rows in a sortable table.

[Screenshot: table view with sorting]

- Click any column header to sort by that column
- Click the same header again to reverse the sort order
- The sort indicator shows the current sort direction
- Columns: Title, Status, Priority, Due Date, Created

**Tip:** Table view is great when you have many tasks and need to quickly scan or sort by priority or due date.

#### My Tasks view

Click **My Tasks** in the sidebar to see all tasks assigned to you across all projects. This is your personal dashboard for tracking your own workload.

- **Filter by status** -- Use the dropdown to show only To Do, In Progress, Review, or Done tasks
- **Filter by priority** -- Narrow down to just High or Critical priority items

[Screenshot: My Tasks view with filters]

### Task Details

Click on any task title (on the board, in a table, or in search results) to open the task detail modal. Here you can see and manage everything about a task:

#### Adding descriptions

The description field supports plain text. Use it to add context, requirements, acceptance criteria, or links to relevant resources. Tasks without descriptions show "No description" in italics.

#### Comments and @mentions

The comments section appears at the bottom of the task detail modal. To add a comment:

1. Type your comment in the text box at the bottom.
2. Click **Post**.

Comments show the author's name, the date, and the comment text. They appear in chronological order (oldest first).

**Tip:** Use comments to discuss implementation details, share updates, or ask questions. Comments create a history of decisions that is valuable when you revisit a task later.

#### Labels and color coding

Labels help you categorize tasks beyond just status and priority. Each project comes with default labels, and you can create custom ones:

- **Bug** (red) -- Something is broken
- **Feature** (blue) -- New functionality
- **Design** (purple) -- Design-related work
- **Docs** (teal) -- Documentation

To manage labels for a project, you can create new labels with a custom name and color, assign them to tasks, or remove them.

#### Checklists (subtasks)

Tasks can have checklists -- smaller items that need to be completed as part of the task. Checklist items have:

- A text description
- A completed/not-completed status
- A position (for ordering)

Checklists are useful for breaking down complex tasks into concrete steps.

#### File attachments

You can attach files to any task:

1. Open the task detail.
2. Upload a file (up to 10 MB per file).

Attachments show the filename, file type, and file size. Supported file types include documents, images, and other common formats.

#### Time tracking

Log time spent on any task to track effort:

1. Open a task.
2. Add a time entry with:
   - **Minutes** -- How long you worked (required, must be a positive number)
   - **Description** -- What you worked on (optional)
   - **Date** -- When the work happened (required)

You can view all time entries for a task, and project-level time reports break down time by task and by team member.

**Tip:** Logging time consistently helps you estimate future tasks more accurately and gives your team visibility into where effort is going.

#### Task history (who changed what)

Every change to a task is tracked automatically. The history shows:

- Which field was changed (title, status, priority, assignee, due date, etc.)
- The old value and the new value
- Who made the change
- When the change was made

This audit trail is invaluable for understanding how a task evolved and who made decisions along the way.

### Searching and Filtering

#### Global search

Use the search bar in the top navigation to find tasks across all your projects.

1. Click the search bar or start typing.
2. Results appear in a dropdown as you type (after at least 2 characters).
3. Click a result to open the task detail.

[Screenshot: search bar with dropdown results]

Search matches against task titles and descriptions.

**Tip:** If your search term contains special characters like `&` or `#`, the results may be unexpected. Stick to simple keywords for the best results.

#### Saved filters

You can save commonly used filter combinations for quick access later. Saved filters are project-specific and tied to your account.

#### Filtering by status, priority, assignee, label, date range

In the **My Tasks** view, use the dropdown filters at the top to narrow your task list:

- **Status filter** -- Show only tasks in a specific stage (To Do, In Progress, Review, Done)
- **Priority filter** -- Show only tasks at a specific priority level

In the project task list, you can filter by status, priority, and assignee using query parameters.

### Task Dependencies

Tasks can have relationships with other tasks:

#### Blocking and blocked-by relationships

- **Blocks** -- Task A blocks Task B means Task B cannot proceed until Task A is done
- **Related** -- Two tasks are related but do not block each other

For example, "Design homepage mockup" might block "Implement responsive nav" -- you cannot build the navigation until the design is finalized.

#### How dependencies affect status changes

When a task is blocked by another task, be aware that moving the blocked task to Done before its blocker is complete may lead to issues. Check your dependencies before marking work as finished.

**Tip:** If a task will not move to Done and you are not sure why, check whether it has blocking dependencies that are still incomplete.

#### Viewing the dependency graph

Dependencies are stored as relationships between tasks. You can see which tasks block or are related to others by looking at the task's dependency information.

---

## Projects

### Project Settings

#### Editing project details

1. Navigate to the project.
2. Project owners and admins can update the project name and description.

Only users with the **admin** role or higher on the project can edit project settings. **Owner** role is required to delete a project.

#### Managing project members

Projects have their own member list, separate from team membership. Each project member has a role:

- **Owner** -- Full control over the project (edit, delete, manage members)
- **Admin** -- Can edit project settings and manage members
- **Member** -- Can view the project, create and update tasks

Platform-level admins can access any project regardless of project membership.

#### Project labels

Each project has its own set of labels. To manage labels:

- **Create a label** -- Give it a name and a color (defaults to gray if not specified)
- **Delete a label** -- Removes the label and all its assignments from tasks
- **Assign to tasks** -- Attach labels to tasks for categorization
- **Remove from tasks** -- Detach a label from a specific task

### Project Templates

Templates let you create new projects with a predefined set of tasks, saving you from setting up the same structure repeatedly.

#### Creating a template from an existing project

Templates are stored as JSON structures that define tasks (with title, description, status, priority, assignee, estimated hours, and position) and labels (with name and color).

For example, a "Sprint Template" might include:
- Sprint planning
- Design review
- Implementation
- QA testing
- Sprint retrospective

Along with labels like "Sprint" and "Blocker."

#### Starting a new project from a template

When creating a new project, you can use a template to pre-populate it with tasks and labels. This is especially useful for recurring workflows like sprints, product launches, or onboarding checklists.

### Exporting Data

You can export your project data in three formats. To export, go to the **Reports** view or use the **Export CSV** button on the project board.

#### CSV export (for spreadsheets)

Downloads a `.csv` file with columns: ID, Title, Description, Status, Priority, Assignee, Due Date, Created At.

**Gotcha:** If your task descriptions contain commas, the CSV may not display correctly in all spreadsheet applications. For best results, use the JSON export for data that contains special characters.

#### JSON export (for integrations)

Downloads a `.json` file with full project data including tasks, comments, and metadata. This is the most complete export format and works well for importing into other tools or for backups.

#### Markdown export (for documentation)

Downloads a `.md` file with your project formatted as a readable document:
- Tasks are grouped by status
- Each task shows priority, assignee, due date, and description
- Includes status and priority badges with emoji indicators

This format is perfect for sharing project status in a document, wiki, or README.

---

## Team Management

### Teams

Teams are the foundation of collaboration in Taskflow. A team groups people together and can own multiple projects.

#### Creating and managing teams

1. Click **Team** in the sidebar.
2. To create a new team, use the team creation option.
3. Fill in:
   - **Team Name** (required) -- e.g., "Engineering" or "Marketing"
   - **Description** (optional) -- A brief summary of the team's purpose
4. You automatically become the team **Owner**.

#### Adding and removing members

- **Adding members** -- Admins and Owners can add members by email. The user must already have a Taskflow account.
- **Removing members** -- Only Owners can remove members. You cannot remove yourself (to prevent accidentally orphaning the team -- transfer ownership first).

#### Changing roles

Only the team Owner can change member roles. Available roles:
- **member** -- Basic access
- **admin** -- Can manage members and invitations
- **owner** -- Full control

To change a role, the Owner updates the member's role to the desired level.

**Gotcha:** You cannot delete a team that still has projects. Remove or reassign all projects first.

### Invitations

#### Sending invites

1. Navigate to your team.
2. Enter the invitee's email address.
3. Click **Send Invite**.

The invitation is valid for 7 days. If the invitee does not have a Taskflow account yet, they will need to register first and then accept the invitation.

**Tip:** You can only send one pending invitation per email address per team. If someone has not responded, check if the invitation is still pending before trying to send another one.

#### Accepting/declining invitations

When you receive an invitation:

1. Click **My Tasks** or check your pending invitations.
2. You will see a list of invitations showing which team invited you and who sent the invitation.
3. Click **Accept** to join the team, or **Decline** to turn it down.

When you accept, you are added to the team as a **member**.

#### Resending expired invitations

Invitations expire after 7 days. If an invitation has expired:

1. The original invitation will show as expired.
2. An admin or owner needs to send a **new invitation** to the same email address.
3. Ask the invitee to accept promptly this time.

### Permissions

Here is a full breakdown of what each role can do:

#### Team-level permissions

| Action | Member | Admin | Owner |
|--------|--------|-------|-------|
| View team and members | Yes | Yes | Yes |
| View team projects | Yes | Yes | Yes |
| Add members | No | Yes | Yes |
| Send invitations | No | Yes | Yes |
| Remove members | No | No | Yes |
| Change member roles | No | No | Yes |
| Edit team name/description | No | No | Yes |
| Delete team | No | No | Yes |

#### Project-level permissions

| Action | Member | Admin | Owner |
|--------|--------|-------|-------|
| View project and tasks | Yes | Yes | Yes |
| Create tasks | Yes | Yes | Yes |
| Update tasks | Yes | Yes | Yes |
| Add comments | Yes | Yes | Yes |
| Edit project settings | No | Yes | Yes |
| Manage project members | No | Yes | Yes |
| Delete project | No | No | Yes |

**Note:** Users with the platform-level **admin** role bypass project membership checks and can access any project.

---

## Analytics & Reports

### Dashboard

Your personal Dashboard is the first thing you see when you sign in. It gives you a snapshot of your work.

[Screenshot: dashboard overview]

#### Task summary cards

At the top of the Dashboard, you will see four summary cards:

| Card | What it shows |
|------|---------------|
| **Total Tasks** | How many tasks exist across your current projects |
| **In Progress** | How many tasks are actively being worked on |
| **Overdue** | How many tasks have passed their due date without being completed |
| **Done This Week** | How many tasks were completed in the last 7 days |

#### Upcoming deadlines

The "Upcoming Deadlines" card shows tasks with due dates, sorted by soonest first. Overdue tasks are highlighted in red so they stand out.

#### Recent activity

The "Recent Activity" card shows the most recently updated tasks, with color-coded indicators:
- **Green dot** -- Task is done
- **Red dot** -- Task is overdue
- **Yellow dot** -- Task is in progress

### Project Analytics

Navigate to **Reports** in the sidebar to see visual analytics for your current project.

#### Burndown chart (what it shows, how to read it)

The burndown chart tracks the number of remaining tasks over time.

- **Ideal line** (gray) -- A straight line from total tasks down to zero, representing the ideal pace
- **Actual line** (purple) -- Where you actually are

If the actual line is above the ideal line, you are behind schedule. If it is below, you are ahead. The chart covers the last 30 days by default.

[Screenshot: burndown chart]

#### Velocity chart (tasks completed per week)

The velocity chart is a bar chart showing how many tasks your team completed each week. This helps you understand your team's throughput over time and spot trends.

- Consistent bars suggest predictable delivery
- Spikes may indicate crunch periods
- Dips may indicate blockers or context-switching

[Screenshot: velocity chart]

#### Completion rates

The completion rate is the percentage of tasks in a project that are marked as Done. It is calculated as:

> (Done tasks / Total tasks) x 100

You can find this metric in project reports.

#### Overdue task tracking

The analytics overview tracks how many tasks have passed their due date without being completed. Keeping this number low is a good sign that your team is on top of deadlines.

### Reports

#### Generating a project report

1. Navigate to the project.
2. Go to the project's report generation option.
3. A snapshot report is created containing:
   - Project summary (total tasks, status breakdown, completion rate)
   - Average time to close tasks
   - Number of overdue tasks with details
   - Burndown data (last 30 days)
   - Velocity data (last 8 weeks)
   - List of overdue tasks with their priorities and due dates

Reports are saved and can be viewed later.

#### What is included in a report

| Section | Details |
|---------|---------|
| **Summary** | Total tasks, breakdown by status, completion rate, avg. time to close, overdue count |
| **Burndown** | Daily task counts by status over the last 30 days |
| **Velocity** | Weekly completion counts over the last 8 weeks |
| **Overdue Tasks** | List of overdue tasks with ID, title, due date, priority, and status |
| **Metadata** | Generation timestamp, who generated it |

#### Viewing historical reports

All generated reports are saved. You can view a list of past reports for any project, sorted by most recent first. Each report shows:
- When it was generated
- Who generated it
- The report type

Click on any report to view its full data.

---

## Automations

### Setting Up Rules

Automations let you define rules that automatically perform actions on tasks when certain conditions are met.

#### What triggers are available

Automations fire on task events. You define a trigger that specifies when the automation should run (for example, when a task is created or updated).

#### Defining conditions

Conditions narrow down which tasks the automation applies to. Each condition has:

- **Field** -- Which task field to check (e.g., priority, status, title)
- **Operator** -- How to compare (equals, not equals, contains, greater than, less than)
- **Value** -- What to compare against

Multiple conditions are combined with AND logic -- all conditions must match for the automation to fire.

#### Available actions

When an automation fires, it can perform one or more of these actions:

| Action | What it does |
|--------|--------------|
| **assign_to** | Assign the task to a specific user |
| **set_label** | Add a label to the task |
| **change_status** | Move the task to a different status |
| **send_notification** | Log a notification message |
| **add_comment** | Add an automated comment to the task |

#### Examples

**"Auto-assign critical bugs to Alice"**
- Trigger: task.created
- Condition: priority equals "critical"
- Action: assign_to = Alice's user ID

**"Label tasks containing 'urgent'"**
- Trigger: task.created
- Condition: title contains "urgent"
- Action: set_label = "Bug"

**"Move reviewed tasks to done when priority is low"**
- Trigger: task.updated
- Condition: status equals "review" AND priority equals "low"
- Action: change_status = "done"

Automation runs are logged so you can see when they fired and what they did.

### Recurring Tasks

Recurring tasks automatically create new tasks on a schedule, saving you from manually creating the same tasks over and over.

#### Creating a recurring task template

A recurring task template defines:
- **Title** -- The base task name (the date is appended automatically)
- **Description** -- Task details
- **Priority** -- Default priority for created tasks
- **Assignee** -- Who the task is assigned to
- **Recurrence schedule** -- How often to create the task

#### Daily, weekly, monthly schedules

| Schedule | How it works |
|----------|-------------|
| **Daily** | Creates a new task every day |
| **Weekly** | Creates a new task on a specific day of the week (e.g., every Monday) |
| **Monthly** | Creates a new task on a specific day of the month (e.g., the 1st of each month) |

Each generated task gets a title like "Weekly standup notes (4/27/2026)" so you can tell which instance it is.

#### Managing recurring templates

- **Enable/disable** -- Pause a recurring template without deleting it
- **View next run** -- See when the next task will be created
- **Delete** -- Remove the template entirely

---

## Integrations

### Webhooks

#### What webhooks are (plain language)

A webhook is a way for Taskflow to notify another application when something happens. Instead of the other app constantly asking "did anything change?", Taskflow sends it a message the moment something happens.

Think of it like a notification -- but instead of going to your phone, it goes to another piece of software.

#### Setting up a webhook

1. You need the URL of the service that should receive notifications (the "endpoint").
2. Register a webhook by providing:
   - **URL** -- Where to send notifications (must be a valid URL)
   - **Events** -- Which events to subscribe to (see below)
   - **Secret** -- A shared secret for verifying webhook signatures (optional, defaults to "default")

#### Available events

| Event | When it fires |
|-------|---------------|
| `task.created` | A new task is created |
| `task.updated` | A task is modified (status, priority, assignee, etc.) |
| `task.completed` | A task is moved to Done |
| `comment.added` | A comment is added to a task |

#### Testing your webhook

After setting up a webhook, trigger the relevant event (e.g., create a task) and check that your endpoint received the notification. Webhook deliveries are logged, so you can see the status code and whether the delivery succeeded.

#### Webhook signatures for verification

Every webhook delivery includes an `X-Taskflow-Signature` header. This is an HMAC-SHA256 signature of the request body. Your receiving application can verify this signature to confirm the webhook came from Taskflow and was not tampered with.

The payload format is:

```json
{
  "event": "task.created",
  "payload": { ... },
  "timestamp": "2026-04-27T12:00:00.000Z"
}
```

### Slack Integration

#### Connecting Slack to your project

Taskflow can send notifications to a Slack channel using incoming webhooks:

1. In Slack, create an incoming webhook for your desired channel.
2. Add a Slack integration to your project with the webhook URL.
3. Taskflow will post messages to that channel when task events occur.

#### What notifications you will receive

Slack notifications are triggered by automations and task events. You will see messages about task assignments, status changes, and other configured events directly in your Slack channel.

### Email Notifications

#### How email alerts work

Taskflow can send email notifications for key events:
- When you are assigned to a task
- When someone comments on a task you are involved with
- When a task you are watching is completed

#### Configuring notification preferences

Email notifications are configured through the integrations system. You can set up an email integration with your preferred email address.

**Note:** Email notifications are currently in mock mode for development environments. In production, they will send real emails.

---

## Account Settings

### Profile

Click **Settings** in the sidebar to manage your account.

#### Updating your name and email

1. Go to **Settings**.
2. Update your **Full Name** or **Email** in the Profile section.
3. Click **Update Profile**.

[Screenshot: profile settings form]

Your name appears on task assignments, comments, and team member lists, so keep it up to date.

#### Changing your password

1. Go to **Settings**.
2. Scroll to the **Change Password** section.
3. Enter your current password.
4. Enter your new password (at least 6 characters).
5. Confirm your new password.
6. Click **Change Password**.

[Screenshot: change password form]

**Tip:** The password strength indicator will tell you if your password is too short. Aim for at least 8 characters for good security.

If you forgot your password, you can use the password reset flow:
1. On the sign-in page, request a password reset with your email.
2. You will receive a reset token (valid for 1 hour).
3. Use the token to set a new password.

### API Keys

#### What API keys are for

API keys let you authenticate with the Taskflow API from scripts, integrations, and other automated tools without using your username and password. Each key has:

- A **name** to help you remember what it is for
- **Permissions** that control what the key can do
- An optional **expiration date**

#### Generating a new key

API keys are generated through the API. Each key has a prefix (for identification) and a hashed value (for security). When you create a key, the full key is shown once -- save it somewhere safe, because you will not be able to see it again.

#### Managing your keys

You can:
- View your active API keys (prefix and name only -- the full key is never shown again)
- See when each key was last used
- Delete keys you no longer need

#### Using API keys in scripts/integrations

Include your API key in the `X-API-Key` header of your requests:

```
X-API-Key: tf_your_api_key_here
```

### Notifications

#### Notification types

Taskflow sends notifications for:

| Type | When |
|------|------|
| **Task assigned** | You are assigned to a task |
| **Comment added** | Someone comments on a task you are involved with |
| **Task completed** | A task you are watching is marked as Done |

#### Reading and managing notifications

1. Click the bell icon in the top-right corner to see your notifications.
2. Unread notifications appear with a highlighted background.
3. Click a notification to mark it as read.
4. Click **Mark all read** to clear all unread notifications at once.

[Screenshot: notification dropdown]

The badge on the bell icon shows the number of unread notifications.

#### Notification preferences

You can manage your notification preferences to control which types of notifications you receive and how they are delivered.

---

## Troubleshooting

### Common Issues

**"I can't see a project"**
You are probably not a member of that project. Ask the project owner or an admin to add you as a project member. Platform-level admins can see all projects regardless of membership.

**"Task won't move to Done"**
Check if the task has blocking dependencies that are still incomplete. A task that is blocked by another unfinished task should not be marked as Done until the blocker is resolved.

**"Invitation expired"**
Invitations are valid for 7 days. If yours has expired, ask the team admin or owner to send you a new invitation.

**"CSV export looks wrong in my spreadsheet"**
If your task titles or descriptions contain commas, they may cause columns to shift. The CSV export does not currently escape commas in field values. For reliable data export, use the JSON format instead and import that into your spreadsheet tool.

**"Charts not loading on the Reports page"**
Make sure JavaScript is enabled in your browser. The charts are rendered client-side using a JavaScript charting library. If you are using a browser extension that blocks scripts, try disabling it for Taskflow.

**"Search returns unexpected results"**
Avoid using special characters like `&`, `#`, or `%` in search queries. These characters can interfere with URL parsing. Stick to simple keywords for the best results.

**"Notifications badge shows 0 unread but I have new notifications"**
This is a known issue. Refreshing the page will update the notification count. The badge is updated when notifications are fetched, which happens when you first load the app and when you click the bell icon.

**"Invalid Date showing on a task"**
This happens when a task has a date value that your browser cannot parse (for example, a date like "2026-13-45" which is not a real date). Report the specific task to your team admin so the date can be corrected.

**"Deleted task still appears on the board"**
After deleting a task, the board may not refresh automatically in some cases. Refresh the page to see the updated board.

### Getting Help

**Contacting support**
If you run into an issue that is not covered here, reach out to your Taskflow administrator or the support team.

**Reporting a bug**
When reporting a bug, include:
- What you were trying to do
- What happened instead
- Your browser name and version
- Any error messages you saw
- Steps to reproduce the issue

**Feature requests**
We love hearing what would make Taskflow better for your team. Submit feature requests through your administrator or the support channel.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Escape` | Close any open modal, dropdown, or sidebar |

**Tip:** Taskflow supports keyboard navigation through standard browser shortcuts. Use `Tab` to move between form fields and `Enter` to submit forms.

---

## API Reference (for developers)

This section is for developers who want to integrate with Taskflow programmatically.

### Authentication

Taskflow supports two authentication methods:

#### JWT token (login endpoint)

1. Send a POST request to `/api/auth/login` with your email and password.
2. You will receive a JWT token in the response.
3. Include the token in subsequent requests as a Bearer token:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
```

Tokens expire after 24 hours. The token is also set as an HTTP-only cookie named `token`.

#### API key (X-API-Key header)

For automated tools and scripts, use an API key:

```
X-API-Key: tf_your_api_key_here
```

### Endpoints

All endpoints are prefixed with `/api`. Responses are JSON.

#### Auth

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/auth/register` | Create a new account | No |
| `POST` | `/auth/login` | Sign in and get a JWT token | No |
| `POST` | `/auth/logout` | Sign out (clears cookie) | No |
| `GET` | `/auth/me` | Get the current user's profile | Yes |
| `PUT` | `/auth/profile` | Update your display name | Yes |
| `PUT` | `/auth/change-password` | Change your password | Yes |
| `POST` | `/auth/forgot-password` | Request a password reset token | No |
| `POST` | `/auth/reset-password` | Reset password with a token | No |

#### Projects

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/projects` | List all projects you have access to | Yes |
| `POST` | `/projects` | Create a new project | Yes |
| `GET` | `/projects/:id` | Get project details | Yes |
| `PUT` | `/projects/:id` | Update project name/description | Yes (admin+) |
| `DELETE` | `/projects/:id` | Delete a project | Yes (owner) |

#### Tasks

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/projects/:projectId/tasks` | List tasks (filterable by status, priority, assignee) | Yes |
| `POST` | `/projects/:projectId/tasks` | Create a task | Yes |
| `GET` | `/tasks/:id` | Get task details with comments, labels, attachments | Yes |
| `PUT` | `/tasks/:id` | Update a task (with audit trail) | Yes |
| `DELETE` | `/tasks/:id` | Delete a task and all related data | Yes |
| `PUT` | `/tasks/:id/position` | Reorder a task within its column | Yes |
| `GET` | `/tasks/:id/history` | Get the audit trail for a task | Yes |
| `PUT` | `/tasks/bulk` | Bulk update task statuses | Yes |
| `GET` | `/tasks/search?q=keyword` | Search tasks by title or description | Yes |

#### Comments

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/tasks/:id/comments` | Add a comment to a task | Yes |

#### Labels

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/projects/:projectId/labels` | List labels for a project | Yes |
| `POST` | `/projects/:projectId/labels` | Create a label | Yes |
| `DELETE` | `/projects/:projectId/labels/:id` | Delete a label | Yes |
| `POST` | `/tasks/:taskId/labels` | Assign a label to a task | Yes |
| `DELETE` | `/tasks/:taskId/labels/:labelId` | Remove a label from a task | Yes |

#### Attachments

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/tasks/:id/attachments` | Upload a file attachment (multipart form, field name: `file`, max 10 MB) | Yes |

#### Time Tracking

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/tasks/:taskId/time` | Log a time entry | Yes |
| `GET` | `/tasks/:taskId/time` | List time entries for a task | Yes |
| `GET` | `/projects/:projectId/time-report` | Time report for a project (by task and by user) | Yes |
| `DELETE` | `/time/:id` | Delete a time entry (own entries only) | Yes |

#### Teams

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/teams` | List your teams | Yes |
| `POST` | `/teams` | Create a new team | Yes |
| `GET` | `/teams/:id` | Get team details with members and projects | Yes (member+) |
| `PUT` | `/teams/:id` | Update team name/description | Yes (owner) |
| `DELETE` | `/teams/:id` | Delete a team (must have no projects) | Yes (owner) |
| `POST` | `/teams/:id/members` | Add a member by email | Yes (admin+) |
| `DELETE` | `/teams/:id/members/:userId` | Remove a member | Yes (owner) |
| `PUT` | `/teams/:id/members/:userId/role` | Change a member's role | Yes (owner) |

#### Invitations

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/teams/:teamId/invite` | Send a team invitation | Yes (admin+) |
| `GET` | `/invitations` | List your pending invitations | Yes |
| `POST` | `/invitations/:id/accept` | Accept an invitation | Yes |
| `POST` | `/invitations/:id/decline` | Decline an invitation | Yes |
| `GET` | `/invitations/verify/:token` | Verify an invitation token is valid | Yes |

#### Dashboard

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/dashboard` | Your tasks grouped by status (sorted by priority and due date) | Yes |
| `GET` | `/dashboard/upcoming` | Tasks due in the next 7 days | Yes |
| `GET` | `/dashboard/overdue` | Tasks past their due date | Yes |
| `GET` | `/dashboard/recent-activity` | Last 20 activities across your projects | Yes |

#### Analytics

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/analytics/overview` | Cross-project analytics (completion rate, avg. time to close) | Yes |
| `GET` | `/projects/:projectId/stats` | Project statistics (status breakdown, overdue, burndown) | Yes |
| `GET` | `/projects/:projectId/burndown` | Burndown chart data (configurable days via `?days=30`) | Yes |
| `GET` | `/projects/:projectId/velocity` | Velocity chart data (configurable weeks via `?weeks=8`) | Yes |

#### Reports

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/projects/:projectId/reports/generate` | Generate a snapshot report | Yes |
| `GET` | `/projects/:projectId/reports` | List generated reports for a project | Yes |
| `GET` | `/reports/:id` | Get a specific report with full data | Yes |

#### Export

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/projects/:projectId/export/csv` | Export project tasks as CSV | Yes |
| `GET` | `/projects/:projectId/export/json` | Export project as JSON (includes comments) | Yes |
| `GET` | `/projects/:projectId/export/markdown` | Export project as Markdown document | Yes |

#### Webhooks

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `POST` | `/webhooks` | Register a webhook | Yes |
| `GET` | `/webhooks` | List your registered webhooks | Yes |
| `DELETE` | `/webhooks/:id` | Delete a webhook | Yes |

#### Notifications

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/notifications` | List your notifications (paginated: `?page=1&limit=20`) | Yes |
| `GET` | `/notifications/count` | Get unread notification count | Yes |
| `PUT` | `/notifications/:id/read` | Mark a notification as read | Yes |
| `PUT` | `/notifications/read-all` | Mark all notifications as read | Yes |

#### Users (admin)

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/users` | List all users | Yes (admin) |
| `GET` | `/users/:id` | Get user profile with team and project memberships | Yes |
| `PUT` | `/users/:id/role` | Change a user's platform role | Yes (admin) |
| `GET` | `/users/:id/activity` | Get a user's recent tasks and comments | Yes |

#### Activity

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/projects/:projectId/activity` | Unified activity feed (history, comments, time entries; paginated: `?limit=20&offset=0`) | Yes |

#### Health Check

| Method | Path | Description | Auth |
|--------|------|-------------|------|
| `GET` | `/health` | Server health check | No |

### Example: Create a task

**Request:**

```bash
curl -X POST http://localhost:4000/api/projects/1/tasks \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "title": "Fix checkout page validation",
    "description": "The email field accepts invalid formats",
    "priority": "high",
    "status": "todo",
    "due_date": "2026-05-15"
  }'
```

**Response (201 Created):**

```json
{
  "task": {
    "id": 17,
    "project_id": 1,
    "title": "Fix checkout page validation",
    "description": "The email field accepts invalid formats",
    "status": "todo",
    "priority": "high",
    "assignee_id": null,
    "due_date": "2026-05-15",
    "estimated_hours": null,
    "position": 8,
    "created_at": "2026-04-27T10:30:00.000Z",
    "updated_at": "2026-04-27T10:30:00.000Z"
  }
}
```

### Example: List tasks with filters

**Request:**

```bash
curl "http://localhost:4000/api/projects/1/tasks?status=todo&priority=high" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response (200 OK):**

```json
{
  "tasks": [
    {
      "id": 6,
      "project_id": 1,
      "title": "Optimize image loading",
      "description": "Implement lazy loading and WebP conversion for all images",
      "status": "todo",
      "priority": "high",
      "assignee_id": 1,
      "due_date": "2026-05-08",
      "estimated_hours": 5,
      "position": 5,
      "created_at": "2026-04-27T00:00:00.000Z",
      "updated_at": "2026-04-27T00:00:00.000Z"
    }
  ]
}
```

### Example: Update task status

**Request:**

```bash
curl -X PUT http://localhost:4000/api/tasks/6 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "status": "in_progress"
  }'
```

**Response (200 OK):**

```json
{
  "task": {
    "id": 6,
    "project_id": 1,
    "title": "Optimize image loading",
    "status": "in_progress",
    "priority": "high",
    "assignee_id": 1,
    "due_date": "2026-05-08",
    "updated_at": "2026-04-27T10:35:00.000Z"
  }
}
```

### Error responses

All errors follow this format:

```json
{
  "error": "Human-readable error message"
}
```

Common HTTP status codes:

| Code | Meaning |
|------|---------|
| `400` | Bad request -- missing or invalid input |
| `401` | Unauthorized -- missing or invalid token |
| `403` | Forbidden -- you do not have permission |
| `404` | Not found -- the resource does not exist |
| `409` | Conflict -- duplicate resource (e.g., email already in use) |

### Rate limiting

The API includes rate limiting to prevent abuse. If you exceed the limit, you will receive a `429 Too Many Requests` response. Wait a moment and try again.
