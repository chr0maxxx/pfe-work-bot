from fastapi import FastAPI, HTTPException, Request, Response, Cookie
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
import os

import auth
import processor
import calculator
import activity_log

# Инициализация FastAPI
app = FastAPI(title="Web Studio API", version="1.0")

# CORS middleware (важно для Telegram WebApp)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # В продакшене указать конкретные домены
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем статические файлы (фронтенд)
frontend_path = os.path.join(os.path.dirname(__file__), '..', 'frontend')
if os.path.exists(frontend_path):
    app.mount("/static", StaticFiles(directory=frontend_path), name="static")


# ============= АВТОРИЗАЦИЯ ЧЕРЕЗ TELEGRAM =============

@app.post("/api/auth/telegram")
async def auth_telegram(request: Request):
    """
    Авторизация через Telegram initData
    """
    try:
        data = await request.json()
        init_data = data.get("initData")
        
        if not init_data:
            raise HTTPException(status_code=400, detail="initData is required")
        
        # Авторизуем пользователя
        result = auth.authenticate_telegram_user(init_data)
        
        if not result:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        user = result["user"]
        session_id = result["session_id"]
        
        # Создаём ответ с cookie
        response = JSONResponse(content={
            "success": True,
            "user": {
                "id": user["id"],
                "name": user["name"],
                "role": user["role"],
                "can_impersonate": user.get("can_impersonate", False)
            },
            "settings": processor.get_settings(user["id"])
        })
        
        # Устанавливаем cookie с сессией
        response.set_cookie(
            key="session_id",
            value=session_id,
            httponly=True,
            max_age=auth.SESSION_LIFETIME,
            samesite="lax"
        )
        
        return response
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============= АДМИН-АВТОРИЗАЦИЯ =============

@app.post("/api/auth/admin")
async def auth_admin(request: Request):
    """
    Авторизация администратора по логину/паролю
    """
    try:
        data = await request.json()
        username = data.get("username")
        password = data.get("password")
        
        if not username or not password:
            raise HTTPException(status_code=400, detail="Username and password required")
        
        result = auth.authenticate_admin(username, password)
        
        if not result:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        user = result["user"]
        session_id = result["session_id"]
        
        response = JSONResponse(content={
            "success": True,
            "user": {
                "id": user["id"],
                "name": user["name"],
                "role": user["role"]
            }
        })
        
        response.set_cookie(
            key="session_id",
            value=session_id,
            httponly=True,
            max_age=auth.SESSION_LIFETIME,
            samesite="lax"
        )
        
        return response
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ============= ПРОВЕРКА АВТОРИЗАЦИИ =============

def get_current_user(request: Request) -> dict:
    """
    Получить текущего пользователя из cookie
    """
    session_id = request.cookies.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    user = auth.get_user_from_session(session_id)
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    return user


# ============= ПОЛУЧЕНИЕ ДАННЫХ ПОЛЬЗОВАТЕЛЯ =============

@app.get("/api/me")
async def get_me(request: Request):
    """
    Получить данные текущего пользователя
    """
    user = get_current_user(request)
    settings = processor.get_settings(user["id"])
    
    return {
        "user": user,
        "settings": settings
    }


# ============= ПРОЕКТЫ =============

@app.get("/api/projects")
async def get_projects(request: Request):
    """
    Получить список проектов
    """
    user = get_current_user(request)
    projects = processor.get_projects()
    
    # Для разработчиков показываем только их проекты
    if user["role"] in ["lead_developer", "developer"]:
        # Фильтруем проекты, где есть задачи для этого пользователя
        user_projects = []
        for project in projects:
            tasks = processor.get_tasks(project_id=project["id"], assignee_id=user["id"])
            if tasks:
                # Добавляем информацию о прогрессе
                progress = calculator.calculate_user_progress(project["id"], user["id"])
                project_with_progress = {**project, "my_progress": progress}
                user_projects.append(project_with_progress)
        
        return {"projects": user_projects}
    
    # Для менеджера и админа показываем все проекты
    return {"projects": projects}


@app.get("/api/projects/{project_id}")
async def get_project(project_id: str, request: Request):
    """
    Получить детали проекта
    """
    user = get_current_user(request)
    
    summary = calculator.get_project_summary(project_id)
    
    if not summary:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return summary


@app.post("/api/projects")
async def create_project(request: Request):
    """
    Создать новый проект (только для менеджера и админа)
    """
    user = get_current_user(request)
    
    if user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    data = await request.json()
    
    # Создаём проект
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
        raise HTTPException(status_code=500, detail="Failed to create project")
    
    # Инициализируем доли
    calculator.initialize_fractions_for_project(project_id, data.get("total_budget"))
    
    # Логируем
    activity_log.log_action(
        user["id"],
        "CREATED_PROJECT",
        project_id,
        f"name={data.get('name')} budget={data.get('total_budget')}"
    )
    
    return {"success": True, "project_id": project_id}


@app.patch("/api/projects/{project_id}")
async def update_project(project_id: str, request: Request):
    """
    Обновить проект (только для менеджера и админа)
    """
    user = get_current_user(request)
    
    if user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    data = await request.json()
    
    # Получаем старое значение для логирования
    old_project = processor.get_project_by_id(project_id)
    
    # Обновляем
    success = processor.update_project(project_id, data)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update project")
    
    # Логируем изменения
    changes = []
    for key, value in data.items():
        old_value = old_project.get(key)
        changes.append(f"{key}={old_value}->{value}")
    
    activity_log.log_action(
        user["id"],
        "UPDATED_PROJECT",
        project_id,
        " ".join(changes)
    )
    
    return {"success": True}


# ============= ЗАДАЧИ =============

@app.get("/api/tasks")
async def get_tasks(request: Request, project_id: Optional[str] = None):
    """
    Получить задачи
    """
    user = get_current_user(request)
    
    # Для разработчиков показываем только их задачи
    if user["role"] in ["lead_developer", "developer"]:
        tasks = processor.get_tasks(project_id=project_id, assignee_id=user["id"])
    else:
        tasks = processor.get_tasks(project_id=project_id)
    
    return {"tasks": tasks}


@app.post("/api/tasks")
async def create_task(request: Request):
    """
    Создать новую задачу (только для lead_developer и админа)
    """
    user = get_current_user(request)
    
    if user["role"] not in ["lead_developer", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    data = await request.json()
    
    # Валидация суммы задач
    project_id = data.get("project_id")
    is_valid, tasks_sum, pool = calculator.validate_tasks_sum(project_id)
    
    new_cost = data.get("cost", 0)
    if tasks_sum + new_cost > pool:
        raise HTTPException(
            status_code=400,
            detail=f"Превышена сумма задач. Доступно: {pool - tasks_sum}₽"
        )
    
    # Создаём задачу
    task_id = processor.create_task({
        "project_id": project_id,
        "title": data.get("title"),
        "cost": data.get("cost"),
        "assignee_id": data.get("assignee_id"),
        "created_by": user["id"]
    })
    
    if not task_id:
        raise HTTPException(status_code=500, detail="Failed to create task")
    
    # Обновляем доли разработчиков
    calculator.update_developer_shares(project_id)
    
    # Логируем
    activity_log.log_action(
        user["id"],
        "CREATED_TASK",
        task_id,
        f"project={project_id} title={data.get('title')} cost={data.get('cost')} assignee={data.get('assignee_id')}"
    )
    
    return {"success": True, "task_id": task_id}


@app.patch("/api/tasks/{task_id}")
async def update_task(task_id: str, request: Request):
    """
    Обновить задачу
    """
    user = get_current_user(request)
    data = await request.json()
    
    # Получаем старую задачу
    old_task = processor.get_task_by_id(task_id)
    if not old_task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Проверяем права
    if user["role"] in ["lead_developer", "developer"]:
        # Разработчики могут обновлять только свои задачи
        if old_task["assignee_id"] != user["id"] and user["role"] != "lead_developer":
            raise HTTPException(status_code=403, detail="Access denied")
    
    # Обновляем
    success = processor.update_task(task_id, data)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update task")
    
    # Если изменилась стоимость или исполнитель - пересчитываем доли
    if "cost" in data or "assignee_id" in data:
        calculator.update_developer_shares(old_task["project_id"])
    
    # Логируем
    changes = []
    for key, value in data.items():
        old_value = old_task.get(key)
        changes.append(f"{key}={old_value}->{value}")
    
    activity_log.log_action(
        user["id"],
        "UPDATED_TASK",
        task_id,
        " ".join(changes)
    )
    
    return {"success": True}


@app.post("/api/tasks/{task_id}/complete")
async def complete_task(task_id: str, request: Request):
    """
    Отметить задачу как выполненную
    """
    user = get_current_user(request)
    
    task = processor.get_task_by_id(task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    # Только исполнитель может отметить задачу как выполненную
    if task["assignee_id"] != user["id"]:
        raise HTTPException(status_code=403, detail="Only assignee can complete task")
    
    success = processor.complete_task(task_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to complete task")
    
    activity_log.log_action(
        user["id"],
        "COMPLETED_TASK",
        task_id,
        f"project={task['project_id']}"
    )
    
    return {"success": True}


# ============= ФИНАНСЫ =============

@app.get("/api/finances")
async def get_finances(request: Request):
    """
    Получить финансовую информацию
    """
    user = get_current_user(request)
    
    # Для разработчиков показываем только их финансы
    if user["role"] in ["lead_developer", "developer"]:
        summary = calculator.get_user_finance_summary(user["id"])
        return summary
    
    # Для менеджера показываем все финансы
    finances = processor.get_finances()
    return {"finances": finances}


@app.post("/api/finances/client-payment")
async def register_client_payment(request: Request):
    """
    Зарегистрировать поступление от клиента (только для менеджера)
    """
    user = get_current_user(request)
    
    if user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    data = await request.json()
    project_id = data.get("project_id")
    amount = data.get("amount")
    
    success = calculator.register_client_payment(project_id, amount)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to register payment")
    
    activity_log.log_action(
        user["id"],
        "CLIENT_PAYMENT",
        project_id,
        f"amount={amount}"
    )
    
    return {"success": True}


@app.post("/api/finances/payout")
async def register_payout(request: Request):
    """
    Зарегистрировать выплату разработчику (только для менеджера)
    """
    user = get_current_user(request)
    
    if user["role"] not in ["manager", "admin"]:
        raise HTTPException(status_code=403, detail="Access denied")
    
    data = await request.json()
    project_id = data.get("project_id")
    user_id = data.get("user_id")
    amount = data.get("amount")
    
    success = calculator.register_payout_to_developer(project_id, user_id, amount)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to register payout")
    
    activity_log.log_action(
        user["id"],
        "PAYOUT",
        project_id,
        f"user={user_id} amount={amount}"
    )
    
    return {"success": True}


# ============= НАСТРОЙКИ =============

@app.get("/api/settings")
async def get_settings(request: Request):
    """
    Получить настройки текущего пользователя
    """
    user = get_current_user(request)
    settings = processor.get_settings(user["id"])
    return {"settings": settings}


@app.patch("/api/settings")
async def update_settings(request: Request):
    """
    Обновить настройки текущего пользователя
    """
    user = get_current_user(request)
    data = await request.json()
    
    success = processor.update_settings(user["id"], data)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update settings")
    
    return {"success": True}


# ============= РЕКВИЗИТЫ =============

@app.get("/api/requisites")
async def get_requisites(request: Request):
    """
    Получить реквизиты текущего пользователя
    """
    user = get_current_user(request)
    requisites = processor.get_requisites(user["id"])
    return {"requisites": requisites}


@app.patch("/api/requisites")
async def update_requisites(request: Request):
    """
    Обновить реквизиты текущего пользователя
    """
    user = get_current_user(request)
    data = await request.json()
    
    success = processor.update_requisites(user["id"], data)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update requisites")
    
    return {"success": True}


# ============= REAL-TIME (POLLING) =============

@app.get("/api/updates")
async def get_updates(request: Request, since: Optional[str] = None):
    """
    Получить обновления с указанного времени (для polling)
    """
    user = get_current_user(request)
    
    # Читаем лог активности
    logs = activity_log.get_logs(100)
    
    # Фильтруем логи после timestamp
    updates = []
    for log in logs:
        # Парсим лог: [timestamp] [user_id] ACTION entity_id details
        if since and log.split("]")[0][1:] <= since:
            continue
        updates.append(log.strip())
    
    return {
        "hasUpdates": len(updates) > 0,
        "updates": updates,
        "newTimestamp": logs[-1].split("]")[0][1:] if logs else None
    }


# ============= ГЛАВНАЯ СТРАНИЦА =============

@app.get("/", response_class=HTMLResponse)
async def root():
    """
    Главная страница - отдаём index.html
    """
    html_path = os.path.join(frontend_path, 'index.html')
    
    if not os.path.exists(html_path):
        return HTMLResponse(content="<h1>Frontend not found</h1>", status_code=404)
    
    with open(html_path, 'r', encoding='utf-8') as f:
        return HTMLResponse(content=f.read())


# ============= ЗАПУСК =============

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)