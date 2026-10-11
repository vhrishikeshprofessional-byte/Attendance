# Central Attendance Management System: Backend Design (v1)

Status: **DRAFT, awaiting approval.** No implementation starts until this is approved.
Stack: Python 3.12, FastAPI, MongoDB (replica set), Pydantic v2, async PyMongo driver, APScheduler, Docker Compose (local only).

---

## 1. Goals

1. Employees log office sessions (multiple per day). Admin manages everything.
2. A weekly policy decides who is following the office policy. Violators get an email stating exactly which condition failed.
3. **One report API** answers: daily / weekly / monthly / yearly / custom, for one employee, many employees, a team, or the whole company.
4. Employees can read and create their own data. Edits and deletes go through admin-approved change requests.
5. Secure, auditable, and scalable to many employees. Local-only for now.

Out of scope for v1: frontend, leave management, team hierarchy, multi-tenancy, public deployment, SSO.

---

## 2. Roles and access

| Role | Can do |
|---|---|
| **admin** (exactly one) | Full CRUD on all attendance, employees, teams, holidays. Approve or reject change requests. Run any report. Trigger policy run. View audit log. |
| **employee** | Sign up, sign in. Read own profile. GET and POST own attendance. Read own report. Create, view, withdraw own change requests. |

- **Admin bootstrap:** on first launch, if no admin exists, one is created from `.env` (`ADMIN_EMAIL=admin@kxn.com`, `ADMIN_PASSWORD`). `.env` is only a seed. After that the admin changes email and password via `PATCH /auth/admin/credentials`. A partial unique index on `role="admin"` enforces a single admin.
- The role is a field on the user, with a permission dependency per route. Adding "team lead" or "HR" later means adding a role and rules, not a rewrite.
- **Object-level authorization** is mandatory: every employee route filters by `employee_id == token.sub`, never by an id from the request.

---

## 3. Policy engine

### 3.1 Definitions

- **Week:** Monday 00:00 to Sunday 23:59:59, timezone `Asia/Kolkata` (IST).
- **Weekly offs:** Saturday and Sunday (configurable). So a normal week has **5 working days**.
- **Holiday:** a date marked by admin that falls on a working day. A holiday on a weekly off does not count twice.
- **Attended day:** an IST date whose total completed session time is at least `MIN_ATTENDED_DAY_MINUTES` (default 60).
- **Day:** 12:00:00 AM to 11:59:59 PM IST, multiple sessions allowed. A session may not cross midnight. To cover midnight, submit two sessions.

### 3.2 Requirement table

Let `H` = number of holidays on working days in that week, and `W = 5 - H` working days.

```
required_days  = min(3, W)
required_hours = 5 * required_days
```

| Holidays (H) | Working days | Required attended days | Required total hours |
|---|---|---|---|
| 0 | 5 | 3 | 15 |
| 1 | 4 | 3 | 15 |
| 2 | 3 | 3 | 15 |
| 3 | 2 | 2 | 10 |
| 4 | 1 | 1 | 5 |
| 5 | 0 | 0 | 0 |

### 3.3 Compliance (each condition is checked independently)

- `days_ok  = attended_days >= required_days`
- `hours_ok = total_hours   >= required_hours`  (this is the "average of at least 5 h per required day")
- Compliant only if both pass.
- **If either fails, an email is sent.** The email says which condition failed:
  `days_ok=false` only, `hours_ok=false` only, or both, with actual vs required numbers.

### 3.4 Week states

| State | Meaning |
|---|---|
| `compliant` | Week finished, both conditions met |
| `non_compliant` | Week finished, at least one condition failed (reports `failed_conditions: ["days","hours"]`) |
| `in_progress` | Week not yet over (shown, never emailed) |
| `not_applicable` | Employee joined after the week started, or employee inactive, so the week is skipped |

### 3.5 Email trigger (my decision)

- **Monday 09:00 IST**: evaluates the previous (finished) week for all active employees. Sending after the week closes avoids false alarms.
- **Idempotent:** the `notification_log` collection has a unique index `(employee_id, week_start, type)`. Reruns, restarts and multiple app instances can never double-send.
- **Admin digest:** one summary email to the admin listing all non-compliant employees (flag `ADMIN_DIGEST_ENABLED`).
- **Optional mid-week "at risk" reminder** (Thursday 16:00 IST) behind `MIDWEEK_REMINDER_ENABLED=false`. Off by default.
- **Manual trigger:** `POST /admin/policy/run?week_start=YYYY-MM-DD&dry_run=true|false`. Dry run returns who *would* be emailed.
- Holidays added after a week was already emailed do not resend or retract. The report always shows the live, holiday-aware status.
- SMTP settings come only from `.env`. Emails are sent from a background task with retries and are logged `sent | failed` with error text. A failed email never blocks the job.

---

## 4. Time handling and formats

- Stored in MongoDB as **UTC** datetimes. Business logic uses IST.
- **Output** (both always present):
  - `entry_time`: `"October 9, 2026 6:26:56 PM"`
  - `entry_time_iso`: `"2026-10-09T12:56:56Z"`
  - Query param `date_format=long|numeric` (default `long`). `numeric` gives `"10-09-2026 18:26:56"` (mm-dd-yyyy HH:MM:SS, 24-hour).
- **Input** accepts: `October 9, 2026 6:26:56 PM`, `October 9 2026 7:26:56 PM`, `10-09-2026 18:26:56`, and ISO 8601. Strings with no offset are interpreted as IST.
- **Empty values:** a day with no completed session is shown as `entry_time: ""`, `exit_time: ""`, `status: "Not attended office"`.
- An **open session** (entry, no exit yet) is shown with `exit_time: ""`, is not counted in hours, and is flagged `open: true`.

---

## 5. Data model (MongoDB)

All documents have `created_at`, `updated_at` (UTC). Soft-deletable ones have `is_deleted`, `deleted_at`, `deleted_by`.

### 5.1 `users` (auth + profile, admin and employees)

```
_id, role: "admin"|"employee", status: "active"|"inactive"
password_hash (argon2id), failed_login_count, locked_until, token_version
employee_id        # unique, e.g. "EMP-000123", system-generated at signup, admin can edit
work_email         # unique, lowercase, login id
personal: {
  full_name, date_of_birth, gender, phone, personal_email,
  address: {line1, line2, city, state, postal_code, country},
  emergency_contact: {name, relation, phone}
}
professional: {
  designation, department, joining_date, employment_type: "full_time"|"part_time"|"contract"|"intern",
  manager_id, work_location, team_ids: [ObjectId]
}
version  # optimistic concurrency counter
```

- `age` is **derived** from `date_of_birth`, never stored.
- Employees may only *request* changes to `personal.*`. `professional.*`, `employee_id`, `status`, `role` are admin-only.

### 5.2 `teams`

`_id, name (unique, case-insensitive), description, is_deleted`

Membership lives on the user (`professional.team_ids`, multikey indexed). One employee can be in **many** teams. Admin manages membership through `PUT /teams/{id}/members`. A team report counts an employee under every team they belong to.

### 5.3 `attendance` (one document per session)

```
_id, employee_id (ObjectId -> users)
entry_time (UTC), exit_time (UTC | null)
date          # IST date string "2026-10-09" (derived from entry_time)
week_start    # IST Monday "2026-10-05" (derived)
month, year   # derived
duration_seconds   # null while open
source: "check_in" | "manual" | "admin"
note, is_deleted, version
```

**Why one document per session (not per day):** it matches your `entry_time / exit_time / date` columns exactly, makes edit and delete of a single session trivial (no array-position updates), avoids hot documents, and lets MongoDB aggregation do daily and weekly sums. Daily totals come from `$group` on `(employee_id, date)`.

Derived fields (`date`, `week_start`, `month`, `year`, `duration_seconds`) are computed server-side on every write and are never client-supplied. They exist so reports are index-backed range queries, not per-document date math.

**Validation rules:**
- `exit_time > entry_time`, and both fall on the **same IST date**.
- Sessions of the same employee may not overlap (checked inside a transaction).
- Future times are rejected (`FUTURE_TIME_TOLERANCE_SECONDS=60`).
- Backdating is allowed (your requirement). Such rows carry `source="manual"` and are filterable in reports so admin can review them.
- Max session length 16 h (configurable) as a sanity guard.

### 5.4 `holidays`

`_id, date (unique, IST date), name, created_by`. Admin CRUD. Weekly offs are config, not rows.

### 5.5 `change_requests`

```
_id, requester_id, type:
  "attendance_update" | "attendance_delete" | "profile_update"
target: {collection, id}
proposed_changes: {...}        # only whitelisted fields, validated at creation
snapshot_before: {...}         # state when requested
target_version                 # for stale detection
reason (required)
status: "pending"|"approved"|"rejected"|"withdrawn"|"stale"
reviewed_by, reviewed_at, review_comment
```

**Workflow:**
1. Employee creates a request. Server validates that the target belongs to them and that the proposed fields are in the allowed list.
2. Admin lists pending requests, approves or rejects with a comment.
3. **Approve** runs inside one transaction: re-checks `target_version`, applies the change, writes the audit log, marks the request approved. If the target changed since the request was made, the request becomes `stale` and nothing is applied.
4. Employee can **withdraw** only while `pending`. A decided request cannot be changed.
5. One open request per target at a time (unique partial index) to prevent conflicting edits.
6. Employee gets an email on approve or reject (best effort).

### 5.6 `audit_logs` (append-only)

```
_id, ts, actor_id, actor_role, action ("attendance.update", "user.delete", "request.approve", ...)
entity: {collection, id}, before, after, ip, request_id
```

Written for **every** admin edit, delete, approval, login-credential change and policy run. The API exposes read endpoints only: no update, no delete route exists for it. (Optionally hardened later with a DB role that has insert and read only.)

### 5.7 Supporting collections

- `refresh_tokens`: `{user_id, token_hash, family_id, expires_at, revoked}`, with a TTL index.
- `notification_log`: `{employee_id, week_start, type, status, error, sent_at}`, unique `(employee_id, week_start, type)`.
- `counters`: atomic sequence for `employee_id`.

### 5.8 Indexes

| Collection | Index | Purpose |
|---|---|---|
| users | `work_email` unique | login |
| users | `employee_id` unique | lookup |
| users | `role` unique partial (`role="admin"`) | single admin |
| users | `professional.team_ids` | team filters |
| users | `status`, `professional.joining_date` | policy job |
| attendance | `(employee_id, date, entry_time)` | one employee's range, overlap check |
| attendance | `(date, employee_id)` | company-wide daily |
| attendance | `(week_start, employee_id)` | weekly aggregation |
| attendance | `(is_deleted)` folded into partial filters | skip deleted |
| holidays | `date` unique | holiday lookup |
| change_requests | `(status, created_at)`, `(requester_id, created_at)` | queues |
| change_requests | `(target.id)` unique partial on `status="pending"` | one open request per target |
| audit_logs | `(entity.id, ts)`, `(actor_id, ts)` | history |
| refresh_tokens | `expires_at` TTL | cleanup |

---

## 6. API design (`/api/v1`)

### 6.1 Auth

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/auth/signup` | public | Creates `employee`. Rate-limited. Optional `ALLOWED_SIGNUP_DOMAINS` allowlist. Generates `employee_id`. |
| POST | `/auth/login` | public | Work email or employee ID plus password. Returns access and refresh tokens. |
| POST | `/auth/refresh` | public | Rotating refresh tokens with reuse detection. |
| POST | `/auth/logout` | any | Revokes the refresh token family. |
| POST | `/auth/change-password` | any | Requires current password. |
| PATCH | `/auth/admin/credentials` | admin | Change admin email and password. |
| POST | `/auth/forgot-password`, `/auth/reset-password` | public | SMTP reset link. Always returns a generic response. |

### 6.2 Employees

| Method | Path | Who |
|---|---|---|
| GET | `/me` | any |
| GET | `/employees` | admin (filters, search, pagination) |
| GET | `/employees/{id}` | admin |
| PATCH | `/employees/{id}` | admin (all personal and professional fields, versioned) |
| DELETE | `/employees/{id}` | admin (soft delete, revokes tokens) |
| POST | `/employees/{id}/restore` | admin |

### 6.3 Teams and holidays (admin)

`POST/GET/PATCH/DELETE /teams`, `PUT /teams/{id}/members`, `POST/GET/PATCH/DELETE /holidays`.

### 6.4 Attendance

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/attendance` | employee (own), admin (any `employee_id`) | Manual entry: `entry_time`, optional `exit_time`, `note`. |
| POST | `/attendance/check-in`, `/attendance/check-out` | employee | Server time. Check-out may close **one's own open session** directly. |
| GET | `/attendance` | employee (own), admin (any) | List with filters and pagination. |
| GET | `/attendance/{id}` | owner or admin | |
| PATCH | `/attendance/{id}` | **admin only** | Employee uses a change request instead. |
| DELETE | `/attendance/{id}` | **admin only** | Soft delete. |

### 6.5 Change requests

| Method | Path | Who |
|---|---|---|
| POST | `/change-requests` | employee |
| GET | `/change-requests` | employee (own) or admin (all, filter by status and type) |
| GET | `/change-requests/{id}` | owner or admin |
| POST | `/change-requests/{id}/withdraw` | owner |
| POST | `/change-requests/{id}/approve`, `/reject` | admin |

### 6.6 Admin utilities

`POST /admin/policy/run`, `GET /audit-logs` (filter by entity, actor, date), `GET /health` and `/ready`.

---

## 7. The single report API

**`GET /api/v1/reports/attendance`**, with a thin alias `GET /api/v1/reports/attendance/{period}` for the path-parameter style. Both hit the same handler.

| Param | Values | Notes |
|---|---|---|
| `period` | `daily` `weekly` `monthly` `yearly` `custom` | Anchored by `date` (default today IST) |
| `date` | a date | Anchor for daily, weekly, monthly, yearly |
| `from`, `to` | dates | Required when `period=custom`. Max span `REPORT_MAX_DAYS` (default 366) |
| `employee_id` | repeatable | Employee ID or ObjectId |
| `team_id` | repeatable | |
| `status` | `compliant` `non_compliant` `in_progress` `absent` | Period-level filter |
| `group_by` | `employee` (default) `team` `day` | |
| `include_daily` | bool | Per-day rows with entry/exit sessions |
| `include_sessions` | bool | Raw sessions inside each day |
| `source` | `check_in` `manual` `admin` | Review backdated or manual entries |
| `date_format` | `long` `numeric` | |
| `page`, `page_size` (max 200), `sort` | e.g. `-total_hours` | |

**Authorization:** admin sees anyone. An employee's filters are forced to themselves, and foreign `employee_id` or `team_id` returns 403.

**Answering "who among the 10 is not following policy" in one call:**
`GET /reports/attendance?period=weekly&date=2026-10-09&status=non_compliant`

**Response (shape):**
```
{
  "period": {"type":"weekly","from":"...","to":"..."},
  "summary": {"employees":10,"compliant":7,"non_compliant":3,"in_progress":0},
  "data": [{
    "employee": {"id","employee_id","name","teams":[...]},
    "totals": {"attended_days":2,"total_hours":11.5,"avg_hours_per_attended_day":5.75},
    "weeks": [{"week_start","holidays":1,"required_days":3,"required_hours":15,
               "attended_days":2,"total_hours":11.5,
               "days_ok":false,"hours_ok":false,"status":"non_compliant",
               "failed_conditions":["days","hours"]}],
    "days": [{"date":"October 9, 2026","day_type":"working|holiday|weekly_off",
              "status":"Attended|Not attended office",
              "total_hours":6.5,
              "sessions":[{"entry_time":"October 9, 2026 10:00:00 AM","exit_time":"October 9, 2026 4:30:00 PM"}]}]
  }],
  "pagination": {"page":1,"page_size":50,"total":10}
}
```

**Query strategy (scales to thousands of employees):**
1. Resolve filter to a set of employee IDs (paged), via `users` indexes.
2. One aggregation on `attendance` using range match on `date`, `$group` by `(employee_id, week_start, date)`, then by `(employee_id, week_start)`. No per-employee queries (no N+1).
3. Load the holidays in range once. Compute `H`, `required_*`, and week status in Python with a pure, unit-tested function.
4. Missing days are filled in memory (working days with no sessions become `Not attended office`).
5. Pagination happens on the employee set, so response size stays bounded. `include_daily` over a long range is capped.

---

## 8. Security

- **Passwords:** argon2id, password policy (min 10 chars), generic login errors, lockout after 5 failures for 15 minutes.
- **JWT:** short-lived access token (15 min), rotating refresh tokens stored hashed, reuse detection revokes the whole family, `token_version` allows instant revocation on deactivate, password change or admin change.
- **Authorization:** central dependency per route plus object-level checks. Deny by default.
- **Input:** strict Pydantic models with `extra="forbid"`. Filters are typed fields only, never raw dicts, which prevents NoSQL operator injection (`$ne`, `$gt` payloads).
- **Rate limiting:** on signup, login and reset. In-memory for local, pluggable to Redis later.
- **Secrets:** only in `.env`, never logged, never committed (`.env.example` has placeholders). The admin password is **not** written in this file or the repo.
- **Transport and headers:** CORS allowlist, security headers, request-size limit. HTTPS is terminated at the proxy when deployed.
- **Privacy:** the PII fields are never logged. Audit before/after values exclude password hashes and tokens.
- **Anti-enumeration:** forgot-password and signup conflict messages are generic where practical.

## 9. Reliability and scalability

- Stateless API, so it scales horizontally. State lives in MongoDB.
- MongoDB runs as a **single-node replica set locally** (needed for transactions).
- Transactions for: overlap-checked attendance write, request approval, team membership changes.
- Optimistic concurrency via `version`. Conflicts return `409`.
- **Scheduler safety:** multiple instances could each run the job. Duplicate emails are impossible because of the `notification_log` unique index, and a Mongo-based lock gives single-runner behavior.
- Structured JSON logs with `request_id`. `/health` and `/ready`.
- Uniform error format: `{"error":{"code","message","details"}}`.
- Driver: I recommend the **async PyMongo API** (`AsyncMongoClient`) instead of Motor, because MongoDB has deprecated Motor in favor of it. The code is nearly identical.

---

## 10. Configuration (`.env`)

```
APP_ENV, SECRET_KEY, ACCESS_TOKEN_MINUTES=15, REFRESH_TOKEN_DAYS=7
MONGO_URI, MONGO_DB
ADMIN_EMAIL=admin@kxn.com, ADMIN_PASSWORD=<set locally>
SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD, SMTP_FROM, SMTP_USE_TLS
TIMEZONE=Asia/Kolkata, WEEKLY_OFF_DAYS=5,6
MIN_ATTENDED_DAY_MINUTES=60, MAX_SESSION_HOURS=16
POLICY_JOB_CRON="mon 09:00", ADMIN_DIGEST_ENABLED=true, MIDWEEK_REMINDER_ENABLED=false
ALLOWED_SIGNUP_DOMAINS=   # optional, e.g. kxn.com
REPORT_MAX_DAYS=366
```

## 11. Project structure

```
app/
  main.py, config.py
  core/        security.py, deps.py, errors.py, logging.py, rate_limit.py
  db/          client.py, indexes.py, seed.py
  models/      (Pydantic schemas: user, attendance, team, holiday, request, report)
  repositories/ (all Mongo access, one module per collection)
  services/    auth, attendance, employees, change_requests, policy, reports, audit, email
  api/v1/      auth.py, employees.py, teams.py, holidays.py, attendance.py,
               change_requests.py, reports.py, admin.py
  jobs/        scheduler.py, weekly_policy.py
  utils/       timefmt.py (parse and format), weeks.py
tests/         unit (policy, timefmt, weeks), integration (api with test Mongo)
docker-compose.yml, Dockerfile, .env.example, README.md
```

Layering: **routes** (thin) -> **services** (business rules) -> **repositories** (DB). The policy function is pure, so it is exhaustively unit-tested against the table in section 3.2.

## 12. Implementation plan (after approval)

1. Skeleton, config, DB client, indexes, Docker Compose (Mongo replica set), admin seed.
2. Auth (signup, login, refresh, RBAC), audit service.
3. Employees, teams, holidays.
4. Attendance (check-in/out, manual, admin CRUD, overlap and time rules, time parser and formatter).
5. Policy engine (pure function) plus tests for every holiday case.
6. Report API.
7. Change requests.
8. Email service, weekly job, manual trigger, notification log.
9. Hardening: rate limits, headers, tests, README with curl examples.

## 13. Decisions I made that you should confirm

1. A day counts as **attended** only with at least 60 minutes of completed sessions (configurable).
2. "15 hr avg" = total hours at least `5 x required_days`, checked separately from the days condition.
3. Future-dated entries are rejected even though past entries are free. Backdated rows are tagged `manual` for admin review.
4. `mm-dd-yyyy` is parsed as month-day-year (US order), as you wrote it.
5. Employees who joined mid-week are evaluated from the first full week after joining.
6. Self-signup is open (optionally restricted by email domain). No email verification in v1.
7. Leave management is not included. Only admin-marked holidays reduce the requirement.
