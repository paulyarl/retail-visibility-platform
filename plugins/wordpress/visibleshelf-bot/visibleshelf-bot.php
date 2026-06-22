<?php
/**
 * Plugin Name:       VisibleShelf Bot
 * Plugin URI:        https://visibleshelf.com/plugins/wordpress
 * Description:       Embed the VisibleShelf AI chatbot widget on your WordPress site using an embed key.
 * Version:           1.0.0
 * Requires at least: 5.5
 * Requires PHP:      7.4
 * Author:            VisibleShelf
 * Author URI:        https://visibleshelf.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 *
 * @package VisibleShelfBot
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}

define( 'VS_BOT_VERSION', '1.0.0' );
define( 'VS_BOT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'VS_BOT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

/**
 * Default platform origin.
 * Users can override this via the settings page if they have a custom deployment.
 */
function vs_bot_get_platform_origin() {
    $origin = get_option( 'vs_bot_platform_origin', 'https://app.visibleshelf.com' );
    return rtrim( $origin, '/' );
}

/**
 * Get the configured embed key.
 */
function vs_bot_get_embed_key() {
    return get_option( 'vs_bot_embed_key', '' );
}

/**
 * Get the configured page context mapping.
 */
function vs_bot_get_page_context() {
    $context = get_option( 'vs_bot_page_context', 'auto' );
    if ( 'auto' === $context ) {
        return vs_bot_detect_page_context();
    }
    return $context;
}

/**
 * Auto-detect WordPress page type and map to bot page context.
 */
function vs_bot_detect_page_context() {
    if ( is_front_page() || is_home() ) {
        return 'home';
    }
    if ( is_product() ) {
        return 'product';
    }
    if ( is_product_category() || is_product_tag() ) {
        return 'category';
    }
    if ( is_shop() ) {
        return 'storefront';
    }
    if ( is_page() ) {
        return 'page';
    }
    if ( is_single() ) {
        return 'article';
    }
    return 'general';
}

/**
 * Enqueue the bot widget script with the embed key.
 */
function vs_bot_enqueue_widget() {
    $embed_key = vs_bot_get_embed_key();

    if ( empty( $embed_key ) ) {
        return;
    }

    $platform_origin = vs_bot_get_platform_origin();
    $widget_url      = $platform_origin . '/bot-widget/bot-widget.js';
    $page_context    = vs_bot_get_page_context();

    wp_enqueue_script(
        'visibleshelf-bot-widget',
        $widget_url,
        array(),
        VS_BOT_VERSION,
        true
    );

    // Pass embed key and page context as data attributes via inline script
    $script_data = sprintf(
        'document.currentScript = document.currentScript || {}; ' .
        'var __vsBotConfig = %s;',
        wp_json_encode( array(
            'embedKey'     => $embed_key,
            'pageContext'  => $page_context,
            'platformUrl'  => $platform_origin,
        ) )
    );

    wp_add_inline_script(
        'visibleshelf-bot-widget',
        $script_data,
        'before'
    );

    // Add data attributes to the script tag via a small loader
    $loader_script = sprintf(
        '(function(){' .
        'var s=document.createElement("script");' .
        's.src="%s";' .
        's.setAttribute("data-embed-key","%s");' .
        's.setAttribute("data-page-context","%s");' .
        's.defer=true;' .
        'document.head.appendChild(s);' .
        '})();',
        esc_url( $widget_url ),
        esc_attr( $embed_key ),
        esc_attr( $page_context )
    );

    // Use wp_enqueue_script with inline approach for data attributes
    // WordPress doesn't natively support data attributes on enqueued scripts,
    // so we use a loader approach
    wp_dequeue_script( 'visibleshelf-bot-widget' );

    wp_register_script(
        'visibleshelf-bot-loader',
        '',
        array(),
        VS_BOT_VERSION,
        true
    );

    wp_enqueue_script( 'visibleshelf-bot-loader' );

    wp_add_inline_script(
        'visibleshelf-bot-loader',
        $loader_script,
        'after'
    );
}
add_action( 'wp_enqueue_scripts', 'vs_bot_enqueue_widget' );

/**
 * Register the settings page in the WordPress admin.
 */
function vs_bot_add_settings_page() {
    add_options_page(
        __( 'VisibleShelf Bot Settings', 'visibleshelf-bot' ),
        __( 'VisibleShelf Bot', 'visibleshelf-bot' ),
        'manage_options',
        'visibleshelf-bot',
        'vs_bot_render_settings_page'
    );
}
add_action( 'admin_menu', 'vs_bot_add_settings_page' );

/**
 * Register plugin settings.
 */
function vs_bot_register_settings() {
    register_setting( 'vs_bot_settings_group', 'vs_bot_embed_key', array(
        'type'              => 'string',
        'sanitize_callback' => 'sanitize_text_field',
        'default'           => '',
    ) );

    register_setting( 'vs_bot_settings_group', 'vs_bot_platform_origin', array(
        'type'              => 'string',
        'sanitize_callback' => 'esc_url_raw',
        'default'           => 'https://app.visibleshelf.com',
    ) );

    register_setting( 'vs_bot_settings_group', 'vs_bot_page_context', array(
        'type'              => 'string',
        'sanitize_callback' => 'sanitize_text_field',
        'default'           => 'auto',
    ) );
}
add_action( 'admin_init', 'vs_bot_register_settings' );

/**
 * Render the settings page HTML.
 */
function vs_bot_render_settings_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        return;
    }

    $embed_key       = vs_bot_get_embed_key();
    $platform_origin = vs_bot_get_platform_origin();
    $page_context    = get_option( 'vs_bot_page_context', 'auto' );
    ?>
    <div class="wrap">
        <h1><?php echo esc_html( get_admin_page_title() ); ?></h1>
        <p><?php esc_html_e( 'Configure the VisibleShelf AI chatbot widget for your WordPress site.', 'visibleshelf-bot' ); ?></p>

        <?php if ( empty( $embed_key ) ) : ?>
            <div class="notice notice-warning">
                <p><?php esc_html_e( 'You need an embed key to activate the bot widget. Contact VisibleShelf support or your account admin to obtain one.', 'visibleshelf-bot' ); ?></p>
            </div>
        <?php endif; ?>

        <form method="post" action="options.php">
            <?php
            settings_fields( 'vs_bot_settings_group' );
            do_settings_sections( 'vs_bot_settings_group' );
            ?>

            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row">
                        <label for="vs_bot_embed_key"><?php esc_html_e( 'Embed Key', 'visibleshelf-bot' ); ?></label>
                    </th>
                    <td>
                        <input
                            type="text"
                            id="vs_bot_embed_key"
                            name="vs_bot_embed_key"
                            value="<?php echo esc_attr( $embed_key ); ?>"
                            class="regular-text code"
                            placeholder="ek-XXXX-xxxxxxxxxxxx"
                        />
                        <p class="description">
                            <?php esc_html_e( 'Your VisibleShelf bot embed key. This is unique to your account and authorizes the widget on your domain.', 'visibleshelf-bot' ); ?>
                        </p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="vs_bot_platform_origin"><?php esc_html_e( 'Platform URL', 'visibleshelf-bot' ); ?></label>
                    </th>
                    <td>
                        <input
                            type="url"
                            id="vs_bot_platform_origin"
                            name="vs_bot_platform_origin"
                            value="<?php echo esc_attr( $platform_origin ); ?>"
                            class="regular-text"
                        />
                        <p class="description">
                            <?php esc_html_e( 'The VisibleShelf platform URL. Change this only if you have a custom deployment.', 'visibleshelf-bot' ); ?>
                        </p>
                    </td>
                </tr>

                <tr>
                    <th scope="row">
                        <label for="vs_bot_page_context"><?php esc_html_e( 'Page Context', 'visibleshelf-bot' ); ?></label>
                    </th>
                    <td>
                        <select id="vs_bot_page_context" name="vs_bot_page_context">
                            <option value="auto" <?php selected( $page_context, 'auto' ); ?>>
                                <?php esc_html_e( 'Auto-detect (recommended)', 'visibleshelf-bot' ); ?>
                            </option>
                            <option value="home" <?php selected( $page_context, 'home' ); ?>>
                                <?php esc_html_e( 'Home', 'visibleshelf-bot' ); ?>
                            </option>
                            <option value="product" <?php selected( $page_context, 'product' ); ?>>
                                <?php esc_html_e( 'Product', 'visibleshelf-bot' ); ?>
                            </option>
                            <option value="category" <?php selected( $page_context, 'category' ); ?>>
                                <?php esc_html_e( 'Category', 'visibleshelf-bot' ); ?>
                            </option>
                            <option value="storefront" <?php selected( $page_context, 'storefront' ); ?>>
                                <?php esc_html_e( 'Storefront', 'visibleshelf-bot' ); ?>
                            </option>
                            <option value="page" <?php selected( $page_context, 'page' ); ?>>
                                <?php esc_html_e( 'General Page', 'visibleshelf-bot' ); ?>
                            </option>
                        </select>
                        <p class="description">
                            <?php esc_html_e( 'Controls the page context sent to the bot for contextual responses. Auto-detect maps WordPress page types automatically.', 'visibleshelf-bot' ); ?>
                        </p>
                    </td>
                </tr>
            </table>

            <?php submit_button( __( 'Save Settings', 'visibleshelf-bot' ) ); ?>
        </form>

        <hr />

        <h2><?php esc_html_e( 'Domain Allowlisting', 'visibleshelf-bot' ); ?></h2>
        <p>
            <?php esc_html_e( 'Your site domain must be added to the allowed domains list for your embed key. Contact VisibleShelf support if you see a "domain not allowed" error.', 'visibleshelf-bot' ); ?>
        </p>
        <p>
            <strong><?php esc_html_e( 'Your detected domain:', 'visibleshelf-bot' ); ?></strong>
            <code><?php echo esc_html( wp_parse_url( home_url(), PHP_URL_HOST ) ); ?></code>
        </p>

        <h2><?php esc_html_e( 'Troubleshooting', 'visibleshelf-bot' ); ?></h2>
        <ul style="list-style: disc; padding-left: 20px;">
            <li><strong><?php esc_html_e( 'Widget not appearing?', 'visibleshelf-bot' ); ?></strong> <?php esc_html_e( 'Verify your embed key is correct and your domain is allowlisted.', 'visibleshelf-bot' ); ?></li>
            <li><strong><?php esc_html_e( 'CORS errors?', 'visibleshelf-bot' ); ?></strong> <?php esc_html_e( 'Ensure your Platform URL is correct and your domain is in the allowed domains list.', 'visibleshelf-bot' ); ?></li>
            <li><strong><?php esc_html_e( 'Cache plugin conflicts?', 'strong>' ); ?></strong> <?php esc_html_e( 'Add the bot widget script URL to your cache plugin exclusion list.', 'visibleshelf-bot' ); ?></li>
        </ul>
    </div>
    <?php
}

/**
 * Add a settings link on the plugins page.
 */
function vs_bot_add_settings_link( $links ) {
    $settings_link = '<a href="' . admin_url( 'options-general.php?page=visibleshelf-bot' ) . '">'
        . __( 'Settings', 'visibleshelf-bot' ) . '</a>';
    array_unshift( $links, $settings_link );
    return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'vs_bot_add_settings_link' );

/**
 * Activation hook — flush rewrite rules and show setup notice.
 */
function vs_bot_activate() {
    // Check if embed key is set; if not, we'll show an admin notice
    if ( empty( get_option( 'vs_bot_embed_key' ) ) ) {
        set_transient( 'vs_bot_activation_notice', true, 5 * MINUTE_IN_SECONDS );
    }
}
register_activation_hook( __FILE__, 'vs_bot_activate' );

/**
 * Show activation notice directing user to settings.
 */
function vs_bot_activation_notice() {
    if ( get_transient( 'vs_bot_activation_notice' ) ) {
        ?>
        <div class="notice notice-success is-dismissible">
            <p>
                <?php
                printf(
                    /* translators: %s: settings URL */
                    __( 'VisibleShelf Bot activated! <a href="%s">Configure your embed key</a> to start using the chatbot widget.', 'visibleshelf-bot' ),
                    admin_url( 'options-general.php?page=visibleshelf-bot' )
                );
                ?>
            </p>
        </div>
        <?php
        delete_transient( 'vs_bot_activation_notice' );
    }
}
add_action( 'admin_notices', 'vs_bot_activation_notice' );
