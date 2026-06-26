// Глобальные переменные
let currentUser = null;
let currentSettings = null;
let currentScreen = "tasks";

// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  console.log("Telegram WebApp initialized");
  console.log("initData:", tg.initData ? "present" : "missing");
} else {
  console.warn("Telegram WebApp not available");
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
    showScreen("tasks");
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
  console.log(
    "initData:",
    initData ? "present (length: " + initData.length + ")" : "empty",
  );

  if (!initData) {
    throw new Error(
      "Telegram initData is missing. Please open via Telegram bot.",
    );
  }

  const response = await api.authTelegram(initData);
  console.log("Auth response:", response);

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
  console.log("User data:", data);

  if (data.error) {
    throw new Error(data.error);
  }

  currentUser = data.user;
  currentSettings = data.settings;
}

// ===== ПРИМЕНЕНИЕ НАСТРОЕК =====

function applySettings(settings) {
  console.log("Applying settings:", settings);

  if (!settings) {
    console.warn("No settings to apply");
    return;
  }

  const body = document.body;

  // Очищаем все классы
  body.className = "";

  // Тема
  body.classList.add(`theme-${settings.theme || "dark"}`);

  // Акцентный цвет
  body.classList.add(`accent-${settings.accent_color || "blue"}`);

  // Размер шрифта
  body.classList.add(`font-${settings.font_size || "medium"}`);

  // Отключение эффектов
  if (settings.disable_glow) {
    body.classList.add("no-glow");
  }

  if (settings.disable_shadows) {
    body.classList.add("no-shadow");
  }

  // Обновляем UI
  updateUI();
}

function updateUI() {
  if (!currentUser) {
    console.warn("No user to update UI");
    return;
  }

  console.log("Updating UI for user:", currentUser.name);

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

  const navItems = document.querySelectorAll(".nav-item");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const screen = item.dataset.screen;
      console.log("Navigation clicked:", screen);
      showScreen(screen);

      // Обновляем активный пункт
      navItems.forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
    });
  });
}

function showScreen(screenName) {
  console.log("Showing screen:", screenName);

  currentScreen = screenName;

  // Скрываем все экраны
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });

  // Показываем нужный экран
  const screen = document.getElementById(`screen-${screenName}`);
  if (screen) {
    screen.classList.add("active");

    // Загружаем данные для экрана
    loadScreenData(screenName);
  } else {
    console.error("Screen not found:", screenName);
  }
}

async function loadScreenData(screenName) {
  console.log("Loading screen data:", screenName);

  try {
    switch (screenName) {
      case "tasks":
        if (typeof loadTasksScreen === "function") {
          await loadTasksScreen();
        } else {
          console.error("loadTasksScreen function not defined");
        }
        break;
      case "finances":
        if (typeof loadFinancesScreen === "function") {
          await loadFinancesScreen();
        } else {
          console.error("loadFinancesScreen function not defined");
        }
        break;
      case "settings":
        if (typeof loadSettingsScreen === "function") {
          await loadSettingsScreen();
        } else {
          console.error("loadSettingsScreen function not defined");
        }
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
  console.log("Starting polling...");

  setInterval(async () => {
    try {
      const response = await api.getUpdates(lastTimestamp);

      if (response.hasUpdates) {
        console.log("Updates received, reloading data...");
        await loadUserData();
        await loadScreenData(currentScreen);
        lastTimestamp = response.newTimestamp;
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }, 5000);
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
