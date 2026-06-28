// ===== PROJECTS SCREEN =====

async function renderProjects() {
  const user = state.currentUser;
  const projects = state.projects || [];
  const canCreate = user.role === "manager" || user.role === "admin";

  const active = projects.filter(
    (p) => p.status === "active" || p.status === "in_progress",
  );
  const closed = projects.filter(
    (p) => p.status === "completed" || p.status === "closed",
  );

  // Ждём рендер всех карточек параллельно
  const activeCards = await Promise.all(
    active.map((p) => renderProjectCard(p)),
  );
  const closedCards = await Promise.all(
    closed.map((p) => renderProjectCard(p)),
  );

  return `
    <div class="screen-title">
      <span>📁 Проекты</span>
      ${canCreate ? '<button class="btn btn-primary btn-sm" id="btnCreateProject">➕ Создать</button>' : ""}
    </div>
    
    <div class="section-title">Активные проекты</div>
    ${activeCards.join("")}
    ${active.length === 0 ? '<div class="empty-state">Нет активных проектов</div>' : ""}
    
    <div class="section-title">Закрытые проекты</div>
    ${closedCards.join("")}
    ${closed.length === 0 ? '<div class="empty-state">Нет закрытых проектов</div>' : ""}
  `;
}

async function renderProjectCard(p) {
  // Загружаем задачи и fractions для этого проекта
  let tasksSum = 0;
  let developersPool = 0;
  let tasksCount = 0;
  let doneCount = 0;

  try {
    const summary = await api.getProject(p.id);
    if (summary && summary.fractions) {
      developersPool = summary.fractions.developers_pool || 0;
    }
    if (summary && summary.tasks) {
      tasksSum = summary.tasks.reduce((s, t) => s + t.cost, 0);
      tasksCount = summary.tasks.length;
      doneCount = summary.tasks.filter((t) => t.status === "done").length;
    }
  } catch (e) {
    console.error(`Error loading project ${p.id}:`, e);
  }

  const remaining = developersPool - tasksSum;
  const progress =
    developersPool > 0 ? Math.round((tasksSum / developersPool) * 100) : 0;

  // Прогресс по исполнителям
  const assignees = {};
  try {
    const tasksData = await api.getTasks(p.id);
    const tasks = tasksData.tasks || [];
    tasks.forEach((t) => {
      if (!assignees[t.assignee_id]) {
        assignees[t.assignee_id] = { total: 0, done: 0 };
      }
      assignees[t.assignee_id].total += t.cost;
      if (t.status === "done") assignees[t.assignee_id].done += t.cost;
    });
  } catch (e) {}

  const assigneeNames = {
    u_002: "Максим",
    u_003: "Андрей",
  };

  const user = state.currentUser;
  const canEdit = user.role === "manager" || user.role === "admin";

  return `
    <div class="card" onclick="openProject('${p.id}')">
      <div class="project-card-header">
        <div style="flex:1;min-width:0">
          <div class="project-title">${p.name}</div>
          <div class="project-client">${p.client_name || "Не указан"}</div>
        </div>
        <div class="project-card-badges">
          ${p.status === "active" || p.status === "in_progress" ? '<span class="badge badge-info">В работе</span>' : ""}
          ${p.status === "completed" || p.status === "closed" ? '<span class="badge badge-success">Завершён</span>' : ""}
        </div>
      </div>
      <div class="project-budget">Бюджет: ${formatMoney(p.total_budget)}</div>
      
      ${Object.keys(assignees)
        .map((uid) => {
          const name = assigneeNames[uid] || uid;
          const data = assignees[uid];
          const pct =
            data.total > 0 ? Math.round((data.done / data.total) * 100) : 0;
          return `
          <div class="progress-row">
            <div class="progress-name">
              <div class="avatar avatar-sm">${name.charAt(0)}</div>
              <span>${name}</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width:${pct}%"></div>
            </div>
            <div class="progress-text">${pct}%</div>
          </div>
        `;
        })
        .join("")}
      
      <div style="margin-top:10px;font-size:13px;color:var(--text-dim)">
        Распределено: ${formatMoney(tasksSum)} из ${formatMoney(developersPool)} • 
        <span style="color:${remaining <= 0 ? "#50c878" : remaining < developersPool * 0.3 ? "#ffa500" : "#ff4444"}">
          Нераспределено: ${formatMoney(remaining)}
        </span>
      </div>
      
      ${p.deadline ? `<div class="project-deadline ${isOverdue(p.deadline) ? "overdue" : ""}">📅 Дедлайн: ${formatDate(p.deadline)}</div>` : ""}
    </div>
  `;
}

async function renderProjectDetail() {
  const projectId = state.selectedProject;
  if (!projectId) return '<div class="empty-state">Проект не выбран</div>';

  try {
    const projectData = await api.getProject(projectId);
    const project = projectData.project;
    const fractions = projectData.fractions;
    const progress = projectData.progress;
    const tasks = projectData.tasks || [];

    const user = state.currentUser;
    const canEdit = user.role === "manager" || user.role === "admin";

    const upcoming = tasks.filter((t) => t.column === "backlog");
    const current = tasks.filter((t) => t.column === "current");
    const done = tasks.filter((t) => t.column === "done");

    const totalCost = tasks.reduce((s, t) => s + t.cost, 0);
    const remaining = fractions.developers_pool - totalCost;

    return `
      <button class="back-btn" id="btnBackToProjects">← Назад</button>
      
      <div class="project-detail-header">
        <div>
          <div class="project-title" style="font-size:22px">${project.name}</div>
          <div class="project-client">${project.client_name || "Не указан"}</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          ${project.status === "active" || project.status === "in_progress" ? '<span class="badge badge-info">В работе</span>' : '<span class="badge badge-success">Завершён</span>'}
          ${canEdit ? `<button class="btn btn-secondary btn-sm" id="btnEditProject">✏️ Редактировать</button>` : ""}
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
          <div class="project-stat-label">Нераспределено</div>
          <div class="project-stat-value" style="color:${remaining <= 0 ? "#50c878" : remaining < fractions.developers_pool * 0.3 ? "#ffa500" : "#ff4444"}">${formatMoney(remaining)}</div>
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
          <button class="btn btn-secondary" id="btnCreateTaskForProject">➕ Создать задачу</button>
          ${project.status === "active" || project.status === "in_progress" ? `<button class="btn btn-danger" id="btnCloseProject">🗑️ Закрыть проект</button>` : ""}
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

function renderTaskBlock(title, tasks, column, projectId) {
  const user = state.currentUser;
  const canDrag = user.role === "lead_developer" || user.role === "admin";

  const assigneeNames = {
    u_002: "Максим",
    u_003: "Андрей",
  };

  return `
    <div class="task-block" data-column="${column}" data-project="${projectId}"
         ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)">
      <div class="task-block-header">
        <span>${title}</span>
        <span class="task-count">${tasks.length}</span>
      </div>
      ${tasks
        .map((t) => {
          const assigneeName = assigneeNames[t.assignee_id] || t.assignee_id;
          const initial = assigneeName.charAt(0);
          const isAssignee = t.assignee_id === user.id;
          const canComplete = isAssignee || user.role === "admin";
          const canEditTask =
            user.role === "lead_developer" || user.role === "admin";

          let actionsHtml = "";
          if (column === "done") {
            if (canComplete)
              actionsHtml += `<button class="btn btn-secondary btn-sm btn-block reopen-task-btn" data-task-id="${t.id}">↩️ Вернуть</button>`;
          } else {
            if (canComplete)
              actionsHtml += `<button class="btn btn-primary btn-sm btn-block complete-task-btn" data-task-id="${t.id}">✅ Выполнено</button>`;
          }
          if (canEditTask) {
            actionsHtml += `<button class="btn btn-secondary btn-sm edit-task-btn" data-task-id="${t.id}" style="flex:1">✏️</button>`;
            actionsHtml += `<button class="btn btn-danger btn-sm delete-task-btn" data-task-id="${t.id}" style="flex:1">🗑️</button>`;
          }

          return `
          <div class="task-card ${column === "done" ? "completed" : ""}" 
               draggable="${canDrag}" data-task-id="${t.id}"
               ondragstart="handleDragStart(event)">
            <div class="task-title">${t.title}</div>
            <div class="task-meta">
              <span class="task-cost">💰 ${formatMoney(t.cost)}</span>
              <span style="display:flex;align-items:center;gap:4px">
                <div class="avatar avatar-sm" style="width:20px;height:20px;font-size:10px">${initial}</div>
                ${assigneeName}
              </span>
            </div>
            <div class="action-row">
              ${actionsHtml}
            </div>
          </div>
        `;
        })
        .join("")}
      ${tasks.length === 0 ? '<div style="text-align:center;padding:12px;color:var(--text-dim);font-size:12px">Пусто</div>' : ""}
    </div>
  `;
}

// ===== ОБРАБОТЧИКИ СОБЫТИЙ =====

function attachProjectHandlers() {
  // Кнопка "Создать проект"
  const btnCreate = document.getElementById("btnCreateProject");
  if (btnCreate) btnCreate.addEventListener("click", openCreateProjectModal);

  // Кнопка "Назад"
  const btnBack = document.getElementById("btnBackToProjects");
  if (btnBack) btnBack.addEventListener("click", backToProjects);

  // Кнопка "Редактировать проект"
  const btnEdit = document.getElementById("btnEditProject");
  if (btnEdit)
    btnEdit.addEventListener("click", () =>
      openEditProjectModal(state.selectedProject),
    );

  // Кнопка "Создать задачу" (в деталях проекта)
  const btnCreateTask = document.getElementById("btnCreateTaskForProject");
  if (btnCreateTask)
    btnCreateTask.addEventListener("click", () =>
      openCreateTaskModalForProject(state.selectedProject),
    );

  // Кнопка "Закрыть проект"
  const btnClose = document.getElementById("btnCloseProject");
  if (btnClose)
    btnClose.addEventListener("click", () =>
      closeProject(state.selectedProject),
    );

  // Кнопки задач
  document.querySelectorAll(".complete-task-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      completeTask(btn.dataset.taskId);
    });
  });

  document.querySelectorAll(".reopen-task-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      reopenTask(btn.dataset.taskId);
    });
  });

  document.querySelectorAll(".edit-task-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openEditTaskModal(btn.dataset.taskId);
    });
  });

  document.querySelectorAll(".delete-task-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteTask(btn.dataset.taskId);
    });
  });
}

// ===== МОДАЛКА СОЗДАНИЯ ЗАДАЧИ (для экрана Проекты) =====

async function openCreateTaskModalForProject(projectId) {
  // Загружаем данные проекта напрямую через API
  let fractions = null;
  let existingTasks = [];

  try {
    const projectData = await api.getProject(projectId);
    fractions = projectData.fractions;
    existingTasks = projectData.tasks || [];
  } catch (e) {
    notify("Ошибка загрузки данных проекта", "error");
    return;
  }

  const tasksSum = existingTasks.reduce((s, t) => s + t.cost, 0);
  const remaining = fractions.developers_pool - tasksSum;

  openModal(`
    <div class="modal-header">
      <div class="modal-title">Создать задачу</div>
      <button class="modal-close modal-close-btn">×</button>
    </div>
    <div class="form-group">
      <label class="form-label">Название задачи</label>
      <input type="text" class="form-input" id="newTaskTitle" placeholder="Например: Разработать дизайн">
    </div>
    <div class="form-group">
      <label class="form-label">Стоимость (₽)</label>
      <input type="number" class="form-input" id="newTaskCost" placeholder="5000" min="0" max="${remaining}">
      <div style="font-size:12px;color:var(--text-dim);margin-top:4px">
        Нераспределено: <strong style="color:${remaining <= 0 ? "#ff4444" : "var(--accent-1)"}">${formatMoney(remaining)}</strong>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Исполнитель</label>
      <select class="form-select" id="newTaskAssignee">
        <option value="u_002">Максим</option>
        <option value="u_003">Андрей</option>
      </select>
    </div>
    <div class="modal-actions">
      <button class="btn btn-secondary modal-cancel-btn">Отмена</button>
      <button class="btn btn-primary" id="btnSubmitTask">Создать</button>
    </div>
  `);

  // Обработчики
  document
    .querySelector(".modal-close-btn")
    .addEventListener("click", closeModal);
  document
    .querySelector(".modal-cancel-btn")
    .addEventListener("click", closeModal);
  document
    .getElementById("btnSubmitTask")
    .addEventListener("click", async () => {
      const title = document.getElementById("newTaskTitle").value.trim();
      const cost = parseInt(document.getElementById("newTaskCost").value) || 0;
      const assigneeId = document.getElementById("newTaskAssignee").value;

      if (!title) {
        notify("Введите название задачи", "error");
        return;
      }
      if (cost <= 0) {
        notify("Введите корректную стоимость", "error");
        return;
      }
      if (cost > remaining) {
        notify(`Превышена сумма! Доступно: ${formatMoney(remaining)}`, "error");
        return;
      }

      try {
        const response = await api.createTask({
          project_id: projectId,
          title: title,
          cost: cost,
          assignee_id: assigneeId,
        });

        if (response.success) {
          closeModal();
          notify("Задача создана");
          await render(); // Перерисовываем экран
        } else {
          notify(
            "Ошибка: " + (response.error || "Не удалось создать"),
            "error",
          );
        }
      } catch (error) {
        notify("Ошибка: " + error.message, "error");
      }
    });
}

// ===== МОДАЛКА РЕДАКТИРОВАНИЯ ПРОЕКТА =====

async function openEditProjectModal(projectId) {
  try {
    const projectData = await api.getProject(projectId);
    const project = projectData.project;

    openModal(`
      <div class="modal-header">
        <div class="modal-title">✏️ Редактировать проект</div>
        <button class="modal-close modal-close-btn">×</button>
      </div>
      <div class="form-group">
        <label class="form-label">Название проекта</label>
        <input type="text" class="form-input" id="editProjectName" value="${project.name || ""}">
      </div>
      <div class="form-group">
        <label class="form-label">Имя клиента</label>
        <input type="text" class="form-input" id="editProjectClient" value="${project.client_name || ""}">
      </div>
      <div class="form-group">
        <label class="form-label">Бюджет (₽)</label>
        <input type="number" class="form-input" id="editProjectBudget" value="${project.total_budget || 0}">
      </div>
      <div class="form-group">
        <label class="form-label">Дедлайн</label>
        <input type="date" class="form-input" id="editProjectDeadline" value="${project.deadline || ""}">
      </div>
      <div class="form-group">
        <label class="form-label">Примечания</label>
        <textarea class="form-textarea" id="editProjectNotes">${project.notes || ""}</textarea>
      </div>
      <div class="modal-actions">
        <button class="btn btn-secondary modal-cancel-btn">Отмена</button>
        <button class="btn btn-primary" id="btnSaveProject">Сохранить</button>
      </div>
    `);

    document
      .querySelector(".modal-close-btn")
      .addEventListener("click", closeModal);
    document
      .querySelector(".modal-cancel-btn")
      .addEventListener("click", closeModal);
    document
      .getElementById("btnSaveProject")
      .addEventListener("click", async () => {
        const name = document.getElementById("editProjectName").value.trim();
        const client = document
          .getElementById("editProjectClient")
          .value.trim();
        const budget =
          parseInt(document.getElementById("editProjectBudget").value) || 0;
        const deadline = document.getElementById("editProjectDeadline").value;
        const notes = document.getElementById("editProjectNotes").value.trim();

        if (!name) {
          notify("Введите название", "error");
          return;
        }
        if (!client) {
          notify("Введите клиента", "error");
          return;
        }
        if (budget <= 0) {
          notify("Введите бюджет", "error");
          return;
        }

        try {
          const response = await api.updateProject(projectId, {
            name,
            client_name: client,
            total_budget: budget,
            deadline,
            notes,
          });

          if (response.success) {
            closeModal();
            notify("Проект обновлён");
            await render();
          } else {
            notify(
              "Ошибка: " + (response.error || "Не удалось обновить"),
              "error",
            );
          }
        } catch (error) {
          notify("Ошибка: " + error.message, "error");
        }
      });
  } catch (error) {
    notify("Ошибка загрузки проекта", "error");
  }
}

// ===== МОДАЛКА СОЗДАНИЯ ПРОЕКТА =====

function openCreateProjectModal() {
  openModal(`
    <div class="modal-header">
      <div class="modal-title">Создать проект</div>
      <button class="modal-close modal-close-btn">×</button>
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
      <button class="btn btn-secondary modal-cancel-btn">Отмена</button>
      <button class="btn btn-primary" id="btnSubmitProject">Создать</button>
    </div>
  `);

  document
    .querySelector(".modal-close-btn")
    .addEventListener("click", closeModal);
  document
    .querySelector(".modal-cancel-btn")
    .addEventListener("click", closeModal);
  document
    .getElementById("btnSubmitProject")
    .addEventListener("click", createProject);
}

async function createProject() {
  const title = document.getElementById("newProjectTitle").value.trim();
  const client = document.getElementById("newProjectClient").value.trim();
  const budget =
    parseInt(document.getElementById("newProjectBudget").value) || 0;
  const deadline = document.getElementById("newProjectDeadline").value;
  const notes = document.getElementById("newProjectNotes").value.trim();

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

async function closeProject(projectId) {
  if (!confirm("Закрыть проект? Это действие нельзя отменить.")) return;

  try {
    const response = await api.updateProject(projectId, { status: "closed" });

    if (response.success) {
      notify("Проект закрыт");
      await loadAllData();
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
  render();
}
