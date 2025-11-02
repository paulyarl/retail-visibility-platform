# RVP Master Spec — v3.7/3.8 Unified (Category + Hours + Scanning)

This addendum captures the Business Hours mirror strategy (GBP) and associated API contracts, alongside the unified category and scanning scope.

## Business Hours Mirror Strategy

- mirror_strategy (enum)
  - platform_is_source (default): RVP is SoT; GBP reflects platform.
  - gbp_is_source_bootstrap (optional): one-time import from GBP to seed platform, then switch to platform_is_source.
- Flag: FF_TENANT_GBP_HOURS_SYNC (pilot)
- Behavior
  - On platform edit: enqueue GBP hours update with retries/backoff, audit `gbp.hours.update`.
  - Out-of-sync detection: diff GBP vs platform; warning UI with "Mirror Now" CTA.
  - No automatic GBP pull in default mode.

## Data Model (Hours)

- business_hours (weekly grid): tenant_id, timezone, periods JSON, last_synced_at, source_hash
- special_hours (overrides): tenant_id, date, open/closed, start/end, note, last_synced_at

## OpenAPI (Gated by FF_TENANT_GBP_HOURS_SYNC)

```yaml
openapi: 3.0.3
info: { title: RVP GBP Hours, version: v1 }
paths:
  /tenant/{tenant_id}/business-hours:
    get:
      summary: Get tenant business hours
      parameters: [{ in: path, name: tenant_id, schema: { type: string, format: uuid }, required: true }]
      responses: { "200": { description: OK } }
    put:
      summary: Update tenant business hours (platform is SoT)
      parameters: [{ in: path, name: tenant_id, schema: { type: string, format: uuid }, required: true }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, properties: { timezone: { type: string }, periods: { type: array, items: { type: object } } } }
      responses: { "200": { description: Updated } }

  /tenant/{tenant_id}/business-hours/special:
    get:
      summary: Get special (holiday) hours
      parameters: [{ in: path, name: tenant_id, schema: { type: string, format: uuid }, required: true }]
      responses: { "200": { description: OK } }
    put:
      summary: Update special (holiday) hours
      parameters: [{ in: path, name: tenant_id, schema: { type: string, format: uuid }, required: true }]
      requestBody:
        required: true
        content:
          application/json:
            schema: { type: object, properties: { overrides: { type: array, items: { type: object } } } }
      responses: { "200": { description: Updated } }

  /tenant/{tenant_id}/gbp/hours/mirror:
    post:
      summary: Mirror platform hours to GBP (gated by FF_TENANT_GBP_HOURS_SYNC)
      parameters: [{ in: path, name: tenant_id, schema: { type: string, format: uuid }, required: true }]
      requestBody:
        required: false
        content:
          application/json:
            schema: { type: object, properties: { dry_run: { type: boolean, default: false } } }
      responses:
        "202": { description: Mirror enqueued }
        "409": { description: Out-of-sync conflict (show diff in UI) }

  /tenant/{tenant_id}/gbp/hours/status:
    get:
      summary: Get last mirror status + out-of-sync indicator
      parameters: [{ in: path, name: tenant_id, schema: { type: string, format: uuid }, required: true }]
      responses:
        "200": { description: OK, content: { application/json: { schema: { type: object, properties: { in_sync: { type: boolean }, last_synced_at: { type: string, format: date-time }, attempts: { type: integer }, last_error: { type: string, nullable: true } } } } } }
```

## Jobs

- gbp_hours_sync_job: exponential backoff, max 6 attempts; audit success/failure.
- hours_out_of_sync_detector: scheduled, emits warnings and populates status endpoint; no auto-pull.

## Observability

- Metrics: gbp_hours_sync_success_rate, hours_out_of_sync_count
- Logs: structured with tenant_id, action (gbp.hours.update / gbp.hours.special.update)

## UI/UX

- HoursEditor (weekly grid), SpecialHoursCalendar, TimezonePicker
- SyncStateBadge(Hours) with "Mirror Now" CTA and diff panel
- Mirror behavior gated by FF_TENANT_GBP_HOURS_SYNC; strategy: platform_is_source
