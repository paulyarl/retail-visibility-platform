import { NextResponse } from 'next/server';
import { publicDirectoryService } from '@/services/PublicDirectoryService';
import { clientLogger } from '@/lib/client-logger';

export async function GET() {
  const webUrl = process.env.NEXT_PUBLIC_WEB_URL || 'http://localhost:3000';

  try {
    // Fetch all published listings
    const listings = await publicDirectoryService.searchDirectory({
      limit: 1000,
      published: true
    });

    // Generate XML sitemap
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"
        xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
  
  <!-- Directory Homepage -->
  <url>
    <loc>${webUrl}/directory</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>

  <!-- Store Pages -->
${listings.items
  .map(
    (listing: any) => `  <url>
    <loc>${webUrl}/directory/${listing.slug}</loc>
    <lastmod>${listing.updatedAt || new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`
  )
  .join('\n')}

</urlset>`;

    return new NextResponse(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600',
      },
    });
  } catch (error) {
    clientLogger.error('Sitemap generation error:', { detail: error });
    
    // Return minimal sitemap on error
    const fallbackSitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${webUrl}/directory</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    return new NextResponse(fallbackSitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300',
      },
    });
  }
}
