# Tenant FAQ Management — UI/UX Design Document

## UX Overview

- **Dual-scope mental model**: FAQs live at two levels — Storefront (tenant-wide, visible on merchant homepage) and Product (item-specific, visible on product detail pages). Users create and manage both from one hub but understand the separation.
- **Template-driven authoring**: Merchants start from category templates (Shipping, Returns, Sizing, Ingredients) rather than blank forms; reduces writer's block and ensures consistent coverage.
- **Structured data first**: Every FAQ is stored as name-value pairs (question → answer) with optional metadata (category, tags, scope, product_ids). The bot preview renders these as conversational cards, not free text.
- **Gap analysis as a product**: The gap report is not an afterthought — it is a first-class screen that surfaces unanswered customer questions from bot interactions, ranked by frequency, so merchants know exactly what to write next.
- **Wizard-native flow**: FAQ creation is embedded inside the existing product wizard and a new storefront wizard; merchants do not leave their primary workflow to populate FAQs.

---

## Main Mental Model

**Question-centric, scope-aware inventory.**

A merchant thinks: "What questions do my customers ask?" and "Where should the answer appear?"

- The FAQ is an **inventory of questions** with two placement dimensions: **Storefront** (global) and **Product** (specific).
- A question can belong to a **template category** (e.g., Shipping) and optionally be linked to one or more products.
- The **bot preview** is a live test sandbox: the merchant types a customer question and sees which FAQ entry the bot would surface, with a confidence score.
- The **gap report** is a demand signal: it shows what customers are asking that the merchant has not yet answered.

---

## Primary Navigation Pattern

**Sidebar (merchant tenant scope) + Wizard Step (inline) + Tabbed Hub (dedicated FAQ page)**

- **Sidebar**: Under `/t/[tenantId]/`, the DynamicTenantSidebar gets a new "FAQ" entry under Settings or Content (merchant-facing). Gates: `IS_TENANT_MANAGER` or `CAN_MANAGE_TENANT_SETTINGS`.
- **Wizard Inline Step**: Inside the product wizard (`/t/[tenantId]/quick-start/products`) and a new storefront wizard, FAQ appears as a step with a compact table and "+ Add FAQ" button.
- **Dedicated FAQ Hub**: `/t/[tenantId]/settings/faq` is the full management page with tabs: Storefront FAQs | Product FAQs | Templates | Import | Bot Preview | Gap Report.

---

## Screen Inventory

| Screen | Purpose | Entry Point |
|---|---|---|
| FAQ Hub — Storefront Tab | Manage tenant-wide FAQs displayed on storefront | Sidebar → FAQ (default tab) |
| FAQ Hub — Product Tab | Manage and browse product-scoped FAQs | FAQ Hub → Product tab |
| FAQ Hub — Templates Tab | Browse category templates, apply to tenant | FAQ Hub → Templates tab |
| FAQ Hub — Import Tab | Upload CSV, map columns, preview, import | FAQ Hub → Import tab |
| FAQ Hub — Bot Preview | Sandbox: type question, see matched FAQ + confidence | FAQ Hub → Bot Preview tab |
| FAQ Hub — Gap Report | Unanswered queries per merchant, ranked by volume | FAQ Hub → Gap Report tab |
| FAQ Create/Edit Dialog | Name-value pair form with category, scope, product selector | "+ Add FAQ" button anywhere |
| Product Wizard — FAQ Step | Inline mini-FAQ manager during product creation | Product wizard step 4 (configurable) |
| Storefront Wizard — FAQ Step | Inline mini-FAQ manager during storefront setup | Storefront wizard step N |
| Storefront FAQ Display | Customer-facing accordion on tenant storefront | Public storefront page |
| Product Page FAQ Display | Customer-facing accordion on product detail | Public product page |

---

## Navigation & Layout (ASCII)

```
[App Shell: Merchant Sidebar + Topbar]
│
├─ Sidebar (DynamicTenantSidebar)
│  ├─ Dashboard
│  ├─ Products
│  ├─ Categories
│  ├─ Orders
│  ├─ Storefront
│  │  └─ Quick Start (wizard)
│  ├─ Settings
│  │  ├─ General
│  │  ├─ Business Hours
│  │  └─ FAQ  <-- NEW (full hub)
│  └─ ...
│
└─ Main Content Area
   │
   ├─ [FAQ Hub]
   │  ├─ Tab Bar (sticky)
   │  │  ├─ Storefront FAQs (default)
   │  │  ├─ Product FAQs
   │  │  ├─ Templates
   │  │  ├─ Import
   │  │  ├─ Bot Preview
   │  │  └─ Gap Report
   │  └─ Tab Content
   │
   ├─ [Product Wizard]
   │  ├─ Step 1: Basic Info
   │  ├─ Step 2: Images
   │  ├─ Step 3: Pricing
   │  ├─ Step 4: FAQ  <-- NEW inline step
   │  └─ Step 5: Review & Publish
   │
   ├─ [Storefront Wizard]
   │  ├─ Step 1: Theme
   │  ├─ Step 2: Hours
   │  ├─ Step 3: FAQ  <-- NEW inline step
   │  └─ Step 4: Review
   │
   ├─ [Storefront — Customer View]
   │  ├─ Hero / Products
   │  └─ FAQ Accordion (storefront-scoped entries only)
   │
   └─ [Product Page — Customer View]
      ├─ Product Images / Details
      ├─ Add to Cart
      └─ FAQ Accordion (product-scoped + relevant storefront-scoped entries)
```

---

## Key Screens — ASCII Wireframes

### Screen 1: FAQ Hub — Storefront Tab

```
+----------------------------------------------------------------------------------+
| FAQ Management                                                                   |
+----------------------------------------------------------------------------------+
| Storefront | Product | Templates | Import | Bot Preview | Gap Report            |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  [Search FAQs...      ] [Category ▼] [+ Add FAQ]                              |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Question                              | Category    | Status   | Actions  |  |
|  |----------------------------------------|-------------|----------|----------|  |
|  |  What are your store hours?            | General     | Active   | [E] [D]  |  |
|  |  Do you offer curbside pickup?           | Shipping    | Active   | [E] [D]  |  |
|  |  How do I return an item?              | Returns     | Draft    | [E] [D]  |  |
|  |  Do you ship internationally?          | Shipping    | Active   | [E] [D]  |  |
|  |  ...                                                                            |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Categories: General (2)  Shipping (2)  Returns (1)  [+ New Category]            |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

- **Layout**: Full-width content under sticky tab bar.
- **Table columns**: Question (truncated, hover for full), Category (badge), Status (Active/Draft badge), Actions (Edit / Delete / Preview).
- **Category pills**: Below table, filter by category. Clicking a pill filters the table.
- **Status**: Active = visible on storefront; Draft = saved but not visible.
- **Create**: "+ Add FAQ" opens a dialog. Questions are name-value pairs (question = name, answer = value).

---

### Screen 2: FAQ Create / Edit Dialog

```
+--------------------------------------------------------------------+
|  Add FAQ                                               [X]         |
+--------------------------------------------------------------------+
|                                                                    |
|  Scope (*)                                                          |
|  (•) Storefront (visible on tenant homepage)                       |
|  ( ) Product   (visible on specific product pages)                 |
|                                                                    |
|  [Product Selector (multi)]  <-- visible only if Product scope     |
|  [Search products...    ]                                          |
|  [ ] Organic Milk  [ ] Sourdough Bread  [ ] Free-Range Eggs       |
|                                                                    |
|  Category (*)                                                       |
|  [General          ▼]  or [+ New Category]                        |
|                                                                    |
|  Question (*)                                                       |
|  [Do you offer same-day delivery?                                ] |
|                                                                    |
|  Answer (*)                                                         |
|  [Yes, for orders placed before 2 PM within a 5-mile radius.       |
|   Delivery is free for orders over $35.                          ] |
|                                                                    |
|  Tags                                                               |
|  [shipping, delivery, local  ]  (comma-separated)                |
|                                                                    |
|  Status                                                             |
|  [• Active]  [  Draft]                                            |
|                                                                    |
|  +------------------------------------------------------------+    |
|  | Bot Preview — "How fast is delivery?"                       |    |
|  | → Matched: "Do you offer same-day delivery?" (confidence 94%)|    |
|  | Answer preview card rendered below                          |    |
|  +------------------------------------------------------------+    |
|                                                                    |
|                           [Cancel]    [Save Draft]   [Save & Active]|
+--------------------------------------------------------------------+
```

- **Scope selector**: Radio toggle. Selecting "Product" reveals a product multi-select checkbox grid (searchable, paginated if >20 products).
- **Category**: Dropdown of existing categories + inline "+ New Category" that becomes a text input.
- **Question / Answer**: Text input and textarea. The answer textarea supports basic markdown (bold, links, lists) via a minimal toolbar.
- **Bot Preview inline**: While typing the answer, a mini preview shows a sample customer query and the match confidence against this FAQ. Updates live on blur.
- **Actions**: Cancel, Save Draft, Save & Active. "Save & Active" is the primary CTA.

---

### Screen 3: FAQ Hub — Import Tab

```
+----------------------------------------------------------------------------------+
| FAQ Management                                                                   |
+----------------------------------------------------------------------------------+
| Storefront | Product | Templates | Import (active) | Bot Preview | Gap Report  |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  Step 1: Upload                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  [Drag CSV file here or click to browse]                                   |  |
|  |  Expected columns: question, answer, category, scope, product_sku (opt)  |  |
|  |  [Download Template CSV]                                                   |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Step 2: Map Columns                                                             |
|  +----------------------------------------------------------------------------+  |
|  |  File: faqs_june.csv  |  24 rows  |  3 columns detected                      |  |
|  |                                                                            |  |
|  |  Source Column      →  FAQ Field                                             |  |
|  |  [question_text   ▼] → Question (*)        [✓ matched]                     |  |
|  |  [answer_body     ▼] → Answer (*)           [✓ matched]                     |  |
|  |  [faq_category    ▼] → Category             [✓ matched]                     |  |
|  |  [— not mapped —  ▼] → Scope                [⚠ required — select]          |  |
|  |  [product_id      ▼] → Product SKU (opt)    [optional]                      |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Step 3: Preview                                                                 |
|  +----------------------------------------------------------------------------+  |
|  |  Row 1: "What are your hours?" → "Mon-Fri 9am-6pm" | Category: General       |  |
|  |  Row 2: "Do you ship?"       → "Yes, free over $35" | Category: Shipping      |  |
|  |  ...  [22 more rows]                                                        |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Step 4: Import                                                                  |
|  [Import 24 FAQs]  [Cancel]                                                     |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

- **Stepper layout**: 4 numbered steps (Upload → Map → Preview → Import). Steps 2-4 are disabled until the previous is complete.
- **Template download**: Link to download a CSV with correct headers and one sample row.
- **Column mapping**: Dropdown per detected CSV column mapping to FAQ fields. Required fields show validation.
- **Preview**: First 5 rows rendered as cards; "22 more rows" expandable.
- **Import button**: Shows count. On click, shows progress bar and then a summary: "24 imported, 2 skipped (duplicates)".

---

### Screen 4: Bot Preview Tab

```
+----------------------------------------------------------------------------------+
| FAQ Management                                                                   |
+----------------------------------------------------------------------------------+
| Storefront | Product | Templates | Import | Bot Preview (active) | Gap Report  |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  +----------------------------------+  +--------------------------------------+  |
|  |  Ask a Question                  |  |  Matched FAQ                         |  |
|  |                                  |  |                                      |  |
|  |  [How do I track my order?      ]|  |  +--------------------------------+  |  |
|  |                                  |  |  |  Question:                       |  |  |
|  |  [Ask]  [Clear]                  |  |  |  "How do I track my order?"    |  |  |
|  |                                  |  |  |                                  |  |  |
|  |  History:                        |  |  |  Answer:                         |  |  |
|  |  • "shipping cost" → Shipping    |  |  |  "Use the link in your email   |  |  |
|  |  • "return policy" → Returns     |  |  |   or visit /orders with your   |  |  |
|  |                                  |  |  |   order number."                 |  |  |
|  +----------------------------------+  |  |                                  |  |  |
|                                        |  |  Confidence: 97%  |  Source: Store |  |  |
|                                        |  |  [Show 2 other matches ↓]        |  |  |
|                                        |  +--------------------------------+  |  |
|                                        |                                      |  |
|                                        |  +--------------------------------+  |  |
|                                        |  |  Structured Data Card (Customer  |  |  |
|                                        |  |  Facing Render)                  |  |  |
|                                        |  |                                  |  |  |
|                                        |  |  How do I track my order?        |  |  |
|                                        |  |  ─────────────────────────────   |  |  |
|                                        |  |  You can track your order using  |  |  |
|                                        |  |  the tracking link sent to your  |  |  |
|                                        |  |  email, or by visiting our       |  |  |
|                                        |  |  orders page and entering your   |  |  |
|                                        |  |  order number.                   |  |  |
|                                        |  +--------------------------------+  |  |
|                                        |                                      |  |
|                                        |  [✓ This answer is correct]         |  |
|                                        |  [✗ Flag for review — wrong match] |  |
|                                        |                                      |  |
+----------------------------------------------------------------------------------+
```

- **Two-pane layout**: Left = question input + history; Right = matched result + customer-facing render.
- **Question input**: Textarea with "Ask" button. Simulates a customer chat message.
- **Result card**: Shows the matched FAQ question, answer, confidence score (color-coded: green >90, yellow 70-90, red <70), and source scope (Storefront / Product).
- **Other matches**: Expandable section showing runner-up matches with lower confidence.
- **Customer-facing render**: A styled accordion/card showing exactly how this FAQ would appear to a customer on the storefront or product page.
- **Feedback buttons**: "Correct" and "Flag for review" — flags feed into the gap report if confidence is low or merchant marks it wrong.

---

### Screen 5: Gap Report Tab

```
+----------------------------------------------------------------------------------+
| FAQ Management                                                                   |
+----------------------------------------------------------------------------------+
| Storefront | Product | Templates | Import | Bot Preview | Gap Report (active)  |
+----------------------------------------------------------------------------------+
|                                                                                  |
|  Time Range: [Last 30 days ▼]   Unanswered queries: 47   Coverage: 62%       |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Rank | Query                          | Frequency | Intent     | Action   |  |
|  |-------|--------------------------------|-----------|------------|----------|  |
|  |  1    | "do you have vegan options"    | 23        | Products   | [Create] |  |
|  |  2    | "what payment methods"         | 18        | Billing    | [Create] |  |
|  |  3    | "can i schedule a pickup"    | 14        | Fulfillment| [Create] |  |
|  |  4    | "is this gluten free"          | 11        | Products   | [Create] |  |
|  |  5    | "do you price match"           | 8         | Pricing    | [Create] |  |
|  |  ...  |                                |           |            |          |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  Grouped by Intent:                                                              |
|  [Products (34)] [Billing (18)] [Fulfillment (14)] [Pricing (8)] [General (6)]  |
|                                                                                  |
|  [Export Gap Report]  [Auto-suggest FAQs from gaps]                              |
|                                                                                  |
+----------------------------------------------------------------------------------+
```

- **Header stats**: Time range selector, total unanswered queries, coverage percentage (answered / total customer questions).
- **Ranked table**: Query text (truncated), frequency count, inferred intent/category, and a "Create" button that opens the FAQ create dialog pre-filled with the question.
- **Intent pills**: Grouped view. Clicking a pill filters the table to that intent.
- **Export**: CSV of gap report for external analysis.
- **Auto-suggest**: Button that sends top gaps to an AI service to draft suggested FAQ answers (if AI capability is enabled; otherwise disabled with tooltip).

---

## Interaction & States

### Important States

- **Empty storefront FAQ**: "No storefront FAQs yet. Start with a template or add your first question." + prominent "Browse Templates" and "+ Add FAQ" buttons.
- **Empty product FAQ**: "This product has no FAQs. Add one or inherit from storefront." + "+ Add FAQ" + "Inherit Storefront FAQs" toggle.
- **Import success**: Toast + summary card: "24 imported, 2 duplicates skipped." Duplicates listed in an expandable panel.
- **Import error**: Inline error per row with validation message (e.g. "Row 7: Question exceeds 255 characters"). Option to fix and re-import failed rows only.
- **Bot preview — no match**: "No matching FAQ found. Confidence: 0%. This query will appear in your Gap Report." + "Create FAQ for this question" CTA.
- **Bot preview — low confidence**: Warning banner: "Confidence 62% — answer may not fully address the question. Consider refining the question text or adding a new FAQ."
- **Gap report — no data**: "No unanswered queries yet. Your bot preview history will populate this report once customers start asking questions." (only shown if storefront is live and has traffic).
- **Loading**: Skeleton shimmer for table rows; spinner in bot preview result pane; stepper progress bar during import.

### Core Interactions

- **Inline FAQ in wizards**: During product wizard step 4, a compact table shows up to 5 existing FAQs for this product with an "+ Add More" link that opens the full dialog pre-scoped to Product + pre-selected product. The wizard can be completed with zero FAQs.
- **Template apply**: On Templates tab, merchant selects a template category (e.g., "Grocery Store Essentials"), sees a checklist of suggested Q&A pairs, checks the ones they want, and clicks "Apply Selected." Applied FAQs land as Drafts; merchant edits and activates.
- **Scope change**: Changing scope from Storefront to Product in the edit dialog preserves the question/answer but clears product associations. A confirmation modal warns: "Changing scope to Product will remove this FAQ from the storefront. Select products to associate it with."
- **Bulk actions**: On Storefront and Product tabs, shift-click or checkbox multi-select enables bulk: "Activate", "Deactivate", "Delete", "Change Category".
- **Search**: Real-time debounced search across question text, answer text, and tags.
- **Reordering**: Drag-and-drop handle on FAQ rows to control display order on the storefront (affects customer-facing accordion order).
- **Customer-facing accordion**: On storefront and product pages, FAQs render as a shadcn `Accordion`. Storefront FAQs appear first; product-specific FAQs appear after, under a "About this product" sub-header.

---

## Public FAQ Display — Storefront & Product Pages

The customer-facing FAQ render uses the same underlying data as the merchant hub but presents it as a clean, scannable accordion. The design assumes the storefront is built with the existing platform component stack (shadcn Accordion, Tailwind, Lucide icons).

---

### Screen A: Storefront FAQ Section (Customer View)

```
+----------------------------------------------------------------------------------+
|  [Storefront Header — Hero, Products, Categories...]                             |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Frequently Asked Questions                                                  |  |
|  |  +------------------------------------------------------------------------+  |  |
|  |  | ▼ Store Hours & Location                                               |  |  |
|  |  |   What are your store hours?                                           |  |  |
|  |  |   We are open Monday–Friday 9am–6pm, Saturday 10am–4pm, closed        |  |  |
|  |  |   Sunday.                                                              |  |  |
|  |  +------------------------------------------------------------------------+  |  |
|  |  | ▶ Shipping & Delivery                                                  |  |  |
|  |  | ▶ Returns & Refunds                                                    |  |  |
|  |  | ▶ Payment Options                                                      |  |  |
|  |  | ▶ Curbside Pickup                                                      |  |  |
|  |  +------------------------------------------------------------------------+  |  |
|  |                                                                               |  |
|  |  Still have a question? [💬 Ask our bot]                                     |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  [Footer...]                                                                     |
+----------------------------------------------------------------------------------+
```

- **Placement**: Scrolls into view below the main storefront content (products/categories), above the footer.
- **Accordion grouping**: FAQs grouped by their `category`. Each category is an accordion item; questions within are nested collapsible panels. At most one category expanded at a time (shadcn `type="single"`).
- **Active question**: A single question can be expanded inside an open category. Deep-linkable via URL hash: `#faq-shipping-delivery`.
- **Category order**: Respects merchant-defined `display_order` on `faq_categories`. Uncategorised FAQs fall under "General".
- **"Ask our bot" CTA**: Floating pill button or inline link that opens the embeddable chat widget (pre-scoped to FAQ intent). Always shown — all merchants have the bot widget. Free tier responses are static FAQ; Starter+ responses are AI-powered.

---

### Screen B: Product Page FAQ Section (Customer View)

```
+----------------------------------------------------------------------------------+
|  [Product Images]    [Product Name]  $12.99  [Add to Cart]                       |
|  [Description...]                                                                |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  About This Product                                                          |  |
|  |  +------------------------------------------------------------------------+  |  |
|  |  | ▼ Is this product organic?                                               |  |  |
|  |  |   Yes, this item is certified USDA Organic.                              |  |  |
|  |  |   Ingredients: Organic whole milk.                                       |  |  |
|  |  +------------------------------------------------------------------------+  |  |
|  |  | ▶ What is the shelf life?                                                |  |  |
|  |  | ▶ Do you have a larger size?                                             |  |  |
|  |  | ▶ Is this gluten-free?                                                   |  |  |
|  |  +------------------------------------------------------------------------+  |  |
|  |                                                                               |  |
|  |  From Acme Grocery                                                            |  |
|  |  +------------------------------------------------------------------------+  |  |
|  |  | ▶ What are your store hours?                                             |  |  |
|  |  | ▶ Do you offer curbside pickup?                                          |  |  |
|  |  | ▶ Do you ship nationwide?                                                |  |  |
|  |  +------------------------------------------------------------------------+  |  |
|  |                                                                               |  |
|  |  [💬 Ask about this product]                                                 |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  [Related Products...]                                                           |
+----------------------------------------------------------------------------------+
```

- **Two-tier accordion**:
  1. **"About This Product"** — Product-scoped FAQs (from `product_faqs` linked to this `product_id`). Only shown if at least one active product FAQ exists.
  2. **"From [Merchant Name]"** — A curated subset of storefront FAQs deemed relevant. Selection logic:
     - If the merchant has set `inherit_storefront = true` on the product FAQ record, pull all active storefront FAQs.
     - Otherwise, show storefront FAQs whose `category` matches the product's primary category (e.g., a Dairy product shows the "General" and "Shipping" storefront FAQs).
     - Fallback: if no match logic yields results, show the top 3 most-viewed storefront FAQs.
- **"Ask about this product" CTA**: Opens the chat widget with the current product pre-loaded as context (`data-product-id` attribute on the widget script). Always shown. Free tier: bot greets with product context and responds from static FAQ. Starter+: AI-generated greeting and response.
- **Empty product FAQ**: If no product-scoped FAQs exist and inherit is off, the "About This Product" section is hidden entirely; only the "From [Merchant]" storefront subset renders.

---

### Screen C: FAQ Accordion — Expanded State Detail

```
+----------------------------------------------------------------------------------+
|  Category: Shipping & Delivery  (expanded)                                       |
|  +--------------------------------------------------------------------------------+
|  |                                                                                |
|  |  Q: Do you offer same-day delivery?                                            |
|  |  A: Yes, for orders placed before 2 PM within a 5-mile radius. Delivery is     |
|  |     free for orders over $35.                                                  |
|  |                                                                                |
|  |     [👍 Helpful]  [👎 Not Helpful]  [📝 Suggest Edit]                          |
|  |                                                                                |
|  |  ──────────────────────────────────────────────────────────────────────────────|
|  |                                                                                |
|  |  Q: How much is shipping?                                                      |
|  |  A: We offer free shipping on orders over $35. Otherwise, flat rate $5.99.     |
|  |                                                                                |
|  |     [👍 Helpful]  [👎 Not Helpful]  [📝 Suggest Edit]                          |
|  |                                                                                |
|  +--------------------------------------------------------------------------------+
|                                                                                  |
|  [💬 Ask our bot about shipping]                                                |
+----------------------------------------------------------------------------------+
```

- **Feedback micro-actions**: Each answer has 👍 / 👎 thumbs and a "Suggest Edit" link. Thumbs are anonymous (no login required) and feed the merchant's Gap Report as soft signals. "Suggest Edit" opens a minimal modal: `[Your suggestion: _________ ] [Email (optional): _________ ] [Submit]`.
- **Markdown support**: Answers support bold, links, unordered lists. Rendered as sanitized HTML inside the accordion content.
- **Bot context link**: Category-level CTA opens the chat widget and injects the category name as the opening user message context. Works for all tiers. Free tier: static FAQ response from that category. Starter+: AI-generated contextual response.

---

### Screen D: FAQ — Search Overlay (Customer View)

```
+----------------------------------------------------------------------------------+
|  Frequently Asked Questions                                                      |
|                                                                                  |
|  [Search FAQs...                                          🔍]                    |
|                                                                                  |
|  Showing 3 results for "delivery"                                                |
|                                                                                  |
|  +----------------------------------------------------------------------------+  |
|  |  Q: Do you offer same-day delivery?                                          |  |
|  |  A: Yes, for orders placed before 2 PM within a 5-mile radius...            |  |
|  |     [Shipping & Delivery]  [👍] [👎]                                         |  |
|  +----------------------------------------------------------------------------+  |
|  |  Q: Do you ship nationwide?                                                  |  |
|  |  A: We currently ship within the continental US via FedEx and USPS.          |  |
|  |     [Shipping & Delivery]  [👍] [👎]                                         |  |
|  +----------------------------------------------------------------------------+  |
|  |  Q: Is there a minimum order for delivery?                                   |  |
|  |  A: No minimum, but delivery is free for orders over $35.                    |  |
|  |     [Shipping & Delivery]  [👍] [👎]                                         |  |
|  +----------------------------------------------------------------------------+  |
|                                                                                  |
|  [Clear search]  [💬 Ask our bot "delivery"]                                     |
+----------------------------------------------------------------------------------+
```

- **Real-time search**: Debounced client-side search (or server-side if FAQ count > 50) across question + answer + tags. Results render as flat cards, not accordion, for scanability.
- **Highlight**: Matching terms highlighted in question and answer text.
- **No results**: "No FAQs match 'delivery'. [💬 Ask our bot]" — bot opens with the search term pre-filled.
- **Scope-aware search**:
  - On storefront page: searches storefront-scoped FAQs only.
  - On product page: searches both product-scoped FAQs for this product + inherited storefront FAQs.

---

### Public Display — Empty States

| Scenario | Display |
|---|---|
| Merchant has zero active storefront FAQs | Section hidden entirely on storefront. No "FAQ" heading rendered. |
| Merchant has storefront FAQs but product page has none + inherit off | "About This Product" hidden; "From [Merchant]" subsection still renders with relevant storefront FAQs. |
| Merchant has zero FAQs but widget active | Chat widget visible; Free tier shows "No FAQ match" message; Starter+ falls back to generic model response. Gap Report captures all unanswered queries. |
| Customer searches and finds nothing | "No FAQs found. Ask our bot and we'll add an answer soon." + bot CTA. |

---

### Public Display — Responsive Behavior

- **Desktop**: Full-width accordion, two columns for category list if >6 categories (left = category nav pills, right = selected category content).
- **Tablet**: Single accordion, category pills wrap.
- **Mobile**: Single accordion, collapsed by default. "Ask our bot" becomes a sticky-bottom pill on scroll.
- **Font size**: Slightly larger than merchant dashboard (16px base) for readability. No dense tables.

---

### Public Display — Bot Widget Integration

The public FAQ and the chatbot widget are designed to work as a complementary pair. **The bot widget is present for all merchants.** Free tier responses are static FAQ lookup; Starter+ responses are AI-powered.

- **FAQ → Bot handoff**: Every FAQ section ends with a bot CTA. Clicking it opens the widget with pre-loaded context:
  - Storefront scope: `data-intent="faq" data-category="Shipping"`
  - Product scope: `data-intent="faq" data-product-id="prd_abc"`
- **Bot → FAQ handoff**: If the bot answers a question using an FAQ entry (all tiers), it renders a "Read full answer" button that scrolls the page to the matching accordion item and expands it.
- **Gap loop**: Questions asked in the bot widget that match no FAQ are logged to `faq_bot_interactions` and surfaced in the merchant's Gap Report. Applies to all tiers — Free tier no-matches are especially valuable signal.

---

## FAQ as the Chatbot Knowledge Base (Closed Loop)

The FAQ is not just a public display layer — it is the **primary knowledge base** that feeds the chatbot's RAG (Retrieval-Augmented Generation) pipeline.

### Data Flow

```
Merchant writes FAQ (FAQ Hub)
        |
        v
FAQ entries chunked + embedded → Vector index (per-tenant)
        |
        v
Customer asks bot question → Intent classification → FAQ retrieval (top-k)
        |
        v
Bot answers from FAQ (high confidence) OR falls back to skill/generic (low confidence)
        |
        v
Unanswered query logged → Gap Report
        |
        v
Merchant sees gap → Writes new FAQ → Loop repeats
```

### Bot Integration Points

| Integration | Description |
|---|---|
| **FAQ for Everyone** | All tenants get the FAQ knowledge base as static Q&A on storefront and product pages. No subscription required. |
| **Bot Widget for Everyone** | All tenants get the bot widget on storefront and product pages. Free tier: static FAQ responses. Starter+: AI-powered responses. |
| **Bot Knowledge Base** (`/t/[tenantId]/bot/knowledge`) | Merchant-facing view of FAQ coverage, freshness, and retrieval settings. Visible to all tiers. Free tier shows static FAQ metrics (entry count, match rate). Starter+ shows embedding sync, RAG coverage, and AI model status. |
| **Bot Preview** (FAQ Hub tab) | Merchant tests a question. Free tier: shows exact/keyword match against FAQ. Starter+: shows RAG retrieval + confidence score from the production index. |
| **Gap Report** (FAQ Hub tab) | Unanswered bot queries surfaced as "write this FAQ next" priorities. Available to all tiers — widget queries are logged regardless of response type. |
| **Coverage Score** | Percentage of bot conversations answered from FAQ (not fallback). Meaningful for all tiers. Free tier target: >70% static match. Starter+ target: >85% RAG match. |
| **Auto-sync** | Every FAQ save triggers an async embedding rebuild. Applies only to Starter+ (Free tier uses exact-match lookup, no embeddings needed). Free tier FAQ changes are immediately effective for static lookup. |
| **Product-scoped retrieval** | Bot prioritizes product-scoped FAQs on product pages. Works for all tiers. Free tier: exact match. Starter+: semantic RAG retrieval. |

### Coverage Metrics (shown in Bot Knowledge Base)

- **Overall coverage**: % of conversations answered from FAQ
- **Category coverage**: % of intents per category (Shipping, Returns, etc.) that have matching FAQ entries
- **Product coverage**: % of products with at least one product-scoped FAQ
- **Freshness**: Time since last embedding index rebuild
- **Retrieval latency**: Average time to retrieve FAQ chunks per query

### Rules

1. **FAQ is the single source of truth**: The bot does not maintain a separate knowledge base. Its RAG layer reads directly from the merchant's FAQ entries.
2. **Draft FAQs are excluded**: Only `status = 'active'` FAQ entries are embedded and retrievable by the bot.
3. **Product metadata included**: When "Include product metadata in chunks" is enabled, product names, descriptions, and tags are included in the embedding context for richer retrieval.
4. **No orphan FAQs**: An FAQ entry that is never matched by the bot in 90 days is flagged as "Low usage — review or archive" in the Gap Report.

---

## Frontend Service Pattern (Singleton + Caching, No Direct Fetch)

All FAQ frontend services **extend an appropriate base singleton** and **never call `fetch()` directly**. Requests go through the inherited method on the base class, which handles auth headers, caching, and error normalization.

### Base Class Selection

| Service Scope | Extends | Default Request Method | Cache TTL |
|---|---|---|---|
| FAQ Merchant Hub (CRUD, import) | `TenantApiSingleton` | `this.makeTenantRequest<T>()` | 5 min |
| FAQ Public Display (storefront, product page) | `PublicApiSingleton` | `this.makePublicRequest<T>()` | 15 min |
| FAQ Bot Preview / Gap Report (merchant) | `TenantApiSingleton` | `this.makeTenantRequest<T>()` | 5 min |

### `FaqService.ts` — Merchant Hub Pattern

```ts
import { TenantApiSingleton } from '@/providers/base/TenantApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

class FaqService extends TenantApiSingleton {
  private static instance: FaqService;

  private constructor() {
    super('faq-service', { ttl: 5 * 60 * 1000 });
  }

  getServiceCachePatterns(): string[] {
    return [
      'faq-storefront-list',
      'faq-product-list',
      'faq-categories',
      'faq-templates',
      'faq-import-status',
      'faq-bot-preview',
      'faq-gap-report',
    ];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): FaqService {
    if (!FaqService.instance) {
      FaqService.instance = new FaqService();
    }
    return FaqService.instance;
  }

  // Storefront FAQs
  async listStorefrontFAQs(tenantId: string): Promise<FaqItem[]> {
    const cacheKey = `faq-storefront-list-${tenantId}`;
    const result = await this.makeTenantRequest<FaqItem[]>(
      `/api/tenants/${tenantId}/faqs`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async createFAQ(tenantId: string, data: CreateFaqInput): Promise<FaqItem> {
    const result = await this.makeTenantRequest<FaqItem>(
      `/api/tenants/${tenantId}/faqs`,
      { method: 'POST', body: JSON.stringify(data) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    await this.invalidateServiceCaches();
    return result.data!;
  }

  // Product FAQs
  async listProductFAQs(tenantId: string, productId: string): Promise<FaqItem[]> {
    const cacheKey = `faq-product-list-${tenantId}-${productId}`;
    const result = await this.makeTenantRequest<FaqItem[]>(
      `/api/tenants/${tenantId}/products/${productId}/faqs`,
      { method: 'GET' },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  // Bot Preview
  async previewBotAnswer(tenantId: string, query: string): Promise<BotPreviewResult> {
    const result = await this.makeTenantRequest<BotPreviewResult>(
      `/api/tenants/${tenantId}/faqs/preview`,
      { method: 'POST', body: JSON.stringify({ query }) }
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  // Gap Report
  async getGapReport(tenantId: string, range: string): Promise<GapReportItem[]> {
    const cacheKey = `faq-gap-report-${tenantId}-${range}`;
    const result = await this.makeTenantRequest<GapReportItem[]>(
      `/api/tenants/${tenantId}/faqs/gaps`,
      { method: 'GET', params: { range } },
      cacheKey,
      5 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }
}

export const faqService = FaqService.getInstance();
```

### `PublicFaqService.ts` — Public Display Pattern

```ts
import { PublicApiSingleton } from '@/providers/base/PublicApiSingleton';
import { getErrorMessage } from '@/providers/base/FlexibleApiSingleton';

class PublicFaqService extends PublicApiSingleton {
  private static instance: PublicFaqService;

  private constructor() {
    super('public-faq-service', { ttl: 15 * 60 * 1000 });
  }

  getServiceCachePatterns(): string[] {
    return [
      'public-faq-storefront',
      'public-faq-product',
    ];
  }

  async invalidateServiceCaches(): Promise<void> {
    for (const pattern of this.getServiceCachePatterns()) {
      await this.invalidateCache(pattern);
    }
  }

  static getInstance(): PublicFaqService {
    if (!PublicFaqService.instance) {
      PublicFaqService.instance = new PublicFaqService();
    }
    return PublicFaqService.instance;
  }

  async getStorefrontFAQs(tenantId: string): Promise<PublicFaqItem[]> {
    const cacheKey = `public-faq-storefront-${tenantId}`;
    const result = await this.makePublicRequest<PublicFaqItem[]>(
      `/api/public/tenants/${tenantId}/faqs`,
      { method: 'GET' },
      cacheKey,
      15 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }

  async getProductFAQs(tenantId: string, productId: string): Promise<PublicFaqItem[]> {
    const cacheKey = `public-faq-product-${tenantId}-${productId}`;
    const result = await this.makePublicRequest<PublicFaqItem[]>(
      `/api/public/tenants/${tenantId}/products/${productId}/faqs`,
      { method: 'GET' },
      cacheKey,
      15 * 60 * 1000
    );
    if (!result.success) throw new Error(getErrorMessage(result.error));
    return result.data!;
  }
}

export const publicFaqService = PublicFaqService.getInstance();
```

### Rules

1. **No direct `fetch`**: All HTTP calls go through the inherited request methods (`makeTenantRequest`, `makePublicRequest`, `makeAdminRequest`, `makeAuthenticatedRequest`, `makeDefaultRequest`). The base class injects headers, handles retries, normalizes errors, and manages cache.
2. **Cache keys are explicit**: Every `GET` passes a deterministic `cacheKey`. Mutations skip cache (no key) and **must** call `await this.invalidateServiceCaches()` on success.
3. **Singleton access**: Export `const faqService = FaqService.getInstance()` at module level. Components import the instance.
4. **Error normalization**: Check `result.success`; throw with `getErrorMessage(result.error)`.
5. **Type-safe responses**: Every request is generic `makeXxxRequest<T>(...)`. Response `data` is typed `T | undefined`.

---

## Data Model Notes (for Engineers)

The UI assumes the following backend structure (to be detailed in the technical plan):

- `tenant_faqs` — Storefront-scoped Q&A (tenant_id, question, answer, category, tags, status, display_order)
- `product_faqs` — Product-scoped Q&A (tenant_id, product_id, question, answer, category, tags, status, display_order, inherit_storefront boolean)
- `faq_categories` — Tenant-scoped category labels (tenant_id, name, color, sort_order)
- `faq_templates` — Platform-level reusable templates (name, category, question, answer, applicable_tiers[])
- `faq_bot_interactions` — Log of bot preview + customer queries (tenant_id, query_text, matched_faq_id, confidence, was_answered, created_at)
- `faq_gap_reports` — Aggregated view over `faq_bot_interactions` (tenant_id, query_text, frequency, inferred_intent, last_seen_at)

---

## Persistence Requirement

This document is saved as:

`c:\Users\pauly\Documents\VisibleShelf\retail-visibility-platform\docs\FAQ_UIUX_DESIGN.md`

Engineers and subagents should treat this as the canonical UI/UX reference for the FAQ module.
