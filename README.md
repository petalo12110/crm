# Enterprise CRM Platform

A full-stack, production-ready Customer Relationship Management system for growing businesses. Manage customers, leads, opportunities, tasks, support tickets, calendar events, employees, and analytics — all in one place.

---

## Table of Contents

- [What This App Does](#what-this-app-does)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Running the App](#running-the-app)
- [First Login](#first-login)
- [How to Add Companies](#how-to-add-companies)
- [How to Add Employees](#how-to-add-employees)
- [How to Add Customers](#how-to-add-customers)
- [How to Use Each Feature](#how-to-use-each-feature)
- [User Roles Explained](#user-roles-explained)
- [Project Structure](#project-structure)
- [API Reference](#api-reference)
- [Environment Variables](#environment-variables)
- [Troubleshooting](#troubleshooting)
- [Deployment](#deployment)

---

## What This App Does

| Feature | Description |
|---|---|
| **Customers** | Full profiles with contact info, addresses, tags, notes, and communication timeline |
| **Leads** | Visual Kanban pipeline — drag cards between stages (New → Won) |
| **Opportunities** | Track deals with expected revenue, probability, and close dates |
| **Tasks** | Assign work with priorities, due dates, and completion checkboxes |
| **Support Tickets** | SLA timers, reply threads, internal notes hidden from customers |
| **Calendar** | Schedule meetings, calls, follow-ups, deadlines |
| **Employees** | Manage team members with roles and performance analytics |
| **Reports** | Sales trends, customer analytics, ticket metrics, employee performance |
| **Notifications** | Real-time in-app alerts for assignments and updates |
| **Global Search** | Find anything instantly with Ctrl+K |
| **Dark Mode** | Full dark/light theme toggle |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Vite, TanStack Query, Tailwind CSS, Recharts |
| Backend | Node.js 20, Express 4, TypeScript |
| Database | PostgreSQL 16, Prisma ORM |
| Cache / Queue | Redis 7, BullMQ |
| Auth | JWT + refresh token rotation with breach detection |
| Email (dev) | Mailpit — catches all outgoing emails locally |
| Containers | Docker / Podman |

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 20+ | https://nodejs.org |
| pnpm | 9+ | `npm install -g pnpm` |
| Docker or Podman | Any recent | https://docs.docker.com/get-docker |

Verify:
```bash
node --version    # v20.x.x or higher
pnpm --version    # 9.x.x or higher
docker --version  # any version
```

---

## Installation

### 1. Extract the project
```bash
tar xzf crm-platform-full.tar.gz
cd crm-platform
```

### 2. Allow pnpm build scripts (required — do this once)

pnpm blocks native build scripts by default. Fix it permanently:

```bash
cat >> pnpm-workspace.yaml << 'EOF'

onlyBuiltDependencies:
  - '@prisma/client'
  - '@prisma/engines'
  - prisma
  - esbuild
  - msgpackr-extract
EOF
```

### 3. Install all dependencies
```bash
pnpm install
```

### 4. Start the database and Redis
```bash
docker compose up -d
```

This starts:
- **PostgreSQL** on port 5432
- **Redis** on port 6379
- **Mailpit** on ports 1025 (SMTP) and 8025 (web UI — view sent emails here)

### 5. Configure environment
```bash
cp apps/api/.env.example apps/api/.env
```

Open `apps/api/.env` and set:
```env
JWT_SECRET=pick-any-random-string-at-least-32-characters
```

Everything else works with defaults for local development.

### 6. Set up the database
```bash
cd apps/api

# Generate Prisma client (required after install and after schema changes)
npx prisma generate --schema=prisma/schema.prisma

# Create all database tables
npx prisma migrate dev --schema=prisma/schema.prisma --name init

# Load sample data (test company, users, customers, leads, tickets, tasks)
npx tsx src/prisma/seed.ts

cd ../..
```

You should see:
```
🎉  Seed complete!
📋  Test accounts (password for all: Admin@12345):
   superadmin@crm.local     — Super Admin
   owner@acme.example.com   — Company Owner
   manager@acme.example.com — Manager
   sales1@acme.example.com  — Sales Rep
   support@acme.example.com — Support
```

---

## Running the App

Open **two terminals**.

**Terminal 1 — API (port 3000):**
```bash
cd crm-platform
pnpm --filter api dev
```

Wait for: `info: CRM API running on port 3000`

**Terminal 2 — Frontend (port 5173):**
```bash
cd crm-platform
pnpm --filter web dev
```

Open **http://localhost:5173** in your browser.

---

## First Login

The login page asks for three things:

1. **Company ID** — the UUID of your company
2. **Email** — your account email
3. **Password** — your password

**Get your Company ID:**
```bash
cd crm-platform
docker compose exec postgres psql -U crm -d crm_dev -c "SELECT id, name FROM companies;"
```

Copy the UUID shown next to "Acme Corp".

**Test accounts** (password for all: `Admin@12345`):

| Email | Role |
|---|---|
| `owner@acme.example.com` | Company Owner — full access |
| `manager@acme.example.com` | Manager — manage customers, leads, team |
| `sales1@acme.example.com` | Sales Rep — manage own leads |
| `support@acme.example.com` | Support — handle tickets |

---

## How to Add Companies

Only the **Super Admin** (`superadmin@crm.local`) can create companies.

### Step 1 — Get a Super Admin token

First, get any company ID (even Acme Corp's ID works for Super Admin login):
```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -H "X-Company-ID: YOUR_ACME_COMPANY_ID" \
  -d '{"email":"superadmin@crm.local","password":"Admin@12345"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['accessToken'])")

echo "Token: $TOKEN"
```

### Step 2 — Create the company

```bash
curl -X POST http://localhost:3000/api/v1/companies \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "name":     "Beta Industries",
    "email":    "admin@beta.com",
    "phone":    "+260977000001",
    "country":  "ZM",
    "timezone": "Africa/Lusaka",
    "currency": "ZMW"
  }'
```

The response includes the new company's `id`. Save it — you need it to invite users.

### Step 3 — Invite the first Owner for that company

```bash
curl -X POST http://localhost:3000/api/v1/companies/NEW_COMPANY_ID/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "email":     "owner@beta.com",
    "firstName": "Jane",
    "lastName":  "Smith",
    "role":      "COMPANY_OWNER"
  }'
```

Jane can now log in with Company ID = new company's UUID, email = `owner@beta.com`, password = `Admin@12345`.

---

## How to Add Employees

**Company Owners** and **Super Admins** can invite employees.

### Using curl

```bash
# Log in as Owner first and get token (same as above)

curl -X POST http://localhost:3000/api/v1/companies/YOUR_COMPANY_ID/members \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_OWNER_TOKEN" \
  -d '{
    "email":      "alice@company.com",
    "firstName":  "Alice",
    "lastName":   "Phiri",
    "role":       "SALES_REP",
    "department": "Sales",
    "jobTitle":   "Account Executive"
  }'
```

**Available roles:** `MANAGER` · `SALES_REP` · `SUPPORT` · `EMPLOYEE`

The new employee logs in with:
- Company ID: your company's UUID
- Email: `alice@company.com`
- Password: `Admin@12345` (they should change this on first login via the profile menu → Change password)

### Using Postman

1. Open Postman and create a `POST` request to `http://localhost:3000/api/v1/auth/login`
2. Add header: `X-Company-ID: your-company-uuid`
3. Set body (JSON): `{"email":"owner@acme.example.com","password":"Admin@12345"}`
4. Send and copy the `accessToken` from the response
5. Create a new `POST` request to `http://localhost:3000/api/v1/companies/:id/members`
6. Add header: `Authorization: Bearer <paste token>`
7. Set body (JSON) with the employee details and send

---

## How to Add Customers

Any **Manager or Sales Rep** can add customers.

### In the UI:
1. Click **Customers** in the left sidebar
2. Click the **+ New Customer** button (top right)
3. Fill in the form — name, email, phone, company, status, tags
4. Click **Save customer**

### Via API:
```bash
curl -X POST http://localhost:3000/api/v1/customers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "firstName":   "John",
    "lastName":    "Banda",
    "email":       "john@banda.zm",
    "phone":       "+260971234567",
    "companyName": "Banda Enterprises",
    "industry":    "Retail",
    "status":      "ACTIVE",
    "customerType":"BUSINESS",
    "country":     "ZM",
    "city":        "Lusaka",
    "tags":        ["vip", "wholesale"],
    "notes":       "Met at trade fair"
  }'
```

---

## How to Use Each Feature

### Leads Pipeline (Kanban Board)
- Go to **Leads** in the sidebar
- You see columns: New · Contacted · Qualified · Proposal Sent · Negotiation · Won · Lost
- **Drag and drop** cards between columns to advance a lead
- The system enforces valid transitions (e.g. you cannot skip from New directly to Won)
- Click the **list icon** (top right) to switch to a table view
- Click **New Lead** to create one

### Support Tickets
- Go to **Tickets** — see all tickets with priority, status, and SLA indicator
- Click a ticket to open the full conversation
- Type a reply at the bottom and click **Send reply**
- Check **"Internal note"** before sending to make it visible only to staff (hidden from customers)
- Change ticket status using the dropdown (top right of ticket detail)
- Red "Breached" badge means the SLA deadline has passed

### Calendar
- Go to **Calendar** — see a full monthly view
- Click **New Event** → fill in title, type, start/end time → **Create event**
- Click any event on the calendar to see details or delete it
- **Important:** always fill in both date AND time when creating events

### Opportunities
- Go to **Opportunities** — see all deals with stage, revenue, probability, and close date
- The probability bar shows visually how likely a deal is to close
- Use the stage filter (dropdown) to view deals at a specific stage
- Click **Edit** on a row to update a deal; click **Delete** to remove it
- Summary cards at the top show total pipeline value and won revenue

### Reports
- Go to **Reports** — four tabs of analytics:
  - **Sales & Revenue** — 12-month revenue chart and deals-closed trend
  - **Customers** — breakdown by status and type, with a customer list
  - **Support Tickets** — ticket count by status and priority
  - **Employee Performance** — conversion rates and revenue per employee

### Global Search
- Press **Ctrl+K** (Windows/Linux) or **Cmd+K** (Mac) from anywhere
- Or click the search bar in the top navigation
- Results appear grouped by type (Customers, Leads, Tickets, etc.)
- Use **arrow keys** to navigate, **Enter** to open, **Escape** to close

### Dark Mode
- Click the **moon icon** (top right navigation bar) to switch to dark mode
- Click the **sun icon** to switch back to light
- Your preference is saved in the browser

---

## User Roles Explained

| Role | Access Level |
|---|---|
| **Super Admin** | Everything — can create/delete companies and see all data |
| **Company Owner** | Full control within their company — employees, settings, all data |
| **Manager** | Manage customers, leads, tasks, tickets, opportunities; view reports |
| **Sales Rep** | Create leads and customers; edit only their own assigned records |
| **Support** | View tickets, reply, escalate, and close support tickets |
| **Employee** | View assigned customers; complete their own tasks |

The sidebar automatically shows only the pages each role can access.

---

## Project Structure

```
crm-platform/
├── apps/
│   ├── api/                    Node.js/Express backend
│   │   ├── src/
│   │   │   ├── delivery/       HTTP layer (routes, middleware)
│   │   │   ├── modules/        Feature modules (auth, customers, leads...)
│   │   │   ├── infrastructure/ Database, Redis, queues, email, storage
│   │   │   ├── core/           Errors, utilities, shared types
│   │   │   └── prisma/         Schema and seed script
│   │   └── prisma/
│   │       ├── schema.prisma   Database schema (single source of truth)
│   │       └── migrations/     Auto-generated SQL migrations
│   └── web/                    React frontend
│       └── src/
│           ├── features/       Feature pages (customers, leads, tickets...)
│           ├── components/     Shared UI (Button, Input, Modal, Table...)
│           ├── layouts/        Page shells (dashboard layout, auth layout)
│           ├── context/        Auth and theme context providers
│           ├── hooks/          Shared hooks (useDebounce, usePermission)
│           └── lib/            Axios, query client, formatters, date utils
└── packages/
    └── shared/                 Shared TypeScript types and Zod schemas
```

---

## API Reference

Base URL: `http://localhost:3000/api/v1`

All protected endpoints require: `Authorization: Bearer <access_token>`

```
# Auth
POST  /auth/login               Body: { email, password } + Header: X-Company-ID
POST  /auth/refresh             Body: { refreshToken }
POST  /auth/logout
GET   /auth/me

# Companies
GET   /companies                Super Admin only
POST  /companies                Super Admin only
GET   /companies/:id/members    Owner, Manager
POST  /companies/:id/members    Owner only

# Customers
GET   /customers                ?search= ?status= ?tags=
POST  /customers
GET   /customers/:id
PATCH /customers/:id
DELETE /customers/:id
GET   /customers/:id/timeline

# Leads
GET   /leads                    ?stage= ?assignedTo=
POST  /leads
PATCH /leads/:id
PATCH /leads/:id/stage          Body: { stage, note }
POST  /leads/:id/convert

# Opportunities
GET   /opportunities            ?stage=
POST  /opportunities
PATCH /opportunities/:id
DELETE /opportunities/:id

# Tasks
GET   /tasks                    ?status= ?priority= ?assignedTo=
POST  /tasks
PATCH /tasks/:id
GET   /tasks/overdue

# Tickets
GET   /tickets                  ?status= ?priority=
POST  /tickets
GET   /tickets/:id
PATCH /tickets/:id/status
POST  /tickets/:id/replies      Body: { body, isInternal }
POST  /tickets/:id/escalate

# Calendar
GET   /calendar/events          Required: ?startsFrom=ISO&startsTo=ISO
POST  /calendar/events
DELETE /calendar/events/:id

# Dashboard
GET   /dashboard/summary
GET   /dashboard/sales-trend
GET   /dashboard/pipeline
GET   /dashboard/top-performers
GET   /dashboard/recent-activity

# Employees
GET   /employees                ?search= ?role=
GET   /employees/performance

# Reports / search / notifications / audit
GET   /search?q=query
GET   /notifications
GET   /notifications/unread-count
GET   /audit                    Owner+ only
GET   /settings
PATCH /settings
```

---

## Environment Variables

File: `apps/api/.env`  (copy from `apps/api/.env.example`)

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | (required) | PostgreSQL connection string |
| `REDIS_URL` | (required) | Redis URL |
| `JWT_SECRET` | (required) | Min 32 chars — sign access tokens |
| `ENCRYPTION_KEY` | optional | 64 hex chars — encrypts sensitive DB fields |
| `PORT` | `3000` | API server port |
| `NODE_ENV` | `development` | `development` or `production` |
| `FRONTEND_URL` | `http://localhost:5173` | For CORS and email links |
| `STORAGE_PROVIDER` | `local` | `local` or `s3` |
| `SMTP_HOST` | `localhost` | Email server host |
| `SMTP_PORT` | `1025` | Email server port (Mailpit default) |
| `EMAIL_FROM` | `noreply@crm.local` | Sender address |
| `LOG_LEVEL` | `info` | `debug`, `info`, `warn`, `error` |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost (higher = slower) |
| `MAX_LOGIN_ATTEMPTS` | `5` | Before account lockout |
| `LOCKOUT_MINUTES` | `15` | How long lockout lasts |

**Generate secure secrets:**
```bash
# JWT_SECRET
openssl rand -base64 48

# ENCRYPTION_KEY (must be exactly 64 hex chars)
openssl rand -hex 32
```

---

## Troubleshooting

### API won't start — "connect ECONNREFUSED 127.0.0.1:6379"
Redis isn't running. Fix:
```bash
docker compose up -d
docker compose ps    # verify redis shows as "running"
```

### "Cannot find module '.prisma/client/default'"
Prisma client not generated. Fix:
```bash
cd apps/api
npx prisma generate --schema=prisma/schema.prisma
```

### "Unique constraint failed on ticket_number" during seed
Seed ran twice (once automatically by migrate, once manually). The data is already there. Just skip the manual seed. To start fresh:
```bash
cd apps/api
npx prisma migrate reset --schema=prisma/schema.prisma
# Answer "yes" — this wipes and re-seeds automatically
```

### Login fails — "Not a member of this company"
Wrong Company ID. Get the correct one:
```bash
docker compose exec postgres psql -U crm -d crm_dev -c "SELECT id, name FROM companies;"
```

### pnpm install fails — ERR_PNPM_IGNORED_BUILDS
Add the build allowlist to `pnpm-workspace.yaml`:
```bash
cat >> pnpm-workspace.yaml << 'EOF'

onlyBuiltDependencies:
  - '@prisma/client'
  - '@prisma/engines'
  - prisma
  - esbuild
  - msgpackr-extract
EOF
pnpm install
```

### Calendar event or task fails on save
Always select both **date AND time** in datetime fields. The input format is `YYYY-MM-DDTHH:MM`. Submitting without a time selected causes a validation error.

### View outgoing emails
All emails in development are captured by Mailpit. Open **http://localhost:8025** to see them (password resets, notifications, etc.).

### Schema drift error on `prisma migrate dev`
If you see "Drift detected", Prisma found a mismatch between your migration files and the database. This happens when you switch between git branches or re-install. Answer **yes** to reset — it will re-run all migrations and re-seed.

---

## Deployment

### Production with Docker Compose

**1.** Edit `docker/nginx/nginx.conf` — replace `your-crm-domain.com` with your domain.

**2.** Get an SSL certificate:
```bash
certbot certonly --standalone -d your-crm-domain.com
mkdir -p certs
cp /etc/letsencrypt/live/your-crm-domain.com/fullchain.pem certs/
cp /etc/letsencrypt/live/your-crm-domain.com/privkey.pem   certs/
```

**3.** Set production environment in `apps/api/.env`:
```env
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
ENCRYPTION_KEY=<64-hex-chars>
DATABASE_URL=postgresql://crm:<password>@postgres:5432/crm
REDIS_URL=redis://:<password>@redis:6379
FRONTEND_URL=https://your-crm-domain.com
SMTP_HOST=smtp.sendgrid.net   # or your mail provider
SMTP_PORT=587
```

**4.** Build and launch:
```bash
docker compose -f docker-compose.prod.yml up -d

# First deploy only — run migrations
docker compose exec api npx prisma migrate deploy --schema=prisma/schema.prisma
```

### Scaling tips

| Need | Solution |
|---|---|
| More API capacity | Increase `replicas` in `docker-compose.prod.yml` |
| Managed database | Point `DATABASE_URL` to Neon, Supabase, or AWS RDS |
| File uploads to cloud | Set `STORAGE_PROVIDER=s3` and add `S3_*` vars |
| Better email delivery | Use SendGrid, Postmark, or AWS SES SMTP credentials |

---

## Roadmap

- [ ] Mobile app (React Native + Capacitor for Android/iOS)
- [ ] Customer self-service portal (submit tickets, view invoices)
- [ ] Google Calendar sync
- [ ] PDF/Excel report export
- [ ] WhatsApp Business integration
- [ ] Stripe payment integration
- [ ] AI-powered lead scoring and customer summaries
- [ ] Multi-language / locale support
