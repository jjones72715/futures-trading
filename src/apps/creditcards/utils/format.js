export const $$ = (n) => n == null ? '—' : '$' + Math.round(n).toLocaleString();
export const daysColor = (days) => days <= 30 ? '#FF4D4D' : days <= 60 ? '#FFD60A' : '#00E676';
