// dashboard/app/api/commands/route.ts
import { NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

export async function GET(request: Request) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(`${BOT_API_URL}/commands`, {
      headers: {
        'x-api-key': BOT_API_KEY
      },
      signal: controller.signal
    });

    clearTimeout(timeout);
    
    if (!res.ok) throw new Error('Failed to fetch from Bot API');
    
    const data = await res.json();
    return NextResponse.json(data);
    
  } catch (error) {
    // If Bot API fails, fallback to mock data or empty array to prevent UI crash
    console.error('[Dashboard] Error fetching commands:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to connect to Bot API Server.',
      data: []
    }, { status: 500 });
  }
}
