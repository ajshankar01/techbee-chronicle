/**
 * S3 List API Route
 * Proxies to FastAPI backend which lists real S3 videos and reports.
 * Returns grouped candidate data with presigned URLs.
 */
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const API_URL = (process.env.NEXT_PUBLIC_API_URL || 'https://techbee-api.onrender.com').replace(/\/+$/, '');

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('Authorization') || req.headers.get('authorization') || '';
    const res = await fetch(`${API_URL}/api/s3/list`, {
      headers: authHeader ? { 'Authorization': authHeader } : {},
      cache: 'no-store',
    });
    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch S3 list from backend' }, { status: 502 });
    }
    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error('Error in proxy API:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
