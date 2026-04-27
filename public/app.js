/* ============================================================
   Taskflow — Frontend Application
   Vanilla JS, fetch()-based API client, Multi-view SPA
   ============================================================ */

// --------------- Configuration ---------------
var API_BASE = '/api';

// --------------- State ---------------
var state = {
  token: localStorage.getItem('token'),
  user: null,
  projects: [],
  currentProject: null,
  tasks: [],
  users: [],
  currentView: 'dashboard',
  notifications: [],
  searchResults: [],
  projectViewMode: 'kanban',
};

// --------------- API Client ---------------
async function api(method, path, body) {
  var headers = { 'Content-Type': 'application/json' };
  if (state.token) {
    headers['Authorization'] = 'Bearer ' + state.token;
  }
  var opts = { method: method, headers: headers };
  if (body) opts.body = JSON.stringify(body);

  var res = await fetch(API_BASE + path, opts);
  var data = await res.json().catch(function() { return {}; });

  if (!res.ok) {
    throw new Error(data.error || 'Request failed (' + res.status + ')');
  }
  return data;
}

// Auth
async function loginUser(email, password) {
  var data = await api('POST', '/auth/login', { email: email, password: password });
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('token', data.token);
  return data;
}

async function registerUser(name, email, password) {
  var data = await api('POST', '/auth/register', { name: name, email: email, password: password });
  state.token = data.token;
  state.user = data.user;
  localStorage.setItem('token', data.token);
  return data;
}

async function fetchMe() {
  var data = await api('GET', '/auth/me');
  state.user = data.user;
  return data.user;
}

function logout() {
  state.token = null;
  state.user = null;
  state.projects = [];
  state.currentProject = null;
  state.tasks = [];
  state.currentView = 'dashboard';
  localStorage.removeItem('token');
  render();
}

// Projects
async function fetchProjects() {
  var data = await api('GET', '/projects');
  state.projects = data.projects || data || [];
  return state.projects;
}

async function createProject(name, description) {
  var data = await api('POST', '/projects', { name: name, description: description });
  return data.project || data;
}

// Tasks
async function fetchTasks(projectId) {
  var data = await api('GET', '/projects/' + projectId + '/tasks');
  state.tasks = data.tasks || data || [];
  return state.tasks;
}

async function createTask(projectId, taskData) {
  var data = await api('POST', '/projects/' + projectId + '/tasks', taskData);
  return data.task || data;
}

async function updateTask(projectId, taskId, updates) {
  var data = await api('PATCH', '/projects/' + projectId + '/tasks/' + taskId, updates);
  return data.task || data;
}

async function deleteTask(projectId, taskId) {
  await api('DELETE', '/projects/' + projectId + '/tasks/' + taskId);
}

// Comments
async function fetchComments(taskId) {
  var data = await api('GET', '/tasks/' + taskId + '/comments');
  return data.comments || data || [];
}

async function addComment(taskId, body) {
  var data = await api('POST', '/tasks/' + taskId + '/comments', { body: body });
  return data.comment || data;
}

// Users
async function fetchUsers() {
  try {
    var data = await api('GET', '/users');
    state.users = data.users || data || [];
  } catch (e) {
    state.users = [];
  }
  return state.users;
}

// Notifications
async function fetchNotifications() {
  try {
    var data = await api('GET', '/notifications');
    state.notifications = data.notifications || data || [];
  } catch (e) {
    state.notifications = generateMockNotifications();
  }
  return state.notifications;
}

// Search
async function searchTasks(query) {
  try {
    var data = await api('GET', '/tasks/search?q=' + encodeURIComponent(query));
    return data.tasks || data || [];
  } catch (e) {
    return filterTasksLocally(query);
  }
}

function filterTasksLocally(query) {
  var q = query.toLowerCase();
  var results = [];
  state.projects.forEach(function(project) {
    state.tasks.forEach(function(task) {
      if (task.title && task.title.toLowerCase().indexOf(q) !== -1) {
        results.push(Object.assign({}, task, { projectName: project.name }));
      }
      if (task.description && task.description.toLowerCase().indexOf(q) !== -1) {
        results.push(Object.assign({}, task, { projectName: project.name }));
      }
    });
  });
  return results;
}

// Export
async function exportProject(projectId, format) {
  if (format === 'csv') {
    return exportCsv(projectId);
  }
  if (format === 'json') {
    return exportJson(projectId);
  }
  if (format === 'markdown') {
    return exportMarkdown(projectId);
  }
}

async function exportCsv(projectId) {
  var headers = {};
  if (state.token) {
    headers['Authorization'] = 'Bearer ' + state.token;
  }
  var res = await fetch(API_BASE + '/projects/' + projectId + '/export', { headers: headers });
  if (!res.ok) throw new Error('Export failed');
  var blob = await res.blob();
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'project-' + projectId + '-tasks.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportJson(projectId) {
  var projectTasks = state.tasks.filter(function(t) { return true; });
  var blob = new Blob([JSON.stringify(projectTasks, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'project-' + projectId + '-tasks.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function exportMarkdown(projectId) {
  var project = state.currentProject || { name: 'Project' };
  var md = '# ' + project.name + ' Tasks\n\n';
  var statuses = ['todo', 'in_progress', 'review', 'done'];
  statuses.forEach(function(s) {
    md += '## ' + getStatusLabel(s) + '\n\n';
    var tasks = state.tasks.filter(function(t) { return t.status === s; });
    if (tasks.length === 0) {
      md += '_No tasks_\n\n';
    } else {
      tasks.forEach(function(t) {
        md += '- **' + t.title + '** (' + t.priority + ')';
        if (t.due_date) md += ' - Due: ' + formatDate(t.due_date);
        md += '\n';
      });
      md += '\n';
    }
  });
  var blob = new Blob([md], { type: 'text/markdown' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'project-' + projectId + '-tasks.md';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Mock notifications for when API is not available
function generateMockNotifications() {
  return [
    { id: 1, text: 'Task "Fix login bug" was moved to Review', icon: '🔄', time: '2 min ago', read: false },
    { id: 2, text: 'New comment on "Update dashboard layout"', icon: '💬', time: '15 min ago', read: false },
    { id: 3, text: 'Task "API rate limiting" is overdue', icon: '⚠️', time: '1 hour ago', read: false },
    { id: 4, text: 'Project "Mobile App" was created', icon: '📁', time: '3 hours ago', read: true },
    { id: 5, text: 'You were assigned to "Write test suite"', icon: '📋', time: '5 hours ago', read: true },
  ];
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

function getInitials(name) {
  if (!name) return '?';
  var parts = name.split(' ');
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.substring(0, 2).toUpperCase();
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  var now = new Date();
  var then = new Date(dateStr);
  var diffMs = now - then;
  var diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return diffMins + ' min ago';
  var diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return diffHours + 'h ago';
  var diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return diffDays + 'd ago';
  return formatDate(dateStr);
}

function isOverdue(task) {
  if (!task.due_date || task.status === 'done') return false;
  return new Date(task.due_date) < new Date();
}

// --------------- DOM helpers ---------------
function createEl(tag, className, textContent) {
  var el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent !== undefined) el.textContent = textContent;
  return el;
}

function setContent(parentEl, nodes) {
  while (parentEl.firstChild) parentEl.removeChild(parentEl.firstChild);
  nodes.forEach(function(n) {
    if (typeof n === 'string') {
      parentEl.appendChild(document.createTextNode(n));
    } else {
      parentEl.appendChild(n);
    }
  });
}

function clearEl(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}

// --------------- URL Hash Routing ---------------
function applyHash() {
  var hash = window.location.hash.substring(1);
  if (hash.indexOf('search=') === 0) {
    // BUG 18: The query is read directly from the hash without URL-decoding.
    // Special characters like & # % in search terms break the hash parsing.
    var query = hash.substring(7);
    state.currentView = 'search';
    var searchInput = document.getElementById('global-search');
    if (searchInput) {
      searchInput.value = query;
      performSearch(query);
    }
  } else if (hash) {
    state.currentView = hash;
  }
}

function setHash(view) {
  window.location.hash = view;
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
  clearEl(container);

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
  clearEl(container);

  var layout = createEl('div', 'app-layout');

  // --- Sidebar Backdrop (mobile) ---
  var backdrop = createEl('div', 'sidebar-backdrop');
  backdrop.id = 'sidebar-backdrop';
  layout.appendChild(backdrop);

  // --- Sidebar ---
  var sidebar = createEl('aside', 'sidebar');
  sidebar.id = 'sidebar';

  var sidebarHeader = createEl('div', 'sidebar-header');
  sidebarHeader.appendChild(createEl('h2', '', 'Taskflow'));
  var userEmail = createEl('div', 'user-email', 'Loading...');
  userEmail.id = 'sidebar-email';
  sidebarHeader.appendChild(userEmail);
  sidebar.appendChild(sidebarHeader);

  var sidebarNav = createEl('nav', 'sidebar-nav');

  // Main navigation
  sidebarNav.appendChild(createEl('div', 'sidebar-section-label', 'Main'));

  var navItems = [
    { id: 'dashboard', icon: '📊', label: 'Dashboard' },
    { id: 'my-tasks', icon: '✅', label: 'My Tasks' },
    { id: 'team', icon: '👥', label: 'Team' },
    { id: 'reports', icon: '📈', label: 'Reports' },
    { id: 'settings', icon: '⚙️', label: 'Settings' },
  ];

  navItems.forEach(function(item) {
    var btn = createEl('button', 'sidebar-item' + (state.currentView === item.id ? ' active' : ''));
    btn.dataset.view = item.id;
    btn.appendChild(createEl('span', 'icon', item.icon));
    btn.appendChild(document.createTextNode(' ' + item.label));
    btn.addEventListener('click', function() {
      navigateTo(item.id);
    });
    sidebarNav.appendChild(btn);
  });

  // Projects section
  sidebarNav.appendChild(createEl('div', 'sidebar-section-label', 'Projects'));
  var projectList = createEl('div', '');
  projectList.id = 'project-list';
  sidebarNav.appendChild(projectList);

  var newProjectBtn = createEl('button', 'sidebar-item');
  newProjectBtn.id = 'new-project-btn';
  newProjectBtn.appendChild(createEl('span', 'icon', '+'));
  newProjectBtn.appendChild(document.createTextNode(' New Project'));
  sidebarNav.appendChild(newProjectBtn);
  sidebar.appendChild(sidebarNav);

  var sidebarFooter = createEl('div', 'sidebar-footer');
  var logoutBtn = createEl('button', 'btn btn-ghost');
  logoutBtn.id = 'logout-btn';
  logoutBtn.appendChild(createEl('span', 'icon', '🚪'));
  logoutBtn.appendChild(document.createTextNode(' Sign Out'));
  sidebarFooter.appendChild(logoutBtn);
  sidebar.appendChild(sidebarFooter);

  layout.appendChild(sidebar);

  // --- Main content ---
  var mainContent = createEl('div', 'main-content');

  var topBar = createEl('header', 'top-bar');

  // Hamburger button (mobile)
  var hamburgerBtn = createEl('button', 'hamburger-btn');
  hamburgerBtn.id = 'hamburger-btn';
  hamburgerBtn.textContent = '☰';
  hamburgerBtn.addEventListener('click', toggleSidebar);
  topBar.appendChild(hamburgerBtn);

  var projectTitle = createEl('h1', '', 'Dashboard');
  projectTitle.id = 'page-title';
  topBar.appendChild(projectTitle);

  // Search bar
  var searchWrapper = createEl('div', 'search-wrapper');
  var searchIcon = createEl('span', 'search-icon', '🔍');
  searchWrapper.appendChild(searchIcon);
  var searchInput = document.createElement('input');
  searchInput.type = 'text';
  searchInput.id = 'global-search';
  searchInput.placeholder = 'Search tasks...';
  searchInput.autocomplete = 'off';
  searchWrapper.appendChild(searchInput);
  var searchDropdown = createEl('div', 'search-results-dropdown');
  searchDropdown.id = 'search-dropdown';
  searchDropdown.style.display = 'none';
  searchWrapper.appendChild(searchDropdown);
  topBar.appendChild(searchWrapper);

  var topBarActions = createEl('div', 'top-bar-actions');

  // Notification bell
  var notifWrapper = createEl('div', 'notification-wrapper');
  var bellBtn = createEl('button', 'btn-icon');
  bellBtn.id = 'bell-btn';
  bellBtn.textContent = '🔔';
  var notifBadge = createEl('span', 'notification-badge');
  notifBadge.id = 'notif-badge';
  notifBadge.textContent = '0';
  notifBadge.style.display = 'none';
  bellBtn.appendChild(notifBadge);
  notifWrapper.appendChild(bellBtn);

  var notifDropdown = createEl('div', 'notification-dropdown');
  notifDropdown.id = 'notif-dropdown';
  notifDropdown.style.display = 'none';
  notifWrapper.appendChild(notifDropdown);
  topBarActions.appendChild(notifWrapper);

  // User avatar
  var avatarEl = createEl('div', 'user-avatar');
  avatarEl.id = 'user-avatar';
  avatarEl.textContent = '?';
  topBarActions.appendChild(avatarEl);

  topBar.appendChild(topBarActions);
  mainContent.appendChild(topBar);

  var contentArea = createEl('main', 'content-area');
  contentArea.id = 'content-area';
  mainContent.appendChild(contentArea);

  layout.appendChild(mainContent);
  container.appendChild(layout);

  // --- Event listeners ---
  logoutBtn.addEventListener('click', logout);
  newProjectBtn.addEventListener('click', openCreateProjectModal);

  // Sidebar mobile toggle
  backdrop.addEventListener('click', closeSidebar);

  // Notification bell click
  bellBtn.addEventListener('click', function() {
    var dropdown = document.getElementById('notif-dropdown');
    if (dropdown.style.display === 'none') {
      // BUG 17: Fetches notifications on every click without debouncing.
      // Rapid clicking fires N parallel API calls; the dropdown flickers
      // as responses arrive out of order.
      fetchNotifications().then(function(notifs) {
        renderNotificationDropdown(notifs);
        dropdown.style.display = 'block';
      });
    } else {
      dropdown.style.display = 'none';
    }
  });

  // Close notification dropdown when clicking outside
  document.addEventListener('click', function(e) {
    var notifDropdown = document.getElementById('notif-dropdown');
    var bellBtn = document.getElementById('bell-btn');
    if (notifDropdown && bellBtn && !notifWrapper.contains(e.target)) {
      notifDropdown.style.display = 'none';
    }
  });

  // Search input
  var searchTimer;
  searchInput.addEventListener('input', function() {
    var query = searchInput.value.trim();
    clearTimeout(searchTimer);
    if (query.length < 2) {
      searchDropdown.style.display = 'none';
      return;
    }
    searchTimer = setTimeout(function() {
      // BUG 18: Store the search query in the URL hash without URL-encoding.
      // Special characters in search terms break the hash parsing.
      window.location.hash = 'search=' + query;
      performSearch(query);
    }, 300);
  });

  searchInput.addEventListener('focus', function() {
    if (searchInput.value.trim().length >= 2) {
      searchDropdown.style.display = 'block';
    }
  });

  document.addEventListener('click', function(e) {
    if (!searchWrapper.contains(e.target)) {
      searchDropdown.style.display = 'none';
    }
  });

  // Escape key closes modals and dropdowns
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      closeModal();
      searchDropdown.style.display = 'none';
      var notifDropdown = document.getElementById('notif-dropdown');
      if (notifDropdown) notifDropdown.style.display = 'none';
      closeSidebar();
    }
  });

  // Load user info
  try {
    await fetchMe();
    userEmail.textContent = state.user.email;
    avatarEl.textContent = getInitials(state.user.name);
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

  // Load initial notifications
  try {
    var notifs = await fetchNotifications();
    var unread = notifs.filter(function(n) { return !n.read; }).length;
    if (unread > 0) {
      notifBadge.textContent = String(unread);
      notifBadge.style.display = 'flex';
    }
  } catch (e) {
    // silent
  }

  // Apply hash
  applyHash();

  // Render the current view
  renderCurrentView();

  // Hash change listener
  window.addEventListener('hashchange', function() {
    applyHash();
    renderCurrentView();
  });
}

// --- Navigation ---
function navigateTo(viewId) {
  state.currentView = viewId;
  setHash(viewId);
  updateSidebarActive();
  renderCurrentView();
  closeSidebar();
}

function toggleSidebar() {
  var sidebar = document.getElementById('sidebar');
  var backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    sidebar.classList.toggle('open');
    backdrop.classList.toggle('visible');
  }
}

function closeSidebar() {
  var sidebar = document.getElementById('sidebar');
  var backdrop = document.getElementById('sidebar-backdrop');
  if (sidebar) {
    sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('visible');
  }
}

function updateSidebarActive() {
  var items = document.querySelectorAll('.sidebar-item[data-view]');
  items.forEach(function(item) {
    if (item.dataset.view === state.currentView) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  // Deactivate project items if not on project view
  if (state.currentView !== 'project') {
    var projectItems = document.querySelectorAll('#project-list .sidebar-item');
    projectItems.forEach(function(item) { item.classList.remove('active'); });
  }
}

function updatePageTitle(title) {
  var el = document.getElementById('page-title');
  if (el) el.textContent = title;
}

function renderCurrentView() {
  var area = document.getElementById('content-area');
  if (!area) return;

  switch (state.currentView) {
    case 'dashboard':
      updatePageTitle('Dashboard');
      renderDashboardView(area);
      break;
    case 'my-tasks':
      updatePageTitle('My Tasks');
      renderMyTasksView(area);
      break;
    case 'team':
      updatePageTitle('Team');
      renderTeamView(area);
      break;
    case 'reports':
      updatePageTitle('Reports');
      renderReportsView(area);
      break;
    case 'settings':
      updatePageTitle('Settings');
      renderSettingsView(area);
      break;
    case 'project':
      updatePageTitle(state.currentProject ? state.currentProject.name : 'Project');
      renderProjectView(area);
      break;
    case 'search':
      updatePageTitle('Search Results');
      renderSearchResults(area, state.searchResults);
      break;
    default:
      updatePageTitle('Dashboard');
      renderDashboardView(area);
      break;
  }
}

// --------------- Dashboard View ---------------
function renderDashboardView(area) {
  clearEl(area);

  // Summary cards
  var allTasks = [];
  state.projects.forEach(function() {
    allTasks = allTasks.concat(state.tasks);
  });
  // Use current tasks in state
  var tasks = state.tasks;
  var totalTasks = tasks.length;
  var inProgress = tasks.filter(function(t) { return t.status === 'in_progress'; }).length;
  var overdue = tasks.filter(function(t) { return isOverdue(t); }).length;
  var now = new Date();
  var weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  var completedThisWeek = tasks.filter(function(t) {
    return t.status === 'done' && t.updated_at && new Date(t.updated_at) >= weekAgo;
  }).length;

  var statsPanel = createEl('div', 'stats-panel');

  var statItems = [
    { label: 'Total Tasks', value: totalTasks, cls: 'stat-total' },
    { label: 'In Progress', value: inProgress, cls: 'stat-in-progress' },
    { label: 'Overdue', value: overdue, cls: 'stat-overdue' },
    { label: 'Done This Week', value: completedThisWeek, cls: 'stat-done' },
  ];

  statItems.forEach(function(item) {
    var card = createEl('div', 'stat-card ' + item.cls);
    card.appendChild(createEl('div', 'stat-label', item.label));
    card.appendChild(createEl('div', 'stat-value', String(item.value)));
    statsPanel.appendChild(card);
  });

  area.appendChild(statsPanel);

  // Dashboard grid
  var grid = createEl('div', 'dashboard-grid');

  // Recent Activity
  var activityCard = createEl('div', 'dashboard-card');
  var activityHeader = createEl('div', 'dashboard-card-header');
  activityHeader.appendChild(createEl('h3', '', 'Recent Activity'));
  activityCard.appendChild(activityHeader);

  var activityBody = createEl('div', 'dashboard-card-body');
  var activityFeed = createEl('ul', 'activity-feed');

  // Generate activity from tasks
  var recentTasks = tasks.slice().sort(function(a, b) {
    return new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at);
  }).slice(0, 8);

  if (recentTasks.length === 0) {
    var noActivity = createEl('div', 'empty-state');
    noActivity.appendChild(createEl('p', '', 'No recent activity'));
    activityBody.appendChild(noActivity);
  } else {
    recentTasks.forEach(function(task) {
      var item = createEl('li', 'activity-item');
      var dotClass = 'activity-dot';
      if (task.status === 'done') dotClass += ' dot-success';
      else if (isOverdue(task)) dotClass += ' dot-danger';
      else if (task.status === 'in_progress') dotClass += ' dot-warning';
      item.appendChild(createEl('div', dotClass));

      var textDiv = createEl('div', '');
      textDiv.appendChild(createEl('div', 'activity-text', '"' + task.title + '" — ' + getStatusLabel(task.status)));
      textDiv.appendChild(createEl('div', 'activity-time', timeAgo(task.updated_at || task.created_at)));
      item.appendChild(textDiv);

      activityFeed.appendChild(item);
    });
    activityBody.appendChild(activityFeed);
  }
  activityCard.appendChild(activityBody);
  grid.appendChild(activityCard);

  // Upcoming Deadlines
  var deadlineCard = createEl('div', 'dashboard-card');
  var deadlineHeader = createEl('div', 'dashboard-card-header');
  deadlineHeader.appendChild(createEl('h3', '', 'Upcoming Deadlines'));
  deadlineCard.appendChild(deadlineHeader);

  var deadlineBody = createEl('div', 'dashboard-card-body');
  var upcomingTasks = tasks
    .filter(function(t) { return t.due_date && t.status !== 'done'; })
    .sort(function(a, b) { return new Date(a.due_date) - new Date(b.due_date); })
    .slice(0, 6);

  if (upcomingTasks.length === 0) {
    var noDeadlines = createEl('div', 'empty-state');
    noDeadlines.appendChild(createEl('p', '', 'No upcoming deadlines'));
    deadlineBody.appendChild(noDeadlines);
  } else {
    var deadlineList = createEl('ul', 'deadline-list');
    upcomingTasks.forEach(function(task) {
      var item = createEl('li', 'deadline-item');
      item.appendChild(createEl('span', 'deadline-task', task.title));
      var dateSpan = createEl('span', 'deadline-date' + (isOverdue(task) ? ' overdue' : ''), formatDate(task.due_date));
      item.appendChild(dateSpan);
      deadlineList.appendChild(item);
    });
    deadlineBody.appendChild(deadlineList);
  }
  deadlineCard.appendChild(deadlineBody);
  grid.appendChild(deadlineCard);

  // Projects overview
  var projectsCard = createEl('div', 'dashboard-card full-width');
  var projectsHeader = createEl('div', 'dashboard-card-header');
  projectsHeader.appendChild(createEl('h3', '', 'Projects'));
  var newProjBtn = createEl('button', 'btn btn-primary btn-sm', '+ New Project');
  newProjBtn.addEventListener('click', openCreateProjectModal);
  projectsHeader.appendChild(newProjBtn);
  projectsCard.appendChild(projectsHeader);

  var projectsBody = createEl('div', 'dashboard-card-body');
  if (state.projects.length === 0) {
    var emptyProj = createEl('div', 'empty-state');
    var emptyShape = createEl('div', 'empty-shape');
    emptyShape.appendChild(createEl('div', 'shape-circle'));
    emptyProj.appendChild(emptyShape);
    emptyProj.appendChild(createEl('h3', '', 'No projects yet'));
    emptyProj.appendChild(createEl('p', '', 'Create your first project to start managing tasks'));
    projectsBody.appendChild(emptyProj);
  } else {
    var projTable = createEl('div', 'data-table-wrapper');
    var table = createEl('table', 'data-table');
    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    ['Name', 'Description', 'Created'].forEach(function(col) {
      var th = document.createElement('th');
      th.textContent = col;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    state.projects.forEach(function(proj) {
      var row = document.createElement('tr');
      var nameCell = document.createElement('td');
      var nameLink = createEl('span', 'cell-title', proj.name);
      nameLink.addEventListener('click', function() { selectProject(proj); });
      nameCell.appendChild(nameLink);
      row.appendChild(nameCell);

      var descCell = document.createElement('td');
      descCell.textContent = proj.description || '—';
      row.appendChild(descCell);

      var dateCell = document.createElement('td');
      dateCell.textContent = formatDate(proj.created_at);
      row.appendChild(dateCell);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    projTable.appendChild(table);
    projectsBody.appendChild(projTable);
  }
  projectsCard.appendChild(projectsBody);
  grid.appendChild(projectsCard);

  area.appendChild(grid);
}

// --------------- Project View ---------------
async function renderProjectView(area) {
  clearEl(area);

  if (!state.currentProject) {
    var empty = createEl('div', 'empty-state');
    empty.appendChild(createEl('div', 'empty-icon', '📁'));
    empty.appendChild(createEl('p', '', 'Select a project from the sidebar'));
    area.appendChild(empty);
    return;
  }

  // Controls bar
  var controlBar = createEl('div', 'filter-bar');

  var viewToggle = createEl('div', 'view-toggle');
  var kanbanBtn = createEl('button', state.projectViewMode === 'kanban' ? 'active' : '', 'Board');
  kanbanBtn.addEventListener('click', function() {
    state.projectViewMode = 'kanban';
    renderProjectView(area);
  });
  var tableBtn = createEl('button', state.projectViewMode === 'table' ? 'active' : '', 'Table');
  tableBtn.addEventListener('click', function() {
    state.projectViewMode = 'table';
    renderProjectView(area);
  });
  viewToggle.appendChild(kanbanBtn);
  viewToggle.appendChild(tableBtn);
  controlBar.appendChild(viewToggle);

  var newTaskBtn = createEl('button', 'btn btn-primary btn-sm', '+ New Task');
  newTaskBtn.addEventListener('click', openCreateTaskModal);
  controlBar.appendChild(newTaskBtn);

  var exportBtn = createEl('button', 'btn btn-outline btn-sm', 'Export CSV');
  exportBtn.addEventListener('click', function() {
    exportProject(state.currentProject.id, 'csv').then(function() {
      showToast('CSV exported', 'success');
    }).catch(function(err) {
      showToast('Export failed: ' + err.message, 'error');
    });
  });
  controlBar.appendChild(exportBtn);

  area.appendChild(controlBar);

  // Stats
  var statuses = ['todo', 'in_progress', 'review', 'done'];
  var counts = {};
  statuses.forEach(function(s) {
    counts[s] = state.tasks.filter(function(t) { return t.status === s; }).length;
  });

  var statsPanel = createEl('div', 'stats-panel');
  statuses.forEach(function(s) {
    var card = createEl('div', 'stat-card stat-' + s.replace('_', '-'));
    card.appendChild(createEl('div', 'stat-label', getStatusLabel(s)));
    card.appendChild(createEl('div', 'stat-value', String(counts[s])));
    statsPanel.appendChild(card);
  });
  area.appendChild(statsPanel);

  // View content
  if (state.projectViewMode === 'kanban') {
    renderKanbanBoard(area);
  } else {
    renderTaskTable(area);
  }

  // Project members
  var membersCard = createEl('div', 'dashboard-card');
  membersCard.style.marginTop = '1.5rem';
  var membersHeader = createEl('div', 'dashboard-card-header');
  membersHeader.appendChild(createEl('h3', '', 'Team Members'));
  membersCard.appendChild(membersHeader);
  var membersBody = createEl('div', 'dashboard-card-body');

  if (state.users.length === 0) {
    await fetchUsers();
  }

  if (state.users.length === 0 && state.user) {
    state.users = [state.user];
  }

  state.users.forEach(function(user) {
    var memberRow = createEl('div', 'activity-item');
    var avatar = createEl('div', 'user-avatar');
    avatar.textContent = getInitials(user.name);
    avatar.style.width = '28px';
    avatar.style.height = '28px';
    avatar.style.fontSize = '0.7rem';
    memberRow.appendChild(avatar);
    var info = createEl('div', '');
    info.appendChild(createEl('div', 'activity-text', user.name || user.email));
    info.appendChild(createEl('div', 'activity-time', user.email || ''));
    memberRow.appendChild(info);
    membersBody.appendChild(memberRow);
  });

  membersCard.appendChild(membersBody);
  area.appendChild(membersCard);
}

// --- Kanban Board ---
function renderKanbanBoard(area) {
  var statuses = ['todo', 'in_progress', 'review', 'done'];
  var counts = {};
  statuses.forEach(function(s) {
    counts[s] = state.tasks.filter(function(t) { return t.status === s; }).length;
  });

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

    if (columnTasks.length === 0) {
      var emptyCol = createEl('div', 'empty-state');
      emptyCol.style.padding = '1.5rem 0.5rem';
      emptyCol.appendChild(createEl('p', '', 'No tasks'));
      cardsContainer.appendChild(emptyCol);
    }

    column.appendChild(cardsContainer);
    board.appendChild(column);
  });

  area.appendChild(board);
  setupDragAndDrop();
}

// --- Task Table View ---
function renderTaskTable(area) {
  var wrapper = createEl('div', 'data-table-wrapper');
  var table = createEl('table', 'data-table');

  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  var columns = [
    { key: 'title', label: 'Title' },
    { key: 'status', label: 'Status' },
    { key: 'priority', label: 'Priority' },
    { key: 'due_date', label: 'Due Date' },
    { key: 'created_at', label: 'Created' },
  ];

  columns.forEach(function(col) {
    var th = document.createElement('th');
    th.textContent = col.label;
    var sortIndicator = createEl('span', 'sort-indicator', '↕');
    th.appendChild(sortIndicator);
    th.addEventListener('click', function() {
      sortTaskTable(col.key, area);
    });
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  state.tasks.forEach(function(task) {
    var row = document.createElement('tr');

    var titleCell = document.createElement('td');
    var titleLink = createEl('span', 'cell-title', task.title);
    titleLink.addEventListener('click', function() { openTaskDetailModal(task); });
    titleCell.appendChild(titleLink);
    row.appendChild(titleCell);

    var statusCell = document.createElement('td');
    statusCell.appendChild(createEl('span', 'status-badge status-' + task.status, getStatusLabel(task.status)));
    row.appendChild(statusCell);

    var prioCell = document.createElement('td');
    prioCell.appendChild(createEl('span', 'task-priority ' + getPriorityClass(task.priority), task.priority));
    row.appendChild(prioCell);

    var dueCell = document.createElement('td');
    var dueText = formatDate(task.due_date);
    var dueSpan = createEl('span', '', dueText);
    if (isOverdue(task)) {
      dueSpan.style.color = 'var(--danger)';
      dueSpan.style.fontWeight = '600';
    }
    dueCell.appendChild(dueSpan);
    row.appendChild(dueCell);

    var createdCell = document.createElement('td');
    createdCell.textContent = formatDate(task.created_at);
    row.appendChild(createdCell);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);
  area.appendChild(wrapper);
}

var currentSortKey = null;
var currentSortDir = 'asc';

function sortTaskTable(key, area) {
  if (currentSortKey === key) {
    currentSortDir = currentSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    currentSortKey = key;
    currentSortDir = 'asc';
  }

  state.tasks.sort(function(a, b) {
    var aVal = a[key] || '';
    var bVal = b[key] || '';
    if (typeof aVal === 'string') aVal = aVal.toLowerCase();
    if (typeof bVal === 'string') bVal = bVal.toLowerCase();
    var result = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
    return currentSortDir === 'desc' ? -result : result;
  });

  renderProjectView(area);
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
  var dueSpan = createEl('span', 'task-card-due', formatDate(task.due_date));
  if (isOverdue(task)) {
    dueSpan.style.color = 'var(--danger)';
    dueSpan.style.fontWeight = '600';
  }
  meta.appendChild(dueSpan);
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
    var area = document.getElementById('content-area');
    if (area) renderProjectView(area);
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
        var area = document.getElementById('content-area');
        if (area) renderProjectView(area);
        showToast('Task moved to ' + getStatusLabel(newStatus), 'success');
      } catch (err) {
        showToast('Failed to move task: ' + err.message, 'error');
      }
    });
  });
}

// --------------- My Tasks View ---------------
function renderMyTasksView(area) {
  clearEl(area);

  // Filter bar
  var filterBar = createEl('div', 'filter-bar');

  filterBar.appendChild(createEl('span', 'filter-label', 'Filter:'));

  var statusFilter = document.createElement('select');
  statusFilter.id = 'filter-status';
  var statusOpts = [['', 'All Statuses'], ['todo', 'To Do'], ['in_progress', 'In Progress'], ['review', 'Review'], ['done', 'Done']];
  statusOpts.forEach(function(pair) {
    var opt = document.createElement('option');
    opt.value = pair[0];
    opt.textContent = pair[1];
    statusFilter.appendChild(opt);
  });
  filterBar.appendChild(statusFilter);

  var prioFilter = document.createElement('select');
  prioFilter.id = 'filter-priority';
  var prioOpts = [['', 'All Priorities'], ['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['critical', 'Critical']];
  prioOpts.forEach(function(pair) {
    var opt = document.createElement('option');
    opt.value = pair[0];
    opt.textContent = pair[1];
    prioFilter.appendChild(opt);
  });
  filterBar.appendChild(prioFilter);

  area.appendChild(filterBar);

  // Tasks table
  var tableContainer = createEl('div', '');
  tableContainer.id = 'my-tasks-table';
  area.appendChild(tableContainer);

  function renderFilteredTasks() {
    var statusVal = statusFilter.value;
    var prioVal = prioFilter.value;

    var filtered = state.tasks.filter(function(t) {
      if (statusVal && t.status !== statusVal) return false;
      if (prioVal && t.priority !== prioVal) return false;
      return true;
    });

    clearEl(tableContainer);

    if (filtered.length === 0) {
      var empty = createEl('div', 'empty-state');
      var emptyShape = createEl('div', 'empty-shape');
      emptyShape.appendChild(createEl('div', 'shape-circle'));
      empty.appendChild(emptyShape);
      empty.appendChild(createEl('h3', '', 'No tasks found'));
      empty.appendChild(createEl('p', '', 'Try adjusting your filters or create a new task'));
      tableContainer.appendChild(empty);
      return;
    }

    var wrapper = createEl('div', 'data-table-wrapper');
    var table = createEl('table', 'data-table');

    var thead = document.createElement('thead');
    var headerRow = document.createElement('tr');
    ['Title', 'Project', 'Status', 'Priority', 'Due Date'].forEach(function(col) {
      var th = document.createElement('th');
      th.textContent = col;
      th.appendChild(createEl('span', 'sort-indicator', '↕'));
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    var tbody = document.createElement('tbody');
    filtered.forEach(function(task) {
      var row = document.createElement('tr');

      var titleCell = document.createElement('td');
      var titleLink = createEl('span', 'cell-title', task.title);
      titleLink.addEventListener('click', function() { openTaskDetailModal(task); });
      titleCell.appendChild(titleLink);
      row.appendChild(titleCell);

      var projCell = document.createElement('td');
      var projName = state.currentProject ? state.currentProject.name : '—';
      projCell.textContent = task.projectName || projName;
      row.appendChild(projCell);

      var statusCell = document.createElement('td');
      statusCell.appendChild(createEl('span', 'status-badge status-' + task.status, getStatusLabel(task.status)));
      row.appendChild(statusCell);

      var prioCell = document.createElement('td');
      prioCell.appendChild(createEl('span', 'task-priority ' + getPriorityClass(task.priority), task.priority));
      row.appendChild(prioCell);

      var dueCell = document.createElement('td');
      var dueSpan = createEl('span', '', formatDate(task.due_date));
      if (isOverdue(task)) {
        dueSpan.style.color = 'var(--danger)';
        dueSpan.style.fontWeight = '600';
      }
      dueCell.appendChild(dueSpan);
      row.appendChild(dueCell);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    wrapper.appendChild(table);
    tableContainer.appendChild(wrapper);
  }

  statusFilter.addEventListener('change', renderFilteredTasks);
  prioFilter.addEventListener('change', renderFilteredTasks);

  renderFilteredTasks();
}

// --------------- Team View ---------------
async function renderTeamView(area) {
  clearEl(area);

  // Invite form
  var inviteSection = createEl('div', 'invite-form');
  var emailGroup = createEl('div', 'form-group');
  emailGroup.appendChild(createEl('label', '', 'Invite Team Member'));
  var inviteInput = document.createElement('input');
  inviteInput.type = 'email';
  inviteInput.placeholder = 'colleague@company.com';
  emailGroup.appendChild(inviteInput);
  inviteSection.appendChild(emailGroup);

  var roleGroup = createEl('div', 'form-group');
  roleGroup.appendChild(createEl('label', '', 'Role'));
  var roleSelect = document.createElement('select');
  ['Member', 'Admin', 'Viewer'].forEach(function(role) {
    var opt = document.createElement('option');
    opt.value = role.toLowerCase();
    opt.textContent = role;
    roleSelect.appendChild(opt);
  });
  roleGroup.appendChild(roleSelect);
  inviteSection.appendChild(roleGroup);

  var inviteBtn = createEl('button', 'btn btn-primary', 'Send Invite');
  inviteBtn.style.alignSelf = 'flex-end';
  inviteBtn.addEventListener('click', function() {
    var email = inviteInput.value.trim();
    if (!email) {
      showToast('Please enter an email address', 'error');
      return;
    }
    showToast('Invitation sent to ' + email, 'success');
    inviteInput.value = '';
  });
  inviteSection.appendChild(inviteBtn);
  area.appendChild(inviteSection);

  // Team grid
  if (state.users.length === 0) {
    await fetchUsers();
  }

  var users = state.users.length > 0 ? state.users : (state.user ? [state.user] : []);

  var teamGrid = createEl('div', 'team-grid');

  users.forEach(function(user) {
    var card = createEl('div', 'team-card');

    var avatar = createEl('div', 'user-avatar user-avatar-lg');
    avatar.textContent = getInitials(user.name);
    card.appendChild(avatar);

    card.appendChild(createEl('div', 'team-name', user.name || 'Unknown'));
    card.appendChild(createEl('div', 'team-email', user.email || ''));

    var roleBadge = createEl('span', 'badge badge-primary team-role', user.role || 'Member');
    card.appendChild(roleBadge);

    var stats = createEl('div', 'team-stats');
    var taskCount = state.tasks.filter(function(t) { return t.assigned_to === user.id; }).length;
    stats.textContent = taskCount + ' tasks assigned';
    card.appendChild(stats);

    teamGrid.appendChild(card);
  });

  area.appendChild(teamGrid);
}

// --------------- Reports View ---------------
function renderReportsView(area) {
  clearEl(area);

  // Export buttons
  var exportActions = createEl('div', 'report-actions');

  var csvBtn = createEl('button', 'btn btn-outline', 'Export CSV');
  csvBtn.addEventListener('click', function() {
    if (!state.currentProject) {
      showToast('Select a project first', 'error');
      return;
    }
    exportProject(state.currentProject.id, 'csv').then(function() {
      showToast('CSV exported', 'success');
    }).catch(function(err) {
      showToast('Export failed: ' + err.message, 'error');
    });
  });
  exportActions.appendChild(csvBtn);

  var jsonBtn = createEl('button', 'btn btn-outline', 'Export JSON');
  jsonBtn.addEventListener('click', function() {
    if (!state.currentProject) {
      showToast('Select a project first', 'error');
      return;
    }
    exportProject(state.currentProject.id, 'json');
    showToast('JSON exported', 'success');
  });
  exportActions.appendChild(jsonBtn);

  var mdBtn = createEl('button', 'btn btn-outline', 'Export Markdown');
  mdBtn.addEventListener('click', function() {
    if (!state.currentProject) {
      showToast('Select a project first', 'error');
      return;
    }
    exportProject(state.currentProject.id, 'markdown');
    showToast('Markdown exported', 'success');
  });
  exportActions.appendChild(mdBtn);

  area.appendChild(exportActions);

  // Charts grid
  var grid = createEl('div', 'dashboard-grid');

  // Velocity chart (bar)
  var velocityCard = createEl('div', 'dashboard-card');
  var velHeader = createEl('div', 'dashboard-card-header');
  velHeader.appendChild(createEl('h3', '', 'Velocity'));
  velocityCard.appendChild(velHeader);

  var velBody = createEl('div', 'dashboard-card-body');
  var velContainer = createEl('div', 'chart-container');
  var velCanvas = document.createElement('canvas');
  velCanvas.id = 'velocity-chart';
  velContainer.appendChild(velCanvas);
  velBody.appendChild(velContainer);
  velocityCard.appendChild(velBody);
  grid.appendChild(velocityCard);

  // Burndown chart (line)
  var burndownCard = createEl('div', 'dashboard-card');
  var burnHeader = createEl('div', 'dashboard-card-header');
  burnHeader.appendChild(createEl('h3', '', 'Burndown'));
  burndownCard.appendChild(burnHeader);

  var burnBody = createEl('div', 'dashboard-card-body');
  var burnContainer = createEl('div', 'chart-container');
  var burnCanvas = document.createElement('canvas');
  burnCanvas.id = 'burndown-chart';
  burnContainer.appendChild(burnCanvas);
  burnBody.appendChild(burnContainer);
  burndownCard.appendChild(burnBody);
  grid.appendChild(burndownCard);

  // Task distribution (donut)
  var distCard = createEl('div', 'dashboard-card');
  var distHeader = createEl('div', 'dashboard-card-header');
  distHeader.appendChild(createEl('h3', '', 'Task Distribution'));
  distCard.appendChild(distHeader);

  var distBody = createEl('div', 'dashboard-card-body');
  var distContainer = createEl('div', 'chart-container');
  var distCanvas = document.createElement('canvas');
  distCanvas.id = 'distribution-chart';
  distContainer.appendChild(distCanvas);
  distBody.appendChild(distContainer);
  distCard.appendChild(distBody);
  grid.appendChild(distCard);

  // Priority breakdown
  var prioCard = createEl('div', 'dashboard-card');
  var prioHeader = createEl('div', 'dashboard-card-header');
  prioHeader.appendChild(createEl('h3', '', 'Priority Breakdown'));
  prioCard.appendChild(prioHeader);

  var prioBody = createEl('div', 'dashboard-card-body');
  var prioContainer = createEl('div', 'chart-container');
  var prioCanvas = document.createElement('canvas');
  prioCanvas.id = 'priority-chart';
  prioContainer.appendChild(prioCanvas);
  prioBody.appendChild(prioContainer);
  prioCard.appendChild(prioBody);
  grid.appendChild(prioCard);

  area.appendChild(grid);

  // Render charts after DOM is ready
  requestAnimationFrame(function() {
    renderCharts();
  });
}

function renderCharts() {
  if (typeof Charts === 'undefined') return;

  var tasks = state.tasks;

  // Velocity chart — tasks completed per week (sample data)
  var velocityLabels = ['Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5', 'Week 6'];
  var doneTasks = tasks.filter(function(t) { return t.status === 'done'; }).length;
  var velocityValues = [
    Math.max(1, Math.floor(doneTasks * 0.4)),
    Math.max(1, Math.floor(doneTasks * 0.6)),
    Math.max(2, Math.floor(doneTasks * 0.8)),
    Math.max(1, Math.floor(doneTasks * 0.5)),
    Math.max(2, Math.floor(doneTasks * 0.9)),
    doneTasks,
  ];

  Charts.drawBarChart('velocity-chart', {
    labels: velocityLabels,
    datasets: [{ label: 'Completed', values: velocityValues, color: '#6366f1' }],
  }, { title: 'Tasks Completed Per Week', yLabel: 'Tasks', showGrid: true });

  // Burndown chart
  var totalTasks = tasks.length || 10;
  var burnLabels = ['Day 1', 'Day 3', 'Day 5', 'Day 7', 'Day 9', 'Day 11', 'Day 14'];
  var idealBurn = burnLabels.map(function(_, i) {
    return Math.max(0, Math.round(totalTasks - (totalTasks / (burnLabels.length - 1)) * i));
  });
  var actualBurn = idealBurn.map(function(v, i) {
    if (i === 0) return totalTasks;
    var variance = Math.floor(Math.random() * 3) - 1;
    return Math.max(0, v + variance + Math.floor(i * 0.3));
  });

  Charts.drawLineChart('burndown-chart', {
    labels: burnLabels,
    datasets: [
      { label: 'Ideal', values: idealBurn, color: '#e5e7eb' },
      { label: 'Actual', values: actualBurn, color: '#6366f1' },
    ],
  }, { title: 'Sprint Burndown', yLabel: 'Remaining Tasks', smooth: true, fill: true });

  // Distribution donut
  var statusCounts = {
    todo: tasks.filter(function(t) { return t.status === 'todo'; }).length || 3,
    in_progress: tasks.filter(function(t) { return t.status === 'in_progress'; }).length || 2,
    review: tasks.filter(function(t) { return t.status === 'review'; }).length || 1,
    done: tasks.filter(function(t) { return t.status === 'done'; }).length || 4,
  };

  Charts.drawDonutChart('distribution-chart', {
    labels: ['To Do', 'In Progress', 'Review', 'Done'],
    values: [statusCounts.todo, statusCounts.in_progress, statusCounts.review, statusCounts.done],
    colors: ['#3b82f6', '#f59e0b', '#6366f1', '#10b981'],
  }, { title: 'Status Distribution', centerLabel: String(tasks.length || 10) });

  // Priority breakdown bar chart
  var prioCounts = {
    low: tasks.filter(function(t) { return t.priority === 'low'; }).length || 2,
    medium: tasks.filter(function(t) { return t.priority === 'medium'; }).length || 5,
    high: tasks.filter(function(t) { return t.priority === 'high'; }).length || 3,
    critical: tasks.filter(function(t) { return t.priority === 'critical'; }).length || 1,
  };

  Charts.drawBarChart('priority-chart', {
    labels: ['Low', 'Medium', 'High', 'Critical'],
    datasets: [{ label: 'Tasks', values: [prioCounts.low, prioCounts.medium, prioCounts.high, prioCounts.critical] }],
  }, { title: 'Priority Breakdown', yLabel: 'Count', showGrid: true });
}

// --------------- Settings View ---------------
function renderSettingsView(area) {
  clearEl(area);

  // Profile section
  var profileSection = createEl('div', 'settings-section');
  profileSection.appendChild(createEl('h3', '', 'Profile'));

  var profileForm = document.createElement('form');
  profileForm.addEventListener('submit', function(e) { e.preventDefault(); });

  var profileRow = createEl('div', 'settings-row');

  var nameGroup = createEl('div', 'form-group');
  nameGroup.appendChild(createEl('label', '', 'Full Name'));
  var nameInput = document.createElement('input');
  nameInput.type = 'text';
  nameInput.value = state.user ? state.user.name : '';
  nameInput.placeholder = 'Your name';
  nameGroup.appendChild(nameInput);
  profileRow.appendChild(nameGroup);

  var emailGroup = createEl('div', 'form-group');
  emailGroup.appendChild(createEl('label', '', 'Email'));
  var emailInput = document.createElement('input');
  emailInput.type = 'email';
  emailInput.value = state.user ? state.user.email : '';
  emailInput.placeholder = 'Your email';
  emailGroup.appendChild(emailInput);
  profileRow.appendChild(emailGroup);

  profileForm.appendChild(profileRow);

  var saveProfileBtn = createEl('button', 'btn btn-primary', 'Update Profile');
  saveProfileBtn.style.marginTop = '1rem';
  saveProfileBtn.addEventListener('click', async function() {
    try {
      await api('PATCH', '/auth/me', {
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
      });
      if (state.user) {
        state.user.name = nameInput.value.trim();
        state.user.email = emailInput.value.trim();
      }
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast('Failed to update profile: ' + err.message, 'error');
    }
  });
  profileForm.appendChild(saveProfileBtn);
  profileSection.appendChild(profileForm);
  area.appendChild(profileSection);

  // Password section
  var passwordSection = createEl('div', 'settings-section');
  passwordSection.appendChild(createEl('h3', '', 'Change Password'));

  var passwordForm = document.createElement('form');
  passwordForm.addEventListener('submit', function(e) { e.preventDefault(); });

  var currentPassGroup = createEl('div', 'form-group');
  currentPassGroup.appendChild(createEl('label', '', 'Current Password'));
  var currentPassInput = document.createElement('input');
  currentPassInput.type = 'password';
  currentPassInput.placeholder = 'Enter current password';
  currentPassGroup.appendChild(currentPassInput);
  passwordForm.appendChild(currentPassGroup);

  var passRow = createEl('div', 'settings-row');

  var newPassGroup = createEl('div', 'form-group');
  newPassGroup.appendChild(createEl('label', '', 'New Password'));
  var newPassInput = document.createElement('input');
  newPassInput.type = 'password';
  newPassInput.placeholder = 'At least 8 characters';
  newPassGroup.appendChild(newPassInput);
  var newPassHelper = createEl('div', 'helper-text', 'Must be at least 8 characters');
  newPassGroup.appendChild(newPassHelper);
  passRow.appendChild(newPassGroup);

  var confirmPassGroup = createEl('div', 'form-group');
  confirmPassGroup.appendChild(createEl('label', '', 'Confirm Password'));
  var confirmPassInput = document.createElement('input');
  confirmPassInput.type = 'password';
  confirmPassInput.placeholder = 'Re-enter new password';
  confirmPassGroup.appendChild(confirmPassInput);
  passRow.appendChild(confirmPassGroup);

  passwordForm.appendChild(passRow);

  // Validation
  newPassInput.addEventListener('input', function() {
    if (newPassInput.value.length > 0 && newPassInput.value.length < 8) {
      newPassInput.classList.add('input-error');
      newPassHelper.classList.add('error');
      newPassHelper.textContent = 'Password is too short';
    } else if (newPassInput.value.length >= 8) {
      newPassInput.classList.remove('input-error');
      newPassHelper.classList.remove('error');
      newPassHelper.classList.add('success');
      newPassHelper.textContent = 'Password strength: Good';
    } else {
      newPassInput.classList.remove('input-error');
      newPassHelper.classList.remove('error', 'success');
      newPassHelper.textContent = 'Must be at least 8 characters';
    }
  });

  var changePassBtn = createEl('button', 'btn btn-primary', 'Change Password');
  changePassBtn.style.marginTop = '1rem';
  changePassBtn.addEventListener('click', async function() {
    var currentPass = currentPassInput.value;
    var newPass = newPassInput.value;
    var confirmPass = confirmPassInput.value;

    if (!currentPass) {
      showToast('Please enter your current password', 'error');
      return;
    }
    if (newPass.length < 8) {
      showToast('New password must be at least 8 characters', 'error');
      return;
    }
    if (newPass !== confirmPass) {
      showToast('Passwords do not match', 'error');
      confirmPassInput.classList.add('input-error');
      return;
    }

    try {
      await api('POST', '/auth/change-password', {
        currentPassword: currentPass,
        newPassword: newPass,
      });
      showToast('Password changed successfully', 'success');
      currentPassInput.value = '';
      newPassInput.value = '';
      confirmPassInput.value = '';
    } catch (err) {
      showToast('Failed to change password: ' + err.message, 'error');
    }
  });
  passwordForm.appendChild(changePassBtn);
  passwordSection.appendChild(passwordForm);
  area.appendChild(passwordSection);

  // Danger zone
  var dangerSection = createEl('div', 'settings-section');
  dangerSection.appendChild(createEl('h3', '', 'Danger Zone'));

  var dangerInfo = createEl('p', '', 'Permanently delete your account and all associated data.');
  dangerInfo.style.fontSize = '0.88rem';
  dangerInfo.style.color = 'var(--text-muted)';
  dangerInfo.style.marginBottom = '1rem';
  dangerSection.appendChild(dangerInfo);

  var deleteAccountBtn = createEl('button', 'btn btn-danger', 'Delete Account');
  deleteAccountBtn.addEventListener('click', function() {
    if (!confirm('Are you sure you want to delete your account? This action cannot be undone.')) return;
    showToast('Account deletion is not yet implemented', 'info');
  });
  dangerSection.appendChild(deleteAccountBtn);
  area.appendChild(dangerSection);
}

// --------------- Search ---------------
async function performSearch(query) {
  if (!query || query.length < 2) return;

  var dropdown = document.getElementById('search-dropdown');
  if (!dropdown) return;

  // Show loading
  clearEl(dropdown);
  var loadingEl = createEl('div', 'search-no-results', 'Searching...');
  dropdown.appendChild(loadingEl);
  dropdown.style.display = 'block';

  try {
    var results = await searchTasks(query);
    state.searchResults = results;
    clearEl(dropdown);

    if (results.length === 0) {
      var noResults = createEl('div', 'search-no-results', 'No results found for "' + query + '"');
      dropdown.appendChild(noResults);
    } else {
      results.slice(0, 10).forEach(function(task) {
        var item = createEl('div', 'search-result-item');
        item.addEventListener('click', function() {
          openTaskDetailModal(task);
          dropdown.style.display = 'none';
        });

        var info = createEl('div', '');
        info.appendChild(createEl('div', 'result-title', task.title));
        var metaText = getStatusLabel(task.status) + ' · ' + task.priority;
        if (task.projectName) metaText += ' · ' + task.projectName;
        info.appendChild(createEl('div', 'result-meta', metaText));
        item.appendChild(info);

        dropdown.appendChild(item);
      });
    }
  } catch (err) {
    clearEl(dropdown);
    dropdown.appendChild(createEl('div', 'search-no-results', 'Search failed'));
  }
}

function renderSearchResults(area, results) {
  clearEl(area);

  if (!results || results.length === 0) {
    var empty = createEl('div', 'empty-state');
    empty.appendChild(createEl('div', 'empty-icon', '🔍'));
    empty.appendChild(createEl('h3', '', 'No results'));
    empty.appendChild(createEl('p', '', 'Try a different search term'));
    area.appendChild(empty);
    return;
  }

  var wrapper = createEl('div', 'data-table-wrapper');
  var table = createEl('table', 'data-table');

  var thead = document.createElement('thead');
  var headerRow = document.createElement('tr');
  ['Title', 'Status', 'Priority', 'Due Date'].forEach(function(col) {
    var th = document.createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);
  table.appendChild(thead);

  var tbody = document.createElement('tbody');
  results.forEach(function(task) {
    var row = document.createElement('tr');

    var titleCell = document.createElement('td');
    var titleLink = createEl('span', 'cell-title', task.title);
    titleLink.addEventListener('click', function() { openTaskDetailModal(task); });
    titleCell.appendChild(titleLink);
    row.appendChild(titleCell);

    var statusCell = document.createElement('td');
    statusCell.appendChild(createEl('span', 'status-badge status-' + task.status, getStatusLabel(task.status)));
    row.appendChild(statusCell);

    var prioCell = document.createElement('td');
    prioCell.appendChild(createEl('span', 'task-priority ' + getPriorityClass(task.priority), task.priority));
    row.appendChild(prioCell);

    var dueCell = document.createElement('td');
    dueCell.textContent = formatDate(task.due_date);
    row.appendChild(dueCell);

    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  wrapper.appendChild(table);
  area.appendChild(wrapper);
}

// --------------- Notification Dropdown ---------------
function renderNotificationDropdown(notifications) {
  var dropdown = document.getElementById('notif-dropdown');
  if (!dropdown) return;

  clearEl(dropdown);

  var header = createEl('div', 'notification-dropdown-header');
  header.appendChild(createEl('span', '', 'Notifications'));
  var unread = notifications.filter(function(n) { return !n.read; }).length;
  if (unread > 0) {
    var markAllBtn = createEl('button', 'btn btn-ghost btn-sm', 'Mark all read');
    markAllBtn.addEventListener('click', function() {
      notifications.forEach(function(n) { n.read = true; });
      renderNotificationDropdown(notifications);
      var badge = document.getElementById('notif-badge');
      if (badge) {
        badge.textContent = '0';
        badge.style.display = 'none';
      }
    });
    header.appendChild(markAllBtn);
  }
  dropdown.appendChild(header);

  if (notifications.length === 0) {
    var empty = createEl('div', 'search-no-results', 'No notifications');
    dropdown.appendChild(empty);
    return;
  }

  notifications.forEach(function(notif) {
    var item = createEl('div', 'notification-item' + (notif.read ? '' : ' unread'));

    var iconEl = createEl('span', 'notif-icon', notif.icon || '📌');
    item.appendChild(iconEl);

    var content = createEl('div', 'notif-content');
    content.appendChild(createEl('div', 'notif-text', notif.text || notif.message || ''));
    content.appendChild(createEl('div', 'notif-time', notif.time || timeAgo(notif.created_at) || ''));
    item.appendChild(content);

    item.addEventListener('click', function() {
      notif.read = true;
      item.classList.remove('unread');
      var badge = document.getElementById('notif-badge');
      if (badge) {
        var currentCount = parseInt(badge.textContent) || 0;
        var newCount = Math.max(0, currentCount - 1);
        badge.textContent = String(newCount);
        if (newCount === 0) badge.style.display = 'none';
      }
    });

    dropdown.appendChild(item);
  });
}

// --- Project List ---
function renderProjectList() {
  var list = document.getElementById('project-list');
  if (!list) return;

  clearEl(list);

  state.projects.forEach(function(project) {
    var btn = createEl('button', 'sidebar-item' + (state.currentProject && state.currentProject.id === project.id && state.currentView === 'project' ? ' active' : ''));
    var icon = createEl('span', 'icon', '📁');
    btn.appendChild(icon);
    btn.appendChild(document.createTextNode(' ' + project.name));
    btn.addEventListener('click', function() { selectProject(project); });
    list.appendChild(btn);
  });
}

async function selectProject(project) {
  state.currentProject = project;
  state.currentView = 'project';
  setHash('project');
  updateSidebarActive();
  renderProjectList();

  try {
    await fetchTasks(project.id);
    var area = document.getElementById('content-area');
    if (area) renderProjectView(area);
    updatePageTitle(project.name);
  } catch (err) {
    showToast('Failed to load tasks', 'error');
  }
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
  if (!state.currentProject) {
    showToast('Select a project first', 'error');
    return;
  }

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
      var area = document.getElementById('content-area');
      if (area && state.currentView === 'project') renderProjectView(area);
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
  var dueValue = createEl('div', 'field-value', formatDate(task.due_date));
  if (isOverdue(task)) {
    dueValue.style.color = 'var(--danger)';
    dueValue.style.fontWeight = '600';
  }
  dueField.appendChild(dueValue);
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
