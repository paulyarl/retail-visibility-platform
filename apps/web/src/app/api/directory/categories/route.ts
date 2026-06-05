import { NextRequest, NextResponse } from 'next/server';
import { directoryService } from '@/services/DirectorySingletonService';

export async function GET(request: NextRequest) {
  try {
    // Use DirectorySingletonService for automatic caching and error handling
    const categories = await directoryService.getDirectoryCategories();
    
    if (!categories) {
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      );
    }

    return NextResponse.json(categories);
  } catch (error) {
    console.error('[Directory Categories API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 }
    );
  }
}
