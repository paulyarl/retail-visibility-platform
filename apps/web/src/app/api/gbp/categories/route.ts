import { NextRequest, NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/featureFlags';

// Stub GBP category data until real GBP API is wired
// Note: Real GBP has 4,000+ categories that are mostly universal (not region-specific)
// 
// TODO: Replace with real Google My Business API integration
// Real API endpoint: https://mybusinessbusinessinformation.googleapis.com/v1/categories
// Documentation: https://developers.google.com/my-business/reference/rest/v4/categories
// 
// PILOT TESTING LIMITATION:
// - Category IDs are stubs (gcid:*) and will NOT sync to actual GBP until real API is connected
// - UI and database schema are ready for real integration
// - Category selection and storage will work, but sync status will remain "pending"
const STUB_GBP_CATEGORIES = [
  // Food & Drink
  { id: 'gcid:grocery_store', name: 'Grocery store', path: ['Food & Drink', 'Grocery store'] },
  { id: 'gcid:supermarket', name: 'Supermarket', path: ['Food & Drink', 'Supermarket'] },
  { id: 'gcid:convenience_store', name: 'Convenience store', path: ['Food & Drink', 'Convenience store'] },
  { id: 'gcid:specialty_food_store', name: 'Specialty food store', path: ['Food & Drink', 'Specialty food store'] },
  { id: 'gcid:liquor_store', name: 'Liquor store', path: ['Food & Drink', 'Liquor store'] },
  { id: 'gcid:restaurant', name: 'Restaurant', path: ['Food & Drink', 'Restaurant'] },
  { id: 'gcid:cafe', name: 'Cafe', path: ['Food & Drink', 'Cafe'] },
  { id: 'gcid:bakery', name: 'Bakery', path: ['Food & Drink', 'Bakery'] },
  { id: 'gcid:bar', name: 'Bar', path: ['Food & Drink', 'Bar'] },
  { id: 'gcid:fast_food_restaurant', name: 'Fast food restaurant', path: ['Food & Drink', 'Fast food restaurant'] },
  { id: 'gcid:coffee_shop', name: 'Coffee shop', path: ['Food & Drink', 'Coffee shop'] },
  
  // Shopping - General
  { id: 'gcid:clothing_store', name: 'Clothing store', path: ['Shopping', 'Clothing store'] },
  { id: 'gcid:shoe_store', name: 'Shoe store', path: ['Shopping', 'Shoe store'] },
  { id: 'gcid:electronics_store', name: 'Electronics store', path: ['Shopping', 'Electronics store'] },
  { id: 'gcid:furniture_store', name: 'Furniture store', path: ['Shopping', 'Furniture store'] },
  { id: 'gcid:hardware_store', name: 'Hardware store', path: ['Shopping', 'Hardware store'] },
  { id: 'gcid:book_store', name: 'Book store', path: ['Shopping', 'Book store'] },
  { id: 'gcid:toy_store', name: 'Toy store', path: ['Shopping', 'Toy store'] },
  { id: 'gcid:pet_store', name: 'Pet store', path: ['Shopping', 'Pet store'] },
  { id: 'gcid:gift_shop', name: 'Gift shop', path: ['Shopping', 'Gift shop'] },
  { id: 'gcid:sporting_goods_store', name: 'Sporting goods store', path: ['Shopping', 'Sporting goods store'] },
  { id: 'gcid:department_store', name: 'Department store', path: ['Shopping', 'Department store'] },
  { id: 'gcid:jewelry_store', name: 'Jewelry store', path: ['Shopping', 'Jewelry store'] },
  { id: 'gcid:home_goods_store', name: 'Home goods store', path: ['Shopping', 'Home goods store'] },
  
  // Health & Beauty
  { id: 'gcid:pharmacy', name: 'Pharmacy', path: ['Health', 'Pharmacy'] },
  { id: 'gcid:drugstore', name: 'Drugstore', path: ['Health', 'Drugstore'] },
  { id: 'gcid:gym', name: 'Gym', path: ['Health', 'Gym'] },
  { id: 'gcid:spa', name: 'Spa', path: ['Health', 'Spa'] },
  { id: 'gcid:hair_salon', name: 'Hair salon', path: ['Beauty', 'Hair salon'] },
  { id: 'gcid:beauty_salon', name: 'Beauty salon', path: ['Beauty', 'Beauty salon'] },
  { id: 'gcid:nail_salon', name: 'Nail salon', path: ['Beauty', 'Nail salon'] },
  { id: 'gcid:barber_shop', name: 'Barber shop', path: ['Beauty', 'Barber shop'] },
  { id: 'gcid:cosmetics_store', name: 'Cosmetics store', path: ['Beauty', 'Cosmetics store'] },
  { id: 'gcid:beauty_supply_store', name: 'Beauty supply store', path: ['Beauty', 'Beauty supply store'] },
  
  // Automotive
  { id: 'gcid:auto_parts_store', name: 'Auto parts store', path: ['Automotive', 'Auto parts store'] },
  { id: 'gcid:car_repair', name: 'Car repair', path: ['Automotive', 'Car repair'] },
  { id: 'gcid:gas_station', name: 'Gas station', path: ['Automotive', 'Gas station'] },
];

/**
 * GET /api/gbp/categories
 * Search GBP categories from platform_categories table
 * Proxies to backend API
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('query') || '';
    const limit = searchParams.get('limit') || '20';
    const tenantId = searchParams.get('tenantId') || '';

    // Proxy to backend API
    const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
    const backendUrl = `${apiUrl}/api/gbp/categories?query=${encodeURIComponent(query)}&limit=${limit}&tenantId=${encodeURIComponent(tenantId)}`;
    
    const response = await fetch(backendUrl);
    
    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(error, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[GBP Categories API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to search GBP categories' },
      { status: 500 }
    );
  }
}
