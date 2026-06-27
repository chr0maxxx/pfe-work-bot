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

async function renderProjectDetail() {
  const projectId = state.selectedProject;
  if (!projectId) return '<div class="empty-state">Проект не выбран</div>';

  try {
    // Загружаем детали проекта
    const projectData = await api.getProject(projectId);
    const project = projectData.project;
    const fractions = projectData.fractions;
    const progress = projectData.progress;

    // Загружаем задачи проекта
    const tasksData = await api.getTasks(projectId);
    const tasks = tasksData.tasks || [];

    const user = state.currentUser;
    const canEdit = user.role === "manager" || user.role === "admin";

    const upcoming = tasks.filter((t) => t.column === "backlog");
    const current = tasks.filter((t) => t.column === "current");
    const done = tasks.filter((t) => t.column === "done");

    const totalCost = tasks.reduce((s, t) => s + t.cost, 0);
    const remaining = fractions.developers_pool - totalCost;

    return `
            <button class="back-btn" onclick="backToProjects()">← Назад</button>
            
            <div class="project-detail-header">
                <div>
                    <div class="project-title" style="font-size:22px">${project.name}</div>
                    <div class="project-client">${project.client_name || "Не указан"}</div>
                </div>
                <div>
                    ${project.status === "active" || project.status === "in_progress" ? '<span class="badge badge-info">В работе</span>' : '<span class="badge badge-success">Завершён</span>'}
                </div>
            </div>
            
            <div class="project-stats">
                <div class="project-stat">
                    <div class="project-stat-label">Бюджет</div>
                    <div class="project-stat-value">${formatMoney(project.total_budget)}</div>
                </div>
                <div class="project-stat">
                    <div class="project-stat-label">Пул разрабов</div>
                    <div class="project-stat-value">${formatMoney(fractions.developers_pool)}</div>
                </div>
                <div class="project-stat">
                    <div class="project-stat-label">Распределено</div>
                    <div class="project-stat-value">${formatMoney(totalCost)}</div>
                </div>
                <div class="project-stat">
                    <div class="project-stat-label">Осталось</div>
                    <div class="project-stat-value" style="color:${remaining < 0 ? "#ff4444" : "var(--accent-1)"}">${formatMoney(remaining)}</div>
                </div>
            </div>
            
            <div style="font-size:13px;margin-bottom:8px">Прогресс: ${progress.progress_percent}% (${progress.done_count}/${progress.total_count} задач)</div>
            <div class="progress-bar" style="margin-bottom:16px;height:14px">
                <div class="progress-fill" style="width:${progress.progress_percent}%"></div>
            </div>
            
            ${project.deadline ? `<div class="project-deadline ${isOverdue(project.deadline) ? "overdue" : ""}" style="margin-bottom:20px">📅 Дедлайн: ${formatDate(project.deadline)}</div>` : ""}
            
            ${project.notes ? `<div style="margin-bottom:20px;padding:12px;background:var(--glass-bg);border-radius:12px;font-size:13px;color:var(--text-dim)"><strong>Примечания:</strong> ${project.notes}</div>` : ""}
            
            ${renderTaskBlock("📥 Предстоящие", upcoming, "backlog", project.id)}
            ${renderTaskBlock("🔄 Текущие", current, "current", project.id)}
            ${renderTaskBlock("✅ Выполненные", done, "done", project.id)}
            
            ${
              canEdit
                ? `
                <div class="action-row" style="margin-top:20px">
                    <button class="btn btn-secondary" onclick="openCreateTaskModalForProject('${project.id}')">➕ Создать задачу</button>
                    ${project.status === "active" || project.status === "in_progress" ? `<button class="btn btn-danger" onclick="closeProject('${project.id}')">🗑️ Закрыть проект</button>` : ""}
                </div>
            `
                : ""
            }
        `;
  } catch (error) {
    console.error("Error loading project detail:", error);
    return `<div class="empty-state">Ошибка загрузки проекта</div>`;
  }
}

function openCreateTaskModalForProject(projectId) {
  state.taskFilter.project = projectId;
  openCreateTaskModal();

  // Устанавливаем выбранный проект
  setTimeout(() => {
    const select = $("#newTaskProject");
    if (select) select.value = projectId;
    updateRemainingAmount();
  }, 100);
}

async function closeProject(projectId) {
  if (!confirm("Закрыть проект? Это действие нельзя отменить.")) return;

  try {
    const response = await api.updateProject(projectId, {
      status: "closed",
    });

    if (response.success) {
      notify("Проект закрыт");
      await loadAllData();
      await render()
      backToProjects();
    } else {
      notify("Ошибка: " + (response.error || "Не удалось закрыть"), "error");
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}

function backToProjects() {
  state.selectedProject = null;
  await render();
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
      await render();
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
