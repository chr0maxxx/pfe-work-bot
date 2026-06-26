// Экран проектов (для менеджера и админа)

async function loadProjectsScreen() {
  console.log("Loading projects screen...");

  const content = document.getElementById("screen-projects");

  content.innerHTML = `
        <div class="projects-container">
            <div class="projects-header">
                <h2>📁 Проекты</h2>
                <button class="btn btn-primary" id="btn-create-project">➕ Создать проект</button>
            </div>
            
            <!-- Активные проекты -->
            <div class="projects-section">
                <h3>Активные проекты</h3>
                <div class="placeholder-message">
                    Здесь будут карточки активных проектов с возможностью редактирования
                </div>
            </div>
            
            <!-- Закрытые проекты -->
            <div class="projects-section">
                <h3>Закрытые проекты</h3>
                <div class="placeholder-message">
                    Здесь будут карточки завершённых проектов
                </div>
            </div>
        </div>
    `;

  // Обработчик создания проекта (пока заглушка)
  document
    .getElementById("btn-create-project")
    .addEventListener("click", () => {
      alert("Создание проекта будет реализовано позже");
    });
}
