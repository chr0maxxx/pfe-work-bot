// ===== DATA STORE =====
const defaultData = {
    users: {
        max: { name: 'Максим', role: 'Lead Developer', color: '#4a90e2', email: 'max@studio.com', telegram: '123456789', percent: 37 },
        andrey: { name: 'Андрей', role: 'Developer', color: '#50c878', email: 'andrey@studio.com', telegram: '987654321', percent: 30 },
        lev: { name: 'Лев', role: 'Manager', color: '#f5a623', email: 'lev@studio.com', telegram: '555555555', percent: 28 },
        kotyel: { name: 'Котёл', role: 'Co-founder', color: '#9b59b6', percent: 15 }
    },
    projects: [
        { id: 1, name: 'Сайт ООО "Ромашка"', client: 'ООО "Ромашка"', totalBudget: 150000, status: 'active' },
        { id: 2, name: 'Интернет-магазин TechStore', client: 'TechStore', totalBudget: 280000, status: 'active' },
        { id: 3, name: 'Лендинг для стартапа', client: 'StartupX', totalBudget: 60000, status: 'active' },
        { id: 4, name: 'Корпоративный портал', client: 'АО "Мега"', totalBudget: 200000, status: 'completed' }
    ],
    tasks: [
        { id: 1, name: 'Сверстать хедер', desc: 'Сверстать хедер по макету из Figma с адаптивом под мобильные', projectId: 1, assignee: 'andrey', cost: 5000, deadline: '2024-12-15', status: 'progress' },
        { id: 2, name: 'Настроить бэкенд API', desc: 'Создать REST API для авторизации и работы с данными', projectId: 1, assignee: 'max', cost: 15000, deadline: '2024-12-20', status: 'progress' },
        { id: 3, name: 'Дизайн главной страницы', desc: 'Создать макет главной страницы в Figma', projectId: 1, assignee: 'max', cost: 10000, deadline: '2024-12-10', status: 'done' },
        { id: 4, name: 'Каталог товаров', desc: 'Реализовать страницу каталога с фильтрами', projectId: 2, assignee: 'andrey', cost: 12000, deadline: '2024-12-25', status: 'backlog' },
        { id: 5, name: 'Корзина и оформление', desc: 'Реализовать корзину и страницу оформления заказа', projectId: 2, assignee: 'max', cost: 18000, deadline: '2025-01-05', status: 'backlog' },
        { id: 6, name: 'Интеграция оплаты', desc: 'Подключить платёжную систему ЮKassa', projectId: 2, assignee: 'max', cost: 8000, deadline: '2025-01-10', status: 'backlog' },
        { id: 7, name: 'Анимации и интерактив', desc: 'Добавить анимации при скролле и hover-эффекты', projectId: 3, assignee: 'andrey', cost: 4000, deadline: '2024-12-18', status: 'progress' },
        { id: 8, name: 'SEO оптимизация', desc: 'Провести базовую SEO-оптимизацию', projectId: 3, assignee: 'max', cost: 3000, deadline: '2024-12-22', status: 'backlog' },
        { id: 9, name: 'Тестирование', desc: 'Провести кроссбраузерное тестирование', projectId: 1, assignee: 'andrey', cost: 5000, deadline: '2024-12-28', status: 'backlog' },
        { id: 10, name: 'Деплой на сервер', desc: 'Настроить CI/CD и задеплоить проект', projectId: 4, assignee: 'max', cost: 7000, deadline: '2024-11-30', status: 'done' }
    ],
    incomes: [
        { id: 1, projectId: 4, amount: 200000, date: '2024-11-15', comment: 'Полная оплата корпоративного портала' },
        { id: 2, projectId: 1, amount: 75000, date: '2024-11-20', comment: 'Первый транш - Сайт ООО Ромашка' },
        { id: 3, projectId: 2, amount: 140000, date: '2024-12-01', comment: '50% предоплата - TechStore' }
    ],
    expenses: [
        { id: 1, category: 'hosting', amount: 5000, date: '2024-11-01', comment: 'Хостинг на ноябрь' },
        { id: 2, category: 'tools', amount: 3000, date: '2024-11-10', comment: 'Подписка Figma' },
        { id: 3, category: 'tools', amount: 2000, date: '2024-12-01', comment: 'GitHub Enterprise' }
    ],
    payments: [
        { userId: 'max', amount: 74000, status: 'paid', date: '2024-11-25' },
        { userId: 'andrey', amount: 60000, status: 'paid', date: '2024-11-25' },
        { userId: 'lev', amount: 56000, status: 'paid', date: '2024-11-25' },
        { userId: 'max', amount: 29785, status: 'pending' },
        { userId: 'andrey', amount: 24150, status: 'pending' },
        { userId: 'lev', amount: 22400, status: 'pending' }
    ]
};

// Load data from localStorage or use defaults
let appData = JSON.parse(localStorage.getItem('webstudio_data')) || JSON.parse(JSON.stringify(defaultData));
let currentUser = null;
let currentTaskId = null;
let draggedTaskId = null;

function saveData() {
    localStorage.setItem('webstudio_data', JSON.stringify(appData));
}

// ===== AUTH =====
function login(userId) {
    currentUser = userId;
    localStorage.setItem('webstudio_currentUser', userId);
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('app').classList.add('active');
    initApp();
}

function logout() {
    currentUser = null;
    localStorage.removeItem('webstudio_currentUser');
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('app').classList.remove('active');
}

function checkAuth() {
    const saved = localStorage.getItem('webstudio_currentUser');
    if (saved && appData.users[saved]) {
        login(saved);
    }
}

// ===== INIT =====
function initApp() {
    const user = appData.users[currentUser];
    document.getElementById('headerAvatar').textContent = user.name[0];
    document.getElementById('headerAvatar').style.background = `linear-gradient(135deg, ${user.color}, ${user.color}dd)`;
    document.getElementById('headerName').textContent = user.name;
    document.getElementById('headerRole').textContent = user.role;

    // Show team section for Lev
    document.getElementById('teamSection').style.display = currentUser === 'lev' ? 'block' : 'none';

    renderAll();
}

function renderAll() {
    renderDashboard();
    renderKanban();
    renderFinance();
    renderSettings();
    populateProjectFilters();
}

// ===== NAVIGATION =====
function navigateTo(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageMap = {
        'dashboard': 'pageDashboard',
        'tasks': 'pageTasks',
        'finance': 'pageFinance',
        'settings': 'pageSettings',
        'history': 'pageHistory'
    };

    document.getElementById(pageMap[page]).classList.add('active');
    const navBtn = document.querySelector(`.nav-item[data-page="${page}"]`);
    if (navBtn) navBtn.classList.add('active');
}

function showHistory() {
    renderHistory();
    navigateTo('history');
}

// ===== DASHBOARD =====
function renderDashboard() {
    const user = appData.users[currentUser];
    const userTasks = appData.tasks.filter(t => t.assignee === currentUser && t.status !== 'done');
    const activeList = document.getElementById('activeTasksList');

    if (userTasks.length === 0) {
        activeList.innerHTML = '<div class="empty-state"><p>Нет активных задач 🎉</p></div>';
    } else {
        activeList.innerHTML = userTasks.map(task => {
            const project = appData.projects.find(p => p.id === task.projectId);
            return `
                <div class="task-item" onclick="openTaskDetail(${task.id})">
                    <div class="checkbox ${task.status === 'done' ? 'checked' : ''}" onclick="event.stopPropagation(); toggleTaskDone(${task.id})"></div>
                    <div class="task-info">
                        <div class="task-name">${task.name}</div>
                        <div class="task-project">${project ? project.name : 'Без проекта'}</div>
                    </div>
                    <div class="task-cost">${task.cost.toLocaleString()}₽</div>
                </div>
            `;
        }).join('');
    }

    // Project progress
    const userProjects = appData.projects.filter(p => p.status === 'active');
    const progressContainer = document.getElementById('projectProgress');

    progressContainer.innerHTML = userProjects.map(project => {
        const projectTasks = appData.tasks.filter(t => t.projectId === project.id);
        const doneTasks = projectTasks.filter(t => t.status === 'done').length;
        const totalTasks = projectTasks.length;
        const progress = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
        const userShare = Math.round(project.totalBudget * (user.percent / 100));

        return `
            <div class="progress-item" onclick="openProjectDetail(${project.id})">
                <div class="progress-header">
                    <span class="progress-name">${project.name}</span>
                    <span class="progress-stats">${progress}% | ${userShare.toLocaleString()}₽</span>
                </div>
                <div class="progress-bar">
                    <div class="fill" style="width: ${progress}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderHistory() {
    const doneTasks = appData.tasks.filter(t => t.assignee === currentUser && t.status === 'done');
    const list = document.getElementById('historyTasksList');

    if (doneTasks.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>Нет выполненных задач</p></div>';
    } else {
        list.innerHTML = doneTasks.map(task => {
            const project = appData.projects.find(p => p.id === task.projectId);
            return `
                <div class="task-item" onclick="openTaskDetail(${task.id})">
                    <div class="checkbox checked"></div>
                    <div class="task-info">
                        <div class="task-name">${task.name}</div>
                        <div class="task-project">${project ? project.name : 'Без проекта'}</div>
                    </div>
                    <div class="task-cost">${task.cost.toLocaleString()}₽</div>
                </div>
            `;
        }).join('');
    }
}

function openProjectDetail(projectId) {
    const project = appData.projects.find(p => p.id === projectId);
    if (!project) return;
    const tasks = appData.tasks.filter(t => t.projectId === projectId);
    alert(`Проект: ${project.name}\nКлиент: ${project.client}\nБюджет: ${project.totalBudget.toLocaleString()}₽\nЗадач: ${tasks.length}`);
}

// ===== KANBAN =====
function renderKanban() {
    const filter = document.getElementById('projectFilter').value;
    let tasks = appData.tasks.filter(t => t.assignee === currentUser || currentUser === 'max');

    if (filter !== 'all') {
        tasks = tasks.filter(t => t.projectId === parseInt(filter));
    }

    const backlog = tasks.filter(t => t.status === 'backlog');
    const progress = tasks.filter(t => t.status === 'progress');
    const done = tasks.filter(t => t.status === 'done');

    document.getElementById('countBacklog').textContent = backlog.length;
    document.getElementById('countProgress').textContent = progress.length;
    document.getElementById('countDone').textContent = done.length;

    document.getElementById('cardsBacklog').innerHTML = backlog.map(t => renderKanbanCard(t)).join('');
    document.getElementById('cardsProgress').innerHTML = progress.map(t => renderKanbanCard(t)).join('');
    document.getElementById('cardsDone').innerHTML = done.map(t => renderKanbanCard(t)).join('');
}

function renderKanbanCard(task) {
    const project = appData.projects.find(p => p.id === task.projectId);
    const assignee = appData.users[task.assignee];
    return `
        <div class="kanban-card" draggable="true" ondragstart="handleDragStart(event, ${task.id})" ondragend="handleDragEnd(event)" onclick="openTaskDetail(${task.id})">
            <div class="card-task-name">${task.name}</div>
            <div class="card-detail">📁 ${project ? project.name : 'Без проекта'}</div>
            <div class="card-detail">📅 ${formatDate(task.deadline)}</div>
            <div class="card-footer">
                <span class="card-cost">${task.cost.toLocaleString()}₽</span>
                <div class="card-assignee" style="background: ${assignee ? assignee.color : '#666'}">${assignee ? assignee.name[0] : '?'}</div>
            </div>
        </div>
    `;
}

function filterKanban() {
    renderKanban();
}

function populateProjectFilters() {
    const select = document.getElementById('projectFilter');
    const taskSelect = document.getElementById('newTaskProject');
    const incomeSelect = document.getElementById('incomeProject');

    const options = appData.projects.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
    select.innerHTML = '<option value="all">Все проекты</option>' + options;
    taskSelect.innerHTML = options;
    incomeSelect.innerHTML = options;
}

// Drag & Drop
function handleDragStart(event, taskId) {
    draggedTaskId = taskId;
    event.target.classList.add('dragging');
    event.dataTransfer.effectAllowed = 'move';
}

function handleDragEnd(event) {
    event.target.classList.remove('dragging');
    document.querySelectorAll('.kanban-column').forEach(col => col.classList.remove('drag-over'));
}

function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('drag-over');
}

function handleDragLeave(event) {
    event.currentTarget.classList.remove('drag-over');
}

function handleDrop(event, newStatus) {
    event.preventDefault();
    event.currentTarget.classList.remove('drag-over');

    if (draggedTaskId) {
        const task = appData.tasks.find(t => t.id === draggedTaskId);
        if (task) {
            task.status = newStatus;
            saveData();
            renderKanban();
            renderDashboard();
        }
        draggedTaskId = null;
    }
}

function toggleTaskDone(taskId) {
    const task = appData.tasks.find(t => t.id === taskId);
    if (task) {
        task.status = task.status === 'done' ? 'progress' : 'done';
        saveData();
        renderAll();
    }
}

// ===== TASK MODALS =====
function openCreateTaskModal() {
    document.getElementById('newTaskName').value = '';
    document.getElementById('newTaskDesc').value = '';
    document.getElementById('newTaskCost').value = '';
    document.getElementById('newTaskDeadline').value = '';
    document.getElementById('modalCreateTask').classList.add('active');
}

function createTask() {
    const name = document.getElementById('newTaskName').value.trim();
    const desc = document.getElementById('newTaskDesc').value.trim();
    const projectId = parseInt(document.getElementById('newTaskProject').value);
    const cost = parseInt(document.getElementById('newTaskCost').value) || 0;
    const deadline = document.getElementById('newTaskDeadline').value;
    const assignee = document.getElementById('newTaskAssignee').value;

    if (!name) {
        alert('Введите название задачи');
        return;
    }

    const newTask = {
        id: Date.now(),
        name,
        desc,
        projectId,
        assignee,
        cost,
        deadline,
        status: 'backlog'
    };

    appData.tasks.push(newTask);
    saveData();
    closeModal('modalCreateTask');
    renderAll();
}

function openTaskDetail(taskId) {
    currentTaskId = taskId;
    const task = appData.tasks.find(t => t.id === taskId);
    if (!task) return;

    const project = appData.projects.find(p => p.id === task.projectId);
    const assignee = appData.users[task.assignee];
    const statusLabels = { backlog: 'Предстоящая', progress: 'В работе', done: 'Выполнена' };

    document.getElementById('detailTaskName').textContent = task.name;
    document.getElementById('detailProject').textContent = project ? project.name : '—';
    document.getElementById('detailAssignee').textContent = assignee ? assignee.name : '—';
    document.getElementById('detailCost').textContent = task.cost.toLocaleString() + '₽';
    document.getElementById('detailDeadline').textContent = formatDate(task.deadline);
    document.getElementById('detailStatus').textContent = statusLabels[task.status] || task.status;
    document.getElementById('detailDescription').textContent = task.desc || 'Описание отсутствует';

    document.getElementById('modalTaskDetail').classList.add('active');
}

function deleteTask() {
    if (currentTaskId && confirm('Удалить задачу?')) {
        appData.tasks = appData.tasks.filter(t => t.id !== currentTaskId);
        saveData();
        closeModal('modalTaskDetail');
        renderAll();
    }
}

// ===== FINANCE =====
function renderFinance() {
    const container = document.getElementById('financeContent');

    if (currentUser === 'lev') {
        renderManagerFinance(container);
    } else {
        renderDeveloperFinance(container);
    }
}

function renderDeveloperFinance(container) {
    const user = appData.users[currentUser];
    const userTasks = appData.tasks.filter(t => t.assignee === currentUser);
    const totalExpected = userTasks.reduce((sum, t) => sum + t.cost, 0);
    const doneTasks = userTasks.filter(t => t.status === 'done');
    const totalReceived = doneTasks.reduce((sum, t) => sum + t.cost, 0);

    const userPayments = appData.payments.filter(p => p.userId === currentUser);

    container.innerHTML = `
        <div class="finance-summary">
            <div class="finance-card">
                <div class="label">Ожидаемый доход</div>
                <div class="value accent">${totalExpected.toLocaleString()}₽</div>
            </div>
            <div class="finance-card">
                <div class="label">Получено</div>
                <div class="value income">${totalReceived.toLocaleString()}₽</div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Мои проекты</h3>
            </div>
            <div class="payment-list">
                ${appData.projects.filter(p => p.status === 'active').map(project => {
        const projectTasks = userTasks.filter(t => t.projectId === project.id);
        const projectCost = projectTasks.reduce((sum, t) => sum + t.cost, 0);
        const allDone = projectTasks.length > 0 && projectTasks.every(t => t.status === 'done');
        return `
                            <div class="payment-item">
                                <div class="pay-info">
                                    <span>${project.name}</span>
                                </div>
                                <div style="display:flex;align-items:center;gap:10px">
                                    <span class="pay-amount">${projectCost.toLocaleString()}₽</span>
                                    <span class="status-badge ${allDone ? 'paid' : 'pending'}">${allDone ? 'Получено ✅' : 'Ожидается ⏳'}</span>
                                </div>
                            </div>
                        `;
    }).join('')}
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">История выплат</h3>
            </div>
            <div class="history-list">
                ${userPayments.filter(p => p.status === 'paid').map(p => `
                    <div class="history-item">
                        <div class="hist-left">
                            <span class="hist-date">${formatDate(p.date)}</span>
                            <span>Выплата</span>
                        </div>
                        <span style="color:var(--success);font-weight:700">${p.amount.toLocaleString()}₽ ✅</span>
                    </div>
                `).join('') || '<div class="empty-state"><p>Нет записей</p></div>'}
            </div>
        </div>
    `;
}

function renderManagerFinance(container) {
    const totalIncome = appData.incomes.reduce((sum, i) => sum + i.amount, 0);
    const totalExpense = appData.expenses.reduce((sum, e) => sum + e.amount, 0);
    const netProfit = totalIncome - totalExpense;

    container.innerHTML = `
        <div class="finance-summary">
            <div class="finance-card">
                <div class="label">Поступления</div>
                <div class="value income">${totalIncome.toLocaleString()}₽</div>
            </div>
            <div class="finance-card">
                <div class="label">Расходы</div>
                <div class="value expense">${totalExpense.toLocaleString()}₽</div>
            </div>
            <div class="finance-card">
                <div class="label">Чистая прибыль</div>
                <div class="value accent">${netProfit.toLocaleString()}₽</div>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Распределение по участникам</h3>
            </div>
            <div class="distribution-list">
                ${Object.entries(appData.users).map(([key, user]) => {
        const amount = Math.round(netProfit * (user.percent / 100));
        return `
                        <div class="distribution-item">
                            <div class="dist-left">
                                <div class="dist-avatar" style="background: ${user.color}">${user.name[0]}</div>
                                <div>
                                    <div class="dist-name">${user.name}</div>
                                    <div class="dist-percent">${user.percent}%</div>
                                </div>
                            </div>
                            <div class="dist-amount">${amount.toLocaleString()}₽</div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Кому должен выплатить</h3>
            </div>
            <div class="payment-list">
                ${appData.payments.filter(p => p.status === 'pending').map(p => {
        const user = appData.users[p.userId];
        return `
                        <div class="payment-item">
                            <div class="pay-info">
                                <div class="dist-avatar" style="background: ${user.color};width:32px;height:32px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:12px;color:white">${user.name[0]}</div>
                                <span>${user.name}</span>
                            </div>
                            <div style="display:flex;align-items:center;gap:10px">
                                <span class="pay-amount">${p.amount.toLocaleString()}₽</span>
                                <button class="btn btn-success btn-sm" onclick="markPaid(${p.userId}, ${p.amount})">Выплатить 💸</button>
                            </div>
                        </div>
                    `;
    }).join('') || '<div class="empty-state"><p>Все выплаты произведены ✅</p></div>'}
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">История операций</h3>
            </div>
            <div class="history-list">
                ${[...appData.incomes.map(i => ({ ...i, type: 'income' })), ...appData.expenses.map(e => ({ ...e, type: 'expense' }))]
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10)
            .map(op => `
                        <div class="history-item">
                            <div class="hist-left">
                                <span class="hist-date">${formatDate(op.date)}</span>
                                <span>${op.type === 'income' ? '📥 Поступление' : '📤 Расход'}: ${op.comment || ''}</span>
                            </div>
                            <span style="color:${op.type === 'income' ? 'var(--success)' : 'var(--danger)'};font-weight:700">
                                ${op.type === 'income' ? '+' : '-'}${op.amount.toLocaleString()}₽
                            </span>
                        </div>
                    `).join('')}
            </div>
        </div>
        <div style="display:flex;gap:12px;flex-wrap:wrap">
            <button class="btn btn-primary" onclick="openAddIncomeModal()">+ Добавить поступление</button>
            <button class="btn btn-secondary" onclick="openAddExpenseModal()">+ Добавить расход</button>
        </div>
    `;
}

function markPaid(userId, amount) {
    const payment = appData.payments.find(p => p.userId === userId && p.amount === amount && p.status === 'pending');
    if (payment) {
        payment.status = 'paid';
        payment.date = new Date().toISOString().split('T')[0];
        saveData();
        renderFinance();
    }
}

function openAddIncomeModal() {
    document.getElementById('incomeAmount').value = '';
    document.getElementById('incomeDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('incomeComment').value = '';
    document.getElementById('modalAddIncome').classList.add('active');
}

function addIncome() {
    const projectId = parseInt(document.getElementById('incomeProject').value);
    const amount = parseInt(document.getElementById('incomeAmount').value);
    const date = document.getElementById('incomeDate').value;
    const comment = document.getElementById('incomeComment').value;

    if (!amount || amount <= 0) {
        alert('Введите корректную сумму');
        return;
    }

    appData.incomes.push({
        id: Date.now(),
        projectId,
        amount,
        date,
        comment
    });
    saveData();
    closeModal('modalAddIncome');
    renderFinance();
}

function openAddExpenseModal() {
    document.getElementById('expenseAmount').value = '';
    document.getElementById('expenseDate').value = new Date().toISOString().split('T')[0];
    document.getElementById('expenseComment').value = '';
    document.getElementById('modalAddExpense').classList.add('active');
}

function addExpense() {
    const category = document.getElementById('expenseCategory').value;
    const amount = parseInt(document.getElementById('expenseAmount').value);
    const date = document.getElementById('expenseDate').value;
    const comment = document.getElementById('expenseComment').value;

    if (!amount || amount <= 0) {
        alert('Введите корректную сумму');
        return;
    }

    appData.expenses.push({
        id: Date.now(),
        category,
        amount,
        date,
        comment
    });
    saveData();
    closeModal('modalAddExpense');
    renderFinance();
}

// ===== SETTINGS =====
function renderSettings() {
    const user = appData.users[currentUser];
    document.getElementById('profileName').value = user.name;
    document.getElementById('profileEmail').value = user.email || '';
    document.getElementById('profileTelegram').value = user.telegram || '';

    if (currentUser === 'lev') {
        const teamList = document.getElementById('teamList');
        teamList.innerHTML = Object.entries(appData.users).map(([key, u]) => `
            <div class="team-member">
                <div class="member-info">
                    <div class="member-avatar" style="background: ${u.color}">${u.name[0]}</div>
                    <div>
                        <div style="font-weight:600">${u.name}</div>
                        <div style="font-size:12px;color:var(--text-secondary)">${u.role} • ${u.percent}%</div>
                    </div>
                </div>
                <button class="btn btn-secondary btn-sm" onclick="alert('Редактирование ${u.name}')">Редакт.</button>
            </div>
        `).join('');
    }
}

function changeTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('webstudio_theme', theme);
}

function changeAccent(color, el) {
    document.documentElement.style.setProperty('--accent', color);
    document.querySelectorAll('.color-option').forEach(o => o.classList.remove('active'));
    el.classList.add('active');
    localStorage.setItem('webstudio_accent', color);
}

function saveProfile() {
    const user = appData.users[currentUser];
    user.name = document.getElementById('profileName').value;
    user.email = document.getElementById('profileEmail').value;
    user.telegram = document.getElementById('profileTelegram').value;
    saveData();
    document.getElementById('headerName').textContent = user.name;
    alert('Профиль сохранён ✅');
}

// ===== UTILS =====
function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear()}`;
}

// Close modals on overlay click
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            overlay.classList.remove('active');
        }
    });
});

// Load saved theme
const savedTheme = localStorage.getItem('webstudio_theme');
if (savedTheme) {
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeSelect = document.getElementById('themeSelect');
    if (themeSelect) themeSelect.value = savedTheme;
}

const savedAccent = localStorage.getItem('webstudio_accent');
if (savedAccent) {
    document.documentElement.style.setProperty('--accent', savedAccent);
}

// Init
checkAuth();