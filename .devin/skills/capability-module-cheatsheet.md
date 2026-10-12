---
description: Quick-reference cheatsheet — capability module kinds, who administers what, where each layer of state lives, the key contract, and the module-responsibility decision test. Depth lives in capability-data-flow-rules.md (R1–R37).
---

# Capability Module Cheatsheet

One-page mental model for where capability concerns live. Companion to
`capability-data-flow-rules.md` (the rules) and `add-capability-feature.md`
(the build checklist).

## The four module kinds

| Kind | Concern | Grants come from | Merchant prefs | Examples |
|---|---|---|---|---|
| `<domain>_types` | Which entity kinds exist | Tier + merchant selection | `tenant_<domain>_type_settings` | `storefront_types`, `product_types` |
| `<domain>_options` | Merchant-facing display/behavior configurator | Tier + merchant toggles | `tenant_<domain>_options_settings` | `storefront_options`, `faq_options`, `storefront_qr/_gallery/_hours/_layouts/_maps`, `chatbot_options`, `social_commerce_options` |
| Entitlement / infrastructure | Operator- or platform-administered grants; lifecycle in infra rows | Tier / purchase / admin override | **None today** — allowed later (R37) | `storefront_domains` |
| Services | Human-delivered, one-time billed, CRM-fulfilled | Tier / BSaaS purchase | n/a | `platform_services` |

**Not a dumping ground**: `platform_services` is human fulfillment only —
never put recurring infrastructure entitlements in it.

## Where each layer of state lives

| Question | Source of truth |
|---|---|
| What does the tier grant? | `tier_features_list` (+ `capability_type_id`, `is_enabled`) |
| What did the tenant buy? | `tenant_feature_purchases` (status + expiry) |
| Admin exception? | `tenant_feature_overrides_list` — `granted=true` only; **`granted=false` is ignored, NOT a deny** |
| Merchant preference? | `tenant_<domain>_options_settings` / `_type_settings` |
| Assignment / infra state? | `custom_domains`, `tenants.subdomain`, DNS, Vercel — separate from entitlement |
| Deploy gate (beta)? | `tenant_feature_flags_list` — flag = deployed-to-you, capability = entitled-to-you |
| Resolved view? | `mv_tenant_effective_capabilities` — ≤10 min pg_cron refresh; write gates may union live sources for immediacy |

## The key contract (per module)

```
<module>_enabled    → module ON explicitly (grants nothing alone)
<module>_disabled   → module OFF — absolute veto, wins over everything
<module>_flexible   → module ON + every feature key in the module
<any other active key> → implicit _enabled (R17 §4)
no keys at all      → module OFF
```

- `_disabled` is a **veto, not a grant** — never counts as engagement.
- Never fabricate `_enabled` just to host a grant — if a key needs a home the
  veto can't reach, it's in the wrong module (the Discovery bug).
- Group gates in options modules use `_on`/`_off` (legacy `_enabled`/`_disabled`
  group keys remain as OR-aliases during migration).
- Resolver fields: `allowed_*` = tier hard gate; `can_use_*`/`effective_*` =
  tier AND merchant soft gate (R33 — merchant prefs never touch tier fields).

## Module-responsibility test (R37) — where does a new key live?

```
What concern does the key configure?
 ├─ Merchant can toggle it in settings?
 │    → that concern's _options module (grouped under _on/_off)
 ├─ State lives in infra rows (DNS, domains, hosting, deploy)?
 │    → dedicated entitlement module (or its own new one)
 ├─ Human-fulfilled one-time service?
 │    → platform_services
 └─ Which entity kinds exist?
      → _types module
```

A key in the wrong module inherits that module's `_disabled` veto and its
`checkCapabilityEngagement` evidence — wrong-module placement is a functional
bug, not just untidiness.

## storefront_domains — entitlement levels (current canonical example)

| Level | Surface | Key |
|---|---|---|
| 1 | `visibleshelf.com/tenant/{id}` path | `storefront_domains_enabled` (baseline) |
| 2 | `{slug}.visibleshelf.com` | `storefront_domains_platform_subdomain` |
| 3 | Tenant-owned apex/www/host | `storefront_domains_custom_domain` |

Entitlement ≠ assignment: the key grants the *ability*; `tenants.subdomain`
or an `active` `custom_domains` row is the *state*. "Merchant doesn't want it"
= don't attach (no prefs needed today).

## Evolution path — when an entitlement module needs merchant opt-in

1. Feature key stays in the module (`<module>_<feature>`) — same concern.
2. Add `tenant_<module>_settings` row/column for the opt-in bool.
3. Resolver grows `(features, merchantPrefs)` + `can_use_<feature>`
   (tier AND merchant); tier-level fields stay merchant-free.
4. `_disabled` still vetoes everything; `_flexible` covers the tier side.
