// Экран отладки (только для администратора)

let debugAutoRefresh = null;
let debugFilter = "all";

async function loadDebugScreen() {
  console.log("Loading debug screen...");

  const content = document.getElementById("screen-debug");

  content.innerHTML = `
        <div class="debug-container">
            <!-- Заголовок -->
            <div class="debug-header">
                <h2>🔍 Журнал действий</h2>
                <div class="debug-controls">
                    <select id="debug-filter" class="form-select">
                        <option value="all">Все действия</option>
                        <option value="CREATED">Создание</option>
                        <option value="UPDATED">Обновление</option>
                        <option value="DELETED">Удаление</option>
                        <option value="COMPLETED">Завершение</option>
                        <option value="CLIENT_PAYMENT">Оплаты клиента</option>
                        <option value="PAYOUT">Выплаты</option>
                        <option value="SESSION">Сессии</option>
                        <option value="UNAUTHORIZED">Неавторизованные</option>
                        <option value="SETTINGS">Настройки</option>
                        <option value="REQUISITES">Реквизиты</option>
                    </select>
                    <button class="btn btn-secondary" id="btn-refresh-logs">🔄 Обновить</button>
                    <button class="btn btn-danger" id="btn-clear-logs">🗑️ Очистить</button>
                </div>
            </div>
            
            <!-- Автообновление -->
            <div class="debug-auto-refresh">
                <label>
                    <input type="checkbox" id="debug-auto-refresh" checked>
                    Автообновление (каждые 5 сек)
                </label>
                <span id="debug-last-update">Последнее обновление: --</span>
            </div>
            
            <!-- Логи -->
            <div class="debug-logs" id="debug-logs">
                <div class="loading">
                    <div class="loading-spinner"></div>
                    <div>Загрузка логов...</div>
                </div>
            </div>
        </div>
    `;

  // Обработчики
  document.getElementById("debug-filter").addEventListener("change", (e) => {
    debugFilter = e.target.value;
    loadLogs();
  });

  document
    .getElementById("btn-refresh-logs")
    .addEventListener("click", loadLogs);

  document
    .getElementById("btn-clear-logs")
    .addEventListener("click", async () => {
      if (
        confirm(
          "Вы уверены, что хотите очистить все логи? Это действие необратимо.",
        )
      ) {
        await clearLogs();
      }
    });

  document
    .getElementById("debug-auto-refresh")
    .addEventListener("change", (e) => {
      if (e.target.checked) {
        startDebugAutoRefresh();
      } else {
        stopDebugAutoRefresh();
      }
    });

  // Загружаем логи
  await loadLogs();

  // Запускаем автообновление
  startDebugAutoRefresh();
}

async function loadLogs() {
  const logsContainer = document.getElementById("debug-logs");

  try {
    const response = await api.getLogs(debugFilter);

    if (response.error) {
      logsContainer.innerHTML = `<div class="error">${response.error}</div>`;
      return;
    }

    const logs = response.logs || [];

    if (logs.length === 0) {
      logsContainer.innerHTML = `
                <div class="debug-empty">
                    <div class="empty-state-icon">📝</div>
                    <div>Логи пусты</div>
                </div>
            `;
      return;
    }

    // Рендерим логи (новые сверху)
    logsContainer.innerHTML = logs
      .reverse()
      .map((log) => renderLogEntry(log))
      .join("");

    // Обновляем время
    document.getElementById("debug-last-update").textContent =
      `Последнее обновление: ${new Date().toLocaleTimeString("ru-RU")}`;
  } catch (error) {
    console.error("Error loading logs:", error);
    logsContainer.innerHTML = `<div class="error">Ошибка загрузки: ${error.message}</div>`;
  }
}

function renderLogEntry(log) {
  // Парсим лог: [timestamp] [user_id] ACTION entity_id details
  const match = log.match(/\[(.*?)\] \[(.*?)\] (\w+) (.*)/);

  if (!match) {
    return `<div class="log-entry log-unknown">${log}</div>`;
  }

  const [, timestamp, userId, action, details] = match;
  const date = new Date(timestamp);
  const timeStr = date.toLocaleTimeString("ru-RU");
  const dateStr = date.toLocaleDateString("ru-RU");

  // Определяем класс для цветовой подсветки
  let logClass = "log-info";
  let icon = "ℹ️";

  if (action.includes("CREATED")) {
    logClass = "log-created";
    icon = "➕";
  } else if (action.includes("UPDATED_SETTINGS")) {
    logClass = "log-settings";
    icon = "⚙️";
  } else if (action.includes("UPDATED_REQUISITES")) {
    logClass = "log-requisites";
    icon = "💳";
  } else if (action.includes("UPDATED")) {
    logClass = "log-updated";
    icon = "✏️";
  } else if (action.includes("DELETED")) {
    logClass = "log-deleted";
    icon = "🗑️";
  } else if (action.includes("COMPLETED")) {
    logClass = "log-completed";
    icon = "✅";
  } else if (action.includes("PAYMENT") || action.includes("PAYOUT")) {
    logClass = "log-payment";
    icon = "💰";
  } else if (action.includes("SESSION")) {
    logClass = "log-session";
    icon = "🔑";
  } else if (action.includes("UNAUTHORIZED")) {
    logClass = "log-unauthorized";
    icon = "⛔";
  } else if (action.includes("ERROR")) {
    logClass = "log-error";
    icon = "❌";
  } else if (action.includes("CLEARED_LOGS")) {
    logClass = "log-cleared";
    icon = "🧹";
  }

  // Получаем имя пользователя
  const userName = getUserId(userId);

  return `
        <div class="log-entry ${logClass}">
            <div class="log-header">
                <span class="log-icon">${icon}</span>
                <span class="log-action">${action}</span>
                <span class="log-time">${timeStr}</span>
                <span class="log-date">${dateStr}</span>
            </div>
            <div class="log-body">
                <div class="log-user">👤 ${userName} (${userId})</div>
                <div class="log-details">${details}</div>
            </div>
        </div>
    `;
}

function getUserId(userId) {
  // Маппинг ID на имена (можно получать из API)
  const users = {
    u_001: "Макс (Админ)",
    u_002: "Макс (Рабочий)",
    u_003: "Андрей",
    u_004: "Лев",
    system: "Система",
    unknown: "Неизвестный",
  };
  return users[userId] || userId;
}

function startDebugAutoRefresh() {
  stopDebugAutoRefresh();
  debugAutoRefresh = setInterval(loadLogs, 5000); // каждые 5 секунд
}

function stopDebugAutoRefresh() {
  if (debugAutoRefresh) {
    clearInterval(debugAutoRefresh);
    debugAutoRefresh = null;
  }
}

async function clearLogs() {
  try {
    const response = await api.clearLogs();

    if (response.success) {
      console.log("Logs cleared");
      await loadLogs();
    } else {
      alert("Ошибка: " + (response.error || "Не удалось очистить логи"));
    }
  } catch (error) {
    console.error("Error clearing logs:", error);
    alert("Ошибка: " + error.message);
  }
}
