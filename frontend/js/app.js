// Основная логика приложения

// Глобальные переменные
let currentUser = null;
let currentSettings = null;
let currentScreen = "home";

// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  console.log("Telegram WebApp initialized");
}

// ===== ИНИЦИАЛИЗАЦИЯ =====

async function init() {
  console.log("=== INIT START ===");

  try {
    console.log("Step 1: Authenticating...");
    await authenticate();
    console.log("Step 1: Auth success, user:", currentUser);

    console.log("Step 2: Loading user data...");
    await loadUserData();
    console.log("Step 2: User data loaded");

    console.log("Step 3: Applying settings...");
    applySettings(currentSettings);
    console.log("Step 3: Settings applied");

    console.log("Step 4: Initializing navigation...");
    initNavigation();
    console.log("Step 4: Navigation initialized");

    console.log("Step 5: Showing first screen...");
    showScreen("home");
    console.log("Step 5: Screen shown");

    console.log("Step 6: Starting polling...");
    startPolling();
    console.log("Step 6: Polling started");

    console.log("=== INIT COMPLETE ===");
  } catch (error) {
    console.error("=== INIT ERROR ===", error);
    showError("Ошибка инициализации: " + error.message);
  }
}

// ===== АВТОРИЗАЦИЯ =====

async function authenticate() {
  console.log("Authenticating...");

  const initData = tg?.initData || "";

  if (!initData) {
    throw new Error(
      "Telegram initData is missing. Please open via Telegram bot.",
    );
  }

  const response = await api.authTelegram(initData);

  if (!response.success) {
    throw new Error(response.detail || "Authentication failed");
  }

  currentUser = response.user;
  currentSettings = response.settings;

  console.log("Authenticated as:", currentUser.name, "role:", currentUser.role);
}

// ===== ЗАГРУЗКА ДАННЫХ =====

async function loadUserData() {
  console.log("Loading user data...");
  const data = await api.getMe();

  if (data.error) {
    throw new Error(data.error);
  }

  currentUser = data.user;
  currentSettings = data.settings;
}

// ===== ПРИМЕНЕНИЕ НАСТРОЕК =====

function applySettings(settings) {
  console.log("Applying settings:", settings);

  if (!settings) return;

  const body = document.body;
  body.className = "";

  body.classList.add(`theme-${settings.theme || "dark"}`);
  body.classList.add(`accent-${settings.accent_color || "blue"}`);
  body.classList.add(`font-${settings.font_size || "medium"}`);

  if (settings.disable_glow) body.classList.add("no-glow");
  if (settings.disable_shadows) body.classList.add("no-shadow");

  updateUI();
}

function updateUI() {
  if (!currentUser) return;

  document.getElementById("userName").textContent = currentUser.name;
  document.getElementById("userRole").textContent = getRoleName(
    currentUser.role,
  );
  document.getElementById("avatar").textContent = currentUser.name
    .charAt(0)
    .toUpperCase();
}

// ===== НАВИГАЦИЯ =====

function initNavigation() {
  console.log("Initializing navigation...");

  const navbar = document.getElementById("navbar");

  // Определяем пункты навбара в зависимости от роли
  let navItems = [];

  if (currentUser.role === "manager") {
    // Лев (менеджер)
    navItems = [
      { screen: "home", icon: "🏠", label: "Главная" },
      { screen: "projects", icon: "📁", label: "Проекты" },
      { screen: "payouts", icon: "💳", label: "Выплаты" },
      { screen: "finances", icon: "💰", label: "Финансы" },
      { screen: "settings", icon: "⚙️", label: "Настройки" },
    ];
  } else if (
    currentUser.role === "lead_developer" ||
    currentUser.role === "developer"
  ) {
    // Макс рабочий, Андрей (разработчики)
    navItems = [
      { screen: "home", icon: "🏠", label: "Главная" },
      { screen: "tasks", icon: "📋", label: "Задачи" },
      { screen: "finances", icon: "💰", label: "Финансы" },
      { screen: "settings", icon: "⚙️", label: "Настройки" },
    ];
  } else if (currentUser.role === "admin") {
    // Макс администратор
    navItems = [
      { screen: "home", icon: "🏠", label: "Главная" },
      { screen: "projects", icon: "📁", label: "Проекты" },
      { screen: "tasks", icon: "📋", label: "Задачи" },
      { screen: "finances", icon: "💰", label: "Финансы" },
      { screen: "settings", icon: "⚙️", label: "Настройки" },
      { screen: "debug", icon: "🔍", label: "Отладка" },
    ];
  }

  // Рендерим навбар
  navbar.innerHTML = navItems
    .map(
      (item, index) => `
        <div class="nav-item ${index === 0 ? "active" : ""}" data-screen="${item.screen}">
            <div class="nav-icon">${item.icon}</div>
            <div>${item.label}</div>
        </div>
    `,
    )
    .join("");

  // Добавляем обработчики
  navbar.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", () => {
      const screen = item.dataset.screen;
      showScreen(screen);

      navbar
        .querySelectorAll(".nav-item")
        .forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
    });
  });
}

function showScreen(screenName) {
  console.log("Showing screen:", screenName);

  // Останавливаем автообновление отладки, если уходим с экрана
  if (currentScreen === "debug" && screenName !== "debug") {
    if (typeof stopDebugAutoRefresh === "function") {
      stopDebugAutoRefresh();
    }
  }

  currentScreen = screenName;

  // Скрываем все экраны
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });

  // Показываем нужный экран
  const screen = document.getElementById(`screen-${screenName}`);
  if (screen) {
    screen.classList.add("active");
    loadScreenData(screenName);
  } else {
    console.error("Screen not found:", screenName);
  }
}

async function loadScreenData(screenName) {
  console.log("Loading screen data:", screenName);

  try {
    switch (screenName) {
      case "home":
        if (typeof loadHomeScreen === "function") await loadHomeScreen();
        break;
      case "projects":
        if (typeof loadProjectsScreen === "function")
          await loadProjectsScreen();
        break;
      case "tasks":
        if (typeof loadTasksScreen === "function") await loadTasksScreen();
        break;
      case "payouts":
        if (typeof loadPayoutsScreen === "function") await loadPayoutsScreen();
        break;
      case "finances":
        if (typeof loadFinancesScreen === "function")
          await loadFinancesScreen();
        break;
      case "settings":
        if (typeof loadSettingsScreen === "function")
          await loadSettingsScreen();
        break;
      case "debug":
        if (typeof loadDebugScreen === "function") await loadDebugScreen();
        break;
      default:
        console.error("Unknown screen:", screenName);
    }
  } catch (error) {
    console.error("Error loading screen:", screenName, error);
  }
}

// ===== POLLING =====

let lastTimestamp = null;

async function startPolling() {
  console.log("Starting polling (every 30 seconds)...");

  setInterval(async () => {
    try {
      const response = await api.getUpdates(lastTimestamp);

      if (response.hasUpdates) {
        console.log("Updates received, reloading screen...");
        await loadScreenData(currentScreen);
        lastTimestamp = response.newTimestamp;
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }, 30000);
}

// ===== УТИЛИТЫ =====

function showError(message) {
  console.error("Showing error:", message);
  const content = document.getElementById("content");
  content.innerHTML = `<div class="error">${message}</div>`;
}

function getRoleName(role) {
  const roles = {
    admin: "Администратор",
    lead_developer: "Ведущий разработчик",
    developer: "Разработчик",
    manager: "Менеджер",
  };
  return roles[role] || role;
}

// ===== ЗАПУСК =====

document.addEventListener("DOMContentLoaded", () => {
  console.log("DOM loaded, starting init...");
  init();
});
