// dashboard/app/api/execute/route.ts
import { NextRequest, NextResponse } from 'next/server';

const BOT_API_URL = process.env.BOT_API_URL || 'http://127.0.0.1:4000/api';
const BOT_API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

export async function POST(req: NextRequest) {
  const requestId = `exec_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  try {
    const body = await req.json().catch(() => ({}));

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const res = await fetch(`${BOT_API_URL}/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': BOT_API_KEY
      },
      body: JSON.stringify({ ...body, requestId }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    let raw: any = {};
    try { raw = await res.json(); } catch { raw = { success: false, error: 'Invalid JSON from bot' }; }

    // Bot returns: { success, requestId, data: { output, exitCode, executionMs, logs, timestamp } }
    // or: { success: false, error: string, data: null }
    // Normalize to a flat, safe shape for the terminal page.
    const inner = raw?.data || {};
    const success = raw?.success ?? (inner?.exitCode === 0);

    return NextResponse.json({
      success,
      requestId: raw?.requestId || requestId,
      output: inner?.output ?? raw?.error ?? 'No output.',
      exitCode: inner?.exitCode ?? (success ? 0 : 1),
      executionMs: inner?.executionMs ?? 0,
      logs: Array.isArray(inner?.logs) ? inner.logs : [],
      data: inner?.data ?? null,
      timestamp: inner?.timestamp ?? new Date().toISOString(),
      // Also keep raw data nested for advanced inspect
      _raw: raw
    }, { status: res.status });

  } catch (error: any) {
    if (error.name === 'AbortError') {
      return NextResponse.json({
        success: false,
        requestId,
        output: 'Execution timed out. The bot took too long to respond.',
        exitCode: 1,
        executionMs: 10000,
        logs: [],
        data: null,
        error: 'timeout'
      }, { status: 504 });
    }

    const offline = error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND';
    return NextResponse.json({
      success: false,
      requestId,
      output: offline
        ? 'Bot API is offline. Start the bot with: node index.js'
        : `Failed to connect to Bot API: ${error.message}`,
      exitCode: 1,
      executionMs: 0,
      logs: [],
      data: null,
      error: offline ? 'offline' : error.message
    }, { status: offline ? 503 : 500 });
  }
}
