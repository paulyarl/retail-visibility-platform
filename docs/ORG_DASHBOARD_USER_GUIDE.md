# Organization Dashboard User Guide

The Organization Dashboard is your chain-level command center for managing all locations in your organization. It provides a unified view of your plan, capabilities, bot health, and AI assistant — all from a single interface.

## Accessing the Dashboard

Navigate to **Settings → Organization** to access the Organization Dashboard. You must have an organization (chain) account with at least one location.

## Dashboard Overview

The dashboard is organized into tabs, with the available tabs depending on your chain tier:

| Tab | Description | Available From |
|-----|-------------|----------------|
| **Overview** | Plan summary, quick links, system status | All chain tiers |
| **Locations** | List of all locations in your chain | Chain Starter |
| **Propagation** | Push changes across all locations | Chain Professional |
| **Capabilities** | Per-location capability comparison | Chain Professional |
| **Team** | Manage team members across locations | Chain Professional |
| **Commerce** | Chain-wide commerce settings | Chain Professional |
| **Billing** | Subscription and billing management | All chain tiers |

## Plan Summary Panel

The Plan Summary Panel appears on the Overview tab and shows your current chain tier and all available features.

### Feature Status Badges

Each feature displays one of three status indicators:

- **Green checkmark** — Included in your current plan tier
- **Ammer badge** (BadgeCheck icon) — Purchased as an add-on (BSaaS)
- **Gray lock** — Not available on your current plan

### Locked Features

When you click on a locked tab, you'll see:
- **Upgrade Plan** button — Navigate to subscription settings to upgrade your chain tier
- **Purchase Add-on** button (if available) — Buy the feature à la carte without upgrading

## Chain Tiers

| Tier | Key Features |
|------|-------------|
| **Chain Starter** | Overview, billing, locations, task checklist, quick links, system status, product propagation |
| **Chain Professional** | All Starter features + propagation (all types), capabilities, team, commerce, recommendations, CRM summary |
| **Chain Enterprise** | All features + flexible mode, org bot management, org branding control |

## Capability Rollup

The Capabilities tab shows a grid comparing which features are enabled across all your locations. This helps you identify:

- Which locations have specific capabilities enabled
- Inconsistencies across your chain
- Locations that may need configuration updates

Each row represents a capability domain (commerce, chatbot, CRM, etc.) and each column represents a location. Green cells indicate the feature is enabled; gray cells indicate it's disabled.

## Bot Status Card

The Bot Status Card provides a chain-wide view of your AI chatbot health:

- **Active Bots** — Number of locations with chatbot enabled
- **Total Conversations** — Aggregate conversations across all locations
- **Knowledge Coverage** — Locations with FAQ embeddings loaded
- **Product Awareness** — Locations with product embeddings loaded

The card also shows a per-location breakdown with individual bot status, conversation counts, and embedding flags.

## Org Bot Widget

The Org Bot Widget is a floating chat assistant available in the bottom-right corner of the Organization Dashboard. It provides org-level answers using your hero location's bot configuration.

### Features

- **Org-aware greeting** — Introduces itself as the assistant for your organization name
- **Suggested prompts** — Quick-start buttons for common questions:
  - "How many locations do I have?"
  - "What's my chatbot status?"
  - "How does propagation work?"
  - "What capabilities do I have?"
- **Skill cards** — Rich responses for structured data (product info, order tracking, etc.)
- **Typing indicator** — Shows when the bot is processing a response
- **Error retry** — If a message fails, you can retry with one click

### Using the Widget

1. Click the floating button in the bottom-right corner to open the chat
2. Type your question or click a suggested prompt
3. The bot will respond using your organization's context
4. Press **Escape** or click the X to close the widget

### Keyboard Accessibility

- **Tab** — Navigate to the chat input
- **Enter** — Send message
- **Escape** — Close the widget
- Focus is automatically managed when the widget opens/closes

## BSaaS Add-On Purchases

Some org-level features can be purchased à la carte without upgrading your entire chain tier.

### Available Add-Ons

| Feature | Price | Description |
|---------|-------|-------------|
| **Org Bot Management** | $49/month | Chain-wide chatbot management dashboard with cross-location bot status, org-level bot widget, and aggregated bot analytics |
| **Org Branding Control** | $29/month | Chain-wide branding control: custom logo, colors, and messaging propagated to all location storefronts |

### How to Purchase

1. Click on a locked tab that shows the "Purchase Add-on" button
2. You'll be redirected to the subscription settings page
3. Complete the purchase flow
4. The feature will be immediately available on your dashboard
5. A "Purchased" badge (amber) will appear on the feature in your Plan Summary

### Managing Purchases

Purchases are managed through the admin panel at **Settings → Admin → Feature Purchases**. Admins can:
- Grant features to tenants
- Suspend or cancel active purchases
- Set expiration dates
- View purchase history

## Propagation

The Propagation tab (available on Chain Professional and above) lets you push changes from your hero location to all other locations in your chain.

### Propagation Types

| Type | Description | Available From |
|------|-------------|----------------|
| **Products** | Push product catalog changes | Chain Starter |
| **Categories** | Push category structure changes | Chain Professional |
| **Business Info** | Push business name, hours, contact info | Chain Professional |
| **Settings** | Push configuration settings | Chain Professional |

## Troubleshooting

### Dashboard shows "Organization features are not enabled"

Your chain tier doesn't include organization features. Upgrade to Chain Starter or higher, or check if your organization has been properly set up with a subscription tier.

### Bot widget doesn't appear

The bot widget only appears when:
1. Your organization has bot capabilities enabled
2. At least one location has an active chatbot configuration
3. Your hero location has a bot configured

Check the Bot Status Card to verify your bot configuration status.

### Locked tab shows no purchase option

Not all features are available as à la carte purchases. Some features are tier-locked only and require upgrading your chain plan. The "Purchase Add-on" button only appears for BSaaS-eligible features.

### Purchased feature not showing as enabled

Purchases may take up to 60 seconds to reflect due to caching. If the feature doesn't appear after 1 minute:
1. Refresh the dashboard page
2. Verify the purchase was granted via Admin → Feature Purchases
3. Contact support if the issue persists
