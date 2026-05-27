import json

def distribute_expense(total_amount_cents, members, payer_id, split_mode, details=None):
    """
    Distributes the expense amount (in cents) among members according to the split mode.
    Ensures zero-loss: sum of individual shares equals total_amount_cents.
    
    split_mode options:
      - 'AA': Equal split. details is not required.
      - 'ratio': Ratio-based split. details is a dict of {user_id_str: ratio_int/float}.
      - 'custom': Custom cents per user. details is a dict of {user_id_str: cents_int}.
      
    Returns a dict of {user_id_str: share_in_cents}.
    """
    n = len(members)
    if n == 0:
        return {}
    
    shares = {}
    
    if split_mode == 'AA':
        base_share = total_amount_cents // n
        remainder = total_amount_cents % n
        
        # Distribute base share
        for m in members:
            shares[str(m)] = base_share
            
        # Payer absorbs the remainder, or if payer is not in members, the last member does
        payer_str = str(payer_id)
        if payer_str in shares:
            shares[payer_str] += remainder
        else:
            shares[str(members[-1])] += remainder
            
    elif split_mode == 'ratio':
        if not details:
            # Fallback to AA
            return distribute_expense(total_amount_cents, members, payer_id, 'AA')
            
        # Parse ratios
        ratios = {str(k): float(v) for k, v in details.items()}
        total_ratio = sum(ratios.values())
        
        if total_ratio <= 0:
            return distribute_expense(total_amount_cents, members, payer_id, 'AA')
            
        allocated = 0
        member_strs = [str(m) for m in members]
        
        # Allocate based on ratio
        for m_str in member_strs:
            ratio = ratios.get(m_str, 0.0)
            share = int(total_amount_cents * ratio // total_ratio)
            shares[m_str] = share
            allocated += share
            
        remainder = total_amount_cents - allocated
        # Payer absorbs remainder if in split, otherwise last member
        payer_str = str(payer_id)
        if payer_str in shares:
            shares[payer_str] += remainder
        else:
            # Find the member with non-zero ratio to absorb
            active_members = [m for m in member_strs if shares[m] > 0]
            if active_members:
                shares[active_members[-1]] += remainder
            else:
                shares[str(members[-1])] += remainder
                
    elif split_mode == 'custom':
        if not details:
            return distribute_expense(total_amount_cents, members, payer_id, 'AA')
            
        # Custom amounts in cents must sum up to total_amount_cents
        custom_shares = {str(k): int(v) for k, v in details.items()}
        allocated = sum(custom_shares.values())
        
        # Populate shares
        for m in members:
            m_str = str(m)
            shares[m_str] = custom_shares.get(m_str, 0)
            
        remainder = total_amount_cents - allocated
        if remainder != 0:
            # If there is a slight rounding/entry error, payer absorbs it
            payer_str = str(payer_id)
            if payer_str in shares:
                shares[payer_str] += remainder
            else:
                shares[str(members[-1])] += remainder
                
    return shares


def solve_greedy_debt(balances):
    """
    Solves debt simplification using the standard greedy algorithm.
    balances: dict of {user_id: net_balance_cents} where sum(balances) == 0.
    Returns a list of transactions: [{'from': debtor_id, 'to': creditor_id, 'amount': cents}]
    """
    # Separate into creditors and debtors
    creditors = [] # list of [user_id, balance]
    debtors = []   # list of [user_id, abs_balance]
    
    for u_id, bal in balances.items():
        if bal > 0:
            creditors.append([u_id, bal])
        elif bal < 0:
            debtors.append([u_id, -bal])
            
    transactions = []
    
    # Sort descending
    creditors.sort(key=lambda x: x[1], reverse=True)
    debtors.sort(key=lambda x: x[1], reverse=True)
    
    c_idx = 0
    d_idx = 0
    
    while c_idx < len(creditors) and d_idx < len(debtors):
        creditor = creditors[c_idx]
        debtor = debtors[d_idx]
        
        amount = min(creditor[1], debtor[1])
        if amount > 0:
            transactions.append({
                'from': debtor[0],
                'to': creditor[0],
                'amount': amount
            })
            
            creditor[1] -= amount
            debtor[1] -= amount
            
        if creditor[1] == 0:
            c_idx += 1
        if debtor[1] == 0:
            d_idx += 1
            
    return transactions


def simplify_debts(balances):
    """
    Advanced Debt Simplification Algorithm.
    Uses Subset Sum Zero-Sum DP to find the absolute minimum number of transactions (N - K).
    Falls back to Greedy if the number of active users is greater than 16 to keep performance high.
    
    balances: dict of {user_id: net_balance_cents} where sum(balances) == 0.
    Returns:
      - list of transactions: [{'from': debtor_id, 'to': creditor_id, 'amount': cents}]
    """
    # Filter out users with zero net balance
    active_balances = {u_id: bal for u_id, bal in balances.items() if bal != 0}
    if not active_balances:
        return []
        
    n = len(active_balances)
    user_ids = list(active_balances.keys())
    
    # If N is large, DP is too slow. Fallback to greedy (which is still <= N-1 transactions)
    if n > 16:
        return solve_greedy_debt(active_balances)
        
    # DP to find the maximum number of zero-sum subsets
    # dp[mask] = max number of zero-sum subsets that can be formed using subset of users represented by mask
    dp = [0] * (1 << n)
    # parent[mask] = the submask that formed the optimal division (for backtracking)
    parent = [0] * (1 << n)
    
    # Calculate sum of balances for all subsets
    sums = [0] * (1 << n)
    for mask in range(1 << n):
        s = 0
        for i in range(n):
            if (mask & (1 << i)):
                s += active_balances[user_ids[i]]
        sums[mask] = s
        
    for mask in range(1, 1 << n):
        if sums[mask] == 0:
            dp[mask] = 1
            # Try to divide into two zero-sum subsets
            # Iterate through submasks
            sub = (mask - 1) & mask
            while sub > 0:
                if dp[sub] > 0 and dp[mask ^ sub] > 0:
                    if dp[sub] + dp[mask ^ sub] > dp[mask]:
                        dp[mask] = dp[sub] + dp[mask ^ sub]
                        parent[mask] = sub
                sub = (sub - 1) & mask
                
    # Now backtrack to find the zero-sum partitions
    partitions = []
    
    def collect_partitions(mask):
        if mask == 0:
            return
        if parent[mask] != 0:
            collect_partitions(parent[mask])
            collect_partitions(mask ^ parent[mask])
        else:
            # This is an indivisible zero-sum subset (or a single element that sums to 0, which is impossible except 0)
            subset_users = []
            for i in range(n):
                if (mask & (1 << i)):
                    subset_users.append(user_ids[i])
            if subset_users:
                partitions.append(subset_users)
                
    full_mask = (1 << n) - 1
    if dp[full_mask] > 0:
        collect_partitions(full_mask)
    else:
        # No partition possible, the whole set is the only subset
        partitions.append(user_ids)
        
    # Run the greedy algorithm on each partition independently
    all_transactions = []
    for subset in partitions:
        sub_balances = {u: active_balances[u] for u in subset}
        all_transactions.extend(solve_greedy_debt(sub_balances))
        
    return all_transactions
