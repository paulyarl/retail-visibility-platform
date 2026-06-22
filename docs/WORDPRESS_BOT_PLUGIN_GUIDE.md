# WordPress Bot Plugin Guide

> Complete guide for installing, configuring, and troubleshooting the VisibleShelf Bot WordPress plugin.

---

## Overview

The VisibleShelf Bot WordPress plugin embeds the VisibleShelf AI chatbot widget on your WordPress site using an embed key. The widget is loaded from the VisibleShelf platform and uses Shadow DOM encapsulation, meaning it won't conflict with your theme or page builder styles.

---

## Prerequisites

1. **VisibleShelf account** with an active bot embed license
2. **Embed key** — obtained from VisibleShelf support or your account admin
3. **Domain allowlisting** — your site domain must be added to the allowed domains list for your embed key

---

## Installation

### Method 1: Upload via WordPress Admin

1. Download the plugin zip: run `bash scripts/package-wordpress-plugin.sh` from the project root, or download from the VisibleShelf dashboard
2. Log in to your WordPress admin
3. Navigate to **Plugins → Add New → Upload Plugin**
4. Choose `visibleshelf-bot.zip` and click **Install Now**
5. Click **Activate**

### Method 2: Manual FTP Upload

1. Unzip `visibleshelf-bot.zip`
2. Upload the `visibleshelf-bot` folder to `/wp-content/plugins/`
3. Activate the plugin through the **Plugins** menu in WordPress

---

## Configuration

After activation, navigate to **Settings → VisibleShelf Bot**:

### Embed Key
Enter the embed key provided by VisibleShelf support. Format: `ek-XXXX-xxxxxxxxxxxx`

### Platform URL
The VisibleShelf platform URL. Defaults to `https://app.visibleshelf.com`. Change this only if you have a custom deployment.

### Page Context
Controls the page context sent to the bot for contextual responses:

| Option | Description |
|---|---|
| **Auto-detect (recommended)** | Automatically maps WordPress/WooCommerce page types |
| Home | Forces "home" context on all pages |
| Product | Forces "product" context |
| Category | Forces "category" context |
| Storefront | Forces "storefront" context |
| General Page | Forces "page" context |

#### Auto-Detect Mapping

| WordPress Condition | Bot Page Context |
|---|---|
| `is_front_page()` / `is_home()` | `home` |
| `is_product()` (WooCommerce) | `product` |
| `is_product_category()` / `is_product_tag()` | `category` |
| `is_shop()` (WooCommerce) | `storefront` |
| `is_page()` | `page` |
| `is_single()` | `article` |
| Fallback | `general` |

---

## Domain Allowlisting

Your site domain must be in the allowed domains list for your embed key. The settings page displays your detected domain for easy reference.

### Adding Your Domain

Contact VisibleShelf support with your:
- Tenant name
- Embed key
- Site domain (e.g., `www.mystore.com`)

### Wildcard Domains

VisibleShelf supports wildcard domain matching:
- `*.example.com` matches `www.example.com`, `shop.example.com`, etc.
- `example.com` matches only `example.com` exactly

---

## Troubleshooting

### Widget Not Appearing

1. **Check embed key** — verify it's entered correctly in Settings → VisibleShelf Bot
2. **Check domain allowlist** — ensure your domain is in the allowed domains list
3. **Check browser console** — look for JavaScript errors or 403 responses
4. **Check plugin activation** — ensure the plugin is activated

### CORS Errors

If you see CORS errors in the browser console:
1. Verify the **Platform URL** setting is correct
2. Ensure your domain is allowlisted (CORS is enforced via the embed key domain validation)
3. Contact VisibleShelf support if the issue persists

### Cache Plugin Conflicts

If the widget appears intermittently or after cache clears:
1. **WP Rocket**: Add `/bot-widget/bot-widget.js` to "Excluded JavaScript Files"
2. **W3 Total Cache**: Add the bot widget URL to "Never minify JavaScript files"
3. **WP Super Cache**: Add `visibleshelf-bot` to the "Do not cache" list
4. **LiteSpeed Cache**: Exclude the bot widget URL from JS optimization

### Widget Appears but Bot Doesn't Respond

1. Check that the bot is enabled for your tenant in VisibleShelf
2. Verify your embed license hasn't expired
3. Check network requests for API errors (403 = capability/license issue)

---

## Developer Notes

### Hook: `vs_bot_enqueue_widget`

The widget enqueues on `wp_enqueue_scripts`. To restrict where the bot loads, dequeue it on specific pages:

```php
add_action( 'wp_enqueue_scripts', function() {
    if ( is_admin() || is_preview() ) {
        wp_dequeue_script( 'visibleshelf-bot-loader' );
    }
}, 20 );
```

### Filter: Custom Page Context

You can programmatically override the page context:

```php
add_filter( 'option_vs_bot_page_context', function( $value ) {
    if ( is_product() ) {
        return 'product_detail';
    }
    return $value;
} );
```

### Plugin Structure

```
plugins/wordpress/visibleshelf-bot/
├── visibleshelf-bot.php    # Main plugin file (~200 lines)
└── readme.txt              # WordPress plugin readme
```

### Build Script

Package the plugin for distribution:

```bash
bash scripts/package-wordpress-plugin.sh
```

Output: `plugins/wordpress/visibleshelf-bot.zip`

---

## FAQ

**Can I use this without WooCommerce?**
Yes. The plugin works on any WordPress site. WooCommerce is only needed for product/category auto-detection.

**Does the widget slow down my site?**
The widget script loads with `defer` and uses Shadow DOM, so it doesn't block page rendering or impact layout.

**Can I customize the widget appearance?**
Widget appearance is configured in the VisibleShelf merchant dashboard, not in the WordPress plugin.

**Is the widget GDPR compliant?**
The widget respects the same data handling as the VisibleShelf platform. Consult your VisibleShelf agreement for data processing terms.
