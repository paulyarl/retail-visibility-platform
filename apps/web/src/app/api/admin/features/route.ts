/**
 * Admin Features API Route
 * 
 * CRUD operations for features_list table
 */

import { NextRequest, NextResponse } from 'next/server';

export interface Feature {
  feature_key: string;
  feature_name: string;
  description?: string;
  created_at?: string;
  updated_at?: string;
}

// Mock data - in production this would come from the database
const mockFeatures: Feature[] = [
  {
    feature_key: 'physical_product',
    feature_name: 'Physical Product',
    description: 'Tangible physical products that require inventory and shipping'
  },
  {
    feature_key: 'digital_product',
    feature_name: 'Digital Product', 
    description: 'Digital downloads and virtual products'
  },
  {
    feature_key: 'hybrid_product',
    feature_name: 'Hybrid Product',
    description: 'Products with both physical and digital components'
  }
];

export async function GET(request: NextRequest) {
  try {
    // In production, query the features_list table
    // SELECT * FROM features_list ORDER BY feature_name
    return NextResponse.json(mockFeatures);
  } catch (error) {
    console.error('Admin features API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch features' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { feature_key, feature_name, description } = body;

    if (!feature_key || !feature_name) {
      return NextResponse.json(
        { error: 'feature_key and feature_name are required' },
        { status: 400 }
      );
    }

    // In production, insert into features_list table
    // INSERT INTO features_list (feature_key, feature_name, description) VALUES (?, ?, ?)
    
    const newFeature: Feature = {
      feature_key,
      feature_name,
      description: description || '',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockFeatures.push(newFeature);

    return NextResponse.json(newFeature, { status: 201 });
  } catch (error) {
    console.error('Admin features create API error:', error);
    return NextResponse.json(
      { error: 'Failed to create feature' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { feature_key, feature_name, description } = body;

    if (!feature_key) {
      return NextResponse.json(
        { error: 'feature_key is required' },
        { status: 400 }
      );
    }

    // In production, update features_list table
    // UPDATE features_list SET feature_name = ?, description = ?, updated_at = NOW() WHERE feature_key = ?
    
    const featureIndex = mockFeatures.findIndex(f => f.feature_key === feature_key);
    if (featureIndex === -1) {
      return NextResponse.json(
        { error: 'Feature not found' },
        { status: 404 }
      );
    }

    mockFeatures[featureIndex] = {
      ...mockFeatures[featureIndex],
      feature_name: feature_name || mockFeatures[featureIndex].feature_name,
      description: description || mockFeatures[featureIndex].description,
      updated_at: new Date().toISOString()
    };

    return NextResponse.json(mockFeatures[featureIndex]);
  } catch (error) {
    console.error('Admin features update API error:', error);
    return NextResponse.json(
      { error: 'Failed to update feature' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const feature_key = searchParams.get('feature_key');

    if (!feature_key) {
      return NextResponse.json(
        { error: 'feature_key query parameter is required' },
        { status: 400 }
      );
    }

    // In production, delete from features_list table
    // DELETE FROM features_list WHERE feature_key = ?
    
    const featureIndex = mockFeatures.findIndex(f => f.feature_key === feature_key);
    if (featureIndex === -1) {
      return NextResponse.json(
        { error: 'Feature not found' },
        { status: 404 }
      );
    }

    const deletedFeature = mockFeatures.splice(featureIndex, 1)[0];

    return NextResponse.json(deletedFeature);
  } catch (error) {
    console.error('Admin features delete API error:', error);
    return NextResponse.json(
      { error: 'Failed to delete feature' },
      { status: 500 }
    );
  }
}
