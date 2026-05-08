// dashboard/app/api/discord/guilds/[guildId]/text-channels/route.ts
import { NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

export async function GET(
  _req: Request,
  context: { params: Promise<{ guildId: string }> }
) {
  const { guildId } = await context.params;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${BOT_API_URL}/discord/guilds/${guildId}/text-channels`, {
      headers: { 'x-api-key': BOT_API_KEY },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) throw new Error(`Bot API ${res.status}`);
    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    const offline = error.name === 'AbortError' || error.code === 'ECONNREFUSED';
    return NextResponse.json({
      ok: false,
      error: offline ? 'Bot API offline' : error.message,
      channels: []
    }, { status: offline ? 503 : 500 });
  }
}
