import asyncio
import logging
from aiogram import Bot, Dispatcher, types, F
from aiogram.filters import Command
from aiogram.types import WebAppInfo, InlineKeyboardButton, InlineKeyboardMarkup
from aiogram.utils.keyboard import InlineKeyboardBuilder

import auth
import processor

# Настройка логирования
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Инициализация бота и диспетчера
BOT_TOKEN = "8335802933:AAEHfT0jTRM-qS8rSLbuxPUT7BKRYxUBWb0"
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()

# URL веб-приложения (замени на свой домен)
WEBAPP_URL = "https://pfetc-chr0maxxx.amvera.io/"


# ============= КОМАНДА /START =============

@dp.message(Command("start"))
async def cmd_start(message: types.Message):
    """
    Обработчик команды /start
    Приветствие и кнопка открытия веб-интерфейса
    """
    user = message.from_user
    
    # Проверяем, есть ли пользователь в базе
    db_user = processor.get_user_by_telegram_id(user.id)
    
    if not db_user:
        await message.answer(
            "⛔️ Доступ запрещён.\n\n"
            "Ваш Telegram ID не найден в системе.\n"
            "Обратитесь к администратору для получения доступа."
        )
        
        processor.log_action(
            "unknown",
            "UNAUTHORIZED_ACCESS",
            f"telegram_id={user.id}",
            f"username={user.username}"
        )
        return
    
    # Приветственное сообщение
    welcome_text = f"""
👋 Привет, {db_user['name']}!

Добро пожаловать в систему управления веб-студией.

Ваша роль: {get_role_name(db_user['role'])}

Нажмите кнопку ниже, чтобы открыть веб-интерфейс:
"""
    
    # Создаём inline-кнопку с WebApp
    builder = InlineKeyboardBuilder()
    builder.button(
        text="🚀 Открыть веб-интерфейс",
        web_app=WebAppInfo(url=WEBAPP_URL)
    )
    
    await message.answer(
        welcome_text,
        reply_markup=builder.as_markup(),
        parse_mode="HTML"
    )
    
    processor.log_action(db_user['id'], "BOT_START", f"telegram_id={user.id}")


# ============= КОМАНДА /HELP =============

@dp.message(Command("help"))
async def cmd_help(message: types.Message):
    """
    Обработчик команды /help
    Список доступных команд
    """
    db_user = processor.get_user_by_telegram_id(message.from_user.id)
    
    if not db_user:
        await message.answer("⛔️ Доступ запрещён.")
        return
    
    help_text = """
📖 <b>Доступные команды:</b>

/start - Приветствие и открытие веб-интерфейса
/help - Список команд
/menu - Главное меню
/mytasks - Мои текущие задачи
/mybalance - Мой баланс

<b>Веб-интерфейс:</b>
Откройте веб-интерфейс через кнопку в меню /start для полного доступа ко всем функциям.
"""
    
    await message.answer(help_text, parse_mode="HTML")


# ============= КОМАНДА /MENU =============

@dp.message(Command("menu"))
async def cmd_menu(message: types.Message):
    """
    Обработчик команды /menu
    Главное меню с кнопками
    """
    db_user = processor.get_user_by_telegram_id(message.from_user.id)
    
    if not db_user:
        await message.answer("⛔️ Доступ запрещён.")
        return
    
    builder = InlineKeyboardBuilder()
    
    # Кнопка открытия веб-интерфейса
    builder.button(
        text="🚀 Открыть веб-интерфейс",
        web_app=WebAppInfo(url=WEBAPP_URL)
    )
    
    # Кнопки быстрых действий
    builder.button(text="📋 Мои задачи", callback_data="my_tasks")
    builder.button(text="💰 Мой баланс", callback_data="my_balance")
    
    builder.adjust(1)
    
    await message.answer(
        "📱 <b>Главное меню</b>\n\nВыберите действие:",
        reply_markup=builder.as_markup(),
        parse_mode="HTML"
    )


# ============= КОМАНДА /MYTASKS =============

@dp.message(Command("mytasks"))
async def cmd_mytasks(message: types.Message):
    """
    Обработчик команды /mytasks
    Показать текущие задачи пользователя
    """
    db_user = processor.get_user_by_telegram_id(message.from_user.id)
    
    if not db_user:
        await message.answer("⛔️ Доступ запрещён.")
        return
    
    # Получаем задачи пользователя
    tasks = processor.get_tasks(assignee_id=db_user['id'])
    
    # Фильтруем только активные задачи (не выполненные)
    active_tasks = [t for t in tasks if t['status'] != 'done']
    
    if not active_tasks:
        await message.answer("✅ У вас нет активных задач.")
        return
    
    # Формируем список задач
    tasks_text = "📋 <b>Ваши текущие задачи:</b>\n\n"
    
    for task in active_tasks[:10]:  # Показываем максимум 10 задач
        project = processor.get_project_by_id(task['project_id'])
        project_name = project['name'] if project else "Неизвестный проект"
        
        status_emoji = "⏳" if task['status'] == 'pending' else "🔄"
        
        tasks_text += f"{status_emoji} <b>{task['title']}</b>\n"
        tasks_text += f"   Проект: {project_name}\n"
        tasks_text += f"   Стоимость: {task['cost']:,}₽\n"
        tasks_text += f"   Статус: {get_status_name(task['status'])}\n\n"
    
    if len(active_tasks) > 10:
        tasks_text += f"\n... и ещё {len(active_tasks) - 10} задач"
    
    tasks_text += "\n💡 Откройте веб-интерфейс для управления задачами."
    
    # Кнопка открытия веб-интерфейса
    builder = InlineKeyboardBuilder()
    builder.button(
        text="🚀 Открыть веб-интерфейс",
        web_app=WebAppInfo(url=WEBAPP_URL)
    )
    
    await message.answer(
        tasks_text,
        reply_markup=builder.as_markup(),
        parse_mode="HTML"
    )


# ============= КОМАНДА /MYBALANCE =============

@dp.message(Command("mybalance"))
async def cmd_mybalance(message: types.Message):
    """
    Обработчик команды /mybalance
    Показать баланс пользователя
    """
    db_user = processor.get_user_by_telegram_id(message.from_user.id)
    
    if not db_user:
        await message.answer("⛔️ Доступ запрещён.")
        return
    
    # Для разработчиков показываем финансовую сводку
    if db_user['role'] in ['lead_developer', 'developer']:
        import calculator
        summary = calculator.get_user_finance_summary(db_user['id'])
        
        balance_text = f"""
💰 <b>Ваш баланс:</b>

📊 Всего должно поступить: <b>{summary['total_due']:,}₽</b>
✅ Уже получено: <b>{summary['total_paid']:,}₽</b>
⏳ Ожидается: <b>{summary['total_remaining']:,}₽</b>

📁 <b>По проектам:</b>
"""
        
        for project in summary['projects'][:5]:  # Показываем максимум 5 проектов
            status_emoji = {
                'pending': '⏳',
                'partial': '🔄',
                'paid': '✅'
            }.get(project['status'], '❓')
            
            balance_text += f"\n{status_emoji} <b>{project['project_name']}</b>\n"
            balance_text += f"   Должно: {project['total_due']:,}₽\n"
            balance_text += f"   Получено: {project['paid']:,}₽\n"
            balance_text += f"   Осталось: {project['remaining']:,}₽\n"
        
        if len(summary['projects']) > 5:
            balance_text += f"\n... и ещё {len(summary['projects']) - 5} проектов"
        
        balance_text += "\n💡 Откройте веб-интерфейс для детальной информации."
    
    # Для менеджера показываем общую статистику
    elif db_user['role'] == 'manager':
        finances = processor.get_finances()
        
        total_due = 0
        total_paid = 0
        
        for finance in finances:
            for user_id, payout in finance['payouts'].items():
                total_due += payout['total_due']
                total_paid += payout['paid']
        
        balance_text = f"""
💰 <b>Финансовая сводка:</b>

📊 Всего к выплате: <b>{total_due:,}₽</b>
✅ Уже выплачено: <b>{total_paid:,}₽</b>
⏳ Осталось выплатить: <b>{total_due - total_paid:,}₽</b>

💡 Откройте веб-интерфейс для управления выплатами.
"""
    
    else:
        balance_text = "💰 Баланс недоступен для вашей роли."
    
    # Кнопка открытия веб-интерфейса
    builder = InlineKeyboardBuilder()
    builder.button(
        text="🚀 Открыть веб-интерфейс",
        web_app=WebAppInfo(url=WEBAPP_URL)
    )
    
    await message.answer(
        balance_text,
        reply_markup=builder.as_markup(),
        parse_mode="HTML"
    )


# ============= CALLBACK QUERY ОБРАБОТЧИКИ =============

@dp.callback_query(F.data == "my_tasks")
async def callback_my_tasks(callback: types.CallbackQuery):
    """
    Обработчик callback для кнопки "Мои задачи"
    """
    # Имитируем команду /mytasks
    await cmd_mytasks(callback.message)
    await callback.answer()


@dp.callback_query(F.data == "my_balance")
async def callback_my_balance(callback: types.CallbackQuery):
    """
    Обработчик callback для кнопки "Мой баланс"
    """
    # Имитируем команду /mybalance
    await cmd_mybalance(callback.message)
    await callback.answer()


# ============= УТИЛИТЫ =============

def get_role_name(role: str) -> str:
    """Получить название роли на русском"""
    roles = {
        'admin': 'Администратор',
        'lead_developer': 'Ведущий разработчик',
        'developer': 'Разработчик',
        'manager': 'Менеджер'
    }
    return roles.get(role, role)


def get_status_name(status: str) -> str:
    """Получить название статуса на русском"""
    statuses = {
        'pending': 'Ожидает',
        'in_progress': 'В работе',
        'done': 'Выполнено'
    }
    return statuses.get(status, status)


# ============= ЗАПУСК БОТА =============

async def main():
    """
    Главная функция запуска бота
    """
    logger.info("Запуск Telegram бота...")
    
    # Удаляем webhook (если был установлен)
    await bot.delete_webhook(drop_pending_updates=True)
    
    # Запускаем polling
    await dp.start_polling(bot)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Бот остановлен")
    except Exception as e:
        logger.error(f"Ошибка: {e}")