import os
import logging
import sys
from datetime import datetime, timezone

LOG_FILE = '/data/system.log'

os.makedirs(os.path.dirname(LOG_FILE), exist_ok=True)

system_logger = logging.getLogger('system')
system_logger.setLevel(logging.DEBUG)

# Формат с UTC
formatter = logging.Formatter(
    '[%(asctime)s] %(levelname)s: %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)

# Консоль
console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.DEBUG)
console_handler.setFormatter(formatter)

# Файл — перезаписываем при каждом запуске
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