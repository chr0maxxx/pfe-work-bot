import processor
import calculator

print("=== Тест 1: Расчёт базовых долей ===")
base = calculator.calculate_base_fractions(50000)
print(f"Бюджет: 50000₽")
print(f"  Котёл (15%): {base['studio_fund']}₽")
print(f"  Лев (28%): {base['manager_share']}₽")
print(f"  Разрабы (57%): {base['developers_pool']}₽")
print(f"  Сумма: {base['studio_fund'] + base['manager_share'] + base['developers_pool']}₽")

print("\n=== Тест 2: Создание проекта и инициализация долей ===")
project_id = processor.create_project({
    "name": "Тест калькулятора",
    "description": "Тестовый проект для калькулятора",
    "client_name": "Тест",
    "total_budget": 100000,
    "status": "in_progress",
    "created_by": "u_004"
})
print(f"Создан проект: {project_id}")

fraction_id = calculator.initialize_fractions_for_project(project_id, 100000)
print(f"Инициализированы доли: {fraction_id}")

fractions = processor.get_fractions(project_id=project_id)
print(f"Доли: {fractions[0]}")

print("\n=== Тест 3: Создание задач и валидация ===")
task1_id = processor.create_task({
    "project_id": project_id,
    "title": "Дизайн",
    "cost": 20000,
    "assignee_id": "u_002",
    "created_by": "u_002"
})
print(f"Создана задача 1: {task1_id} (20000₽, Макс)")

task2_id = processor.create_task({
    "project_id": project_id,
    "title": "Бэкенд",
    "cost": 25000,
    "assignee_id": "u_003",
    "created_by": "u_002"
})
print(f"Создана задача 2: {task2_id} (25000₽, Андрей)")

task3_id = processor.create_task({
    "project_id": project_id,
    "title": "Фронтенд",
    "cost": 12000,
    "assignee_id": "u_002",
    "created_by": "u_002"
})
print(f"Создана задача 3: {task3_id} (12000₽, Макс)")

print("\n=== Тест 4: Валидация суммы задач ===")
is_valid, tasks_sum, pool = calculator.validate_tasks_sum(project_id)
print(f"Сумма задач: {tasks_sum}₽")
print(f"Пул разработчиков: {pool}₽")
print(f"Валидно: {is_valid}")

remaining = calculator.get_remaining_pool(project_id)
print(f"Осталось распределить: {remaining}₽")

print("\n=== Тест 5: Обновление долей разработчиков ===")
success = calculator.update_developer_shares(project_id)
print(f"Доли обновлены: {success}")

fractions = processor.get_fractions(project_id=project_id)
print(f"Доли Макса: {fractions[0]['developer_shares']['u_002']}₽")
print(f"Доли Андрея: {fractions[0]['developer_shares']['u_003']}₽")

print("\n=== Тест 6: Инициализация финансов ===")
finance_id = calculator.initialize_finance_for_project(project_id)
print(f"Финансы инициализированы: {finance_id}")

finances = processor.get_finances(project_id=project_id)
print(f"Финансы: {finances[0]}")

print("\n=== Тест 7: Прогресс проекта ===")
progress = calculator.calculate_project_progress(project_id)
print(f"Общий прогресс: {progress['progress_percent']}%")
print(f"  Макс: {progress['max_progress']['progress_percent']}% ({progress['max_progress']['done_count']}/{progress['max_progress']['total_count']})")
print(f"  Андрей: {progress['andrey_progress']['progress_percent']}% ({progress['andrey_progress']['done_count']}/{progress['andrey_progress']['total_count']})")

print("\n=== Тест 8: Завершение задачи и пересчёт прогресса ===")
processor.complete_task(task1_id)
print(f"Задача 1 завершена")

progress = calculator.calculate_project_progress(project_id)
print(f"Новый прогресс: {progress['progress_percent']}%")
print(f"  Макс: {progress['max_progress']['progress_percent']}% ({progress['max_progress']['done_count']}/{progress['max_progress']['total_count']})")

print("\n=== Тест 9: Поступление от клиента ===")
calculator.register_client_payment(project_id, 50000)
print(f"Клиент заплатил 50000₽")

finances = processor.get_finances(project_id=project_id)
print(f"Всего оплачено клиентом: {finances[0]['client_paid_total']}₽")

print("\n=== Тест 10: Выплата разработчику ===")
calculator.register_payout_to_developer(project_id, "u_002", 10000)
print(f"Выплачено Максу 10000₽")

finances = processor.get_finances(project_id=project_id)
payout = finances[0]["payouts"]["u_002"]
print(f"Макс: должен {payout['total_due']}₽, получено {payout['paid']}₽, осталось {payout['remaining']}₽, статус: {payout['status']}")

print("\n=== Тест 11: Частичная выплата ===")
calculator.register_payout_to_developer(project_id, "u_002", 22000)
print(f"Выплачено Максу ещё 22000₽")

finances = processor.get_finances(project_id=project_id)
payout = finances[0]["payouts"]["u_002"]
print(f"Макс: должен {payout['total_due']}₽, получено {payout['paid']}₽, осталось {payout['remaining']}₽, статус: {payout['status']}")

print("\n=== Тест 12: Сводка по проекту ===")
summary = calculator.get_project_summary(project_id)
print(f"Проект: {summary['project']['name']}")
print(f"Бюджет: {summary['project']['total_budget']}₽")
print(f"Оплачено клиентом: {summary['client_paid']}₽")
print(f"Осталось от клиента: {summary['client_remaining']}₽")
print(f"Прогресс: {summary['progress']['progress_percent']}%")

print("\n=== Тест 13: Сводка по пользователю ===")
user_summary = calculator.get_user_finance_summary("u_002")
print(f"Макс:")
print(f"  Всего должен получить: {user_summary['total_due']}₽")
print(f"  Всего получено: {user_summary['total_paid']}₽")
print(f"  Всего осталось: {user_summary['total_remaining']}₽")

print("\n=== Тест 14: Проверка завершения финансов ===")
is_completed = calculator.check_project_finance_completed(project_id)
print(f"Все выплаты сделаны: {is_completed}")

# Завершаем все выплаты
calculator.register_payout_to_developer(project_id, "u_003", 25000)
calculator.register_payout_to_developer(project_id, "u_004", 28000)

is_completed = calculator.check_project_finance_completed(project_id)
print(f"После всех выплат: {is_completed}")

print("\n✅ Все тесты калькулятора завершены!")