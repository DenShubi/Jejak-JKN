// @ts-check
import { el } from '../utils/dom.js';

class LiveAlertService {
  constructor() {
    /** @type {AudioContext|null} */
    this.audioCtx = null;
    /** @type {HTMLElement|null} */
    this.container = null;
  }

  _getOrCreateContainer() {
    if (!this.container || !document.body.contains(this.container)) {
      let existing = document.getElementById('live-alert-container');
      if (!existing) {
        existing = el('div', { id: 'live-alert-container', class: 'live-alert-container' });
        document.body.appendChild(existing);
      }
      this.container = existing;
    }
    return this.container;
  }

  /**
   * Synthesize a gentle 2-tone pleasant notification chime using Web Audio API
   */
  playChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      if (!this.audioCtx) {
        this.audioCtx = new AudioCtx();
      }
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }

      const now = this.audioCtx.currentTime;
      const masterGain = this.audioCtx.createGain();
      masterGain.gain.setValueAtTime(0.12, now);
      masterGain.connect(this.audioCtx.destination);

      // Tone 1: 880 Hz (A5)
      const osc1 = this.audioCtx.createOscillator();
      const gain1 = this.audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.8, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc1.connect(gain1);
      gain1.connect(masterGain);
      osc1.start(now);
      osc1.stop(now + 0.22);

      // Tone 2: 1320 Hz (E6)
      const osc2 = this.audioCtx.createOscillator();
      const gain2 = this.audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.08);
      gain2.gain.setValueAtTime(0.9, now + 0.08);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc2.connect(gain2);
      gain2.connect(masterGain);
      osc2.start(now + 0.08);
      osc2.stop(now + 0.38);
    } catch {
      // Audio playback may be blocked before first user gesture
    }
  }

  /**
   * Display a floating alert toast
   * @param {Object} options
   * @param {string} options.title
   * @param {string} options.message
   * @param {string} [options.badge]
   * @param {string} [options.icon]
   * @param {string} [options.actionLabel]
   * @param {Function} [options.onAction]
   * @param {number} [options.duration] in ms, default 7000
   */
  show({
    title,
    message,
    badge = 'Pemberitahuan',
    icon = '🔔',
    actionLabel = null,
    onAction = null,
    duration = 7000
  }) {
    const parent = this._getOrCreateContainer();

    const banner = el('div', { class: 'live-alert-toast' });
    const header = el('div', { class: 'live-alert-header' }, [
      el('span', { class: 'live-alert-icon' }, [icon]),
      el('span', { class: 'live-alert-badge' }, [badge]),
      el('span', { class: 'live-alert-title' }, [title]),
      el(
        'button',
        {
          class: 'live-alert-close',
          type: 'button',
          title: 'Tutup',
          onclick: () => this._dismiss(banner)
        },
        ['✕']
      )
    ]);

    const body = el('div', { class: 'live-alert-body' }, [message]);

    const actions = el('div', { class: 'live-alert-actions' });
    if (actionLabel && onAction) {
      const btn = el(
        'button',
        {
          class: 'btn btn-sm btn-primary live-alert-action-btn',
          type: 'button',
          onclick: () => {
            try {
              onAction();
            } finally {
              this._dismiss(banner);
            }
          }
        },
        [actionLabel]
      );
      actions.appendChild(btn);
    }

    banner.appendChild(header);
    banner.appendChild(body);
    if (actionLabel && onAction) {
      banner.appendChild(actions);
    }

    parent.prepend(banner);

    if (duration > 0) {
      setTimeout(() => {
        this._dismiss(banner);
      }, duration);
    }

    return banner;
  }

  _dismiss(banner) {
    if (!banner || banner.classList.contains('dismissing')) return;
    banner.classList.add('dismissing');
    setTimeout(() => {
      if (banner.parentElement) {
        banner.parentElement.removeChild(banner);
      }
    }, 280);
  }
}

export const liveAlert = new LiveAlertService();
