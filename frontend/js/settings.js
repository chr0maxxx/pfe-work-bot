// ===== SETTINGS SCREEN =====

let myRequisites = { value: "", desc: "" };
let allRequisites = {};

async function loadSettingsScreen() {
  console.log("Loading settings screen...");

  try {
    // Загружаем свои реквизиты
    const myReqResponse = await api.getRequisites();
    const user = state.currentUser;

    if (myReqResponse.requisites) {
      myRequisites = myReqResponse.requisites[user.id] || {
        value: "",
        desc: "",
      };
      allRequisites = myReqResponse.requisites;
    }
  } catch (error) {
    console.error("Error loading settings:", error);
  }
}

function renderSettings() {
  const user = state.currentUser;
  const isAdmin = user.role === "admin";

  return `
        <div class="screen-title">⚙️ Настройки</div>
        
        <div class="settings-section">
            <div class="settings-title">🎨 Цветовое оформление</div>
            <div class="theme-grid">
                ${renderThemeOption("whiskey", "Виски 🥃", ["#150C0C", "#34150F", "#D39858", "#85431E"])}
                ${renderThemeOption("vodka", "Водка 🍸", ["#0d0e20", "#2d1c7f", "#7546e8", "#c8b3f6"])}
                ${renderThemeOption("mojito", "Мохито 🍃", ["#0b453a", "#2fa98c", "#00df81", "#aac8c4"])}
                ${renderThemeOption("nemiroff", "Немирофф 🍷", ["#1e1e27", "#28242a", "#df0139", "#512376"])}
            </div>
        </div>
        
        <div class="settings-section">
            <div class="settings-title">💳 Мои реквизиты</div>
            <div class="form-group">
                <label class="form-label">Реквизиты для перевода</label>
                <input type="text" class="form-input" id="myRequisite" 
                       value="${myRequisites.value}" 
                       placeholder="Номер карты, телефон, email...">
            </div>
            <div class="form-group">
                <label class="form-label">Описание (для Льва)</label>
                <input type="text" class="form-input" id="myRequisiteDesc" 
                       value="${myRequisites.desc}" 
                       placeholder="Например: На Сбербанк">
            </div>
            <button class="btn btn-primary btn-block" onclick="saveMyRequisites()">Сохранить</button>
        </div>
        
        ${
          isAdmin
            ? `
            <div class="settings-section">
                <div class="settings-title">🏦 Реквизиты общака</div>
                <div class="form-group">
                    <label class="form-label">Реквизиты</label>
                    <input type="text" class="form-input" id="obshakRequisite" 
                           value="${allRequisites.obshak?.value || ""}" 
                           placeholder="Номер счёта, карта...">
                </div>
                <div class="form-group">
                    <label class="form-label">Описание</label>
                    <input type="text" class="form-input" id="obshakRequisiteDesc" 
                           value="${allRequisites.obshak?.desc || ""}" 
                           placeholder="Например: Сбербанк бизнес">
                </div>
                <button class="btn btn-primary btn-block" onclick="saveObshakRequisites()">Сохранить</button>
            </div>
            
            <div class="settings-section">
                <div class="settings-title">👥 Реквизиты всех участников</div>
                ${["u_002", "u_003", "u_004"]
                  .map((userId) => {
                    const req = allRequisites[userId] || {
                      value: "Не указаны",
                      desc: "",
                    };
                    const userName = getUserName(userId);

                    return `
                        <div class="requisite-item">
                            <div class="requisite-header">
                                <div class="avatar avatar-sm">${userName.charAt(0)}</div>
                                <span>${userName}</span>
                            </div>
                            <div class="requisite-value">${req.value}</div>
                            ${req.desc ? `<div class="requisite-desc">💬 ${req.desc}</div>` : ""}
                        </div>
                    `;
                  })
                  .join("")}
            </div>
        `
            : ""
        }
    `;
}

async function setTheme(theme) {
  state.currentTheme = theme;
  document.body.dataset.theme = theme;

  // Сохраняем в settings
  try {
    const response = await api.updateSettings({ theme: theme });
    if (response.success) {
      notify("Тема изменена");
    } else {
      notify("Ошибка сохранения темы", "error");
    }
  } catch (error) {
    console.error("Error saving theme:", error);
  }
}

function renderThemeOption(id, label, colors) {
  const isActive = state.currentTheme === id;
  return `
        <div class="theme-option ${isActive ? "active" : ""}" onclick="setTheme('${id}')">
            <div class="theme-preview">
                ${colors.map((c) => `<div class="theme-dot" style="background:${c}"></div>`).join("")}
            </div>
            <div>${label}</div>
        </div>
    `;
}

async function saveMyRequisites() {
  const value = $("#myRequisite").value.trim();
  const desc = $("#myRequisiteDesc").value.trim();

  if (!value) {
    notify("Укажите реквизиты", "error");
    return;
  }

  try {
    const user = state.currentUser;
    const response = await api.updateRequisites({
      requisite: value,
      description: desc,
    });

    if (response.success) {
      notify("Реквизиты сохранены");
      myRequisites = { value, desc };
    } else {
      notify("Ошибка: " + (response.error || "Не удалось сохранить"), "error");
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}

async function saveObshakRequisites() {
  const value = $("#obshakRequisite").value.trim();
  const desc = $("#obshakRequisiteDesc").value.trim();

  if (!value) {
    notify("Укажите реквизиты общака", "error");
    return;
  }

  try {
    // Для общака используем специальный ключ
    const response = await api.updateRequisites({
      requisite: value,
      description: desc,
      is_obshak: true,
    });

    if (response.success) {
      notify("Реквизиты общака сохранены");
    } else {
      notify("Ошибка: " + (response.error || "Не удалось сохранить"), "error");
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}

function getUserName(userId) {
  const names = {
    u_001: "Макс (Админ)",
    u_002: "Максим",
    u_003: "Андрей",
    u_004: "Лев",
  };
  return names[userId] || userId;
}
