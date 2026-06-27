// Экран настроек

async function loadSettingsScreen() {
  console.log("Loading settings screen...");

  const content = document.getElementById("screen-settings");
  const userRole = currentUser?.role;

  let requisitesSection = "";

  // Для админа - возможность редактировать реквизиты всех
  if (userRole === "admin") {
    requisitesSection = `
            <div class="settings-section">
                <h3>👥 Реквизиты всех участников</h3>
                <div class="placeholder-message">
                    Здесь будут реквизиты и описания всех участников с возможностью редактирования
                </div>
            </div>
        `;
  }
  // Для остальных - только свои реквизиты
  else {
    requisitesSection = `
            <div class="settings-section">
                <h3>💳 Мои реквизиты</h3>
                <div class="form-group">
                    <label class="form-label">Реквизиты для перевода</label>
                    <input type="text" class="form-input" placeholder="Номер карты, телефон, email...">
                </div>
                <div class="form-group">
                    <label class="form-label">Описание (комментарий для Льва)</label>
                    <input type="text" class="form-input" placeholder="Например: На Сбербанк">
                </div>
                <button class="btn btn-primary">Сохранить</button>
            </div>
        `;
  }

  content.innerHTML = `
        <div class="settings-container">
            <h2>⚙️ Настройки</h2>
            
            <!-- Цветовое оформление -->
            <div class="settings-section">
                <h3>🎨 Цветовое оформление</h3>
                <div class="form-group">
                    <label class="form-label">Акцентный цвет</label>
                    <select class="form-select" id="setting-accent-color">
                        <option value="blue">Синий</option>
                        <option value="yellow">Жёлтый</option>
                        <option value="pink">Розовый</option>
                        <option value="green">Зелёный</option>
                    </select>
                </div>
                <button class="btn btn-primary" id="btn-save-theme">Применить</button>
            </div>
            
            <!-- Реквизиты -->
            ${requisitesSection}
            
            <!-- Общак (только для админа) -->
            ${
              userRole === "admin"
                ? `
                <div class="settings-section">
                    <h3>🏦 Реквизиты общака</h3>
                    <div class="form-group">
                        <label class="form-label">Реквизиты общего котла</label>
                        <input type="text" class="form-input" placeholder="Номер счёта, карта...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Описание</label>
                        <input type="text" class="form-input" placeholder="Например: Сбербанк бизнес">
                    </div>
                    <button class="btn btn-primary">Сохранить</button>
                </div>
            `
                : ""
            }
        </div>
    `;

  // Обработчик смены цвета
  document
    .getElementById("btn-save-theme")
    .addEventListener("click", async () => {
      const newColor = document.getElementById("setting-accent-color").value;

      try {
        const response = await api.updateSettings({ accent_color: newColor });

        if (response.success) {
          // Правильно обновляем классы body
          const body = document.body;
          const currentClasses = body.className.split(" ");
          const newClasses = currentClasses
            .filter((cls) => !cls.startsWith("accent-")) // Убираем старый акцент
            .concat(`accent-${newColor}`); // Добавляем новый

          body.className = newClasses.join(" ");

          // Обновляем глобальные настройки
          if (currentSettings) {
            currentSettings.accent_color = newColor;
          }

          // Убираем alert, используем более мягкое уведомление
          showNotification("Цвет изменён!", "success");
        } else {
          showNotification(
            "Ошибка: " + (response.error || "Не удалось сохранить"),
            "error",
          );
        }
      } catch (error) {
        console.error("Error saving settings:", error);
        showNotification("Ошибка: " + error.message, "error");
      }
    });
}
