const chrono = require('chrono-node');

const input = 'today 10:10 AM';
const refDate = new Date();
const parsed = chrono.parseDate(input, refDate, { timezone: 'Asia/Beirut' });
console.log('Parsed:', parsed);
