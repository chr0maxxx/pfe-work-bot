// Экран финансов

async function loadFinancesScreen() {
  console.log("Loading finances screen...");

  const content = document.getElementById("screen-finances");
  const userRole = currentUser?.role;

  // Для менеджера - полная финансовая панель
  if (userRole === "manager") {
    await loadFinancesForManager(content);
  }
  // Для разработчиков - их личные финансы
  else if (userRole === "lead_developer" || userRole === "developer") {
    await loadFinancesForDeveloper(content);
  }
  // Для админа - финансы всех участников
  else if (userRole === "admin") {
    await loadFinancesForAdmin(content);
  }
}

async function loadFinancesForManager(content) {
  content.innerHTML = `
        <div class="finances-container">
            <div class="finances-header">
                <h2>💰 Финансы</h2>
                <button class="btn btn-secondary" id="btn-show-requisites">👥 Показать реквизиты</button>
            </div>
            
            <!-- Поступления -->
            <div class="finances-section">
                <h3>📥 Поступления от заказчиков</h3>
                <div class="placeholder-message">
                    Здесь будут поступления от клиентов с указанием проекта и суммы
                </div>
            </div>
            
            <!-- Выплаты в общак -->
            <div class="finances-section">
                <h3>🏦 Выплаты в общак</h3>
                <div class="placeholder-message">
                    Здесь будут расходы из общего котла (15%)
                </div>
            </div>
            
            <!-- Статистика -->
            <div class="finances-section">
                <h3>📊 Статистика</h3>
                <div class="placeholder-message">
                    Общая выручка, расходы, чистая прибыль
                </div>
            </div>
            
            <!-- Ожидаемый доход -->
            <div class="finances-section">
                <h3>⏳ Ожидаемый доход</h3>
                <div class="placeholder-message">
                    Неполученные средства от заказчиков
                </div>
            </div>
        </div>
    `;

  // Обработчик показа реквизитов
  document
    .getElementById("btn-show-requisites")
    .addEventListener("click", async () => {
      alert("Показ реквизитов будет реализован позже");
    });
}

async function loadFinancesForDeveloper(content) {
  content.innerHTML = `
        <div class="finances-container">
            <h2>💰 Мои финансы</h2>
            
            <!-- Сводка -->
            <div class="finances-summary">
                <div class="finance-card">
                    <div class="finance-label">Ожидается к получению</div>
                    <div class="finance-value">0 ₽</div>
                </div>
                <div class="finance-card">
                    <div class="finance-label">Получено</div>
                    <div class="finance-value">0 ₽</div>
                </div>
            </div>
            
            <!-- Список проектов -->
            <div class="finances-projects">
                <h3>По проектам</h3>
                <div class="placeholder-message">
                    Здесь будет список проектов с суммами, которые должен получить исполнитель
                </div>
            </div>
        </div>
    `;
}

async function loadFinancesForAdmin(content) {
  content.innerHTML = `
        <div class="finances-container">
            <h2>💰 Финансы всех участников</h2>
            
            <!-- Лев -->
            <div class="finances-participant">
                <h3>👤 Лев (Менеджер)</h3>
                <div class="placeholder-message">
                    Финансы Льва: поступления, выплаты
                </div>
            </div>
            
            <!-- Общак -->
            <div class="finances-participant">
                <h3>🏦 Общак</h3>
                <div class="placeholder-message">
                    Общий котёл: поступления, расходы
                </div>
            </div>
            
            <!-- Максим -->
            <div class="finances-participant">
                <h3>👤 Максим</h3>
                <div class="placeholder-message">
                    Финансы Максима: ожидаемые, полученные
                </div>
            </div>
            
            <!-- Андрей -->
            <div class="finances-participant">
                <h3>👤 Андрей</h3>
                <div class="placeholder-message">
                    Финансы Андрея: ожидаемые, полученные
                </div>
            </div>
        </div>
    `;
}
