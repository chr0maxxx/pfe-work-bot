import os
import logging
import sys
from datetime import datetime

LOG_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'system.log')

# Создаём директорию если её нет
os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

system_logger = logging.getLogger('system')
system_logger.setLevel(logging.DEBUG)

formatter = logging.Formatter(
    '[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.DEBUG)
console_handler.setFormatter(formatter)

# ПЕРЕЗАПИСЫВАЕМ файл при каждом запуске (mode='w')
file_handler = logging.FileHandler(LOG_FILE, mode='w', encoding='utf-8')
file_handler.setLevel(logging.DEBUG)
file_handler.setFormatter(formatter)

if not system_logger.handlers:
    system_logger.addHandler(console_handler)
    system_logger.addHandler(file_handler)

def info(message):
    system_logger.info(message)

def error(message):
    system_logger.error(message)

def warning(message):
    system_logger.warning(message)

def debug(message):
    system_logger.debug(message)