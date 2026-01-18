import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Function to get current settings (reads from environment each time)
function getPlatformSettings() {
  return {
    rateLimitingEnabled: process.env.RATE_LIMITING_ENABLED !== 'false',
    updatedAt: new Date().toISOString(),
    updatedBy: 'system'
  };
}

// Default rate limit configurations
const DEFAULT_CONFIGURATIONS = [
  { route_type: 'auth', max_requests: 20, window_minutes: 1, enabled: true },
  { route_type: 'admin', max_requests: 20, window_minutes: 1, enabled: true },
  { route_type: 'strict', max_requests: 20, window_minutes: 1, enabled: true },
  { route_type: 'standard', max_requests: 100, window_minutes: 1, enabled: true },
  { route_type: 'exempt', max_requests: 1000, window_minutes: 1, enabled: false }
];

export async function GET(request: NextRequest) {
  try {
    // Get auth token from cookies (following pattern from other admin routes)
    const token = request.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    // Get platform settings
    const platformSettings = getPlatformSettings();

    // Get rate limit configurations
    let configurations = await prisma.rate_limit_configurations.findMany({
      orderBy: { route_type: 'asc' }
    });

    // If no configurations exist, create defaults
    if (configurations.length === 0) {
      configurations = await Promise.all(
        DEFAULT_CONFIGURATIONS.map(config =>
          prisma.rate_limit_configurations.create({ data: config })
        )
      );
    }

    return NextResponse.json({
      ...platformSettings,
      rateLimitConfigurations: configurations
    });
  } catch (error) {
    console.error('Error fetching platform settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Get auth token from cookies (following pattern from other admin routes)
    const token = request.cookies.get('access_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { rateLimitingEnabled, rateLimitConfigurations } = body;

    // Validate input
    if (typeof rateLimitingEnabled !== 'boolean') {
      return NextResponse.json(
        { error: 'rateLimitingEnabled must be a boolean' },
        { status: 400 }
      );
    }

    // Update environment variable for middleware
    process.env.RATE_LIMITING_ENABLED = rateLimitingEnabled.toString();

    // Update rate limit configurations if provided
    if (rateLimitConfigurations && Array.isArray(rateLimitConfigurations)) {
      for (const config of rateLimitConfigurations) {
        const { route_type, max_requests, window_minutes, enabled } = config;

        // Validate configuration
        if (typeof max_requests !== 'number' || max_requests < 1 || max_requests > 10000) {
          return NextResponse.json(
            { error: `Invalid max_requests for ${route_type}: must be 1-10000` },
            { status: 400 }
          );
        }
        if (typeof window_minutes !== 'number' || window_minutes < 1 || window_minutes > 60) {
          return NextResponse.json(
            { error: `Invalid window_minutes for ${route_type}: must be 1-60` },
            { status: 400 }
          );
        }
        if (typeof enabled !== 'boolean') {
          return NextResponse.json(
            { error: `Invalid enabled flag for ${route_type}: must be boolean` },
            { status: 400 }
          );
        }

        // Upsert configuration
        await prisma.rate_limit_configurations.upsert({
          where: { route_type },
          update: { max_requests, window_minutes, enabled },
          create: { route_type, max_requests, window_minutes, enabled }
        });
      }
    }

    // Log the change
    console.log('Platform settings updated:', {
      rateLimitingEnabled,
      rateLimitConfigurations: rateLimitConfigurations?.length || 0,
      updatedBy: 'admin',
      timestamp: new Date().toISOString()
    });

    // Return updated settings
    const updatedConfigurations = await prisma.rate_limit_configurations.findMany({
      orderBy: { route_type: 'asc' }
    });

    return NextResponse.json({
      ...getPlatformSettings(),
      rateLimitConfigurations: updatedConfigurations
    });
  } catch (error) {
    console.error('Error updating platform settings:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
