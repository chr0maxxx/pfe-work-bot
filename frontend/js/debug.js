// ===== DEBUG SCREEN =====

let debugAutoRefresh = null;

async function loadDebugScreen() {
  console.log("Loading debug screen...");

  try {
    const response = await api.getLogs();

    if (response.error) {
      notify("Ошибка: " + response.error, "error");
      return;
    }

    state.logs = response.logs || [];

    // Запускаем автообновление
    startDebugAutoRefresh();
  } catch (error) {
    console.error("Error loading logs:", error);
    notify("Ошибка загрузки логов", "error");
  }
}

function renderDebug() {
  const logs = state.logs || [];

  return `
        <div class="screen-title">🔍 Журнал действий</div>
        
        <div class="filter-row">
            <select class="form-select" id="logFilter" onchange="filterLogs()">
                <option value="all">Все действия</option>
                <option value="CREATED">Создание</option>
                <option value="UPDATED">Обновление</option>
                <option value="DELETED">Удаление</option>
                <option value="COMPLETED">Завершение</option>
                <option value="PAYMENT">Финансы</option>
                <option value="SESSION">Сессии</option>
                <option value="SETTINGS">Настройки</option>
                <option value="REQUISITES">Реквизиты</option>
                <option value="UNAUTHORIZED">Неавторизованные</option>
            </select>
            <button class="btn btn-secondary btn-sm" onclick="refreshLogs()">🔄</button>
            <button class="btn btn-danger btn-sm" onclick="clearLogs()">🗑️</button>
        </div>
        
        <div class="card card-static" style="margin-bottom:16px">
            <label class="checkbox-row">
                <input type="checkbox" ${state.autoRefresh ? "checked" : ""} onchange="toggleAutoRefresh(this.checked)">
                <span>Автообновление (каждые 5 сек)</span>
            </label>
            <div style="font-size:12px;color:var(--text-dim);margin-top:4px" id="lastUpdateTime">
                Последнее обновление: ${new Date().toLocaleTimeString("ru-RU")}
            </div>
        </div>
        
        <div id="logsList">
            ${logs.length > 0 ? logs.slice().reverse().map(renderLogEntry).join("") : '<div class="empty-state">Нет записей</div>'}
        </div>
    `;
}

function renderLogEntry(log) {
  // Парсим лог: [timestamp] [user_id] ACTION entity_id details
  const match = log.match(/\[(.*?)\] \[(.*?)\] (\w+) (.*)/);

  if (!match) {
    return `<div class="log-entry"><div class="log-data">${log}</div></div>`;
  }

  const [, timestamp, userId, action, details] = match;
  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString("ru-RU");
  const dateStr = date.toLocaleDateString("ru-RU");

  // Определяем категорию
  let category = "info";
  let icon = "ℹ️";

  if (action.includes("CREATED")) {
    category = "created";
    icon = "➕";
  } else if (action.includes("UPDATED_SETTINGS")) {
    category = "settings";
    icon = "⚙️";
  } else if (action.includes("UPDATED_REQUISITES")) {
    category = "settings";
    icon = "💳";
  } else if (action.includes("UPDATED")) {
    category = "updated";
    icon = "✏️";
  } else if (action.includes("DELETED")) {
    category = "deleted";
    icon = "🗑️";
  } else if (action.includes("COMPLETED")) {
    category = "completed";
    icon = "✅";
  } else if (action.includes("PAYMENT") || action.includes("PAYOUT")) {
    category = "finance";
    icon = "💰";
  } else if (action.includes("SESSION")) {
    category = "session";
    icon = "🔑";
  } else if (action.includes("UNAUTHORIZED")) {
    category = "unauthorized";
    icon = "⛔";
  } else if (action.includes("CLEARED")) {
    category = "deleted";
    icon = "🧹";
  }

  // Имя пользователя
  const userNames = {
    u_001: "Макс (Админ)",
    u_002: "Макс (Рабочий)",
    u_003: "Андрей",
    u_004: "Лев",
    system: "Система",
    unknown: "Неизвестный",
  };
  const userName = userNames[userId] || userId;

  return `
        <div class="log-entry type-${category}">
            <div class="log-header">
                <div class="log-type">${icon} ${action}</div>
                <div class="log-time">${timeStr} • ${dateStr}</div>
            </div>
            <div class="log-user">👤 ${userName}</div>
            <div class="log-data">${details}</div>
        </div>
    `;
}

async function refreshLogs() {
  try {
    const response = await api.getLogs();
    state.logs = response.logs || [];
    await render();

    const timeEl = $("#lastUpdateTime");
    if (timeEl) {
      timeEl.textContent =
        "Последнее обновление: " + new Date().toLocaleTimeString("ru-RU");
    }
  } catch (error) {
    notify("Ошибка обновления", "error");
  }
}

function filterLogs() {
  const filter = $("#logFilter").value;
  const logs = state.logs || [];

  let filtered = logs;
  if (filter !== "all") {
    filtered = logs.filter((log) => log.includes(filter));
  }

  const logsList = $("#logsList");
  if (logsList) {
    logsList.innerHTML =
      filtered.length > 0
        ? filtered.slice().reverse().map(renderLogEntry).join("")
        : '<div class="empty-state">Нет записей</div>';
  }
}

async function clearLogs() {
  if (!confirm("Очистить все логи? Это действие нельзя отменить.")) return;

  try {
    const response = await api.clearLogs();

    if (response.success) {
      notify("Логи очищены");
      await refreshLogs();
    } else {
      notify("Ошибка: " + (response.error || "Не удалось очистить"), "error");
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}

function toggleAutoRefresh(enabled) {
  state.autoRefresh = enabled;

  if (enabled) {
    startDebugAutoRefresh();
  } else {
    stopDebugAutoRefresh();
  }
}

function startDebugAutoRefresh() {
  stopDebugAutoRefresh();

  if (state.autoRefresh && state.currentScreen === "debug") {
    debugAutoRefresh = setInterval(refreshLogs, 5000);
  }
}

function stopDebugAutoRefresh() {
  if (debugAutoRefresh) {
    clearInterval(debugAutoRefresh);
    debugAutoRefresh = null;
  }
}
