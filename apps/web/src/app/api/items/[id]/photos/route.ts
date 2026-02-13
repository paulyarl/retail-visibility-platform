import { itemsService } from '@/services/ItemsSingletonService';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    const data = await itemsService.getPhotos(id);
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Failed to get photos:', error);
    return NextResponse.json({ error: 'Failed to get photos' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    
    // Handle FormData for file uploads
    const formData = await req.formData();
    const files = formData.getAll('photos') as File[];
    
    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }
    
    const urls = await itemsService.uploadPhotos(id, files);
    
    return NextResponse.json({ urls });
  } catch (e) {
    console.error('proxy_error', e);
    return NextResponse.json({ error: 'Failed to upload photos' }, { status: 500 });
  }
}
