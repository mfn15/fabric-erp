CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','staff')),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS employees (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  designation TEXT NOT NULL,
  monthly_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  phone TEXT,
  joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);

-- One row per employee per (month,year) salary payment, so "has June been
-- paid yet" is a lookup, not a guess, and paying twice for the same month
-- is prevented outright.
CREATE TABLE IF NOT EXISTS salary_payments (
  id BIGSERIAL PRIMARY KEY,
  employee_id BIGINT NOT NULL REFERENCES employees(id),
  pay_month INTEGER NOT NULL CHECK (pay_month BETWEEN 1 AND 12),
  pay_year INTEGER NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(employee_id, pay_month, pay_year)
);

-- Raw fabric inventory, by type+color, in meters.
CREATE TABLE IF NOT EXISTS fabric_stock (
  id BIGSERIAL PRIMARY KEY,
  fabric_type TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '',
  meters_available NUMERIC(10,2) NOT NULL DEFAULT 0,
  cost_per_meter NUMERIC(10,2) NOT NULL DEFAULT 0,
  supplier TEXT,
  UNIQUE(fabric_type, color)
);

CREATE TABLE IF NOT EXISTS fabric_purchases (
  id BIGSERIAL PRIMARY KEY,
  fabric_stock_id BIGINT NOT NULL REFERENCES fabric_stock(id),
  meters NUMERIC(10,2) NOT NULL,
  cost_per_meter NUMERIC(10,2) NOT NULL,
  total_cost NUMERIC(12,2) NOT NULL,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customers (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- A print job doubles as its own bill: printing this business's fabric for
-- a customer *is* the billable unit of work, so there's no separate
-- invoice table to keep in sync with order status.
CREATE TABLE IF NOT EXISTS print_orders (
  id BIGSERIAL PRIMARY KEY,
  order_number TEXT UNIQUE NOT NULL,
  customer_id BIGINT REFERENCES customers(id),
  fabric_stock_id BIGINT REFERENCES fabric_stock(id),
  meters_used NUMERIC(10,2) NOT NULL,
  design_description TEXT NOT NULL DEFAULT '',
  printing_rate_per_meter NUMERIC(10,2) NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','in_progress','completed','delivered','cancelled')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','partial','paid')),
  user_id BIGINT REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_counters (
  counter_year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

-- Miscellaneous business expenses that aren't payroll or fabric purchases
-- (utilities, maintenance, transport, etc.), for a complete profit/loss.
CREATE TABLE IF NOT EXISTS expenses (
  id BIGSERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  amount NUMERIC(12,2) NOT NULL,
  incurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_print_orders_created_at ON print_orders(created_at);
CREATE INDEX IF NOT EXISTS idx_print_orders_status ON print_orders(status);
CREATE INDEX IF NOT EXISTS idx_salary_payments_employee ON salary_payments(employee_id);
CREATE INDEX IF NOT EXISTS idx_fabric_purchases_stock ON fabric_purchases(fabric_stock_id);
