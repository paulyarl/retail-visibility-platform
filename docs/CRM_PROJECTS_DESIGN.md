# CRM Projects — Design Document

## Problem

The CRM's task and ticket system requires a `tenant_id` on every record. Internal cross-functional initiatives (e.g., PinTraffix asset production, platform migrations, marketing campaigns) have no natural tenant — they span the platform itself. The current workaround is to create a fake tenant, which pollutes the tenant registry, confuses RLS, and must be repeated for every new initiative.

## Solution

Add a `crm_projects` entity that groups tasks and tickets under a named project, independent of any tenant. Tasks and tickets can belong to either a tenant (existing behavior) or a project (new behavior), but not neither.

## Schema Changes

### New table: `crm_projects`

```sql
CREATE TABLE crm_projects (
  id          VARCHAR(255) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',  -- active | on_hold | completed | archived
  created_by  VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ
);

CREATE INDEX idx_crm_projects_status ON crm_projects(status);
CREATE INDEX idx_crm_projects_created_at ON crm_projects(created_at);
```

### Alter `crm_tasks`

```sql
-- Add project_id column
ALTER TABLE crm_tasks ADD COLUMN project_id VARCHAR(255);

-- Make tenant_id nullable (was NOT NULL)
ALTER TABLE crm_tasks ALTER COLUMN tenant_id DROP NOT NULL;

-- Add FK to crm_projects
ALTER TABLE crm_tasks
  ADD CONSTRAINT fk_crm_tasks_project
  FOREIGN KEY (project_id) REFERENCES crm_projects(id) ON DELETE SET NULL ON UPDATE NO ACTION;

-- Add index for project-scoped queries
CREATE INDEX idx_crm_tasks_project_id ON crm_tasks(project_id);

-- Add CHECK constraint: must have either tenant_id or project_id
ALTER TABLE crm_tasks
  ADD CONSTRAINT chk_crm_tasks_owner
  CHECK (tenant_id IS NOT NULL OR project_id IS NOT NULL);
```

### Alter `crm_support_tickets`

```sql
-- Add project_id column
ALTER TABLE crm_support_tickets ADD COLUMN project_id VARCHAR(255);

-- Make tenant_id nullable (was NOT NULL)
ALTER TABLE crm_support_tickets ALTER COLUMN tenant_id DROP NOT NULL;

-- Add FK to crm_projects
ALTER TABLE crm_support_tickets
  ADD CONSTRAINT fk_crm_tickets_project
  FOREIGN KEY (project_id) REFERENCES crm_projects(id) ON DELETE SET NULL ON UPDATE NO ACTION;

-- Add index for project-scoped queries
CREATE INDEX idx_crm_tickets_project_id ON crm_support_tickets(project_id);

-- Add CHECK constraint: must have either tenant_id or project_id
ALTER TABLE crm_support_tickets
  ADD CONSTRAINT chk_crm_tickets_owner
  CHECK (tenant_id IS NOT NULL OR project_id IS NOT NULL);
```

### Alter `crm_activities`

```sql
-- Add project_id column
ALTER TABLE crm_activities ADD COLUMN project_id VARCHAR(255);

-- Make tenant_id nullable (was NOT NULL)
ALTER TABLE crm_activities ALTER COLUMN tenant_id DROP NOT NULL;

-- Add FK to crm_projects
ALTER TABLE crm_activities
  ADD CONSTRAINT fk_crm_activities_project
  FOREIGN KEY (project_id) REFERENCES crm_projects(id) ON DELETE SET NULL ON UPDATE NO ACTION;

-- Add index for project-scoped queries
CREATE INDEX idx_crm_activities_project_id ON crm_activities(project_id);
```

> **Note on `crm_activities`:** No CHECK constraint here because activities can have neither tenant_id nor project_id (e.g., global admin actions). The existing behavior is preserved — tenant-scoped activities still set `tenant_id`. Project-scoped activities set `project_id` and leave `tenant_id` NULL.

### RLS considerations

- `crm_projects` — no RLS needed (admin-only table)
- `crm_tasks` / `crm_support_tickets` / `crm_activities` — existing RLS policies reference `tenant_id`. Rows with NULL `tenant_id` will not match tenant-scoped RLS policies, which is correct: project tasks are admin-only and accessed via the admin connection (bypasses RLS). No RLS policy changes needed.

### ID generation

New function in `id-generator.ts`:

```typescript
// Format: crmproj-{nanoid} (16 chars)
export function generateCrmProjectId(): string {
  const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyz', 8);
  return `crmproj-${nanoid()}`;
}
```

Task and ticket ID generators currently require `tenantId` for the tenant key prefix. For project-scoped tasks/tickets, pass a placeholder like `'project'`:

```typescript
// Existing: generateCrmTaskId(tenantId) → crmtask-{tenantKey}-{nanoid}
// Project:  generateCrmTaskId('project') → crmtask-project-{nanoid}
```

No change to the function signature — just pass `'project'` as the tenantId argument when creating project-scoped tasks/tickets.

## Prisma Schema

Add to `apps/api/prisma/schema.prisma`:

```prisma
model crm_projects {
  id          String    @id
  name        String    @db.VarChar(255)
  description String?
  status      String    @default("active") @db.VarChar(20)
  created_by  String    @db.VarChar(255)
  created_at  DateTime  @default(now()) @db.Timestamptz(6)
  updated_at  DateTime  @default(now()) @db.Timestamptz(6)
  closed_at   DateTime? @db.Timestamptz(6)
  crm_tasks             crm_tasks[]
  crm_support_tickets   crm_support_tickets[]
  crm_activities        crm_activities[]

  @@index([status], map: "idx_crm_projects_status")
  @@index([created_at], map: "idx_crm_projects_created_at")
}
```

Update existing models:

```prisma
model crm_tasks {
  // ... existing fields ...
  tenant_id         String?             @db.VarChar(255)   // changed: was String (not nullable)
  project_id        String?             @db.VarChar(255)   // new
  // ... existing relations ...
  crm_projects      crm_projects?       @relation(fields: [project_id], references: [id], onDelete: SetNull, onUpdate: NoAction, map: "fk_crm_tasks_project")

  // ... existing indexes ...
  @@index([project_id], map: "idx_crm_tasks_project_id")
}

model crm_support_tickets {
  // ... existing fields ...
  tenant_id         String?             @db.VarChar(255)   // changed: was String (not nullable)
  project_id        String?             @db.VarChar(255)   // new
  // ... existing relations ...
  crm_projects      crm_projects?       @relation(fields: [project_id], references: [id], onDelete: SetNull, onUpdate: NoAction, map: "fk_crm_tickets_project")

  // ... existing indexes ...
  @@index([project_id], map: "idx_crm_tickets_project_id")
}

model crm_activities {
  // ... existing fields ...
  tenant_id         String?             @db.VarChar(255)   // changed: was String (not nullable)
  project_id        String?             @db.VarChar(255)   // new
  // ... existing relations ...
  crm_projects      crm_projects?       @relation(fields: [project_id], references: [id], onDelete: SetNull, onUpdate: NoAction, map: "fk_crm_activities_project")

  // ... existing indexes ...
  @@index([project_id], map: "idx_crm_activities_project_id")
}
```

## Backend

### New service: `CrmProjectService.ts`

```typescript
export class CrmProjectService extends BaseService {
  // Singleton pattern

  async list(filters: { status?: string } = {}): Promise<crm_projects[]>;
  async getById(projectId: string): Promise<crm_projects | null>;
  async create(data: {
    name: string;
    description?: string;
    created_by: string;
  }): Promise<crm_projects>;
  async update(projectId: string, data: {
    name?: string;
    description?: string;
    status?: string;
  }): Promise<crm_projects>;
  async delete(projectId: string): Promise<void>;
  async getStats(projectId: string): Promise<{
    total_tasks: number;
    pending_tasks: number;
    in_progress_tasks: number;
    completed_tasks: number;
    total_tickets: number;
    open_tickets: number;
  }>;
}
```

### Update `CrmTaskService`

- `listGlobal()` — add optional `projectId` filter
- `create()` — accept optional `project_id` instead of `tenant_id` (validate that at least one is set)
- `update()` — when auto-logging activities, use `project_id` if `tenant_id` is null

### Update `CrmTicketService`

- `listGlobal()` — add optional `projectId` filter
- `create()` — accept optional `project_id` instead of `tenant_id`
- `update()` — when auto-logging activities, use `project_id` if `tenant_id` is null

### Update `CrmActivityService`

- `listGlobal()` — add optional `projectId` filter
- `create()` — accept optional `project_id` instead of `tenant_id`

### New API routes (in `crm-admin.ts`)

```
GET    /api/admin/crm/projects              — list projects (optional ?status= filter)
POST   /api/admin/crm/projects              — create project
GET    /api/admin/crm/projects/:projectId    — get project detail + stats
PUT    /api/admin/crm/projects/:projectId    — update project
DELETE /api/admin/crm/projects/:projectId    — delete project (sets project_id to NULL on tasks/tickets via SET NULL)

GET    /api/admin/crm/projects/:projectId/tasks    — list tasks for project
GET    /api/admin/crm/projects/:projectId/tickets  — list tickets for project
GET    /api/admin/crm/projects/:projectId/activities — list activities for project
```

### Update existing task/ticket routes

- `POST /api/admin/crm/tasks` — accept `project_id` in body as alternative to `tenant_id`
- `GET /api/admin/crm/tasks` — accept `?projectId=` query param
- `POST /api/admin/crm/tickets` (tenant-scoped) — no change
- `GET /api/admin/crm/tickets` — accept `?projectId=` query param

## Frontend

### New types (in `types/crm.ts`)

```typescript
export type ProjectStatus = 'active' | 'on_hold' | 'completed' | 'archived';

export interface CrmProject {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  created_by: string;
  created_at: string;
  updated_at: string;
  closed_at: string | null;
}

export interface CrmProjectDetail extends CrmProject {
  stats: {
    total_tasks: number;
    pending_tasks: number;
    in_progress_tasks: number;
    completed_tasks: number;
    total_tickets: number;
    open_tickets: number;
  };
}

export interface CreateProjectInput {
  name: string;
  description?: string;
}

export interface UpdateProjectInput {
  name?: string;
  description?: string;
  status?: ProjectStatus;
}
```

Update existing types:

```typescript
export interface CrmTask {
  // ... existing fields ...
  tenant_id: string | null;   // changed: was string
  project_id: string | null;  // new
}

export interface CreateTaskInput {
  tenant_id?: string;          // changed: was required
  project_id?: string;         // new
  title: string;
  // ... rest unchanged ...
}

export interface CrmTicket {
  // ... existing fields ...
  tenant_id: string | null;   // changed: was string
  project_id: string | null;  // new
}

export interface CreateTicketInput {
  tenant_id?: string;          // already optional
  project_id?: string;         // new
  // ... rest unchanged ...
}
```

### Update `CrmAdminService`

Add methods:

```typescript
// --- Projects ---
async listProjects(filters?: { status?: string }): Promise<CrmProject[]>;
async createProject(data: CreateProjectInput): Promise<CrmProject>;
async updateProject(projectId: string, data: UpdateProjectInput): Promise<CrmProject>;
async deleteProject(projectId: string): Promise<void>;
async getProjectDetail(projectId: string): Promise<CrmProjectDetail>;

// Update existing methods to accept projectId filter
async listTasks(filters?: { ...; projectId?: string }): Promise<CrmTask[]>;
async listGlobalTickets(filters?: { ...; projectId?: string }): Promise<CrmTicket[]>;
```

Add `'crm-projects'` to `getServiceCachePatterns()`.

### New pages

1. **Projects list page** — `apps/web/src/app/(platform)/settings/admin/crm/projects/page.tsx`
   - Grid of project cards with name, description, status badge, task counts
   - "+ Create Project" button
   - Filter by status
   - Click card → project detail page

2. **Project detail page** — `apps/web/src/app/(platform)/settings/admin/crm/projects/[projectId]/page.tsx`
   - Project header with name, description, status, edit/delete actions
   - Stats summary (task counts, ticket counts)
   - Tabs: Tasks (Kanban), Tickets (table), Activities (timeline)
   - "+ Create Task" modal with `project_id` pre-set (no tenant selector)

### Update existing pages

3. **Global Tasks Kanban** — `apps/web/src/app/(platform)/settings/admin/crm/tasks/page.tsx`
   - Add "Project" filter dropdown alongside the existing "Status" filter
   - When a project is selected, show only tasks for that project
   - Create Task modal: add Project selector as alternative to Tenant selector (if project selected, hide tenant selector)

4. **Global Tickets** — `apps/web/src/app/(platform)/settings/admin/crm/tickets/page.tsx`
   - Add "Project" filter dropdown
   - Show project name column when project_id is set (instead of tenant name)

5. **CRM landing/dashboard** — add "Projects" card/section linking to the projects page

### Navigation

Add "Projects" to the CRM navigation in `CrmPageShell` or wherever the CRM section nav lives:

```
Settings > Admin > CRM
  ├── Dashboard
  ├── Tenants
  ├── Tasks
  ├── Tickets
  ├── Projects    ← NEW
  └── Requests Hub
```

## Migration

File: `database/migrations/127_crm_projects.sql`

```sql
-- 127_crm_projects.sql
-- Add crm_projects table and project_id columns to crm_tasks, crm_support_tickets, crm_activities

BEGIN;

-- 1. Create crm_projects table
CREATE TABLE IF NOT EXISTS crm_projects (
  id          VARCHAR(255) PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  status      VARCHAR(20) NOT NULL DEFAULT 'active',
  created_by  VARCHAR(255) NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_crm_projects_status ON crm_projects(status);
CREATE INDEX IF NOT EXISTS idx_crm_projects_created_at ON crm_projects(created_at);

-- 2. Add project_id to crm_tasks and make tenant_id nullable
ALTER TABLE crm_tasks ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);
ALTER TABLE crm_tasks ALTER COLUMN tenant_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE crm_tasks
    ADD CONSTRAINT fk_crm_tasks_project
    FOREIGN KEY (project_id) REFERENCES crm_projects(id) ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_project_id ON crm_tasks(project_id);

DO $$ BEGIN
  ALTER TABLE crm_tasks
    ADD CONSTRAINT chk_crm_tasks_owner
    CHECK (tenant_id IS NOT NULL OR project_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 3. Add project_id to crm_support_tickets and make tenant_id nullable
ALTER TABLE crm_support_tickets ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);
ALTER TABLE crm_support_tickets ALTER COLUMN tenant_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE crm_support_tickets
    ADD CONSTRAINT fk_crm_tickets_project
    FOREIGN KEY (project_id) REFERENCES crm_projects(id) ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_crm_tickets_project_id ON crm_support_tickets(project_id);

DO $$ BEGIN
  ALTER TABLE crm_support_tickets
    ADD CONSTRAINT chk_crm_tickets_owner
    CHECK (tenant_id IS NOT NULL OR project_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Add project_id to crm_activities and make tenant_id nullable
ALTER TABLE crm_activities ADD COLUMN IF NOT EXISTS project_id VARCHAR(255);
ALTER TABLE crm_activities ALTER COLUMN tenant_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE crm_activities
    ADD CONSTRAINT fk_crm_activities_project
    FOREIGN KEY (project_id) REFERENCES crm_projects(id) ON DELETE SET NULL ON UPDATE NO ACTION;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_crm_activities_project_id ON crm_activities(project_id);

COMMIT;
```

## Implementation Phases

### Phase 1: Backend (migration + service + routes)
- Migration `127_crm_projects.sql`
- Prisma schema update + `prisma generate` + `prisma db pull`
- `CrmProjectService.ts`
- `generateCrmProjectId()` in `id-generator.ts`
- Update `CrmTaskService` — project_id in create/list, activity logging with null tenant_id
- Update `CrmTicketService` — same pattern
- Update `CrmActivityService` — project_id in create/list
- New project routes in `crm-admin.ts`
- Update task/ticket routes to accept `project_id`
- Verify: `pnpm checkapi` passes with zero TS errors

### Phase 2: Frontend (types + service + pages)
- Update `types/crm.ts` — add project types, make `tenant_id` nullable on Task/Ticket
- Update `CrmAdminService.ts` — add project methods, update task/ticket methods
- New projects list page
- New project detail page with Kanban + tickets + activities tabs
- Update global tasks page — add project filter, update create modal
- Update global tickets page — add project filter
- Add "Projects" to CRM navigation
- Verify: `pnpm checkweb` passes with zero TS errors

### Phase 3: Asset Production Guide Update
- Update `ASSET_PRODUCTION_USER_GUIDE.md` Section 12 to reference projects instead of fake tenants
- Update task creation templates to use `project_id` instead of `tenant_id`

## Backward Compatibility

- All existing tenant-scoped tasks, tickets, and activities continue to work unchanged
- `tenant_id` is now nullable but existing rows all have values — no data migration needed
- Existing API routes that require `tenant_id` in the body still work (the body field is still accepted)
- The new `project_id` field is optional — if not provided, behavior is identical to before
- The CHECK constraint ensures new rows must have either `tenant_id` or `project_id` — no orphaned tasks/tickets

## Files to Create

| File | Purpose |
|---|---|
| `database/migrations/127_crm_projects.sql` | Schema migration |
| `apps/api/src/services/CrmProjectService.ts` | Project CRUD service |
| `apps/web/src/app/(platform)/settings/admin/crm/projects/page.tsx` | Projects list page |
| `apps/web/src/app/(platform)/settings/admin/crm/projects/[projectId]/page.tsx` | Project detail page |

## Files to Modify

| File | Changes |
|---|---|
| `apps/api/prisma/schema.prisma` | Add `crm_projects` model, add `project_id` to 3 models, make `tenant_id` nullable on 3 models |
| `apps/api/src/lib/id-generator.ts` | Add `generateCrmProjectId()` |
| `apps/api/src/services/CrmTaskService.ts` | Accept `project_id` in create, add `projectId` filter to `listGlobal`, handle null tenant_id in activity logging |
| `apps/api/src/services/CrmTicketService.ts` | Same pattern as CrmTaskService |
| `apps/api/src/services/CrmActivityService.ts` | Accept `project_id` in create, add `projectId` filter to `listGlobal` |
| `apps/api/src/routes/crm/admin/crm-admin.ts` | Add project CRUD routes, update task/ticket routes to accept `project_id` |
| `apps/web/src/types/crm.ts` | Add project types, make `tenant_id` nullable on Task/Ticket, add `project_id` field |
| `apps/web/src/services/crm/CrmAdminService.ts` | Add project methods, update task/ticket list methods with `projectId` filter |
| `apps/web/src/app/(platform)/settings/admin/crm/tasks/page.tsx` | Add project filter, update create modal with project/tenant toggle |
| `apps/web/src/app/(platform)/settings/admin/crm/tickets/page.tsx` | Add project filter, show project name column |
| `apps/web/src/components/crm/CrmPageShell.tsx` | Add "Projects" nav link |

## Verification

```bash
# Backend
pnpm checkapi

# Frontend
pnpm checkweb

# Manual test flow:
# 1. Create a project "PinTraffix" via API or UI
# 2. Create a task with project_id (no tenant_id)
# 3. Verify task appears in global task list with project filter
# 4. Verify Kanban board shows project tasks when filtered
# 5. Verify activity log records the task creation with project_id
# 6. Verify existing tenant-scoped tasks still work unchanged
```
