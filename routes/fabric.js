const express = require('express');
const router = express.Router();
const db = require('../database/db');

router.get('/', async (req, res) => {
  try {
    const r = await db.query('SELECT * FROM fabric_stock ORDER BY fabric_type, color');
    res.json(r.rows.map(x => ({ ...x, id: Number(x.id), meters_available: Number(x.meters_available), cost_per_meter: Number(x.cost_per_meter) })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', async (req, res) => {
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin authority required.' });
  const { fabric_type, color, cost_per_meter, supplier } = req.body || {};
  if (!fabric_type) return res.status(400).json({ error: 'fabric_type is required.' });
  try {
    const r = await db.query(
      `INSERT INTO fabric_stock(fabric_type,color,cost_per_meter,supplier) VALUES($1,$2,$3,$4)
       ON CONFLICT(fabric_type,color) DO UPDATE SET cost_per_meter=EXCLUDED.cost_per_meter RETURNING id`,
      [fabric_type, color || '', Number(cost_per_meter) || 0, supplier || null]
    );
    res.json({ success: true, id: Number(r.rows[0].id) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Record a purchase: increments stock and logs the cost in one round trip.
router.post('/:id/purchase', async (req, res) => {
  if (req.session.user.role !== 'admin') return res.status(403).json({ error: 'Admin authority required.' });
  const { meters, cost_per_meter } = req.body || {};
  if (!meters || !cost_per_meter) return res.status(400).json({ error: 'meters and cost_per_meter are required.' });
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    const totalCost = Number(meters) * Number(cost_per_meter);
    await c.query(
      `UPDATE fabric_stock SET meters_available = meters_available + $1, cost_per_meter = $2 WHERE id = $3`,
      [Number(meters), Number(cost_per_meter), Number(req.params.id)]
    );
    await c.query(
      `INSERT INTO fabric_purchases(fabric_stock_id,meters,cost_per_meter,total_cost) VALUES($1,$2,$3,$4)`,
      [Number(req.params.id), Number(meters), Number(cost_per_meter), totalCost]
    );
    await c.query('COMMIT');
    res.json({ success: true, total_cost: totalCost });
  } catch (e) {
    await c.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { c.release(); }
});

module.exports = router;
