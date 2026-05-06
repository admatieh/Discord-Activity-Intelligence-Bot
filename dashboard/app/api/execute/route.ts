// dashboard/app/api/execute/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BOT_API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

export async function POST(req: NextRequest) {
  const requestId = `exec_\${Date.now()}_\${Math.random().toString(36).slice(2, 7)}`;

  try {
    const body = await req.json();

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(`\${BOT_API_URL}/execute`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-api-key': BOT_API_KEY
      },
      body: JSON.stringify({ ...body, requestId }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const data = await res.json();
    
    return NextResponse.json(data, { status: res.status });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({
        success: false,
        requestId,
        error: 'Execution timed out. The bot took too long to respond.',
        data: null
      }, { status: 504 });
    }

    return NextResponse.json({
      success: false,
      requestId,
      error: 'Failed to connect to Bot API Server.',
      data: null
    }, { status: 500 });
  }
}
