const express = require('express');
const router = express.Router();
const db = require('../database/db');

function normalize(x) {
  return {
    ...x,
    id: Number(x.id),
    meters_used: Number(x.meters_used),
    printing_rate_per_meter: Number(x.printing_rate_per_meter),
    total_amount: Number(x.total_amount),
    amount_paid: Number(x.amount_paid)
  };
}

// Create a print order (which doubles as the customer's bill): decrements
// the fabric used from stock, rejecting the whole thing if there isn't
// enough. The order number and stock decrement happen in one round trip.
router.post('/', async (req, res) => {
  const { customer_id, fabric_stock_id, meters_used, design_description, printing_rate_per_meter, amount_paid } = req.body || {};
  if (!fabric_stock_id || !meters_used || !printing_rate_per_meter) {
    return res.status(400).json({ error: 'fabric_stock_id, meters_used and printing_rate_per_meter are required.' });
  }
  const c = await db.connect();
  try {
    await c.query('BEGIN');
    const totalAmount = Number(meters_used) * Number(printing_rate_per_meter);
    const paid = Number(amount_paid) || 0;
    const paymentStatus = paid >= totalAmount ? 'paid' : paid > 0 ? 'partial' : 'unpaid';

    const year = new Date().getFullYear();
    const counter = await c.query(
      `INSERT INTO order_counters(counter_year,last_number) VALUES($1,1)
       ON CONFLICT(counter_year) DO UPDATE SET last_number=order_counters.last_number+1
       RETURNING last_number`,
      [year]
    );
    const orderNumber = `PO-${year}-${String(counter.rows[0].last_number).padStart(4, '0')}`;

    const stockRes = await c.query(
      `UPDATE fabric_stock SET meters_available = meters_available - $1 WHERE id = $2 AND meters_available >= $1 RETURNING id`,
      [Number(meters_used), Number(fabric_stock_id)]
    );
    if (!stockRes.rowCount) throw new Error('Not enough fabric in stock for this order.');

    const order = await c.query(
      `INSERT INTO print_orders(order_number,customer_id,fabric_stock_id,meters_used,design_description,printing_rate_per_meter,total_amount,amount_paid,payment_status,user_id)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id,created_at`,
      [orderNumber, customer_id || null, Number(fabric_stock_id), Number(meters_used), design_description || '', Number(printing_rate_per_meter), totalAmount, paid, paymentStatus, req.session.user.id]
    );

    await c.query('COMMIT');
    res.json({
      success: true,
      id: Number(order.rows[0].id),
      order_number: orderNumber,
      total_amount: totalAmount,
      amount_paid: paid,
      payment_status: paymentStatus,
      created_at: order.rows[0].created_at
    });
  } catch (e) {
    await c.query('ROLLBACK');
    res.status(500).json({ error: e.message });
  } finally { c.release(); }
});

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const params = [];
    let q = `SELECT o.*, cu.name AS customer_name, fs.fabric_type, fs.color FROM print_orders o
             LEFT JOIN customers cu ON cu.id=o.customer_id
             LEFT JOIN fabric_stock fs ON fs.id=o.fabric_stock_id WHERE 1=1`;
    if (status) { params.push(status); q += ` AND o.status=$${params.length}`; }
    q += ` ORDER BY o.id DESC LIMIT 200`;
    const r = await db.query(q, params);
    res.json(r.rows.map(normalize));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:order_number', async (req, res) => {
  try {
    const r = await db.query(
      `SELECT o.*, cu.name AS customer_name, cu.phone AS customer_phone, fs.fabric_type, fs.color
       FROM print_orders o
       LEFT JOIN customers cu ON cu.id=o.customer_id
       LEFT JOIN fabric_stock fs ON fs.id=o.fabric_stock_id
       WHERE o.order_number=$1`,
      [req.params.order_number]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Order not found.' });
    res.json(normalize(r.rows[0]));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/status', async (req, res) => {
  const { status } = req.body || {};
  if (!['pending', 'in_progress', 'completed', 'delivered', 'cancelled'].includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  try {
    await db.query('UPDATE print_orders SET status=$1 WHERE id=$2', [status, Number(req.params.id)]);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/:id/payment', async (req, res) => {
  const { amount } = req.body || {};
  if (!amount || Number(amount) <= 0) return res.status(400).json({ error: 'A positive amount is required.' });
  try {
    const r = await db.query(
      `UPDATE print_orders SET amount_paid = amount_paid + $1,
         payment_status = CASE WHEN amount_paid + $1 >= total_amount THEN 'paid' ELSE 'partial' END
       WHERE id=$2 RETURNING payment_status, amount_paid`,
      [Number(amount), Number(req.params.id)]
    );
    if (!r.rowCount) return res.status(404).json({ error: 'Order not found.' });
    res.json({ success: true, payment_status: r.rows[0].payment_status, amount_paid: Number(r.rows[0].amount_paid) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

module.exports = router;
