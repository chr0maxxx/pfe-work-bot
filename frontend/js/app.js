// ===== APP STATE & INIT =====

const state = {
  currentUser: null,
  currentScreen: "home",
  currentTheme: localStorage.getItem("theme") || "whiskey",
  selectedProject: null,
  taskFilter: { project: "all", assignee: "all" },
  autoRefresh: true,
};

// Navigation config by role
const navConfig = {
  manager: [
    { id: "home", icon: "🏠", label: "Главная" },
    { id: "projects", icon: "📁", label: "Проекты" },
    { id: "payments", icon: "💳", label: "Выплаты" },
    { id: "finance", icon: "💰", label: "Финансы" },
    { id: "settings", icon: "⚙️", label: "Настройки" },
  ],
  developer: [
    { id: "home", icon: "🏠", label: "Главная" },
    { id: "tasks", icon: "📋", label: "Задачи" },
    { id: "finance", icon: "💰", label: "Финансы" },
    { id: "settings", icon: "⚙️", label: "Настройки" },
  ],
  lead_developer: [
    { id: "home", icon: "🏠", label: "Главная" },
    { id: "tasks", icon: "📋", label: "Задачи" },
    { id: "finance", icon: "💰", label: "Финансы" },
    { id: "settings", icon: "⚙️", label: "Настройки" },
  ],
  admin: [
    { id: "home", icon: "🏠", label: "Главная" },
    { id: "projects", icon: "📁", label: "Проекты" },
    { id: "tasks", icon: "📋", label: "Задачи" },
    { id: "finance", icon: "💰", label: "Финансы" },
    { id: "settings", icon: "⚙️", label: "Настройки" },
    { id: "debug", icon: "🔍", label: "Отладка" },
  ],
};

// ===== INITIALIZATION =====

async function init() {
  console.log("=== INIT START ===");

  try {
    // Apply theme
    document.body.dataset.theme = state.currentTheme;

    // Create particles
    createParticles();

    // Authenticate
    await authenticate();

    // Render
    render();

    // Start polling
    startPolling();

    console.log("=== INIT COMPLETE ===");
  } catch (error) {
    console.error("=== INIT ERROR ===", error);
    showError("Ошибка инициализации: " + error.message);
  }
}

async function authenticate() {
  const tg = window.Telegram?.WebApp;
  if (tg) {
    tg.ready();
    tg.expand();
  }

  const initData = tg?.initData || "";

  if (!initData) {
    throw new Error("Telegram initData is missing");
  }

  const response = await api.authTelegram(initData);

  if (!response.success) {
    throw new Error(response.detail || "Authentication failed");
  }

  state.currentUser = response.user;

  // Load additional data
  await loadAllData();
}

async function loadAllData() {
  try {
    // Загружаем проекты
    const projectsData = await api.getProjects();
    state.projects = projectsData.projects || [];
  } catch (e) {
    console.error("Error loading projects:", e);
    state.projects = [];
  }

  try {
    // Загружаем задачи
    const tasksData = await api.getTasks();
    state.tasks = tasksData.tasks || [];
  } catch (e) {
    console.error("Error loading tasks:", e);
    state.tasks = [];
  }
}

function showError(message) {
  const content = $("#main");
  if (content) {
    content.innerHTML = `<div class="error" style="padding:20px;text-align:center;">${message}</div>`;
  }
}

// ===== RENDER =====

function render() {
  const user = state.currentUser;
  if (!user) return;

  // Update header
  const avatar = $("#headerAvatar");
  const name = $("#headerName");
  const role = $("#headerRole");

  if (avatar) avatar.textContent = user.name.charAt(0).toUpperCase();
  if (name) name.textContent = user.name;
  if (role) role.textContent = getRoleName(user.role);

  // Render navbar
  renderNavbar();

  // Render screen
  renderScreen();
}

function renderNavbar() {
  const user = state.currentUser;
  if (!user) return;

  const nav = navConfig[user.role] || navConfig.developer;
  const navbar = $("#navbar");
  if (!navbar) return;

  navbar.innerHTML = nav
    .map(
      (item) => `
        <div class="nav-item ${state.currentScreen === item.id ? "active" : ""}" data-screen="${item.id}">
            <div class="nav-icon">${item.icon}</div>
            <div class="nav-label">${item.label}</div>
        </div>
    `,
    )
    .join("");

  // Используем делегирование событий — навешиваем ОДИН обработчик на navbar
  navbar.onclick = (e) => {
    const navItem = e.target.closest(".nav-item");
    if (!navItem) return;

    const newScreen = navItem.dataset.screen;

    // Останавливаем автообновление отладки, если уходим с экрана
    if (state.currentScreen === "debug" && newScreen !== "debug") {
      if (typeof stopDebugAutoRefresh === "function") {
        stopDebugAutoRefresh();
      }
    }

    state.currentScreen = newScreen;
    state.selectedProject = null;
    render();
  };
}
function renderScreen() {
  const main = $("#main");
  if (!main) return;

  const screen = state.currentScreen;
  let html = "";

  switch (screen) {
    case "home":
      html = renderHomeScreen();
      break;
    case "projects":
      html = state.selectedProject ? renderProjectDetail() : renderProjects();
      break;
    case "tasks":
      loadTasksScreen();
      html = renderTasks();
      break;
    case "payments":
      loadPayoutsScreen();
      html = renderPayments();
      break;
    case "finance":
      loadFinancesScreen();
      html = renderFinance();
      // Навешиваем обработчики после рендера
      setTimeout(attachFinanceHandlers, 0);
      break;
    case "settings":
      html = renderSettings();
      break;
    case "debug":
      loadDebugScreen();
      html = renderDebug();
      break;
  }

  main.innerHTML = html;
}

function getRoleName(role) {
  const roles = {
    admin: "Администратор",
    lead_developer: "Lead Developer",
    developer: "Разработчик",
    manager: "Менеджер",
  };
  return roles[role] || role;
}

// ===== POLLING =====

let lastTimestamp = null;

function startPolling() {
  setInterval(async () => {
    try {
      const response = await api.getUpdates(lastTimestamp);

      if (response.hasUpdates) {
        await loadAllData();
        render();
        lastTimestamp = response.newTimestamp;
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }, 30000);
}

// ===== EVENT LISTENERS =====

document.addEventListener("DOMContentLoaded", () => {
  // Modal overlay close
  const overlay = $("#modalOverlay");
  if (overlay) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) closeModal();
    });
  }

  // Init app
  init();
});
