import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { businessName, location } = body;

    // Generate slug patterns based on business name and location
    const businessNameSlug = businessName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim('-');

    const locationSlug = location?.city 
      ? location.city.toLowerCase().replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').trim('-')
      : '';

    // Generate multiple slug pattern options for tenant URL
    const patterns = [
      businessNameSlug,
      locationSlug ? `${businessNameSlug}-${locationSlug}` : businessNameSlug,
      locationSlug ? `${locationSlug}-${businessNameSlug}` : businessNameSlug,
      businessNameSlug.length > 10 ? businessNameSlug.substring(0, 10) : businessNameSlug,
      locationSlug ? `${businessNameSlug.substring(0, 8)}-${locationSlug}` : businessNameSlug
    ].filter((slug, index, arr) => arr.indexOf(slug) === index); // Remove duplicates

    // Check availability for each pattern (mock implementation)
    const results = patterns.map(pattern => ({
      slug: pattern,
      isAvailable: Math.random() > 0.3, // Mock 70% availability
      description: `${pattern}${pattern === businessNameSlug ? ' (business name)' : locationSlug && pattern.includes(locationSlug) ? ' (with location)' : ' (shortened)'}`
    }));

    return NextResponse.json(results);
  } catch (error) {
    console.error('[Tenant Slug Patterns API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to generate tenant slug patterns' },
      { status: 500 }
    );
  }
}
