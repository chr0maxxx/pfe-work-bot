import json
import os
from datetime import datetime
from typing import List, Dict, Optional, Any

# Путь к папке с данными
DATA_DIR = os.path.join(os.path.dirname(__file__), '..', 'data')

# Убедимся, что папка существует
os.makedirs(DATA_DIR, exist_ok=True)


def _get_file_path(filename: str) -> str:
    """Получить полный путь к файлу"""
    return os.path.join(DATA_DIR, filename)


def read_json(filename: str) -> Dict:
    """
    Прочитать JSON файл
    Возвращает словарь с данными
    """
    filepath = _get_file_path(filename)
    
    if not os.path.exists(filepath):
        return {}
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except json.JSONDecodeError:
        return {}
    except Exception as e:
        print(f"Ошибка чтения {filename}: {e}")
        return {}


def write_json(filename: str, data: Dict) -> bool:
    """
    Записать данные в JSON файл
    Возвращает True если успешно
    """
    filepath = _get_file_path(filename)
    
    try:
        # Атомарная запись: пишем во временный файл, потом переименовываем
        temp_filepath = filepath + '.tmp'
        
        with open(temp_filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        # Переименовываем (атомарная операция на большинстве ОС)
        os.replace(temp_filepath, filepath)
        return True
    
    except Exception as e:
        print(f"Ошибка записи {filename}: {e}")
        return False


# ============= USERS =============

def get_users() -> List[Dict]:
    """Получить всех пользователей"""
    data = read_json('users.json')
    return data.get('users', [])


def get_user_by_id(user_id: str) -> Optional[Dict]:
    """Получить пользователя по ID"""
    users = get_users()
    for user in users:
        if user['id'] == user_id:
            return user
    return None


def get_user_by_telegram_id(telegram_id: int) -> Optional[Dict]:
    """Получить пользователя по telegram_id"""
    users = get_users()
    for user in users:
        if user['telegram_id'] == telegram_id:
            return user
    return None


# ============= SETTINGS =============

def get_settings(user_id: str) -> Dict:
    """Получить настройки пользователя"""
    data = read_json('settings.json')
    return data.get(user_id, {})


def update_settings(user_id: str, settings: Dict) -> bool:
    """Обновить настройки пользователя"""
    data = read_json('settings.json')
    data[user_id] = settings
    return write_json('settings.json', data)


# ============= PROJECTS =============

def get_projects() -> List[Dict]:
    """Получить все проекты"""
    data = read_json('projects.json')
    return data.get('projects', [])


def get_project_by_id(project_id: str) -> Optional[Dict]:
    """Получить проект по ID"""
    projects = get_projects()
    for project in projects:
        if project['id'] == project_id:
            return project
    return None


def create_project(project_data: Dict) -> Optional[str]:
    """
    Создать новый проект
    Возвращает ID проекта или None если ошибка
    """
    projects = get_projects()
    
    # Генерируем ID
    project_id = f"p_{len(projects) + 1:03d}"
    project_data['id'] = project_id
    project_data['created_at'] = datetime.now().isoformat()
    
    projects.append(project_data)
    
    if write_json('projects.json', {'projects': projects}):
        return project_id
    return None


def update_project(project_id: str, updates: Dict) -> bool:
    """Обновить проект"""
    projects = get_projects()
    
    for i, project in enumerate(projects):
        if project['id'] == project_id:
            projects[i].update(updates)
            return write_json('projects.json', {'projects': projects})
    
    return False


# ============= TASKS =============

def get_tasks(project_id: Optional[str] = None, assignee_id: Optional[str] = None) -> List[Dict]:
    """
    Получить задачи с фильтрацией
    project_id - фильтр по проекту
    assignee_id - фильтр по исполнителю
    """
    data = read_json('tasks.json')
    tasks = data.get('tasks', [])
    
    if project_id:
        tasks = [t for t in tasks if t['project_id'] == project_id]
    
    if assignee_id:
        tasks = [t for t in tasks if t['assignee_id'] == assignee_id]
    
    return tasks


def get_task_by_id(task_id: str) -> Optional[Dict]:
    """Получить задачу по ID"""
    tasks = get_tasks()
    for task in tasks:
        if task['id'] == task_id:
            return task
    return None


def create_task(task_data: Dict) -> Optional[str]:
    """Создать новую задачу"""
    data = read_json('tasks.json')
    tasks = data.get('tasks', [])
    
    # Генерируем ID
    task_id = f"t_{len(tasks) + 1:03d}"
    task_data['id'] = task_id
    task_data['created_at'] = datetime.now().isoformat()
    task_data['status'] = 'pending'
    task_data['column'] = 'backlog'
    
    tasks.append(task_data)
    
    if write_json('tasks.json', {'tasks': tasks}):
        return task_id
    return None


def update_task(task_id: str, updates: Dict) -> bool:
    """Обновить задачу"""
    data = read_json('tasks.json')
    tasks = data.get('tasks', [])
    
    for i, task in enumerate(tasks):
        if task['id'] == task_id:
            tasks[i].update(updates)
            return write_json('tasks.json', {'tasks': tasks})
    
    return False


def complete_task(task_id: str) -> bool:
    """Отметить задачу как выполненную"""
    return update_task(task_id, {
        'status': 'done',
        'column': 'done',
        'completed_at': datetime.now().isoformat()
    })
    
def delete_task(task_id: str) -> bool:
    """Удалить задачу"""
    data = read_json('tasks.json')
    tasks = data.get('tasks', [])
    
    original_count = len(tasks)
    tasks = [t for t in tasks if t['id'] != task_id]
    
    if len(tasks) == original_count:
        return False  # Задача не найдена
    
    return write_json('tasks.json', {'tasks': tasks})


# ============= FRACTIONS =============

def get_fractions(project_id: Optional[str] = None) -> List[Dict]:
    """Получить распределение долей"""
    data = read_json('fractions.json')
    fractions = data.get('fractions', [])
    
    if project_id:
        fractions = [f for f in fractions if f['project_id'] == project_id]
    
    return fractions


def create_fractions(fraction_data: Dict) -> Optional[str]:
    """Создать распределение долей для проекта"""
    data = read_json('fractions.json')
    fractions = data.get('fractions', [])
    
    fraction_id = f"f_{len(fractions) + 1:03d}"
    fraction_data['id'] = fraction_id
    fraction_data['calculated_at'] = datetime.now().isoformat()
    
    fractions.append(fraction_data)
    
    if write_json('fractions.json', {'fractions': fractions}):
        return fraction_id
    return None


def update_fractions(project_id: str, updates: Dict) -> bool:
    """Обновить распределение долей"""
    data = read_json('fractions.json')
    fractions = data.get('fractions', [])
    
    for i, fraction in enumerate(fractions):
        if fraction['project_id'] == project_id:
            fractions[i].update(updates)
            return write_json('fractions.json', {'fractions': fractions})
    
    return False


# ============= FINANCES =============

def get_finances(project_id: Optional[str] = None) -> List[Dict]:
    """Получить финансовые записи"""
    data = read_json('finances.json')
    finances = data.get('finances', [])
    
    if project_id:
        finances = [f for f in finances if f['project_id'] == project_id]
    
    return finances


def create_finance(finance_data: Dict) -> Optional[str]:
    """Создать финансовую запись"""
    data = read_json('finances.json')
    finances = data.get('finances', [])
    
    finance_id = f"fin_{len(finances) + 1:03d}"
    finance_data['id'] = finance_id
    finance_data['last_updated'] = datetime.now().isoformat()
    
    finances.append(finance_data)
    
    if write_json('finances.json', {'finances': finances}):
        return finance_id
    return None


def update_finance(finance_id: str, updates: Dict) -> bool:
    """Обновить финансовую запись"""
    data = read_json('finances.json')
    finances = data.get('finances', [])
    
    for i, finance in enumerate(finances):
        if finance['id'] == finance_id:
            finances[i].update(updates)
            finances[i]['last_updated'] = datetime.now().isoformat()
            return write_json('finances.json', {'finances': finances})
    
    return False


# ============= REQUISITES =============

def get_requisites(user_id: str) -> Dict:
    """Получить реквизиты пользователя"""
    data = read_json('requisites.json')
    return data.get(user_id, {})


def update_requisites(user_id: str, requisites: Dict) -> bool:
    """Обновить реквизиты пользователя"""
    data = read_json('requisites.json')
    data[user_id] = requisites
    return write_json('requisites.json', data)