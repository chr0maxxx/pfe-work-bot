// ===== SETTINGS SCREEN =====

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
            <div class="empty-state">
                <div>Реквизиты (в разработке)</div>
            </div>
        </div>
        
        ${
          isAdmin
            ? `
            <div class="settings-section">
                <div class="settings-title">🏦 Реквизиты общака</div>
                <div class="empty-state">
                    <div>Реквизиты общака (в разработке)</div>
                </div>
            </div>
        `
            : ""
        }
    `;
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
