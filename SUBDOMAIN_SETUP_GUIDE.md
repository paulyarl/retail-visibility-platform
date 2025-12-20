# Custom Subdomain Setup Guide

## Overview

Custom subdomains provide a simple solution for Google Merchant Center (GMC) domain compliance, ensuring your products can be listed on Google Shopping without requiring a full custom domain setup.

## What is a Custom Subdomain?

A custom subdomain is a URL prefix that points to your store on our platform. For example:
- **Without subdomain:** `https://visibleshelf.com/store/yourstore`
- **With subdomain:** `https://yourstore.visibleshelf.com` or `https://yourstore.visibleshelf.store`

**Multi-Domain Support:** Subdomains work across all platform domains:
- **Production:** `yourstore.visibleshelf.com`
- **Staging:** `yourstore.visibleshelf.store`
- **Development:** `yourstore.localhost` (for local testing)
- **Future domains:** Automatically supported

## Why Do I Need a Custom Subdomain?

### Google Merchant Center Requirements

Google requires that product URLs in GMC feeds match the domain of your website. This is called "domain matching" and is essential for:

1. **Feed Approval** - GMC will reject feeds where product URLs don't match your website domain
2. **Product Listings** - Products won't appear in Google Shopping results
3. **Trust & Verification** - Google verifies you own/control the domain

### Benefits of Subdomains

- ✅ **GMC Compliance** - Meet Google's domain requirements
- ✅ **Professional URLs** - `yourstore.visibleshelf.com` looks more professional
- ✅ **Brand Consistency** - Use your store name in the URL
- ✅ **Easy Setup** - No DNS changes or custom domain needed
- ✅ **Platform Managed** - We handle SSL certificates and hosting

## How to Set Up Your Custom Subdomain

### Step 1: Access Subdomain Settings

1. Go to your **Settings** page
2. Navigate to **Store Settings** → **Custom Subdomain**
3. You'll see the subdomain configuration panel

### Step 2: Choose Your Subdomain

1. Enter your desired subdomain name in the input field
   - Use only lowercase letters, numbers, and hyphens
   - Cannot start or end with a hyphen
   - Must be 2-30 characters long
   - Examples: `mybakery`, `coffee-shop-123`, `bobsmarket`

2. Click **Check** to verify availability
   - Green checkmark = Available
   - Red X = Already taken (try a different name)

### Step 3: Set Your Subdomain

1. Once you find an available subdomain, click **Set Subdomain**
2. Wait for confirmation that the subdomain was created
3. Your new subdomain URL will be displayed

### Step 4: Update Your GMC Settings

After setting up your subdomain:

1. Go to **Settings** → **Google Integrations** → **Google Merchant Center**
2. Your GMC feed will now use the subdomain URLs automatically
3. Re-sync your products to GMC with the new URLs

## URL Format Examples

| Subdomain | Product URL |
|-----------|-------------|
| `mybakery` | `https://mybakery.visibleshelf.com/products/123` |
| `coffee-shop` | `https://coffee-shop.visibleshelf.com/products/456` |
| `bobsmarket` | `https://bobsmarket.visibleshelf.com/products/789` |

## Troubleshooting

### Subdomain Not Available
**Issue:** The subdomain name you want is already taken.

**Solution:**
- Try variations of your store name
- Add numbers, location, or descriptors
- Use abbreviations or acronyms

### GMC Still Rejecting Feed
**Issue:** GMC is still rejecting your feed after setting up subdomain.

**Possible Solutions:**
1. **Wait for DNS Propagation** - Subdomain changes can take up to 24 hours to propagate globally
2. **Re-sync Products** - Force a full re-sync of your GMC feed
3. **Check GMC Settings** - Verify your GMC merchant center website URL matches your subdomain
4. **Contact Support** - If issues persist, reach out to our support team

### Subdomain Not Working
**Issue:** The subdomain URL doesn't load your store.

**Possible Solutions:**
1. **Check Spelling** - Ensure the subdomain is entered correctly
2. **Wait for Setup** - Subdomain setup can take a few minutes
3. **Clear Cache** - Clear your browser cache and try again
4. **Contact Support** - If the subdomain still doesn't work after 30 minutes

## Best Practices

### Choosing a Subdomain Name

1. **Keep it Simple** - Use your store name or a clear abbreviation
2. **Be Descriptive** - Include what makes your store unique
3. **Avoid Special Characters** - Stick to letters, numbers, and hyphens
4. **Check Availability** - Verify your preferred name isn't taken

### Examples of Good Subdomains

- `freshbakery` (clean and descriptive)
- `downtowncoffee` (includes location)
- `momsdiner` (personal touch)
- `techhub` (clear and modern)

### Examples of Poor Subdomains

- `store12345` (generic and forgettable)
- `my-awesome-store-with-a-very-long-name` (too long)
- `store!!!` (special characters not allowed)

## Frequently Asked Questions

### Can I change my subdomain later?

Yes, you can change your subdomain at any time. However, you'll need to:
1. Update your GMC merchant center settings
2. Re-sync your product feed
3. Update any external links or marketing materials

### Do I need a custom domain?

No! Subdomains provide GMC compliance without requiring a custom domain purchase or DNS setup. This keeps costs low while maintaining full Google Shopping access.

### Will this affect my existing store URL?

No, your existing `visibleshelf.com/store/yourstore` URL will continue to work. The subdomain provides an additional, more professional URL option.

### How long does setup take?

Subdomain setup is usually instant, but DNS propagation can take up to 24 hours globally. GMC feed updates typically take effect within a few hours.

### Is there a cost for custom subdomains?

Custom subdomains are included in your VisibleShelf subscription at no additional cost. This is our way of ensuring all merchants can access Google Shopping compliance easily.

### Can I use this with Google Business Profile?

Yes! Your subdomain can be used consistently across GMC and GBP for brand consistency.

## Need Help?

If you encounter any issues or have questions:

1. Check this guide first for common solutions
2. Visit our **Settings** → **Support & Help** → **Contact Us**
3. Include your tenant ID and subdomain name when contacting support

## Future Custom Domain Investments

While subdomains provide immediate GMC compliance, VisibleShelf is developing premium custom domain hosting to offer even greater flexibility and branding opportunities for growing businesses.

### Custom Domain Hosting (Coming Soon)

**Premium Feature:** $49/month add-on for Enterprise tier customers

#### Key Benefits

- ✅ **Full Brand Control** - Use your own domain (e.g., `yourstore.com`)
- ✅ **Professional Branding** - Complete domain ownership and control
- ✅ **SEO Advantages** - Better search engine optimization potential
- ✅ **Trust & Credibility** - Customers see your established brand domain
- ✅ **Marketing Flexibility** - Use subdomains like `shop.yourstore.com`

#### Custom Domain Requirements

**Domain Ownership:**
- You must own or purchase your desired domain
- Domain must be registered with a reputable registrar (GoDaddy, Namecheap, etc.)
- Domain should be active and not expired

**Technical Requirements:**
- DNS management access to point domain to our servers
- SSL certificate compatibility (we handle this)
- Domain must not be in use elsewhere

**Business Requirements:**
- Enterprise tier subscription ($299/month)
- Custom domain hosting add-on ($49/month)
- Minimum 6-month commitment for custom domain hosting

### Migration Path: Subdomain → Custom Domain

**Phase 1: Subdomain Setup (Current)**
- Free subdomain hosting
- Immediate GMC compliance
- Platform-managed SSL and infrastructure

**Phase 2: Custom Domain Migration (Q1 2025)**
- Upgrade to Enterprise tier
- Add custom domain hosting ($49/month)
- DNS configuration assistance
- Seamless URL migration with redirects

**Phase 3: Advanced Features (Q2 2025)**
- Multi-domain support
- Custom SSL certificates
- Domain analytics and monitoring
- Advanced redirect management

### Investment Opportunities

#### For Small Businesses
- **Entry Point:** Free subdomains get you GMC compliant immediately
- **Growth Path:** Upgrade to custom domains as your business scales
- **Cost Effective:** Subdomains eliminate domain purchase costs initially

#### For Enterprise Customers
- **Premium Branding:** Full domain control for large operations
- **Multi-Location Support:** Different domains for different locations
- **White-Label Solutions:** Complete brand separation

#### For Platform Growth
- **Revenue Stream:** $49/month custom domain add-on creates recurring revenue
- **Upsell Opportunity:** Natural upgrade path from free subdomains
- **Competitive Advantage:** Unique offering in retail visibility space

### Custom Domain Setup Process (Future)

1. **Domain Purchase** - Acquire your desired domain
2. **DNS Configuration** - Point domain to VisibleShelf servers
3. **SSL Setup** - We generate and manage SSL certificates
4. **Content Migration** - Move from subdomain to custom domain
5. **GMC Updates** - Update merchant center with new URLs
6. **Redirect Setup** - Maintain SEO with proper redirects

### Cost Breakdown

| Feature | Subdomain (Current) | Custom Domain (Future) |
|---------|-------------------|----------------------|
| **Setup Cost** | $0 | $0 (domain purchase separate) |
| **Monthly Cost** | $0 | $49 |
| **Domain Ownership** | Platform-owned | Customer-owned |
| **GMC Compliance** | ✅ | ✅ |
| **SSL Certificate** | ✅ | ✅ |
| **SEO Benefits** | Good | Excellent |
| **Branding Control** | Limited | Full |

### Preparing for Custom Domains

**Start with Subdomains Now:**
- Get GMC compliant immediately
- Test your market presence
- Build your brand recognition
- Save for future custom domain investment

**Domain Selection Tips:**
- Choose `.com` for broadest appeal
- Consider local TLDs (`.ca`, `.co.uk`) for regional businesses
- Avoid trademark conflicts
- Plan for future expansion (multi-location, product lines)

**Business Planning:**
- Budget for domain + hosting costs
- Plan marketing around your domain
- Consider brand consistency across all touchpoints
- Prepare for potential rebranding costs

### Timeline & Roadmap

**Q4 2024:** Subdomain infrastructure complete ✅
**Q1 2025:** Custom domain hosting beta launch
**Q2 2025:** Full custom domain feature set
**Q3 2025:** Multi-domain and advanced features

### Get Started Today

Subdomains provide immediate GMC compliance while positioning you perfectly for future custom domain opportunities. Start with your free subdomain today and upgrade seamlessly when you're ready for full brand control.

**Ready to get GMC compliant?** Set up your subdomain in Settings → Store Settings → Custom Subdomain
