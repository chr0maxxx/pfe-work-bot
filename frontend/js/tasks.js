// Экран задач - заглушка
async function loadTasksScreen() {
  console.log("Tasks screen loading...");
  const content = document.getElementById("screen-tasks");
  content.innerHTML = `
        <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div>Экран задач в разработке</div>
        </div>
    `;
}
