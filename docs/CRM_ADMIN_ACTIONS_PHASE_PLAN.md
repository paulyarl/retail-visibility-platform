# CRM Admin Actions — Phase Plan

## Current State

The CRM admin backend (`/api/admin/crm/*`) already exposes full CRUD endpoints for tickets, tasks, contacts, activities, inquiries, and alerts. The frontend `CrmAdminService` also has all the write methods implemented.

**However**, every admin CRM page is read-only — displaying tables and Kanban columns with no action buttons, inline edits, or creation forms. Admins can view but cannot act through the UI.

### Existing Backend Write Endpoints (unused by frontend)

| Entity | Create | Update | Delete | Special |
|--------|--------|--------|--------|---------|
| Tickets | `POST /tenants/:id/tickets` | `PUT /tickets/:id` | — | Messages, reorder |
| Tasks | `POST /tasks` | `PUT /tasks/:id` | `DELETE /tasks/:id` | Reorder |
| Contacts | `POST /tenants/:id/contacts` | `PUT /contacts/:id` | `DELETE /contacts/:id` | — |
| Activities | `POST /tenants/:id/activities` | — | — | Append-only |
| Inquiries | `POST /tenants/:id/inquiries` | `PUT /inquiries/:id` | — | — |
| Alerts | `POST /alerts` | — | — | Broadcast, mark read |
| Requests | — | `PATCH /requests/:id` | — | Mark read, mark all read |

---

## Phase 5A — Ticket Actions

**Goal**: Enable admins to triage, respond to, and manage tickets end-to-end from the CRM UI.

### 5A.1 — Ticket Detail Page (new route)

Create `/settings/admin/crm/tickets/[ticketId]/page.tsx` — a dedicated ticket detail view:

- **Header**: ticket title, tenant link, status badge, priority badge, assigned-to
- **Status dropdown**: inline `<select>` to change status (open → in_progress → waiting → resolved → closed)
  - Calls `crmAdminService.updateTicket(ticketId, { status })`
  - Auto-logs activity via backend (already handled in `CrmTicketService.update`)
- **Priority dropdown**: inline `<select>` to escalate/de-escalate
  - Calls `crmAdminService.updateTicket(ticketId, { priority })`
- **Assign dropdown**: assign to a platform admin user
  - Calls `crmAdminService.updateTicket(ticketId, { assigned_to })`
  - Populate dropdown from admin users list (existing `/api/admin/users` endpoint)
- **Category dropdown**: set/change ticket category
  - Calls `crmAdminService.updateTicket(ticketId, { category })`

### 5A.2 — Ticket Messages / Conversation Thread

Within ticket detail page, add a message thread section:

- **Message list**: display all messages (public + internal notes) using `crmAdminService.listTicketMessages(ticketId)`
  - Visually distinguish internal notes (yellow/left-aligned) from public replies (white/right-aligned)
  - Show author name, author type badge (platform/tenant/customer), timestamp
- **Reply form**: textarea + "Reply" button
  - Calls `crmAdminService.createTicketMessage(ticketId, { content, is_internal: false })`
  - Reply is visible to tenant/customer
- **Internal note form**: textarea + "Add Internal Note" button
  - Calls `crmAdminService.createTicketMessage(ticketId, { content, is_internal: true })`
  - Note is admin-only (default for platform actor)

### 5A.3 — Create Ticket from Tenant Detail

On tenant detail page (`tenants/[tenantId]`), add a "Create Ticket" button in the Tickets tab:

- Opens a modal/sheet form with fields: title, description, priority, category, assigned_to
- Calls `crmAdminService.createTicket(tenantId, data)`
- Refreshes ticket list on success

### 5A.4 — Inline Quick Actions on Ticket Rows

On the global tickets list page (`tickets/page.tsx`) and tenant detail tickets tab:

- Add a kebab menu (⋮) or action buttons per row:
  - **Assign to me**: `updateTicket(id, { assigned_to: currentAdminId })`
  - **Change status**: quick status cycle (open → in_progress → resolved)
  - **View detail**: navigate to ticket detail page

### 5A.5 — Ticket Link from Requests Hub

On the Requests Hub page, make ticket-type requests link to the new ticket detail page instead of the tenant detail page.

---

## Phase 5B — Task Actions

**Goal**: Enable admins to create, assign, and progress tasks — the primary work-tracking mechanism for platform staff.

### 5B.1 — Create Task Form

Add a "Create Task" button on:

- **Global Tasks page** (`tasks/page.tsx`): opens modal with tenant selector + full form
- **Tenant detail Tasks tab**: pre-fills tenant_id, opens modal with title, description, priority, due_date, assigned_to
- **Ticket detail page** (Phase 5A): "Create Task from Ticket" button — pre-fills tenant_id, title from ticket, links task to ticket via activity log

Form calls `crmAdminService.createTask(data)`.

### 5B.2 — Inline Task Status Changes

On the global tasks Kanban and tenant detail tasks tab:

- **Drag-and-drop** between Kanban columns (pending → in_progress → completed → cancelled)
  - On drop: calls `crmAdminService.updateTask(taskId, { status: newStatus })`
- **Quick status buttons** per task card: cycle status forward
- **Assign to me** button: `updateTask(taskId, { assigned_to: currentAdminId })`

### 5B.3 — Task Edit & Delete

- **Edit action**: opens modal pre-filled with task data, calls `crmAdminService.updateTask(taskId, data)`
  - Editable fields: title, description, priority, due_date, assigned_to, contact_id
- **Delete action**: confirmation dialog, calls `crmAdminService.deleteTask(taskId)`
  - Only available for tasks not linked to an active ticket (guard in UI, not backend)

### 5B.4 — Task Detail Panel

Optional expandable panel or dedicated route for task detail showing:

- Full description, due date, assigned admin, linked ticket/contact
- Activity log entries related to this task
- Quick edit form

---

## Phase 5C — Tenant & Alert Actions

**Goal**: Enable admins to proactively engage with tenants through alerts, notes, and quick administrative actions.

### 5C.1 — Send Alert to Tenant

On tenant detail page, add "Send Alert" button in Overview tab:

- Modal form with fields: type (dropdown: info/warning/milestone/subscription), title, body, icon (emoji picker)
- Calls `crmAdminService.createAlert({ tenant_id, type, title, body, icon })`
  - Note: `createAlert` method needs to be added to `CrmAdminService` (backend route exists at `POST /api/admin/crm/alerts`)

### 5C.2 — Broadcast Alert

Add a "Broadcast Alert" page or button accessible from the CRM dashboard:

- Form with: tenant multi-select (or "all active tenants"), type, title, body, icon
- Calls `crmAdminService.broadcastAlert({ tenant_ids, type, title, body, icon })`
  - Note: `broadcastAlert` method needs to be added to `CrmAdminService` (backend route exists at `POST /api/admin/crm/alerts/broadcast`)

### 5C.3 — Add Internal Note to Tenant

On tenant detail Activity tab, add "Add Note" button:

- Simple textarea form
- Calls `crmAdminService.createActivity(tenantId, { activity_type: 'note', content, is_internal: true })`
- Note appears in activity feed with "Internal" badge

### 5C.4 — Tenant Quick Actions

On tenant detail Overview tab, add a "Quick Actions" dropdown:

- **Escalate service level**: creates an activity log entry + alert to tenant
- **Flag for review**: creates an internal activity + task assigned to admin
- **Extend trial**: (future — requires billing integration, placeholder for now)

### 5C.5 — Contact Management

On tenant detail Contacts tab, add:

- **Add Contact** button: modal form calling `crmAdminService.createContact(tenantId, data)`
- **Edit Contact** button per row: inline edit or modal calling `crmAdminService.updateContact(contactId, data)`
- **Delete Contact** button per row: confirmation dialog calling `crmAdminService.deleteContact(contactId)`

---

## Phase 5D — Bulk Operations & Workflow Automation

**Goal**: Scale admin efficiency with bulk actions, auto-assignment, and SLA enforcement.

### 5D.1 — Bulk Status Updates

On tickets, tasks, and requests hub pages:

- Add checkbox column for multi-select
- Bulk action bar appears when items selected: "Assign to...", "Set status...", "Mark read"
- Batch calls to existing update endpoints

### 5D.2 — Auto-Assignment Rules

Backend service that auto-assigns incoming tickets/tasks based on rules:

- Round-robin among available admins
- Category-based routing (e.g., billing tickets → specific admin)
- Tenant-tier based routing (enterprise → senior staff)

New table: `crm_assignment_rules` with columns: id, rule_type, match_criteria (jsonb), assign_to, is_active, created_at.

### 5D.3 — SLA Tracking

Add SLA fields to tickets:

- `sla_response_due_at`: timestamp for first response deadline
- `sla_resolution_due_at`: timestamp for resolution deadline
- SLA thresholds configurable per tenant tier (enterprise = faster)

Dashboard stats enhancement: show SLA breach count, at-risk tickets.

### 5D.4 — Ticket → Task Conversion Flow

Formalize the "create task from ticket" pattern:

- On ticket detail page, "Create Task" button pre-fills task with ticket context
- Backend creates task + links via activity log (already supported)
- Ticket status auto-changes to `waiting` when task is created (configurable)

### 5D.5 — CRM Dashboard Analytics Enhancement

Expand the dashboard stats card to include:

- Ticket volume trend (7-day sparkline)
- Average time to first response
- Average time to resolution
- Task completion rate
- SLA breach percentage
- Per-admin workload distribution

---

## Phase 5E — Inquiry & Advanced Workflow

**Goal**: Complete the inquiry management loop and add advanced workflow features.

### 5E.1 — Inquiry Actions

On tenant detail and requests hub for inquiry-type items:

- **Update inquiry status**: inline dropdown calling `crmAdminService.updateInquiry(inquiryId, { status })`
- **Assign inquiry**: dropdown calling `crmAdminService.updateInquiry(inquiryId, { assigned_to })`
- **Reply to inquiry**: form calling `crmAdminService.createInquiry()` for follow-up or using activity log

### 5E.2 — Ticket Merging

When duplicate tickets are identified:

- Select primary ticket, merge secondary into it
- Backend: copy messages from secondary to primary, close secondary as "merged"
- New endpoint: `POST /api/admin/crm/tickets/:id/merge` with `{ merge_from_id }`

### 5E.3 — Canned Responses / Templates

Admin-configurable reply templates for common ticket categories:

- New table: `crm_response_templates` (id, title, body, category, created_by, created_at)
- Template selector in reply form
- CRUD page at `/settings/admin/crm/templates`

### 5E.4 — Internal @Mentions

In message/note forms, allow `@username` mentions of other admins:

- Parses mentions, creates linked activity entries
- Future: notification delivery to mentioned admin

---

## Implementation Priority & Dependencies

```
Phase 5A (Tickets)  ──→  Phase 5B (Tasks)  ──→  Phase 5C (Tenants/Alerts)
   │                        │                        │
   └────────────────────────┴────────────────────────┘
                         │
                    Phase 5D (Bulk/Workflow)
                         │
                    Phase 5E (Advanced)
```

- **5A is first** because tickets are the primary support channel and the most impactful read-only gap
- **5B depends on 5A** because task creation from tickets is a core workflow
- **5C can partially overlap 5B** — contact management and alerts are independent
- **5D requires 5A+5B+5C** complete for bulk operations to make sense
- **5E is lowest priority** — nice-to-have features that build on the action infrastructure

## Frontend Service Gaps

The following `CrmAdminService` methods need to be added (backend routes already exist):

| Method | Backend Endpoint |
|--------|-----------------|
| `createAlert(data)` | `POST /api/admin/crm/alerts` |
| `broadcastAlert(data)` | `POST /api/admin/crm/alerts/broadcast` |
| `listGlobalInquiries(filters)` | `GET /api/admin/crm/inquiries` |
| `deleteTicket(ticketId)` | Not yet on backend — needs new route |
| `mergeTickets(primaryId, secondaryId)` | Not yet on backend — needs new route + service |

## Estimated Scope Per Phase

| Phase | New Pages | Modified Pages | New Backend | Estimated Effort |
|-------|-----------|----------------|-------------|-------------------|
| 5A | 1 (ticket detail) | 3 (tickets list, tenant detail, requests hub) | 0 | 2-3 days |
| 5B | 0 | 2 (tasks page, tenant detail) | 0 | 1-2 days |
| 5C | 0 | 1 (tenant detail) | 0 | 1-2 days |
| 5D | 0 | 4 (all list pages + dashboard) | 2 new tables | 3-4 days |
| 5E | 1 (templates) | 2 (ticket detail, requests hub) | 1 new table + 2 routes | 2-3 days |
