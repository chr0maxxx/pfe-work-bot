import os
from datetime import datetime

LOG_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'activity.log')

def log_action(user_id: str, action: str, entity_id: str = '', details: str = ''):
    """Записать действие в лог"""
    timestamp = datetime.now().isoformat()
    log_entry = f"[{timestamp}] [{user_id}] {action} {entity_id} {details}\n"
    
    try:
        # Создаём директорию если её нет
        os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)
        
        # Добавляем в конец файла (не перезаписываем!)
        with open(LOG_FILE, 'a', encoding='utf-8') as f:
            f.write(log_entry)
    except Exception as e:
        print(f"Error writing to activity log: {e}")

def get_logs(limit: int = 100) -> list:
    """Получить последние логи"""
    if not os.path.exists(LOG_FILE):
        return []
    
    try:
        with open(LOG_FILE, 'r', encoding='utf-8') as f:
            lines = f.readlines()
            return [line.strip() for line in lines[-limit:]][::-1]
    except Exception as e:
        print(f"Error reading activity logs: {e}")
        return []

def clear_logs():
    """Очистить логи"""
    try:
        with open(LOG_FILE, 'w', encoding='utf-8') as f:
            f.write('')
        return True
    except Exception as e:
        print(f"Error clearing activity logs: {e}")
        return False