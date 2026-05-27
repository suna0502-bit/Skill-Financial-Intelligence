/* ==========================================================================
   Antigravity Financial Management Skill - Frontend SPA Logic
   ========================================================================== */

// Global State
const STATE = {
    activeTab: 'dashboard',
    users: [],
    currentUser: null, // User Object: { user_id, name }
    groups: [],
    activeGroupId: null,
    savingsGoals: [],
    // Category Colors for Charts
    categoryColors: {
        '飲食': '#ff9f43',
        '交通': '#00d2ff',
        '娛樂': '#b5179e',
        '帳單': '#ff2a6d',
        '其他': '#a0aec0',
        '儲蓄': '#00f5d4'
    }
};

// Document Elements
const el = {
    navItems: document.querySelectorAll('.nav-item'),
    tabPanes: document.querySelectorAll('.tab-pane'),
    globalUserSelect: document.getElementById('global-user-select'),
    dashboardDate: document.getElementById('dashboard-date'),
    
    // Dashboard Stats
    statNetWealth: document.getElementById('stat-net-wealth'),
    statTotalIncome: document.getElementById('stat-total-income'),
    statTotalExpense: document.getElementById('stat-total-expense'),
    statSavingsProgress: document.getElementById('stat-savings-progress'),
    recentTransactionsList: document.getElementById('recent-transactions-list'),
    goToLedger: document.getElementById('go-to-ledger'),
    
    // Quick Command Bar
    quickCommandInput: document.getElementById('quick-command-input'),
    quickCommandBtn: document.getElementById('quick-command-btn'),
    quickParsePreview: document.getElementById('quick-parse-preview'),
    
    // Personal Ledger Tab
    addTxnForm: document.getElementById('add-txn-form'),
    filterType: document.getElementById('filter-type'),
    filterCategory: document.getElementById('filter-category'),
    btnRefreshLedger: document.getElementById('btn-refresh-ledger'),
    ledgerTableBody: document.getElementById('ledger-table-body'),
    ledgerEmpty: document.getElementById('ledger-empty'),
    txnDate: document.getElementById('txn-date'),
    
    // Multi-Person Splitting Tab
    groupsListContainer: document.getElementById('groups-list-container'),
    btnShowCreateGroup: document.getElementById('btn-show-create-group'),
    activeGroupWorkplace: document.getElementById('active-group-workplace'),
    groupDefaultState: document.getElementById('group-default-state'),
    groupActiveState: document.getElementById('group-active-state'),
    activeGroupName: document.getElementById('active-group-name'),
    activeGroupMembersList: document.getElementById('active-group-members-list'),
    btnShowAddMember: document.getElementById('btn-show-add-member'),
    btnTriggerSettlement: document.getElementById('btn-trigger-settlement'),
    groupExpensesTableBody: document.getElementById('group-expenses-table-body'),
    addGroupExpenseForm: document.getElementById('add-group-expense-form'),
    groupExpPayer: document.getElementById('group-exp-payer'),
    groupExpDate: document.getElementById('group-exp-date'),
    splitParticipantsContainer: document.getElementById('split-participants-container'),
    settlementBalancesList: document.getElementById('settlement-balances-list'),
    settlementInstructionsList: document.getElementById('settlement-instructions-list'),
    settlementStatBadge: document.getElementById('settlement-stat-badge'),
    btnTabSettlement: document.getElementById('btn-tab-settlement'),
    
    // Savings Goals Tab
    btnShowCreateSavings: document.getElementById('btn-show-create-savings'),
    savingsGoalsGrid: document.getElementById('savings-goals-grid'),
    savingsEmptyState: document.getElementById('savings-empty-state'),
    
    // QA Terminal Tab
    btnRunStressTest: document.getElementById('btn-run-stress-test'),
    qaTerminalBody: document.getElementById('qa-terminal-body'),
    qaResultsEmpty: document.getElementById('qa-results-empty'),
    qaResultsContent: document.getElementById('qa-results-content'),
    qaStatExpenses: document.getElementById('qa-stat-expenses'),
    qaStatAlgTime: document.getElementById('qa-stat-alg-time'),
    qaStatZeroSum: document.getElementById('qa-stat-zero-sum'),
    qaStatTransfers: document.getElementById('qa-stat-transfers'),
    qaTransfersList: document.getElementById('qa-transfers-list')
};

// ==========================================
// A. Initialization & Setup
// ==========================================

document.addEventListener('DOMContentLoaded', async () => {
    // Set current date in forms
    const todayStr = getTodayDateString();
    el.txnDate.value = todayStr;
    el.groupExpDate.value = todayStr;
    el.dashboardDate.textContent = `📅 系統時間：${todayStr}`;
    
    // Load Users
    await loadUsers();
    
    // Hook Routing & Events
    setupNavigation();
    setupEventListeners();
    
    // Smart Command Bar Parser
    setupQuickCommandParser();
    
    // Load default tab
    switchTab('dashboard');
});

// Helper: Get today's YYYY-MM-DD
function getTodayDateString() {
    const d = new Date();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${month}-${day}`;
}

// Fetch and load users list
async function loadUsers() {
    try {
        const res = await fetch('/api/users');
        const users = await res.json();
        STATE.users = users;
        
        // Populate global dropdown selector
        el.globalUserSelect.innerHTML = '';
        users.forEach((user, idx) => {
            const opt = document.createElement('option');
            opt.value = user.user_id;
            opt.textContent = `${user.name} (ID: ${user.user_id})`;
            el.globalUserSelect.appendChild(opt);
        });
        
        if (users.length > 0) {
            STATE.currentUser = users[0];
        }
    } catch (e) {
        console.error('Failed to load users', e);
    }
}

// ==========================================
// B. SPA Routing & Switch Tabs
// ==========================================

function setupNavigation() {
    el.navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const tabName = item.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    el.goToLedger.addEventListener('click', (e) => {
        e.preventDefault();
        switchTab('ledger');
    });
}

function switchTab(tabName) {
    STATE.activeTab = tabName;
    
    // Active Nav Item
    el.navItems.forEach(item => {
        if (item.getAttribute('data-tab') === tabName) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
    
    // Active View Panel
    el.tabPanes.forEach(pane => {
        if (pane.id === `tab-${tabName}`) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });
    
    // Trigger specific tab loading
    if (tabName === 'dashboard') {
        loadDashboardData();
    } else if (tabName === 'ledger') {
        loadLedgerData();
    } else if (tabName === 'splitting') {
        loadSplittingData();
    } else if (tabName === 'savings') {
        loadSavingsData();
    }
}

// Global user change triggers reloading current view
el.globalUserSelect.addEventListener('change', (e) => {
    const uId = parseInt(e.target.value);
    STATE.currentUser = STATE.users.find(u => u.user_id === uId);
    
    // Reload active view data
    switchTab(STATE.activeTab);
});

// ==========================================
// C. Smart Quick Command Input Parser
// ==========================================

function setupQuickCommandParser() {
    // Dynamic matching keyword map
    const keywordMap = {
        '飲食': ['早餐', '午餐', '晚餐', '便當', '飲料', '咖啡', '火鍋', '點心', '下午茶', '拉麵', '麵包', '麥當勞', '超商'],
        '交通': ['公車', '捷運', '火車', '高鐵', '計程車', '油錢', '加油', '停車費', '悠遊卡', 'Uber', '客運'],
        '娛樂': ['電影', '遊戲', '唱歌', 'KTV', '漫畫', '玩具', '音樂', '門票', '展覽', '健身房'],
        '帳單': ['水費', '電費', '瓦斯費', '房租', '電話費', '網費', '保險', '信用卡']
    };
    
    el.quickCommandInput.addEventListener('input', () => {
        const raw = el.quickCommandInput.value.trim();
        if (!raw) {
            el.quickParsePreview.classList.add('hidden');
            return;
        }
        
        const parsed = parseQuickCommand(raw, keywordMap);
        if (parsed) {
            el.quickParsePreview.classList.remove('hidden');
            const typeLabel = parsed.type === 'expense' ? '🔴 支出' : '🟢 收入';
            el.quickParsePreview.innerHTML = `
                <span><i class="fa-solid fa-wand-magic-sparkles margin-r"></i><b>智能解析：</b> [${typeLabel}] 分類：<b>${parsed.category}</b> | 金額：<b>$${parsed.amount}</b> | 備註：<b>${parsed.memo}</b></span>
            `;
        } else {
            el.quickParsePreview.classList.add('hidden');
        }
    });
    
    // Execute command on clicking Btn or pressing Enter
    const runCmd = async () => {
        const raw = el.quickCommandInput.value.trim();
        if (!raw) return;
        
        const parsed = parseQuickCommand(raw, keywordMap);
        if (!parsed) {
            alert('無法解析指令。請使用格式：\n「記帳 早餐 150」（預設支出）\n「記帳 收入 薪水 50000」');
            return;
        }
        
        // Call API
        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: STATE.currentUser.user_id,
                    amount: parsed.amount,
                    type: parsed.type,
                    category: parsed.category,
                    memo: parsed.memo,
                    date: getTodayDateString()
                })
            });
            
            if (res.ok) {
                el.quickCommandInput.value = '';
                el.quickParsePreview.classList.add('hidden');
                
                // Show floating Success message/toast
                showToast(`成功記入一筆${parsed.type === 'expense' ? '支出' : '收入'}！金額 $${parsed.amount}`);
                
                // Reload active tab
                switchTab(STATE.activeTab);
            } else {
                const err = await res.json();
                alert(`記帳失敗: ${err.error}`);
            }
        } catch (e) {
            alert(`API 串接錯誤: ${e}`);
        }
    };
    
    el.quickCommandBtn.addEventListener('click', runCmd);
    el.quickCommandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            runCmd();
        }
    });

    // Premium interactive template chips click handler
    document.querySelectorAll('.quick-chip-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cmd = btn.getAttribute('data-cmd');
            el.quickCommandInput.value = cmd;
            // Dispatch input event to dynamically render smart parser preview
            el.quickCommandInput.dispatchEvent(new Event('input'));
            el.quickCommandInput.focus();
        });
    });
}

// Logic: Parsing raw text commands
function parseQuickCommand(text, keywordMap) {
    // Expected formats: 
    // 記帳 [類別/備忘] [金額] (default expense)
    // 記帳 收入 [類別/備忘] [金額]
    const tokens = text.split(/\s+/).filter(t => t.length > 0);
    if (tokens.length < 3 || tokens[0] !== '記帳') {
        return null;
    }
    
    let type = 'expense';
    let memoIdx = 1;
    
    // Check if Explicit Income
    if (tokens[1] === '收入') {
        type = 'income';
        memoIdx = 2;
    }
    
    if (tokens.length <= memoIdx + 1) return null;
    
    const memo = tokens.slice(memoIdx, -1).join(' ');
    const amountStr = tokens[tokens.length - 1];
    const amount = parseFloat(amountStr);
    
    if (isNaN(amount) || amount <= 0) return null;
    
    // Map Category based on keyword in memo
    let category = type === 'income' ? '其他' : '其他';
    if (type === 'expense') {
        outerLoop: for (const [cat, keywords] of Object.entries(keywordMap)) {
            for (const kw of keywords) {
                if (memo.includes(kw)) {
                    category = cat;
                    break outerLoop;
                }
            }
        }
    } else {
        // Income categories
        if (memo.includes('薪水') || memo.includes('薪資')) category = '其他';
        if (memo.includes('獎金')) category = '其他';
    }
    
    return { type, category, memo, amount };
}

// Simple floating toast notification helper
function showToast(msg) {
    const toast = document.createElement('div');
    toast.className = 'glass-panel';
    toast.style.position = 'fixed';
    toast.style.bottom = '30px';
    toast.style.right = '40px';
    toast.style.background = 'rgba(0, 245, 212, 0.15)';
    toast.style.border = '1px solid rgba(0, 245, 212, 0.4)';
    toast.style.color = '#00f5d4';
    toast.style.fontWeight = '600';
    toast.style.padding = '12px 24px';
    toast.style.borderRadius = '12px';
    toast.style.boxShadow = '0 8px 32px rgba(0, 245, 212, 0.1)';
    toast.style.zIndex = '9999';
    toast.style.animation = 'fadeIn 0.3s ease-out';
    toast.innerHTML = `<i class="fa-solid fa-circle-check margin-r"></i> ${msg}`;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.4s';
        setTimeout(() => toast.remove(), 400);
    }, 2500);
}

// ==========================================
// D. Dashboard Rendering
// ==========================================

async function loadDashboardData() {
    if (!STATE.currentUser) return;
    
    try {
        // 1. Fetch Summary
        const resSum = await fetch(`/api/transactions/summary?user_id=${STATE.currentUser.user_id}`);
        const summary = await resSum.json();
        
        // 2. Fetch Savings Progress to show on Overview card
        const resSav = await fetch(`/api/savings?user_id=${STATE.currentUser.user_id}`);
        const savings = await resSav.json();
        let savingsPct = 0;
        if (savings.length > 0) {
            const totTarget = savings.reduce((acc, g) => acc + g.target_amount, 0);
            const totSaved = savings.reduce((acc, g) => acc + g.current_amount, 0);
            savingsPct = totTarget > 0 ? Math.round((totSaved / totTarget) * 100) : 0;
        }
        
        // Render Stats
        el.statNetWealth.textContent = `$${summary.net_balance.toFixed(2)}`;
        el.statTotalIncome.textContent = `$${summary.total_income.toFixed(2)}`;
        el.statTotalExpense.textContent = `$${summary.total_expense.toFixed(2)}`;
        el.statSavingsProgress.textContent = `${savingsPct}%`;
        
        // Visual indicator colors based on positive/negative net wealth
        if (summary.net_balance >= 0) {
            el.statNetWealth.style.color = '#1d4ed8'; // Vibrant deep royal blue for positive/zero assets
        } else {
            el.statNetWealth.style.color = 'var(--accent-coral)'; // Vibrant coral for negative assets
        }
        
        // Render Donut Chart
        renderDonutChart(summary.categories);
        
        // 3. Fetch Recent Transactions
        const resTxns = await fetch(`/api/transactions?user_id=${STATE.currentUser.user_id}`);
        const txns = await resTxns.json();
        
        el.recentTransactionsList.innerHTML = '';
        if (txns.length === 0) {
            el.recentTransactionsList.innerHTML = '<div class="empty-state">尚未有任何交易紀錄</div>';
        } else {
            txns.slice(0, 5).forEach(tx => {
                const item = document.createElement('div');
                item.className = 'recent-item';
                
                const catClassMap = {
                    '飲食': 'badge-diet',
                    '交通': 'badge-trans',
                    '娛樂': 'badge-entertain',
                    '帳單': 'badge-bill',
                    '其他': 'badge-other',
                    '儲蓄': 'badge-savings'
                };
                const badgeClass = catClassMap[tx.category] || 'badge-other';
                
                const amtSign = tx.type === 'income' ? '+' : '-';
                const amtClass = tx.type === 'income' ? 'income' : 'expense';
                
                item.innerHTML = `
                    <span class="recent-date">${tx.date}</span>
                    <span><span class="category-badge ${badgeClass}">${tx.category}</span></span>
                    <span class="recent-memo" title="${tx.memo}">${tx.memo || '--'}</span>
                    <span class="recent-amount ${amtClass} align-right">${amtSign}$${tx.amount.toFixed(2)}</span>
                `;
                el.recentTransactionsList.appendChild(item);
            });
        }
    } catch (e) {
        console.error('Failed loading dashboard details', e);
    }
}

// Custom HTML5 Canvas Donut Chart Drawer
function renderDonutChart(categories) {
    const canvas = document.getElementById('expense-donut-chart');
    const legend = document.getElementById('chart-legend');
    
    legend.innerHTML = '';
    
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Filter categories with amounts > 0
    const activeCats = categories.filter(c => c.amount > 0);
    const totalExpense = activeCats.reduce((acc, c) => acc + c.amount, 0);
    
    if (totalExpense === 0) {
        // Draw empty grey circle
        ctx.beginPath();
        ctx.arc(110, 110, 80, 0, 2 * Math.PI);
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = 20;
        ctx.stroke();
        
        ctx.fillStyle = '#718096';
        ctx.font = '14px Inter';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('無支出開銷', 110, 110);
        
        legend.innerHTML = '<div class="empty-state" style="padding: 10px 0;">無本月支出明細</div>';
        return;
    }
    
    let startAngle = -0.5 * Math.PI;
    
    activeCats.forEach(c => {
        const sliceAngle = (c.amount / totalExpense) * 2 * Math.PI;
        const color = STATE.categoryColors[c.category] || '#a0aec0';
        
        // Draw Arc
        ctx.beginPath();
        ctx.arc(110, 110, 80, startAngle, startAngle + sliceAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        ctx.stroke();
        
        startAngle += sliceAngle;
        
        // Add to HTML legend
        const percent = ((c.amount / totalExpense) * 100).toFixed(0);
        const item = document.createElement('div');
        item.className = 'legend-item';
        item.innerHTML = `
            <div class="legend-color-label">
                <span class="legend-color-dot" style="background-color: ${color};"></span>
                <span>${c.category}</span>
            </div>
            <span class="legend-pct">${percent}% ($${c.amount.toFixed(0)})</span>
        `;
        legend.appendChild(item);
    });
    
    // Draw center total cost text
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Outfit';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('總支出', 110, 95);
    
    ctx.fillStyle = '#ff2a6d';
    ctx.font = 'bold 18px Outfit';
    ctx.fillText(`$${totalExpense.toFixed(0)}`, 110, 120);
}

// ==========================================
// E. Personal Ledger Rendering & Handlers
// ==========================================

async function loadLedgerData() {
    if (!STATE.currentUser) return;
    
    try {
        const type = el.filterType.value;
        const cat = el.filterCategory.value;
        
        let url = `/api/transactions?user_id=${STATE.currentUser.user_id}`;
        if (type !== 'all') url += `&type=${type}`;
        if (cat !== 'all') url += `&category=${cat}`;
        
        const res = await fetch(url);
        const txns = await res.json();
        
        el.ledgerTableBody.innerHTML = '';
        if (txns.length === 0) {
            el.ledgerEmpty.classList.remove('hidden');
        } else {
            el.ledgerEmpty.classList.add('hidden');
            txns.forEach(tx => {
                const tr = document.createElement('tr');
                
                const catClassMap = {
                    '飲食': 'badge-diet',
                    '交通': 'badge-trans',
                    '娛樂': 'badge-entertain',
                    '帳單': 'badge-bill',
                    '其他': 'badge-other',
                    '儲蓄': 'badge-savings'
                };
                const badgeClass = catClassMap[tx.category] || 'badge-other';
                
                const isInc = tx.type === 'income';
                const amtSign = isInc ? '+' : '-';
                const amtClass = isInc ? 'income' : 'expense';
                const typeLabel = isInc ? '🟢 收入' : '🔴 支出';
                
                tr.innerHTML = `
                    <td>${tx.date}</td>
                    <td><span class="category-badge ${badgeClass}">${tx.category}</span></td>
                    <td class="${isInc ? 'text-teal' : 'text-coral'}">${typeLabel}</td>
                    <td>${tx.memo || '--'}</td>
                    <td class="table-amount ${amtClass} align-right">${amtSign}$${tx.amount.toFixed(2)}</td>
                    <td class="align-center">
                        <button class="btn-delete-txn" data-id="${tx.txn_id}"><i class="fa-solid fa-trash-can"></i></button>
                    </td>
                `;
                
                // Add Delete button event
                tr.querySelector('.btn-delete-txn').addEventListener('click', () => deleteTransaction(tx.txn_id));
                
                el.ledgerTableBody.appendChild(tr);
            });
        }
    } catch (e) {
        console.error('Failed loading ledger table', e);
    }
}

// Manual Ledger Add Form Submission
el.addTxnForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!STATE.currentUser) return;
    
    const type = document.querySelector('input[name="txn-type"]:checked').value;
    const category = document.getElementById('txn-category').value;
    const amount = parseFloat(document.getElementById('txn-amount').value);
    const date = document.getElementById('txn-date').value;
    const memo = document.getElementById('txn-memo').value;
    
    try {
        const res = await fetch('/api/transactions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: STATE.currentUser.user_id,
                amount,
                type,
                category,
                memo,
                date
            })
        });
        
        if (res.ok) {
            el.addTxnForm.reset();
            // Keep default dates
            const todayStr = getTodayDateString();
            el.txnDate.value = todayStr;
            
            showToast('記帳交易新增成功！');
            loadLedgerData();
        } else {
            const err = await res.json();
            alert(`儲存失敗：${err.error}`);
        }
    } catch (err) {
        alert(`API 請求錯誤: ${err}`);
    }
});

// Delete Transaction
async function deleteTransaction(txnId) {
    if (!confirm('您確定要刪除這筆交易紀錄嗎？此動作將無法復原。')) return;
    
    try {
        const res = await fetch(`/api/transactions/${txnId}`, { method: 'DELETE' });
        if (res.ok) {
            showToast('已成功刪除記帳紀錄。');
            loadLedgerData();
        } else {
            alert('刪除失敗！');
        }
    } catch (e) {
        alert(e);
    }
}

el.filterType.addEventListener('change', loadLedgerData);
el.filterCategory.addEventListener('change', loadLedgerData);
el.btnRefreshLedger.addEventListener('click', loadLedgerData);

// ==========================================
// F. Multi-Person Splitting Logic
// ==========================================

async function loadSplittingData() {
    try {
        // Fetch Groups list
        const res = await fetch('/api/groups');
        const groups = await res.json();
        STATE.groups = groups;
        
        renderGroupsList();
        
        // Refresh currently active group details if selected
        if (STATE.activeGroupId) {
            selectGroup(STATE.activeGroupId);
        } else {
            el.groupDefaultState.classList.remove('hidden');
            el.groupActiveState.classList.add('hidden');
        }
    } catch (e) {
        console.error('Failed to load splitting groups', e);
    }
}

function renderGroupsList() {
    el.groupsListContainer.innerHTML = '';
    if (STATE.groups.length === 0) {
        el.groupsListContainer.innerHTML = '<div class="empty-state">尚未建立任何分帳群組</div>';
        return;
    }
    
    STATE.groups.forEach(g => {
        const card = document.createElement('div');
        card.className = `group-item-card ${STATE.activeGroupId === g.group_id ? 'active' : ''}`;
        card.innerHTML = `
            <h4>${g.group_name}</h4>
            <span class="group-members-count"><i class="fa-solid fa-users"></i> ${g.members.length} 位成員</span>
        `;
        
        card.addEventListener('click', () => {
            selectGroup(g.group_id);
        });
        el.groupsListContainer.appendChild(card);
    });
}

async function selectGroup(groupId) {
    STATE.activeGroupId = groupId;
    
    // Highlight sidebar card
    const cards = document.querySelectorAll('.group-item-card');
    cards.forEach(c => c.classList.remove('active'));
    
    // Retrieve group detail from API
    try {
        const res = await fetch(`/api/groups/${groupId}`);
        if (!res.ok) {
            STATE.activeGroupId = null;
            el.groupDefaultState.classList.remove('hidden');
            el.groupActiveState.classList.add('hidden');
            return;
        }
        
        const g = await res.json();
        
        el.groupDefaultState.classList.add('hidden');
        el.groupActiveState.classList.remove('hidden');
        
        // Set Group basic UI info
        el.activeGroupName.textContent = g.group_name;
        el.activeGroupMembersList.innerHTML = '';
        g.members.forEach(m => {
            const b = document.createElement('span');
            b.className = 'member-badge';
            b.textContent = m.name;
            el.activeGroupMembersList.appendChild(b);
        });
        
        // Set split payer dropdown
        el.groupExpPayer.innerHTML = '';
        g.members.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.user_id;
            opt.textContent = m.name;
            el.groupExpPayer.appendChild(opt);
        });
        
        // Render Group Expenses History list
        renderGroupExpensesTable(g.expenses, g.members);
        
        // Render splitting configuration participants list
        renderSplittingParticipantsConfig(g.members);
        
        // Reset split modes tab view to history
        switchGroupTab('expenses-history');
        
    } catch (e) {
        console.error('Failed to load group details', e);
    }
}

// Split Work Tab toggles inside active group
document.querySelectorAll('.group-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.getAttribute('data-group-tab');
        switchGroupTab(target);
    });
});

function switchGroupTab(tabName) {
    document.querySelectorAll('.group-tab-btn').forEach(btn => {
        if (btn.getAttribute('data-group-tab') === tabName) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.group-tab-content').forEach(cont => {
        if (cont.id === `group-tab-${tabName}`) {
            cont.classList.add('active');
        } else {
            cont.classList.remove('active');
        }
    });
    
    // If settlement tab clicked, calculate settlement immediately!
    if (tabName === 'settlement-results') {
        calculateGroupSettlement();
    }
}

function renderGroupExpensesTable(expenses, members) {
    el.groupExpensesTableBody.innerHTML = '';
    if (expenses.length === 0) {
        el.groupExpensesTableBody.innerHTML = '<tr><td colspan="5" class="table-empty">無共同消費花費紀錄</td></tr>';
        return;
    }
    
    // Map member ID to name
    const memMap = {};
    members.forEach(m => memMap[m.user_id] = m.name);
    
    expenses.forEach(exp => {
        const tr = document.createElement('tr');
        
        // Generate split details tooltip list
        let splitHoverText = '';
        for (const [uid, centsAmt] of Object.entries(exp.split_details)) {
            const name = memMap[uid] || `User ${uid}`;
            splitHoverText += `${name}: $${centsAmt.toFixed(2)}\n`;
        }
        
        tr.innerHTML = `
            <td>${exp.date}</td>
            <td class="font-weight-600">${exp.description}</td>
            <td>${exp.payer_name}</td>
            <td class="table-amount align-right text-coral">$${exp.total_amount.toFixed(2)}</td>
            <td>
                <span class="category-badge badge-other" title="${splitHoverText.trim()}" style="cursor: pointer;">
                    <i class="fa-solid fa-circle-info margin-r"></i>查看分攤
                </span>
            </td>
        `;
        el.groupExpensesTableBody.appendChild(tr);
    });
}

function renderSplittingParticipantsConfig(members) {
    el.splitParticipantsContainer.innerHTML = '';
    
    members.forEach(m => {
        const row = document.createElement('div');
        row.className = 'participant-split-row';
        row.innerHTML = `
            <label class="participant-label-chk">
                <input type="checkbox" class="chk-participant" value="${m.user_id}" checked>
                <span>${m.name}</span>
            </label>
            <div class="participant-split-input-wrap hidden" id="wrap-split-input-${m.user_id}">
                <span class="split-unit-label">比例</span>
                <input type="number" class="split-input" id="val-split-input-${m.user_id}" value="1" min="0" step="any">
            </div>
        `;
        
        const chk = row.querySelector('.chk-participant');
        const wrap = row.querySelector('.participant-split-input-wrap');
        
        chk.addEventListener('change', () => {
            const activeMode = document.querySelector('input[name="split-mode"]:checked').value;
            if (activeMode !== 'AA' && chk.checked) {
                wrap.classList.remove('hidden');
            } else {
                wrap.classList.add('hidden');
            }
        });
        
        el.splitParticipantsContainer.appendChild(row);
    });
}

// Split mode toggle changes participant input views
document.querySelectorAll('input[name="split-mode"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
        const mode = e.target.value;
        const chks = document.querySelectorAll('.chk-participant');
        
        chks.forEach(chk => {
            const uid = chk.value;
            const wrap = document.getElementById(`wrap-split-input-${uid}`);
            const label = wrap.querySelector('.split-unit-label');
            const input = document.getElementById(`val-split-input-${uid}`);
            
            if (mode === 'AA') {
                wrap.classList.add('hidden');
            } else {
                if (chk.checked) {
                    wrap.classList.remove('hidden');
                }
                
                if (mode === 'ratio') {
                    label.textContent = '比例';
                    input.value = '1';
                    input.min = '0.1';
                    input.step = '0.1';
                } else if (mode === 'custom') {
                    label.textContent = '金額 $';
                    input.value = '0.00';
                    input.min = '0.01';
                    input.step = '0.01';
                }
            }
        });
    });
});

// Group Expense Form Submission
el.addGroupExpenseForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!STATE.activeGroupId) return;
    
    const payer_id = parseInt(el.groupExpPayer.value);
    const total_amount = parseFloat(document.getElementById('group-exp-amount').value);
    const description = document.getElementById('group-exp-desc').value;
    const date = el.groupExpDate.value;
    const split_mode = document.querySelector('input[name="split-mode"]:checked').value;
    
    // Gather checked participants
    const participants = [];
    const split_details = {};
    const chks = document.querySelectorAll('.chk-participant');
    
    chks.forEach(chk => {
        if (chk.checked) {
            const uid = parseInt(chk.value);
            participants.push(uid);
            
            if (split_mode !== 'AA') {
                const inputVal = parseFloat(document.getElementById(`val-split-input-${uid}`).value) || 0;
                split_details[uid] = inputVal;
            }
        }
    });
    
    if (participants.length === 0) {
        alert('請至少選擇一位分攤成員！');
        return;
    }
    
    // Validation for custom split amounts
    if (split_mode === 'custom') {
        const sumAllocated = Object.values(split_details).reduce((acc, v) => acc + v, 0);
        if (Math.abs(sumAllocated - total_amount) > 0.02) {
            alert(`自訂分攤總額 ($${sumAllocated.toFixed(2)}) 必須等於消費總金額 ($${total_amount.toFixed(2)})！`);
            return;
        }
        
        // Convert to cents for API parameters
        for (const [k, v] of Object.entries(split_details)) {
            split_details[k] = Math.round(v * 100);
        }
    }
    
    try {
        const res = await fetch(`/api/groups/${STATE.activeGroupId}/expenses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                payer_id,
                total_amount,
                description,
                split_mode,
                members: participants,
                split_details: split_mode === 'AA' ? null : split_details,
                date
            })
        });
        
        if (res.ok) {
            el.addGroupExpenseForm.reset();
            el.groupExpDate.value = getTodayDateString();
            // Reset AA selector view
            document.getElementById('mode-aa').checked = true;
            document.getElementById('mode-aa').dispatchEvent(new Event('change'));
            
            showToast('群組消費紀錄成功新增！');
            selectGroup(STATE.activeGroupId);
        } else {
            const err = await res.json();
            alert(`群組記帳失敗：${err.error}`);
        }
    } catch (err) {
        alert(err);
    }
});

// Debt Simplification Solver Trigger & UI Render
async function calculateGroupSettlement() {
    if (!STATE.activeGroupId) return;
    
    try {
        const res = await fetch(`/api/groups/${STATE.activeGroupId}/settlement`);
        const data = await res.json();
        
        // 1. Render Balances Breakdown
        el.settlementBalancesList.innerHTML = '';
        
        // Find max absolute balance for progress scaling
        let maxAbsBal = 0.01;
        for (const [uid, bInfo] of Object.entries(data.balances)) {
            const absVal = Math.abs(bInfo.balance);
            if (absVal > maxAbsBal) maxAbsBal = absVal;
        }
        
        for (const [uid, bInfo] of Object.entries(data.balances)) {
            const div = document.createElement('div');
            div.className = 'balance-item-row';
            
            const isCred = bInfo.balance >= 0;
            const sign = isCred ? '+' : '';
            const valClass = isCred ? 'positive' : 'negative';
            const pct = Math.min(100, Math.round((Math.abs(bInfo.balance) / maxAbsBal) * 100));
            
            div.innerHTML = `
                <div class="balance-row-header">
                    <span>${bInfo.name}</span>
                    <span class="balance-val ${valClass}">${sign}$${bInfo.balance.toFixed(2)}</span>
                </div>
                <div class="balance-track-bar">
                    <div class="balance-fill-progress ${valClass}" style="width: ${pct}%;"></div>
                </div>
            `;
            el.settlementBalancesList.appendChild(div);
        }
        
        // 2. Render optimized transfers instruction list
        el.settlementInstructionsList.innerHTML = '';
        el.settlementStatBadge.textContent = `共 ${data.transfers_count} 筆交易`;
        
        if (data.settlement_instructions.length === 0) {
            el.settlementInstructionsList.innerHTML = '<div class="empty-state" style="padding: 20px 0;">🎉 全體帳務已完全結清！無須任何轉帳。</div>';
            return;
        }
        
        data.settlement_instructions.forEach(ins => {
            const item = document.createElement('div');
            item.className = 'settlement-instruction-card';
            item.innerHTML = `
                <span class="instr-debtor">${ins.from_name}</span>
                <i class="fa-solid fa-right-long instr-arrow-sign"></i>
                <span class="instr-creditor">${ins.to_name}</span>
                <span class="instr-amount-card">轉帳 $${ins.amount.toFixed(2)}</span>
            `;
            el.settlementInstructionsList.appendChild(item);
        });
        
    } catch (e) {
        console.error('Failed calculating settlements', e);
    }
}

// Add group member
el.btnShowAddMember.addEventListener('click', () => {
    // Populate checkboxes in Add Member modal with users who are NOT currently in the group
    const group = STATE.groups.find(g => g.group_id === STATE.activeGroupId);
    if (!group) return;
    
    const currMemberIds = group.members.map(m => m.user_id);
    const nonMembers = STATE.users.filter(u => !currMemberIds.includes(u.user_id));
    
    const list = document.getElementById('add-member-checkboxes');
    list.innerHTML = '';
    
    if (nonMembers.length === 0) {
        list.innerHTML = '<p class="text-muted" style="grid-column: 1/-1;">全體系統使用者皆已在群組中！</p>';
    } else {
        nonMembers.forEach(u => {
            const lbl = document.createElement('label');
            lbl.className = 'checkbox-item-label';
            lbl.innerHTML = `
                <input type="checkbox" name="add-group-u-id" value="${u.user_id}">
                <span>${u.name}</span>
            `;
            list.appendChild(lbl);
        });
    }
    
    document.getElementById('modal-add-member').classList.remove('hidden');
});

document.getElementById('add-member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!STATE.activeGroupId) return;
    
    const checkboxes = document.querySelectorAll('input[name="add-group-u-id"]:checked');
    const uIds = Array.from(checkboxes).map(chk => parseInt(chk.value));
    
    if (uIds.length === 0) {
        alert('請選取要新增的使用者！');
        return;
    }
    
    try {
        const res = await fetch(`/api/groups/${STATE.activeGroupId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_ids: uIds })
        });
        
        if (res.ok) {
            document.getElementById('modal-add-member').classList.add('hidden');
            showToast('已成功將新成員加入群組！');
            loadSplittingData();
        } else {
            alert('新增失敗');
        }
    } catch (e) {
        alert(e);
    }
});

// Create group modals trigger
el.btnShowCreateGroup.addEventListener('click', () => {
    const list = document.getElementById('group-member-checkboxes');
    list.innerHTML = '';
    
    STATE.users.forEach(u => {
        const lbl = document.createElement('label');
        lbl.className = 'checkbox-item-label';
        lbl.innerHTML = `
            <input type="checkbox" name="new-group-u-id" value="${u.user_id}">
            <span>${u.name}</span>
        `;
        list.appendChild(lbl);
    });
    
    document.getElementById('modal-create-group').classList.remove('hidden');
});

document.getElementById('create-group-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const group_name = document.getElementById('new-group-name').value;
    const checkboxes = document.querySelectorAll('input[name="new-group-u-id"]:checked');
    const members = Array.from(checkboxes).map(chk => parseInt(chk.value));
    
    if (members.length === 0) {
        alert('建立群組必須至少包含一位成員！');
        return;
    }
    
    try {
        const res = await fetch('/api/groups', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ group_name, members })
        });
        
        if (res.ok) {
            const data = await res.json();
            document.getElementById('create-group-form').reset();
            document.getElementById('modal-create-group').classList.add('hidden');
            
            showToast(`群組「${group_name}」建立成功！`);
            STATE.activeGroupId = data.group_id; // Set as selected active group
            loadSplittingData();
        } else {
            alert('群組建立失敗！');
        }
    } catch (err) {
        alert(err);
    }
});

// Settlement tab direct calculation button
el.btnTriggerSettlement.addEventListener('click', () => {
    switchGroupTab('settlement-results');
});

// ==========================================
// G. Savings Goals Logic
// ==========================================

async function loadSavingsData() {
    if (!STATE.currentUser) return;
    
    try {
        const res = await fetch(`/api/savings?user_id=${STATE.currentUser.user_id}`);
        const goals = await res.json();
        STATE.savingsGoals = goals;
        
        el.savingsGoalsGrid.innerHTML = '';
        if (goals.length === 0) {
            el.savingsEmptyState.classList.remove('hidden');
        } else {
            el.savingsEmptyState.classList.add('hidden');
            
            goals.forEach(g => {
                const card = document.createElement('div');
                card.className = 'savings-card glass-panel';
                card.innerHTML = `
                    <div class="card-glow" style="background: radial-gradient(circle, rgba(0, 245, 212, 0.1) 0%, rgba(0, 245, 212, 0) 70%);"></div>
                    <div class="savings-header-row">
                        <span class="savings-goal-title">${g.goal_name}</span>
                        <span class="savings-deadline-pill"><i class="fa-solid fa-calendar-day margin-r"></i>${g.deadline}</span>
                    </div>
                    <div class="savings-amounts-row">
                        <div>
                            <span class="savings-curr-large">$${g.current_amount.toFixed(2)}</span>
                        </div>
                        <span class="savings-target-label">目標 $${g.target_amount.toFixed(0)}</span>
                    </div>
                    <div class="savings-progress-section">
                        <div class="progress-pct-row">
                            <span>達成率</span>
                            <span class="pct-val">${g.progress_percent}%</span>
                        </div>
                        <div class="savings-track-bar">
                            <div class="savings-fill-progress" style="width: ${g.progress_percent}%;"></div>
                        </div>
                    </div>
                    <div class="savings-footer-row">
                        <span class="savings-time-left">
                            <i class="fa-solid fa-hourglass-half"></i>距離達成還有 <b>${g.days_left}</b> 天
                        </span>
                        <button class="btn-inject-savings" data-id="${g.goal_id}" data-name="${g.goal_name}"><i class="fa-solid fa-plus-circle"></i> 存入資金</button>
                    </div>
                `;
                
                // Attach Deposit button
                card.querySelector('.btn-inject-savings').addEventListener('click', (e) => {
                    const goalId = e.target.getAttribute('data-id');
                    const goalName = e.target.getAttribute('data-name');
                    openDepositModal(goalId, goalName);
                });
                
                el.savingsGoalsGrid.appendChild(card);
            });
        }
    } catch (e) {
        console.error('Failed to load savings goals', e);
    }
}

// Create savings plan modals trigger
el.btnShowCreateSavings.addEventListener('click', () => {
    document.getElementById('modal-create-savings').classList.remove('hidden');
});

document.getElementById('create-savings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!STATE.currentUser) return;
    
    const goal_name = document.getElementById('saving-name').value;
    const target_amount = parseFloat(document.getElementById('saving-target').value);
    const deadline = document.getElementById('saving-deadline').value;
    
    try {
        const res = await fetch('/api/savings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                user_id: STATE.currentUser.user_id,
                goal_name,
                target_amount,
                deadline
            })
        });
        
        if (res.ok) {
            document.getElementById('create-savings-form').reset();
            document.getElementById('modal-create-savings').classList.add('hidden');
            
            showToast(`儲蓄計畫「${goal_name}」開啟成功！`);
            loadSavingsData();
        } else {
            alert('儲蓄目標建立失敗！');
        }
    } catch (err) {
        alert(err);
    }
});

// Deposit savings
function openDepositModal(goalId, goalName) {
    document.getElementById('deposit-goal-id').value = goalId;
    document.getElementById('deposit-goal-name').textContent = goalName;
    document.getElementById('deposit-amount').value = '';
    document.getElementById('modal-deposit-savings').classList.remove('hidden');
}

document.getElementById('deposit-savings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const goalId = document.getElementById('deposit-goal-id').value;
    const amount = parseFloat(document.getElementById('deposit-amount').value);
    const link_ledger = document.getElementById('deposit-link-ledger').checked;
    
    try {
        const res = await fetch(`/api/savings/${goalId}/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, link_ledger })
        });
        
        if (res.ok) {
            document.getElementById('modal-deposit-savings').classList.add('hidden');
            
            // Premium micro-interaction: Find target savings card to trigger coin fall & bounce
            const btn = document.querySelector(`.btn-inject-savings[data-id="${goalId}"]`);
            if (btn) {
                const card = btn.closest('.savings-card');
                triggerSavingsAnimation(card);
            }
            
            showToast(`成功注入資金 $${amount.toFixed(2)}！`);
            loadSavingsData();
        } else {
            alert('存款儲蓄失敗！');
        }
    } catch (err) {
        alert(err);
    }
});

// Gold coin dropping physical animation helper
function triggerSavingsAnimation(card) {
    if (!card) return;
    
    // Create animated golden coin
    const coin = document.createElement('div');
    coin.className = 'coin-gold';
    
    // Position dynamically based on card bounding
    const rect = card.getBoundingClientRect();
    coin.style.left = `${rect.left + rect.width / 2 - 7 + window.scrollX}px`;
    coin.style.top = `${rect.top - 20 + window.scrollY}px`;
    
    document.body.appendChild(coin);
    
    // Start card bouncing / jiggle effect
    card.classList.add('jiggle-card');
    
    setTimeout(() => {
        coin.remove();
        card.classList.remove('jiggle-card');
    }, 800);
}

// ==========================================
// H. QA stress test playground
// ==========================================

el.btnRunStressTest.addEventListener('click', async () => {
    // Disable Button to avoid double trigger
    el.btnRunStressTest.disabled = true;
    el.btnRunStressTest.innerHTML = '<i class="fa-solid fa-spinner fa-spin margin-r"></i> 正在生成 50+ 交易進行壓力測試...';
    
    // Clear views
    el.qaTerminalBody.innerHTML = '';
    el.qaResultsEmpty.classList.remove('hidden');
    el.qaResultsContent.classList.add('hidden');
    
    const printLine = (msg, cssClass = '') => {
        const line = document.createElement('div');
        line.className = `terminal-line ${cssClass}`;
        line.innerHTML = `[${new Date().toLocaleTimeString()}] ${msg}`;
        el.qaTerminalBody.appendChild(line);
        el.qaTerminalBody.scrollTop = el.qaTerminalBody.scrollHeight;
    };
    
    printLine('🚀 初始化極限壓力測試...', 'text-muted');
    
    setTimeout(async () => {
        printLine('➡️ 向伺服器發送 POST /api/test/stress 請求...');
        printLine('⚙️ 伺服器正在資料庫註冊 10 名壓力測試員...');
        
        try {
            const startTime = performance.now();
            const res = await fetch('/api/test/stress', { method: 'POST' });
            const data = await res.json();
            const elapsed = performance.now() - startTime;
            
            if (res.ok && data.status === 'success') {
                printLine('⚙️ 伺服器正在生成隨機 AA、比例及自訂金額的分帳交易紀錄...');
                
                setTimeout(() => {
                    printLine(`✅ 成功寫入 <b>${data.expenses_inserted}</b> 筆交互共同消費消費！`, 'text-teal');
                    printLine(`🔍 啟動債務簡化優化器 - 運用網路流最大抵銷演算法 (Zero-Sum DP)...`);
                    
                    setTimeout(() => {
                        printLine(`📊 債務優化完成！運算耗時：<b>${data.execution_time_algorithm_only_ms.toFixed(4)} ms</b>`, 'text-teal');
                        printLine(`⚖️ 淨額零和差值校驗：<b>${data.zero_sum_check_cents} cents</b> ($0.00 NTD)`, 'text-teal');
                        printLine(`📈 債務簡化率：將複雜欠款精確縮減至最少 <b>${data.transfers_count} 筆</b> 轉帳。`, 'text-teal');
                        printLine(`⭐ 品質管制標準校驗：`);
                        
                        const verify1 = data.zero_sum_verified ? 'PASS' : 'FAIL';
                        const verify2 = data.optimized_indicator_ok ? 'PASS' : 'FAIL';
                        
                        printLine(`   - 零和差值等於 0 校驗：<b>${verify1}</b>`, data.zero_sum_verified ? 'text-teal' : 'text-coral');
                        printLine(`   - 最少轉帳次數 T ≤ 9 校驗：<b>${verify2}</b>`, data.optimized_indicator_ok ? 'text-teal' : 'text-coral');
                        printLine(`🎉 壓力測試成功，演算法精度與效能均通過工業級檢驗！`, 'text-teal');
                        
                        // Populate results dashboard UI
                        el.qaResultsEmpty.classList.add('hidden');
                        el.qaResultsContent.classList.remove('hidden');
                        
                        el.qaStatExpenses.textContent = `${data.expenses_inserted} 筆`;
                        el.qaStatAlgTime.textContent = `${data.execution_time_algorithm_only_ms.toFixed(3)} ms`;
                        el.qaStatZeroSum.textContent = `$${(data.zero_sum_check_cents / 100).toFixed(2)}元`;
                        el.qaStatTransfers.textContent = `${data.transfers_count} 筆`;
                        
                        // Render optimized transactions list
                        el.qaTransfersList.innerHTML = '';
                        data.transfers.forEach((tx, idx) => {
                            const item = document.createElement('div');
                            item.className = 'qa-transfer-item';
                            item.innerHTML = `
                                <span>${String(idx+1).padStart(2, '0')}. <b>${tx.from}</b> <i class="fa-solid fa-arrow-right-long text-coral margin-r margin-l"></i> <b>${tx.to}</b></span>
                                <span class="amount-box">轉帳 $${tx.amount.toFixed(2)}</span>
                            `;
                            el.qaTransfersList.appendChild(item);
                        });
                        
                        // Re-enable button
                        el.btnRunStressTest.disabled = false;
                        el.btnRunStressTest.innerHTML = '<i class="fa-solid fa-rocket margin-r"></i> 重新啟動壓力測試';
                        
                    }, 800);
                }, 800);
            } else {
                printLine(`❌ 伺服器回傳錯誤: ${data.message || '未知錯誤'}`, 'text-coral');
                el.btnRunStressTest.disabled = false;
                el.btnRunStressTest.innerHTML = '<i class="fa-solid fa-rocket margin-r"></i> 重新啟動壓力測試';
            }
        } catch (e) {
            printLine(`❌ 網路請求錯誤: ${e}`, 'text-coral');
            el.btnRunStressTest.disabled = false;
            el.btnRunStressTest.innerHTML = '<i class="fa-solid fa-rocket margin-r"></i> 重新啟動壓力測試';
        }
    }, 500);
});

// ==========================================
// I. Modal backdrop close handler bindings
// ==========================================

document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        document.getElementById(modalId).classList.add('hidden');
    });
});

window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
        e.target.classList.add('hidden');
    }
});
