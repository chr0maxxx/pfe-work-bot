// Главная страница

async function loadHomeScreen() {
  console.log("Loading home screen...");

  const content = document.getElementById("screen-home");
  const userRole = currentUser?.role;

  // Для менеджера и админа - показываем проекты
  if (userRole === "manager" || userRole === "admin") {
    await loadHomeForManager(content);
  }
  // Для разработчиков - показываем задачи
  else if (userRole === "lead_developer" || userRole === "developer") {
    await loadHomeForDeveloper(content);
  }
}

async function loadHomeForManager(content) {
  // Плейсхолдер - будет реализовано позже
  content.innerHTML = `
        <div class="home-container">
            <!-- Счётчик процентов -->
            <div class="home-counter">
                <div class="counter-value">0%</div>
                <div class="counter-label">Средний прогресс</div>
            </div>
            
            <!-- Карточки проектов -->
            <div class="home-projects">
                <h3>Активные проекты</h3>
                <div class="placeholder-message">
                    Здесь будут карточки активных проектов с прогресс-барами
                </div>
            </div>
        </div>
    `;
}

async function loadHomeForDeveloper(content) {
  // Плейсхолдер - будет реализовано позже
  content.innerHTML = `
        <div class="home-container">
            <!-- Счётчик процентов -->
            <div class="home-counter">
                <div class="counter-value">0%</div>
                <div class="counter-label">Выполнено задач</div>
            </div>
            
            <!-- Карточки задач -->
            <div class="home-tasks">
                <h3>Активные задачи</h3>
                <div class="placeholder-message">
                    Здесь будут карточки активных задач с проектами и стоимостью
                </div>
            </div>
        </div>
    `;
}
