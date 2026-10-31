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

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, val] of Object.entries(attrs || {})) {
    if (val === undefined || val === null) continue;
    if (key === 'class' || key === 'className') {
      node.className = String(val);
    } else if (key.startsWith('on') && typeof val === 'function') {
      node.addEventListener(key.slice(2).toLowerCase(), val);
    } else if (typeof val === 'boolean') {
      if (val) node.setAttribute(key, '');
    } else {
      node.setAttribute(key, String(val));
    }
  }
  for (const child of children || []) {
    if (child === null || child === undefined) continue;
    if (typeof child === 'string' || typeof child === 'number') {
      node.appendChild(document.createTextNode(String(child)));
    } else if (child instanceof Node) {
      node.appendChild(child);
    }
  }
  return node;
}

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
