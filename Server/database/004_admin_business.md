# Admin business modules

Apply [004_admin_business.sql](004_admin_business.sql) once in the Supabase SQL Editor after the existing schema and migrations. Test it on a development project first. The migration is transactional and creates empty tables without changing existing rows. Deploy the Express code after applying the migration.

All routes below are under `/api/admin` and use the existing administrator authorization. This repository models a single salon per Supabase project. A multi-salon deployment needs tenant ownership columns, tenant-aware foreign keys, and verified membership checks before enabling these routes.

| Method and path | Input or behavior |
| --- | --- |
| GET /inventory | Products, with optional `offset` |
| POST /inventory | `name`, `purchasePrice`, optional `sellingPrice`, `category`, `supplier`, `lowStockThreshold` |
| GET /inventory/:id/movements | Stock history, with optional `offset` |
| POST /inventory/:id/adjustments | Signed integer `quantity` and `reason`. Products start at zero stock |
| GET /customers | Registered customers and walk-ins, with optional `offset` |
| POST /customers | `fullName` and optional `email` and `phone`. Creates a walk-in contact |
| GET /pos/sales/:id | Sale receipt and line items |
| POST /pos/sales | Client-generated UUID `saleId`, `method`, optional `customerId` with `customerKind`, and `items` |
| GET /transactions | Ledger rows, with inclusive `from` and `to` dates and optional `offset` |
| GET /expenses | Expense rows, with inclusive `from` and `to` dates and optional `offset` |
| POST /expenses | Client-generated UUID `expenseId`, `category`, `description`, KES `amount`, and `expenseDate` |
| GET /finance/summary | Gross revenue, expenses, net income and outstanding balances, with inclusive `from` and `to` dates |
| GET and PUT /notification-preferences | Read or replace the signed-in admin’s six preferences |

Dates use `YYYY-MM-DD`. Lists return up to 100 rows. A POS line is `{ "kind": "service" or "product", "id": "<UUID>", "quantity": 1 }`. Customer kinds are `registered` and `walk_in`. Methods are `cash`, `mpesa`, `card`, and `bank`. Checkout prices come from the database. Recording the sale and decrementing stock occur in the same database transaction. For a timed-out checkout, look up the original sale ID before retrying. Duplicate IDs return 409.

POS records payments already received outside the app. A POS sale is separate from an appointment payment. Use the existing appointment payment flow to mark an appointment paid. The ledger uses the appointment date for appointment payments and Nairobi local date for POS sales. Existing appointment records have no payment method. Gross revenue includes paid ledger entries and net income subtracts recorded expenses. Customer visits count completed appointments.

The notification preference keys are `newBookingAlerts`, `cancellationAlerts`, `dailyScheduleSummary`, `lowStockAlerts`, `customerEmailConfirmations`, and `appointmentReminders`. PUT accepts all six booleans under `preferences`. Delivery requires a separate event or scheduled worker.
