/* ============================================================
   Taskflow — Frontend Application
   Vanilla JS, fetch()-based API client, Kanban board
   ============================================================ */

// --------------- Configuration ---------------
const API_BASE = '/api';

// --------------- State ---------------
let state = {
  token: localStorage.getItem('token'),
  user: null,
  projects: [],
  currentProject: null,
  tasks: [],
  users: [],
};

// --------------- API Client ---------------
async function api(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = 'Bearer ' + state.token;
  }
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(API_BASE + path, opts);
  const data = await res.json().catch(function() { return {}; });

  if (!res.ok) {
    throw new Error(data.error || 'Request failed (' + res.status + ')');
  }
  return data;
}

// Auth
async function loginUser(email, password) {
  const data = await api('POST', '/auth/login', { email: email, password: password });
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('token', data.token);
  return data;
}

async function registerUser(name, email, password) {
  const data = await api('POST', '/auth/register', { name: name, email: email, password: password });
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('token', data.token);
  return data;
}

async function fetchMe() {
  const data = await api('GET', '/auth/me');
  state.user = data.user;
  return data.user;
}

function logout() {
  state.token = null;
  state.user = null;
  state.projects = [];
  state.currentProject = null;
  state.tasks = [];
  localStorage.removeItem('token');
  render();
}

// Projects
async function fetchProjects() {
  const data = await api('GET', '/projects');
  state.projects = data.projects || data || [];
  return state.projects;
}

async function createProject(name, description) {
  const data = await api('POST', '/projects', { name: name, description: description });
  return data.project || data;
}

// Tasks
async function fetchTasks(projectId) {
  const data = await api('GET', '/projects/' + projectId + '/tasks');
  state.tasks = data.tasks || data || [];
  return state.tasks;
}

async function createTask(projectId, taskData) {
  const data = await api('POST', '/projects/' + projectId + '/tasks', taskData);
  return data.task || data;
}

async function updateTask(projectId, taskId, updates) {
  const data = await api('PATCH', '/projects/' + projectId + '/tasks/' + taskId, updates);
  return data.task || data;
}

async function deleteTask(projectId, taskId) {
  await api('DELETE', '/projects/' + projectId + '/tasks/' + taskId);
}

// Comments
async function fetchComments(taskId) {
  const data = await api('GET', '/tasks/' + taskId + '/comments');
  return data.comments || data || [];
}

async function addComment(taskId, body) {
  const data = await api('POST', '/tasks/' + taskId + '/comments', { body: body });
  return data.comment || data;
}

// Export
async function exportCsv(projectId) {
  const headers = {};
  if (state.token) {
    headers['Authorization'] = 'Bearer ' + state.token;
  }
  const res = await fetch(API_BASE + '/projects/' + projectId + '/export', { headers: headers });
  if (!res.ok) throw new Error('Export failed');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'project-' + projectId + '-tasks.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// --------------- Toast Notifications ---------------
function showToast(message, type) {
  if (!type) type = 'info';
  var container = document.getElementById('toast-container');
  var toast = document.createElement('div');
  toast.className = 'toast toast-' + type;

  var iconMap = { success: '✓', error: '✗', info: 'ℹ' };
  var icon = iconMap[type] || iconMap.info;

  var iconSpan = document.createElement('span');
  iconSpan.className = 'toast-icon';
  iconSpan.textContent = icon;

  var msgSpan = document.createElement('span');
  msgSpan.className = 'toast-message';
  msgSpan.textContent = message;

  toast.appendChild(iconSpan);
  toast.appendChild(msgSpan);
  container.appendChild(toast);

  setTimeout(function() {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 300ms ease';
    setTimeout(function() { toast.remove(); }, 300);
  }, 3500);
}

// --------------- Utility ---------------
function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  // BUG 7: Does not validate the date before formatting.
  // Invalid dates like "2026-13-45" will display as "Invalid Date"
  return new Date(dateStr).toLocaleDateString();
}

function getStatusLabel(status) {
  var labels = {
    todo: 'To Do',
    in_progress: 'In Progress',
    review: 'Review',
    done: 'Done',
  };
  return labels[status] || status;
}

function getPriorityClass(priority) {
  return 'priority-' + priority;
}

// --------------- DOM helpers for safe rendering ---------------

function createEl(tag, className, textContent) {
  var el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

function setContent(parentEl, nodes) {
  // Clear and append nodes safely
  while (parentEl.firstChild) parentEl.removeChild(parentEl.firstChild);
  nodes.forEach(function(n) {
    if (typeof n === 'string') {
      parentEl.appendChild(document.createTextNode(n));
    } else {
      parentEl.appendChild(n);
    }
  });
}

// --------------- Render Engine ---------------
function render() {
  var app = document.getElementById('app');
  if (!state.token) {
    renderAuth(app);
  } else {
    renderApp(app);
  }
}

// --- Auth View ---
function renderAuth(container) {
  // Build auth form using DOM methods
  while (container.firstChild) container.removeChild(container.firstChild);

  var wrapper = createEl('div', 'auth-wrapper');
  var card = createEl('div', 'auth-card');

  var title = createEl('h1', '', 'Sign In');
  title.id = 'auth-title';

  var subtitle = createEl('p', 'subtitle', 'Welcome back to Taskflow');
  subtitle.id = 'auth-subtitle';

  var form = document.createElement('form');
  form.id = 'auth-form';

  // Name group (hidden for login)
  var nameGroup = createEl('div', 'form-group');
  nameGroup.id = 'name-group';
  nameGroup.style.display = 'none';
  var nameLabel = createEl('label', '', 'Full Name');
  nameLabel.setAttribute('for', 'auth-name');
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'auth-name';
  nameInput.placeholder = 'Jane Doe';
  nameInput.autocomplete = 'name';
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);

  // Email group
  var emailGroup = createEl('div', 'form-group');
  var emailLabel = createEl('label', '', 'Email');
  emailLabel.setAttribute('for', 'auth-email');
  var emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.id = 'auth-email';
  emailInput.placeholder = 'you@example.com';
  emailInput.autocomplete = 'email';
  emailInput.required = true;
  emailGroup.appendChild(emailLabel);
  emailGroup.appendChild(emailInput);

  // Password group
  var passGroup = createEl('div', 'form-group');
  var passLabel = createEl('label', '', 'Password');
  passLabel.setAttribute('for', 'auth-password');
  var passInput = document.createElement('input');
  passInput.type = 'password';
  passInput.id = 'auth-password';
  passInput.placeholder = 'At least 6 characters';
  passInput.autocomplete = 'current-password';
  passInput.required = true;
  passGroup.appendChild(passLabel);
  passGroup.appendChild(passInput);

  // Submit button
  var submitBtn = createEl('button', 'btn btn-primary btn-block', 'Sign In');
  submitBtn.type = 'submit';
  submitBtn.id = 'auth-submit';

  form.appendChild(nameGroup);
  form.appendChild(emailGroup);
  form.appendChild(passGroup);
  form.appendChild(submitBtn);

  // Toggle
  var toggleDiv = createEl('div', 'auth-toggle');
  var toggleText = document.createTextNode("Don't have an account? ");
  toggleText.id = 'auth-toggle-text';
  var toggleSpan = createEl('span', '', "Don't have an account? ");
  toggleSpan.id = 'auth-toggle-text';
  var toggleBtn = createEl('button', '', 'Create one');
  toggleBtn.id = 'auth-toggle-btn';
  toggleDiv.appendChild(toggleSpan);
  toggleDiv.appendChild(toggleBtn);

  card.appendChild(title);
  card.appendChild(subtitle);
  card.appendChild(form);
  card.appendChild(toggleDiv);
  wrapper.appendChild(card);
  container.appendChild(wrapper);

  var isLogin = true;

  toggleBtn.addEventListener('click', function() {
    isLogin = !isLogin;
    title.textContent = isLogin ? 'Sign In' : 'Create Account';
    subtitle.textContent = isLogin ? 'Welcome back to Taskflow' : 'Get started with Taskflow';
    nameGroup.style.display = isLogin ? 'none' : 'block';
    submitBtn.textContent = isLogin ? 'Sign In' : 'Create Account';
    toggleSpan.textContent = isLogin ? "Don't have an account? " : 'Already have an account? ';
    toggleBtn.textContent = isLogin ? 'Create one' : 'Sign in';
  });

  form.addEventListener('submit', async function(e) {
    e.preventDefault();
    var email = emailInput.value.trim();
    var password = passInput.value;
    var name = nameInput.value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait...';

    try {
      if (isLogin) {
        await loginUser(email, password);
      } else {
        if (!name) {
          showToast('Please enter your name', 'error');
          submitBtn.disabled = false;
          submitBtn.textContent = 'Create Account';
          return;
        }
        await registerUser(name, email, password);
      }
      showToast('Welcome' + (state.user ? ', ' + state.user.name : '') + '!', 'success');
      render();
    } catch (err) {
      showToast(err.message, 'error');
      submitBtn.disabled = false;
      submitBtn.textContent = isLogin ? 'Sign In' : 'Create Account';
    }
  });
}

// --- App View ---
async function renderApp(container) {
  while (container.firstChild) container.removeChild(container.firstChild);

  var layout = createEl('div', 'app-layout');

  // --- Sidebar ---
  var sidebar = createEl('aside', 'sidebar');

  var sidebarHeader = createEl('div', 'sidebar-header');
  sidebarHeader.appendChild(createEl('h2', '', 'Taskflow'));
  var userEmail = createEl('div', 'user-email', 'Loading...');
  userEmail.id = 'sidebar-email';
  sidebarHeader.appendChild(userEmail);
  sidebar.appendChild(sidebarHeader);

  var sidebarNav = createEl('nav', 'sidebar-nav');
  sidebarNav.appendChild(createEl('div', 'sidebar-section-label', 'Projects'));
  var projectList = createEl('div', '');
  projectList.id = 'project-list';
  sidebarNav.appendChild(projectList);

  var newProjectBtn = createEl('button', 'sidebar-item');
  newProjectBtn.id = 'new-project-btn';
  var plusIcon = createEl('span', 'icon', '+');
  newProjectBtn.appendChild(plusIcon);
  newProjectBtn.appendChild(document.createTextNode(' New Project'));
  sidebarNav.appendChild(newProjectBtn);
  sidebar.appendChild(sidebarNav);

  var sidebarFooter = createEl('div', 'sidebar-footer');
  var logoutBtn = createEl('button', 'btn btn-ghost', 'Sign Out');
  logoutBtn.id = 'logout-btn';
  sidebarFooter.appendChild(logoutBtn);
  sidebar.appendChild(sidebarFooter);

  layout.appendChild(sidebar);

  // --- Main content ---
  var mainContent = createEl('div', 'main-content');

  var topBar = createEl('header', 'top-bar');
  var projectTitle = createEl('h1', '', 'Select a project');
  projectTitle.id = 'project-title';
  topBar.appendChild(projectTitle);

  var topBarActions = createEl('div', 'top-bar-actions');
  var exportBtn = createEl('button', 'btn btn-outline btn-sm', 'Export CSV');
  exportBtn.id = 'export-btn';
  exportBtn.style.display = 'none';
  var newTaskBtn = createEl('button', 'btn btn-primary btn-sm', '+ New Task');
  newTaskBtn.id = 'new-task-btn';
  newTaskBtn.style.display = 'none';
  topBarActions.appendChild(exportBtn);
  topBarActions.appendChild(newTaskBtn);
  topBar.appendChild(topBarActions);
  mainContent.appendChild(topBar);

  var boardArea = createEl('main', 'content-area');
  boardArea.id = 'board-area';
  var emptyState = createEl('div', 'empty-state');
  var emptyIcon = createEl('div', 'empty-icon', '📋');
  emptyState.appendChild(emptyIcon);
  emptyState.appendChild(createEl('p', '', 'Select a project from the sidebar to get started'));
  boardArea.appendChild(emptyState);
  mainContent.appendChild(boardArea);

  layout.appendChild(mainContent);
  container.appendChild(layout);

  // Logout
  logoutBtn.addEventListener('click', logout);

  // Load user info
  try {
    await fetchMe();
    userEmail.textContent = state.user.email;
  } catch (e) {
    logout();
    return;
  }

  // Load projects
  try {
    await fetchProjects();
    renderProjectList();
  } catch (err) {
    showToast('Failed to load projects', 'error');
  }

  // New project
  newProjectBtn.addEventListener('click', openCreateProjectModal);

  // New task
  newTaskBtn.addEventListener('click', openCreateTaskModal);

  // Export
  exportBtn.addEventListener('click', async function() {
    if (!state.currentProject) return;
    try {
      await exportCsv(state.currentProject.id);
      showToast('CSV exported successfully', 'success');
    } catch (err) {
      showToast('Export failed: ' + err.message, 'error');
    }
  });
}

// --- Project List ---
function renderProjectList() {
  var list = document.getElementById('project-list');
  if (!list) return;

  while (list.firstChild) list.removeChild(list.firstChild);

  state.projects.forEach(function(project) {
    var btn = createEl('button', 'sidebar-item' + (state.currentProject && state.currentProject.id === project.id ? ' active' : ''));
    var icon = createEl('span', 'icon', '📁');
    btn.appendChild(icon);
    btn.appendChild(document.createTextNode(' ' + project.name));
    btn.addEventListener('click', function() { selectProject(project); });
    list.appendChild(btn);
  });
}

async function selectProject(project) {
  state.currentProject = project;
  var titleEl = document.getElementById('project-title');
  if (titleEl) titleEl.textContent = project.name;
  var exportEl = document.getElementById('export-btn');
  if (exportEl) exportEl.style.display = '';
  var newTaskEl = document.getElementById('new-task-btn');
  if (newTaskEl) newTaskEl.style.display = '';

  renderProjectList();

  try {
    await fetchTasks(project.id);
    renderBoard();
  } catch (err) {
    showToast('Failed to load tasks', 'error');
  }
}

// --- Kanban Board ---
function renderBoard() {
  var area = document.getElementById('board-area');
  if (!area) return;
  while (area.firstChild) area.removeChild(area.firstChild);

  var statuses = ['todo', 'in_progress', 'review', 'done'];
  var counts = {};
  statuses.forEach(function(s) {
    counts[s] = state.tasks.filter(function(t) { return t.status === s; }).length;
  });

  // Stats panel
  var statsPanel = createEl('div', 'stats-panel');
  statuses.forEach(function(s) {
    var card = createEl('div', 'stat-card stat-' + s.replace('_', '-'));
    card.appendChild(createEl('div', 'stat-label', getStatusLabel(s)));
    card.appendChild(createEl('div', 'stat-value', String(counts[s])));
    statsPanel.appendChild(card);
  });
  area.appendChild(statsPanel);

  // Kanban board
  var board = createEl('div', 'kanban-board');
  board.id = 'kanban-board';

  statuses.forEach(function(s) {
    var column = createEl('div', 'kanban-column');
    column.dataset.status = s;
    column.id = 'col-' + s;

    var header = createEl('div', 'kanban-column-header');
    header.appendChild(createEl('span', 'kanban-column-title', getStatusLabel(s)));
    header.appendChild(createEl('span', 'kanban-column-count', String(counts[s])));
    column.appendChild(header);

    var cardsContainer = createEl('div', 'kanban-cards');
    cardsContainer.dataset.status = s;

    var columnTasks = state.tasks.filter(function(t) { return t.status === s; });
    columnTasks.forEach(function(task) {
      cardsContainer.appendChild(buildTaskCard(task));
    });

    column.appendChild(cardsContainer);
    board.appendChild(column);
  });

  area.appendChild(board);
  setupDragAndDrop();
}

function buildTaskCard(task) {
  var statusOrder = ['todo', 'in_progress', 'review', 'done'];
  var currentIdx = statusOrder.indexOf(task.status);

  var card = createEl('div', 'task-card');
  card.draggable = true;
  card.dataset.taskId = task.id;

  var titleEl = createEl('div', 'task-card-title', task.title);
  titleEl.addEventListener('click', function() {
    openTaskDetailModal(task);
  });
  card.appendChild(titleEl);

  var meta = createEl('div', 'task-card-meta');
  meta.appendChild(createEl('span', 'task-priority ' + getPriorityClass(task.priority), task.priority));
  meta.appendChild(createEl('span', 'task-card-due', formatDate(task.due_date)));
  card.appendChild(meta);

  var actions = createEl('div', 'task-card-actions');

  // Forward move button
  if (currentIdx < statusOrder.length - 1) {
    var nextStatus = statusOrder[currentIdx + 1];
    var fwdBtn = createEl('button', 'btn btn-outline btn-sm move-btn', '→ ' + getStatusLabel(nextStatus));
    fwdBtn.dataset.taskId = task.id;
    fwdBtn.dataset.moveTo = nextStatus;
    fwdBtn.addEventListener('click', function() { moveTask(task.id, nextStatus); });
    actions.appendChild(fwdBtn);
  }

  // Backward move button
  if (currentIdx > 0) {
    var prevStatus = statusOrder[currentIdx - 1];
    var backBtn = createEl('button', 'btn btn-ghost btn-sm move-btn', '← ' + getStatusLabel(prevStatus));
    backBtn.dataset.taskId = task.id;
    backBtn.dataset.moveTo = prevStatus;
    backBtn.addEventListener('click', function() { moveTask(task.id, prevStatus); });
    actions.appendChild(backBtn);
  }

  // Delete button
  var delBtn = createEl('button', 'btn btn-ghost btn-sm delete-btn', 'Delete');
  delBtn.style.marginLeft = 'auto';
  delBtn.style.color = 'var(--danger)';
  delBtn.dataset.taskId = task.id;
  delBtn.addEventListener('click', function() {
    if (!confirm('Delete this task?')) return;
    handleDeleteTask(task.id);
  });
  actions.appendChild(delBtn);

  card.appendChild(actions);
  return card;
}

async function moveTask(taskId, newStatus) {
  try {
    await updateTask(state.currentProject.id, taskId, { status: newStatus });
    var idx = state.tasks.findIndex(function(t) { return t.id === taskId; });
    if (idx !== -1) state.tasks[idx].status = newStatus;
    renderBoard();
    showToast('Task moved', 'success');
  } catch (err) {
    showToast('Failed to move task: ' + err.message, 'error');
  }
}

async function handleDeleteTask(taskId) {
  try {
    await deleteTask(state.currentProject.id, taskId);
    // BUG 8: After deleting a task, we do NOT remove it from the DOM
    // or from state.tasks. The task visually remains until a full page refresh.
    showToast('Task deleted successfully', 'success');
  } catch (err) {
    showToast('Failed to delete task: ' + err.message, 'error');
  }
}

// --- Drag & Drop ---
function setupDragAndDrop() {
  var cards = document.querySelectorAll('.task-card');
  var columns = document.querySelectorAll('.kanban-cards');

  cards.forEach(function(card) {
    card.addEventListener('dragstart', function(e) {
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', card.dataset.taskId);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', function() {
      card.classList.remove('dragging');
      document.querySelectorAll('.kanban-column.drag-over').forEach(function(col) {
        col.classList.remove('drag-over');
      });
    });
  });

  columns.forEach(function(col) {
    col.addEventListener('dragover', function(e) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      col.closest('.kanban-column').classList.add('drag-over');
    });

    col.addEventListener('dragleave', function(e) {
      if (!col.contains(e.relatedTarget)) {
        col.closest('.kanban-column').classList.remove('drag-over');
      }
    });

    col.addEventListener('drop', async function(e) {
      e.preventDefault();
      col.closest('.kanban-column').classList.remove('drag-over');

      var taskId = parseInt(e.dataTransfer.getData('text/plain'), 10);
      var newStatus = col.dataset.status;
      var task = state.tasks.find(function(t) { return t.id === taskId; });
      if (!task || task.status === newStatus) return;

      try {
        await updateTask(state.currentProject.id, taskId, { status: newStatus });
        task.status = newStatus;
        renderBoard();
        showToast('Task moved to ' + getStatusLabel(newStatus), 'success');
      } catch (err) {
        showToast('Failed to move task: ' + err.message, 'error');
      }
    });
  });
}

// --------------- Modals ---------------

function openModal(title, bodyContent, footerContent) {
  closeModal();

  var overlay = createEl('div', 'modal-overlay');
  overlay.id = 'modal-overlay';

  var modal = createEl('div', 'modal');

  // Header
  var header = createEl('div', 'modal-header');
  header.appendChild(createEl('h2', '', title));
  var closeBtn = createEl('button', 'modal-close', '×');
  closeBtn.id = 'modal-close-btn';
  closeBtn.addEventListener('click', closeModal);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  // Body
  var body = createEl('div', 'modal-body');
  body.id = 'modal-body-content';
  if (bodyContent instanceof Node) {
    body.appendChild(bodyContent);
  }
  modal.appendChild(body);

  // Footer
  if (footerContent instanceof Node) {
    var footer = createEl('div', 'modal-footer');
    footer.appendChild(footerContent);
    modal.appendChild(footer);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  requestAnimationFrame(function() { overlay.classList.add('open'); });

  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeModal();
  });
}

function closeModal() {
  var existing = document.getElementById('modal-overlay');
  if (existing) {
    existing.classList.remove('open');
    setTimeout(function() { existing.remove(); }, 200);
  }
}

// --- Create Project Modal ---
function openCreateProjectModal() {
  var bodyFragment = document.createDocumentFragment();

  var form = document.createElement('form');
  form.id = 'create-project-form';

  var nameGroup = createEl('div', 'form-group');
  var nameLabel = createEl('label', '', 'Project Name');
  nameLabel.setAttribute('for', 'proj-name');
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.id = 'proj-name';
  nameInput.placeholder = 'e.g. Website Redesign';
  nameInput.required = true;
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  form.appendChild(nameGroup);

  var descGroup = createEl('div', 'form-group');
  var descLabel = createEl('label', '', 'Description');
  descLabel.setAttribute('for', 'proj-desc');
  var descTextarea = document.createElement('textarea');
  descTextarea.id = 'proj-desc';
  descTextarea.placeholder = 'Brief description of the project...';
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);
  form.appendChild(descGroup);

  bodyFragment.appendChild(form);

  var footerFragment = document.createDocumentFragment();
  var cancelBtn = createEl('button', 'btn btn-ghost', 'Cancel');
  cancelBtn.addEventListener('click', closeModal);
  footerFragment.appendChild(cancelBtn);

  var submitBtn = createEl('button', 'btn btn-primary', 'Create Project');
  submitBtn.id = 'create-project-submit';
  submitBtn.addEventListener('click', async function() {
    var name = nameInput.value.trim();
    var description = descTextarea.value.trim();
    if (!name) {
      showToast('Project name is required', 'error');
      return;
    }
    try {
      var project = await createProject(name, description);
      state.projects.push(project);
      renderProjectList();
      closeModal();
      showToast('Project created', 'success');
      selectProject(project);
    } catch (err) {
      showToast('Failed to create project: ' + err.message, 'error');
    }
  });
  footerFragment.appendChild(submitBtn);

  openModal('New Project', bodyFragment, footerFragment);
}

// --- Create Task Modal ---
function openCreateTaskModal() {
  if (!state.currentProject) return;

  var form = document.createElement('form');
  form.id = 'create-task-form';

  // Title
  var titleGroup = createEl('div', 'form-group');
  var titleLabel = createEl('label', '', 'Title');
  titleLabel.setAttribute('for', 'task-title');
  var titleInput = document.createElement('input');
  titleInput.type = 'text';
  titleInput.id = 'task-title';
  titleInput.placeholder = 'e.g. Fix login page bug';
  titleInput.required = true;
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  form.appendChild(titleGroup);

  // Description
  var descGroup = createEl('div', 'form-group');
  var descLabel = createEl('label', '', 'Description');
  descLabel.setAttribute('for', 'task-desc');
  var descTextarea = document.createElement('textarea');
  descTextarea.id = 'task-desc';
  descTextarea.placeholder = 'Describe the task...';
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);
  form.appendChild(descGroup);

  // Row: Priority + Status
  var row = createEl('div', 'create-form-row');

  var prioGroup = createEl('div', 'form-group');
  var prioLabel = createEl('label', '', 'Priority');
  prioLabel.setAttribute('for', 'task-priority');
  var prioSelect = document.createElement('select');
  prioSelect.id = 'task-priority';
  ['low', 'medium', 'high', 'critical'].forEach(function(val) {
    var opt = document.createElement('option');
    opt.value = val;
    opt.textContent = val.charAt(0).toUpperCase() + val.slice(1);
    if (val === 'medium') opt.selected = true;
    prioSelect.appendChild(opt);
  });
  prioGroup.appendChild(prioLabel);
  prioGroup.appendChild(prioSelect);
  row.appendChild(prioGroup);

  var statusGroup = createEl('div', 'form-group');
  var statusLabel = createEl('label', '', 'Status');
  statusLabel.setAttribute('for', 'task-status');
  var statusSelect = document.createElement('select');
  statusSelect.id = 'task-status';
  [['todo', 'To Do'], ['in_progress', 'In Progress'], ['review', 'Review'], ['done', 'Done']].forEach(function(pair) {
    var opt = document.createElement('option');
    opt.value = pair[0];
    opt.textContent = pair[1];
    if (pair[0] === 'todo') opt.selected = true;
    statusSelect.appendChild(opt);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  row.appendChild(statusGroup);
  form.appendChild(row);

  // Due date
  var dueGroup = createEl('div', 'form-group');
  var dueLabel = createEl('label', '', 'Due Date');
  dueLabel.setAttribute('for', 'task-due');
  var dueInput = document.createElement('input');
  dueInput.type = 'date';
  dueInput.id = 'task-due';
  dueGroup.appendChild(dueLabel);
  dueGroup.appendChild(dueInput);
  form.appendChild(dueGroup);

  // Footer
  var footerFragment = document.createDocumentFragment();
  var cancelBtn = createEl('button', 'btn btn-ghost', 'Cancel');
  cancelBtn.addEventListener('click', closeModal);
  footerFragment.appendChild(cancelBtn);

  var submitBtn = createEl('button', 'btn btn-primary', 'Create Task');
  submitBtn.addEventListener('click', async function() {
    var title = titleInput.value.trim();
    var description = descTextarea.value.trim();
    var priority = prioSelect.value;
    var status = statusSelect.value;
    var due_date = dueInput.value || null;

    if (!title) {
      showToast('Task title is required', 'error');
      return;
    }

    try {
      var task = await createTask(state.currentProject.id, {
        title: title,
        description: description,
        priority: priority,
        status: status,
        due_date: due_date,
      });
      state.tasks.push(task);
      renderBoard();
      closeModal();
      showToast('Task created', 'success');
    } catch (err) {
      showToast('Failed to create task: ' + err.message, 'error');
    }
  });
  footerFragment.appendChild(submitBtn);

  openModal('New Task', form, footerFragment);
}

// --- Task Detail Modal ---
async function openTaskDetailModal(task) {
  var comments = [];
  try {
    comments = await fetchComments(task.id);
  } catch (e) {
    // Comments may not be loaded
  }

  var body = document.createDocumentFragment();

  // Status
  var statusField = createEl('div', 'task-detail-field');
  statusField.appendChild(createEl('div', 'field-label', 'Status'));
  var statusValue = createEl('div', 'field-value');
  statusValue.appendChild(createEl('span', 'status-badge status-' + task.status, getStatusLabel(task.status)));
  statusField.appendChild(statusValue);
  body.appendChild(statusField);

  // Priority
  var prioField = createEl('div', 'task-detail-field');
  prioField.appendChild(createEl('div', 'field-label', 'Priority'));
  var prioValue = createEl('div', 'field-value');
  prioValue.appendChild(createEl('span', 'task-priority ' + getPriorityClass(task.priority), task.priority));
  prioField.appendChild(prioValue);
  body.appendChild(prioField);

  // Description
  var descField = createEl('div', 'task-detail-field');
  descField.appendChild(createEl('div', 'field-label', 'Description'));
  var descValue = createEl('div', 'field-value');
  if (task.description) {
    descValue.textContent = task.description;
  } else {
    var em = document.createElement('em');
    em.style.color = 'var(--text-muted)';
    em.textContent = 'No description';
    descValue.appendChild(em);
  }
  descField.appendChild(descValue);
  body.appendChild(descField);

  // Due date
  var dueField = createEl('div', 'task-detail-field');
  dueField.appendChild(createEl('div', 'field-label', 'Due Date'));
  dueField.appendChild(createEl('div', 'field-value', formatDate(task.due_date)));
  body.appendChild(dueField);

  // Created
  var createdField = createEl('div', 'task-detail-field');
  createdField.appendChild(createEl('div', 'field-label', 'Created'));
  createdField.appendChild(createEl('div', 'field-value', formatDate(task.created_at)));
  body.appendChild(createdField);

  // Comments section
  var commentsSection = createEl('div', 'comments-section');
  commentsSection.appendChild(createEl('h3', '', 'Comments (' + comments.length + ')'));

  var commentsList = createEl('div', '');
  commentsList.id = 'comments-list';

  if (comments.length === 0) {
    var noComments = createEl('p', '', 'No comments yet');
    noComments.style.color = 'var(--text-muted)';
    noComments.style.fontSize = '0.85rem';
    commentsList.appendChild(noComments);
  } else {
    comments.forEach(function(c) {
      var item = createEl('div', 'comment-item');
      item.appendChild(createEl('span', 'comment-author', c.user_name || c.author || 'User'));
      item.appendChild(createEl('span', 'comment-date', formatDate(c.created_at)));
      item.appendChild(createEl('div', 'comment-body', c.body));
      commentsList.appendChild(item);
    });
  }
  commentsSection.appendChild(commentsList);

  // Comment form
  var commentForm = createEl('div', 'comment-form');
  var commentTextarea = document.createElement('textarea');
  commentTextarea.id = 'new-comment';
  commentTextarea.placeholder = 'Add a comment...';
  commentForm.appendChild(commentTextarea);

  var postBtn = createEl('button', 'btn btn-primary btn-sm', 'Post');
  postBtn.style.alignSelf = 'flex-end';
  postBtn.addEventListener('click', async function() {
    var commentBody = commentTextarea.value.trim();
    if (!commentBody) {
      showToast('Comment cannot be empty', 'error');
      return;
    }
    try {
      var comment = await addComment(task.id, commentBody);
      // Remove "no comments" placeholder if present
      var placeholder = commentsList.querySelector('p');
      if (placeholder) commentsList.removeChild(placeholder);

      var item = createEl('div', 'comment-item');
      item.appendChild(createEl('span', 'comment-author', comment.user_name || (state.user ? state.user.name : 'You')));
      item.appendChild(createEl('span', 'comment-date', 'Just now'));
      item.appendChild(createEl('div', 'comment-body', comment.body || commentBody));
      commentsList.appendChild(item);
      commentTextarea.value = '';
      showToast('Comment added', 'success');
    } catch (err) {
      showToast('Failed to add comment: ' + err.message, 'error');
    }
  });
  commentForm.appendChild(postBtn);
  commentsSection.appendChild(commentForm);

  body.appendChild(commentsSection);

  openModal(task.title, body, null);
}

// --------------- Initialize ---------------
document.addEventListener('DOMContentLoaded', function() {
  render();
});
