const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM customers ORDER BY name');
    res.json(r.rows.map(x => ({ ...x, id: Number(x.id) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  const { name, phone, address } = req.body || {};
  if (!name) return res.status(400).json({ error: 'name is required.' });
  try {
    const r = await db.query(`INSERT INTO customers(name,phone,address) VALUES($1,$2,$3) RETURNING id`, [name, phone || null, address || null]);
    res.json({ success: true, id: Number(r.rows[0].id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
