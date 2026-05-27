import sys
import os
import random
import time
import json
from datetime import datetime

# Add parent directory to path to import local modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import get_db_connection, init_db
import finance_utils

def run_local_stress_test():
    print("=" * 60)
    print("開始執行財務管理系統 - 核心邏輯與壓力測試")
    print("=" * 60)
    
    # 1. Initialize DB
    print("[1/5] 初始化測試資料庫...")
    init_db()
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        # 2. Register 10 Mock Users
        print("[2/5] 建立 10 位壓力測試虛擬使用者...")
        mock_user_ids = []
        for i in range(1, 11):
            name = f"StressUser_{i:02d}_{int(time.time()*1000)%10000}"
            cursor.execute("INSERT INTO Users (name) VALUES (?);", (name,))
            mock_user_ids.append(cursor.lastrowid)
        print(f"-> 成功建立使用者，ID 清單: {mock_user_ids}")
        
        # 3. Create a Group
        print("[3/5] 建立測試分帳群組...")
        cursor.execute("INSERT INTO Groups (group_name) VALUES (?);", ("極限測試群組",))
        group_id = cursor.lastrowid
        
        # Add members
        for u_id in mock_user_ids:
            cursor.execute("INSERT INTO Group_Members (group_id, user_id) VALUES (?, ?);", (group_id, u_id))
        print(f"-> 成功建立群組，ID: {group_id}，已加入 10 位成員")
        
        # 4. Generate 55 random transactions
        print("[4/5] 隨機生成 55 筆複雜分攤交易 (AA制、比例分攤、自訂分攤)...")
        split_modes = ['AA', 'ratio', 'custom']
        categories = ['飲食', '交通', '住宿', '門票', '其他']
        
        start_time = time.perf_counter()
        
        total_seeded_amount = 0
        
        for idx in range(55):
            payer = random.choice(mock_user_ids)
            # Pick split participants
            k = random.randint(2, 10)
            participants = random.sample(mock_user_ids, k)
            if payer not in participants:
                participants.append(payer)
                participants = list(set(participants))
                
            total_amount_cents = random.randint(500, 150000) # $5.00 to $1500.00
            total_seeded_amount += total_amount_cents
            split_mode = random.choice(split_modes)
            
            # Setup split details
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
                
            # Perform exact distribution using finance_utils
            shares = finance_utils.distribute_expense(total_amount_cents, participants, payer, split_mode, split_details)
            
            # Double check zero-loss on allocation
            assert sum(shares.values()) == total_amount_cents, f"無失真原則失敗：第 {idx+1} 筆分帳金額不匹配"
            
            split_details_json = json.dumps(shares)
            
            cursor.execute("""
                INSERT INTO Group_Expenses (group_id, payer_id, total_amount, description, split_details, date)
                VALUES (?, ?, ?, ?, ?, ?);
            """, (group_id, payer, total_amount_cents, f"壓力測試開銷 {idx+1}", split_details_json, "2026-05-27"))
            
        conn.commit()
        print(f"-> 成功生成 55 筆共同消費！總消費金額: {total_seeded_amount/100.0} 元")
        
        # 5. Fetch and calculate net balances for settlement
        print("[5/5] 執行債務最佳化結算演算法...")
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
                    
        # Verification 1: Zero-Sum check on raw balances
        sum_balances = sum(balances.values())
        print(f"-> 驗證1：淨額加總零和驗證: {sum_balances} (應為 0)")
        assert sum_balances == 0, f"零和驗證失敗！總餘額不為零: {sum_balances}"
        print("   [PASS] 零和驗證完全吻合！")
        
        # Time the algorithm specifically
        alg_start = time.perf_counter()
        transactions = finance_utils.simplify_debts(balances)
        alg_end = time.perf_counter()
        
        alg_time_ms = (alg_end - alg_start) * 1000.0
        print(f"-> 演算法計算耗時: {alg_time_ms:.4f} ms")
        
        # Verification 2: Optimized transfers count check
        n_users = len(mock_user_ids)
        max_transfers = n_users - 1
        transfers_count = len(transactions)
        print(f"-> 驗證2：優化後轉帳總筆數: {transfers_count} 筆 (理論上限為 {max_transfers} 筆)")
        assert transfers_count <= max_transfers, f"最佳化指標失敗！轉帳筆數 {transfers_count} 超出限制 {max_transfers}"
        print("   [PASS] 轉帳筆數完美符合最佳化指標！達到債務極致簡化。")
        
        # Display simplified transfer list
        print("\n--- 最終簡化結算指令清單 ---")
        for i, tx in enumerate(transactions, 1):
            print(f"{i:02d}. 使用者 {tx['from']} 應轉帳 {tx['amount']/100.0:.2f} 元 給 使用者 {tx['to']}")
        print("-" * 28 + "\n")
        
        # Clean up temporary database records for mock run
        cursor.execute("DELETE FROM Groups WHERE group_id = ?;", (group_id,))
        for u_id in mock_user_ids:
            cursor.execute("DELETE FROM Users WHERE user_id = ?;", (u_id,))
        conn.commit()
        print("已成功清除壓力測試暫存資料。")
        
        print("=" * 60)
        print("品質管制與壓力測試完成：全部指標順利通過！(100% SUCCESS)")
        print("=" * 60)
        
    except Exception as e:
        conn.rollback()
        print(f"\n[ERROR] 測試執行過程中發生異常: {str(e)}")
        sys.exit(1)
    finally:
        conn.close()

if __name__ == "__main__":
    run_local_stress_test()
