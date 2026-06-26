import os
import asyncio
import logging
from datetime import datetime
from dotenv import load_dotenv

# Telegram
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import WebAppInfo
from aiogram.utils.keyboard import InlineKeyboardBuilder

# FastAPI
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

# Наши модули
import auth
import processor
import calculator

# Загружаем .env
load_dotenv()

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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

# Middleware для логирования запросов
@app.middleware("http")
async def log_requests(request, call_next):
    logger.info(f"REQUEST: {request.method} {request.url}")
    response = await call_next(request)
    logger.info(f"RESPONSE: {response.status_code}")
    return response

# Статические файлы (фронтенд)
frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend')
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")

# Диагностика путей
logger.info(f"Текущая директория: {os.path.dirname(__file__)}")
logger.info(f"Путь к frontend: {frontend_path}")
logger.info(f"Frontend существует: {os.path.exists(frontend_path)}")
if os.path.exists(frontend_path):
    logger.info(f"Содержимое frontend: {os.listdir(frontend_path)}")
    
# ============================================================
# HEALTH CHECK (ВАЖНО: ДОЛЖЕН БЫТЬ ПЕРЕД ДРУГИМИ ENDPOINTS)
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
async def auth_telegram(request: dict):
    """Авторизация через Telegram initData"""
    try:
        init_data = request.get("initData")
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
        logger.error(f"Auth error: {e}")
        return {"success": False, "detail": str(e)}


@app.post("/api/auth/admin")
async def auth_admin(request: dict):
    """Авторизация админа"""
    try:
        username = request.get("username")
        password = request.get("password")
        
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
async def create_project(request: dict, session_id: str = None):
    """Создать проект"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user or user["role"] not in ["manager", "admin"]:
        return {"error": "Access denied"}
    
    project_id = processor.create_project({
        "name": request.get("name"),
        "description": request.get("description", ""),
        "client_name": request.get("client_name"),
        "total_budget": request.get("total_budget"),
        "deadline": request.get("deadline"),
        "notes": request.get("notes", ""),
        "status": "in_progress",
        "created_by": user["id"]
    })
    
    if not project_id:
        return {"error": "Failed to create project"}
    
    calculator.initialize_fractions_for_project(project_id, request.get("total_budget"))
    
    processor.log_action(
        user["id"], "CREATED_PROJECT", project_id,
        f"name={request.get('name')} budget={request.get('total_budget')}"
    )
    
    return {"success": True, "project_id": project_id}


@app.patch("/api/projects/{project_id}")
async def update_project(project_id: str, request: dict, session_id: str = None):
    """Обновить проект"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user or user["role"] not in ["manager", "admin"]:
        return {"error": "Access denied"}
    
    old_project = processor.get_project_by_id(project_id)
    success = processor.update_project(project_id, request)
    
    if not success:
        return {"error": "Failed to update project"}
    
    changes = [f"{k}={old_project.get(k)}->{v}" for k, v in request.items()]
    processor.log_action(user["id"], "UPDATED_PROJECT", project_id, " ".join(changes))
    
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
async def create_task(request: dict, session_id: str = None):
    """Создать задачу"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user or user["role"] not in ["lead_developer", "admin"]:
        return {"error": "Access denied"}
    
    project_id = request.get("project_id")
    is_valid, tasks_sum, pool = calculator.validate_tasks_sum(project_id)
    
    new_cost = request.get("cost", 0)
    if tasks_sum + new_cost > pool:
        return {"error": f"Превышена сумма задач. Доступно: {pool - tasks_sum}₽"}
    
    task_id = processor.create_task({
        "project_id": project_id,
        "title": request.get("title"),
        "cost": request.get("cost"),
        "assignee_id": request.get("assignee_id"),
        "created_by": user["id"]
    })
    
    if not task_id:
        return {"error": "Failed to create task"}
    
    calculator.update_developer_shares(project_id)
    
    processor.log_action(
        user["id"], "CREATED_TASK", task_id,
        f"project={project_id} title={request.get('title')} cost={request.get('cost')}"
    )
    
    return {"success": True, "task_id": task_id}


@app.patch("/api/tasks/{task_id}")
async def update_task(task_id: str, request: dict, session_id: str = None):
    """Обновить задачу"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    old_task = processor.get_task_by_id(task_id)
    if not old_task:
        return {"error": "Task not found"}
    
    success = processor.update_task(task_id, request)
    if not success:
        return {"error": "Failed to update task"}
    
    if "cost" in request or "assignee_id" in request:
        calculator.update_developer_shares(old_task["project_id"])
    
    changes = [f"{k}={old_task.get(k)}->{v}" for k, v in request.items()]
    processor.log_action(user["id"], "UPDATED_TASK", task_id, " ".join(changes))
    
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
    
    if task["assignee_id"] != user["id"]:
        return {"error": "Only assignee can complete task"}
    
    success = processor.complete_task(task_id)
    if not success:
        return {"error": "Failed to complete task"}
    
    processor.log_action(user["id"], "COMPLETED_TASK", task_id, f"project={task['project_id']}")
    
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
async def register_client_payment(request: dict, session_id: str = None):
    """Поступление от клиента"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user or user["role"] not in ["manager", "admin"]:
        return {"error": "Access denied"}
    
    success = calculator.register_client_payment(
        request.get("project_id"), request.get("amount")
    )
    
    if not success:
        return {"error": "Failed to register payment"}
    
    processor.log_action(
        user["id"], "CLIENT_PAYMENT", request.get("project_id"),
        f"amount={request.get('amount')}"
    )
    
    return {"success": True}


@app.post("/api/finances/payout")
async def register_payout(request: dict, session_id: str = None):
    """Выплата разработчику"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user or user["role"] not in ["manager", "admin"]:
        return {"error": "Access denied"}
    
    success = calculator.register_payout_to_developer(
        request.get("project_id"), request.get("user_id"), request.get("amount")
    )
    
    if not success:
        return {"error": "Failed to register payout"}
    
    processor.log_action(
        user["id"], "PAYOUT", request.get("project_id"),
        f"user={request.get('user_id')} amount={request.get('amount')}"
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
async def update_settings(request: dict, session_id: str = None):
    """Обновить настройки"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    success = processor.update_settings(user["id"], request)
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
    
    return {"requisites": processor.get_requisites(user["id"])}


@app.patch("/api/requisites")
async def update_requisites(request: dict, session_id: str = None):
    """Обновить реквизиты"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    user = auth.get_user_from_session(session_id)
    if not user:
        return {"error": "Invalid session"}
    
    success = processor.update_requisites(user["id"], request)
    return {"success": success}


# ----- POLLING -----

@app.get("/api/updates")
async def get_updates(since: str = None, session_id: str = None):
    """Получить обновления"""
    if not session_id:
        return {"error": "Not authenticated"}
    
    logs = processor.get_activity_log(100)
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

# @app.get("/", response_class=HTMLResponse)
# async def root():
#     """Главная страница"""
#     html_path = os.path.join(frontend_path, 'index.html')
    
#     if not os.path.exists(html_path):
#         return HTMLResponse(content="<h1>Frontend not found</h1>", status_code=404)
    
#     with open(html_path, 'r', encoding='utf-8') as f:
#         return HTMLResponse(content=f.read())

@app.get("/", response_class=HTMLResponse)
async def root():
    """Главная страница - пока просто тестовая"""
    return HTMLResponse(content="""
    <!DOCTYPE html>
    <html>
    <head>
        <title>Test</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
    </head>
    <body style="background: #1a1a1a; color: white; font-family: sans-serif; padding: 2rem;">
        <h1>🎉 FastAPI работает!</h1>
        <p>Если ты видишь эту страницу — значит бот и API на одном домене.</p>
        <p>Telegram WebApp: <span id="tg-status">проверяем...</span></p>
        <script>
            const tg = window.Telegram?.WebApp;
            document.getElementById('tg-status').textContent = tg ? '✅ Работает!' : '❌ Не работает';
        </script>
    </body>
    </html>
    """)


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
        processor.log_action("unknown", "UNAUTHORIZED_ACCESS", f"telegram_id={user.id}")
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
    processor.log_action(db_user['id'], "BOT_START", f"telegram_id={user.id}")


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
    # Используем порт 80 (стандартный HTTP) или из переменной окружения
    port = int(os.getenv("PORT", 80))
    
    logger.info(f"FastAPI port: {port}")
    logger.info(f"PORT env: {os.getenv('PORT', 'not set')}")
    
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
    logger.info("Запуск Telegram бота...")
    try:
        await bot.delete_webhook(drop_pending_updates=True)
        await dp.start_polling(bot)
    finally:
        await bot.session.close()
        logger.info("Бот остановлен")


async def main():
    """Запуск обоих серверов параллельно"""
    logger.info("Запуск приложения...")
    logger.info(f"FastAPI: http://0.0.0.0:8080")
    logger.info(f"WebApp URL: {WEBAPP_URL}")
    
    await asyncio.gather(
        start_fastapi(),
        start_bot()
    )


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Приложение остановлено пользователем")
    except Exception as e:
        logger.error(f"Ошибка: {e}")