import sqlite3
from pathlib import Path
from contextlib import contextmanager

DB_PATH = Path(__file__).resolve().parent.parent / 'emotionvision.db'

@contextmanager
def get_db():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row
    try:
        yield db
    finally:
        db.close()

def init_db():
    with get_db() as db:
        db.execute('''CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, username VARCHAR(80) NOT NULL UNIQUE, password_hash VARCHAR(255) NOT NULL)''')
        db.execute('''CREATE TABLE IF NOT EXISTS results (id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, emotion VARCHAR(30) NOT NULL, confidence VARCHAR(20) NOT NULL, created_at DATETIME, FOREIGN KEY(user_id) REFERENCES users(id))''')
        db.commit()
