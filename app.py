from flask import Flask, request, jsonify, send_from_directory
import os
import json
from datetime import datetime
import time

from database import get_db_connection, init_db
import finance_utils

app = Flask(__name__, static_folder='public', static_url_path='')

# Ensure database is initialized before handling requests
with app.app_context():
    init_db()

# Serve Frontend SPA
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# ==========================================
# 1. User APIs
# ==========================================

@app.route('/api/users', methods=['POST'])
def create_user():
    data = request.json
    name = data.get('name')
    if not name or not name.strip():
        return jsonify({'error': 'Name is required'}), 400
    
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("INSERT INTO Users (name) VALUES (?);", (name.strip(),))
        conn.commit()
        user_id = cursor.lastrowid
        return jsonify({'user_id': user_id, 'name': name.strip()}), 210
    except sqlite3.IntegrityError:
        return jsonify({'error': 'User name already exists'}), 400
    finally:
        conn.close()

@app.route('/api/users', methods=['GET'])
def get_users():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Users ORDER BY name ASC;")
    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return jsonify(users)

@app.route('/api/users/<int:user_id>', methods=['GET'])
def get_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Users WHERE user_id = ?;", (user_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return jsonify({'error': 'User not found'}), 404
    return jsonify(dict(row))

# ==========================================
# 2. Personal Ledger (Transactions) APIs
# ==========================================

@app.route('/api/transactions', methods=['POST'])
def create_transaction():
    data = request.json
    user_id = data.get('user_id')
    amount_float = data.get('amount') # in float dollars/NTD
    txn_type = data.get('type') # 'income' or 'expense'
    category = data.get('category')
    memo = data.get('memo', '')
    date_str = data.get('date') # YYYY-MM-DD
    
    if not all([user_id, amount_float is not None, txn_type, category, date_str]):
        return jsonify({'error': 'Missing required fields'}), 400
        
    if txn_type not in ['income', 'expense']:
        return jsonify({'error': 'Type must be income or expense'}), 400
        
    # Convert float to cents integer, handle rounding
    amount_cents = int(round(float(amount_float) * 100))
    if amount_cents <= 0:
        return jsonify({'error': 'Amount must be greater than zero'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify user exists
    cursor.execute("SELECT 1 FROM Users WHERE user_id = ?;", (user_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'User not found'}), 404
        
    cursor.execute("""
        INSERT INTO Transactions (user_id, amount, type, category, memo, date)
        VALUES (?, ?, ?, ?, ?, ?);
    """, (user_id, amount_cents, txn_type, category, memo, date_str))
    conn.commit()
    txn_id = cursor.lastrowid
    conn.close()
    
    return jsonify({
        'txn_id': txn_id,
        'user_id': user_id,
        'amount': amount_float,
        'type': txn_type,
        'category': category,
        'memo': memo,
        'date': date_str
    }), 201

@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    user_id = request.args.get('user_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    category = request.args.get('category')
    txn_type = request.args.get('type')
    
    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400
        
    query = "SELECT * FROM Transactions WHERE user_id = ?"
    params = [user_id]
    
    if start_date:
        query += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query += " AND date <= ?"
        params.append(end_date)
    if category:
        query += " AND category = ?"
        params.append(category)
    if txn_type:
        query += " AND type = ?"
        params.append(txn_type)
        
    query += " ORDER BY date DESC, txn_id DESC"
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(query, params)
    rows = cursor.fetchall()
    conn.close()
    
    txns = []
    for row in rows:
        d = dict(row)
        d['amount'] = d['amount'] / 100.0 # Convert cents to float
        txns.append(d)
        
    return jsonify(txns)

@app.route('/api/transactions/<int:txn_id>', methods=['DELETE'])
def delete_transaction(txn_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM Transactions WHERE txn_id = ?;", (txn_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Transaction not found'}), 404
        
    cursor.execute("DELETE FROM Transactions WHERE txn_id = ?;", (txn_id,))
    conn.commit()
    conn.close()
    return jsonify({'message': 'Transaction deleted successfully'})

@app.route('/api/transactions/summary', methods=['GET'])
def get_transaction_summary():
    user_id = request.args.get('user_id')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Base query for totals
    query_total = "SELECT type, SUM(amount) as total FROM Transactions WHERE user_id = ?"
    params = [user_id]
    
    if start_date:
        query_total += " AND date >= ?"
        params.append(start_date)
    if end_date:
        query_total += " AND date <= ?"
        params.append(end_date)
        
    query_total += " GROUP BY type"
    
    cursor.execute(query_total, params)
    totals = cursor.fetchall()
    
    total_income = 0
    total_expense = 0
    for row in totals:
        if row['type'] == 'income':
            total_income = row['total'] / 100.0
        elif row['type'] == 'expense':
            total_expense = row['total'] / 100.0
            
    # Base query for category breakdown (expenses only)
    query_cat = "SELECT category, SUM(amount) as total FROM Transactions WHERE user_id = ? AND type = 'expense'"
    cat_params = [user_id]
    
    if start_date:
        query_cat += " AND date >= ?"
        cat_params.append(start_date)
    if end_date:
        query_cat += " AND date <= ?"
        cat_params.append(end_date)
        
    query_cat += " GROUP BY category ORDER BY total DESC"
    cursor.execute(query_cat, cat_params)
    categories = []
    for row in cursor.fetchall():
        categories.append({
            'category': row['category'],
            'amount': row['total'] / 100.0
        })
        
    conn.close()
    
    return jsonify({
        'total_income': total_income,
        'total_expense': total_expense,
        'net_balance': total_income - total_expense,
        'categories': categories
    })

# ==========================================
# 3. Savings Goals APIs
# ==========================================

@app.route('/api/savings', methods=['POST'])
def create_savings_goal():
    data = request.json
    user_id = data.get('user_id')
    goal_name = data.get('goal_name')
    target_amount_float = data.get('target_amount')
    deadline = data.get('deadline') # YYYY-MM-DD
    
    if not all([user_id, goal_name, target_amount_float is not None, deadline]):
        return jsonify({'error': 'Missing required fields'}), 400
        
    target_cents = int(round(float(target_amount_float) * 100))
    if target_cents <= 0:
        return jsonify({'error': 'Target amount must be greater than zero'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Verify user
    cursor.execute("SELECT 1 FROM Users WHERE user_id = ?;", (user_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'User not found'}), 404
        
    cursor.execute("""
        INSERT INTO Savings_Goals (user_id, goal_name, target_amount, current_amount, deadline)
        VALUES (?, ?, ?, 0, ?);
    """, (user_id, goal_name, target_cents, deadline))
    conn.commit()
    goal_id = cursor.lastrowid
    conn.close()
    
    return jsonify({
        'goal_id': goal_id,
        'user_id': user_id,
        'goal_name': goal_name,
        'target_amount': target_amount_float,
        'current_amount': 0.0,
        'deadline': deadline
    }), 201

@app.route('/api/savings', methods=['GET'])
def get_savings_goals():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id is required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Savings_Goals WHERE user_id = ? ORDER BY deadline ASC;", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    
    goals = []
    today = datetime.now().date()
    for row in rows:
        d = dict(row)
        d['target_amount'] = d['target_amount'] / 100.0
        d['current_amount'] = d['current_amount'] / 100.0
        
        # Calculate progress status
        target = d['target_amount']
        curr = d['current_amount']
        d['progress_percent'] = round((curr / target * 100.0), 2) if target > 0 else 0.0
        d['remaining_amount'] = max(0.0, target - curr)
        
        # Calculate days remaining
        try:
            deadline_date = datetime.strptime(d['deadline'], '%Y-%m-%d').date()
            days_left = (deadline_date - today).days
            d['days_left'] = max(0, days_left)
        except Exception:
            d['days_left'] = 0
            
        goals.append(d)
        
    return jsonify(goals)

@app.route('/api/savings/<int:goal_id>/deposit', methods=['POST'])
def deposit_savings(goal_id):
    data = request.json
    amount_float = data.get('amount')
    link_ledger = data.get('link_ledger', False)
    
    if amount_float is None:
        return jsonify({'error': 'Amount is required'}), 400
        
    amount_cents = int(round(float(amount_float) * 100))
    if amount_cents <= 0:
        return jsonify({'error': 'Deposit amount must be greater than zero'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Retrieve goal
    cursor.execute("SELECT * FROM Savings_Goals WHERE goal_id = ?;", (goal_id,))
    goal = cursor.fetchone()
    if not goal:
        conn.close()
        return jsonify({'error': 'Savings goal not found'}), 404
        
    new_amount_cents = goal['current_amount'] + amount_cents
    
    # Update savings goal
    cursor.execute("UPDATE Savings_Goals SET current_amount = ? WHERE goal_id = ?;", (new_amount_cents, goal_id))
    
    # Auto-deduct from personal ledger if link_ledger is True
    if link_ledger:
        today_str = datetime.now().strftime('%Y-%m-%d')
        memo = f"儲蓄扣款: 存入「{goal['goal_name']}」"
        cursor.execute("""
            INSERT INTO Transactions (user_id, amount, type, category, memo, date)
            VALUES (?, ?, 'expense', '儲蓄', ?, ?);
        """, (goal['user_id'], amount_cents, memo, today_str))
        
    conn.commit()
    conn.close()
    
    return jsonify({
        'goal_id': goal_id,
        'goal_name': goal['goal_name'],
        'deposited_amount': amount_float,
        'current_amount': new_amount_cents / 100.0,
        'linked_to_ledger': link_ledger
    })

# ==========================================
# 4. Multi-person Bill Splitting APIs
# ==========================================

@app.route('/api/groups', methods=['POST'])
def create_group():
    data = request.json
    group_name = data.get('group_name')
    members = data.get('members') # array of user_ids
    
    if not group_name or not group_name.strip():
        return jsonify({'error': 'group_name is required'}), 400
    if not members or not isinstance(members, list):
        return jsonify({'error': 'members list is required'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # Create Group
        cursor.execute("INSERT INTO Groups (group_name) VALUES (?);", (group_name.strip(),))
        group_id = cursor.lastrowid
        
        # Add Members
        for u_id in members:
            # Ensure user exists
            cursor.execute("SELECT 1 FROM Users WHERE user_id = ?;", (u_id,))
            if cursor.fetchone():
                cursor.execute("INSERT INTO Group_Members (group_id, user_id) VALUES (?, ?);", (group_id, u_id))
                
        conn.commit()
        return jsonify({'group_id': group_id, 'group_name': group_name.strip(), 'members': members}), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/groups', methods=['GET'])
def get_groups():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM Groups ORDER BY created_at DESC;")
    rows = cursor.fetchall()
    
    groups = []
    for row in rows:
        g = dict(row)
        # Fetch members for each group
        cursor.execute("""
            SELECT u.user_id, u.name 
            FROM Group_Members gm 
            JOIN Users u ON gm.user_id = u.user_id 
            WHERE gm.group_id = ?;
        """, (g['group_id'],))
        g['members'] = [dict(r) for r in cursor.fetchall()]
        groups.append(g)
        
    conn.close()
    return jsonify(groups)

@app.route('/api/groups/<int:group_id>', methods=['GET'])
def get_group_details(group_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Group Info
    cursor.execute("SELECT * FROM Groups WHERE group_id = ?;", (group_id,))
    group_row = cursor.fetchone()
    if not group_row:
        conn.close()
        return jsonify({'error': 'Group not found'}), 404
        
    g = dict(group_row)
    
    # Members Info
    cursor.execute("""
        SELECT u.user_id, u.name 
        FROM Group_Members gm 
        JOIN Users u ON gm.user_id = u.user_id 
        WHERE gm.group_id = ?;
    """, (group_id,))
    g['members'] = [dict(r) for r in cursor.fetchall()]
    
    # Expenses Info
    cursor.execute("""
        SELECT ge.*, u.name as payer_name 
        FROM Group_Expenses ge
        JOIN Users u ON ge.payer_id = u.user_id
        WHERE ge.group_id = ?
        ORDER BY ge.date DESC, ge.expense_id DESC;
    """, (group_id,))
    expenses = []
    for r in cursor.fetchall():
        exp = dict(r)
        exp['total_amount'] = exp['total_amount'] / 100.0
        exp['split_details'] = json.loads(exp['split_details'])
        # Convert split details from cents to float
        for k, v in exp['split_details'].items():
            exp['split_details'][k] = v / 100.0
        expenses.append(exp)
        
    g['expenses'] = expenses
    conn.close()
    return jsonify(g)

@app.route('/api/groups/<int:group_id>/members', methods=['POST'])
def add_group_members(group_id):
    data = request.json
    user_ids = data.get('user_ids') # list of user_ids
    if not user_ids or not isinstance(user_ids, list):
        return jsonify({'error': 'user_ids must be a list'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT 1 FROM Groups WHERE group_id = ?;", (group_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Group not found'}), 404
        
    try:
        added = []
        for u_id in user_ids:
            cursor.execute("SELECT 1 FROM Users WHERE user_id = ?;", (u_id,))
            if cursor.fetchone():
                cursor.execute("""
                    INSERT OR IGNORE INTO Group_Members (group_id, user_id) 
                    VALUES (?, ?);
                """, (group_id, u_id))
                added.append(u_id)
        conn.commit()
        return jsonify({'message': 'Members updated', 'added_user_ids': added})
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/groups/<int:group_id>/expenses', methods=['POST'])
def add_group_expense(group_id):
    data = request.json
    payer_id = data.get('payer_id')
    total_amount_float = data.get('total_amount')
    description = data.get('description', '')
    split_mode = data.get('split_mode', 'AA') # 'AA', 'ratio', 'custom'
    members = data.get('members') # list of user_ids participating in split
    split_details = data.get('split_details', None) # dict of ratio values or custom amounts
    date_str = data.get('date')
    
    if not all([payer_id, total_amount_float is not None, members, date_str]):
        return jsonify({'error': 'Missing required fields'}), 400
        
    total_cents = int(round(float(total_amount_float) * 100))
    if total_cents <= 0:
        return jsonify({'error': 'Total amount must be greater than zero'}), 400
        
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Validate group, payer, members
    cursor.execute("SELECT 1 FROM Groups WHERE group_id = ?;", (group_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Group not found'}), 404
        
    cursor.execute("SELECT 1 FROM Users WHERE user_id = ?;", (payer_id,))
    if not cursor.fetchone():
        conn.close()
        return jsonify({'error': 'Payer not found'}), 404
        
    # Calculate exact shares in cents using our finance_utils distribution mathematics
    shares_cents = finance_utils.distribute_expense(total_cents, members, payer_id, split_mode, split_details)
    
    # Verify zero-loss
    sum_shares = sum(shares_cents.values())
    if sum_shares != total_cents:
        conn.close()
        return jsonify({'error': 'Split values do not match total expense amount'}), 400
        
    split_details_json = json.dumps(shares_cents)
    
    try:
        cursor.execute("""
            INSERT INTO Group_Expenses (group_id, payer_id, total_amount, description, split_details, date)
            VALUES (?, ?, ?, ?, ?, ?);
        """, (group_id, payer_id, total_cents, description, split_details_json, date_str))
        conn.commit()
        expense_id = cursor.lastrowid
        return jsonify({
            'expense_id': expense_id,
            'group_id': group_id,
            'payer_id': payer_id,
            'total_amount': total_amount_float,
            'description': description,
            'split_details': {k: v / 100.0 for k, v in shares_cents.items()},
            'date': date_str
        }), 201
    except Exception as e:
        conn.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        conn.close()

@app.route('/api/groups/<int:group_id>/settlement', methods=['GET'])
def get_group_settlement(group_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Fetch Group Members
    cursor.execute("""
        SELECT u.user_id, u.name 
        FROM Group_Members gm 
        JOIN Users u ON gm.user_id = u.user_id 
        WHERE gm.group_id = ?;
    """, (group_id,))
    members_rows = cursor.fetchall()
    if not members_rows:
        conn.close()
        return jsonify({'error': 'Group has no members'}), 400
        
    members_map = {row['user_id']: row['name'] for row in members_rows}
    
    # 2. Fetch Group Expenses
    cursor.execute("SELECT payer_id, total_amount, split_details FROM Group_Expenses WHERE group_id = ?;", (group_id,))
    expenses_rows = cursor.fetchall()
    
    # 3. Calculate Net Balances in Cents
    balances = {uid: 0 for uid in members_map.keys()}
    
    for row in expenses_rows:
        payer = row['payer_id']
        total = row['total_amount']
        splits = json.loads(row['split_details'])
        
        # Payer gets credited
        if payer in balances:
            balances[payer] += total
            
        # Split participants get debited
        for u_str, val in splits.items():
            u_id = int(u_str)
            if u_id in balances:
                balances[u_id] -= val
                
    # 4. Perform Zero-Sum and Balance Verification
    sum_balances = sum(balances.values())
    
    # 5. Run Debt Simplification
    # Pass dict {user_id: balance} to simplify_debts
    transactions = finance_utils.simplify_debts(balances)
    
    # 6. Format Output
    output_txns = []
    for tx in transactions:
        output_txns.append({
            'from_id': tx['from'],
            'from_name': members_map.get(tx['from'], f"User {tx['from']}"),
            'to_id': tx['to'],
            'to_name': members_map.get(tx['to'], f"User {tx['to']}"),
            'amount': tx['amount'] / 100.0
        })
        
    formatted_balances = {}
    for uid, bal in balances.items():
        formatted_balances[uid] = {
            'name': members_map[uid],
            'balance': bal / 100.0
        }
        
    conn.close()
    
    return jsonify({
        'group_id': group_id,
        'balances': formatted_balances,
        'zero_sum_check_cents': sum_balances,
        'zero_sum_verified': sum_balances == 0,
        'original_people_count': len(members_map),
        'transfers_count': len(output_txns),
        'simplification_metric': f"Transfers: {len(output_txns)} (Max theoretical limit: {len(members_map) - 1})",
        'settlement_instructions': output_txns
    })

# ==========================================
# 5. Quality Control & Stress Testing APIs
# ==========================================

@app.route('/api/test/stress', methods=['POST'])
def run_stress_test():
    """
    Stress test endpoint:
    - Generates 10 temporary mock users.
    - Creates a temporary test group.
    - Automatically seeds 50+ random expenses (using AA, ratio, custom splitting) among these 10 users.
    - Runs the debt simplification algorithm.
    - Records speed and verifies zero-sum, zero-loss, and transfer count <= N-1 (9).
    """
    import random
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 1. Create 10 Mock Users
        mock_user_ids = []
        for i in range(1, 11):
            name = f"測試員_{i:02d}_{int(time.time()*1000)%10000}"
            cursor.execute("INSERT INTO Users (name) VALUES (?);", (name,))
            mock_user_ids.append(cursor.lastrowid)
            
        # 2. Create Temporary Group
        cursor.execute("INSERT INTO Groups (group_name) VALUES (?);", (f"壓力測試群組_{datetime.now().strftime('%M%S')}",))
        group_id = cursor.lastrowid
        
        # Add members to group
        for u_id in mock_user_ids:
            cursor.execute("INSERT INTO Group_Members (group_id, user_id) VALUES (?, ?);", (group_id, u_id))
            
        # 3. Generate 55 random expenses
        split_modes = ['AA', 'ratio', 'custom']
        categories = ['飲食', '交通', '住宿', '門票', '雜費']
        
        start_time = time.perf_counter()
        
        for exp_idx in range(55):
            payer = random.choice(mock_user_ids)
            # Pick a subset of members participating (at least 2)
            k = random.randint(2, 10)
            participants = random.sample(mock_user_ids, k)
            if payer not in participants:
                participants.append(payer)
                participants = list(set(participants))
                
            total_amount_cents = random.randint(500, 150000) # $5.00 to $1500.00
            split_mode = random.choice(split_modes)
            
            # Setup split details based on mode
            split_details = {}
            if split_mode == 'ratio':
                split_details = {str(uid): random.randint(1, 5) for uid in participants}
            elif split_mode == 'custom':
                # Distribute random amounts and adjust remainder
                total_allocated = 0
                for uid in participants[:-1]:
                    limit = (total_amount_cents - total_allocated) // len(participants)
                    allocated = random.randint(1, max(1, limit))
                    split_details[str(uid)] = allocated
                    total_allocated += allocated
                split_details[str(participants[-1])] = total_amount_cents - total_allocated
                
            shares = finance_utils.distribute_expense(total_amount_cents, participants, payer, split_mode, split_details)
            split_details_json = json.dumps(shares)
            
            cursor.execute("""
                INSERT INTO Group_Expenses (group_id, payer_id, total_amount, description, split_details, date)
                VALUES (?, ?, ?, ?, ?, ?);
            """, (group_id, payer, total_amount_cents, f"隨機消費 {exp_idx+1}", split_details_json, datetime.now().strftime('%Y-%m-%d')))
            
        conn.commit()
        
        # 4. Perform Settlement and Measure Execution Time
        # Calculate Net Balances in Cents
        balances = {uid: 0 for uid in mock_user_ids}
        cursor.execute("SELECT payer_id, total_amount, split_details FROM Group_Expenses WHERE group_id = ?;", (group_id,))
        expenses_rows = cursor.fetchall()
        
        for row in expenses_rows:
            payer = row['payer_id']
            total = row['total_amount']
            splits = json.loads(row['split_details'])
            
            if payer in balances:
                balances[payer] += total
            for u_str, val in splits.items():
                u_id = int(u_str)
                if u_id in balances:
                    balances[u_id] -= val
                    
        sum_balances = sum(balances.values())
        
        # Time the debt simplification algorithm specifically
        alg_start = time.perf_counter()
        transactions = finance_utils.simplify_debts(balances)
        alg_end = time.perf_counter()
        
        total_time_ms = (time.perf_counter() - start_time) * 1000.0
        alg_time_ms = (alg_end - alg_start) * 1000.0
        
        # 5. Acceptance Criteria Validation
        zero_sum_ok = (sum_balances == 0)
        optimized_count_ok = (len(transactions) <= (len(mock_user_ids) - 1))
        
        report = {
            'status': 'success',
            'temporary_group_id': group_id,
            'users_created': len(mock_user_ids),
            'expenses_inserted': len(expenses_rows),
            'execution_time_total_ms': round(total_time_ms, 2),
            'execution_time_algorithm_only_ms': round(alg_time_ms, 4),
            'zero_sum_verified': zero_sum_ok,
            'zero_sum_check_cents': sum_balances,
            'original_people_count': len(mock_user_ids),
            'transfers_count': len(transactions),
            'optimized_indicator_ok': optimized_count_ok,
            'max_allowed_transfers': len(mock_user_ids) - 1,
            'transfers': [
                {
                    'from': f"測試員_{tx['from'] % 100}",
                    'to': f"測試員_{tx['to'] % 100}",
                    'amount': tx['amount'] / 100.0
                } for tx in transactions
            ]
        }
        
        # Delete temporary group and mock users to clean up DB
        cursor.execute("DELETE FROM Groups WHERE group_id = ?;", (group_id,))
        for u_id in mock_user_ids:
            cursor.execute("DELETE FROM Users WHERE user_id = ?;", (u_id,))
        conn.commit()
        
        return jsonify(report)
        
    except Exception as e:
        conn.rollback()
        return jsonify({'status': 'error', 'message': str(e)}), 500
    finally:
        conn.close()

if __name__ == '__main__':
    # Listen on localhost, port 5000
    app.run(host='127.0.0.1', port=5000, debug=True)
