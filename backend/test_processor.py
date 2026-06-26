import processor

# Тест 1: Получить всех пользователей
print("=== Тест 1: Получение пользователей ===")
users = processor.get_users()
print(f"Найдено пользователей: {len(users)}")
for user in users:
    print(f"  - {user['name']} ({user['role']})")

# Тест 2: Получить пользователя по telegram_id
print("\n=== Тест 2: Поиск по telegram_id ===")
user = processor.get_user_by_telegram_id(222222222)  # Замени на реальный ID
if user:
    print(f"Найден: {user['name']}")
else:
    print("Не найден")

# Тест 3: Создать проект
print("\n=== Тест 3: Создание проекта ===")
project_id = processor.create_project({
    "name": "Тестовый проект",
    "description": "Описание тестового проекта",
    "client_name": "Тестовый клиент",
    "total_budget": 50000,
    "deadline": "2024-12-31",
    "notes": "Тестовые примечания",
    "status": "in_progress",
    "created_by": "u_004"
})
print(f"Создан проект с ID: {project_id}")

# Тест 4: Получить проект
print("\n=== Тест 4: Получение проекта ===")
project = processor.get_project_by_id(project_id)
print(f"Проект: {project['name']}, бюджет: {project['total_budget']}")

# Тест 5: Создать задачу
print("\n=== Тест 5: Создание задачи ===")
task_id = processor.create_task({
    "project_id": project_id,
    "title": "Тестовая задача",
    "cost": 5000,
    "assignee_id": "u_002",
    "created_by": "u_002"
})
print(f"Создана задача с ID: {task_id}")

# Тест 6: Получить задачи
print("\n=== Тест 6: Получение задач ===")
tasks = processor.get_tasks(project_id=project_id)
print(f"Найдено задач: {len(tasks)}")
for task in tasks:
    print(f"  - {task['title']} (статус: {task['status']})")

# Тест 7: Завершить задачу
print("\n=== Тест 7: Завершение задачи ===")
success = processor.complete_task(task_id)
print(f"Задача завершена: {success}")

# Тест 8: Логирование
print("\n=== Тест 8: Логирование ===")
processor.log_action("u_002", "TEST_ACTION", "test_001", "Это тест")
print("Действие залогировано")

# Тест 9: Получить лог
print("\n=== Тест 9: Получение лога ===")
logs = processor.get_activity_log(5)
print(f"Последние {len(logs)} записей:")
for log in logs:
    print(f"  {log.strip()}")

print("\n✅ Все тесты завершены!")