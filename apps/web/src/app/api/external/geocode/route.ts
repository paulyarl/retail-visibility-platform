import { NextRequest, NextResponse } from 'next/server';
import { OpenStreetMapService } from '@/services/OpenStreetMapService';

/**
 * Server-side proxy for external geocoding API
 * Uses PublicApiSingleton to follow proper public flow for external calls
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get('lat');
    const lon = searchParams.get('lon');
    
    if (!lat || !lon) {
      return NextResponse.json(
        { error: 'Missing latitude or longitude parameters' },
        { status: 400 }
      );
    }
    
    // Use OpenStreetMapService for proper external API handling
    const osmService = OpenStreetMapService.getInstance();
    
    const result = await osmService.reverseGeocode(parseFloat(lat), parseFloat(lon));
    
    if (!result) {
      console.error('[Geocode API] External API returned null');
      return NextResponse.json(
        { error: 'Failed to geocode coordinates' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[Geocode API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to geocode coordinates' },
      { status: 500 }
    );
  }
}
