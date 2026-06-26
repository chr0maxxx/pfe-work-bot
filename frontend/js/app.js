// Основная логика приложения

// Глобальные переменные
let currentUser = null;
let currentSettings = null;
let currentScreen = "tasks";

// Инициализация Telegram WebApp
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

// ===== ИНИЦИАЛИЗАЦИЯ =====

async function init() {
  try {
    // Авторизация
    await authenticate();

    // Загрузка данных
    await loadUserData();

    // Применение настроек
    applySettings(currentSettings);

    // Инициализация навигации
    initNavigation();

    // Загрузка первого экрана
    showScreen("tasks");

    // Запуск polling
    startPolling();
  } catch (error) {
    console.error("Init error:", error);
    showError("Ошибка инициализации: " + error.message);
  }
}

// ===== АВТОРИЗАЦИЯ =====

async function authenticate() {
  const initData = tg?.initData || "";

  const response = await api.authTelegram(initData);

  if (!response.success) {
    throw new Error("Authentication failed");
  }

  currentUser = response.user;
  currentSettings = response.settings;
}

// ===== ЗАГРУЗКА ДАННЫХ =====

async function loadUserData() {
  const data = await api.getMe();
  currentUser = data.user;
  currentSettings = data.settings;
}

// ===== ПРИМЕНЕНИЕ НАСТРОЕК =====

function applySettings(settings) {
  if (!settings) return;

  const body = document.body;

  // Тема
  body.className = "";
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
}

// ===== НАВИГАЦИЯ =====

function initNavigation() {
  const navItems = document.querySelectorAll(".nav-item");

  navItems.forEach((item) => {
    item.addEventListener("click", () => {
      const screen = item.dataset.screen;
      showScreen(screen);

      // Обновляем активный пункт
      navItems.forEach((i) => i.classList.remove("active"));
      item.classList.add("active");
    });
  });
}

function showScreen(screenName) {
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
  }
}

async function loadScreenData(screenName) {
  switch (screenName) {
    case "tasks":
      await loadTasksScreen();
      break;
    case "finances":
      await loadFinancesScreen();
      break;
    case "settings":
      await loadSettingsScreen();
      break;
  }
}

// ===== ЗАГРУЗКА ЭКРАНОВ =====

async function loadTasksScreen() {
  // Будет реализовано в tasks.js
  console.log("Loading tasks screen...");
}

async function loadFinancesScreen() {
  // Будет реализовано в finances.js
  console.log("Loading finances screen...");
}

async function loadSettingsScreen() {
  // Будет реализовано в settings.js
  console.log("Loading settings screen...");
}

// ===== POLLING =====

let lastTimestamp = null;

async function startPolling() {
  setInterval(async () => {
    try {
      const response = await api.getUpdates(lastTimestamp);

      if (response.hasUpdates) {
        // Обновляем данные
        await loadUserData();

        // Перезагружаем текущий экран
        await loadScreenData(currentScreen);

        // Обновляем timestamp
        lastTimestamp = response.newTimestamp;
      }
    } catch (error) {
      console.error("Polling error:", error);
    }
  }, 5000); // каждые 5 секунд
}

// ===== УТИЛИТЫ =====

function showError(message) {
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

function formatMoney(amount) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    minimumFractionDigits: 0,
  }).format(amount);
}

// ===== ЗАПУСК =====

document.addEventListener("DOMContentLoaded", init);
