import sqlite3
import os
import json

DB_PATH = os.path.join(os.path.dirname(__file__), "finance.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    # Enable foreign keys
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Users (
        user_id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 2. Transactions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Transactions (
        txn_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        amount INTEGER NOT NULL, -- stored in cents (integer)
        type TEXT CHECK(type IN ('income', 'expense')) NOT NULL,
        category TEXT NOT NULL,
        memo TEXT,
        date TEXT NOT NULL, -- YYYY-MM-DD
        FOREIGN KEY (user_id) REFERENCES Users (user_id) ON DELETE CASCADE
    );
    """)

    # 3. Groups Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Groups (
        group_id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_name TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    """)

    # 4. Group_Members Table (Many-to-Many relationship)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Group_Members (
        group_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        PRIMARY KEY (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES Groups (group_id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES Users (user_id) ON DELETE CASCADE
    );
    """)

    # 5. Group_Expenses Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Group_Expenses (
        expense_id INTEGER PRIMARY KEY AUTOINCREMENT,
        group_id INTEGER NOT NULL,
        payer_id INTEGER NOT NULL,
        total_amount INTEGER NOT NULL, -- stored in cents
        description TEXT,
        split_details TEXT NOT NULL, -- JSON string mapping user_id (str) to amount (int cents)
        date TEXT NOT NULL, -- YYYY-MM-DD
        FOREIGN KEY (group_id) REFERENCES Groups (group_id) ON DELETE CASCADE,
        FOREIGN KEY (payer_id) REFERENCES Users (user_id) ON DELETE CASCADE
    );
    """)

    # 6. Savings_Goals Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS Savings_Goals (
        goal_id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        goal_name TEXT NOT NULL,
        target_amount INTEGER NOT NULL, -- stored in cents
        current_amount INTEGER NOT NULL DEFAULT 0, -- stored in cents
        deadline TEXT NOT NULL, -- YYYY-MM-DD
        FOREIGN KEY (user_id) REFERENCES Users (user_id) ON DELETE CASCADE
    );
    """)

    conn.commit()

    # Seed default users if empty
    cursor.execute("SELECT COUNT(*) as count FROM Users;")
    if cursor.fetchone()["count"] == 0:
        default_users = ["阿明", "小華", "美玲", "大雄", "靜香"]
        for name in default_users:
            cursor.execute("INSERT INTO Users (name) VALUES (?);", (name,))
        conn.commit()
        print("[Database] Seeded default users: 阿明, 小華, 美玲, 大雄, 靜香")

    conn.close()
    print("[Database] Initialization complete.")

if __name__ == "__main__":
    init_db()
