// ===== FINANCES SCREEN =====

let financesData = [];
let projectsDataFin = [];

async function loadFinancesScreen() {
  console.log("Loading finances screen...");

  try {
    const projResponse = await api.getProjects();
    projectsDataFin = projResponse.projects || [];

    const finResponse = await api.getFinances();
    financesData = finResponse.finances || [];

    render();
  } catch (error) {
    console.error("Error loading finances:", error);
    notify("Ошибка загрузки данных", "error");
  }
}

function renderFinance() {
  const user = state.currentUser;
  if (!user) return "";

  if (user.role === "manager") {
    return renderFinanceManager();
  } else if (user.role === "admin") {
    return renderFinanceAdmin();
  } else {
    return renderFinanceDeveloper();
  }
}

// ===== ФИНАНСЫ ДЛЯ МЕНЕДЖЕРА (ЛЕВ) =====

function renderFinanceManager() {
  const totalReceived = financesData.reduce(
    (s, f) => s + f.client_paid_total,
    0,
  );
  const totalExpenses = 0;

  let expectedIncome = 0;
  projectsDataFin.forEach((p) => {
    const fin = financesData.find((f) => f.project_id === p.id);
    if (fin) {
      const remaining = p.total_budget - fin.client_paid_total;
      if (remaining > 0) expectedIncome += remaining;
    }
  });

  const incomeByProject = financesData
    .map((f) => {
      const project = projectsDataFin.find((p) => p.id === f.project_id);
      return {
        project_name: project ? project.name : "Неизвестно",
        amount: f.client_paid_total,
        date: f.last_updated,
      };
    })
    .filter((i) => i.amount > 0);

  return `
    <div class="screen-title">
      <span>💰 Финансы</span>
      <button class="btn btn-secondary btn-sm" id="btnShowRequisites">👥 Реквизиты</button>
    </div>
    
    <div class="section-title">📥 Поступления от заказчиков</div>
    <div class="card card-static">
      ${
        incomeByProject.length > 0
          ? incomeByProject
              .map(
                (i) => `
              <div class="finance-row">
                <span>${i.project_name}</span>
                <span class="amount">${formatMoney(i.amount)}</span>
              </div>
            `,
              )
              .join("")
          : '<div style="text-align:center;padding:12px;color:var(--text-dim)">Нет поступлений</div>'
      }
    </div>
    
    <div class="section-title">📊 Статистика</div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Получено</div>
        <div class="stat-value">${formatMoney(totalReceived)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Ожидается</div>
        <div class="stat-value">${formatMoney(expectedIncome)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Общий бюджет</div>
        <div class="stat-value">${formatMoney(projectsDataFin.reduce((s, p) => s + p.total_budget, 0))}</div>
      </div>
    </div>
    
    <div class="section-title">⏳ Ожидаемый доход</div>
    <div class="card card-static">
      ${
        projectsDataFin
          .map((p) => {
            const fin = financesData.find((f) => f.project_id === p.id);
            const received = fin ? fin.client_paid_total : 0;
            const remaining = p.total_budget - received;
            if (remaining <= 0) return "";
            return `
              <div class="finance-row">
                <span>${p.name}</span>
                <span class="amount">${formatMoney(remaining)}</span>
              </div>
            `;
          })
          .join("") ||
        '<div style="text-align:center;padding:12px;color:var(--text-dim)">Все проекты оплачены</div>'
      }
      <div class="finance-row total">
        <span>Итого к получению</span>
        <span class="amount">${formatMoney(expectedIncome)}</span>
      </div>
    </div>
    
    <div style="margin-top:20px">
      <button class="btn btn-primary btn-block" id="btnAddPayment">➕ Зарегистрировать поступление</button>
    </div>
  `;
}

// ===== ФИНАНСЫ ДЛЯ РАЗРАБОТЧИКОВ =====

function renderFinanceDeveloper() {
  const user = state.currentUser;
  let totalDue = 0;
  let totalPaid = 0;
  const projectFinances = [];

  financesData.forEach((fin) => {
    const payout = fin.payouts[user.id];
    if (!payout) return;
    const project = projectsDataFin.find((p) => p.id === fin.project_id);
    if (!project) return;
    totalDue += payout.total_due;
    totalPaid += payout.paid;
    projectFinances.push({
      project_name: project.name,
      total_due: payout.total_due,
      paid: payout.paid,
      remaining: payout.remaining,
      status: payout.status,
    });
  });

  return `
    <div class="screen-title">💰 Мои финансы</div>
    
    <div class="stats-grid" style="grid-template-columns:repeat(2,1fr)">
      <div class="stat-card">
        <div class="stat-label">Ожидается</div>
        <div class="stat-value">${formatMoney(totalDue - totalPaid)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Получено</div>
        <div class="stat-value">${formatMoney(totalPaid)}</div>
      </div>
    </div>
    
    <div class="section-title">📁 По проектам</div>
    <div class="card card-static">
      ${
        projectFinances.length > 0
          ? projectFinances
              .map(
                (pf) => `
              <div class="finance-row">
                <div>
                  <div style="font-weight:600">${pf.project_name}</div>
                  <div style="font-size:12px;color:var(--text-dim)">
                    ${pf.status === "paid" ? "✅ Оплачено" : pf.status === "partial" ? "🔄 Частично" : "⏳ Ожидание"}
                  </div>
                </div>
                <div style="text-align:right">
                  <div class="amount">${formatMoney(pf.remaining)}</div>
                  <div style="font-size:11px;color:var(--text-dim)">из ${formatMoney(pf.total_due)}</div>
                </div>
              </div>
            `,
              )
              .join("")
          : '<div style="text-align:center;padding:12px;color:var(--text-dim)">Нет проектов</div>'
      }
    </div>
  `;
}

// ===== ФИНАНСЫ ДЛЯ АДМИНА =====

function renderFinanceAdmin() {
  const totalBudget = projectsDataFin.reduce((s, p) => s + p.total_budget, 0);
  const totalReceived = financesData.reduce(
    (s, f) => s + f.client_paid_total,
    0,
  );

  const users = ["u_002", "u_003", "u_004"];
  const userFinances = users.map((userId) => {
    let totalDue = 0;
    let totalPaid = 0;
    financesData.forEach((fin) => {
      const payout = fin.payouts[userId];
      if (payout) {
        totalDue += payout.total_due;
        totalPaid += payout.paid;
      }
    });
    return {
      user_id: userId,
      user_name: getUserName(userId),
      total_due: totalDue,
      total_paid: totalPaid,
      remaining: totalDue - totalPaid,
    };
  });

  const obshakTotal = Math.round(totalReceived * 0.15);

  return `
    <div class="screen-title">💰 Финансы всех участников</div>
    
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Общий бюджет</div>
        <div class="stat-value">${formatMoney(totalBudget)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Получено</div>
        <div class="stat-value">${formatMoney(totalReceived)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Общак (15%)</div>
        <div class="stat-value">${formatMoney(obshakTotal)}</div>
      </div>
    </div>
    
    ${userFinances
      .map(
        (uf) => `
        <div class="card card-static">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
            <div class="avatar avatar-sm">${uf.user_name.charAt(0)}</div>
            <div style="font-weight:600">${uf.user_name}</div>
          </div>
          <div class="finance-row">
            <span>Должно быть</span>
            <span class="amount">${formatMoney(uf.total_due)}</span>
          </div>
          <div class="finance-row">
            <span>Выплачено</span>
            <span class="amount">${formatMoney(uf.total_paid)}</span>
          </div>
          <div class="finance-row total">
            <span>Осталось</span>
            <span class="amount">${formatMoney(uf.remaining)}</span>
          </div>
        </div>
      `,
      )
      .join("")}
  `;
}

// ===== ДЕЛЕГИРОВАНИЕ СОБЫТИЙ (ИСПРАВЛЕНИЕ МИГАНИЯ) =====

function attachFinanceHandlers() {
  // Кнопка "Реквизиты"
  const btnRequisites = document.getElementById("btnShowRequisites");
  if (btnRequisites) {
    btnRequisites.addEventListener("click", openRequisitesModal);
  }

  // Кнопка "Зарегистрировать поступление"
  const btnAddPayment = document.getElementById("btnAddPayment");
  if (btnAddPayment) {
    btnAddPayment.addEventListener("click", openAddPaymentModal);
  }
}

// ===== МОДАЛКИ =====

async function openRequisitesModal() {
  try {
    const response = await api.getRequisites();
    const requisites = response.requisites || {};
    const users = ["u_002", "u_003", "u_004"];

    openModal(`
      <div class="modal-header">
        <div class="modal-title">👥 Реквизиты участников</div>
        <button class="modal-close" id="modalCloseBtn">×</button>
      </div>
      ${users
        .map((userId) => {
          const req = requisites[userId] || { value: "Не указаны", desc: "" };
          const userName = getUserName(userId);
          return `
            <div class="requisite-item">
              <div class="requisite-header">
                <div class="avatar avatar-sm">${userName.charAt(0)}</div>
                <span>${userName}</span>
              </div>
              <div class="requisite-value">${req.value}</div>
              ${req.desc ? `<div class="requisite-desc">💬 ${req.desc}</div>` : ""}
            </div>
          `;
        })
        .join("")}
    `);

    // Навешиваем обработчик закрытия после рендера
    const closeBtn = document.getElementById("modalCloseBtn");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }
  } catch (error) {
    notify("Ошибка загрузки реквизитов", "error");
  }
}

function openAddPaymentModal() {
  const activeProjects = projectsDataFin.filter(
    (p) => p.status === "active" || p.status === "in_progress",
  );

  if (activeProjects.length === 0) {
    notify("Нет активных проектов", "error");
    return;
  }

  openModal(`
    <div class="modal-header">
      <div class="modal-title">➕ Зарегистрировать поступление</div>
      <button class="modal-close" id="modalCloseBtn2">×</button>
    </div>
    
    <div class="form-group">
      <label class="form-label">Проект</label>
      <select class="form-select" id="paymentProject">
        ${activeProjects.map((p) => `<option value="${p.id}">${p.name}</option>`).join("")}
      </select>
    </div>
    
    <div class="form-group">
      <label class="form-label">Сумма (₽)</label>
      <input type="number" class="form-input" id="paymentSum" placeholder="50000" min="1">
    </div>
    
    <div class="modal-actions">
      <button class="btn btn-secondary" id="btnCancelPayment">Отмена</button>
      <button class="btn btn-primary" id="btnSubmitPayment">Зарегистрировать</button>
    </div>
  `);

  // Навешиваем обработчики после рендера
  const closeBtn = document.getElementById("modalCloseBtn2");
  const cancelBtn = document.getElementById("btnCancelPayment");
  const submitBtn = document.getElementById("btnSubmitPayment");

  if (closeBtn) closeBtn.addEventListener("click", closeModal);
  if (cancelBtn) cancelBtn.addEventListener("click", closeModal);
  if (submitBtn) submitBtn.addEventListener("click", registerPayment);
}

async function registerPayment() {
  const projectId = document.getElementById("paymentProject").value;
  const amount = parseInt(document.getElementById("paymentSum").value);

  if (!amount || amount <= 0) {
    notify("Введите корректную сумму", "error");
    return;
  }

  try {
    const response = await api.registerClientPayment(projectId, amount);
    if (response.success) {
      closeModal();
      notify(`Поступление ${formatMoney(amount)} зарегистрировано`);
      await loadFinancesScreen();
    } else {
      notify(
        "Ошибка: " + (response.error || "Не удалось зарегистрировать"),
        "error",
      );
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}
