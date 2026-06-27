// ===== PROJECTS SCREEN =====

function renderProjects() {
  const user = state.currentUser;
  const projects = state.projects || [];
  const canCreate = user.role === "manager" || user.role === "admin";

  const active = projects.filter(
    (p) => p.status === "active" || p.status === "in_progress",
  );
  const closed = projects.filter(
    (p) => p.status === "completed" || p.status === "closed",
  );

  return `
        <div class="screen-title">
            <span>📁 Проекты</span>
            ${canCreate ? '<button class="btn btn-primary btn-sm" onclick="openCreateProjectModal()">➕ Создать</button>' : ""}
        </div>
        
        <div class="section-title">Активные проекты</div>
        ${active.map((p) => renderProjectCard(p)).join("")}
        ${active.length === 0 ? '<div class="empty-state">Нет активных проектов</div>' : ""}
        
        <div class="section-title">Закрытые проекты</div>
        ${closed.map((p) => renderProjectCard(p)).join("")}
        ${closed.length === 0 ? '<div class="empty-state">Нет закрытых проектов</div>' : ""}
    `;
}

function renderProjectDetail() {
  return `
        <button class="back-btn" onclick="backToProjects()">← Назад</button>
        <div class="empty-state">
            <div class="empty-state-icon">📁</div>
            <div>Детали проекта (в разработке)</div>
        </div>
    `;
}

function backToProjects() {
  state.selectedProject = null;
  render();
}

function openCreateProjectModal() {
  openModal(`
        <div class="modal-header">
            <div class="modal-title">Создать проект</div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="form-group">
            <label class="form-label">Название проекта</label>
            <input type="text" class="form-input" id="newProjectTitle" placeholder="Например: Сайт для компании">
        </div>
        <div class="form-group">
            <label class="form-label">Имя клиента</label>
            <input type="text" class="form-input" id="newProjectClient" placeholder="ООО Ромашка">
        </div>
        <div class="form-group">
            <label class="form-label">Бюджет (₽)</label>
            <input type="number" class="form-input" id="newProjectBudget" placeholder="50000">
        </div>
        <div class="form-group">
            <label class="form-label">Дедлайн</label>
            <input type="date" class="form-input" id="newProjectDeadline">
        </div>
        <div class="form-group">
            <label class="form-label">Примечания</label>
            <textarea class="form-textarea" id="newProjectNotes" placeholder="Дополнительная информация"></textarea>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            <button class="btn btn-primary" onclick="createProject()">Создать</button>
        </div>
    `);
}

async function createProject() {
  const title = $("#newProjectTitle").value.trim();
  const client = $("#newProjectClient").value.trim();
  const budget = parseInt($("#newProjectBudget").value) || 0;
  const deadline = $("#newProjectDeadline").value;
  const notes = $("#newProjectNotes").value.trim();

  if (!title || !client || !budget) {
    notify("Заполните обязательные поля", "error");
    return;
  }

  try {
    const response = await api.createProject({
      name: title,
      client_name: client,
      total_budget: budget,
      deadline: deadline,
      notes: notes,
    });

    if (response.success) {
      closeModal();
      notify("Проект создан");
      await loadAllData();
      render();
    } else {
      notify(
        "Ошибка: " + (response.error || "Не удалось создать проект"),
        "error",
      );
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}
