import processor
import activity_log
import system_log
from typing import Dict, List, Tuple, Optional


# ============= КОНСТАНТЫ =============

STUDIO_PERCENTAGE = 15  # % в котёл
MANAGER_PERCENTAGE = 28  # % менеджеру (Лев)
DEVELOPERS_PERCENTAGE = 57  # % разработчикам (Макс + Андрей)


# ============= РАСЧЁТ БАЗОВЫХ ДОЛЕЙ =============

def calculate_base_fractions(total_budget: float) -> Dict[str, float]:
    """
    Рассчитать базовые доли от общего бюджета проекта
    Возвращает: studio_fund, manager_share, developers_pool
    """
    studio_fund = round(total_budget * STUDIO_PERCENTAGE / 100, 2)
    manager_share = round(total_budget * MANAGER_PERCENTAGE / 100, 2)
    developers_pool = round(total_budget * DEVELOPERS_PERCENTAGE / 100, 2)
    
    return {
        "studio_fund": studio_fund,
        "manager_share": manager_share,
        "developers_pool": developers_pool
    }


# ============= СОЗДАНИЕ FRACTIONS ДЛЯ ПРОЕКТА =============

def initialize_fractions_for_project(project_id: str, total_budget: float) -> Optional[str]:
    """
    Создать начальное распределение долей для нового проекта
    Вызывается после создания проекта Львом
    """
    base = calculate_base_fractions(total_budget)
    
    fraction_data = {
        "project_id": project_id,
        "total_budget": total_budget,
        "studio_fund": base["studio_fund"],
        "manager_share": base["manager_share"],
        "developers_pool": base["developers_pool"],
        "developer_shares": {
            "u_002": 0,  # Макс
            "u_003": 0   # Андрей
        }
    }
    
    fraction_id = processor.create_fractions(fraction_data)
    
    if fraction_id:
        activity_log.log_action(
            "system", 
            "INITIALIZED_FRACTIONS", 
            fraction_id, 
            f"project={project_id} budget={total_budget} pool={base['developers_pool']}"
        )
    
    return fraction_id


# ============= ВАЛИДАЦИЯ ЗАДАЧ =============

def validate_tasks_sum(project_id: str) -> Tuple[bool, float, float]:
    """
    Проверить, что сумма задач не превышает пул разработчиков
    Возвращает: (валидно, сумма_задач, доступный_пул)
    """
    try:
        fractions = processor.get_fractions(project_id=project_id)
        if not fractions:
            system_log.warning(f"Fractions not found for project {project_id}")
            return False, 0, 0
        
        fraction = fractions[0]
        developers_pool = fraction.get("developers_pool", 0)
        
        tasks = processor.get_tasks(project_id=project_id)
        tasks_sum = sum(task.get("cost", 0) for task in tasks)
        
        is_valid = tasks_sum <= developers_pool
        
        return is_valid, tasks_sum, developers_pool
    
    except Exception as e:
        system_log.error(f"validate_tasks_sum error: {e}")
        return False, 0, 0


def get_remaining_pool(project_id: str) -> float:
    """
    Получить оставшуюся сумму для распределения задач
    """
    is_valid, tasks_sum, developers_pool = validate_tasks_sum(project_id)
    remaining = developers_pool - tasks_sum
    return max(0, remaining)  # Не возвращаем отрицательные значения


# ============= ОБНОВЛЕНИЕ ДОЛЕЙ РАЗРАБОТЧИКОВ =============

def update_developer_shares(project_id: str) -> bool:
    """
    Пересчитать доли разработчиков на основе задач
    Вызывается после создания/обновления/удаления задачи
    """
    tasks = processor.get_tasks(project_id=project_id)
    
    # Считаем сумму задач по каждому разработчику
    shares = {}
    for task in tasks:
        assignee_id = task["assignee_id"]
        if assignee_id not in shares:
            shares[assignee_id] = 0
        shares[assignee_id] += task["cost"]
    
    # Убеждаемся, что оба разработчика есть в shares
    if "u_002" not in shares:
        shares["u_002"] = 0
    if "u_003" not in shares:
        shares["u_003"] = 0
    
    # Валидация
    is_valid, tasks_sum, developers_pool = validate_tasks_sum(project_id)
    if not is_valid:
        print(f"Ошибка: сумма задач ({tasks_sum}) превышает пул ({developers_pool})")
        return False
    
    # Обновляем fractions
    success = processor.update_fractions(project_id, {
        "developer_shares": shares
    })
    
    if success:
        activity_log.log_action(
            "system",
            "UPDATED_SHARES",
            project_id,
            f"u_002={shares.get('u_002', 0)} u_003={shares.get('u_003', 0)}"
        )
    
    return success


# ============= ПРОГРЕСС ПРОЕКТА =============

def calculate_user_progress(project_id: str, user_id: str) -> Dict:
    """
    Рассчитать прогресс конкретного пользователя по проекту
    Возвращает: {progress_percent, done_count, total_count, done_cost, total_cost}
    """
    tasks = processor.get_tasks(project_id=project_id, assignee_id=user_id)
    
    if not tasks:
        return {
            "progress_percent": 0,
            "done_count": 0,
            "total_count": 0,
            "done_cost": 0,
            "total_cost": 0
        }
    
    total_cost = sum(task["cost"] for task in tasks)
    done_tasks = [t for t in tasks if t["status"] == "done"]
    done_cost = sum(task["cost"] for task in done_tasks)
    done_count = len(done_tasks)
    total_count = len(tasks)
    
    progress_percent = round((done_cost / total_cost) * 100, 1) if total_cost > 0 else 0
    
    return {
        "progress_percent": progress_percent,
        "done_count": done_count,
        "total_count": total_count,
        "done_cost": done_cost,
        "total_cost": total_cost
    }


def calculate_project_progress(project_id: str) -> Dict:
    """
    Рассчитать общий прогресс проекта (оба разработчика)
    """
    max_progress = calculate_user_progress(project_id, "u_002")
    andrey_progress = calculate_user_progress(project_id, "u_003")
    
    total_done_cost = max_progress["done_cost"] + andrey_progress["done_cost"]
    total_cost = max_progress["total_cost"] + andrey_progress["total_cost"]
    total_done_count = max_progress["done_count"] + andrey_progress["done_count"]
    total_count = max_progress["total_count"] + andrey_progress["total_count"]
    
    progress_percent = round((total_done_cost / total_cost) * 100, 1) if total_cost > 0 else 0
    
    return {
        "progress_percent": progress_percent,
        "done_count": total_done_count,
        "total_count": total_count,
        "done_cost": total_done_cost,
        "total_cost": total_cost,
        "max_progress": max_progress,
        "andrey_progress": andrey_progress
    }


# ============= ФИНАНСЫ: ИНИЦИАЛИЗАЦИЯ =============

def initialize_finance_for_project(project_id: str) -> Optional[str]:
    """
    Создать финансовую запись для проекта после распределения задач
    """
    fractions = processor.get_fractions(project_id=project_id)
    if not fractions:
        return None
    
    fraction = fractions[0]
    
    finance_data = {
        "project_id": project_id,
        "client_paid_total": 0,
        "payouts": {
            "u_002": {
                "total_due": fraction["developer_shares"].get("u_002", 0),
                "paid": 0,
                "remaining": fraction["developer_shares"].get("u_002", 0),
                "status": "pending"
            },
            "u_003": {
                "total_due": fraction["developer_shares"].get("u_003", 0),
                "paid": 0,
                "remaining": fraction["developer_shares"].get("u_003", 0),
                "status": "pending"
            },
            "u_004": {
                "total_due": fraction["manager_share"],
                "paid": 0,
                "remaining": fraction["manager_share"],
                "status": "pending"
            }
        }
    }
    
    finance_id = processor.create_finance(finance_data)
    
    if finance_id:
        activity_log.log_action(
            "system",
            "INITIALIZED_FINANCE",
            finance_id,
            f"project={project_id}"
        )
    
    return finance_id


# ============= ФИНАНСЫ: ПОСТУПЛЕНИЕ ОТ КЛИЕНТА =============

def register_client_payment(project_id: str, amount: float) -> bool:
    """
    Зарегистрировать поступление денег от клиента
    """
    finances = processor.get_finances(project_id=project_id)
    if not finances:
        return False
    
    finance = finances[0]
    project = processor.get_project_by_id(project_id)
    
    if not project:
        return False
    
    # Увеличиваем сумму оплаченную клиентом
    finance["client_paid_total"] += amount
    
    # Обновляем
    success = processor.update_finance(finance["id"], {
        "client_paid_total": finance["client_paid_total"]
    })
    
    if success:
        activity_log.log_action(
            "system",
            "CLIENT_PAYMENT",
            finance["id"],
            f"project={project_id} amount={amount} total={finance['client_paid_total']}/{project['total_budget']}"
        )
    
    return success


# ============= ФИНАНСЫ: ВЫПЛАТА РАЗРАБОТЧИКУ =============

def register_payout_to_developer(project_id: str, user_id: str, amount: float) -> bool:
    """
    Зарегистрировать выплату разработчику (или менеджеру)
    """
    finances = processor.get_finances(project_id=project_id)
    if not finances:
        return False
    
    finance = finances[0]
    
    if user_id not in finance["payouts"]:
        return False
    
    payout = finance["payouts"][user_id]
    
    # Увеличиваем оплаченную сумму
    payout["paid"] += amount
    payout["remaining"] = payout["total_due"] - payout["paid"]
    
    # Обновляем статус
    if payout["remaining"] <= 0:
        payout["status"] = "paid"
        payout["remaining"] = 0  # Избегаем отрицательных значений
    elif payout["paid"] > 0:
        payout["status"] = "partial"
    else:
        payout["status"] = "pending"
    
    # Сохраняем
    success = processor.update_finance(finance["id"], {
        "payouts": finance["payouts"]
    })
    
    if success:
        activity_log.log_action(
            "system",
            "PAYOUT",
            finance["id"],
            f"project={project_id} user={user_id} amount={amount} remaining={payout['remaining']}"
        )
    
    return success


# ============= ФИНАНСЫ: ПРОВЕРКА ЗАВЕРШЁННОСТИ =============

def check_project_finance_completed(project_id: str) -> bool:
    """
    Проверить, все ли выплаты по проекту сделаны
    """
    finances = processor.get_finances(project_id=project_id)
    if not finances:
        return False
    
    finance = finances[0]
    
    for user_id, payout in finance["payouts"].items():
        if payout["status"] != "paid":
            return False
    
    return True


# ============= СВОДНАЯ ИНФОРМАЦИЯ =============

def get_project_summary(project_id: str) -> Dict:
    """
    Получить полную сводку по проекту (для экрана Льва)
    """
    project = processor.get_project_by_id(project_id)
    fractions = processor.get_fractions(project_id=project_id)
    finances = processor.get_finances(project_id=project_id)
    tasks = processor.get_tasks(project_id=project_id)
    
    if not project or not fractions:
        return {}
    
    fraction = fractions[0]
    finance = finances[0] if finances else None
    
    # Прогресс
    progress = calculate_project_progress(project_id)
    
    # Финансы
    client_paid = finance["client_paid_total"] if finance else 0
    client_remaining = project["total_budget"] - client_paid
    
    return {
        "project": project,
        "fractions": fraction,
        "finance": finance,
        "tasks": tasks,
        "progress": progress,
        "client_paid": client_paid,
        "client_remaining": client_remaining,
        "is_finance_completed": check_project_finance_completed(project_id) if finance else False
    }


def get_user_finance_summary(user_id: str) -> Dict:
    """
    Получить финансовую сводку по пользователю (для экрана Макса/Андрея)
    """
    finances = processor.get_finances()
    
    total_due = 0
    total_paid = 0
    total_remaining = 0
    projects = []
    
    for finance in finances:
        if user_id in finance["payouts"]:
            payout = finance["payouts"][user_id]
            project = processor.get_project_by_id(finance["project_id"])
            
            total_due += payout["total_due"]
            total_paid += payout["paid"]
            total_remaining += payout["remaining"]
            
            projects.append({
                "project_id": finance["project_id"],
                "project_name": project["name"] if project else "Unknown",
                "total_due": payout["total_due"],
                "paid": payout["paid"],
                "remaining": payout["remaining"],
                "status": payout["status"]
            })
    
    return {
        "total_due": total_due,
        "total_paid": total_paid,
        "total_remaining": total_remaining,
        "projects": projects
    }