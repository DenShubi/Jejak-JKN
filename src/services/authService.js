// @ts-check
import { DEMO_ACCOUNTS, DEFAULT_ROOM, sanitizeRoom, readUrlParams, stripDemoParam } from '../config.js';

const STORAGE_KEY_USER = 'jejak.auth.user';
const STORAGE_KEY_ROOM = 'jejak.auth.room';

class AuthService {
  constructor() {
    /** @type {any} */
    this.currentUser = null;
    /** @type {string} */
    this.currentRoom = DEFAULT_ROOM;
    /** @type {Set<Function>} */
    this.subscribers = new Set();
  }

  /**
   * Initialize auth state from URL params or localStorage fallback
   */
  init() {
    const urlParams = readUrlParams();

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

    // 2. Determine Account / Role
    let selectedAccount = null;

    if (urlParams.demo) {
      selectedAccount = DEMO_ACCOUNTS.find((a) => a.key === urlParams.demo) || null;
      stripDemoParam();
    } else if (urlParams.role) {
      if (urlParams.role === 'faskes') {
        selectedAccount = DEMO_ACCOUNTS.find((a) => a.role === 'faskes');
      } else {
        selectedAccount = DEMO_ACCOUNTS.find((a) => a.role === 'verifikator');
      }
    }

    if (!selectedAccount) {
      try {
        const rawSaved = window.localStorage.getItem(STORAGE_KEY_USER);
        if (rawSaved) {
          selectedAccount = JSON.parse(rawSaved);
        }
      } catch {
        // ignore
      }
    }

    if (!selectedAccount) {
      // Default to verifikator
      selectedAccount = DEMO_ACCOUNTS.find((a) => a.key === 'verifikator') || DEMO_ACCOUNTS[0];
    }

    this.currentUser = selectedAccount;
    this._persistUser();
    this._notify();
    return this.currentUser;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  getCurrentRoom() {
    return this.currentRoom;
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

  loginAs(key) {
    const account = DEMO_ACCOUNTS.find((a) => a.key === key);
    if (!account) return false;
    this.currentUser = { ...account };
    this._persistUser();
    this._notify();
    return true;
  }

  loginCustom({ role, fullName, facilityId, facilityName, email }) {
    this.currentUser = {
      key: 'custom',
      label: fullName || 'Pengguna Mandiri',
      hint: role === 'faskes' ? facilityName || 'Faskes Mandiri' : 'Verifikator Mandiri',
      fullName: fullName || (role === 'faskes' ? 'Petugas Faskes' : 'Verifikator Klaim'),
      role: role === 'faskes' ? 'faskes' : 'verifikator',
      facilityId: role === 'faskes' ? (facilityId || 'F-DEMO-CUSTOM') : null,
      facilityName: role === 'faskes' ? (facilityName || 'Faskes Mandiri') : null,
      email: email || 'user@demo.local'
    };
    this._persistUser();
    this._notify();
    return this.currentUser;
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
