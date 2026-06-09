# Merchant-Aware Chatbot Platform — Platform Admin UI/UX Design

## UX Overview

- **Global model orchestration**: Platform admins manage the full stack: guardrails, intents, model registry, training queue, tenant assignments, and deployment health.
- **Tier-based routing as policy, widget-universal**: Every tenant gets the bot widget AND the FAQ knowledge base. The widget is active for all tiers. Free tier responses are static FAQ lookup (no AI model). Starter+ unlock AI models (shared dynamic → LoRA → dedicated). The platform defines which model serves which tier. Admins can override per tenant, force training, or disable auto-scaling.
- **Training queue as first-class UI**: LoRA fine-tuning and dedicated model provisioning are not background ops — they are visible, monitorable, and actionable jobs.
- **Skill registry**: Platform admins define skills (entry points, schemas, required capabilities, tier gates). Merchants opt in to available skills.
- **Deployment monitor**: Real-time model serving status, GPU utilization, latency, error rates across all model instances.

---

## Mental Model

**Pipeline-as-platform.** Every chat flows through: Guardrails (universal, BERT-powered) → Intent Classification (universal, BERT-powered) → FAQ RAG Retrieval → Tier Router → Model Selector → Skill Executor → Response Formatter. Guardrails and intent classification are global infrastructure — they run for all bot merchants regardless of tier. The admin UI controls each stage, including the knowledge base index that feeds the retrieval layer. The tier gate (Free → Starter → Pro → Enterprise) applies after intent classification, gating which model generates the response.

---

## Navigation

**Sidebar** (`/settings/admin/`): New "Bot Platform" section with: Dashboard, Guardrail Rules, Intent Registry, Knowledge Base Registry, Model Registry, Training Queue, Tenant Assignments, Skill Registry, Deployment Monitor.

---

## Screen Inventory

| Screen | Purpose | Entry Point |
|---|---|---|
| Bot Platform Dashboard | Global stats: conversations/day, active models, training queue, skill usage | `/settings/admin/bot-platform` |
| Guardrail Rules | Universal safety rules, banned phrases, PII detection, moderation thresholds | `/settings/admin/bot-platform/guardrails` |
| Intent Registry | Global intent taxonomy, training examples, confidence thresholds | `/settings/admin/bot-platform/intents` |
| Knowledge Base Registry | Tenant FAQ indexes, embedding pipeline, RAG config, coverage stats | `/settings/admin/bot-platform/knowledge` |
| Model Registry | All deployed models: shared base, LoRA adapters, dedicated instances | `/settings/admin/bot-platform/models` |
| Training Queue | Active jobs, LoRA runs, dedicated provisioning, logs | `/settings/admin/bot-platform/training` |
| Tenant Assignments | Tenants → model tier mappings, volume stats, auto-scale toggles | `/settings/admin/bot-platform/assignments` |
| Skill Registry | Global skill definitions, version history, required capabilities | `/settings/admin/bot-platform/skills` |
| Deployment Monitor | Real-time serving status, GPU, latency, errors | `/settings/admin/bot-platform/deployments` |

---

## ASCII Wireframes

### Screen 1: Bot Platform Dashboard

```
+----------------------------------------------------------------------------------+
|  Bot Platform — Global Dashboard                                                   |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  +--------+  +--------+  +--------+  +--------+  +--------+  +--------+        |
|  | 124K   |  |  842   |  |  4.2K  |  |  12    |  |  3     |  | 99.99% |        |
|  | Convos |  | Tenants|  | Active |  | LoRA   |  | Ded.   |  | Uptime  |        |
|  | /day   |  | w/ Bot |  | Models |  | Adapters|  | Models |  |         |        |
|  +--------+  +--------+  +--------+  +--------+  +--------+  +--------+        |
|                                                                                  |
|  +--------------------------------------+  +----------------------------------+  |
|  |  Model Tier Distribution (donut)     |  |  Training Queue Status             |  |
|  |                                      |  |                                  |  |
|  |    [██ Static 45%]                   |  |  [████████████        ] 4/8 jobs  |  |
|  |    [██ Shared 35%]                   |  |  [████████            ] 2/8 jobs  |  |
|  |    [██ LoRA 15%]                     |  |  [                    ] 0/8 jobs  |  |
|  |    [██ Dedicated 5%]                 |  |  ...                             |  |
|  |                                      |  |  [Manage Queue]                  |  |
|  |  [View Assignments]                  |  |                                  |  |
|  +--------------------------------------+  +----------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Alert: 3 tenants approaching LoRA threshold (8,500+ convos)              |  |
|  |  [Review]  [Auto-approve training]  [Dismiss]                               |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Top Intents (Global, 24h)                                                   |  |
|  |  Product Search ........... 34%    Inventory Query .......... 22%               |  |
|  |  Order Status ............. 18%    Store Hours ............. 12%               |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

- **Stats row**: Global volume, tenant count, active models, adapter count, dedicated count, uptime.
- **Donut chart**: Tier distribution with drill-down to assignments. "Static" = Free tier merchants (widget active, static FAQ responses, no AI model).
- **Training queue**: Progress bars per active job. Click "Manage Queue" to jump to queue screen.
- **Alerts**: Proactive notifications for tenants nearing auto-scaling thresholds.

---

### Screen 2: Guardrail Rules

```
+----------------------------------------------------------------------------------+
|  Bot Platform — Guardrail Rules                                                    |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  [+ Add Rule]  [Import from File]  [Export Rules]                                 |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Rule                | Type         | Severity  | Status   | Tenants   |  |  |
|  |----------------------|--------------|-----------|----------|-----------|--|  |
|  |  Block hate speech   | Content      | Block     | Active   | All       |  |
|  |  PII detection       | Data safety  | Mask      | Active   | All       |  |
|  |  Competitor mentions | Content      | Flag      | Active   | All       |  |
|  |  Medical advice      | Content      | Block     | Active   | All       |  |
|  |  Custom: no pricing  | Business     | Warn      | Active   | 12        |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Rule Editor — Block hate speech                                                 |
|  +----------------------------------------------------------------------------+  |
|  |  Name: Block hate speech                                                       |  |
|  |  Type: [Content ▼]  Severity: [Block ▼]  Status: [Active ▼]                |  |
|  |  Applies to: (•) All tenants  ( ) Specific tenants [select...]                |  |
|  |                                                                              |  |
|  |  Patterns (regex or phrase list):                                            |  |
|  |  [hate|offensive|slur|...                                    ]                |  |
|  |  [Add pattern]                                                                 |  |
|  |                                                                              |  |
|  |  Response when triggered:                                                      |  |
|  |  [I'm not able to discuss that. How can I help you today?     ]                |  |
|  |                                                                              |  |
|  |  Action: (•) Block message  ( ) Log and flag  ( ) Escalate to human        |  |
|  |  [Save]  [Delete]                                                            |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

- **Rule table**: Name, type (content / data safety / business), severity (block / mask / flag / warn), status, tenant scope.
- **Inline editor**: Clicking a row expands editor without navigation. Supports regex patterns, response templates, and action selection.
- **Tenant scoping**: Rules can be global or tenant-specific.

---

### Screen 3: Intent Registry

```
+----------------------------------------------------------------------------------+
|  Bot Platform — Intent Registry                                                      |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  [+ Register Intent]  [Bulk Import Examples]  [Export Taxonomy]                  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Intent              | Category    | Examples | Confidence | Skills     |  |  |
|  |----------------------|-------------|------------|------------|------------|--|  |
|  |  product.search      | Product     | 42         | 0.94       | product-s  |  |
|  |  inventory.check     | Inventory   | 28         | 0.91       | inventory  |  |
|  |  order.status        | Order       | 35         | 0.96       | order-trk  |  |
|  |  store.hours         | General     | 18         | 0.89       | booking    |  |
|  |  competitor.compare  | Comparison  | 12         | 0.82       | cross-merc |  |
|  |  ...                                                                              |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Intent Detail — product.search                                                    |
|  +----------------------------------------------------------------------------+  |
|  |  Description: User wants to find a product by description, name, or category  |  |
|  |  Confidence threshold: [0.85]  (below this, fallback intent triggers)         |  |
|  |                                                                              |  |
|  |  Training Examples (42 total):                                                 |  |
|  |  • "do you have organic milk?"                                               |  |
|  |  • "I'm looking for gluten free bread"                                       |  |
|  |  • "what wines do you carry?"                                                |  |
|  |  • [+ Add example]  [Import from CSV]                                       |  |
|  |                                                                              |  |
|  |  Mapped Skills: product-search (v2.1.0)                                      |  |
|  |  [Edit Mapping]  [Retrain Classifier]                                        |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

- **Taxonomy table**: Intent name, category, example count, avg confidence, mapped skill.
- **Detail panel**: Description, confidence threshold, training examples, mapped skill version.
- **Retrain**: Button to trigger a new training run for the intent classifier (ModernBERT) when examples are updated.

---

### Screen 4: Knowledge Base Registry

```
+----------------------------------------------------------------------------------+
|  Bot Platform — Knowledge Base Registry                                            |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  +--------+  +--------+  +--------+  +--------+  +--------+                    |
|  | 842    |  |  47K   |  |  12    |  |  99.2% |  |  2.3ms |                    |
|  | Tenants|  |  FAQs  |  | Rebuild|  | Avg    |  | Avg    |                    |
|  | w/ KB  |  | indexed|  | queued |  | Coverage|  | Retrieval|                   |
|  +--------+  +--------+  +--------+  +--------+  +--------+                    |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Embedding Pipeline Config                                                   |  |
|  |  Model: [text-embedding-3-small ▼]    Chunk size: [512 ▼]    Overlap: [50 ▼]|  |
|  |  [☑] Auto-rebuild on FAQ save    [☑] Include product metadata in chunks     |  |
|  |  [Rebuild All Indexes]  [Pause Auto-Sync]                                    |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Tenant FAQ Indexes                                                          |  |
|  |  Tenant              | Entries | Last Sync | Coverage | Status   | Actions   |  |
|  |----------------------|-----------|-----------|----------|----------|-----------|  |
|  |  Acme Grocery        | 47        | 2h ago    | 87%      | Active   | [Rebuild] |  |
|  |  BrightMart          | 112       | 1d ago    | 94%      | Active   | [Rebuild] |  |
|  |  Corner Deli         | 23        | 3d ago    | 61%      | Stale    | [Rebuild] |  |
|  |  Downtown Pharmacy   | 89        | 5h ago    | 91%      | Active   | [Rebuild] |  |
|  |  ...                                                                              |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Global Coverage Distribution (histogram)                                    |  |
|  |  <50% [██        ] 12 tenants   50-70% [████      ] 45 tenants                |  |
|  |  70-85% [████████] 218 tenants  85-95% [██████    ] 142 tenants              |  |
|  |  >95% [████      ] 87 tenants                                                |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

- **Stats row**: Tenants with KB, total FAQs indexed, rebuilds queued, average coverage score, average retrieval latency.
- **Embedding pipeline config**: Model selector (text-embedding-3-small / text-embedding-3-large), chunk size, overlap, auto-rebuild toggle, product metadata inclusion toggle.
- **Tenant FAQ indexes table**: Per-tenant index status. "Stale" = last sync >24h or FAQ count changed since last sync. "Active" = index is current.
- **Coverage distribution**: Histogram showing how many tenants fall into each coverage bucket. Click a bar to filter the tenant table.
- **Rebuild actions**: Per-tenant rebuild triggers an async embedding job. "Rebuild All" queues a global rebuild.
- **RAG guardrails**: Tab (not shown) to configure global FAQ retrieval rules: max top-k, min confidence, banned FAQ categories, PII redaction in FAQ answers.

---

### Screen 5: Model Registry

```
+----------------------------------------------------------------------------------+
|  Bot Platform — Model Registry                                                     |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  Filters: [Type ▼] [Status ▼] [Base Model ▼]                                    |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Model ID        | Type       | Base           | Status   | Tenants   | Latency|  |
|  |------------------|------------|----------------|----------|-----------|--------|  |
|  | modernbert-base  | Base       | —              | Active   | 590       | —      |  |
|  | shared-dynamic-1 | Shared     | modernbert-base| Active   | 380       | 220ms  |  |
|  | shared-dynamic-2 | Shared   | modernbert-base| Active   | 295       | 210ms  |  |
|  | lora-acme-v3     | LoRA       | modernbert-base| Active   | 1         | 180ms  |  |
|  | lora-beta-v2     | LoRA       | modernbert-base| Active   | 1         | 185ms  |  |
|  | dedicated-delta-1| Dedicated  | modernbert-base| Active   | 1         | 95ms   |  |
|  | dedicated-gamma-1| Dedicated  | modernbert-base| Standby  | 1         | —      |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Model Detail — lora-acme-v3                                                       |
|  +----------------------------------------------------------------------------+  |
|  |  Tenant: Acme Grocery                                                          |  |
|  |  Adapter path: /models/lora/acme-grocery/v3                                   |  |
|  |  Training job: tr-4820 (completed Jun 3)                                      |  |
|  |  Dataset: 3,200-4,100 conversations                                            |  |
|  |  Serving endpoint: /v1/models/lora-acme-v3                                    |  |
|  |  [View Logs]  [Promote to Dedicated]  [Retrain]  [Deactivate]                  |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

- **Model table**: ID, type (base / shared / LoRA / dedicated), base model, status, tenant count, avg latency.
- **Detail panel**: Tenant mapping, adapter path, training job link, dataset range, serving endpoint.
- **Actions**: Promote LoRA to dedicated, retrain, deactivate. Dedicated models show GPU allocation.

---

### Screen 6: Training Queue

```
+----------------------------------------------------------------------------------+
|  Bot Platform — Training Queue                                                     |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  Filters: [Status ▼] [Type ▼] [Tenant ▼]  [Refresh]                           |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Job ID    | Tenant         | Type      | Status    | Progress   | ETA    |  |
|  |------------|----------------|-----------|-----------|------------|--------|  |
|  | tr-4821    | Acme Grocery   | LoRA      | Running   | [████75%]  | 12m    |  |
|  | tr-4820    | Beta Books     | LoRA      | Complete  | [████100%] | Done   |  |
|  | tr-4819    | Gamma Gear     | Dedicated | Queued    | [0%]       | ~2h    |  |
|  | tr-4818    | Delta Deli     | LoRA      | Failed    | [██60%]    | Retry  |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Job Details — tr-4821 (Acme Grocery, LoRA)                                      |
|  +----------------------------------------------------------------------------+  |
|  |  Started: Jun 6, 11:00 AM                                                      |  |
|  |  Dataset: 3,200-4,100 conversations (890 new since last train)              |  |
|  |  Base model: ModernBERT-base                                                   |  |
|  |  Target adapter: lora-acme-grocery-v4                                         |  |
|  |  GPU: A100-40GB (node-7)                                                       |  |
|  |  [View real-time logs]                                                         |  |
|  |  [Cancel Job]  [Pause]  [Promote Priority]                                   |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

- **Queue table**: All jobs with status, progress bar, ETA. Clicking a row expands details.
- **Real-time logs**: Streaming training logs in a collapsible drawer or inline panel.
- **Actions**: Cancel, pause, promote priority. Failed jobs show "Retry" with error summary.

---

### Screen 7: Tenant Model Assignments

```
+----------------------------------------------------------------------------------+
|  Bot Platform — Tenant Model Assignments                                           |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  [Search tenants...    ] [Tier ▼] [Auto-scale ▼]                              |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Tenant         | Tier      | Assigned Model     | Convos/mo | Auto-Scale |  |
|  |-----------------|-----------|--------------------|-----------|------------|  |
|  |  Acme Grocery   | Pro       | lora-acme-v3       | 4,231     | [● On]     |  |
|  |  Beta Books     | Starter   | shared-dynamic-1   | 1,100     | [● On]     |  |
|  |  Gamma Gear     | Free      | static-v2          | 340       | [  Off]    |  |
|  |  Delta Deli     | Enterprise| dedicated-delta-1  | 15,400    | [● On]     |  |
|  |  Epsilon Ent.   | Pro       | lora-eps-v1        | 2,050     | [● On]     |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Bulk Actions: [Force LoRA Training]  [Downgrade to Shared]  [Export CSV]       |
|                                                                                  |
|  Assignment Detail — Acme Grocery                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Subscription: Professional                                                    |  |
|  |  Auto-scale policy: [☑] Enable LoRA at 2,000 convos                          |  |
|  |                     [☑] Enable Dedicated at 10,000 convos                      |  |
|  |  Override: ( ) Use shared model  (•) Use LoRA  ( ) Use Dedicated            |  |
|  |  [Save Override]  [Reset to Policy]                                          |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

- **Assignment table**: Tenant, tier, assigned model, volume, auto-scale toggle.
- **Capability column (optional)**: Shows resolved chatbot capability state (`chatbot_static_lookup`, `chatbot_shared_dynamic`, etc.) per tenant. Clicking opens a detail panel with the full capability breakdown.
- **Bulk actions**: Force training, manual tier override, export.
- **Auto-scale policy**: Per-tenant toggles for each threshold. Admins can override the policy for individual tenants.
- **Capability resolution**: The platform uses `CapabilityResolutionService` to resolve each tenant's allowed chatbot features from `tier_features_list`. Admins can view the resolved capability state but cannot edit it directly — it is derived from the tenant's subscription tier.

---

### Screen 8: Skill Registry

```
+----------------------------------------------------------------------------------+
|  Bot Platform — Skill Registry                                                     |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  [+ Register New Skill]                                                            |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Skill        | Version | Required Capabilities   | Tenants Using | Status  |  |
|  |---------------|---------|-------------------------|---------------|---------|  |
|  | product-search| 2.1.0   | api:products, ai:embed  |  412          | Active  |  |
|  | inventory     | 1.4.2   | api:inventory           |  380          | Active  |  |
|  | order-tracking| 1.0.5   | api:orders              |  290          | Active  |  |
|  | cross-merchant| 0.9.0   | api:directory, ai:llm |   12          | Beta    |  |
|  | booking       | 1.2.0   | api:hours, ai:nlp     |  150          | Active  |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Skill Detail — product-search v2.1.0                                              |
|  +----------------------------------------------------------------------------+  |
|  |  Description: Natural language product search with embedding-based matching  |  |
|  |  Entry point: POST /api/skills/product-search                                |  |
|  |  Parameters: query, max_results, filters (category, price_range, in_stock)   |  |
|  |  Tier gates: Starter+ (shared), Pro+ (LoRA-optimized embeddings)              |  |
|  |  Featured awareness: [☑] Joins mv_featured_products                           |  |
|  |  Capability gate: featured_store_selection, quickstart_wizard_ai              |  |
|  |  Tenant status gates: Active, Trial (full); Suspended (graceful degrade)    |  |
|  |  [Edit Schema]  [View Usage Logs]  [Deprecate]                                |  |
|  +----------------------------------------------------------------------------+  |
+----------------------------------------------------------------------------------+
```

- **Skill table**: Name, version, required capabilities (API + AI), adoption count, status.
- **Skill data layer**: Every skill is backed by a public API endpoint (`/api/public/skills/:skillName`) and a materialized view (MV) for sub-100ms response times. The MV pattern isolates read-heavy skill queries from the transactional database. Refresh cadence is per-skill: product inventory (5 min), product search (15 min), store hours (1 hour), order status (real-time).
- **Featured-aware product skills**: Product search, inventory, and recommendation skills join the `mv_featured_products` materialized view. Skills can surface featured items first (`featured_store_selection`, `featured_sale`, `featured_new_arrival`) or include platform algorithmic features (`featured_bestseller`, `featured_trending`, `featured_recommended`) when the tenant's tier allows.
- **Capability-aware skills**: Each skill declares a `capability_gate` array (e.g., `featured_store_selection`, `quickstart_wizard_ai`, `featured_bestseller`). The skill execution layer resolves the tenant's capability state from `CapabilityResolutionService` before executing. If a capability is gated, the skill silently omits that feature rather than failing.
- **Tenant-status-aware skills**: Skills declare `tenant_status_gates` (Active, Trial, Suspended, Past-due). Active/Trial = full execution. Suspended = graceful degradation (static message, no DB query). Past-due = full execution (customer-facing continuity) with merchant-only billing warning.
- **Detail panel**: Schema, parameters, tier gates, capability gates, featured awareness toggles, tenant status gates, backing MV/endpoint configuration, and refresh policies. Platform admins edit all gates and policies.
- **Register new skill**: Dialog for defining a new skill with OpenAPI-like schema, required capabilities, capability gates, featured-awareness toggles, tenant-status gates, backing MV selector, and refresh cadence.

---

### Screen 9: Deployment Monitor

```
+----------------------------------------------------------------------------------+
|  Bot Platform — Deployment Monitor                                                 |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Model Instance    | Node     | GPU      | RPS    | Latency  | Errors   |  |
|  |--------------------|----------|----------|--------|----------|----------|  |
|  | modernbert-base-1  | gpu-01   | A100 40G | 45.2   | 210ms    | 0.01%    |  |
|  | modernbert-base-2  | gpu-02   | A100 40G | 42.8   | 220ms    | 0.02%    |  |
|  | lora-acme-v3       | gpu-03   | A100 40G | 12.4   | 180ms    | 0.00%    |  |
|  | lora-beta-v2       | gpu-03   | A100 40G | 8.1    | 185ms    | 0.00%    |  |
|  | dedicated-delta-1  | gpu-04   | A100 80G | 85.6   | 95ms     | 0.00%    |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  +----------------------------------+  +--------------------------------------+  |
|  |  GPU Utilization (bar chart)     |  |  Request Latency Distribution (hist)|  |
|  |  gpu-01 [██████████ 92%]         |  |  <50ms: 12%                          |  |
|  |  gpu-02 [████████░░ 84%]         |  |  50-100ms: 18%                       |  |
|  |  gpu-03 [██████░░░░ 65%]         |  |  100-200ms: 45%                      |  |
|  |  gpu-04 [██████████ 96%]         |  |  200-500ms: 22%                      |  |
|  +----------------------------------+  |  >500ms: 3%                          |  |
|                                        +--------------------------------------+  |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Alerts                                                                        |  |
|  |  ⚠ gpu-04 at 96% utilization — consider scaling dedicated-delta-1 to 2nd node |  |
|  |  ⚠ lora-beta-v2 error rate spike: 0.15% in last 5 min — investigate           |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

- **Instance table**: Every serving model instance with node, GPU type, requests/sec, latency, error rate.
- **GPU utilization**: Per-node bar chart showing load.
- **Latency histogram**: Distribution of response times across all model types.
- **Alerts**: Real-time anomaly alerts with suggested actions.

---

## Auto-Scaling Configuration (Admin)

```
+----------------------------------------------------------------------------------+
|  Auto-Scaling Policy                                                               |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  Bot Tier Thresholds (conversations per rolling 30 days):                       |
|  Free tier = bot widget with static FAQ responses (no AI model). Does not count toward thresholds. |
|                                                                                  |
|  Starter → Shared Dynamic:   [500   ] conversations                            |
|  Shared Dynamic → LoRA:      [2,000 ] conversations                            |
|  LoRA → Dedicated:            [10,000] conversations                            |
|                                                                                  |
|  [☑] Automatically queue LoRA training when threshold crossed                    |
|  [☑] Automatically provision dedicated model when threshold crossed              |
|  [  ] Require admin approval before LoRA training                              |
|  [☑] Require admin approval before dedicated model provisioning                  |
|                                                                                  |
|  LoRA Training Defaults                                                            |
|  Batch size: [16 ▼]    Epochs: [3 ▼]    Learning rate: [0.0001]                |
|  Dataset window: last [2,000] conversations (most recent used for fine-tuning)    |
|                                                                                  |
|  Dedicated Model Defaults                                                          |
|  GPU type: [A100-80GB ▼]    Min replicas: [2]    Max replicas: [10]               |
|  Auto-scale replicas at RPS: [50] per instance                                  |
|                                                                                  |
|  [Save Policy]  [Reset to Defaults]                                              |
+----------------------------------------------------------------------------------+
```

- **Threshold configuration**: Platform admin sets the volume gates between tiers.
- **Approval gates**: Auto-queue vs require admin approval (recommended for dedicated due to cost).
- **LoRA defaults**: Batch size, epochs, LR, dataset window. Affects all auto-triggered LoRA jobs.
- **Dedicated defaults**: GPU type, replica bounds, RPS-based auto-scaling.

---

## Interaction States

| State | Behavior |
|---|---|
| Training job queued | Row shows "Queued" with estimated start time based on queue depth |
| Training job running | Progress bar updates every 10s; real-time logs stream in detail panel |
| Training job failed | Red status badge; error summary expandable; "Retry" and "Investigate" actions |
| Training job complete | Green badge; "Promote to serving" button (if not auto-promoted) |
| Model instance unhealthy | Deployment monitor row turns amber; alert generated; auto-failover if replica exists |
| GPU at capacity | Alert: "gpu-04 at 96% — new dedicated model provisioning blocked until capacity freed" |
| Tenant override active | Assignment row shows "Override" badge; "Reset to Policy" action available |
| Skill deprecated | Status = Deprecated; tenants using it see warning in their Skills UI |
| Guardrail rule triggered (global) | Alert log shows rule, tenant, message snippet (PII masked), action taken |
| Free tier tenant (static mode) | Tenant Assignments row shows "Static" badge; widget active; no AI model assigned; no GPU usage |
| Free tier → Starter upgrade | Assignment row transitions from "Static" to "Shared Dynamic" after upgrade processed |
| FAQ index rebuild queued | Knowledge Base Registry shows yellow "Queued" badge with tenant name |
| FAQ index rebuild complete | Green badge; coverage score updates; AI model becomes available for that tenant |

---

## Frontend Service Pattern (Singleton + Caching, No Direct Fetch)

All bot-platform admin frontend services **extend an appropriate base singleton** and **never call `fetch()` directly**. Requests go through the inherited method on the base class, which handles auth headers, caching, and error normalization.

### Base Class Selection

| Service Scope | Extends | Default Request Method | Cache TTL |
|---|---|---|---|
| Bot Platform Admin (global orchestration) | `AdminApiSingleton` | `this.makeAdminRequest<T>()` or `this.makeDefaultRequest<T>()` | 5 min |

### `BotPlatformAdminService.ts` — Full Pattern

```ts
import { AdminApiSingleton } from '@/providers/base/AdminApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

class BotPlatformAdminService extends AdminApiSingleton {
  private static instance: BotPlatformAdminService;

  private constructor() {
    super('bot-platform-admin-service', { ttl: 5 * 60 * 1000 });
  }

  getServiceCachePatterns(): string[] {
    return [
      'bot-platform-dashboard',
      'bot-platform-guardrails',
      'bot-platform-intents',
      'bot-platform-models',
      'bot-platform-training',
      'bot-platform-assignments',
      'bot-platform-skills',
      'bot-platform-deployments',
      'bot-platform-autoscaling',
    ];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): BotPlatformAdminService {
    if (!BotPlatformAdminService.instance) {
      BotPlatformAdminService.instance = new BotPlatformAdminService();
    }
    return BotPlatformAdminService.instance;
  }

  // Dashboard
  async getDashboard(): Promise<BotPlatformDashboard> {
    const cacheKey = 'bot-platform-dashboard';
    const result = await this.makeDefaultRequest<BotPlatformDashboard>(
      '/api/admin/bot-platform/dashboard',
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  // Guardrail Rules
  async listGuardrailRules(): Promise<GuardrailRule[]> {
    const cacheKey = 'bot-platform-guardrails';
    const result = await this.makeDefaultRequest<GuardrailRule[]>(
      '/api/admin/bot-platform/guardrails',
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async createGuardrailRule(data: GuardrailRuleInput): Promise<GuardrailRule> {
    const result = await this.makeDefaultRequest<GuardrailRule>(
      '/api/admin/bot-platform/guardrails',
      { method: 'POST', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  // Intent Registry
  async listIntents(): Promise<Intent[]> {
    const cacheKey = 'bot-platform-intents';
    const result = await this.makeDefaultRequest<Intent[]>(
      '/api/admin/bot-platform/intents',
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async updateIntent(intentId: string, data: IntentInput): Promise<Intent> {
    const result = await this.makeDefaultRequest<Intent>(
      `/api/admin/bot-platform/intents/${intentId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  // Model Registry
  async listModels(): Promise<BotModel[]> {
    const cacheKey = 'bot-platform-models';
    const result = await this.makeDefaultRequest<BotModel[]>(
      '/api/admin/bot-platform/models',
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  // Training Queue
  async getTrainingQueue(): Promise<TrainingJob[]> {
    const cacheKey = 'bot-platform-training';
    const result = await this.makeDefaultRequest<TrainingJob[]>(
      '/api/admin/bot-platform/training',
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async cancelTrainingJob(jobId: string): Promise<void> {
    const result = await this.makeDefaultRequest<void>(
      `/api/admin/bot-platform/training/${jobId}/cancel`,
      { method: 'POST' }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
  }

  // Tenant Assignments
  async getTenantAssignments(): Promise<TenantAssignment[]> {
    const cacheKey = 'bot-platform-assignments';
    const result = await this.makeDefaultRequest<TenantAssignment[]>(
      '/api/admin/bot-platform/assignments',
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async updateTenantAssignment(tenantId: string, data: AssignmentOverrideInput): Promise<TenantAssignment> {
    const result = await this.makeDefaultRequest<TenantAssignment>(
      `/api/admin/bot-platform/assignments/${tenantId}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  // Skill Registry
  async listSkills(): Promise<PlatformSkill[]> {
    const cacheKey = 'bot-platform-skills';
    const result = await this.makeDefaultRequest<PlatformSkill[]>(
      '/api/admin/bot-platform/skills',
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async registerSkill(data: SkillRegistrationInput): Promise<PlatformSkill> {
    const result = await this.makeDefaultRequest<PlatformSkill>(
      '/api/admin/bot-platform/skills',
      { method: 'POST', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  // Deployment Monitor
  async getDeployments(): Promise<DeploymentStatus[]> {
    const cacheKey = 'bot-platform-deployments';
    const result = await this.makeDefaultRequest<DeploymentStatus[]>(
      '/api/admin/bot-platform/deployments',
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  // Auto-Scaling Policy
  async getAutoScalingPolicy(): Promise<AutoScalingPolicy> {
    const cacheKey = 'bot-platform-autoscaling';
    const result = await this.makeDefaultRequest<AutoScalingPolicy>(
      '/api/admin/bot-platform/autoscaling',
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async updateAutoScalingPolicy(data: AutoScalingPolicyInput): Promise<AutoScalingPolicy> {
    const result = await this.makeDefaultRequest<AutoScalingPolicy>(
      '/api/admin/bot-platform/autoscaling',
      { method: 'PUT', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }
}

export const botPlatformAdminService = BotPlatformAdminService.getInstance();
```

### Rules

1. **No direct `fetch`**: All HTTP calls go through `this.makeDefaultRequest<T>()` (or `makeAdminRequest`, `makeAuthenticatedRequest`, `makePublicRequest`, `makeTenantRequest`). The base class injects auth headers, handles retries, normalizes errors, and manages cache.
2. **Cache keys are explicit**: Every `GET` passes a deterministic `cacheKey`. Mutations (`POST`/`PATCH`/`PUT`/`DELETE`) skip cache (no key) and **must** call `await this.invalidateServiceCaches()` on success.
3. **Singleton access**: Export `const botPlatformAdminService = BotPlatformAdminService.getInstance()` at module level. Components import the instance.
4. **Error normalization**: Always check `result.success`; throw with `getErrorMessage(result.error)` so UI boundaries catch and render consistently.
5. **Type-safe responses**: Every request method is generic `makeDefaultRequest<T>(...)`. The response `data` field is typed as `T | undefined`.

---

## Tech Stack Notes (for Engineers)

- **Backend**: FastAPI (Python) for model serving, training orchestration, and skill execution.
- **Model serving**: ModernBERT-base with dynamic LoRA adapter swapping per request (based on tenant_id in JWT).
- **Dedicated models**: Separate FastAPI instances with warm-loaded full models; routed via tenant-specific DNS or path prefix.
- **FAQ RAG pipeline**: Tenant FAQ entries are chunked, embedded (OpenAI text-embedding-3-small), and stored in a per-tenant vector index (pgvector or Pinecone). Retrieval is top-k with re-ranking by confidence. The pipeline auto-rebuilds on FAQ mutation webhooks.
- **Knowledge base service**: `KnowledgeBaseService` manages embedding generation, index rebuilds, coverage scoring, and tenant-level RAG configuration. Exposes `/api/admin/bot-platform/knowledge/*` endpoints.
- **Skill data layer**: Each skill is backed by a public API endpoint (`/api/public/skills/:skillName`) that queries a materialized view (MV) for sub-100ms response times. MVs isolate read-heavy bot queries from transactional tables. Refresh cadence is per-skill and configurable by platform admins.
- **Capability resolution**: `CapabilityResolutionService` resolves tenant capability states (featured options, quickstart options, chatbot options, etc.) from `tier_features_list` + `subscription_tiers_list`. Skill execution and the merchant options page query this service before surfacing gated features. The service is cached per-tenant with a 5-minute TTL.
- **Chatbot capability service**: `ChatbotOptionsService` (backend) and `ChatbotCapabilityResolutionService` (frontend) manage the `chatbot_options` capability type. Follows the same pattern as `FeaturedOptionsService` and `QuickstartOptionsService`.
- **Singleton pattern**: PlatformApiSingleton for admin API calls; TenantBotService for merchant-facing API.
- **Training orchestration**: Celery/RQ workers or Kubernetes Jobs for LoRA fine-tuning; Helm for dedicated model deployment.
- **Shadow DOM widget**: Vanilla JS bundle (`widget.js`) injected into merchant pages. Communicates with bot API via `postMessage` + fetch.

---

## Persistence

Saved as: `c:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\docs\CHATBOT_PLATFORM_ADMIN_UIUX.md`
