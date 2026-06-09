# Merchant-Aware Chatbot Platform — Merchant-Facing UI/UX Design

## UX Overview

- **FAQ-first knowledge base, tier-gated response quality**: Every merchant gets the FAQ knowledge base AND the bot widget. The bot takes customer queries, runs universal guardrails + intent classification, and responds. The merchant's subscription tier gates the *response type* only:
  - **Free tier**: Bot widget active. Static FAQ lookup — exact-match or keyword retrieval from the merchant's FAQ. No AI model. If no FAQ match, static fallback message.
  - **Starter**: Bot widget active. Dynamic FAQ RAG + shared dynamic model for generative responses.
  - **Pro**: Bot widget active. Dynamic FAQ RAG + LoRA fine-tuned model.
  - **Enterprise**: Bot widget active. Dynamic FAQ RAG + dedicated model.
- **Universal guardrails + intent classification (non-paid BERT)**: Every message — regardless of tier — passes through safety guardrails and intent classification powered by platform-hosted BERT models. This is universal infrastructure, not gated by subscription.
- **Tier gate is post-classification**: After guardrails + intent classification, the merchant's tier determines the response engine:
  - **Free**: Static FAQ lookup (exact match, no embeddings, no AI generation).
  - **Starter+**: FAQ RAG retrieval + AI model generates the response.
  Skills are also tier-gated (e.g., cross-merchant comparison requires Pro+).
- **Auto-scaling visibility**: Model training and tier upgrades happen automatically at volume thresholds. The UI is a progress monitor and notification center.
- **Dual dashboard**: Subscribers see performance (conversations, resolution, revenue lift). Non-subscribers see missed opportunities with upgrade CTAs.
- **Skill registry**: Merchants toggle skills (product search, inventory, orders, cross-merchant comparison) available at their tier.
- **Embeddable widget**: Shadow-DOM-isolated chat widget deployed via a single script tag. Themeable but fully isolated.

---

## Mental Model

**Tier-aware conversational infrastructure, universal safety layer.** Every customer message passes through the same guardrails and intent classifier (platform-hosted BERT, no cost to merchant). The bot widget is present for all merchants. Only after the guardrails + intent pipeline does the merchant's tier gate the *response engine*: Free merchants get static FAQ lookup responses; Starter+ merchants get AI-generated responses powered by their tier's assigned model (shared dynamic → LoRA → dedicated). The UI tells merchants what is serving them and why.

---

## Navigation

**Sidebar** (`/t/[tenantId]/`): New "Bot" section with: Dashboard, Configuration, Knowledge Base, Skills, Analytics, Widget Setup. Chatbot Options lives under Settings → Capabilities.

---

## Screen Inventory

| Screen | Purpose | Entry Point |
|---|---|---|
| Bot Dashboard | Overview: status, model tier, usage, FAQ coverage, upgrade CTA if applicable | `/t/[tenantId]/bot` |
| Bot Configuration | Guardrails (universal), intent whitelist (universal), tone, fallback, model tier | `/t/[tenantId]/bot/config` |
| Bot Configuration — Model | View current model tier, training status, thresholds | Config → Model tab |
| Bot Knowledge Base | FAQ coverage, freshness, last sync, quick links to FAQ Hub | `/t/[tenantId]/bot/knowledge` |
| Bot Skills | Toggle and configure registered skills | `/t/[tenantId]/bot/skills` |
| Bot Analytics | Volume, resolution, top intents, revenue lift, gaps | `/t/[tenantId]/bot/analytics` |
| Widget Setup | Script tag, theme, position, greeting, preview | `/t/[tenantId]/bot/widget` |
| Chatbot Options | Capability-gated tier options page. Shows what the merchant's tier unlocks. | `/t/[tenantId]/settings/chatbot-options` |

---

## ASCII Wireframes

### Screen 1: Bot Dashboard (Subscriber)

```
+----------------------------------------------------------------------------------+
|  Bot Assistant — Acme Grocery                                                    |
+----------------------------------------------------------------------------------+
|  Status: [● Online]    Model: LoRA-Adapted (Mid-Tier)    Plan: Professional    |
|                                                                                  |
|  +---------------------+  +---------------------+  +---------------------+    |
|  |  Conversations      |  |  Resolution Rate    |  |  Revenue Lift       |    |
|  |  4,231 this month   |  |  89%                |  |  $12,400            |    |
|  |  ▲ 12% vs last mo   |  |  ▲ 4pp vs last mo   |  |  ▲ $1,800 vs last mo|   |
|  +---------------------+  +---------------------+  +---------------------+    |
|                                                                                  |
|  +----------------------------------+  +--------------------------------------+  |
|  |  Model Tier Card                 |  |  Top Intents This Week               |  |
|  |  [LoRA Badge]                    |  |  Product Search .......... 34%       |  |
|  |  Fine-tuned on your data         |  |  Inventory Query .......... 22%       |  |
|  |  Training: Complete              |  |  Order Status ............ 18%       |  |
|  |  Last trained: 3 days ago        |  |  Store Hours ............. 12%       |  |
|  |  Next threshold: 10K convos    |  |  Returns ................. 7%        |  |
|  |  (dedicated model unlock)        |  |  Other ................... 7%        |  |
|  |  [View Training Jobs]            |  |                                      |  |
|  +----------------------------------+  +--------------------------------------+  |
|                                                                                  |
|  [Edit Configuration]  [Manage Skills]  [View Analytics]  [Preview Widget]        |
+----------------------------------------------------------------------------------+
```

- **Model tier card**: Badge showing current tier. Subscribers see LoRA or Dedicated with training metadata.
- **Threshold indicator**: "Next threshold: 10K convos" — progress toward dedicated model unlock.

---

### Screen 2: Bot Dashboard (Free Tier — Static FAQ Mode)

```
+----------------------------------------------------------------------------------+
|  Bot Assistant — Acme Grocery                                                    |
+----------------------------------------------------------------------------------+
|  Status: [● Online — Static Mode]    Plan: Free    Widget live; AI requires upgrade |
|                                                                                  |
|  +---------------------+  +---------------------+  +---------------------+      |
|  |  Widget Conversations |  |  FAQ Responses      |  |  Upgrade to Starter  |      |
|  |  234 this month       |  |  189 (81%)          |  |  $29/mo              |      |
|  |  ▲ 12% vs last mo     |  |  45 no-match        |  |  [Upgrade Now]       |      |
|  +---------------------+  +---------------------+  +---------------------+      |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Your bot widget is live! Customers can chat, but responses are static.     |  |
|  |                                                                              |  |
|  |  How it works right now:                                                     |  |
|  |  • Customer asks a question → bot matches against your FAQ (exact/keyword)  |  |
|  |  • If FAQ match found → bot replies with the static FAQ answer                |  |
|  |  • If no match → "Sorry, I don't have an answer for that yet."                |  |
|  |                                                                              |  |
|  |  What You'll Unlock with AI:                                                 |  |
|  |  • Conversational, context-aware answers powered by FAQ + AI model            |  |
|  |  • Natural language product search and skill cards                            |  |
|  |  • Gap reports and coverage analytics                                        |  |
|  |  • Order tracking, inventory queries, and cross-merchant comparison           |  |
|  |  [Compare Plans →]                                                            |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Top Unmatched Questions: "do you have almond milk" (34x), "what time sunday" (28x) |
|  [View Full Gap Report]  [Add FAQ for Top Question]                               |
+----------------------------------------------------------------------------------+
```

- **Static Mode**: Bot widget is deployed and active. Customers can interact. Responses are static FAQ lookup (exact match / keyword), not AI-generated.
- **Widget conversations**: Total chats initiated via the widget. FAQ responses = matched and served from static FAQ. No-match = no static FAQ found.
- **Upgrade CTA**: Clear distinction between "what you have now" (static FAQ responses) and "what you unlock" (AI-powered conversational responses with FAQ RAG).
- **Gap Report**: Still available on Free tier — shows unmatched questions so merchants can write new FAQs (which improves static mode too).

---

### Screen 3: Bot Configuration — General

```
+----------------------------------------------------------------------------------+
|  Bot Configuration                                                                 |
+----------------------------------------------------------------------------------+
|  General | Guardrails | Intents | Model | Fallback                              |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  Bot Name                                                                        |
|  [Acme Grocery Assistant                                    ]                    |
|                                                                                  |
|  Greeting Message                                                                |
|  [Hi! I'm the Acme Grocery Assistant. Ask me about products, hours, or orders. ] |
|                                                                                  |
|  Tone                                                                            |
|  (•) Professional    ( ) Friendly    ( ) Casual                               |
|                                                                                  |
|  Response Length                                                                  |
|  ( ) Concise    (•) Balanced    ( ) Detailed                                    |
|                                                                                  |
|  Pre-Chat Form                                                                    |
|  [☑] Collect email before first message                                          |
|  [☑] Collect phone number                                                        |
|  [  ] Ask for order number (if order-related intent)                             |
|                                                                                  |
|  Working Hours                                                                    |
|  [☑] Only show widget during business hours                                       |
|  After-Hours Message                                                              |
|  [We're currently offline. Leave a message and we'll reply during business hours] |
|                                                                                  |
|                              [Cancel]          [Save Changes]                    |
+----------------------------------------------------------------------------------+
```

- **Tabs**: General, Guardrails (safety rules), Intents (enabled/mapped), Model (tier status), Fallback (escalation).
- **Tone & length**: Shape shared model output. LoRA/dedicated models learn from these.

---

### Screen 4: Bot Configuration — Model Tab

```
+----------------------------------------------------------------------------------+
|  Bot Configuration                                                                 |
+----------------------------------------------------------------------------------+
|  General | Guardrails | Intents | Model (active) | Fallback                        |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  Current Model Tier                                                                |
|  +----------------------------------------------------------------------------+  |
|  |   [LoRA-Adapted Model]   Mid-Tier / Professional Plan                      |  |
|  |   Base: ModernBERT-base        Adapter: lora-acme-grocery-v3                |  |
|  |   Status: [● Serving]        Avg latency: 180ms        Uptime: 99.97%      |  |
|  |   Last trained: 3 days ago  (conversations 3,200-4,100 used)                  |  |
|  |   Next auto-training: at 5,000 conversations                                |  |
|  |   [View Training Logs]  [Force Retrain]  [Download Adapter]                  |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Tier Ladder                                                                      |
|  +----------------------------------------------------------------------------+  |
|  |   Static (Free)        [========]  0-500 chats/mo   [Current — inactive]      |  |
|  |   Shared Dynamic (Starter) [====]  500-2,000 chats   [Upgraded past]          |  |
|  |   LoRA Adapted (Pro)   [========]  2,000-10,000     [● ACTIVE]              |  |
|  |   Dedicated (Enterprise) [====]  10,000+ chats      [Locked — upgrade]      |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Volume This Month: 4,231 conversations                                          |
|  Projected: 5,800 by month-end (auto-training will trigger)                      |
+----------------------------------------------------------------------------------+
```

- **Model card**: Base model, adapter name, latency, uptime, training metadata.
- **Tier ladder**: Visual progress showing current position. Locked tiers show upgrade CTA.
- **Auto-training projection**: Estimates next trigger based on volume trajectory.

---

### Screen 5: Bot Skills

```
+----------------------------------------------------------------------------------+
|  Bot Skills                                                                        |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Skill                    | Status   | Required Tier   | Configure       |  |
|  |---------------------------|----------|-----------------|-----------------|  |
|  |  [🔍] Product Search      | [● On]   | Starter+        | [Configure]     |  |
|  |  Search by name, category,|          |                 |                 |  |
|  |  or description.          |          |                 |                 |  |
|  |---------------------------|----------|-----------------|-----------------|  |
|  |  [📦] Inventory Lookup    | [● On]   | Starter+        | [Configure]     |  |
|  |  Check stock, aisles.   |          |                 |                 |  |
|  |---------------------------|----------|-----------------|-----------------|  |
|  |  [🧾] Order Tracking      | [● On]   | Pro+            | [Configure]     |  |
|  |  Status by number/email.|          |                 |                 |  |
|  |---------------------------|----------|-----------------|-----------------|  |
|  |  [🏪] Cross-Merchant      | [  Off]  | Enterprise      | [Locked]        |  |
|  |  "Where else sells this?"|          |                 |                 |  |
|  |---------------------------|----------|-----------------|-----------------|  |
|  |  [📅] Booking / Hours     | [● On]   | Starter+        | [Configure]     |  |
|  |  Hours, pickup slots.     |          |                 |                 |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Skill Configuration — Product Search (inline panel)                             |
|  +----------------------------------------------------------------------------+  |
|  |  [☑] Enable fuzzy matching                                                      |  |
|  |  [☑] Show out-of-stock with "Notify me" option                                |  |
|  |  [☑] Suggest alternatives when unavailable                                    |  |
|  |  Max results: [5 ▼]                                                             |  |
|  |  [Save]                                                                         |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

- **Skill table**: Name, description, status toggle, required tier. Above-tier skills are locked with tooltip.
- **Skill engines**: Every skill is backed by a public API endpoint (`/api/public/skills/:skillName`) that queries materialized views (MV) for sub-100ms response times. The bot widget (universal) calls these endpoints directly; no auth required for read-only skill queries.
- **Featured-aware product skills**: Product search and inventory skills respect the merchant's featured product selections (store_selection, new_arrival, seasonal, sale, staff_pick, clearance, featured) and platform algorithmic features (bestseller, trending, recommended, random_featured). The skill MV joins the featured products materialized view so responses can surface featured items first or filter by featured type.
- **Capability-aware skills**: Every skill queries the tenant's resolved capability state before executing. If the merchant's tier does not include `quickstart_wizard_ai`, the product search skill falls back to template-based results. If `featured_store_selection` is not enabled, the skill omits merchant-curated featured sections. Skills never surface gated data types (e.g., `featured_bestseller` on a Starter tier).
- **Tenant-status-aware skills**: Skills behave differently based on tenant subscription status:
  - **Active / Trial**: Full skill responses. Trial tenants see a subtle "Trial mode" chip in skill cards.
  - **Suspended**: Skills return a graceful degradation message: "Product information is temporarily unavailable." No 500s.
  - **Past-due**: Skills still function (to avoid customer-facing breakage), but the merchant dashboard shows a billing warning banner.
- **Data freshness**: MVs are refreshed on a cadence per skill (product inventory: 5 min; product search: 15 min; store hours: 1 hour). The merchant dashboard shows "last updated" per skill.
- **Inline configuration**: Clicking "Configure" expands a settings panel without navigation.

---

### Screen 6: Bot Analytics

```
+----------------------------------------------------------------------------------+
|  Bot Analytics                                                                     |
+----------------------------------------------------------------------------------+
|  Overview | Conversations | Intents | Skills | Gaps                               |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  [Overview tab]                                                                    |
|                                                                                  |
|  +---------------------+  +---------------------+  +---------------------+    |
|  |  Conversations      |  |  Avg Duration       |  |  Handoff Rate       |    |
|  |  4,231              |  |  3m 12s             |  |  4.2%               |    |
|  +---------------------+  +---------------------+  +---------------------+    |
|                                                                                  |
|  +----------------------------------+  +--------------------------------------+  |
|  |  Conversation Volume (line chart)|  |  Resolution Funnel                  |  |
|  |  M T W T F S S                   |  |  4,231 Total                        |  |
|  |  [7d] [30d] [90d] [Custom]       |  |  ├── 3,768 Resolved by bot (89%)   |  |
|  |                                  |  |  ├── 312 Escalated (7%)             |  |
|  |                                  |  |  └── 151 Abandoned (4%)             |  |
|  +----------------------------------+  +--------------------------------------+  |
|                                                                                  |
|  Revenue Attribution: 687 conversations led to purchase ($12,400)               |
|  Top converting: Product Search (42%), Inventory (28%)                            |
+----------------------------------------------------------------------------------+
```

- **Overview**: Volume, duration, handoff rate + resolution funnel + revenue attribution.
- **Conversations tab**: Searchable transcript list with intent tags and resolution status.
- **Gaps tab**: Unanswered queries ranked by frequency, with one-click "Create FAQ" or "Add to Training Data".

---

### Screen 7: Bot Knowledge Base

```
+----------------------------------------------------------------------------------+
|  Knowledge Base — Acme Grocery                                                   |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  +---------------------+  +---------------------+  +---------------------+        |
|  |  FAQ Entries        |  |  Coverage Score     |  |  Last Sync          |        |
|  |  47 active          |  |  87%                |  |  2 hours ago        |        |
|  |  12 draft           |  |  ▲ 5pp vs last mo   |  |  Auto-sync: ON      |        |
|  +---------------------+  +---------------------+  +---------------------+        |
|                                                                                  |
|  +----------------------------------+  +--------------------------------------+  |
|  |  FAQ Categories                  |  |  Product Coverage                    |  |
|  |  Shipping .......... 12 entries  |  |  [██████████░░░░ 78%]                |  |
|  |  Returns ............ 8 entries  |  |  142 of 182 products have FAQ        |  |
|  |  Ingredients ........ 6 entries  |  |                                      |  |
|  |  Store Hours ........ 4 entries  |  |  Top uncovered:                      |  |
|  |  Pricing ............ 9 entries  |  |  • Organic Kale (0 FAQ)              |  |
|  |  General ............ 8 entries  |  |  • Sourdough Bread (0 FAQ)           |  |
|  |                                  |  |  [Go to FAQ Hub →]                   |  |
|  |  [Go to FAQ Hub →]               |  +--------------------------------------+  |
|  +----------------------------------+                                          |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Retrieval Settings                                                          |  |
|  |  Top-K: [ 3  ▼]    Min Confidence: [ 70% ▼]    Fallback: [Skill → Generic ▼]|  |
|  |  [☑] Prioritize product-scoped FAQ over storefront                           |  |
|  |  [☑] Include FAQ in LoRA training data                                     |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

- **Purpose**: The bot's "brain" — shows what the bot knows and how fresh it is. FAQ entries are the primary RAG source.
- **Coverage score**: Percentage of customer intents that matched an FAQ in the last 30 days. Target: >85%.
- **Product coverage**: How many products have at least one product-scoped FAQ. Click through to the FAQ Hub's Product tab.
- **Retrieval settings**: Merchants control how aggressively the bot retrieves from FAQ vs. falling back to skills or generic model responses.
- **Sync status**: Last embedding index build. Auto-sync triggers on every FAQ save; manual "Rebuild Index" available.

---

### Screen 8: Widget Setup + Preview

```
+----------------------------------------------------------------------------------+
|  Widget Setup                                                                      |
+----------------------------------------------------------------------------------+
|  Position | Appearance | Behavior | Script                                       |
+----------------------------------------------------------------------------------+
|  [Position tab]                                                                    |
|                                                                                  |
|  Position: (•) Bottom Right  ( ) Bottom Left  ( ) Top Right  ( ) Top Left        |
|  Offset: Horizontal [24 px]  Vertical [24 px]                                    |
|                                                                                  |
|  +------------------------------+  +------------------------------+            |
|  |  Desktop Preview             |  |  Mobile Preview              |            |
|  |  +------------------------+  |  |  +------------------------+  |            |
|  |  |     [Storefront mock]  |  |  |  |  [Mobile mock]         |  |            |
|  |  |                        |  |  |  |  |                        |  |            |
|  |  |              [💬]      |  |  |  |  |            [💬]        |  |            |
|  |  +------------------------+  |  |  |  +------------------------+  |            |
|  +------------------------------+  +------------------------------+            |
|                                                                                  |
|  Embed Script                                                                    |
|  <script src="https://cdn.visible Shelf.com/bot/v1/widget.js"                   |
|          data-tenant-id="tnt_abc123"                                             |
|          data-theme="auto"></script>                                            |
|  [Copy to Clipboard]  [Regenerate Key]                                           |
+----------------------------------------------------------------------------------+
```

- **Tabs**: Position, Appearance (colors, font, avatar), Behavior (auto-open, delay, pre-chat form), Script.
- **Dual preview**: Desktop and mobile mocks update in real time.
- **Embed**: Single `<script>` tag with `data-tenant-id`. Shadow DOM isolates styles.

---

### Screen 9: Chatbot Options (Capability Page)

```
+----------------------------------------------------------------------------------+
|  Chatbot Options — Acme Grocery                                                  |
+----------------------------------------------------------------------------------+
|  Your plan: Professional    [Upgrade to Enterprise →]                            |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Response Engine                                                               |  |
|  |  [●] Static FAQ Lookup          (Free — always on)                          |  |
|  |  [●] Shared Dynamic Model       (Starter — active)                          |  |
|  |  [●] LoRA Fine-tuned            (Pro — active)                              |  |
|  |  [  ] Dedicated Model           (Enterprise — locked)                       |  |
|  |      [🔒 Upgrade to Enterprise to unlock sub-second latency]                |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Skills                                                                        |  |
|  |  [●] Product Search             (Starter — on)                              |  |
|  |  [●] Inventory Lookup           (Starter — on)                              |  |
|  |  [●] Store Hours & Booking      (Starter — on)                              |  |
|  |  [●] Order Tracking             (Pro — on)                                  |  |
|  |  [  ] Cross-Merchant Comparison (Enterprise — locked)                        |  |
|  |      [🔒 Upgrade to Enterprise to compare with other merchants]             |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Knowledge Base                                                                |  |
|  |  [●] FAQ RAG Retrieval          (Starter — active)                          |  |
|  |  [●] Product-Scoped FAQ         (Starter — active)                          |  |
|  |  [●] Gap Report                 (Starter — active)                          |  |
|  |  [●] Auto-Sync Embeddings       (Pro — active)                              |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Widget                                                                        |  |
|  |  [●] Embeddable Widget            (All tiers — on)                          |  |
|  |  [●] Custom Theme                 (All tiers — on)                          |  |
|  |  [●] Skill Cards                  (Starter+ — on)                           |  |
|  |  [●] After-Hours Mode             (Starter+ — on)                         |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

- **Purpose**: Capability-aligned options page showing everything the merchant's tier unlocks. Mirrors the pattern of `featured_options` and `quickstart_options` settings pages.
- **Plan badge**: Current subscription tier at top. Upgrade CTA if not at max tier.
- **Section groups**: Response Engine, Skills, Knowledge Base, Widget — same groups as the capability spec.
- **Locked options**: Grayed out with lock icon and upgrade tooltip. Not hidden — merchants should see what they're missing.
- **Active options**: Checked and editable (toggle on/off where applicable). Some are mandatory (e.g., Static FAQ Lookup cannot be disabled).
- **Capability resolution**: The page uses `useChatbotOptionsCapability` hook (from `CapabilityResolutionService`) to determine which options to show as active vs. locked. No hard-coded tier checks in the UI component.

---

## Interaction States

| State | Behavior |
|---|---|
| Empty dashboard (new tenant, Free) | "Your bot widget is ready in Static Mode. Customers can chat, but responses are FAQ-only. Upgrade to unlock AI." + tier comparison table |
| Empty dashboard (new tenant, Starter+) | "Your AI bot is ready. Add FAQs to improve RAG coverage." + quick-start guide |
| Training in progress | Banner on dashboard: "LoRA training in progress — 75% complete, ~12 min remaining" |
| Training complete | Toast: "New LoRA model deployed. Responses are now fine-tuned on your data." |
| Volume threshold crossed | Banner: "You crossed 5,000 conversations! Auto-training scheduled." + dismiss |
| Skill locked (above tier) | Disabled toggle with tooltip: "Upgrade to Pro to enable Order Tracking" |
| Widget preview | Changes apply instantly in preview pane without save |
| No-match in bot preview | "No matching FAQ found. This query will appear in your Gap Report." |
| Gap report empty | "No unanswered queries yet. Bot preview and customer traffic will populate this." |
| FAQ coverage low (<60%) | Warning banner on dashboard + Knowledge Base: "Coverage is 58%. Add more FAQs to reduce fallback responses." |
| FAQ coverage high (>90%) | Green badge on Knowledge Base: "Excellent coverage. Bot is answering from your FAQ 94% of the time." |
| FAQ index out of sync | Banner: "New FAQs detected — embedding index rebuilding..." with progress bar |
| FAQ index stale (>24h) | Warning: "Last sync 26 hours ago. [Rebuild Index]" |
| Product with no FAQ | In Knowledge Base product coverage list, uncovered products show red dot + quick "+ Add FAQ" link |
| Free tier static mode | Dashboard shows widget conversations + static FAQ response rate. Bot Knowledge Base shows FAQ entries but no embedding sync (not needed for static lookup). Bot Preview shows static match results. Gap Report available. |
| Free tier widget active | Widget is deployed and accepting queries. Responses are static FAQ only. Upgrade CTA in widget header: "Get smarter answers with AI" → links to plan comparison. |
| Skill capability gated | "Product Search" skill runs but omits AI-generated descriptions because `quickstart_wizard_ai` is not enabled. Falls back to template-based results. Merchant sees "Some features require an upgrade" chip in the skill card. |
| Skill featured aware | Product Search skill surfaces merchant's `featured_store_selection` items first when the customer query is broad ("what's new?"). If no featured products are configured, results are standard alphabetical. |
| Skill tenant status — Suspended | Customer asks about inventory → bot replies: "Product information is temporarily unavailable." Merchant dashboard shows red "Account Suspended" banner with billing contact CTA. |
| Skill tenant status — Past-due | Skills execute normally (customer-facing continuity). Merchant dashboard shows amber "Past Due — Update Payment" banner. Bot responses unaffected. |
| Skill tenant status — Trial | All skills active. Skill cards show a subtle "Trial" badge. Trial countdown banner on merchant dashboard: "12 days left in trial. Upgrade to keep AI responses." |

---

## Customer-Facing Widget UX

```
[Collapsed State]
+------------------+
|       [💬]       |  <- Merchant-themed color, position configurable
+------------------+

[Expanded State — Shadow DOM Isolated]
+--------------------------------+
|  Acme Grocery        [—] [X]   |  <- Header: merchant name, minimize, close
|  [Online now]                    |
|--------------------------------|
|                                |
|  Hi! I'm the Acme Grocery      |  <- Greeting message (merchant-configured)
|  Assistant. What can I help    |
|  you find today?               |
|                                |
|  [🥛 Organic Milk]             |  <- Skill card: product suggestion
|  [🍞 Sourdough Bread]          |  <- Skill card: product suggestion
|                                |
|  [________________________] [➤]|  <- Input bar with send
|                                |
+--------------------------------+

[Skill Card — Order Tracking]
+--------------------------------+
|  🧾 Order Status               |
|  Enter your order number:      |
|  [ORD-12345        ] [Track]   |
+--------------------------------+

[Skill Card — Inventory]
+--------------------------------+
|  📦 Stock Check                |
|  "We have 12 units of Organic   |
|   Milk in Aisle 3."            |
|  [View Product]  [Notify Me]   |
+--------------------------------+
```

- **Shadow DOM isolation**: All widget DOM and styles scoped to a closed shadow root. No CSS leakage.
- **Skill cards**: Rich interactive responses (product carousels, order input fields, inventory badges) rendered as cards inside the chat stream. **Tier-gated**: Free tier sees text-only FAQ responses; Starter+ sees skill cards.
- **Position/appearance**: Configurable via merchant dashboard. Loads merchant theme from `data-tenant-id`.
- **Pre-chat form**: Optional email/phone collection before first message.
- **After-hours**: Widget still visible but shows offline message + leave-a-note input.
- **Free tier widget UX**: Same widget shell, but responses are plain text from static FAQ. No skill cards, no generative AI. Upgrade nudge appears after 2 unanswered queries: "Want smarter answers? Upgrade to Starter."

---

## Frontend Service Pattern (Singleton + Caching, No Direct Fetch)

All chatbot frontend services **extend an appropriate base singleton** and **never call `fetch()` directly**. Requests go through the inherited method on the base class, which handles auth headers, caching, and error normalization.

### Base Class Selection

| Service Scope | Extends | Default Request Method | Cache TTL |
|---|---|---|---|
| Bot Dashboard / Config / Skills / Analytics (merchant) | `TenantApiSingleton` | `this.makeTenantRequest<T>()` | 5 min |
| Bot Widget (public customer-facing) | `PublicApiSingleton` | `this.makePublicRequest<T>()` | 15 min |

### `BotService.ts` — Merchant Hub Pattern

```ts
import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

class BotService extends TenantApiSingleton {
  private static instance: BotService;

  private constructor() {
    super('bot-service', { ttl: 5 * 60 * 1000 });
  }

  getServiceCachePatterns(): string[] {
    return [
      'bot-dashboard',
      'bot-config',
      'bot-skills',
      'bot-analytics',
      'bot-widget-setup',
      'bot-model-status',
      'bot-training-jobs',
    ];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): BotService {
    if (!BotService.instance) {
      BotService.instance = new BotService();
    }
    return BotService.instance;
  }

  // Dashboard
  async getDashboard(tenantId: string): Promise<BotDashboard> {
    const cacheKey = `bot-dashboard-${tenantId}`;
    const result = await this.makeTenantRequest<BotDashboard>(
      `/api/tenants/${tenantId}/bot/dashboard`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  // Configuration
  async getConfig(tenantId: string): Promise<BotConfig> {
    const cacheKey = `bot-config-${tenantId}`;
    const result = await this.makeTenantRequest<BotConfig>(
      `/api/tenants/${tenantId}/bot/config`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async updateConfig(tenantId: string, data: BotConfigInput): Promise<BotConfig> {
    const result = await this.makeTenantRequest<BotConfig>(
      `/api/tenants/${tenantId}/bot/config`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  // Skills
  async listSkills(tenantId: string): Promise<BotSkill[]> {
    const cacheKey = `bot-skills-${tenantId}`;
    const result = await this.makeTenantRequest<BotSkill[]>(
      `/api/tenants/${tenantId}/bot/skills`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async updateSkill(tenantId: string, skillId: string, data: SkillConfigInput): Promise<BotSkill> {
    const result = await this.makeTenantRequest<BotSkill>(
      `/api/tenants/${tenantId}/bot/skills/${skillId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  // Analytics
  async getAnalytics(tenantId: string, range: string): Promise<BotAnalytics> {
    const cacheKey = `bot-analytics-${tenantId}-${range}`;
    const result = await this.makeTenantRequest<BotAnalytics>(
      `/api/tenants/${tenantId}/bot/analytics`,
      { method: 'GET', params: { range } },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  // Widget Setup
  async getWidgetSetup(tenantId: string): Promise<WidgetSetup> {
    const cacheKey = `bot-widget-setup-${tenantId}`;
    const result = await this.makeTenantRequest<WidgetSetup>(
      `/api/tenants/${tenantId}/bot/widget`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async updateWidgetSetup(tenantId: string, data: WidgetSetupInput): Promise<WidgetSetup> {
    const result = await this.makeTenantRequest<WidgetSetup>(
      `/api/tenants/${tenantId}/bot/widget`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  // Model Status
  async getModelStatus(tenantId: string): Promise<ModelStatus> {
    const cacheKey = `bot-model-status-${tenantId}`;
    const result = await this.makeTenantRequest<ModelStatus>(
      `/api/tenants/${tenantId}/bot/model`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }
}

export const botService = BotService.getInstance();
```

### `PublicBotService.ts` — Public Widget Pattern

```ts
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

class PublicBotService extends PublicApiSingleton {
  private static instance: PublicBotService;

  private constructor() {
    super('public-bot-service', { ttl: 15 * 60 * 1000 });
  }

  getServiceCachePatterns(): string[] {
    return [
      'public-bot-config',
      'public-bot-session',
    ];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): PublicBotService {
    if (!PublicBotService.instance) {
      PublicBotService.instance = new PublicBotService();
    }
    return PublicBotService.instance;
  }

  async getBotConfig(tenantId: string): Promise<PublicBotConfig> {
    const cacheKey = `public-bot-config-${tenantId}`;
    const result = await this.makePublicRequest<PublicBotConfig>(
      `/api/public/tenants/${tenantId}/bot/config`,
      { method: 'GET' },
      cacheKey,
      15 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async sendMessage(tenantId: string, sessionId: string, message: string): Promise<BotResponse> {
    const result = await this.makePublicRequest<BotResponse>(
      `/api/public/tenants/${tenantId}/bot/chat`,
      { method: 'POST', body: JSON.stringify({ sessionId, message }) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }
}

export const publicBotService = PublicBotService.getInstance();
```

### Rules

1. **No direct `fetch`**: All HTTP calls go through the inherited request methods (`makeTenantRequest`, `makePublicRequest`, `makeAdminRequest`, `makeAuthenticatedRequest`, `makeDefaultRequest`). The base class injects headers, handles retries, normalizes errors, and manages cache.
2. **Cache keys are explicit**: Every `GET` passes a deterministic `cacheKey`. Mutations skip cache (no key) and **must** call `await this.invalidateServiceCaches()` on success.
3. **Singleton access**: Export `const botService = BotService.getInstance()` at module level. Components import the instance.
4. **Error normalization**: Check `result.success`; throw with `getErrorMessage(result.error)`.
5. **Type-safe responses**: Every request is generic `makeXxxRequest<T>(...)`. Response `data` is typed `T | undefined`.

---

## Persistence

Saved as: `c:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\docs\CHATBOT_MERCHANT_UIUX.md`
