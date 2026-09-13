const App = {
  currentUser: null,
  fabricStock: [],
  customers: [],

  async init() {
    this.bindLogin();
    document.querySelectorAll('.nav-btn').forEach(b => b.addEventListener('click', () => this.showView(b.dataset.view)));
    document.getElementById('logout-btn').addEventListener('click', async () => { await fetch('/api/auth/logout', { method: 'POST' }); location.reload(); });
    document.getElementById('no-submit').addEventListener('click', () => this.createOrder());
    document.getElementById('purchase-submit').addEventListener('click', () => this.recordPurchase());

    try {
      const res = await fetch('/api/auth/me');
      if (res.ok) { this.currentUser = await res.json(); this.showApp(); }
    } catch (e) { /* not logged in */ }
  },

  bindLogin() {
    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      const res = await fetch('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
      const data = await res.json();
      if (!res.ok) { document.getElementById('login-error').textContent = data.error; return; }
      this.currentUser = data.user;
      this.showApp();
    });
  },

  showApp() {
    document.getElementById('login-screen').hidden = true;
    document.getElementById('app-screen').hidden = false;
    document.getElementById('current-user-name').textContent = `${this.currentUser.name} (${this.currentUser.role})`;
    this.loadDashboard();
  },

  showView(view) {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.view === view));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${view}`).classList.add('active');
    if (view === 'dashboard') this.loadDashboard();
    if (view === 'orders') this.loadOrders();
    if (view === 'new-order') this.loadNewOrderForm();
    if (view === 'stock') this.loadStock();
    if (view === 'employees') this.loadEmployees();
    if (view === 'reports') this.loadReports();
  },

  async loadDashboard() {
    const d = await fetch('/api/reports/dashboard').then(r => r.json());
    document.getElementById('dashboard-stats').innerHTML =
      statCard('Revenue Today', `Rs. ${d.revenue_today.toFixed(2)}`) +
      statCard('Pending Orders', d.pending_orders) +
      statCard('Outstanding Balance', `Rs. ${d.outstanding_balance.toFixed(2)}`) +
      statCard('Stock Value', `Rs. ${d.stock_value.toFixed(2)}`);
    document.getElementById('low-stock-body').innerHTML = d.low_stock.map(s =>
      `<tr><td>${escapeHtml(s.fabric_type)}</td><td>${escapeHtml(s.color)}</td><td>${s.meters_available}</td></tr>`
    ).join('') || '<tr><td colspan="3">All fabric stock healthy.</td></tr>';
  },

  async loadOrders() {
    const orders = await fetch('/api/orders').then(r => r.json());
    document.getElementById('orders-body').innerHTML = orders.map(o => `
      <tr>
        <td>${escapeHtml(o.order_number)}</td>
        <td>${escapeHtml(o.customer_name || 'Walk-in')}</td>
        <td>${escapeHtml(o.fabric_type)} ${escapeHtml(o.color || '')}</td>
        <td>${o.meters_used}</td>
        <td>Rs. ${o.total_amount.toFixed(2)}</td>
        <td>Rs. ${o.amount_paid.toFixed(2)}</td>
        <td>
          <select class="status-select" onchange="App.updateOrderStatus(${o.id}, this.value)">
            ${['pending', 'in_progress', 'completed', 'delivered', 'cancelled'].map(s => `<option value="${s}" ${s === o.status ? 'selected' : ''}>${s.replace('_', ' ')}</option>`).join('')}
          </select>
        </td>
        <td><span class="badge badge-${o.payment_status}">${o.payment_status}</span></td>
        <td>${o.payment_status !== 'paid' ? `<button class="btn-sm" onclick="App.recordPayment(${o.id}, ${o.total_amount - o.amount_paid})">Record Payment</button>` : ''}</td>
      </tr>
    `).join('');
  },

  async updateOrderStatus(id, status) {
    await fetch(`/api/orders/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
  },

  async recordPayment(id, remaining) {
    const amount = prompt(`Amount to record (remaining: Rs. ${remaining.toFixed(2)}):`, remaining.toFixed(2));
    if (!amount) return;
    await fetch(`/api/orders/${id}/payment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amount: Number(amount) }) });
    this.loadOrders();
  },

  async loadNewOrderForm() {
    this.fabricStock = await fetch('/api/fabric').then(r => r.json());
    this.customers = await fetch('/api/customers').then(r => r.json());
    document.getElementById('no-customer').innerHTML = '<option value="">Walk-in</option>' + this.customers.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');
    document.getElementById('no-fabric').innerHTML = this.fabricStock.map(f => `<option value="${f.id}">${escapeHtml(f.fabric_type)} ${escapeHtml(f.color)} (${f.meters_available}m left)</option>`).join('');
  },

  async createOrder() {
    const body = {
      customer_id: Number(document.getElementById('no-customer').value) || null,
      fabric_stock_id: Number(document.getElementById('no-fabric').value),
      meters_used: Number(document.getElementById('no-meters').value),
      printing_rate_per_meter: Number(document.getElementById('no-rate').value),
      design_description: document.getElementById('no-design').value,
      amount_paid: Number(document.getElementById('no-paid').value) || 0
    };
    const res = await fetch('/api/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    alert(`Order ${data.order_number} created. Total: Rs. ${data.total_amount.toFixed(2)}`);
    this.showView('orders');
  },

  async loadStock() {
    this.fabricStock = await fetch('/api/fabric').then(r => r.json());
    document.getElementById('stock-body').innerHTML = this.fabricStock.map(f => `
      <tr><td>${escapeHtml(f.fabric_type)}</td><td>${escapeHtml(f.color)}</td><td>${f.meters_available}</td><td>Rs. ${f.cost_per_meter.toFixed(2)}</td><td>${escapeHtml(f.supplier || '-')}</td></tr>
    `).join('');
    document.getElementById('purchase-fabric').innerHTML = this.fabricStock.map(f => `<option value="${f.id}">${escapeHtml(f.fabric_type)} ${escapeHtml(f.color)}</option>`).join('');
  },

  async recordPurchase() {
    const fabric_stock_id = Number(document.getElementById('purchase-fabric').value);
    const meters = Number(document.getElementById('purchase-meters').value);
    const cost_per_meter = Number(document.getElementById('purchase-cost').value);
    if (!meters || !cost_per_meter) return alert('Meters and cost per meter are required.');
    const res = await fetch(`/api/fabric/${fabric_stock_id}/purchase`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ meters, cost_per_meter }) });
    if (!res.ok) return alert((await res.json()).error);
    this.loadStock();
  },

  async loadEmployees() {
    const employees = await fetch('/api/employees').then(r => r.json());
    document.getElementById('employees-body').innerHTML = employees.map(e => `
      <tr>
        <td>${escapeHtml(e.name)}</td>
        <td>${escapeHtml(e.designation)}</td>
        <td>Rs. ${e.monthly_salary.toFixed(2)}</td>
        <td><button class="btn-sm" onclick="App.paySalary(${e.id}, ${e.monthly_salary})">Pay This Month</button></td>
      </tr>
    `).join('');
  },

  async paySalary(id, defaultAmount) {
    const now = new Date();
    const amount = prompt('Amount:', defaultAmount);
    if (!amount) return;
    const res = await fetch(`/api/employees/${id}/pay-salary`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pay_month: now.getMonth() + 1, pay_year: now.getFullYear(), amount: Number(amount) })
    });
    const data = await res.json();
    if (!res.ok) return alert(data.error);
    alert('Salary recorded.');
  },

  async loadReports() {
    const pl = await fetch('/api/reports/profit-loss').then(r => r.json());
    document.getElementById('pl-summary').innerHTML =
      statCard('Revenue', `Rs. ${pl.revenue.toFixed(2)}`) +
      statCard('Fabric Cost', `Rs. ${pl.fabric_cost.toFixed(2)}`) +
      statCard('Salary Cost', `Rs. ${pl.salary_cost.toFixed(2)}`) +
      statCard('Other Expenses', `Rs. ${pl.other_expenses.toFixed(2)}`) +
      statCard('Net Profit', `Rs. ${pl.profit.toFixed(2)}`);
  }
};

function statCard(label, value) {
  return `<div class="stat-card"><span class="stat-label">${escapeHtml(label)}</span><span class="stat-value">${value}</span></div>`;
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

App.init();
