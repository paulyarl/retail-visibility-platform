import { NextResponse } from 'next/server';

export async function GET() {
  const res = await fetch('http://localhost:4000/tenants');
  const data = await res.json();
  return NextResponse.json(data);
}
