// @ts-check
import { createClient } from '@supabase/supabase-js';
import { getCloudConfig } from '../config.js';
import { generateId } from '../utils/id.js';

/**
 * Event envelope:
 * {
 *   id: string,
 *   type: 'submission' | 'ticket' | 'ticket_reply' | 'review' | 'reset_room',
 *   room: string,
 *   sender: { key: string, role: string, label: string, facilityId?: string },
 *   timestamp: string,
 *   payload: any
 * }
 */

class RealtimeDbService {
  constructor() {
    this.room = '';
    this.cloudConfig = null;
    /** @type {any} */
    this.supabase = null;
    /** @type {any} */
    this.supabaseChannel = null;
    /** @type {BroadcastChannel|null} */
    this.broadcastChannel = null;
    /** @type {Set<Function>} */
    this.eventListeners = new Set();
    /** @type {Set<Function>} */
    this.statusListeners = new Set();
    this.mode = 'local'; // 'supabase' | 'local'
    this.connected = false;
    this.boundStorageHandler = this._handleStorageEvent.bind(this);
  }

  /**
   * Initialize or switch room
   * @param {string} roomCode
   */
  async init(roomCode) {
    if (this.room === roomCode && (this.broadcastChannel || this.supabaseChannel)) {
      return;
    }

    this.disconnect();
    this.room = roomCode;
    this.cloudConfig = getCloudConfig();

    // 1. Setup local BroadcastChannel (always active as fast local bus)
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel(`jejak_room_${this.room}`);
        this.broadcastChannel.onmessage = (evt) => {
          if (evt.data && evt.data.room === this.room) {
            this._handleIncomingEvent(evt.data, false);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel failed to initialize:', err);
      }
    }

    // 2. Setup localStorage fallback listener
    if (typeof window !== 'undefined') {
      window.addEventListener('storage', this.boundStorageHandler);
    }

    // 3. Setup Supabase if config is provided
    if (this.cloudConfig && this.cloudConfig.url && this.cloudConfig.anonKey) {
      try {
        this.mode = 'supabase';
        this.supabase = createClient(this.cloudConfig.url, this.cloudConfig.anonKey, {
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        });

        const channelTopic = `jejak:room:${this.room}`;
        this.supabaseChannel = this.supabase.channel(channelTopic);

        this.supabaseChannel
          .on('broadcast', { event: 'jejak_event' }, (payload) => {
            if (payload && payload.payload && payload.payload.room === this.room) {
              this._handleIncomingEvent(payload.payload, false);
            }
          })
          .subscribe((status) => {
            if (status === 'SUBSCRIBED') {
              this.connected = true;
              this._notifyStatus();
            } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
              this.connected = false;
              this._notifyStatus();
            }
          });
      } catch (err) {
        console.warn('Supabase Realtime failed, falling back to local mode:', err);
        this.mode = 'local';
        this.connected = true;
      }
    } else {
      this.mode = 'local';
      this.connected = true;
    }

    this._notifyStatus();
  }

  disconnect() {
    if (this.supabaseChannel && this.supabase) {
      try {
        this.supabase.removeChannel(this.supabaseChannel);
      } catch {
        // ignore
      }
      this.supabaseChannel = null;
      this.supabase = null;
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch {
        // ignore
      }
      this.broadcastChannel = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', this.boundStorageHandler);
    }

    this.connected = false;
    this._notifyStatus();
  }

  getConnectionState() {
    return {
      mode: this.mode,
      connected: this.connected,
      connecting: this.mode === 'supabase' && !this.connected,
      room: this.room,
      hasCloudConfig: !!(this.cloudConfig && this.cloudConfig.url)
    };
  }

  onEvent(callback) {
    this.eventListeners.add(callback);
    return () => this.eventListeners.delete(callback);
  }

  onStatusChange(callback) {
    this.statusListeners.add(callback);
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Broadcast an event to all peers in the room
   * @param {'submission' | 'ticket' | 'ticket_reply' | 'review' | 'reset_room'} type
   * @param {any} payload
   * @param {any} sender
   */
  async publish(type, payload, sender) {
    const event = {
      id: generateId('EVT'),
      type,
      room: this.room,
      sender: {
        key: sender?.key || 'unknown',
        role: sender?.role || 'verifikator',
        label: sender?.label || sender?.fullName || 'Pengguna',
        facilityId: sender?.facilityId || null
      },
      timestamp: new Date().toISOString(),
      payload
    };

    // 1. Save to local room history
    this._saveToHistory(event);

    // 2. Broadcast via Supabase if connected
    if (this.supabaseChannel && this.connected) {
      try {
        await this.supabaseChannel.send({
          type: 'broadcast',
          event: 'jejak_event',
          payload: event
        });
      } catch (err) {
        console.warn('Failed to send broadcast via Supabase:', err);
      }
    }

    // 3. Broadcast via local BroadcastChannel
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(event);
      } catch (err) {
        console.warn('Failed to post message to BroadcastChannel:', err);
      }
    }

    // 4. Trigger localStorage storage event ping for other tabs/windows
    try {
      window.localStorage.setItem(
        `jejak.ping.${this.room}`,
        JSON.stringify({ id: event.id, timestamp: Date.now() })
      );
    } catch {
      // ignore
    }

    // 5. Notify self / local subscribers
    this._handleIncomingEvent(event, true);
    return event;
  }

  /**
   * Get all past events stored for this room
   */
  getRoomEvents() {
    if (typeof window === 'undefined') return [];
    try {
      const raw = window.localStorage.getItem(`jejak.room.${this.room}.events`);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  /**
   * Clear all room events (reset back to baseline)
   */
  async clearRoomEvents(sender) {
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.removeItem(`jejak.room.${this.room}.events`);
      } catch {
        // ignore
      }
    }
    await this.publish('reset_room', { clearedAt: new Date().toISOString() }, sender);
  }

  _saveToHistory(event) {
    if (typeof window === 'undefined') return;
    try {
      if (event.type === 'reset_room') {
        window.localStorage.removeItem(`jejak.room.${this.room}.events`);
        return;
      }
      const events = this.getRoomEvents();
      // Deduplicate by event.id
      if (!events.some((e) => e.id === event.id)) {
        events.push(event);
        window.localStorage.setItem(`jejak.room.${this.room}.events`, JSON.stringify(events));
      }
    } catch (err) {
      console.warn('Failed to persist event to localStorage:', err);
    }
  }

  _handleIncomingEvent(event, isSelf = false) {
    if (!event || event.room !== this.room) return;
    if (!isSelf) {
      this._saveToHistory(event);
    }
    for (const listener of this.eventListeners) {
      try {
        listener(event, isSelf);
      } catch (err) {
        console.error('Error in event listener:', err);
      }
    }
  }

  _handleStorageEvent(evt) {
    if (!evt.key || evt.key !== `jejak.ping.${this.room}`) return;
    // Pinging indicates a new event was saved
    try {
      const events = this.getRoomEvents();
      if (events.length > 0) {
        const lastEvent = events[events.length - 1];
        if (lastEvent) {
          this._handleIncomingEvent(lastEvent, false);
        }
      }
    } catch {
      // ignore
    }
  }

  _notifyStatus() {
    const state = this.getConnectionState();
    for (const listener of this.statusListeners) {
      try {
        listener(state);
      } catch (err) {
        console.error('Error in status listener:', err);
      }
    }
  }
}

export const realtimeDb = new RealtimeDbService();
