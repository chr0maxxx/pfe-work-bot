// Экран задач

let currentProjectId = null;
let allProjects = [];
let allTasks = [];
let draggedTaskId = null;

async function loadTasksScreen() {
  console.log("Loading tasks screen...");

  const content = document.getElementById("screen-tasks");

  try {
    // Загружаем проекты
    const projectsData = await api.getProjects();
    allProjects = projectsData.projects || [];

    console.log("Projects loaded:", allProjects);

    if (allProjects.length === 0) {
      content.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">📋</div>
                    <div>Нет доступных проектов</div>
                    <div style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
                        Попросите менеджера создать проект
                    </div>
                </div>
            `;
      return;
    }

    // Если проект не выбран, выбираем первый
    if (!currentProjectId && allProjects.length > 0) {
      currentProjectId = allProjects[0].id;
    }

    // Рендерим интерфейс
    renderTasksScreen();

    // Загружаем задачи для выбранного проекта
    await loadTasksForProject(currentProjectId);
  } catch (error) {
    console.error("Error loading tasks:", error);
    content.innerHTML = `
            <div class="error">
                Ошибка загрузки задач: ${error.message}
            </div>
        `;
  }
}

function renderTasksScreen() {
  const content = document.getElementById("screen-tasks");
  const userRole = currentUser?.role;

  // Список проектов (выпадающий список)
  const projectsList = allProjects
    .map(
      (p) => `
        <option value="${p.id}" ${p.id === currentProjectId ? "selected" : ""}>
            ${p.name} (${p.total_budget.toLocaleString("ru-RU")}₽)
        </option>
    `,
    )
    .join("");

  // Кнопка создания задачи (только для lead_developer и admin)
  const createButtonHtml =
    userRole === "lead_developer" || userRole === "admin"
      ? `
        <div class="tasks-actions">
            <button class="btn btn-primary" id="btn-create-task">
                ➕ Создать задачу
            </button>
        </div>
    `
      : "";

  content.innerHTML = `
        <div class="tasks-container">
            <!-- Выбор проекта -->
            <div class="project-selector">
                <label for="project-select">Проект:</label>
                <select id="project-select" class="form-select">
                    ${projectsList}
                </select>
            </div>
            
            <!-- Информация о проекте -->
            <div class="project-info" id="project-info">
                <!-- Заполняется динамически -->
            </div>
            
            <!-- Вертикальные блоки задач -->
            <div class="tasks-blocks-container">
                <!-- Блок: Предстоящие -->
                <div class="task-block" data-column="backlog">
                    <div class="task-block-header">
                        <div class="task-block-title">📥 Предстоящие</div>
                        <div class="task-block-count" id="count-backlog">0</div>
                    </div>
                    <div class="task-block-cards" id="cards-backlog"></div>
                </div>
                
                <!-- Блок: Текущие -->
                <div class="task-block" data-column="current">
                    <div class="task-block-header">
                        <div class="task-block-title">🔄 Текущие</div>
                        <div class="task-block-count" id="count-current">0</div>
                    </div>
                    <div class="task-block-cards" id="cards-current"></div>
                </div>
                
                <!-- Блок: Выполненные -->
                <div class="task-block" data-column="done">
                    <div class="task-block-header">
                        <div class="task-block-title">✅ Выполненные</div>
                        <div class="task-block-count" id="count-done">0</div>
                    </div>
                    <div class="task-block-cards" id="cards-done"></div>
                </div>
            </div>
            
            ${createButtonHtml}
        </div>
    `;

  // Обработчики событий
  document
    .getElementById("project-select")
    .addEventListener("change", async (e) => {
      currentProjectId = e.target.value;
      await loadTasksForProject(currentProjectId);
    });

  // Кнопка создания задачи
  if (userRole === "lead_developer" || userRole === "admin") {
    document.getElementById("btn-create-task").addEventListener("click", () => {
      showCreateTaskModal();
    });
  }

  // Настраиваем drop zones
  setupDropZones();
}

function updateCreateButton() {
  const actionsContainer = document.getElementById("tasks-actions");
  const userRole = currentUser?.role;

  if (userRole === "lead_developer" || userRole === "admin") {
    actionsContainer.innerHTML = `
            <button class="btn btn-primary" id="btn-create-task">
                ➕ Создать задачу
            </button>
        `;
    document.getElementById("btn-create-task").addEventListener("click", () => {
      showCreateTaskModal();
    });
  } else {
    actionsContainer.innerHTML = "";
  }
}

async function loadTasksForProject(projectId) {
  console.log("Loading tasks for project:", projectId);

  try {
    // Загружаем задачи
    const tasksData = await api.getTasks(projectId);
    allTasks = tasksData.tasks || [];

    console.log("Tasks loaded:", allTasks);

    // Загружаем информацию о проекте
    const projectData = await api.getProject(projectId);

    // Обновляем информацию о проекте
    updateProjectInfo(projectData);

    // Рендерим задачи
    renderTasks();
  } catch (error) {
    console.error("Error loading tasks for project:", error);
  }
}

function updateProjectInfo(projectData) {
  const projectInfo = document.getElementById("project-info");

  const project = projectData.project;
  const fractions = projectData.fractions;
  const progress = projectData.progress;

  // Считаем сумму задач
  const tasksSum = allTasks.reduce((sum, t) => sum + t.cost, 0);
  const remaining = fractions.developers_pool - tasksSum;

  projectInfo.innerHTML = `
        <div class="card">
            <div class="card-header">
                <div class="card-title">${project.name}</div>
                <div class="badge badge-info">${project.client_name}</div>
            </div>
            <div class="card-body">
                <div class="project-stats">
                    <div class="stat">
                        <div class="stat-label">Бюджет</div>
                        <div class="stat-value">${project.total_budget.toLocaleString("ru-RU")}₽</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Пул разработчиков</div>
                        <div class="stat-value">${fractions.developers_pool.toLocaleString("ru-RU")}₽</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Распределено</div>
                        <div class="stat-value">${tasksSum.toLocaleString("ru-RU")}₽</div>
                    </div>
                    <div class="stat">
                        <div class="stat-label">Осталось</div>
                        <div class="stat-value ${remaining < 0 ? "text-error" : ""}">${remaining.toLocaleString("ru-RU")}₽</div>
                    </div>
                </div>
                <div class="project-progress">
                    <div class="progress-label">Прогресс: ${progress.progress_percent}% (${progress.done_count}/${progress.total_count} задач)</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress.progress_percent}%"></div>
                    </div>
                </div>
                ${
                  project.deadline
                    ? `
                    <div class="project-deadline">
                        📅 Дедлайн: ${new Date(project.deadline).toLocaleDateString("ru-RU")}
                    </div>
                `
                    : ""
                }
            </div>
        </div>
    `;
}

function renderTasks() {
  // Фильтруем задачи по колонкам
  const backlog = allTasks.filter((t) => t.column === "backlog");
  const current = allTasks.filter((t) => t.column === "current");
  const done = allTasks.filter((t) => t.column === "done");

  // Рендерим карточки
  renderBlock("backlog", backlog);
  renderBlock("current", current);
  renderBlock("done", done);

  // Обновляем счётчики
  document.getElementById("count-backlog").textContent = backlog.length;
  document.getElementById("count-current").textContent = current.length;
  document.getElementById("count-done").textContent = done.length;
}

function renderBlock(columnName, tasks) {
  const container = document.getElementById(`cards-${columnName}`);

  if (tasks.length === 0) {
    container.innerHTML = '<div class="task-block-empty">Нет задач</div>';
    return;
  }

  container.innerHTML = tasks
    .map((task) => {
      return createTaskCard(task, columnName);
    })
    .join("");

  // Настраиваем drag events для карточек
  setupDragEvents();
}

function createTaskCard(task, columnName) {
  const userRole = currentUser?.role;
  const userId = currentUser?.id;
  const isAssignee = task.assignee_id === userId;

  // Определяем доступные действия
  const canEdit = userRole === "lead_developer" || userRole === "admin";
  const canDelete = userRole === "lead_developer" || userRole === "admin";
  const canComplete = isAssignee || userRole === "admin";
  const canDrag = canEdit; // Только те, кто может редактировать, могут перетаскивать

  // Определяем имя исполнителя
  const assigneeName =
    task.assignee_id === "u_002"
      ? "Максим"
      : task.assignee_id === "u_003"
        ? "Андрей"
        : "Неизвестно";

  let actionsHtml = "";

  if (columnName === "done") {
    // Для выполненных задач — кнопка "Вернуть"
    if (canComplete) {
      actionsHtml += `<button class="btn btn-small btn-secondary" onclick="reopenTask('${task.id}')">↩️ Вернуть</button>`;
    }
  } else {
    // Для активных задач — кнопка "Выполнено"
    if (canComplete) {
      actionsHtml += `<button class="btn btn-small btn-primary" onclick="completeTask('${task.id}')">✅ Выполнено</button>`;
    }
  }

  // Кнопки редактирования и удаления
  if (canEdit) {
    actionsHtml += `<button class="btn btn-small btn-secondary" onclick="showEditTaskModal('${task.id}')">✏️</button>`;
  }
  if (canDelete) {
    actionsHtml += `<button class="btn btn-small btn-danger" onclick="deleteTask('${task.id}')">🗑️</button>`;
  }

  return `
        <div class="task-card ${canDrag ? "draggable" : ""}" 
             data-task-id="${task.id}" 
             ${canDrag ? 'draggable="true"' : ""}>
            <div class="task-card-header">
                <div class="task-card-title">${task.title}</div>
                ${canDrag ? '<div class="drag-handle">⋮⋮</div>' : ""}
            </div>
            <div class="task-card-meta">
                <span>💰 ${task.cost.toLocaleString("ru-RU")}₽</span>
                <span>👤 ${assigneeName}</span>
            </div>
            <div class="task-card-actions">
                ${actionsHtml}
            </div>
        </div>
    `;
}

// ===== DRAG & DROP =====

function setupDragEvents() {
  const cards = document.querySelectorAll(".task-card.draggable");

  cards.forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      draggedTaskId = card.dataset.taskId;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", draggedTaskId);
    });

    card.addEventListener("dragend", (e) => {
      card.classList.remove("dragging");
      draggedTaskId = null;
      // Убираем подсветку со всех зон
      document.querySelectorAll(".task-block").forEach((block) => {
        block.classList.remove("drag-over");
      });
    });
  });
}

function setupDropZones() {
  const blocks = document.querySelectorAll(".task-block");

  blocks.forEach((block) => {
    block.addEventListener("dragover", (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      block.classList.add("drag-over");
    });

    block.addEventListener("dragleave", (e) => {
      block.classList.remove("drag-over");
    });

    block.addEventListener("drop", async (e) => {
      e.preventDefault();
      block.classList.remove("drag-over");

      const taskId = e.dataTransfer.getData("text/plain");
      const newColumn = block.dataset.column;

      if (taskId && newColumn) {
        await moveTaskToColumn(taskId, newColumn);
      }
    });
  });
}

async function moveTaskToColumn(taskId, newColumn) {
  console.log(`Moving task ${taskId} to column ${newColumn}`);

  try {
    // Определяем статус в зависимости от колонки
    let newStatus = "pending";
    if (newColumn === "current") newStatus = "in_progress";
    if (newColumn === "done") newStatus = "done";

    const response = await api.updateTask(taskId, {
      column: newColumn,
      status: newStatus,
      completed_at: newColumn === "done" ? new Date().toISOString() : null,
    });

    if (response.success) {
      console.log("Task moved successfully");
      await loadTasksForProject(currentProjectId);
    } else {
      alert("Ошибка: " + (response.error || "Не удалось переместить задачу"));
    }
  } catch (error) {
    console.error("Error moving task:", error);
    alert("Ошибка: " + error.message);
  }
}

// ===== ДЕЙСТВИЯ С ЗАДАЧАМИ =====

async function completeTask(taskId) {
  console.log("Completing task:", taskId);

  try {
    const response = await api.completeTask(taskId);

    if (response.success) {
      console.log("Task completed successfully");
      await loadTasksForProject(currentProjectId);
    } else {
      alert("Ошибка: " + (response.error || "Не удалось завершить задачу"));
    }
  } catch (error) {
    console.error("Error completing task:", error);
    alert("Ошибка: " + error.message);
  }
}

async function reopenTask(taskId) {
  console.log("Reopening task:", taskId);

  try {
    const response = await api.updateTask(taskId, {
      status: "in_progress",
      column: "current", // ← Изменили с 'backlog' на 'current'
      completed_at: null,
    });

    if (response.success) {
      console.log("Task reopened successfully");
      await loadTasksForProject(currentProjectId);
    } else {
      alert("Ошибка: " + (response.error || "Не удалось вернуть задачу"));
    }
  } catch (error) {
    console.error("Error reopening task:", error);
    alert("Ошибка: " + error.message);
  }
}

async function deleteTask(taskId) {
  if (!confirm("Вы уверены, что хотите удалить задачу?")) {
    return;
  }

  console.log("Deleting task:", taskId);

  try {
    const response = await api.deleteTask(taskId);

    if (response.success) {
      console.log("Task deleted successfully");
      await loadTasksForProject(currentProjectId);
    } else {
      alert("Ошибка: " + (response.error || "Не удалось удалить задачу"));
    }
  } catch (error) {
    console.error("Error deleting task:", error);
    alert("Ошибка: " + error.message);
  }
}

// ===== МОДАЛКИ =====

function showCreateTaskModal() {
  // Создаём список проектов
  const projectsOptions = allProjects
    .map(
      (p) => `
        <option value="${p.id}" ${p.id === currentProjectId ? "selected" : ""}>
            ${p.name}
        </option>
    `,
    )
    .join("");

  const modal = document.createElement("div");
  modal.className = "modal-overlay";
  modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <div class="modal-title">Создать задачу</div>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
            </div>
            <div class="modal-body">
                <div class="form-group">
                    <label class="form-label">Проект</label>
                    <select id="task-project" class="form-select">
                        ${projectsOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Название задачи</label>
                    <input type="text" id="task-title" class="form-input" placeholder="Например: Разработать дизайн">
                </div>
                <div class="form-group">
                    <label class="form-label">Стоимость (₽)</label>
                    <input type="number" id="task-cost" class="form-input" placeholder="5000" min="0">
                    <div class="form-hint">
                        Доступно: <strong id="remaining-amount">загрузится...</strong>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label">Исполнитель</label>
                    <select id="task-assignee" class="form-select">
                        <option value="u_002">Максим</option>
                        <option value="u_003">Андрей</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer">
                <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
                <button class="btn btn-primary" id="btn-submit-task">Создать</button>
            </div>
        </div>
    `;

  document.body.appendChild(modal);

  // Функция обновления доступной суммы
  async function updateRemainingAmount() {
    const projectId = document.getElementById("task-project").value;
    const projectData = await api.getProject(projectId);
    const fractions = projectData.fractions;

    // Загружаем задачи для этого проекта
    const tasksData = await api.getTasks(projectId);
    const tasks = tasksData.tasks || [];
    const tasksSum = tasks.reduce((sum, t) => sum + t.cost, 0);
    const remaining = fractions.developers_pool - tasksSum;

    document.getElementById("remaining-amount").textContent =
      `${remaining.toLocaleString("ru-RU")}₽`;
    document.getElementById("task-cost").max = remaining;
  }

  // Обновляем при загрузке
  updateRemainingAmount();

  // Обновляем при изменении проекта
  document
    .getElementById("task-project")
    .addEventListener("change", updateRemainingAmount);

  // Обработчик создания
  document
    .getElementById("btn-submit-task")
    .addEventListener("click", async () => {
      const projectId = document.getElementById("task-project").value;
      const title = document.getElementById("task-title").value.trim();
      const cost = parseInt(document.getElementById("task-cost").value);
      const assigneeId = document.getElementById("task-assignee").value;

      if (!title) {
        alert("Введите название задачи");
        return;
      }

      if (!cost || cost <= 0) {
        alert("Введите корректную стоимость");
        return;
      }

      // Проверяем лимит
      const projectData = await api.getProject(projectId);
      const fractions = projectData.fractions;
      const tasksData = await api.getTasks(projectId);
      const tasks = tasksData.tasks || [];
      const tasksSum = tasks.reduce((sum, t) => sum + t.cost, 0);
      const remaining = fractions.developers_pool - tasksSum;

      if (cost > remaining) {
        alert(
          `Превышена сумма задач! Доступно: ${remaining.toLocaleString("ru-RU")}₽`,
        );
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
          console.log("Task created:", response.task_id);
          modal.remove();

          // Если создали задачу для текущего проекта — перезагружаем
          if (projectId === currentProjectId) {
            await loadTasksForProject(currentProjectId);
          } else {
            // Иначе просто показываем уведомление
            alert(
              "Задача создана для проекта: " +
                allProjects.find((p) => p.id === projectId).name,
            );
          }
        } else {
          alert("Ошибка: " + (response.error || "Не удалось создать задачу"));
        }
      } catch (error) {
        console.error("Error creating task:", error);
        alert("Ошибка: " + error.message);
      }
    });
}

function showEditTaskModal(taskId) {
  const task = allTasks.find((t) => t.id === taskId);
  if (!task) {
    alert("Задача не найдена");
    return;
  }

  // Считаем оставшуюся сумму (без учёта текущей задачи)
  const tasksSum = allTasks
    .filter((t) => t.id !== taskId)
    .reduce((sum, t) => sum + t.cost, 0);

  api.getProject(currentProjectId).then((projectData) => {
    const fractions = projectData.fractions;
    const remaining = fractions.developers_pool - tasksSum;

    const modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <div class="modal-title">Редактировать задачу</div>
                    <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">×</button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Название задачи</label>
                        <input type="text" id="edit-task-title" class="form-input" value="${task.title}">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Стоимость (₽)</label>
                        <input type="number" id="edit-task-cost" class="form-input" value="${task.cost}" min="0" max="${remaining + task.cost}">
                        <div class="form-hint">
                            Доступно (с учётом текущей задачи): <strong>${(remaining + task.cost).toLocaleString("ru-RU")}₽</strong>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Исполнитель</label>
                        <select id="edit-task-assignee" class="form-select">
                            <option value="u_002" ${task.assignee_id === "u_002" ? "selected" : ""}>Максим</option>
                            <option value="u_003" ${task.assignee_id === "u_003" ? "selected" : ""}>Андрей</option>
                        </select>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="this.closest('.modal-overlay').remove()">Отмена</button>
                    <button class="btn btn-primary" id="btn-update-task">Сохранить</button>
                </div>
            </div>
        `;

    document.body.appendChild(modal);

    // Обработчик обновления
    document
      .getElementById("btn-update-task")
      .addEventListener("click", async () => {
        const title = document.getElementById("edit-task-title").value.trim();
        const cost = parseInt(document.getElementById("edit-task-cost").value);
        const assigneeId = document.getElementById("edit-task-assignee").value;

        if (!title) {
          alert("Введите название задачи");
          return;
        }

        if (!cost || cost <= 0) {
          alert("Введите корректную стоимость");
          return;
        }

        if (cost > remaining + task.cost) {
          alert(
            `Превышена сумма задач! Доступно: ${(remaining + task.cost).toLocaleString("ru-RU")}₽`,
          );
          return;
        }

        try {
          const response = await api.updateTask(taskId, {
            title: title,
            cost: cost,
            assignee_id: assigneeId,
          });

          if (response.success) {
            console.log("Task updated successfully");
            modal.remove();
            await loadTasksForProject(currentProjectId);
          } else {
            alert(
              "Ошибка: " + (response.error || "Не удалось обновить задачу"),
            );
          }
        } catch (error) {
          console.error("Error updating task:", error);
          alert("Ошибка: " + error.message);
        }
      });
  });
}
