// @ts-check
import {
  DEMO_ACCOUNTS,
  FACILITIES,
  DEFAULT_ROOM,
  LOCAL_DEMO_PASSWORD,
  sanitizeRoom,
  readUrlParams,
  stripDemoParam
} from '../config.js';

const STORAGE_KEY_USER = 'jejak.auth.user';
const STORAGE_KEY_ROOM = 'jejak.auth.room';

class AuthService {
  constructor() {
    /** @type {any} */
    this.currentUser = null;
    /** @type {string} */
    this.currentRoom = DEFAULT_ROOM;
    /** @type {'admin' | 'faskes'} */
    this.initialPortalView = 'admin';
    /** @type {Set<Function>} */
    this.subscribers = new Set();
  }

  /**
   * Initialize auth state from URL params or localStorage fallback
   */
  init() {
    const urlParams = readUrlParams();
    const search = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
    const portalParam = search?.get('portal');

    // 1. Determine Room
    if (urlParams.room) {
      this.currentRoom = urlParams.room;
      try {
        window.localStorage.setItem(STORAGE_KEY_ROOM, this.currentRoom);
      } catch {
        // ignore
      }
    } else {
      try {
        const savedRoom = window.localStorage.getItem(STORAGE_KEY_ROOM);
        this.currentRoom = savedRoom ? sanitizeRoom(savedRoom) : DEFAULT_ROOM;
      } catch {
        this.currentRoom = DEFAULT_ROOM;
      }
    }

    // 2. Determine Initial Portal Tab (for login schema)
    if (portalParam === 'faskes' || urlParams.role === 'faskes') {
      this.initialPortalView = 'faskes';
    } else {
      this.initialPortalView = 'admin';
    }

    // 3. Determine Account / Role (via URL demo param or saved session)
    let selectedAccount = null;

    if (urlParams.demo) {
      selectedAccount = DEMO_ACCOUNTS.find((a) => a.key === urlParams.demo) || null;
      stripDemoParam();
    } else if (urlParams.role) {
      // If direct role param provided without demo, auto-match demo account
      if (urlParams.role === 'faskes') {
        selectedAccount = DEMO_ACCOUNTS.find((a) => a.role === 'faskes') || null;
      } else if (urlParams.role === 'verifikator') {
        selectedAccount = DEMO_ACCOUNTS.find((a) => a.role === 'verifikator') || null;
      }
    }

    // Fall back to saved session only if explicit role/demo was not requested
    if (!selectedAccount && typeof window !== 'undefined') {
      try {
        const rawSaved = window.localStorage.getItem(STORAGE_KEY_USER);
        if (rawSaved) {
          selectedAccount = JSON.parse(rawSaved);
        }
      } catch {
        // ignore
      }
    }

    this.currentUser = selectedAccount;
    if (this.currentUser) {
      this._persistUser();
    }
    this._notify();
    return this.currentUser;
  }

  isAuthenticated() {
    return Boolean(this.currentUser);
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentRoom() {
    return this.currentRoom;
  }

  getInitialPortalView() {
    return this.initialPortalView;
  }

  isVerifikator() {
    return this.currentUser?.role === 'verifikator';
  }

  isFaskes() {
    return this.currentUser?.role === 'faskes';
  }

  setRoom(roomCode) {
    this.currentRoom = sanitizeRoom(roomCode);
    try {
      window.localStorage.setItem(STORAGE_KEY_ROOM, this.currentRoom);
    } catch {
      // ignore
    }
    this._notify();
  }

  /**
   * Login as Admin / Verifikator BPJS
   */
  loginAdmin({ email = 'verifikator@bpjs.go.id', password = '', roomCode = '' }) {
    if (roomCode) {
      this.setRoom(roomCode);
    }
    const cleanEmail = String(email || '').trim().toLowerCase();
    this.currentUser = {
      key: 'verifikator',
      label: 'Verifikator BPJS',
      hint: 'Menerima catatan, menjalankan aturan, mengirim tiket',
      fullName: cleanEmail.includes('admin') ? 'Administrator BPJS Kesehatan' : 'Verifikator Klaim Pusat',
      role: 'verifikator',
      facilityId: null,
      facilityName: null,
      email: cleanEmail || 'verifikator@bpjs.go.id'
    };
    this._persistUser();
    this._notify();
    return { success: true, user: this.currentUser };
  }

  /**
   * Login as Petugas Faskes / Rumah Sakit
   */
  loginFaskes({ facilityId, officerName = '', password = '', roomCode = '' }) {
    if (roomCode) {
      this.setRoom(roomCode);
    }
    const facility = FACILITIES.find((f) => f.id === facilityId) || FACILITIES[0];
    const accountTemplate = DEMO_ACCOUNTS.find((a) => a.facilityId === facility.id);

    this.currentUser = {
      key: accountTemplate?.key || 'faskes_custom',
      label: `Petugas ${facility.name}`,
      hint: `Faskes ${facility.id}`,
      fullName: officerName.trim() || `Petugas RME ${facility.name}`,
      role: 'faskes',
      facilityId: facility.id,
      facilityName: facility.name,
      email: accountTemplate?.email || `petugas@${facility.key}.id`
    };
    this._persistUser();
    this._notify();
    return { success: true, user: this.currentUser };
  }

  /**
   * 1-Click login helper for demo accounts
   */
  loginAs(key) {
    const account = DEMO_ACCOUNTS.find((a) => a.key === key);
    if (!account) return false;
    this.currentUser = { ...account };
    this._persistUser();
    this._notify();
    return true;
  }

  logout() {
    this.currentUser = null;
    try {
      window.localStorage.removeItem(STORAGE_KEY_USER);
    } catch {
      // ignore
    }
    // Clean URL query parameters
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('demo');
      url.searchParams.delete('role');
      window.history.replaceState(null, '', url.toString());
    } catch {
      // ignore
    }
    this._notify();
  }

  onAuthChange(callback) {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  _persistUser() {
    try {
      if (this.currentUser) {
        window.localStorage.setItem(STORAGE_KEY_USER, JSON.stringify(this.currentUser));
      } else {
        window.localStorage.removeItem(STORAGE_KEY_USER);
      }
    } catch {
      // ignore
    }
  }

  _notify() {
    for (const sub of this.subscribers) {
      try {
        sub(this.currentUser, this.currentRoom);
      } catch (err) {
        console.error('Error in auth listener:', err);
      }
    }
  }
}

export const authService = new AuthService();
