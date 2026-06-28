// ===== HOME SCREEN =====

async function renderHomeScreen() {
  const user = state.currentUser;
  if (!user) return "";

  if (user.role === "developer") {
    return renderHomeDeveloper();
  } else {
    return await renderHomeManager();
  }
}

async function renderHomeManager() {
  const projects = state.projects || [];
  const activeProjects = projects.filter(
    (p) => p.status === "active" || p.status === "in_progress",
  );

  // Считаем средний прогресс
  let avgProgress = 0;
  if (activeProjects.length > 0) {
    const progressPromises = activeProjects.map(async (p) => {
      try {
        const summary = await api.getProject(p.id);
        return summary.progress?.progress_percent || 0;
      } catch (e) {
        return 0;
      }
    });
    const progresses = await Promise.all(progressPromises);
    avgProgress = Math.round(
      progresses.reduce((s, p) => s + p, 0) / activeProjects.length,
    );
  }

  // Рендерим карточки проектов
  const projectCards = await Promise.all(
    activeProjects.map(async (p) => {
      try {
        const summary = await api.getProject(p.id);
        const tasks = summary.tasks || [];
        const fractions = summary.fractions;

        // Группируем задачи по исполнителям
        const assignees = {};
        tasks.forEach((t) => {
          if (!assignees[t.assignee_id]) {
            assignees[t.assignee_id] = { total: 0, done: 0 };
          }
          assignees[t.assignee_id].total += t.cost;
          if (t.status === "done") assignees[t.assignee_id].done += t.cost;
        });

        const assigneeNames = {
          u_002: "Максим",
          u_003: "Андрей",
        };

        const progressBars = Object.keys(assignees)
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
          .join("");

        const totalCost = tasks.reduce((s, t) => s + t.cost, 0);
        const developersPool = fractions?.developers_pool || 0;
        const remaining = developersPool - totalCost;

        return `
          <div class="card" onclick="openProject('${p.id}')">
            <div class="project-card-header">
              <div style="flex:1;min-width:0">
                <div class="project-title">${p.name}</div>
                <div class="project-client">${p.client_name || "Не указан"}</div>
              </div>
              <div class="project-card-badges">
                ${p.status === "active" || p.status === "in_progress" ? '<span class="badge badge-info">В работе</span>' : ""}
              </div>
            </div>
            <div class="project-budget">Бюджет: ${formatMoney(p.total_budget)}</div>
            ${progressBars}
            <div style="margin-top:10px;font-size:13px;color:var(--text-dim)">
              Распределено: ${formatMoney(totalCost)} из ${formatMoney(developersPool)} • 
              <span style="color:${remaining <= 0 ? "#50c878" : remaining < developersPool * 0.3 ? "#ffa500" : "#ff4444"}">
                Нераспределено: ${formatMoney(remaining)}
              </span>
            </div>
            ${p.deadline ? `<div class="project-deadline ${isOverdue(p.deadline) ? "overdue" : ""}">📅 Дедлайн: ${formatDate(p.deadline)}</div>` : ""}
          </div>
        `;
      } catch (e) {
        console.error(`Error loading project ${p.id}:`, e);
        return "";
      }
    }),
  );

  return `
    <div class="counter-block">
      <div class="counter-value">${avgProgress}%</div>
      <div class="counter-label">Средний прогресс по проектам</div>
    </div>
    
    <div class="section-title">📁 Проекты</div>
    ${projectCards.join("")}
    ${activeProjects.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">📭</div>Нет активных проектов</div>' : ""}
  `;
}

function renderHomeDeveloper() {
  const user = state.currentUser;
  const projects = state.projects || [];

  // Calculate my progress
  let myProgress = 0;
  let myActiveTasks = [];

  projects.forEach((p) => {
    if (p.status !== "active" && p.status !== "in_progress") return;

    const tasks = p.tasks || [];
    tasks.forEach((t) => {
      if (t.assignee_id === user.id && t.status !== "done") {
        myActiveTasks.push({ ...t, project: p });
      }
    });
  });

  // Calculate progress by cost
  let totalCost = 0;
  let doneCost = 0;

  projects.forEach((p) => {
    const tasks = p.tasks || [];
    tasks.forEach((t) => {
      if (t.assignee_id === user.id) {
        totalCost += t.cost;
        if (t.status === "done") doneCost += t.cost;
      }
    });
  });

  if (totalCost > 0) {
    myProgress = Math.round((doneCost / totalCost) * 100);
  }

  return `
        <div class="counter-block">
            <div class="counter-value">${myProgress}%</div>
            <div class="counter-label">Выполнено моих задач</div>
        </div>
        
        <div class="section-title">📋 Мои активные задачи</div>
        ${myActiveTasks
          .map(
            (t) => `
            <div class="card card-static">
                <div class="task-title">${t.title}</div>
                <div class="task-meta">
                    <span>📁 ${t.project.name}</span>
                    <span class="task-cost">💰 ${formatMoney(t.cost)}</span>
                </div>
                <button class="btn btn-primary btn-sm btn-block" onclick="completeTask('${t.id}')">✅ Выполнено</button>
            </div>
        `,
          )
          .join("")}
        ${myActiveTasks.length === 0 ? '<div class="empty-state"><div class="empty-state-icon">🎉</div>Все задачи выполнены!</div>' : ""}
    `;
}

function renderProjectCard(p) {
  const tasks = p.tasks || [];
  const assignees = [...new Set(tasks.map((t) => t.assignee_id))];
  const overdue =
    isOverdue(p.deadline) &&
    (p.status === "active" || p.status === "in_progress");

  return `
        <div class="card" onclick="openProject('${p.id}')">
            <div class="project-card-header">
                <div style="flex:1;min-width:0">
                    <div class="project-title">${p.name}</div>
                    <div class="project-client">Клиент: ${p.client_name || "Не указан"}</div>
                </div>
                <div class="project-card-badges">
                    ${p.status === "active" || p.status === "in_progress" ? '<span class="badge badge-info">В работе</span>' : ""}
                    ${p.status === "completed" || p.status === "closed" ? '<span class="badge badge-success">Завершён</span>' : ""}
                </div>
            </div>
            <div class="project-budget">Бюджет: ${formatMoney(p.total_budget)}</div>
            ${assignees
              .map((uid) => {
                const userName =
                  uid === "u_002"
                    ? "Максим"
                    : uid === "u_003"
                      ? "Андрей"
                      : "Неизвестно";
                const initial = userName.charAt(0);
                const userTasks = tasks.filter((t) => t.assignee_id === uid);
                const doneTasks = userTasks.filter((t) => t.status === "done");
                const percent =
                  userTasks.length > 0
                    ? Math.round((doneTasks.length / userTasks.length) * 100)
                    : 0;

                return `
                    <div class="progress-row">
                        <div class="progress-name">
                            <div class="avatar avatar-sm">${initial}</div>
                            <span>${userName}</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width:${percent}%"></div>
                        </div>
                        <div class="progress-text">${percent}% (${doneTasks.length}/${userTasks.length})</div>
                    </div>
                `;
              })
              .join("")}
            ${p.deadline ? `<div class="project-deadline ${overdue ? "overdue" : ""}">📅 Дедлайн: ${formatDate(p.deadline)} ${overdue ? "⚠️ Просрочен" : ""}</div>` : ""}
        </div>
    `;
}

function openProject(id) {
  state.selectedProject = id;
  state.currentScreen = "projects";
  render();
}
