import os
from datetime import datetime

LOG_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'activity.log')

def log_action(user_id: str, action: str, entity_id: str = '', details: str = ''):
    """
    Записать действие в лог
    
    Args:
        user_id: ID пользователя (или 'system', 'unknown')
        action: Тип действия (CREATED_TASK, UPDATED_PROJECT, etc.)
        entity_id: ID сущности (project_id, task_id, etc.)
        details: Дополнительные детали
    """
    timestamp = datetime.now().isoformat()
    log_entry = f"[{timestamp}] [{user_id}] {action} {entity_id} {details}\n"
    
    try:
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(log_entry)
    except Exception as e:
        print(f"Error writing to log: {e}")

def get_logs(limit: int = 100) -> list:
    """
    Получить последние логи
    
    Args:
        limit: Максимальное количество записей
    
    Returns:
        Список строк логов (от новых к старым)
    """
    if not os.path.exists(LOG_FILE):
        return []
    
    try:
        with open(LOG_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            return [line.strip() for line in lines[-limit:]][::-1]
    except Exception as e:
        print(f"Error reading logs: {e}")
        return []

def clear_logs():
    """Очистить все логи"""
    try:
        with open(LOG_FILE, 'w', encoding='utf-8') as f:
            f.write('')
        return True
    except Exception as e:
        print(f"Error clearing logs: {e}")
        return False