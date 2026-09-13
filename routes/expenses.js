const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM expenses ORDER BY incurred_at DESC LIMIT 100');
    res.json(r.rows.map(x => ({ ...x, id: Number(x.id), amount: Number(x.amount) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin authority required.' });
  const { category, description, amount } = req.body || {};
  if (!category || !amount) return res.status(400).json({ error: 'category and amount are required.' });
  try {
    const r = await db.query(`INSERT INTO expenses(category,description,amount) VALUES($1,$2,$3) RETURNING id`, [category, description || '', Number(amount)]);
    res.json({ success: true, id: Number(r.rows[0].id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
