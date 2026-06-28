import os
import asyncio
from datetime import datetime
from dotenv import load_dotenv

# Telegram
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

# FastAPI
from fastapi import FastAPI
from fastapi import Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Наши модули
import auth
import processor
import calculator
import activity_log
import system_log

# Загружаем .env
load_dotenv()

# Конфигурация
BOT_TOKEN = os.getenv("BOT_TOKEN")
WEBAPP_URL = os.getenv("WEBAPP_URL", "https://pfetc-bot-chr0maxxx.amvera.io")

if not BOT_TOKEN:
    raise ValueError("BOT_TOKEN not found in .env")

# Инициализация бота
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# Инициализация FastAPI
app = FastAPI(title="Web Studio API", version="1.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Статические файлы (фронтенд)
frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend')
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

# Middleware для логирования запросов
@app.middleware("http")
async def log_requests(request, call_next):
    system_log.info(f"REQUEST: {request.method} {request.url}")
    response = await call_next(request)
    system_log.info(f"RESPONSE: {response.status_code}")
    return response

# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/health")
async def health_check():
    """Health check для Amvera"""
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


# ============================================================
# FASTAPI ENDPOINTS
# ============================================================

# ----- АВТОРИЗАЦИЯ -----

@app.post("/api/auth/telegram")
async def auth_telegram(request: Request):
    """Авторизация через Telegram initData"""
    try:
        data = await request.json()
        init_data = data.get("initData")
        if not init_data:
            return {"success": False, "detail": "initData required"}
        
        result = auth.authenticate_telegram_user(init_data)
        
        if not result:
            return {"success": False, "detail": "Unauthorized"}
        
        user = result["user"]
        session_id = result["session_id"]
        
        return {
            "success": True,
            "user": {
                "id": user["id"],
                "name": user["name"],
                "role": user["role"],
                "can_impersonate": user.get("can_impersonate", False)
            },
            "settings": processor.get_settings(user["id"]),
            "session_id": session_id
        }
    
    except Exception as e:
        system_log.error(f"Auth error: {e}")
        return {"success": False, "detail": str(e)}


@app.post("/api/auth/admin")
async def auth_admin(request: Request):
    """Авторизация админа"""
    try:
        data = await request.json()
        username = data.get("username")
        password = data.get("password")
        
        result = auth.authenticate_admin(username, password)
        
        if not result:
            return {"success": False, "detail": "Invalid credentials"}
        
        user = result["user"]
        session_id = result["session_id"]
        
        return {
            "success": True,
            "user": {
                "id": user["id"],
                "name": user["name"],
                "role": user["role"]
            },
            "session_id": session_id
        }
    
    except Exception as e:
        return {"success": False, "detail": str(e)}


# ----- ПОЛУЧЕНИЕ ПОЛЬЗОВАТЕЛЯ -----

@app.get("/api/me")
async def get_me(session_id: str = None):
    """Получить данные пользователя"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    settings = processor.get_settings(user["id"])
    return {"user": user, "settings": settings}


# ----- ПРОЕКТЫ -----

@app.get("/api/projects")
async def get_projects(session_id: str = None):
    """Получить проекты"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    projects = processor.get_projects()
    
    if user["role"] in ["lead_developer", "developer"]:
        user_projects = []
        for project in projects:
            tasks = processor.get_tasks(project_id=project["id"], assignee_id=user["id"])
            if tasks:
                progress = calculator.calculate_user_progress(project["id"], user["id"])
                user_projects.append({**project, "my_progress": progress})
        return {"projects": user_projects}
    
    return {"projects": projects}


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str, session_id: str = None):
    """Детали проекта"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    summary = calculator.get_project_summary(project_id)
    if not summary:
        return {"error": "Project not found"}
    
    return summary


@app.post("/api/projects")
async def create_project(request: Request, session_id: str = None):
    """Создать проект"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if user["role"] not in ["manager", "admin"]:
        return {"error": "Access denied"}
    
    data = await request.json()
    
    project_id = processor.create_project({
        "name": data.get("name"),
        "description": data.get("description", ""),
        "client_name": data.get("client_name"),
        "total_budget": data.get("total_budget"),
        "deadline": data.get("deadline"),
        "notes": data.get("notes", ""),
        "status": "in_progress",
        "created_by": user["id"]
    })
    
    if not project_id:
        return {"error": "Failed to create project"}
    
    calculator.initialize_fractions_for_project(project_id, data.get("total_budget"))
    
    activity_log.log_action(
        user["id"], "CREATED_PROJECT", project_id,
        f"name={data.get('name')} budget={data.get('total_budget')}"
    )
    
    return {"success": True, "project_id": project_id}


@app.patch("/api/projects/{project_id}")
async def update_project(project_id: str, request: Request, session_id: str = None):
    """Обновить проект"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user or user["role"] not in ["manager", "admin"]:
        return {"error": "Access denied"}
    
    data = await request.json()
    
    old_project = processor.get_project_by_id(project_id)
    if not old_project:
        return {"error": "Project not found"}
    
    # Обновляем проект
    success = processor.update_project(project_id, data)
    
    if not success:
        return {"error": "Failed to update project"}
    
    # Если изменился бюджет — пересчитываем fractions
    if "total_budget" in data:
        new_budget = data["total_budget"]
        old_budget = old_project.get("total_budget", 0)
        
        if new_budget != old_budget:
            system_log.info(f"Budget changed for {project_id}: {old_budget} -> {new_budget}")
            
            # Получаем текущие fractions
            fractions = processor.get_fractions(project_id=project_id)
            
            if fractions:
                # Пересчитываем доли
                base = calculator.calculate_base_fractions(new_budget)
                
                # Обновляем fractions
                processor.update_fractions(project_id, {
                    "total_budget": new_budget,
                    "studio_fund": base["studio_fund"],
                    "manager_share": base["manager_share"],
                    "developers_pool": base["developers_pool"]
                })
                
                system_log.info(f"Fractions updated for {project_id}: pool={base['developers_pool']}")
                
                activity_log.log_action(
                    user["id"], "UPDATED_FRACTIONS", project_id,
                    f"budget={old_budget}->{new_budget} pool={base['developers_pool']}"
                )
    
    # Логируем изменения проекта
    changes = [f"{k}={old_project.get(k)}->{v}" for k, v in data.items() if k != "total_budget"]
    if changes:
        activity_log.log_action(user["id"], "UPDATED_PROJECT", project_id, " ".join(changes))
    
    return {"success": True}


# ----- ЗАДАЧИ -----

@app.get("/api/tasks")
async def get_tasks(project_id: str = None, session_id: str = None):
    """Получить задачи"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    if user["role"] in ["lead_developer", "developer"]:
        tasks = processor.get_tasks(project_id=project_id, assignee_id=user["id"])
    else:
        tasks = processor.get_tasks(project_id=project_id)
    
    return {"tasks": tasks}


@app.post("/api/tasks")
async def create_task(request: Request, session_id: str = None):
    """Создать задачу"""
    try:
        if not session_id:
            return {"error": "Not authenticated"}
        
        user = auth.get_user_from_session(session_id)
        if not user:
            return {"error": "Invalid session"}
        
        if user["role"] not in ["lead_developer", "admin"]:
            return {"error": "Access denied"}
        
        data = await request.json()
        
        project_id = data.get("project_id")
        
        # Валидация суммы задач
        try:
            is_valid, tasks_sum, pool = calculator.validate_tasks_sum(project_id)
        except Exception as e:
            system_log.error(f"validate_tasks_sum error: {e}")
            return {"error": f"Ошибка валидации: {str(e)}"}
        
        new_cost = data.get("cost", 0)
        if tasks_sum + new_cost > pool:
            return {"error": f"Превышена сумма задач. Доступно: {pool - tasks_sum}₽"}
        
        # Создаём задачу
        task_id = processor.create_task({
            "project_id": project_id,
            "title": data.get("title"),
            "cost": data.get("cost"),
            "assignee_id": data.get("assignee_id"),
            "created_by": user["id"]
        })
        
        if not task_id:
            return {"error": "Failed to create task"}
        
        # Обновляем доли
        try:
            calculator.update_developer_shares(project_id)
        except Exception as e:
            system_log.error(f"update_developer_shares error: {e}")
            # Не прерываем — задача уже создана
        
        activity_log.log_action(
            user["id"], "CREATED_TASK", task_id,
            f"project={project_id} title={data.get('title')} cost={data.get('cost')}"
        )
        
        return {"success": True, "task_id": task_id}
    
    except Exception as e:
        system_log.error(f"create_task error: {e}")
        return {"error": f"Internal error: {str(e)}"}


@app.patch("/api/tasks/{task_id}")
async def update_task(task_id: str, request: Request, session_id: str = None):
    """Обновить задачу"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    data = await request.json()
    
    old_task = processor.get_task_by_id(task_id)
    if not old_task:
        return {"error": "Task not found"}
    
    if user["role"] not in ["lead_developer", "admin"]:
        if old_task["assignee_id"] != user["id"]:
            return {"error": "Access denied"}
    
    success = processor.update_task(task_id, data)
    if not success:
        return {"error": "Failed to update task"}
    
    if "cost" in data or "assignee_id" in data:
        calculator.update_developer_shares(old_task["project_id"])
    
    changes = [f"{k}={old_task.get(k)}->{v}" for k, v in data.items()]
    activity_log.log_action(user["id"], "UPDATED_TASK", task_id, " ".join(changes))
    
    return {"success": True}


@app.post("/api/tasks/{task_id}/complete")
async def complete_task(task_id: str, session_id: str = None):
    """Отметить задачу выполненной"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    task = processor.get_task_by_id(task_id)
    if not task:
        return {"error": "Task not found"}
    
    # Проверяем права: исполнитель ИЛИ админ
    if task["assignee_id"] != user["id"] and user["role"] != "admin":
        return {"error": "Only assignee or admin can complete task"}
    
    success = processor.complete_task(task_id)
    if not success:
        return {"error": "Failed to complete task"}
    
    activity_log.log_action(user["id"], "COMPLETED_TASK", task_id, f"project={task['project_id']}")
    
    return {"success": True}


@app.delete("/api/tasks/{task_id}")
async def delete_task(task_id: str, session_id: str = None):
    """Удалить задачу (только для lead_developer и admin)"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    if user["role"] not in ["lead_developer", "admin"]:
        return {"error": "Access denied"}
    
    task = processor.get_task_by_id(task_id)
    if not task:
        return {"error": "Task not found"}
    
    # Удаляем задачу
    success = processor.delete_task(task_id)
    if not success:
        return {"error": "Failed to delete task"}
    
    # Пересчитываем доли
    calculator.update_developer_shares(task["project_id"])
    
    activity_log.log_action(
        user["id"], "DELETED_TASK", task_id,
        f"project={task['project_id']} title={task['title']}"
    )
    
    return {"success": True}


# ----- ФИНАНСЫ -----

@app.get("/api/finances")
async def get_finances(session_id: str = None):
    """Получить финансы"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    if user["role"] in ["lead_developer", "developer"]:
        return calculator.get_user_finance_summary(user["id"])
    
    finances = processor.get_finances()
    return {"finances": finances}


@app.post("/api/finances/client-payment")
async def register_client_payment(request: Request, session_id: str = None):
    """Поступление от клиента"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user or user["role"] not in ["manager", "admin"]:
        return {"error": "Access denied"}
    
    data = await request.json()
    
    success = calculator.register_client_payment(
        data.get("project_id"), data.get("amount")
    )
    
    if not success:
        return {"error": "Failed to register payment"}
    
    activity_log.log_action(
        user["id"], "CLIENT_PAYMENT", data.get("project_id"),
        f"amount={data.get('amount')}"
    )
    
    return {"success": True}


@app.post("/api/finances/payout")
async def register_payout(request: Request, session_id: str = None):
    """Выплата разработчику"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user or user["role"] not in ["manager", "admin"]:
        return {"error": "Access denied"}
    
    data = await request.json()
    
    success = calculator.register_payout_to_developer(
        data.get("project_id"), data.get("user_id"), data.get("amount")
    )
    
    if not success:
        return {"error": "Failed to register payout"}
    
    activity_log.log_action(
        user["id"], "PAYOUT", data.get("project_id"),
        f"user={data.get('user_id')} amount={data.get('amount')}"
    )
    
    return {"success": True}


# ----- НАСТРОЙКИ -----

@app.get("/api/settings")
async def get_settings(session_id: str = None):
    """Получить настройки"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    return {"settings": processor.get_settings(user["id"])}


@app.patch("/api/settings")
async def update_settings(request: Request, session_id: str = None):
    """Обновить настройки"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    data = await request.json()
    
    old_settings = processor.get_settings(user["id"])
    success = processor.update_settings(user["id"], data)
    
    if success:
        changes = []
        for key, value in data.items():
            old_value = old_settings.get(key)
            if old_value != value:
                changes.append(f"{key}={old_value}->{value}")
        
        if changes:
            activity_log.log_action(
                user["id"], 
                "UPDATED_SETTINGS", 
                f"user={user['id']}",
                " ".join(changes)
            )
    
    return {"success": success}


# ----- РЕКВИЗИТЫ -----

@app.get("/api/requisites")
async def get_requisites(session_id: str = None):
    """Получить реквизиты"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    # Возвращаем все реквизиты
    all_requisites = processor.read_json('requisites.json')
    return {"requisites": all_requisites}


@app.patch("/api/requisites")
async def update_requisites(request: Request, session_id: str = None):
    """Обновить реквизиты"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    data = await request.json()
    
    is_obshak = data.get("is_obshak", False)
    
    if is_obshak:
        if user["role"] != "admin":
            return {"error": "Access denied"}
        
        old_requisites = processor.get_requisites("obshak")
        success = processor.update_requisites("obshak", {
            "value": data.get("requisite", ""),
            "description": data.get("description", "")
        })
        
        if success:
            activity_log.log_action(
                user["id"], "UPDATED_REQUISITES", "obshak",
                f"Общак: value={data.get('requisite')}"
            )
        
        return {"success": success}
    else:
        old_requisites = processor.get_requisites(user["id"])
        success = processor.update_requisites(user["id"], {
            "value": data.get("requisite", ""),
            "description": data.get("description", "")
        })
        
        if success:
            changes = []
            if old_requisites.get("value") != data.get("requisite"):
                changes.append(f"value={old_requisites.get('value')}->{data.get('requisite')}")
            if old_requisites.get("description") != data.get("description"):
                changes.append(f"description={old_requisites.get('description')}->{data.get('description')}")
            
            if changes:
                activity_log.log_action(
                    user["id"], "UPDATED_REQUISITES", f"user={user['id']}",
                    " ".join(changes)
                )
        
        return {"success": success}


# ----- ЛОГИ (для админа) -----

@app.get("/api/logs")
async def get_logs(filter: str = 'all', session_id: str = None):
    """Получить логи (только для админа)"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    if user["role"] != "admin":
        return {"error": "Access denied"}
    
    # Проверяем что файл существует
    if not os.path.exists('/data/activity.log'):
        return {"logs": []}
    
    logs = activity_log.get_logs(1000)
    
    if filter != 'all':
        logs = [log for log in logs if filter.upper() in log]
    
    return {"logs": logs}


@app.delete("/api/logs")
async def clear_logs(session_id: str = None):
    """Очистить логи (только для админа)"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    if user["role"] != "admin":
        return {"error": "Access denied"}
    
    # Логируем ДО очистки
    activity_log.log_action(
        user["id"], "CLEARED_LOGS", "system", 
        "All logs cleared by admin"
    )
    
    success = activity_log.clear_logs()
    
    return {"success": success}
    

# ----- POLLING -----

@app.get("/api/updates")
async def get_updates(since: str = None, session_id: str = None):
    """Получить обновления"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    logs = activity_log.get_logs(100)
    updates = []
    
    for log in logs:
        if since and log.split("]")[0][1:] <= since:
            continue
        updates.append(log.strip())
    
    return {
        "hasUpdates": len(updates) > 0,
        "updates": updates,
        "newTimestamp": logs[-1].split("]")[0][1:] if logs else None
    }


# ----- ГЛАВНАЯ СТРАНИЦА -----

@app.get("/", response_class=HTMLResponse)
async def root():
    """Главная страница - отдаём index.html из frontend/"""
    html_path = os.path.join(frontend_path, 'index.html')
    
    if not os.path.exists(html_path):
        return HTMLResponse(content="<h1>Frontend not found</h1>", status_code=404)
    
    with open(html_path, 'r', encoding='utf-8') as f:
        return HTMLResponse(content=f.read())


# ============================================================
# TELEGRAM BOT HANDLERS
# ============================================================

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    user = message.from_user
    db_user = processor.get_user_by_telegram_id(user.id)
    
    if not db_user:
        await message.answer(
            "⛔️ Доступ запрещён.\n\n"
            "Ваш Telegram ID не найден в системе."
        )
        activity_log.log_action("unknown", "UNAUTHORIZED_ACCESS", f"telegram_id={user.id}")
        return
    
    welcome_text = f"""
👋 Привет, {db_user['name']}!

Добро пожаловать в систему управления веб-студией.

Ваша роль: {get_role_name(db_user['role'])}

Нажмите кнопку ниже, чтобы открыть веб-интерфейс:
"""
    
    builder = InlineKeyboardBuilder()
    builder.button(
        text="🚀 Открыть веб-интерфейс",
        web_app=WebAppInfo(url=WEBAPP_URL)
    )
    
    await message.answer(welcome_text, reply_markup=builder.as_markup(), parse_mode="HTML")
    activity_log.log_action(db_user['id'], "BOT_START", f"telegram_id={user.id}")


@dp.message(Command("help"))
async def cmd_help(message: types.Message):
    db_user = processor.get_user_by_telegram_id(message.from_user.id)
    if not db_user:
        await message.answer("⛔️ Доступ запрещён.")
        return
    
    help_text = """
📖 <b>Доступные команды:</b>

/start - Приветствие
/help - Список команд
/menu - Главное меню
/mytasks - Мои задачи
/mybalance - Мой баланс
"""
    
    # Добавляем команды для админа
    if db_user['role'] == 'admin':
        help_text += """
🔧 <b>Команды администратора:</b>

/get_users - users.json
/get_projects - projects.json
/get_tasks - tasks.json
/get_fractions - fractions.json
/get_finances - finances.json
/get_requisites - requisites.json
/get_settings - settings.json
/get_sessions - sessions.json
/get_activity_log - activity.log (логи действий)
/get_system_log - system.log (системные логи)
/get_all - Все файлы
"""
    
    await message.answer(help_text, parse_mode="HTML")


@dp.message(Command("menu"))
async def cmd_menu(message: types.Message):
    db_user = processor.get_user_by_telegram_id(message.from_user.id)
    if not db_user:
        await message.answer("⛔️ Доступ запрещён.")
        return
    
    builder = InlineKeyboardBuilder()
    builder.button(text="🚀 Открыть веб-интерфейс", web_app=WebAppInfo(url=WEBAPP_URL))
    builder.button(text="📋 Мои задачи", callback_data="my_tasks")
    builder.button(text="💰 Мой баланс", callback_data="my_balance")
    builder.adjust(1)
    
    await message.answer(
        "📱 <b>Главное меню</b>",
        reply_markup=builder.as_markup(),
        parse_mode="HTML"
    )


@dp.callback_query(F.data == "my_tasks")
async def callback_my_tasks(callback: types.CallbackQuery):
    await callback.answer()


@dp.callback_query(F.data == "my_balance")
async def callback_my_balance(callback: types.CallbackQuery):
    await callback.answer()


def get_role_name(role: str) -> str:
    roles = {
        'admin': 'Администратор',
        'lead_developer': 'Ведущий разработчик',
        'developer': 'Разработчик',
        'manager': 'Менеджер'
    }
    return roles.get(role, role)


# ============================================================
# ЗАПУСК ОБОИХ СЕРВЕРОВ ОДНОВРЕМЕННО
# ============================================================

async def start_fastapi():
    """Запуск FastAPI сервера"""
    port = int(os.getenv("PORT", 80))
    
    system_log.info(f"FastAPI port: {port}")
    
    config = uvicorn.Config(
        app,
        host="0.0.0.0",
        port=port,
        log_level="info"
    )
    server = uvicorn.Server(config)
    await server.serve()


async def start_bot():
    """Запуск Telegram бота"""
    system_log.info("Запуск Telegram бота...")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
        await bot.session.close()
        system_log.info("Бот остановлен")


async def main():
    """Запуск обоих серверов параллельно"""
    system_log.info("Запуск приложения...")
    system_log.info(f"WebApp URL: {WEBAPP_URL}")
    
    await asyncio.gather(
        start_fastapi(),
        start_bot()
    )


# ===== КОМАНДЫ ДЛЯ АДМИНА: ПОЛУЧЕНИЕ ФАЙЛОВ =====

@dp.message(Command("get_users"))
async def cmd_get_users(message: types.Message):
    """Получить users.json"""
    if not await check_admin(message):
        return
    
    file_path = '/data/users.json'
    await send_file(message, file_path, "users.json")


@dp.message(Command("get_projects"))
async def cmd_get_projects(message: types.Message):
    """Получить projects.json"""
    if not await check_admin(message):
        return
    
    file_path = '/data/projects.json'
    await send_file(message, file_path, "projects.json")


@dp.message(Command("get_tasks"))
async def cmd_get_tasks(message: types.Message):
    """Получить tasks.json"""
    if not await check_admin(message):
        return
    
    file_path = '/data/tasks.json'
    await send_file(message, file_path, "tasks.json")


@dp.message(Command("get_fractions"))
async def cmd_get_fractions(message: types.Message):
    """Получить fractions.json"""
    if not await check_admin(message):
        return
    
    file_path = '/data/fractions.json'
    await send_file(message, file_path, "fractions.json")


@dp.message(Command("get_finances"))
async def cmd_get_finances(message: types.Message):
    """Получить finances.json"""
    if not await check_admin(message):
        return
    
    file_path = '/data/finances.json'  # ← ИСПРАВЛЕНО
    await send_file(message, file_path, "finances.json")


@dp.message(Command("get_requisites"))
async def cmd_get_requisites(message: types.Message):
    """Получить requisites.json"""
    if not await check_admin(message):
        return
    
    file_path = '/data/requisites.json'
    await send_file(message, file_path, "requisites.json")


@dp.message(Command("get_settings"))
async def cmd_get_settings(message: types.Message):
    """Получить settings.json"""
    if not await check_admin(message):
        return
    
    file_path = '/data/settings.json'
    await send_file(message, file_path, "settings.json")


@dp.message(Command("get_sessions"))
async def cmd_get_sessions(message: types.Message):
    """Получить sessions.json"""
    if not await check_admin(message):
        return
    
    file_path = '/data/sessions.json'
    await send_file(message, file_path, "sessions.json")


@dp.message(Command("get_activity_log"))
async def cmd_get_activity_log(message: types.Message):
    """Получить activity.log"""
    if not await check_admin(message):
        return
    
    file_path = '/data/activity.log'
    
    # Создаём файл если его нет
    if not os.path.exists(file_path):
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('')
        await message.answer("⚠️ Файл activity.log не существовал, создан новый (пустой)")
        return
    
    await send_file(message, file_path, "activity.log")
    
    
@dp.message(Command("get_system_log"))
async def cmd_get_system_log(message: types.Message):
    """Получить system.log"""
    if not await check_admin(message):
        return
    
    file_path = '/data/system.log'
    # Создаём файл если его нет
    if not os.path.exists(file_path):
        os.makedirs(os.path.dirname(file_path), exist_ok=True)
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write('')
        await message.answer("⚠️ Файл system.log не существовал, создан новый (пустой)")
        return
    
    await send_file(message, file_path, "system.log")
    

@dp.message(Command("get_all"))
async def cmd_get_all(message: types.Message):
    """Получить все файлы"""
    if not await check_admin(message):
        return
    
    await message.answer("📦 Отправляю все файлы...")
    
    data_dir = '/data'
    files = [
    'users.json', 'projects.json', 'tasks.json', 'fractions.json',
    'finances.json', 'requisites.json', 'settings.json', 
    'sessions.json', 'activity.log', 'system.log'
    ]
    
    for filename in files:
        file_path = os.path.join(data_dir, filename)
        if os.path.exists(file_path):
            try:
                with open(file_path, 'rb') as f:
                    await message.answer_document(
                        types.BufferedInputFile(f.read(), filename=filename),
                        caption=f"📄 {filename}"
                    )
            except Exception as e:
                await message.answer(f"❌ Ошибка отправки {filename}: {str(e)}")
        else:
            await message.answer(f"⚠️ Файл {filename} не найден")
    
    await message.answer("✅ Все файлы отправлены!")


# ===== ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ КОМАНД АДМИНА =====

async def check_admin(message: types.Message) -> bool:
    """Проверяет, является ли пользователь админом"""
    user = processor.get_user_by_telegram_id(message.from_user.id)
    
    if not user or user['role'] != 'admin':
        await message.answer("⛔️ Доступ запрещён. Только для администратора.")
        activity_log.log_action(
            "unknown", "UNAUTHORIZED_COMMAND", 
            f"command={message.text} telegram_id={message.from_user.id}",
            "Attempted admin command"
        )
        return False
    
    return True


async def send_file(message: types.Message, file_path: str, filename: str):
    """Отправляет файл пользователю"""
    if not os.path.exists(file_path):
        await message.answer(f"⚠️ Файл {filename} не найден")
        return
    
    try:
        with open(file_path, 'rb') as f:
            await message.answer_document(
                types.BufferedInputFile(f.read(), filename=filename),
                caption=f"📄 {filename}"
            )
        
        # Логируем скачивание файла
        activity_log.log_action(
            "u_001", "DOWNLOADED_FILE", filename,
            f"telegram_id={message.from_user.id}"
        )
    except Exception as e:
        await message.answer(f"❌ Ошибка отправки файла: {str(e)}")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        system_log.info("Приложение остановлено пользователем")
    except Exception as e:
        system_log.error(f"Ошибка: {e}")