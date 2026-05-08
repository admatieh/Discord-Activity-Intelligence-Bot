// dashboard/app/api/actions/quick/route.ts
// Proxy for quick bot actions: list-sessions, db-status, check-permissions, sync-voice-members
import { NextRequest, NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

async function botRequest(method: string, path: string, body?: any) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${BOT_API_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BOT_API_KEY,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return { ok: res.ok, status: res.status, data: await res.json() };
  } catch (err: any) {
    clearTimeout(timeout);
    const offline = err.name === 'AbortError' || err.code === 'ECONNREFUSED';
    return {
      ok: false,
      status: offline ? 503 : 500,
      data: { ok: false, error: offline ? 'Bot API offline' : err.message }
    };
  }
}

// GET /api/actions/quick?action=...&guildId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get('action');
  const guildId = searchParams.get('guildId');

  if (action === 'list-sessions') {
    const result = await botRequest('GET', '/actions/list-sessions');
    return NextResponse.json(result.data, { status: result.status });
  }

  if (action === 'db-status') {
    const result = await botRequest('GET', '/actions/db-status');
    return NextResponse.json(result.data, { status: result.status });
  }

  if (action === 'check-permissions') {
    const path = guildId
      ? `/actions/check-permissions?guildId=${guildId}`
      : '/actions/check-permissions';
    const result = await botRequest('GET', path);
    return NextResponse.json(result.data, { status: result.status });
  }

  if (action === 'health') {
    const result = await botRequest('GET', '/system/runtime');
    return NextResponse.json(result.data, { status: result.status });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
}

// POST /api/actions/quick
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const { action, ...rest } = body;

  if (action === 'sync-voice-members') {
    const result = await botRequest('POST', '/actions/sync-voice-members', rest);
    return NextResponse.json(result.data, { status: result.status });
  }

  if (action === 'session.end-all') {
    const result = await botRequest('POST', '/actions/session/end', { source: 'dashboard' });
    return NextResponse.json(result.data, { status: result.status });
  }

  if (action === 'session.report') {
    const result = await botRequest('POST', '/actions/session/report', rest);
    return NextResponse.json(result.data, { status: result.status });
  }

  return NextResponse.json({ ok: false, error: 'Unknown action' }, { status: 400 });
}
