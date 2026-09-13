const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/dashboard', async (req, res) => {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const revenueToday = await db.query(
      `SELECT COALESCE(SUM(amount_paid),0) AS paid_today FROM print_orders WHERE created_at::date=$1`,
      [today]
    );
    const pendingOrders = await db.query(`SELECT COUNT(*)::int AS cnt FROM print_orders WHERE status IN ('pending','in_progress')`);
    const outstanding = await db.query(`SELECT COALESCE(SUM(total_amount - amount_paid),0) AS outstanding FROM print_orders WHERE payment_status != 'paid' AND status != 'cancelled'`);
    const lowStock = await db.query(`SELECT fabric_type, color, meters_available FROM fabric_stock WHERE meters_available < 100 ORDER BY meters_available ASC`);
    const stockValue = await db.query(`SELECT COALESCE(SUM(meters_available * cost_per_meter),0) AS value FROM fabric_stock`);

    res.json({
      revenue_today: Number(revenueToday.rows[0].paid_today),
      pending_orders: pendingOrders.rows[0].cnt,
      outstanding_balance: Number(outstanding.rows[0].outstanding),
      low_stock: lowStock.rows.map(x => ({ ...x, meters_available: Number(x.meters_available) })),
      stock_value: Number(stockValue.rows[0].value)
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Profit & loss: revenue collected from orders, minus fabric purchase
// cost, salaries paid, and other expenses, all within an optional range.
router.get('/profit-loss', async (req, res) => {
  try {
    const { start_date, end_date } = req.query;
    const range = start_date && end_date ? { clause: ' AND created_at::date BETWEEN $1 AND $2', params: [start_date, end_date] } : { clause: '', params: [] };

    const revenue = await db.query(`SELECT COALESCE(SUM(amount_paid),0) AS total FROM print_orders WHERE status != 'cancelled'${range.clause}`, range.params);
    const fabricCost = await db.query(`SELECT COALESCE(SUM(total_cost),0) AS total FROM fabric_purchases WHERE 1=1${range.clause.replace('created_at', 'purchased_at')}`, range.params);
    const salaryCost = await db.query(`SELECT COALESCE(SUM(amount),0) AS total FROM salary_payments WHERE 1=1${range.clause.replace('created_at', 'paid_at')}`, range.params);
    const otherExpenses = await db.query(`SELECT COALESCE(SUM(amount),0) AS total FROM expenses WHERE 1=1${range.clause.replace('created_at', 'incurred_at')}`, range.params);

    const rev = Number(revenue.rows[0].total);
    const costs = Number(fabricCost.rows[0].total) + Number(salaryCost.rows[0].total) + Number(otherExpenses.rows[0].total);

    res.json({
      revenue: rev,
      fabric_cost: Number(fabricCost.rows[0].total),
      salary_cost: Number(salaryCost.rows[0].total),
      other_expenses: Number(otherExpenses.rows[0].total),
      total_costs: costs,
      profit: rev - costs
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
