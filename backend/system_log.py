import os
import logging
import sys
from datetime import datetime

# Путь к файлу системных логов
LOG_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'system.log')

# Создаём логгер
system_logger = logging.getLogger('system')
system_logger.setLevel(logging.INFO)

# Формат сообщений
formatter = logging.Formatter(
    '[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Обработчик для консоли
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.DEBUG)  # ← DEBUG
console_handler.setFormatter(formatter)

# Обработчик для файла (добавляем поверх старых)
file_handler = logging.FileHandler(LOG_FILE, mode='a', encoding='utf-8')
file_handler.setLevel(logging.DEBUG)  # ← DEBUG
file_handler.setFormatter(formatter)

# Добавляем обработчики
if not system_logger.handlers:
    system_logger.addHandler(console_handler)
    system_logger.addHandler(file_handler)

# Функции для удобства
def info(message):
    system_logger.info(message)

def error(message):
    system_logger.error(message)

def warning(message):
    system_logger.warning(message)

def debug(message):
    system_logger.debug(message)