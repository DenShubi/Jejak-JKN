export const safe = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    })[c]
  );

const MONTHS_ID = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'Mei',
  'Jun',
  'Jul',
  'Agu',
  'Sep',
  'Okt',
  'Nov',
  'Des'
];

export function formatShortDate(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '-';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  const monthIdx = Number(parts[1]) - 1;
  return `${Number(parts[2])} ${MONTHS_ID[monthIdx] || parts[1]} ${parts[0]}`;
}

export function formatShortDayMonth(isoDate) {
  if (!isoDate || typeof isoDate !== 'string') return '-';
  const parts = isoDate.slice(0, 10).split('-');
  if (parts.length !== 3) return isoDate;
  const monthIdx = Number(parts[1]) - 1;
  return `${Number(parts[2])} ${MONTHS_ID[monthIdx] || parts[1]}`;
}

export function formatTimestamp(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return isoString;
  const day = String(d.getUTCDate()).padStart(2, '0');
  const mon = MONTHS_ID[d.getUTCMonth()];
  const year = d.getUTCFullYear();
  const hh = String(d.getUTCHours()).padStart(2, '0');
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${day} ${mon} ${year}, ${hh}:${mm} UTC`;
}
