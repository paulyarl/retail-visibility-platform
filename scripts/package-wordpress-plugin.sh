#!/bin/bash
#
# Package the VisibleShelf Bot WordPress plugin into a distributable zip.
#
# Usage:  bash scripts/package-wordpress-plugin.sh
#
# Output: plugins/wordpress/visibleshelf-bot.zip
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/../.." && pwd)"
PLUGIN_DIR="$ROOT_DIR/plugins/wordpress/visibleshelf-bot"
OUTPUT_ZIP="$ROOT_DIR/plugins/wordpress/visibleshelf-bot.zip"

echo "Packaging VisibleShelf Bot WordPress plugin..."

# Clean up any previous zip
rm -f "$OUTPUT_ZIP"

# Create zip from the plugin directory (preserves visibleshelf-bot/ structure)
cd "$PLUGIN_DIR/.."
zip -r "$OUTPUT_ZIP" visibleshelf-bot/ \
    -x "visibleshelf-bot/.git/*" \
       "visibleshelf-bot/.DS_Store" \
       "visibleshelf-bot/*.bak"

echo ""
echo "Done! Plugin zip created at: plugins/wordpress/visibleshelf-bot.zip"
echo ""
echo "Install via WordPress admin: Plugins → Add New → Upload Plugin"
