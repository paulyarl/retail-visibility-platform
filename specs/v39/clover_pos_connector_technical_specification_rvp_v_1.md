# Clover POS Connector — Technical Specification (RVP) v1.2 (Retrofit Edition)

**Document Owner:** Integration & Data Layer Team  
**Status:** Implementation-Ready (Full Spectrum, Demo + Pilot)  
**Date:** 2025-11-05  
**Related IDs:** REQ-2025-CLVR-001, ENH-2025-CLVR-SYNC-α, OPS-ALERT-CLVR-001

---

## 1) Executive Summary
This version retrofits the previous v1.1 Clover Connector specification to address identified gaps in UI integration, migration, observability, accessibility, and failure isolation. It provides complete visibility across backend and frontend systems, defines clear upgrade paths from Demo to Production, and strengthens error recovery and compliance coverage.

---

## 2) Architectural Addendum — End-to-End Sequence Flow
```
User (UI) → Connect Wizard → OAuth (Clover) → Token Vault
       ↓                                ↑
 Demo Mode Emulator ↔ Connector Service ↔ Inventory Service ↔ SWIS/GBP Feeds
       ↓
    Observability Layer → UI Dashboard → Alerts/Reports
```

**Sequence Highlights**
1. UI initiates connection → backend creates tenant integration record.  
2. For Demo Mode, Emulator Service seeds sample catalog and event stream.  
3. Connector normalizes events and posts updates to Inventory Service.  
4. Inventory emits `inventory.item.updated` events to downstream feeds.  
5. Observability Layer captures traces/metrics and surfaces to UI dashboard.

---

## 3) Demo → Production Migration Flow
**Goal:** Allow safe upgrade without data loss or SKU mismatch.

### 3.1 Migration Steps
1. **Pre-check:** Validate that demo SKUs exist in tenant inventory.  
2. **Freeze Demo:** Suspend emulator and mark all demo events as archived.  
3. **Import Live Catalog:** Fetch Clover items; reconcile with demo mapping table.  
4. **Mapping Merge:** If conflicts exist, flag for manual resolution.  
5. **Activate Production Mode:** Swap OAuth credentials; resume live sync.  
6. **Cleanup:** Auto-purge demo data after 14 days.

### 3.2 Rollback Path
- Maintain demo snapshot backup for 30 days.  
- Revert to Demo Mode via flag if production onboarding fails.  
- UI alert shows current mode and recovery guidance.

---

## 4) Enhanced Error Handling and User Recovery
### 4.1 UI-Level Error Handling
| Error | Cause | User Feedback | Recovery Action |
|-------|--------|----------------|----------------|
| OAuth Failure | Token expired/denied | Banner with reconnect CTA | Launch re-auth flow |
| Sync Drift | Mismatch >5% | Warning indicator | Trigger reconciliation test |
| Mapping Missing | Unmapped SKU detected | Inline warning | Click to fix mapping |
| API Timeout | Backend latency | Toast + retry button | Retry or queue manually |
| Connector Down | Service outage | Disabled controls | Retry later notification |

### 4.2 Retry & Fallback
- UI triggers background replays for failed syncs.  
- Offline indicator activates if connector unreachable for >60s.  
- Persistent notifications stored in user session logs.

---

## 5) Observability & Telemetry (UI + Backend)
### 5.1 New Metrics
| Layer | Metric | Description |
|--------|---------|-------------|
| UI | `ui.clover.mode_usage` | Counts demo vs production sessions |
| UI | `ui.clover.error_rate` | Frontend errors per session |
| Backend | `clover.connector.uptime` | Availability over 24h |
| Backend | `inventory.adjust.latency.p95` | End-to-end update time |

### 5.2 Traceability
- Unified trace IDs across UI and backend.  
- Each transaction displays trace link in Sync Health dashboard.  
- Correlates Clover event ID → RVP item update → feed confirmation.

---

## 6) Accessibility & UX Compliance
- WCAG 2.1 AA compliance target.  
- Keyboard navigation: tab-through Connect Wizard, table row focus with Enter/Space.  
- ARIA live regions for sync updates.  
- Color-independent status icons (shape + text).  
- Screen reader labels for all buttons and metrics.

---

## 7) Cross-Module Dependencies
| Module | Dependency | Integration Path |
|---------|-------------|-----------------|
| Tenant Management | Token Vault, Feature Flags | `/tenant/{id}/integrations` APIs |
| Inventory | Upsert/Adjust endpoints | `/inventory/items/adjust` |
| Observability | Metrics & Alerts | `/metrics`, `/alerts` feeds |
| Business Profile | Merchant Info UI | Connect Wizard integration |

---

## 8) Security & Privacy Retrofits
- OAuth scope disclosure screen added in Connect Wizard.  
- Token refresh alerts and expiration countdown.  
- Demo data lifecycle: auto-clean after 14 days inactive.  
- No PII stored; all demo data clearly labeled and sandboxed.  
- Encrypted API payloads; audit logs hashed with SHA-256.

---

## 9) UI Test Plan Expansion
| Test Type | Objective | Tool |
|------------|------------|------|
| Unit | UI state transitions (mode changes) | Jest/React Testing Library |
| Integration | Connect Wizard + API handshake | Cypress |
| Accessibility | Keyboard/ARIA validation | Axe-core |
| Performance | Render time <2s | Lighthouse |
| Security | OAuth spoof/failure | Postman Tests |

---

## 10) Rollback & Failure Isolation (UI & Backend)
- Graceful degradation: disable actions during backend outage.  
- UI displays sync paused state.  
- Auto-retry jobs resume when connectivity restored.  
- Observability layer logs incident timeline.

---

## 11) Data Retention & Privacy Policy (Demo Mode)
- **Auto-clean:** purge all demo data after 14 days.  
- **Manual purge:** accessible via Settings → Danger Zone.  
- **Segregation:** demo data lives in isolated namespace.  
- **Audit trail:** log all demo activities for traceability.

---

## 12) Changelog
- **v1.2 (2025-11-05):** Retrofit edition with full-spectrum gap closure: added sequence diagram, migration flow, UI error recovery, observability metrics, accessibility compliance, and data retention.  
- **v1.1 (2025-11-05):** Added Merchant-Facing UI & Integration (Demo Mode).  
- **v1.0 (2025-11-05):** Initial implementation-ready connector spec.

---

## 13) Next Steps
1. Implement migration and rollback logic between Demo and Production modes.  
2. Add sequence diagram and UI error handling states in Figma mockups.  
3. Build telemetry pipeline to capture UI metrics and correlate traces.  
4. Validate accessibility compliance and finalize security audits.  
5. Conduct integrated QA cycle (UI + backend + observability).

