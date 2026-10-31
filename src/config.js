export const FACILITIES = [
  { id: 'F-DEMO-1', name: 'RS Simulasi Aruna', key: 'aruna' },
  { id: 'F-DEMO-2', name: 'RS Simulasi Bima', key: 'bima' },
  { id: 'F-DEMO-3', name: 'RS Simulasi Cakra', key: 'cakra' }
];

export const DEFAULT_ROOM = 'HEALTHKATHON-2026';
export const LOCAL_DEMO_PASSWORD = 'demo2026';

export const DEMO_ACCOUNTS = [
  {
    key: 'verifikator',
    label: 'Verifikator BPJS',
    hint: 'Menerima catatan, menjalankan aturan, mengirim tiket',
    fullName: 'Verifikator Klaim (Demo)',
    role: 'verifikator',
    facilityId: null,
    facilityName: null,
    email: 'verifikator@demo.local'
  },
  {
    key: 'aruna',
    label: 'Petugas RS Aruna',
    hint: 'Faskes F-DEMO-1',
    fullName: 'Petugas RME RS Aruna',
    role: 'faskes',
    facilityId: 'F-DEMO-1',
    facilityName: 'RS Simulasi Aruna',
    email: 'aruna@demo.local'
  },
  {
    key: 'bima',
    label: 'Petugas RS Bima',
    hint: 'Faskes F-DEMO-2 (berisi EP-001)',
    fullName: 'Petugas RME RS Bima',
    role: 'faskes',
    facilityId: 'F-DEMO-2',
    facilityName: 'RS Simulasi Bima',
    email: 'bima@demo.local'
  },
  {
    key: 'cakra',
    label: 'Petugas RS Cakra',
    hint: 'Faskes F-DEMO-3 (berisi EP-002)',
    fullName: 'Petugas RME RS Cakra',
    role: 'faskes',
    facilityId: 'F-DEMO-3',
    facilityName: 'RS Simulasi Cakra',
    email: 'cakra@demo.local'
  }
];

export function sanitizeRoom(value) {
  const cleaned = String(value || '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 32);
  return cleaned || DEFAULT_ROOM;
}

export function readUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const demo = params.get('demo');
  return {
    room: sanitizeRoom(params.get('room')),
    demo: DEMO_ACCOUNTS.some((a) => a.key === demo) ? demo : null,
    forceLocal: params.get('mode') === 'local',
    role: params.get('role') === 'faskes' ? 'faskes' : params.get('role') === 'verifikator' ? 'verifikator' : null
  };
}

export function stripDemoParam() {
  try {
    const url = new URL(window.location.href);
    if (!url.searchParams.has('demo')) return;
    url.searchParams.delete('demo');
    window.history.replaceState(null, '', url.toString());
  } catch {
    // Ignore (e.g. sandboxed file:// contexts)
  }
}

const CLOUD_KEY = 'jejak.cloud.config';

export function getBuildCloudConfig() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  return url && anonKey ? { url, anonKey, source: 'build' } : null;
}

export function getOverrideCloudConfig() {
  try {
    const raw = JSON.parse(window.localStorage.getItem(CLOUD_KEY) || 'null');
    if (raw && typeof raw.url === 'string' && typeof raw.anonKey === 'string' && raw.url && raw.anonKey) {
      return { url: raw.url.trim(), anonKey: raw.anonKey.trim(), source: 'override' };
    }
  } catch {
    // Ignore malformed storage
  }
  return null;
}

export function getCloudConfig() {
  return getOverrideCloudConfig() || getBuildCloudConfig();
}

export function saveCloudConfig(url, anonKey) {
  window.localStorage.setItem(
    CLOUD_KEY,
    JSON.stringify({ url: String(url || '').trim(), anonKey: String(anonKey || '').trim() })
  );
}

export function clearCloudConfig() {
  window.localStorage.removeItem(CLOUD_KEY);
}

export function buildShareLink(room, demoKey) {
  const url = new URL(window.location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('room', room);
  if (demoKey) url.searchParams.set('demo', demoKey);
  return url.toString();
}
