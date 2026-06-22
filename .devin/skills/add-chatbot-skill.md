---
description: How to add a new bot skill to the chatbot platform (capability key, DB row, service, intent, dynamic response)
---

# Add a New Chatbot Bot Skill

Use this skill when extending the chatbot with a new capability that the bot can execute in response to user messages (e.g., shipping calculator, loyalty rewards lookup, appointment booking).

**Full reference:** `docs/CHATBOT_SKILL_EXTENSION_GUIDE.md` — read this before starting. It contains the complete architecture diagram, step-by-step worked example, skill card schema reference, capability gate documentation, and testing checklist.

## Prerequisites

- Understand the capability system (see `.devin/skills/add-capability-feature.md` and `.devin/skills/link-features-to-capability-type.md`)
- Understand capability-type integration (see `.devin/skills/capability-system-integration.md`)

## Quick Reference: The 7 Components

Every skill has **3 required** and **4 conditional** components:

| # | Component | Required? | Location |
|---|---|---|---|
| 1 | `bot_skills` DB row | Yes | `apps/api/prisma/seed-bot-data.ts` or admin API |
| 2 | Capability feature key | Yes | `features_list` + `capability_features_list` + `tier_features_list` |
| 3 | `ChatbotSkillType` union member | Yes | `types.ts` + `ChatbotOptionsResolver.ts` + frontend mirrors |
| 4 | Dedicated backend service | If skill queries data | `apps/api/src/services/Bot<Name>Service.ts` |
| 5 | Intent mapping | If intent-triggered | `bot_intents` row with `mapped_skill` |
| 6 | Dynamic response integration | If skill data enriches GPT prompts | `BotDynamicResponseService.ts` |
| 7 | Public API endpoint | If skill needs custom endpoint | `apps/api/src/routes/bot-public.ts` |

## Steps (Summary)

1. **SQL migration** — Insert `chatbot_skill_<name>` into `features_list`, link to `chatbot_options` capability type, enable for target tiers in `tier_features_list`
2. **TypeScript types** — Add to `ChatbotSkillType` in `apps/api/src/services/resolvers/types.ts` and `ChatbotOptionsResolver.ts` (both flexible block + conditional check)
3. **Seed skill row** — Add to `SKILLS` array in `seed-bot-data.ts` with name, endpoint, gates, `skill_card_schema`, `default_config`
4. **Seed intent** — Add to `INTENTS` array with example phrases and `mapped_skill` pointing to the skill name
5. **Backend service** — Create `Bot<Name>Service.ts` following the `BotProductCatalogService` singleton pattern
6. **Public endpoint** — Add route to `bot-public.ts` with capability gate check via `resolveEffectiveCapabilities()`
7. **Dynamic response** — If applicable, add keyword detection + context injection in `BotDynamicResponseService.ts`
8. **Frontend mirrors** — Update `ChatbotSkillType` in `CapabilityResolutionService.ts` and `UnifiedCapabilityService.ts`
9. **Verify** — Zero TS errors on both `apps/api` and `apps/web`

## Naming Convention

- Skill name (kebab-case): `shipping-calculator`
- Capability key (snake_case): `chatbot_skill_shipping_calculator`
- Intent name (dot notation): `shipping.inquiry`

## Key Files to Touch

- `database/migrations/04X_<description>.sql` — feature key + tier assignments
- `apps/api/src/services/resolvers/types.ts` — `ChatbotSkillType` union
- `apps/api/src/services/resolvers/ChatbotOptionsResolver.ts` — resolver logic
- `apps/api/prisma/seed-bot-data.ts` — skill + intent seed data
- `apps/api/src/services/Bot<Name>Service.ts` — dedicated service (if needed)
- `apps/api/src/routes/bot-public.ts` — public endpoint (if needed)
- `apps/api/src/services/BotDynamicResponseService.ts` — GPT context injection (if needed)
- `apps/web/src/services/CapabilityResolutionService.ts` — frontend type mirror
- `apps/web/src/services/UnifiedCapabilityService.ts` — frontend type mirror

## Verification

```bash
# Backend type check
cd apps/api && npx tsc --noEmit

# Frontend type check
cd apps/web && npx tsc --noEmit

# Seed the new skill
cd apps/api && npx tsx prisma/seed-bot-data.ts
```

See the **Testing Checklist** section in `docs/CHATBOT_SKILL_EXTENSION_GUIDE.md` for the full verification matrix (database, backend, frontend, widget, dynamic response).
