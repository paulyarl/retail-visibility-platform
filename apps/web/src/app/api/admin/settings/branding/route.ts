import { NextRequest, NextResponse } from 'next/server';
import { platformSettingsService } from '@/services/PlatformSettingsSingletonService';

// Force Node.js runtime (not edge) for proper env var access
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    // Use singleton service for cached platform settings
    const settings = await platformSettingsService.getPlatformSettings();
    return NextResponse.json(settings);
  } catch (error) {
    console.error('[Branding Route] Error fetching platform settings:', error);
    return NextResponse.json({
      platformName: 'Visible Shelf',
      logoUrl: null,
      faviconUrl: null,
      primaryColor: '#3b82f6',
      secondaryColor: '#8b5cf6',
    });
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Convert FormData to JSON object
    const settings: Record<string, any> = {};
    for (const [key, value] of formData.entries()) {
      settings[key] = value;
    }
    
    // Use singleton service to update settings
    const updatedSettings = await platformSettingsService.updatePlatformSettings(settings);
    
    if (!updatedSettings) {
      return NextResponse.json(
        { error: 'Failed to update platform settings' },
        { status: 500 }
      );
    }
    
    return NextResponse.json(updatedSettings);
  } catch (error) {
    console.error('[Branding Route] Error updating platform settings:', error);
    return NextResponse.json(
      { error: 'Failed to update platform settings' },
      { status: 500 }
    );
  }
}
