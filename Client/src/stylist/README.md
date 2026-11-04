# Stylist module

The stylist workspace from the Figma design, mounted at `/staff`.

## Routes (added in `src/router.tsx`)
Stylists sign in through the team login at `/team/login` (Stylist tab). Accounts need role `staff`
in the `users` table and `staff_type` `stylist` in the `staff` table. The team's `StaffRoute` guards every page below.

| Route | Page |
|---|---|
| `/staff/dashboard` | Overview — today's stats, appointments, up next, next opening |
| `/staff/appointments` | All bookings with filters (`?range=today|upcoming|past|all`) |
| `/staff/schedule` | Week calendar — click a slot to book, block time off |
| `/staff/clients` | Clients, notes and visit history (`?id=c3` opens a client) |
| `/staff/settings` | Profile, working hours, notifications, password (Supabase) |

## Folder layout
```
stylist/
  components/StylistLayout.tsx   sidebar + page shell (site Navbar comes from MainLayout)
  components/appointments.tsx    appointment row, ••• menu, details, booking form, complete & tip
  components/Modal.tsx           accessible dialog
  pages/                         one file per page
  store/StoreProvider.tsx        stylist data (localStorage for now — see below)
  store/UIProvider.tsx           toasts, dialogs, confirm boxes
  lib/                           types, date/format helpers, look-ups, sample-data builder
  data/*.json                    sample data: services, clients, hours, prefs, today's bookings
  stylist.css                    all styles, scoped under .stylist-app so they never touch other pages
```

## What's real and what's sample data
- **Real (Supabase):** sign-in and role check (team login + StaffRoute), the stylist's name in the greeting, signing out, changing password.
- **Sample data (this browser only):** appointments, clients, services, working hours, blocked time. Stored in `localStorage`.

## Next step: connect to the Express API
Every data change goes through `store/StoreProvider.tsx` (`addAppt`, `updateAppt`, `addClient`, …).
Once the team agrees on the database tables, replace those function bodies with `fetch()` calls to the API.
The JSON files and `lib/types.ts` show the shape each record needs. Updating bookings will need PATCH
added to the CORS `methods` list in `Server/src/index.ts`.

## To do for the team
- Barbers also have role `staff`, so they currently see this same workspace. Split it by `staff_type` if barbers need their own pages.
- `src/pages/StaffDashboard.tsx` (the old placeholder) is no longer used by the router and can be deleted.
