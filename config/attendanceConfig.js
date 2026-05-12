// config/attendanceConfig.js
//
// Attendance checkpoints (separate from voice session attendance).
// Times are interpreted in the configured TIMEZONE.

module.exports = {
  TIMEZONE: process.env.ATTENDANCE_TIMEZONE || 'Asia/Beirut',
  ACTIVE_DAYS: (process.env.ATTENDANCE_ACTIVE_DAYS || 'MO,TU,WE,TH')
    .split(',')
    .map((d) => d.trim().toUpperCase())
    .filter(Boolean),
  DUTY_STATION_DEFAULT: process.env.ATTENDANCE_DUTY_STATION_DEFAULT || 'Remote',
  REMINDERS_ENABLED: String(process.env.ATTENDANCE_REMINDERS_ENABLED || '').toLowerCase() === 'true',
  REMINDER_CHANNEL_ID: process.env.ATTENDANCE_REMINDER_CHANNEL_ID || '',
  CHECKPOINTS: [
    {
      key: 'morning_checkin',
      label: 'Morning check-in',
      command: 'checkin',
      opensAt: '08:45',
      targetAt: '09:00',
      lateAfter: '09:15',
      closesAt: '10:00',
    },
    {
      key: 'midday_checkin',
      label: 'Midday check-in',
      command: 'checkin',
      opensAt: '11:45',
      targetAt: '12:00',
      lateAfter: '12:15',
      closesAt: '13:00',
    },
    {
      key: 'checkout',
      label: 'Checkout',
      command: 'checkout',
      opensAt: '15:45',
      targetAt: '16:00',
      lateAfter: '16:15',
      closesAt: '17:00',
    },
  ],
}

