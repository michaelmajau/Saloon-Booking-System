# Bookify — Salon Booking System

Bookify lets a salon's customers book appointments online, lets barbers and stylists run their day, and gives the salon owner an admin panel to manage bookings, the team, services, reports and an audit trail.

- **Front-end (customers):** browse services, register, book a professional and time, see upcoming and past visits.
- **Staff workspace (barbers & stylists):** today's schedule with check-in, complete & paid, and no-show.
- **Admin panel:** appointments, team invitations, services & pricing, salon settings, reports and the audit trail.
- **Database:** PostgreSQL (hosted on Supabase), shared by the front-end and the admin panel.

---

## Contents

1. [Features](#features)
2. [Technology](#technology)
3. [Project structure](#project-structure)
4. [Installation](#installation)
5. [User manual](#user-manual)
6. [Security](#security)
7. [Troubleshooting](#troubleshooting)

---

## Features

| Area | What it does |
|---|---|
| Accounts | Customer registration with email confirmation, sign in, sign out, forgot / reset password |
| Access levels | Customer, staff (barber or stylist) and admin, checked on both the website and the server |
| Booking (main transaction) | Three-step booking: service → professional → date & free time. Times are calculated from opening hours and existing bookings, so double-booking is prevented. Customers can cancel up to 2 hours before |
| Staff workspace | Today's appointments, booked hours and earnings; check in, complete & paid, no-show |
| Admin: appointments | Browse all bookings, change status and payment |
| Admin: team | Invite barbers and stylists by email, activate or deactivate them |
| Admin: services | Add, edit and delete services with KES prices and durations |
| Admin: settings | Salon name, contact details and opening hours |
| Reports | Appointments report by period with status, payment and professional filters, search, sortable columns, totals, salon name, logo and date; print / save as PDF and export to CSV |
| Audit trail | Who changed what and when, with before/after values; searchable and filterable |
| Help | In-app help centre (`/help`) with searchable answers and an explanation of every error message |

## Technology

| Part | Tools |
|---|---|
| Website | React 19, TypeScript, Vite, React Router, Tailwind CSS, Lucide icons |
| Server (API) | Node.js, Express 5, TypeScript, express-rate-limit, Helmet |
| Database & login | Supabase (PostgreSQL database, Supabase Auth for accounts and emails) |

## Project structure

```
Client/                 Website (customers, staff and admin)
  src/pages/            Pages: landing, sign up / sign in, customer dashboard, staff dashboard, help…
  src/pages/Admin/      Admin panel pages (overview, appointments, team, services, settings, reports, audit trail)
  src/components/       Navbar and the route guards that check who may open each page
  src/lib/              Supabase client and the helper that calls the server
Server/                 API used by the website
  src/index.ts          Main server: customer, staff and admin endpoints
  src/routes/           Reports and audit trail endpoints
  src/middleware/       Sign-in and role checks (requireAuth, requireAdmin, requireStaff)
  src/utils/auditLog.ts Writes audit trail entries
  database/schema.sql   Full database schema (all tables, keys, rules, RLS, trigger)
  database/002_improvements.sql  Security and data-quality fixes to run after schema.sql
```

## Installation

### What you need

- [Node.js](https://nodejs.org) 20 or newer
- A [Supabase](https://supabase.com) project (ask the project owner to invite you)

### 1. Get the code

```bash
git clone https://github.com/michaelmajau/Saloon-Booking-System.git
cd Saloon-Booking-System
```

### 2. Set up the server

```bash
cd Server
npm install
```

Create `Server/.env` (copy `Server/.env.example`) and fill in the values from Supabase → **Project Settings → API**:

```
PORT=5000
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-publishable-key
SUPABASE_SECRET_KEY=your-secret-key        # server only — never put this in Client/.env
```

### 3. Set up the website

```bash
cd ../Client
npm install
```

Create `Client/.env` (copy `Client/.env.example`):

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
VITE_API_URL=http://localhost:5000         # the server address, same port as PORT above
```

### 4. Prepare Supabase (once per project)

1. **SQL Editor:** run `Server/database/schema.sql` (creates all 8 tables, keys, rules, indexes, security policies and the sign-up trigger), then run `Server/database/002_improvements.sql` (security and data-quality fixes).
2. **Authentication → URL Configuration:** set **Site URL** to `http://localhost:5173` and add `http://localhost:5173/**` to **Redirect URLs**, so email links (confirmation, invitations, password reset) open the right pages.
3. **First admin:** sign up through the website, then in **Table Editor → `users`** set that account's `role` to `admin`.

### 5. Run it

Use two terminals:

```bash
# Terminal 1
cd Server
npm run dev        # API on http://localhost:5000

# Terminal 2
cd Client
npm run dev        # Website on http://localhost:5173
```

Open **http://localhost:5173**.

---

## User manual

The same guidance is available inside the app at **`/help`**.

### Customers

1. **Create an account:** click **Book an appointment → Create Account**, fill in your details, then click the link in the confirmation email.
2. **Sign in:** use **Sign in** with your email and password.
3. **Book:** on your dashboard, follow the three steps: choose a service, choose a professional, then pick a date and one of the free times and confirm. New bookings show as **Pending** until the salon confirms them.
4. **See your bookings:** your next appointment and past visits are on your dashboard.
5. **Cancel a booking:** click **Cancel appointment** on your upcoming booking. Pending or confirmed bookings can be cancelled up to 2 hours before they start; after that, contact the salon. To change a booking, cancel it and book a new time.
6. **Forgot your password:** click **Forgot password?** on the sign-in page and follow the emailed link.

### Barbers and stylists

1. **Get access:** the admin invites you by email. Open the invitation and set your password. If you weren't asked to set one, use **Team portal → Forgot password?**.
2. **Sign in:** **Team portal**, choose **Barber** or **Stylist**, enter your email and password.
3. **Run your day:** your dashboard lists today's appointments. Use **Check in** when the client arrives, **Complete & paid** when finished, or **No-show**.

### Administrators

1. **Sign in:** **Team portal → Admin**.
2. **Appointments:** change a booking's status (e.g. Pending → Confirmed) and payment.
3. **Team:** invite a barber or stylist with **Send invitation**; activate or deactivate team members.
4. **Services & pricing:** add, edit or delete services (services with bookings can't be deleted).
5. **Settings:** salon details and opening hours (these decide which times customers can book).
6. **Reports:** choose a period and press **Update period**; filter by status, payment or professional, search, and click column headings to sort. **Print / Save as PDF** gives a report with the salon name, logo and date; **Export CSV** opens in Excel.
7. **Audit trail:** see every change with who made it and when; click the arrow on a row for the before/after values.

---

## Security

- **Passwords** are hashed by Supabase Auth and never stored or logged by the app. Reset links are single-use and expire.
- **Access levels** are checked twice: the website hides pages by role, and the server checks the signed-in user's token and role (`requireAuth`, `requireAdmin`, `requireStaff`) on every protected request.
- **SQL injection:** the server never builds SQL from text. All database access goes through the Supabase client, which sends values separately from queries (parameterised).
- **Secret key** (`SUPABASE_SECRET_KEY`) stays on the server only; the website uses the publishable key.
- **Row level security** is on for every table. Signed-in users can read only their own profile and may change only their own name and phone, never their role (`002_improvements.sql`).
- **Database rules** reject invalid data (unknown statuses, negative prices, bookings that end before they start) and a database rule (`no_double_booking`) stops a professional's active bookings from overlapping in time.
- **Rate limiting** on all API requests (and a stricter limit on the email check) slows down automated attempts; **Helmet** adds secure HTTP headers.
- **Audit trail** records every change to bookings, staff, services and settings, with passwords and tokens stripped from the stored data.

## Troubleshooting

| Problem | Fix |
|---|---|
| Sign-up says **"Unable to check email availability"** | The server isn't running or is on another port. Start it and make sure `VITE_API_URL` matches `PORT`. |
| Something else already uses port 5000 | Set `PORT=5001` in `Server/.env` and `VITE_API_URL=http://localhost:5001` in `Client/.env`, then restart both. |
| Email links open the wrong page or "can't connect" | Check the Supabase URL Configuration in step 4 of the installation. |
| **"Email not confirmed"** | Click the link in the confirmation email first. |
| No emails arrive | Check spam. Supabase's free plan sends only a few emails per hour. |
| Admin or staff pages say **"Request failed"** | Make sure the server is running, then refresh. |
