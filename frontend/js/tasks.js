// ===== TASKS SCREEN =====

let draggedTaskId = null;
let allTasks = [];
let allProjectsList = [];

async function loadTasksScreen() {
  console.log("Loading tasks screen...");

  try {
    // Загружаем все проекты
    const projectsData = await api.getProjects();
    allProjectsList = projectsData.projects || [];

    // Загружаем все задачи
    const tasksData = await api.getTasks();
    allTasks = tasksData.tasks || [];

    render();
  } catch (error) {
    console.error("Error loading tasks:", error);
    notify("Ошибка загрузки задач", "error");
  }
}

function renderTasks() {
  const user = state.currentUser;
  if (!user) return "";

  const canCreate = user.role === "lead_developer" || user.role === "admin";
  const canSeeAll = user.role === "admin";

  // Фильтруем проекты (только активные)
  const activeProjects = allProjectsList.filter(
    (p) => p.status === "active" || p.status === "in_progress",
  );

  // Применяем фильтры
  let displayProjects = activeProjects;
  if (state.taskFilter.project !== "all") {
    displayProjects = displayProjects.filter(
      (p) => p.id === state.taskFilter.project,
    );
  }

  // Считаем общий прогресс для каждого проекта
  const projectsWithProgress = displayProjects.map((p) => {
    const projectTasks = allTasks.filter((t) => t.project_id === p.id);
    const totalCost = projectTasks.reduce((s, t) => s + t.cost, 0);
    const doneCost = projectTasks
      .filter((t) => t.status === "done")
      .reduce((s, t) => s + t.cost, 0);
    const progress =
      totalCost > 0 ? Math.round((doneCost / totalCost) * 100) : 0;

    return { ...p, projectTasks, totalCost, doneCost, progress };
  });

  return `
        <div class="screen-title">
            <span>📋 Задачи</span>
            ${canCreate ? '<button class="btn btn-primary btn-sm" onclick="openCreateTaskModal()">➕ Создать</button>' : ""}
        </div>
        
        <div class="filter-row">
            <select class="form-select" onchange="setTaskFilter('project', this.value)">
                <option value="all" ${state.taskFilter.project === "all" ? "selected" : ""}>Все проекты</option>
                ${activeProjects
                  .map(
                    (p) => `
                    <option value="${p.id}" ${state.taskFilter.project === p.id ? "selected" : ""}>${p.name}</option>
                `,
                  )
                  .join("")}
            </select>
            ${
              canSeeAll
                ? `
                <select class="form-select" onchange="setTaskFilter('assignee', this.value)">
                    <option value="all" ${state.taskFilter.assignee === "all" ? "selected" : ""}>Все исполнители</option>
                    <option value="u_002" ${state.taskFilter.assignee === "u_002" ? "selected" : ""}>Максим</option>
                    <option value="u_003" ${state.taskFilter.assignee === "u_003" ? "selected" : ""}>Андрей</option>
                </select>
            `
                : ""
            }
        </div>
        
        ${projectsWithProgress.map((p) => renderProjectTasksBlock(p)).join("")}
        
        ${projectsWithProgress.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">📭</div>Нет задач</div>' : ""}
    `;
}

function renderProjectTasksBlock(project) {
  const user = state.currentUser;
  const canSeeAll = user.role === "admin";

  // Фильтруем задачи для этого проекта
  let tasks = project.projectTasks;

  if (!canSeeAll) {
    tasks = tasks.filter((t) => t.assignee_id === user.id);
  } else if (state.taskFilter.assignee !== "all") {
    tasks = tasks.filter((t) => t.assignee_id === state.taskFilter.assignee);
  }

  if (tasks.length === 0) return "";

  const upcoming = tasks.filter((t) => t.column === "backlog");
  const current = tasks.filter((t) => t.column === "current");
  const done = tasks.filter((t) => t.column === "done");

  // Считаем пул разработчиков
  const developersPool = Math.round(project.total_budget * 0.57);
  const remaining = developersPool - project.totalCost;

  return `
        <div class="card card-static" style="margin-bottom:20px">
            <div class="project-card-header">
                <div>
                    <div class="project-title">📁 ${project.name}</div>
                    <div class="project-client">${project.client_name || "Не указан"}</div>
                </div>
            </div>
            <div style="font-size:13px;color:var(--text-dim);margin-bottom:8px">
                Бюджет: ${formatMoney(project.total_budget)} • 
                Пул разрабов: ${formatMoney(developersPool)} • 
                Распределено: ${formatMoney(project.totalCost)} • 
                Осталось: <span style="color:${remaining < 0 ? "#ff4444" : "var(--accent-1)"}">${formatMoney(remaining)}</span>
            </div>
            <div style="font-size:13px;margin-bottom:8px">Прогресс: ${project.progress}%</div>
            <div class="progress-bar" style="margin-bottom:10px">
                <div class="progress-fill" style="width:${project.progress}%"></div>
            </div>
            ${project.deadline ? `<div class="project-deadline ${isOverdue(project.deadline) ? "overdue" : ""}">📅 Дедлайн: ${formatDate(project.deadline)}</div>` : ""}
        </div>
        
        ${renderTaskBlock("📥 Предстоящие", upcoming, "backlog", project.id)}
        ${renderTaskBlock("🔄 Текущие", current, "current", project.id)}
        ${renderTaskBlock("✅ Выполненные", done, "done", project.id)}
    `;
}

function renderTaskBlock(title, tasks, column, projectId) {
  const user = state.currentUser;
  const canDrag = user.role === "lead_developer" || user.role === "admin";

  return `
        <div class="task-block" data-column="${column}" data-project="${projectId}"
             ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleDrop(event)">
            <div class="task-block-header">
                <span>${title}</span>
                <span class="task-count">${tasks.length}</span>
            </div>
            ${tasks.map((t) => renderTaskCard(t, canDrag)).join("")}
            ${tasks.length === 0 ? '<div style="text-align:center;padding:12px;color:var(--text-dim);font-size:12px">Пусто</div>' : ""}
        </div>
    `;
}

function renderTaskCard(task, canDrag) {
  const user = state.currentUser;
  const isAssignee = task.assignee_id === user.id;
  const canEdit = user.role === "lead_developer" || user.role === "admin";
  const canDelete = user.role === "lead_developer" || user.role === "admin";
  const canComplete = isAssignee || user.role === "admin";

  const assigneeName =
    task.assignee_id === "u_002"
      ? "Максим"
      : task.assignee_id === "u_003"
        ? "Андрей"
        : "Неизвестно";
  const initial = assigneeName.charAt(0);

  let actionsHtml = "";

  if (task.column === "done") {
    if (canComplete) {
      actionsHtml += `<button class="btn btn-secondary btn-sm btn-block" onclick="reopenTask('${task.id}')">↩️ Вернуть</button>`;
    }
  } else {
    if (canComplete) {
      actionsHtml += `<button class="btn btn-primary btn-sm btn-block" onclick="completeTask('${task.id}')">✅ Выполнено</button>`;
    }
  }

  if (canEdit) {
    actionsHtml += `<button class="btn btn-secondary btn-sm" onclick="openEditTaskModal('${task.id}')" style="flex:1">✏️</button>`;
  }
  if (canDelete) {
    actionsHtml += `<button class="btn btn-danger btn-sm" onclick="deleteTask('${task.id}')" style="flex:1">🗑️</button>`;
  }

  return `
        <div class="task-card ${task.column === "done" ? "completed" : ""}" 
             draggable="${canDrag}" data-task-id="${task.id}"
             ondragstart="handleDragStart(event)">
            <div class="task-title">${task.title}</div>
            <div class="task-meta">
                <span class="task-cost">💰 ${formatMoney(task.cost)}</span>
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
}

// ===== DRAG & DROP =====

function handleDragStart(e) {
  draggedTaskId = e.target.dataset.taskId;
  e.target.classList.add("dragging");
  e.dataTransfer.effectAllowed = "move";
}

function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add("drag-over");
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove("drag-over");
}

async function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove("drag-over");

  if (!draggedTaskId) return;

  const newColumn = e.currentTarget.dataset.column;
  const task = allTasks.find((t) => t.id === draggedTaskId);

  if (!task || task.column === newColumn) {
    draggedTaskId = null;
    return;
  }

  try {
    let newStatus = "pending";
    if (newColumn === "current") newStatus = "in_progress";
    if (newColumn === "done") newStatus = "done";

    const response = await api.updateTask(draggedTaskId, {
      column: newColumn,
      status: newStatus,
      completed_at: newColumn === "done" ? new Date().toISOString() : null,
    });

    if (response.success) {
      notify("Задача перемещена");
      await loadTasksScreen();
    } else {
      notify(
        "Ошибка: " + (response.error || "Не удалось переместить"),
        "error",
      );
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }

  draggedTaskId = null;
}

// ===== ДЕЙСТВИЯ С ЗАДАЧАМИ =====

async function completeTask(taskId) {
  try {
    const response = await api.completeTask(taskId);

    if (response.success) {
      notify("Задача выполнена! 🎉");
      await loadTasksScreen();
    } else {
      notify("Ошибка: " + (response.error || "Не удалось завершить"), "error");
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}

async function reopenTask(taskId) {
  try {
    const response = await api.updateTask(taskId, {
      status: "pending",
      column: "current",
      completed_at: null,
    });

    if (response.success) {
      notify("Задача возвращена в работу");
      await loadTasksScreen();
    } else {
      notify("Ошибка: " + (response.error || "Не удалось вернуть"), "error");
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}

async function deleteTask(taskId) {
  if (!confirm("Удалить задачу? Это действие нельзя отменить.")) return;

  try {
    const response = await api.deleteTask(taskId);

    if (response.success) {
      notify("Задача удалена");
      await loadTasksScreen();
    } else {
      notify("Ошибка: " + (response.error || "Не удалось удалить"), "error");
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}

function setTaskFilter(key, value) {
  state.taskFilter[key] = value;
  render();
}

// ===== МОДАЛКИ =====

function openCreateTaskModal() {
  const activeProjects = allProjectsList.filter(
    (p) => p.status === "active" || p.status === "in_progress",
  );

  if (activeProjects.length === 0) {
    notify("Нет активных проектов", "error");
    return;
  }

  openModal(`
        <div class="modal-header">
            <div class="modal-title">Создать задачу</div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="form-group">
            <label class="form-label">Проект</label>
            <select class="form-select" id="newTaskProject" onchange="updateRemainingAmount()">
                ${activeProjects.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
            </select>
        </div>
        <div class="form-group">
            <label class="form-label">Название задачи</label>
            <input type="text" class="form-input" id="newTaskTitle" placeholder="Например: Разработать дизайн">
        </div>
        <div class="form-group">
            <label class="form-label">Стоимость (₽)</label>
            <input type="number" class="form-input" id="newTaskCost" placeholder="5000" min="0">
            <div style="font-size:12px;color:var(--text-dim);margin-top:4px">
                Осталось распределить: <strong id="remainingAmount">...</strong>
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
            <button class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            <button class="btn btn-primary" onclick="createTask()">Создать</button>
        </div>
    `);

  updateRemainingAmount();
}

async function updateRemainingAmount() {
  const projectId = $("#newTaskProject")?.value;
  if (!projectId) return;

  try {
    const projectData = await api.getProject(projectId);
    const fractions = projectData.fractions;

    const tasksData = await api.getTasks(projectId);
    const tasks = tasksData.tasks || [];
    const tasksSum = tasks.reduce((s, t) => s + t.cost, 0);
    const remaining = fractions.developers_pool - tasksSum;

    const el = $("#remainingAmount");
    if (el) {
      el.textContent = formatMoney(remaining);
      el.style.color = remaining < 0 ? "#ff4444" : "var(--accent-1)";
    }

    const costInput = $("#newTaskCost");
    if (costInput) costInput.max = remaining;
  } catch (error) {
    console.error("Error updating remaining:", error);
  }
}

async function createTask() {
  const projectId = $("#newTaskProject").value;
  const title = $("#newTaskTitle").value.trim();
  const cost = parseInt($("#newTaskCost").value) || 0;
  const assigneeId = $("#newTaskAssignee").value;

  if (!title) {
    notify("Введите название задачи", "error");
    return;
  }

  if (cost <= 0) {
    notify("Введите корректную стоимость", "error");
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
      await loadTasksScreen();
    } else {
      notify("Ошибка: " + (response.error || "Не удалось создать"), "error");
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}

function openEditTaskModal(taskId) {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) {
    notify("Задача не найдена", "error");
    return;
  }

  openModal(`
        <div class="modal-header">
            <div class="modal-title">Редактировать задачу</div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        <div class="form-group">
            <label class="form-label">Название задачи</label>
            <input type="text" class="form-input" id="editTaskTitle" value="${task.title}">
        </div>
        <div class="form-group">
            <label class="form-label">Стоимость (₽)</label>
            <input type="number" class="form-input" id="editTaskCost" value="${task.cost}" min="0">
        </div>
        <div class="form-group">
            <label class="form-label">Исполнитель</label>
            <select class="form-select" id="editTaskAssignee">
                <option value="u_002" ${task.assignee_id === "u_002" ? "selected" : ""}>Максим</option>
                <option value="u_003" ${task.assignee_id === "u_003" ? "selected" : ""}>Андрей</option>
            </select>
        </div>
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            <button class="btn btn-primary" onclick="updateTask('${taskId}')">Сохранить</button>
        </div>
    `);
}

async function updateTask(taskId) {
  const title = $("#editTaskTitle").value.trim();
  const cost = parseInt($("#editTaskCost").value) || 0;
  const assigneeId = $("#editTaskAssignee").value;

  if (!title) {
    notify("Введите название задачи", "error");
    return;
  }

  if (cost <= 0) {
    notify("Введите корректную стоимость", "error");
    return;
  }

  try {
    const response = await api.updateTask(taskId, {
      title: title,
      cost: cost,
      assignee_id: assigneeId,
    });

    if (response.success) {
      closeModal();
      notify("Задача обновлена");
      await loadTasksScreen();
    } else {
      notify("Ошибка: " + (response.error || "Не удалось обновить"), "error");
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}
