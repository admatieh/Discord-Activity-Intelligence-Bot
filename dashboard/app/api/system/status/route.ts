import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    data: {
      isOnline: false,
      currentStatus: 'offline',
      activityType: 'playing',
      activityText: 'None'
    },
    timestamp: new Date().toISOString(),
  })
}

export async function PATCH(request: Request) {
  const body = await request.json()
  return NextResponse.json({
    data: body,
    timestamp: new Date().toISOString(),
  })
}
