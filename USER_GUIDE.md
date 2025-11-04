# Retail Visibility Platform - User Guide

## 📖 Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication](#authentication)
3. [Dashboard Navigation](#dashboard-navigation)
4. [Managing Tenants](#managing-tenants)
5. [Managing Inventory](#managing-inventory)
6. [SKU Scanning](#sku-scanning) 🆕
7. [Settings](#settings)
8. [Admin Features](#admin-features)
9. [Troubleshooting](#troubleshooting)

---

## 🚀 Getting Started

### First Time Login

1. Navigate to the login page
2. Enter your email address
3. Click "Send magic link"
4. Check your email for the login link
5. Click the link to sign in
6. You'll be redirected based on your role:
   - **Admins** → Admin Dashboard
   - **Business Owners** → Tenants Page

### Understanding Your Role

**Admin:**
- Full system access
- Manage all users and tenants
- Configure system settings

**Business Owner:**
- Manage your own tenants
- Full inventory control
- Business profile management

**User:**
- Access assigned tenants
- Manage inventory
- View reports

**Viewer:**
- Read-only access
- View inventory and reports

---

## 🔐 Authentication

### Magic Link Login

1. Go to `/login`
2. Enter your email
3. Click "Send magic link"
4. Check your email (check spam folder if needed)
5. Click the link within 1 hour
6. You're logged in!

### Sign Out

1. Click your profile icon (top right)
2. Click "Sign Out"
3. You'll be redirected to the login page

---

## 🧭 Dashboard Navigation

### Main Navigation

**For Business Owners:**
- **Tenants** - Manage store locations
- **Items** - Inventory management
- **Settings** - Configure preferences

**For Admins:**
- All of the above, plus:
- **Admin Dashboard** - System overview
- **User Management** - Manage users
- **Feature Flags** - Control features

### Quick Actions

- **Refresh** - Reload current data
- **Search** - Find tenants or items
- **Create** - Add new tenant or item

---

## 🏢 Managing Tenants

### Creating a Tenant

1. Go to `/tenants`
2. Enter tenant name in the input field
3. Click "Create Tenant"
4. Your new tenant is created!

### Editing a Tenant

1. Find the tenant in your list
2. Click the **Edit** icon (pencil)
3. Change the name
4. Click the **Save** icon (checkmark)
5. Or click **Cancel** (X) to discard changes

### Selecting a Tenant

1. Click on a tenant name
2. The tenant is now active
3. You'll see inventory for this tenant

### Deleting a Tenant

1. Click the **Delete** icon (trash)
2. Confirm the deletion
3. ⚠️ **Warning:** This cannot be undone!

### Tenant Settings

1. Select a tenant
2. Go to `/settings/tenant`
3. Update business profile:
   - Business name
   - Contact information
   - Phone number
   - Email
   - Website

---

## 📦 Managing Inventory

### Viewing Inventory

1. Select a tenant
2. Go to `/items` or click "View Items"
3. See all products for this tenant

### Adding a Product

1. Go to inventory page
2. Click "Add Item"
3. Fill in product details:
   - Name (required)
   - Description
   - Price
   - SKU
   - Quantity
4. Click "Save"

### Editing a Product

1. Find the product
2. Click "Edit"
3. Update details
4. Click "Save Changes"

### Uploading Product Photos

1. Edit a product
2. Click "Upload Photo"
3. Select image file
4. Photo is uploaded automatically

### Searching Products

1. Use the search bar at the top
2. Type product name or SKU
3. Results filter automatically

### Deleting a Product

1. Find the product
2. Click "Delete"
3. Confirm deletion
4. ⚠️ **Warning:** This cannot be undone!

---

## 📱 SKU Scanning

### Quick Inventory with Barcode Scanning

The SKU Scanning feature allows you to quickly add products to your inventory by scanning barcodes. Perfect for initial setup, stock taking, and receiving shipments.

### Key Features

- ⚡ **Fast Entry** - Scan dozens of products in minutes
- 🔍 **Auto-Enrichment** - Product details fetched automatically
- ✅ **Validation** - Catch errors before committing
- 🚫 **Duplicate Detection** - Prevents scanning same item twice

### Getting Started

1. Go to **Quick Start** → **SKU Scanning**
2. Choose device type (USB Scanner or Manual Entry)
3. Start scanning barcodes
4. Review and commit to inventory

### Supported Devices

- 🖱️ USB Barcode Scanners (recommended)
- ⌨️ Manual keyboard entry
- 📱 Camera scanning (coming soon)

### Learn More

📚 **[Complete M4 SKU Scanning User Guide](./docs/M4_USER_GUIDE.md)**

The detailed guide covers:
- Step-by-step scanning instructions
- Managing scan sessions
- Product enrichment
- Troubleshooting tips
- Best practices
- Advanced features

---

## ⚙️ Settings

### Appearance Settings

**Location:** `/settings/appearance`

**Options:**
1. **Light Mode** - Bright interface
2. **Dark Mode** - Easy on the eyes
3. **System** - Match your device

**How to Change:**
1. Go to Settings → Appearance
2. Click your preferred theme
3. Theme applies immediately
4. Saved automatically

### Language Settings

**Location:** `/settings/language`

**Supported Languages:**
- 🇺🇸 English (US) - ✅ Available now
- 🇪🇸 Spanish - Coming soon
- 🇫🇷 French - Coming soon
- 🇩🇪 German - Coming soon
- 🇨🇳 Chinese - Coming soon
- 🇯🇵 Japanese - Coming soon

**How to Change:**
1. Go to Settings → Language & Region
2. Click your preferred language
3. See which countries use that language
4. Selection saved automatically

### Tenant Settings

**Location:** `/settings/tenant`

**What You Can Update:**
- Business name
- Contact person
- Phone number
- Email address
- Website URL
- Business description

**How to Update:**
1. Go to Settings → Tenant Settings
2. Click "Edit Profile"
3. Update information
4. Click "Save Changes"

---

## 👑 Admin Features

### Admin Dashboard

**Location:** `/settings/admin`

**What You See:**
- Total tenants count
- Total users count
- Quick links to admin pages

**Quick Links:**
- Invite User
- View All Tenants
- Manage Features

### User Management

**Location:** `/settings/admin/users`

**Inviting Users:**
1. Click "Invite User"
2. Enter email address
3. Select role (Admin, User, Viewer)
4. Click "Send Invitation"

**Editing Users:**
1. Find the user
2. Click "Edit"
3. Update:
   - Name
   - Email
   - Role
   - Status (Active, Inactive, Pending)
4. Click "Save Changes"

**Managing Permissions:**
1. Find the user
2. Click "Permissions"
3. Toggle permissions:
   - Create/Edit/Delete Tenants
   - Manage Inventory
   - View Analytics
   - Manage Users
   - Access Admin Dashboard
4. Click "Save Permissions"

### Tenant Management (Admin)

**Location:** `/settings/admin/tenants`

**What You See:**
- All tenants in the system
- Tenant statistics
- Quick actions

**Actions:**
- **View Details** - See tenant settings
- **View Items** - See tenant inventory

### Feature Flags

**Location:** `/settings/admin/features`

**Available Flags:**
- Business Profile
- Dark Mode
- i18n Scaffold
- Category Mirroring
- (More coming soon)

**How to Toggle:**
1. Find the feature
2. Click the toggle switch
3. Feature enabled/disabled immediately

### Category Sync (Google Business Profile) 🆕

**Location:** `/admin/categories/sync`

**What It Does:**
Synchronizes product categories between your platform and Google Business Profile (GBP), ensuring consistency across systems and optimizing for Google search visibility.

**Key Features:**
- 🔄 **Bi-directional Sync** - Platform ↔ Google Business Profile
- ✅ **Validation** - Dry-run mode to preview changes
- 🔁 **Auto-Retry** - Handles temporary failures automatically
- 📊 **Monitoring** - Track sync status and out-of-sync items
- 📈 **Analytics** - View sync history and performance metrics

**Sync Strategies:**

**Platform to GBP** (Recommended)
- Push your categories to Google
- Use when your taxonomy is well-organized
- Maintains your category structure

**GBP to Platform**
- Pull Google's categories to your platform
- Use when adopting Google's standardization
- Ensures Google compliance

**How to Sync:**
1. Go to Admin → Category Sync
2. Choose sync strategy
3. Enable "Dry Run" for testing (recommended)
4. Click "Start Sync"
5. Monitor progress in real-time
6. Review results

**Monitoring:**
- **Out-of-Sync Count** - Categories needing sync
- **Last Sync** - When last sync completed
- **Success Rate** - % of successful syncs
- **Sync History** - View past sync operations

**Best Practices:**
- ✅ Always run dry-run first
- ✅ Sync regularly (weekly recommended)
- ✅ Monitor out-of-sync count
- ✅ Review sync results
- ✅ Keep category names standardized

**Learn More:**

📚 **[Complete M3 Category Sync Guide](./docs/M3_USER_GUIDE.md)**

The detailed guide covers:
- Understanding sync strategies
- Step-by-step sync instructions
- Category mapping and management
- Troubleshooting sync issues
- Advanced features and automation
- Best practices for category management

---

## 🔍 Troubleshooting

### Can't Log In

**Problem:** Magic link not working

**Solutions:**
1. Check spam folder
2. Link expires after 1 hour - request new one
3. Make sure you're using the same browser
4. Clear browser cache and try again

### Can't See Tenants

**Problem:** Tenant list is empty

**Solutions:**
1. Make sure you're logged in
2. Create your first tenant
3. If admin, check `/settings/admin/tenants`
4. Refresh the page

### Can't See Inventory

**Problem:** Items page is empty

**Solutions:**
1. Make sure a tenant is selected
2. Check the URL has `?tenantId=xxx`
3. Create your first item
4. Refresh the page

### Dark Mode Not Working

**Problem:** Theme doesn't persist

**Solutions:**
1. Go to `/settings/appearance`
2. Select your theme again
3. Make sure browser allows localStorage
4. Try a different browser

### Permission Denied

**Problem:** Can't access a page

**Solutions:**
1. Check your user role
2. Contact admin for permissions
3. Make sure you're logged in
4. Try logging out and back in

### Page Not Loading

**Problem:** Spinner keeps spinning

**Solutions:**
1. Check your internet connection
2. Refresh the page
3. Clear browser cache
4. Check if API is running
5. Contact support

---

## 💡 Tips & Best Practices

### For Business Owners

1. **Create tenants first** before adding inventory
2. **Complete business profile** for better SEO
3. **Upload product photos** for better visibility
4. **Use descriptive names** for products
5. **Keep inventory updated** regularly

### For Admins

1. **Set user roles carefully** - they control access
2. **Use permissions** for fine-grained control
3. **Monitor tenant count** for system health
4. **Test features** before enabling for all users
5. **Regular backups** (coming soon)

### General Tips

1. **Use dark mode** to reduce eye strain
2. **Bookmark frequently used pages**
3. **Use search** to find items quickly
4. **Check settings** to customize experience
5. **Keep browser updated** for best performance

---

## 📱 Mobile Usage

### Responsive Design

The platform works on:
- 📱 **Phones** - Full functionality
- 📱 **Tablets** - Optimized layout
- 💻 **Desktops** - Best experience

### Mobile Tips

1. Use landscape mode for better view
2. Pinch to zoom on images
3. Swipe to navigate (where supported)
4. Use browser's "Add to Home Screen"

---

## 🔗 Quick Links

### Common Pages

- Login: `/login`
- Tenants: `/tenants`
- Inventory: `/items`
- Settings: `/settings`
- Admin: `/settings/admin`

### Settings Pages

- Appearance: `/settings/appearance`
- Language: `/settings/language`
- Tenant: `/settings/tenant`
- Users: `/settings/admin/users`
- Features: `/settings/admin/features`

---

## 📞 Getting Help

### Support Channels

**Email:** support@retailvisibility.com  
**Response Time:** 24-48 hours

### Before Contacting Support

1. Check this guide
2. Try troubleshooting steps
3. Note any error messages
4. Take screenshots if helpful

### What to Include

- Your email address
- Page URL where issue occurs
- What you were trying to do
- What happened instead
- Browser and device info

---

## 🎓 Training Resources

### Video Tutorials (Coming Soon)

- Getting Started
- Managing Tenants
- Inventory Management
- Admin Features

### Webinars (Coming Soon)

- Monthly training sessions
- Q&A with product team
- Best practices sharing

---

**Last Updated:** October 21, 2025  
**Version:** 1.0.0  

**Need more help?** Contact support@retailvisibility.com
