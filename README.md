# Fabric ERP

A record management system built for a fabric printing business: raw fabric stock, employees and payroll, customer print orders (which double as bills), and full profit & loss.

## Features

- **Fabric stock** -- track meters available by type/color, log purchases (which increment stock and cost basis in one step), low-stock alerts.
- **Print orders** -- create an order against a customer and a specific fabric roll; the fabric used is deducted from stock atomically, and the order itself is the bill (order number, total, payments, status).
- **Billing** -- partial or full payments against an order, with status tracking (unpaid / partial / paid) independent of production status (pending / in progress / completed / delivered / cancelled).
- **Employees & payroll** -- employee directory with monthly salary, and a salary-payment log that prevents double-paying the same employee for the same month.
- **Profit & loss** -- revenue collected minus fabric purchase cost, salaries paid, and other business expenses, for any date range.
- **Dashboard** -- today's revenue, pending orders, outstanding customer balances, current stock value, low-stock fabric.

## Tech stack

Node.js + Express, PostgreSQL (Supabase-ready), vanilla JS/CSS frontend.

## Getting started

```bash
npm install
cp .env.example .env
npm run db:seed   # 3 employees, 3 fabric types, 1 customer, 1 sample order
npm start
```

Visit `http://localhost:4300`. Demo logins: `admin`/`admin123` (full access, including payroll and stock purchases) and `staff`/`staff123` (day-to-day order entry).

## Using Supabase

Set `DATABASE_URL` in `.env` to your Supabase connection string, then run `npm run db:seed`.

## Project structure

```
database/   schema.sql, connection pool, seed script
routes/     auth, employees, fabric, customers, orders, expenses, reports
public/     static frontend (single-page app, vanilla JS)
server.js   Express app entry point
```
