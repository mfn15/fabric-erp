require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('./db');

(async () => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const adminHash = await bcrypt.hash(process.env.DEFAULT_ADMIN_PASSWORD || 'admin123', 10);
    const staffHash = await bcrypt.hash(process.env.DEFAULT_STAFF_PASSWORD || 'staff123', 10);
    await client.query(`INSERT INTO users(username,password,role,name) VALUES($1,$2,'admin','Factory Owner') ON CONFLICT(username) DO NOTHING`, ['admin', adminHash]);
    await client.query(`INSERT INTO users(username,password,role,name) VALUES($1,$2,'staff','Floor Supervisor') ON CONFLICT(username) DO NOTHING`, ['staff', staffHash]);

    const employees = [
      ['Imran Sheikh', 'Printing Operator', 35000],
      ['Sana Malik', 'Quality Checker', 28000],
      ['Bilal Ahmed', 'Machine Technician', 40000]
    ];
    const employeeIds = [];
    for (const [name, designation, salary] of employees) {
      const r = await client.query(
        `INSERT INTO employees(name,designation,monthly_salary) VALUES($1,$2,$3) RETURNING id`,
        [name, designation, salary]
      );
      employeeIds.push(r.rows[0].id);
    }

    const fabrics = [
      ['Cotton Poplin', 'White', 500, 180, 'Lahore Textile Mills'],
      ['Cotton Poplin', 'Cream', 300, 185, 'Lahore Textile Mills'],
      ['Linen', 'Natural', 200, 320, 'Faisalabad Weavers']
    ];
    const fabricIds = [];
    for (const [type, color, meters, cost, supplier] of fabrics) {
      const r = await client.query(
        `INSERT INTO fabric_stock(fabric_type,color,meters_available,cost_per_meter,supplier) VALUES($1,$2,$3,$4,$5)
         ON CONFLICT(fabric_type,color) DO UPDATE SET meters_available=EXCLUDED.meters_available RETURNING id`,
        [type, color, meters, cost, supplier]
      );
      fabricIds.push(r.rows[0].id);
    }

    const customer = await client.query(
      `INSERT INTO customers(name,phone,address) VALUES('Zainab Boutique','+92 300 9988776','Liberty Market, Lahore') RETURNING id`
    );

    const year = new Date().getFullYear();
    const counter = await client.query(
      `INSERT INTO order_counters(counter_year,last_number) VALUES($1,1) ON CONFLICT(counter_year) DO UPDATE SET last_number=order_counters.last_number+1 RETURNING last_number`,
      [year]
    );
    const orderNumber = `PO-${year}-${String(counter.rows[0].last_number).padStart(4, '0')}`;
    const meters = 50, rate = 60;
    await client.query(
      `INSERT INTO print_orders(order_number,customer_id,fabric_stock_id,meters_used,design_description,printing_rate_per_meter,total_amount,amount_paid,status,payment_status)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,'completed','partial')`,
      [orderNumber, customer.rows[0].id, fabricIds[0], meters, 'Floral block print, repeating pattern', rate, meters * rate, meters * rate * 0.5]
    );
    await client.query(`UPDATE fabric_stock SET meters_available = meters_available - $1 WHERE id=$2`, [meters, fabricIds[0]]);

    await client.query(
      `INSERT INTO expenses(category,description,amount) VALUES('Utilities','Monthly electricity bill',15000)`
    );

    await client.query('COMMIT');
    console.log('Fabric ERP demo data seeded successfully.');
  } catch (e) {
    await client.query('ROLLBACK');
    console.error(e);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
})();
