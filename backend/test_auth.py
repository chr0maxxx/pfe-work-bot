import auth
import processor

print("=== Тест 1: Создание сессии ===")
session_id = auth.create_session("u_002")
print(f"Создана сессия: {session_id[:20]}...")

print("\n=== Тест 2: Валидация сессии ===")
user_id = auth.validate_session(session_id)
print(f"Пользователь: {user_id}")

print("\n=== Тест 3: Получение данных пользователя ===")
user = auth.get_user_from_session(session_id)
print(f"Имя: {user['name']}, Роль: {user['role']}")

print("\n=== Тест 4: Удаление сессии ===")
success = auth.delete_session(session_id)
print(f"Сессия удалена: {success}")

print("\n=== Тест 5: Валидация удалённой сессии ===")
user_id = auth.validate_session(session_id)
print(f"Пользователь: {user_id} (должно быть None)")

print("\n=== Тест 6: Админ-авторизация ===")
admin_data = auth.authenticate_admin("admin", "admin123")
admin_session = None  # Инициализируем переменную

if admin_data:
    print(f"Админ авторизован: {admin_data['user']['name']}")
    print(f"Сессия: {admin_data['session_id'][:20]}...")
    admin_session = admin_data["session_id"]  # Сохраняем для последующих тестов
else:
    print("Ошибка авторизации")

print("\n=== Тест 7: Неверный пароль ===")
admin_data_wrong = auth.authenticate_admin("admin", "wrong_password")
print(f"Результат: {admin_data_wrong} (должно быть None)")

print("\n=== Тест 8: Переключение на другой аккаунт (имперсонация) ===")
if admin_session:
    new_session = auth.impersonate_user(admin_session, "u_003")
    if new_session:
        user = auth.get_user_from_session(new_session)
        print(f"Переключились на: {user['name']}")
        print(f"Новая сессия: {new_session[:20]}...")
    else:
        print("Ошибка имперсонации")
else:
    print("Пропущено: админ не авторизован")

print("\n=== Тест 9: Проверка роли ===")
if admin_session:
    try:
        user = auth.require_role(admin_session, ["admin"])
        print(f"Роль подтверждена: {user['role']}")
    except Exception as e:
        print(f"Ошибка: {e}")
else:
    print("Пропущено: админ не авторизован")

print("\n=== Тест 10: Очистка просроченных сессий ===")
count = auth.cleanup_expired_sessions()
print(f"Удалено просроченных сессий: {count}")

print("\n✅ Все тесты авторизации завершены!")