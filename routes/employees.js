const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM employees ORDER BY name');
    res.json(r.rows.map(x => ({ ...x, id: Number(x.id), monthly_salary: Number(x.monthly_salary) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin authority required.' });
  const { name, designation, monthly_salary, phone } = req.body || {};
  if (!name || !designation) return res.status(400).json({ error: 'name and designation are required.' });
  try {
    const r = await db.query(
      `INSERT INTO employees(name,designation,monthly_salary,phone) VALUES($1,$2,$3,$4) RETURNING id`,
      [name, designation, Number(monthly_salary) || 0, phone || null]
    );
    res.json({ success: true, id: Number(r.rows[0].id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Pay one employee's salary for a given month/year -- blocked if that
// month was already paid (unique constraint on employee+month+year).
router.post('/:id/pay-salary', async (req, res) => {
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin authority required.' });
  const { pay_month, pay_year, amount } = req.body || {};
  if (!pay_month || !pay_year || !amount) return res.status(400).json({ error: 'pay_month, pay_year and amount are required.' });
  try {
    await db.query(
      `INSERT INTO salary_payments(employee_id,pay_month,pay_year,amount) VALUES($1,$2,$3,$4)`,
      [Number(req.params.id), Number(pay_month), Number(pay_year), Number(amount)]
    );
    res.json({ success: true });
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'This employee has already been paid for that month.' });
    res.status(500).json({ error: e.message });
  }
});

router.get('/salary-history', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT sp.*, e.name AS employee_name FROM salary_payments sp JOIN employees e ON e.id=sp.employee_id ORDER BY sp.paid_at DESC LIMIT 100`
    );
    res.json(r.rows.map(x => ({ ...x, id: Number(x.id), amount: Number(x.amount) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
