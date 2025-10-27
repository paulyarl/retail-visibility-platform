import { NextRequest, NextResponse } from 'next/server';

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const queryString = searchParams.toString();
    const url = `${API_BASE_URL}/upgrade-requests${queryString ? `?${queryString}` : ''}`;
    
    const res = await fetch(url);
    const data = await res.json();
    
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Error fetching upgrade requests:', error);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    const res = await fetch(`${API_BASE_URL}/upgrade-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error) {
    console.error('Error creating upgrade request:', error);
    return NextResponse.json({ error: 'proxy_failed' }, { status: 500 });
  }
}