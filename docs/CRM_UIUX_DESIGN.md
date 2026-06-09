# Internal Tenant CRM — UI/UX Design Document

## UX Overview

- **Tenant-centric model**: Every entity (contact, ticket, task, transaction) belongs to a tenant; users think "what's happening with Acme Co.?" not "show me all tickets."
- **Single gateway for requests**: A unified "Requests Hub" (inbox) aggregates all tenant requests — tickets, tasks, and general inquiries — into one actionable, high-signal list. It is the default landing for Support/Ops and is always visible in the sidebar with a live unread count badge.
- **Information-dense, desktop-first**: Dense tables with inline badges, avatars, and quick actions; no mobile-first simplification.
- **Role-driven landing**: Sales lands on tenant list with pipeline signals; Support and Ops land on the Requests Hub; all roles can pivot from the Hub to tenant detail.
- **Progressive disclosure**: List → Summary card → Detail shell with tabs; heavy detail hidden behind tabs, not modals.
- **Action proximity**: Create actions (note, ticket, task) live inside the relevant tab on the tenant detail page, not in global menus.

---

## Main Mental Model

**Tenant-centric with activity as the spine.**

A platform user navigates by tenant first. The tenant is the container. Inside the container, the Activity tab is the default view — it is the chronological spine connecting notes, ticket updates, task completions, and system events. Tickets, Tasks, and Transactions are specialized lenses into that tenant's world. The global Tickets and Tasks views exist for cross-tenant queue management (Support/Ops workflows), but the mental home is the tenant detail page.

---

## Primary Navigation Pattern

**Sidebar + Topbar + Inline Tabs**

- **Sidebar**: Collapsible admin sidebar (existing `AdminNavContent.tsx`). CRM is a top-level section under Admin.
- **Topbar inside CRM shell**: A sub-navigation bar with links to Dashboard, Requests Hub, Tenants, Tickets, Tasks. Acts as a secondary nav scoped to the CRM module.
- **Inline Tabs**: On the Tenant Detail page, tabs switch between Overview / Activity / Tickets / Transactions / Tasks / Contacts. Tabs are sticky under the tenant header.

---

## Screen Inventory

| Screen | Purpose | Entry Point |
|---|---|---|
| CRM Dashboard | Global stats: open tickets, overdue tasks, recent activity, tenant health alerts | `/settings/admin/crm` |
| Requests Hub | Unified inbox of all tenant requests (tickets + tasks + inquiries). Filterable, sortable, quick-actions. | `/settings/admin/crm/requests` |
| Tenants List | Searchable, filterable table of all tenants with computed CRM stats (LTV, open tickets, last activity) | Sidebar → CRM → Tenants |
| Tenant Detail | Container page for a single tenant; houses tabs | Click tenant row in list |
| Tenant Overview Tab | Quick stats, subscription status, contacts list, recent tasks/tickets | Default tab on Tenant Detail |
| Tenant Activity Tab | Chronological feed of notes, status changes, calls, emails | Tenant Detail → Activity |
| Tenant Tickets Tab | List of all tickets for this tenant + create ticket CTA | Tenant Detail → Tickets |
| Tenant Transactions Tab | Read-only order history with totals/status | Tenant Detail → Transactions |
| Tenant Tasks Tab | List of tasks scoped to this tenant + create task CTA | Tenant Detail → Tasks |
| Tenant Contacts Tab | CRUD contacts for this tenant | Tenant Detail → Contacts |
| Global Tickets Queue | All open tickets across tenants; filterable by assignee, priority, status | `/settings/admin/crm/tickets` |
| Global Tasks Board | Kanban-style board of tasks across tenants; filterable by assignee | `/settings/admin/crm/tasks` |

---

## Navigation & Layout (ASCII)

```
[App Shell: Sidebar (240px) + Topbar (sticky, 56px)]
│
├─ Sidebar
│  ├─ Dashboard
│  ├─ Users
│  ├─ Tenants
│  ├─ CRM  <-- highlighted
│  │  ├─ Dashboard
│  │  ├─ Requests Hub  (12)
│  │  ├─ Tenants
│  │  ├─ Tickets
│  │  └─ Tasks
│  └─ Security & Platform
│
└─ Main Content Area (flex-1, overflow-auto)
   │
   ├─ [CRM Dashboard]
   │  ├─ Stat Cards Row (Open Tickets | Overdue Tasks | Active Tenants | Avg Response)
   │  ├─ My Tickets (table, 5 rows)
   │  └─ Recent Activity Feed (8 items)
   │
   ├─ [Requests Hub]
   │  ├─ Filter Bar (type + status + priority + assignee + tenant)
   │  ├─ Request Table (sortable, groupable, quick actions)
   │  │  └─ click row → [Tenant Detail] → relevant Tab
   │  └─ Bulk Action Bar (assign / status / tag)
   │
   ├─ [Tenants List]
   │  ├─ Filter Bar (search + tier + status + assignedTo)
   │  └─ Data Table (sortable columns, row actions)
   │     └─ click row → [Tenant Detail]
   │
   ├─ [Tenant Detail]
   │  ├─ Tenant Header (name, tier badge, status, quick actions)
   │  ├─ Sticky Tab Bar
   │  │  ├─ Overview  (default)
   │  │  ├─ Activity
   │  │  ├─ Tickets
   │  │  ├─ Transactions
   │  │  ├─ Tasks
   │  │  └─ Contacts
   │  └─ Tab Content Area
   │
   ├─ [Global Tickets]
   │  ├─ Filter Bar (status + priority + assignee + tenant)
   │  └─ Ticket Table
   │     └─ click row → [Tenant Detail] → Tickets Tab
   │
   └─ [Global Tasks]
      ├─ Filter Bar (status + assignee + priority)
      └─ Kanban Board (3 columns)
         └─ click card → [Tenant Detail] → Tasks Tab
```

---

## Key Screens — ASCII Wireframes

### Screen 1: Tenants List

```
+----------------------------------------------------------------------------------+
| Tenants                                                    [+ New Contact]       |
+----------------------------------------------------------------------------------+
| [Search tenants...    ] [Tier ▼] [Status ▼] [Assigned To ▼]     124 results      |
+----------------------------------------------------------------------------------+
| Tenant Name        | Tier      | Status | LTV     | Open Tix | Last Activity     |
|--------------------|-----------|--------|---------|----------|-------------------|
| Acme Grocery       | Starter   | Active | $4,200  | 2        | 2h ago — note     |
| BrightMart         | Pro       | Trial  | $0      | 0        | 1d ago — ticket   |
| Corner Deli        | Starter   | Active | $1,100  | 1        | 3h ago — task     |
| Downtown Pharmacy  | Enterprise| Active | $12,500 | 0        | 5m ago — call     |
| ...                                                                               |
+----------------------------------------------------------------------------------+
| < Prev  1  2  3  ...  13  Next >                                                 |
+----------------------------------------------------------------------------------+
```

- **Layout**: Full-width content. Filter bar is sticky under the page header.
- **Table columns**: Name (clickable → detail), Tier (badge), Status (badge), LTV (right-aligned, currency), Open Tickets (count badge), Last Activity (relative time + type icon).
- **Row action**: Hover reveals a "View" button; entire row is clickable.

---

### Screen 2: Tenant Detail — Overview Tab (Default)

```
+----------------------------------------------------------------------------------+
| Acme Grocery                                    Starter | Active | [Edit Contact]  |
| 123 Market St, Springfield, MA                                            […]    |
+----------------------------------------------------------------------------------+
| Overview | Activity | Tickets | Transactions | Tasks | Contacts               |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  +----------------+  +----------------+  +----------------+  +--------------+  |
|  | Lifetime Value |  | Open Tickets   |  | Pending Tasks  |  | Orders (30d) |  |
|  | $4,200         |  | 2              |  | 1              |  | 14           |  |
|  +----------------+  +----------------+  +----------------+  +--------------+  |
|                                                                                  |
|  Primary Contacts                                              + Add Contact  |
|  +-----------------------------------------------------------+                 |
|  | Name          | Role       | Email             | Phone    |                 |
|  |---------------|------------|-------------------|----------|                 |
|  | Jane Doe      | Owner      | jane@acme.com     | 555-0100 |                 |
|  | Bob Smith     | Billing    | bob@acme.com      | 555-0101 |                 |
|  +-----------------------------------------------------------+                 |
|                                                                                  |
|  Recent Activity (5)                                        [View All →]       |
|  +-----------------------------------------------------------+                 |
|  | Today  10:42a  | Support Note — "Called about refund"      | — Jane (S)     |
|  | Today   9:15a  | Ticket #2042 created — "Payment failed"   | — Auto         |
|  | Yesterday      | Task completed — "Onboarding call"        | — Mike (O)     |
|  +-----------------------------------------------------------+                 |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

- **Header**: Tenant name + address + subscription tier badge + status badge + quick-action dropdown (…).
- **Stats row**: 4 cards with computed values.
- **Primary Contacts**: Inline table, max 3-4 rows. Click row → Contacts tab.
- **Recent Activity**: Compact feed, newest first. Click "View All" → Activity tab.
- **Tabs**: Sticky under header; Overview is default.

---

### Screen 3: Tenant Detail — Activity Tab

```
+----------------------------------------------------------------------------------+
| Acme Grocery                                                               […]   |
+----------------------------------------------------------------------------------+
| Overview | Activity (active) | Tickets | Transactions | Tasks | Contacts          |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  [All] [Notes] [Calls] [Emails] [System]                            [+ Add Note] |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Today  10:42a    Jane (Support)          [Note]                           |  |
|  |  "Called Jane about the failed payment. She will retry with new card."     |  |
|  |  [Edit] [Delete]                                        Internal             |  |
|  +----------------------------------------------------------------------------+  |
|  |  Today   9:15a    System                  [Ticket]                         |  |
|  |  Ticket #2042 created — "Payment failed" — assigned to Mike                  |  |
|  +----------------------------------------------------------------------------+  |
|  |  Yesterday        Mike (Ops)              [Task]                           |  |
|  |  Task "Onboarding call" completed.                                         |  |
|  +----------------------------------------------------------------------------+  |
|  |  Jun 4  2:00p     Jane (Support)          [Call]                           |  |
|  |  Duration 12m. Discussed refund policy.                                    |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  | [Write a note...                                ]  [Post]  [☐ Internal]    |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

- **Sub-filters**: Chip-style toggle filters (All / Notes / Calls / Emails / System).
- **Feed items**: Each item shows timestamp, actor avatar+name, activity type badge, content, and actions (Edit/Delete for user's own notes).
- **Inline composer**: Fixed at bottom of feed. Textarea expands on focus. Checkbox for "Internal" (hidden from any future customer-facing views).

---

### Screen 4: Requests Hub (Unified Inbox)

```
+----------------------------------------------------------------------------------+
| Requests Hub                                                                  38 |
+----------------------------------------------------------------------------------+
| [Type: All ▼] [Status: Open ▼] [Priority: All ▼] [Assigned: Me ▼] [Tenant ▼]   |
| [Unread] [Tickets] [Tasks] [Inquiries]                                        [Mark All Read]
+----------------------------------------------------------------------------------+
| Type | Tenant            | Title / Summary              | Priority | Age  | Actions |
|------|-------------------|------------------------------|----------|------|---------|
| 🎫   | Acme Grocery      | Payment failed               | High     | 2h   | [View] [Assign]
| 📋   | BrightMart        | Refund approval              | Medium   | 3h   | [View] [Assign]
| 🎫   | Corner Deli       | Duplicate charge             | Urgent   | 5h   | [View] [Assign]
| 💬   | Downtown Pharmacy | "Can you add organic eggs?"  | Low      | 1d   | [View] [Assign]
| 📋   | Acme Grocery      | Onboarding call              | High     | 1d   | [View] [Assign]
| ...                                                                              |
+----------------------------------------------------------------------------------+
```

- **Purpose**: One screen to see *everything* a tenant has asked for — no digging into individual tenant tabs.
- **Type icons**: 🎫 Ticket | 📋 Task | 💬 General Inquiry.
- **Default filter for Support/Ops**: `Status: Open` + `Assigned: Me`.
- **Quick filters**: Chip toggles for Unread, Tickets-only, Tasks-only, Inquiries-only.
- **Row click**: Navigates to `Tenant Detail` → the relevant tab (Tickets / Tasks / Activity) with the item pre-selected.
- **Inline actions**: `[Assign]` opens a quick-assign popover; `[Status]` opens a mini-menu (Open → In Progress → Resolved).
- **Bulk select**: Checkbox per row → bulk assign, bulk status change, bulk mark-read.
- **Unread indicator**: Bold row + blue dot on the left edge; cleared on first view or explicit "Mark Read".
- **Create**: "+ Request" button opens a modal to pick type (Ticket / Task / Inquiry) + tenant + details.

---

### Screen 5: Global Tickets Queue

```
+----------------------------------------------------------------------------------+
| Tickets                                                                       38 |
+----------------------------------------------------------------------------------+
| [Status: Open ▼] [Priority: All ▼] [Assigned: Me ▼] [Tenant: All ▼]  [+ Ticket]  |
+----------------------------------------------------------------------------------+
| ID       | Tenant            | Title                  | Priority | Status | Age   |
|----------|-------------------|------------------------|----------|--------|-------|
| #2042    | Acme Grocery      | Payment failed         | High     | Open   | 2h    |
| #2041    | BrightMart        | Need onboarding help   | Medium   | Open   | 5h    |
| #2039    | Corner Deli       | Duplicate charge       | Urgent   | Open   | 1d    |
| #2038    | Downtown Pharmacy | Request tier upgrade   | Low      | Open   | 2d    |
| ...                                                                              |
+----------------------------------------------------------------------------------+
```

- **Default filter for Support role**: `Assigned: Me` + `Status: Open`.
- **Row click**: Navigates to `Tenant Detail → Tickets Tab` with that ticket pre-selected/highlighted.
- **Create**: "+ Ticket" button opens a dialog to select tenant + fill title/description.

---

### Screen 6: Global Tasks Board

```
+----------------------------------------------------------------------------------+
| Tasks                                                                         12 |
+----------------------------------------------------------------------------------+
| [Assigned: Me ▼] [Priority: All ▼] [Tenant: All ▼]                    [+ Task]   |
+----------------------------------------------------------------------------------+
|  +---------------------+  +---------------------+  +-------------------------+   |
|  | PENDING   (4)       |  | IN PROGRESS (6)     |  | COMPLETED   (2)         |   |
|  +---------------------+  +---------------------+  +-------------------------+   |
|  | Onboarding call     |  | Refund approval     |  | Sync catalog            |   |
|  | Acme Grocery        |  | BrightMart          |  | Corner Deli             |   |
|  | Due: Today          |  | Due: Tomorrow       |  | Jun 3                   |   |
|  | [Assignee avatar]   |  | [Assignee avatar]   |  | [Assignee avatar]       |   |
|  +---------------------+  | Catalog update      |  +-------------------------+   |
|  | Upload logo         |  | Downtown Pharmacy   |                             |   |
|  | Corner Deli         |  | Due: Jun 7          |                             |   |
|  | Due: Jun 8          |  +---------------------+                             |   |
|  +---------------------+                                                        |   |
+----------------------------------------------------------------------------------+
```

- **Kanban columns**: Pending | In Progress | Completed.
- **Cards**: Task title, tenant name (linked), due date (red if overdue), assignee avatar.
- **Drag-and-drop** (optional v2): Move card across columns to update status. v1 can use status select inside the card detail drawer.
- **Click card**: Opens a side drawer (not a full page) with task details + edit form.

---

## Interaction & States

### Important States

- **Empty list**: "No tenants match your filters." with a "Clear Filters" CTA.
- **Empty Requests Hub**: "All caught up — no open requests." with a celebratory icon; hide bulk action bar.
- **Empty activity feed**: "No activity yet. Write the first note." with the composer still visible.
- **No permission**: If a user lacks `CAN_MANAGE_CRM_SUPPORT`, hide the "+ Ticket" and "Edit" buttons; show read-only badges. Do not redirect — let them see data.
- **Loading**: Skeleton rows for tables (5-7 shimmer rows). Skeleton cards for stats. Spinner for tab content switching.
- **Error**: Inline error banner at top of tab content; retry button. Do not block the entire page.
- **Overdue indicators**: Due dates past today render in red; overdue tasks sort to top of Pending.

### Core Interactions

- **Inline edit vs modal**: Notes use inline edit (click → textarea replaces text). Contacts use a modal form (fields are many). Ticket creation uses a modal. Task creation uses a side drawer.
- **Bulk actions** (v2): On Tenants List and Tickets Queue, support shift-click multi-select → bulk assign / status change / tag.
- **Filters**: Applied client-side for small sets (<200), server-side for global queues. Filter state synced to URL query params so back button and deep links work.
- **Search**: Tenants list search is debounced 300ms, server-side across name + email + contact names.
- **Assignment**: Ticket/task assignment uses an autocomplete combobox (search users by name/email). Unassigned state is explicit.
- **Status transitions**: Ticket status changes (Open → In Progress → Resolved → Closed) are logged automatically as system activities.
- **Keyboard shortcuts** (nice-to-have): `/` focuses search, `n` opens create-note, `t` opens create-ticket (when on tenant detail), `r` opens create-request (when on Requests Hub).

---

## Tenant-Scoped CRM Engagement Widget (Merchant-Facing)

A compact CRM panel lives on the **merchant dashboard** (`/t/[tenantId]/`) so tenants can see their open support items and platform interactions without leaving their own admin view.

### Location

- **Placement**: Right-hand side panel on the merchant dashboard, below "Quick Stats" or as a collapsible drawer.
- **Visibility**: Always visible to all tenant users (no RBAC gating — this is the merchant's own data).
- **Route**: Embedded as a widget; deep-link to full CRM view at `/t/[tenantId]/support` (if a detailed merchant-facing support page exists).

### ASCII Wireframe

```
+----------------------------------------------------------------------------------+
|  Support & Engagement                                                            |
|  [View All →]                                                                    |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  Open Tickets (2)                                          [+ New Ticket]       |
|  +----------------------------------------------------------------------------+  |
|  |  #2042  Payment failed          High   ·  2h ago   ·  [View]             |  |
|  |  Assigned to: Mike (Support)                                               |  |
|  +----------------------------------------------------------------------------+  |
|  |  #2039  Duplicate charge         Medium ·  1d ago   ·  [View]             |  |
|  |  Assigned to: Jane (Support)                                               |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Pending Tasks (1)                                                             |
|  +----------------------------------------------------------------------------+  |
|  |  Refund approval                 Due: Tomorrow  ·  [View]                 |  |
|  |  Assigned to: Ops team                                                     |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Recent Activity (3)                                          [View All →]     |
|  +----------------------------------------------------------------------------+  |
|  |  Today  10:42a   Mike (Support) — Note on #2042                            |  |
|  |  "Called about refund. Will retry with new card."                          |  |
|  +----------------------------------------------------------------------------+  |
|  |  Today   9:15a   System — Ticket #2042 created                             |  |
|  +----------------------------------------------------------------------------+  |
|  |  Yesterday       Jane (Support) — Task "Refund approval" assigned          |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

### Panel Sections

- **Open Tickets**: Top 2-3 tickets sorted by priority + age. Shows ID, title, priority badge, age, assignee. "+ New Ticket" opens a modal to create a support ticket directly from the merchant dashboard.
- **Pending Tasks**: Top 2 tasks sorted by due date. Shows title, due date (red if overdue), assignee.
- **Recent Activity**: Last 3-5 activity items (notes, status changes, task assignments). Excludes internal-only notes (`is_internal = false` filter).

### Interactions

- **New Ticket modal**: Inline form (title, description, priority). Submits to `POST /api/crm/tenants/:tenantId/tickets` via the merchant's authenticated session. Ticket is immediately visible in the panel.
- **View ticket**: Opens a side drawer (not full page) with ticket details, status, assigned platform user, and full activity thread.
- **View task**: Opens a side drawer with task details and due date.
- **Real-time updates**: Panel auto-refreshes every 60 seconds or on websocket push for status changes.
- **Collapsed state**: Panel can be minimized to a single line: "2 open tickets · 1 pending task · Last update 2h ago"

### Data Flow

```
Merchant Dashboard
  │
  ├─ GET /api/public/crm/tenant-self/tickets?status=open&limit=3
  ├─ GET /api/public/crm/tenant-self/tasks?status=pending&limit=2
  ├─ GET /api/public/crm/tenant-self/activities?limit=5&is_internal=false
  │
  └─ Response: JSON → Panel renders server-side or client-side
```

### Public API Endpoints (Tenant-Scoped)

These endpoints are scoped to the authenticated merchant's own tenant. No `tenantId` param needed — derived from JWT.

- `GET /api/public/crm/self/tickets?status=&limit=` — My tickets
- `GET /api/public/crm/self/tasks?status=&limit=` — My tasks
- `GET /api/public/crm/self/activities?limit=` — My activity feed (public-facing only)
- `POST /api/public/crm/self/tickets` — Create a ticket as a merchant
- `GET /api/public/crm/self/tickets/:ticketId` — Ticket detail with activity thread

---

## Persistence Requirement

This document is saved as:

`c:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\docs\CRM_UIUX_DESIGN.md`

Engineers and subagents should treat this as the canonical UI/UX reference for the CRM module.
