// dashboard/app/api/system/health/route.ts
import { NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

export async function GET(request: Request) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000); // 5s timeout

    const res = await fetch(`${BOT_API_URL}/system/runtime`, {
      headers: {
        'x-api-key': BOT_API_KEY
      },
      signal: controller.signal
    });

    clearTimeout(timeout);
    
    if (!res.ok) throw new Error('Failed to fetch from Bot API');
    
    const data = await res.json();
    
    return NextResponse.json({
      success: true,
      data: {
        status: 'healthy',
        uptime: data.data.uptime,
        version: data.data.version,
        components: [
          { name: 'Gateway', status: data.data.discordState === 'CONNECTED' ? 'healthy' : 'degraded', latency: 0 },
          { name: 'Database', status: 'healthy', latency: 0 },
          { name: 'API Server', status: 'healthy', latency: 0 }
        ]
      },
      error: null
    });
    
  } catch (error) {
    console.error('[Dashboard] Error fetching system health:', error);
    return NextResponse.json({
      success: false,
      error: 'Failed to connect to Bot API Server.',
      data: {
        status: 'unreachable',
        uptime: 0,
        version: 'unknown',
        components: []
      }
    }, { status: 500 });
  }
}
