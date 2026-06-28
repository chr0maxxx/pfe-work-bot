import hashlib
import hmac
import json
import os
from dotenv import load_dotenv
import time
from urllib.parse import parse_qs
from typing import Optional, Dict
from datetime import datetime, timedelta
import activity_log
import processor


# ============= КОНФИГУРАЦИЯ =============
BOT_TOKEN = os.getenv("BOT_TOKEN")
SESSION_SECRET = os.getenv("SESSION_SECRET", "default_secret_key")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin123")

# Время жизни сессии (в секундах) - 24 часа
SESSION_LIFETIME = 24 * 60 * 60

# Путь к файлу сессий
SESSIONS_FILE = '/data/sessions.json'


# ============= ПРОВЕРКА TELEGRAM INIT DATA =============

def validate_telegram_init_data(init_data: str) -> Optional[Dict]:
    """
    Проверить подлинность initData от Telegram
    Возвращает словарь с данными пользователя или None если невалидно
    
    Документация: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    """
    try:
        # Парсим query string
        parsed = parse_qs(init_data)
        
        # Извлекаем hash
        received_hash = parsed.get('hash', [None])[0]
        if not received_hash:
            return None
        
        # Удаляем hash из параметров
        parsed.pop('hash')
        
        # Сортируем параметры по ключу и формируем data_check_string
        data_check_arr = []
        for key in sorted(parsed.keys()):
            value = parsed[key][0]
            data_check_arr.append(f"{key}={value}")
        
        data_check_string = "\n".join(data_check_arr)
        
        # Вычисляем secret_key
        secret_key = hmac.new(
            b"WebAppData",
            BOT_TOKEN.encode('utf-8'),
            hashlib.sha256
        ).digest()
        
        # Вычисляем hash
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode('utf-8'),
            hashlib.sha256
        ).hexdigest()
        
        # Сравниваем
        if calculated_hash != received_hash:
            return None
        
        # Проверяем auth_date (не старше 5 минут)
        auth_date = int(parsed.get('auth_date', [0])[0])
        if time.time() - auth_date > 300:  # 5 минут
            return None
        
        # Парсим user data
        user_data_json = parsed.get('user', [None])[0]
        if not user_data_json:
            return None
        
        user_data = json.loads(user_data_json)
        
        return {
            "telegram_id": user_data.get("id"),
            "first_name": user_data.get("first_name", ""),
            "last_name": user_data.get("last_name", ""),
            "username": user_data.get("username", ""),
            "photo_url": user_data.get("photo_url", ""),
            "language_code": user_data.get("language_code", "ru")
        }
    
    except Exception as e:
        print(f"Ошибка валидации initData: {e}")
        return None


# ============= УПРАВЛЕНИЕ СЕССИЯМИ =============

def _load_sessions() -> Dict:
    """Загрузить сессии из файла"""
    if not os.path.exists(SESSIONS_FILE):
        return {}
    
    try:
        with open(SESSIONS_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Ошибка загрузки сессий: {e}")
        return {}


def _save_sessions(sessions: Dict) -> bool:
    """Сохранить сессии в файл"""
    try:
        with open(SESSIONS_FILE, 'w', encoding='utf-8') as f:
            json.dump(sessions, f, ensure_ascii=False, indent=2)
        return True
    except Exception as e:
        print(f"Ошибка сохранения сессий: {e}")
        return False


def create_session(user_id: str) -> str:
    """
    Создать новую сессию для пользователя
    Возвращает session_id
    """
    sessions = _load_sessions()
    
    # Генерируем уникальный session_id
    session_id = hashlib.sha256(
        f"{user_id}_{time.time()}_{SESSION_SECRET}".encode('utf-8')
    ).hexdigest()
    
    # Создаём сессию
    sessions[session_id] = {
        "user_id": user_id,
        "created_at": datetime.now().isoformat(),
        "expires_at": (datetime.now() + timedelta(seconds=SESSION_LIFETIME)).isoformat()
    }
    
    # Сохраняем
    _save_sessions(sessions)
    
    activity_log.log_action(user_id, "SESSION_CREATED", session_id)
    
    return session_id


def validate_session(session_id: str) -> Optional[str]:
    """
    Проверить валидность сессии
    Возвращает user_id если сессия валидна, иначе None
    """
    sessions = _load_sessions()
    
    if session_id not in sessions:
        return None
    
    session = sessions[session_id]
    
    # Проверяем срок действия
    expires_at = datetime.fromisoformat(session["expires_at"])
    if datetime.now() > expires_at:
        # Удаляем просроченную сессию
        delete_session(session_id)
        return None
    
    return session["user_id"]


def delete_session(session_id: str) -> bool:
    """Удалить сессию"""
    sessions = _load_sessions()
    
    if session_id in sessions:
        user_id = sessions[session_id]["user_id"]
        del sessions[session_id]
        _save_sessions(sessions)
        
        activity_log.log_action(user_id, "SESSION_DELETED", session_id)
        return True
    
    return False


def cleanup_expired_sessions() -> int:
    """
    Удалить все просроченные сессии
    Возвращает количество удалённых сессий
    """
    sessions = _load_sessions()
    expired = []
    
    for session_id, session in sessions.items():
        expires_at = datetime.fromisoformat(session["expires_at"])
        if datetime.now() > expires_at:
            expired.append(session_id)
    
    for session_id in expired:
        del sessions[session_id]
    
    _save_sessions(sessions)
    
    return len(expired)


# ============= АВТОРИЗАЦИЯ ЧЕРЕЗ TELEGRAM =============

def authenticate_telegram_user(init_data: str) -> Optional[Dict]:
    """
    Полная авторизация пользователя через Telegram
    1. Проверяет initData
    2. Ищет пользователя в users.json по telegram_id
    3. Создаёт сессию
    4. Возвращает данные пользователя и session_id
    """
    # Проверяем initData
    user_data = validate_telegram_init_data(init_data)
    if not user_data:
        return None
    
    telegram_id = user_data["telegram_id"]
    
    # Ищем пользователя в базе
    user = processor.get_user_by_telegram_id(telegram_id)
    if not user:
        activity_log.log_action(
            "unknown",
            "UNAUTHORIZED_ACCESS",
            f"telegram_id={telegram_id}",
            "User not found in database"
        )
        return None
    
    # Создаём сессию
    session_id = create_session(user["id"])
    
    return {
        "user": user,
        "session_id": session_id,
        "telegram_data": user_data
    }


# ============= АДМИН-АВТОРИЗАЦИЯ (ЛОГИН/ПАРОЛЬ) =============

# Простая проверка пароля (в продакшене использовать хеширование!)
ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123"  # ИЗМЕНИТЬ В ПРОДАКШЕНЕ!


def authenticate_admin(username: str, password: str) -> Optional[Dict]:
    """
    Авторизация администратора по логину/паролю
    """
    if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
        return None
    
    # Находим админа в базе
    users = processor.get_users()
    admin_user = None
    
    for user in users:
        if user["role"] == "admin":
            admin_user = user
            break
    
    if not admin_user:
        return None
    
    # Создаём сессию
    session_id = create_session(admin_user["id"])
    
    activity_log.log_action(admin_user["id"], "ADMIN_LOGIN", session_id)
    
    return {
        "user": admin_user,
        "session_id": session_id
    }


# ============= ПЕРЕКЛЮЧЕНИЕ МЕЖДУ АККАУНТАМИ (ДЛЯ АДМИНА) =============

def impersonate_user(admin_session_id: str, target_user_id: str) -> Optional[str]:
    """
    Админ может переключиться на другой аккаунт
    Возвращает новую сессию для целевого пользователя
    """
    # Проверяем, что текущая сессия принадлежит админу
    admin_user_id = validate_session(admin_session_id)
    if not admin_user_id:
        return None
    
    admin_user = processor.get_user_by_id(admin_user_id)
    if not admin_user or not admin_user.get("can_impersonate"):
        return None
    
    # Проверяем, что целевой пользователь существует
    target_user = processor.get_user_by_id(target_user_id)
    if not target_user:
        return None
    
    # Создаём новую сессию для целевого пользователя
    new_session_id = create_session(target_user_id)
    
    activity_log.log_action(
        admin_user_id,
        "IMPERSONATE",
        target_user_id,
        f"admin_session={admin_session_id} new_session={new_session_id}"
    )
    
    return new_session_id


# ============= УТИЛИТЫ =============

def get_user_from_session(session_id: str) -> Optional[Dict]:
    """
    Получить данные пользователя по session_id
    """
    user_id = validate_session(session_id)
    if not user_id:
        return None
    
    return processor.get_user_by_id(user_id)


def require_auth(session_id: str) -> Dict:
    """
    Проверить авторизацию и вернуть данные пользователя
    Используется в API endpoints
    """
    user = get_user_from_session(session_id)
    if not user:
        raise Exception("Unauthorized")
    
    return user


def require_role(session_id: str, allowed_roles: list) -> Dict:
    """
    Проверить авторизацию и роль пользователя
    """
    user = require_auth(session_id)
    
    if user["role"] not in allowed_roles:
        raise Exception(f"Access denied. Required roles: {allowed_roles}")
    
    return user