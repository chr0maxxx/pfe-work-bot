// ===== TASKS SCREEN =====

function renderTasks() {
  return `
        <div class="screen-title">
            <span>📋 Задачи</span>
            <button class="btn btn-primary btn-sm" onclick="openCreateTaskModal()">➕ Создать</button>
        </div>
        <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <div>Задачи (в разработке)</div>
        </div>
    `;
}

function openCreateTaskModal() {
  notify("Создание задач в разработке");
}

async function completeTask(taskId) {
  try {
    const response = await api.completeTask(taskId);

    if (response.success) {
      notify("Задача выполнена! 🎉");
      await loadAllData();
      render();
    } else {
      notify(
        "Ошибка: " + (response.error || "Не удалось завершить задачу"),
        "error",
      );
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}
