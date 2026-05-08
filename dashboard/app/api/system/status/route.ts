// dashboard/app/api/system/status/route.ts
import { NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

export async function GET() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${BOT_API_URL}/system/runtime`, {
      headers: { 'x-api-key': BOT_API_KEY },
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) throw new Error('Bot API responded with non-OK status');

    const data = await res.json();

    return NextResponse.json({
      success: true,
      data: {
        isOnline: true,
        currentStatus: data.data?.discordState === 'CONNECTED' ? 'online' : 'degraded',
        uptime: data.data?.uptime ?? 0,
        activeSessions: data.data?.activeSessions ?? 0,
        version: data.data?.version ?? 'unknown',
      },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({
      success: false,
      data: {
        isOnline: false,
        currentStatus: 'offline',
        uptime: 0,
        activeSessions: 0,
        version: 'unknown',
      },
      timestamp: new Date().toISOString(),
    });
  }
}
