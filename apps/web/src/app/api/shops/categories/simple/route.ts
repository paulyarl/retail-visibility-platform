import { NextRequest, NextResponse } from 'next/server';

export async function GET() {
  try {
    // Mock simple shop categories
    const categories = [
      {
        shop_category: 'retail',
        display_name: 'Retail',
        description: 'Retail shops and stores'
      },
      {
        shop_category: 'food',
        display_name: 'Food & Beverage',
        description: 'Restaurants, cafes, and food services'
      },
      {
        shop_category: 'services',
        display_name: 'Services',
        description: 'Professional and personal services'
      },
      {
        shop_category: 'electronics',
        display_name: 'Electronics',
        description: 'Electronics and technology stores'
      },
      {
        shop_category: 'fashion',
        display_name: 'Fashion & Apparel',
        description: 'Clothing and fashion accessories'
      }
    ];

    return NextResponse.json({
      success: true,
      data: categories
    });
  } catch (error) {
    console.error('[Shop Categories Simple API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch shop categories' },
      { status: 500 }
    );
  }
}
