=== VisibleShelf Bot ===
Contributors: visibleshelf
Tags: chatbot, ai, customer support, widget, ecommerce
Requires at least: 5.5
Tested up to: 6.5
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed the VisibleShelf AI chatbot widget on your WordPress site using an embed key.

== Description ==

The VisibleShelf Bot plugin lets you embed the VisibleShelf AI-powered chatbot widget directly on your WordPress site. The bot can answer customer questions, search products, create support tickets, and provide contextual assistance based on the page your visitor is viewing.

**Features:**

* AI-powered customer chat widget
* Product search and recommendations
* Support ticket creation
* Context-aware responses (auto-detects product, category, home pages)
* Shadow DOM encapsulation (no theme conflicts)
* Mobile-responsive design
* Configurable page context mapping

**Requirements:**

* A VisibleShelf account with an active bot embed license
* An embed key (obtained from your VisibleShelf admin or support team)
* Your domain must be added to the allowed domains list for your embed key

== Installation ==

1. Upload the `visibleshelf-bot` folder to `/wp-content/plugins/`
2. Activate the plugin through the 'Plugins' menu in WordPress
3. Navigate to **Settings → VisibleShelf Bot**
4. Enter your embed key (provided by VisibleShelf support)
5. Configure page context (auto-detect recommended)
6. Save settings — the bot widget will appear on your site

== Frequently Asked Questions ==

= Where do I get an embed key? =

Contact VisibleShelf support or your account administrator. They will create an embed license for your tenant and provide you with an embed key. Your domain will also need to be added to the allowed domains list.

= The widget isn't appearing. What should I check? =

1. Verify your embed key is entered correctly in Settings → VisibleShelf Bot
2. Ensure your domain is in the allowed domains list (contact VisibleShelf support)
3. Check your browser console for CORS errors
4. If using a cache plugin, exclude the bot widget script URL from caching

= Can I use this with WooCommerce? =

Yes! The plugin auto-detects WooCommerce page types (product, category, shop) and maps them to the appropriate page context for the bot.

= Does this work with page builders? =

Yes. The bot widget uses Shadow DOM encapsulation, so it won't conflict with your theme or page builder styles.

= Can I change which pages the bot appears on? =

The bot appears on all pages by default. You can use WordPress conditional functions in a custom plugin to restrict where it loads by hooking into `wp_enqueue_scripts` with your own logic.

== Screenshots ==

1. Settings page — configure embed key and page context
2. Bot widget — chat interface on your site
3. Auto-detection — WooCommerce page type mapping

== Changelog ==

= 1.0.0 =
* Initial release
* Embed key authentication
* Auto-detect page context for WooCommerce and standard WordPress pages
* Settings page with platform URL configuration
* Activation notice with setup guidance

== Upgrade Notice ==

= 1.0.0 =
First release. Configure your embed key in Settings → VisibleShelf Bot after activation.
