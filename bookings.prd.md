# Bookings PRD – Exodrive

> Status: Draft · Last updated {{DATE}}

---

## 1. Purpose & Vision

Enable customers to reserve an Exodrive vehicle online in < 90 seconds, while guaranteeing that exactly one booking exists per car per day and surfacing each new booking in the admin inbox for staff follow-up.

---

## 2. Goals & Success Metrics

| Goal | Metric | Target |
|------|--------|--------|
| Seamless checkout | Avg. time from **Select Dates → Booking Confirmed** | ≤ 90 s |
| Prevent double-booking | % overlapping bookings in DB | 0 % |
| Staff awareness | % bookings surfaced in *Pending* admin inbox | 100 % |
| Uptime | API availability (p95) | ≥ 99.9 % |

---

## 3. Personas

1. **Customer (Unauthenticated)** – wants to rent a car quickly without creating an account.
2. **Admin (Staff)** – monitors new bookings, performs manual verifications, and marks bookings as *upcoming* once payment clears.

---

## 4. User Stories

### Customer
- *As a customer*, I can see up-to-date availability for a car across a date range so I avoid wasted time.
- *As a customer*, I can create a booking by entering my details and paying, receiving immediate confirmation.
- *As a customer*, I can access a secure URL with my booking details without logging in.

### Admin
- *As an admin*, every successful booking should appear in the **Pending** tab of my inbox so I never miss a new rental.
- *As an admin*, I can change a booking's status (pending → upcoming → active → completed) to reflect real-world progress.
- *As an admin*, I can view all bookings in a calendar or list filtered by car and status.

---

## 5. Functional Requirements (MVP)

### 5.1 Car Availability
1. Endpoint `GET /api/availability` returns availability for a `car_id`, `start`, `end`.
2. FE calendar disables dates returned as **unavailable**.

### 5.2 Booking Creation
1. Endpoint `POST /api/bookings` accepts:
   ```ts
   {
     carId: string;
     startDate: string; // YYYY-MM-DD
     endDate: string;   // YYYY-MM-DD
     customer: {
       fullName: string;
       email: string;
       phone?: string;
     };
   }
   ```
2. Server flow:
   1. Acquire Redis lock `lock:car:{car_id}:{hash(start..end)}` (TTL 30 s).
   2. Begin Postgres TX; re-check availability; insert **booking** & daily rows in `car_availability` (status `pending`).
   3. Generate `booking_secure_tokens.token` (128-bit random) and return `bookingUrl`.
   4. Release Redis lock on commit.
3. Response `201 Created` with `bookingId` & `bookingUrl`.

### 5.3 Inbox Integration
1. On successful creation, an entry is pushed to Supabase table `inbox_items` (or reuse existing `inbox_emails`):
   ```sql
   INSERT INTO inbox_items (type, booking_id, status)
   VALUES ('booking', <id>, 'pending');
   ```
2. Admin Dashboard shows **Pending Bookings** count badge and list.

### 5.4 Status State Machine
```
 pending ──pay-approved──▶ upcoming ──pickup-day──▶ active ──drop-off──▶ completed
        ▲                                   │
        └─────────────── cancel / fail ─────┘
```
*Transitions enforced server-side; invalid moves → 400.*

### 5.5 Secure Booking Page
* Route `/booking/[token]` (Server Component).
* Displays booking metadata, car info, and current status.

### 5.6 Notifications (Placeholder)
* Send confirmation email to customer & notification email to admins (to be implemented with Resend later).

---

## 6. Non-Functional Requirements

| Area | Requirement |
|------|-------------|
| Security | RLS on every relevant table; tokens expire after configurable TTL. |
| Concurrency | Redis locks + DB `UNIQUE(car_id, date)` guarantee single booking. |
| Performance | p95 < 300 ms for availability & booking endpoints. |
| Accessibility | Booking form WCAG AA at minimum. |
| Observability | Instrumentation via Sentry + custom analytics events. |

---

## 7. Data Model (Delta)

```
bookings                customers              inbox_items
─────────               ─────────              ────────────
id  (PK)                id  (PK)               id  (PK)
car_id (FK→cars)        email UNIQUE           type          enum('booking',…)
start_date              full_name              booking_id FK
end_date                phone                  status enum('pending','done')
status enum             …                      created_at
…

booking_secure_tokens   car_availability
──────────────────────  ────────────────
booking_id UNIQUE FK    id
token UNIQUE            car_id
expires_at              date UNIQUE (car_id,date)
                        status
```

*See `booking.md` for full technical model.*

---

## 8. API Design

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET    | `/api/availability` | Public | Returns array of dates with `available: boolean`. |
| POST   | `/api/bookings` | Public | Creates booking; returns `bookingUrl`. |
| GET    | `/api/bookings/[id]` | Admin | Fetch single booking. |
| PATCH  | `/api/bookings/[id]/status` | Admin | Transition status. |

---

## 9. Admin Dashboard

1. **Inbox ➜ Pending Bookings Tab**
   * List of latest bookings with filter & search.
   * Ability to mark *upcoming* once payment verified.
2. **Calendar View** (stretch goal) using FullCalendar.

---

## 10. Analytics & Instrumentation

Event | Properties
------|-----------
`booking_created` | `booking_id`, `car_id`, `days`, `source` (web/mobile)
`booking_status_changed` | `booking_id`, `from`, `to`, `actor`

---

## 11. Timeline

| Phase | Tasks | ETA |
|-------|-------|-----|
| 1 | DB migrations + Supabase types | Day 1–2 |
| 2 | Availability endpoint + FE calendar | Day 3–4 |
| 3 | Booking API + Redis locking | Day 5–7 |
| 4 | Secure booking page | Day 8 |
| 5 | Admin inbox integration | Day 9 |
| 6 | QA & Load tests | Day 10 |

---

## 12. Out-of-Scope (Next Milestones)

* PayPal payment & auth-hold flows.
* Docuseal signature capture.
* Email & webhook notifications via Resend.

---

## 13. Open Questions

1. Should we allow logged-in users to view multi-booking history now or later?
2. Which Redis provider (Upstash vs Elasticache) will we finalise?
3. Exact cutoff time for same-day bookings?

---

*End of document.* 