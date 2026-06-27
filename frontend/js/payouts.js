// ===== PAYMENTS SCREEN =====

let payoutsData = [];
let projectsData = [];

async function loadPayoutsScreen() {
  console.log("Loading payouts screen...");

  try {
    // Загружаем проекты
    const projResponse = await api.getProjects();
    projectsData = projResponse.projects || [];

    // Загружаем финансы
    const finResponse = await api.getFinances();
    payoutsData = finResponse.finances || [];

  } catch (error) {
    console.error("Error loading payouts:", error);
    notify("Ошибка загрузки данных", "error");
  }
}

function renderPayments() {
  const user = state.currentUser;
  if (!user || user.role !== "manager") {
    return '<div class="empty-state"><div class="empty-state-icon">🔒</div>Доступ только для менеджера</div>';
  }

  // Группируем выплаты по пользователям
  const userPayouts = {};

  payoutsData.forEach((fin) => {
    const project = projectsData.find((p) => p.id === fin.project_id);
    if (!project) return;

    Object.keys(fin.payouts).forEach((userId) => {
      const payout = fin.payouts[userId];
      if (payout.remaining > 0) {
        if (!userPayouts[userId]) {
          userPayouts[userId] = [];
        }
        userPayouts[userId].push({
          finance_id: fin.id,
          project_id: fin.project_id,
          project_name: project.name,
          total_due: payout.total_due,
          paid: payout.paid,
          remaining: payout.remaining,
          status: payout.status,
        });
      }
    });
  });

  // Сортируем пользователей
  const sortedUsers = Object.keys(userPayouts).sort((a, b) => {
    const totalA = userPayouts[a].reduce((s, p) => s + p.remaining, 0);
    const totalB = userPayouts[b].reduce((s, p) => s + p.remaining, 0);
    return totalB - totalA;
  });

  if (sortedUsers.length === 0) {
    return `
            <div class="screen-title">💳 Выплаты</div>
            <div class="empty-state">
                <div class="empty-state-icon">✅</div>
                <div>Все выплаты выполнены!</div>
            </div>
        `;
  }

  return `
        <div class="screen-title">💳 Выплаты</div>
        
        ${sortedUsers
          .map((userId) => {
            const payouts = userPayouts[userId];
            const totalRemaining = payouts.reduce((s, p) => s + p.remaining, 0);
            const userName = getUserName(userId);
            const initial = userName.charAt(0);
            const isMe = userId === user.id;

            return `
                <div class="payment-person">
                    <div class="payment-person-header">
                        <div class="payment-person-name">
                            <div class="avatar avatar-sm">${initial}</div>
                            <span>${userName} ${isMe ? "(я)" : ""}</span>
                        </div>
                        <div class="payment-total">${formatMoney(totalRemaining)}</div>
                    </div>
                    
                    ${payouts
                      .map(
                        (p) => `
                        <div class="payment-project">
                            <div class="payment-project-info">
                                <span>📁</span>
                                <span class="payment-project-name">${p.project_name}</span>
                                <span class="payment-project-amount">${formatMoney(p.remaining)}</span>
                            </div>
                            <button class="btn btn-primary btn-sm" onclick="openPaymentModal('${p.finance_id}', '${userId}', ${p.remaining})">
                                💸 ${isMe ? "Себе" : "Выплатить"}
                            </button>
                        </div>
                    `,
                      )
                      .join("")}
                </div>
            `;
          })
          .join("")}
    `;
}

function getUserName(userId) {
  const names = {
    u_001: "Макс (Админ)",
    u_002: "Максим",
    u_003: "Андрей",
    u_004: "Лев",
  };
  return names[userId] || userId;
}

async function openPaymentModal(financeId, userId, remaining) {
  const user = state.currentUser;
  const userName = getUserName(userId);

  // Загружаем реквизиты получателя
  let requisites = { value: "Не указаны", desc: "" };
  try {
    const reqResponse = await api.getRequisites();
    if (reqResponse.requisites && reqResponse.requisites[userId]) {
      requisites = reqResponse.requisites[userId];
    }
  } catch (error) {
    console.error("Error loading requisites:", error);
  }

  openModal(`
        <div class="modal-header">
            <div class="modal-title">Выплата: ${userName}</div>
            <button class="modal-close" onclick="closeModal()">×</button>
        </div>
        
        <div class="form-group">
            <label class="form-label">Сумма выплаты</label>
            <input type="number" class="form-input" id="paymentAmount" 
                   value="${remaining}" min="1" max="${remaining}" step="1">
            <div style="font-size:12px;color:var(--text-dim);margin-top:4px">
                К выплате: <strong>${formatMoney(remaining)}</strong>
            </div>
        </div>
        
        <div style="margin-bottom:16px;padding:12px;background:var(--glass-bg);border-radius:12px">
            <div style="font-size:13px;color:var(--text-dim);margin-bottom:6px">Реквизиты получателя</div>
            <div style="font-size:14px;margin-bottom:4px">📱 ${requisites.value}</div>
            ${requisites.desc ? `<div style="font-size:12px;color:var(--text-dim)">💬 ${requisites.desc}</div>` : ""}
        </div>
        
        <div class="modal-actions">
            <button class="btn btn-secondary" onclick="closeModal()">Отмена</button>
            <button class="btn btn-primary" onclick="processPayment('${financeId}', '${userId}')">💸 Выплатить</button>
        </div>
    `);
}

async function processPayment(financeId, userId) {
  const amountInput = $("#paymentAmount");
  const amount = parseInt(amountInput.value);

  if (!amount || amount <= 0) {
    notify("Введите корректную сумму", "error");
    return;
  }

  // Находим проект для этой выплаты
  const fin = payoutsData.find((f) => f.id === financeId);
  if (!fin) {
    notify("Выплата не найдена", "error");
    return;
  }

  const payout = fin.payouts[userId];
  if (amount > payout.remaining) {
    notify("Сумма превышает остаток", "error");
    return;
  }

  try {
    const response = await api.registerPayout(fin.project_id, userId, amount);

    if (response.success) {
      closeModal();
      notify(`Выплачено ${formatMoney(amount)}`);
      await loadPayoutsScreen();
      await render()
    } else {
      notify(
        "Ошибка: " + (response.error || "Не удалось выполнить выплату"),
        "error",
      );
    }
  } catch (error) {
    notify("Ошибка: " + error.message, "error");
  }
}
