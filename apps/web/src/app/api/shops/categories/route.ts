/**
 * Shop Categories API Route
 * Universal Singleton aligned endpoint for shop categories
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';

// Mock categories data - in production this would come from database
const SHOP_CATEGORIES = [
  { id: 'electronics', name: 'Electronics', count: 145, icon: '📱' },
  { id: 'clothing', name: 'Clothing & Fashion', count: 89, icon: '👕' },
  { id: 'food', name: 'Food & Beverage', count: 67, icon: '🍔' },
  { id: 'home', name: 'Home & Garden', count: 54, icon: '🏠' },
  { id: 'health', name: 'Health & Beauty', count: 43, icon: '💄' },
  { id: 'sports', name: 'Sports & Outdoors', count: 38, icon: '⚽' },
  { id: 'books', name: 'Books & Media', count: 31, icon: '📚' },
  { id: 'toys', name: 'Toys & Games', count: 29, icon: '🎮' },
  { id: 'automotive', name: 'Automotive', count: 25, icon: '🚗' },
  { id: 'pets', name: 'Pet Supplies', count: 22, icon: '🐕' },
  { id: 'office', name: 'Office Supplies', count: 19, icon: '📎' },
  { id: 'jewelry', name: 'Jewelry & Accessories', count: 17, icon: '💍' }
];

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json(
        { error: 'authentication_required', message: 'Authentication required' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const includeCount = searchParams.get('includeCount') === 'true';

    let categories = SHOP_CATEGORIES;

    if (!includeCount) {
      categories = categories.map(({ count, ...cat }) => cat) as any;
    }

    return NextResponse.json({
      success: true,
      data: categories,
      total: categories.length
    });

  } catch (error) {
    console.error('[SHOP_CATEGORIES] Error:', error);
    return NextResponse.json(
      { 
        error: 'categories_fetch_failed', 
        message: 'Failed to fetch shop categories' 
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { limit = 100, minProducts = 1 } = body;

    // Get categories with counts
    let categories = SHOP_CATEGORIES.map(cat => ({
      ...cat,
      count: Math.floor(Math.random() * 50) + 10 // Mock count between 10-60
    }));

    // Filter by minimum products and apply limit
    const filteredCategories = categories
      .filter(cat => cat.count >= minProducts)
      .slice(0, limit);

    return NextResponse.json({
      success: true,
      data: filteredCategories
    });

  } catch (error) {
    console.error('[SHOP_CATEGORIES] POST Error:', error);
    return NextResponse.json(
      { 
        error: 'categories_post_failed', 
        message: 'Failed to process shop categories' 
      },
      { status: 500 }
    );
  }
}
