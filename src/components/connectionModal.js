// @ts-check
import { el } from '../utils/dom.js';
import {
  DEFAULT_ROOM,
  sanitizeRoom,
  getCloudConfig,
  saveCloudConfig,
  clearCloudConfig,
  buildShareLink,
  DEMO_ACCOUNTS
} from '../config.js';
import { authService } from '../services/authService.js';
import { realtimeDb } from '../services/realtimeDb.js';

export function openConnectionModal({ onResetRoom, onReloadApp }) {
  const overlay = el('div', { class: 'modal-overlay' });
  const modal = el('div', { class: 'modal connection-modal' });

  const currentRoom = authService.getCurrentRoom();
  const currentUser = authService.getCurrentUser();
  const cloudConfig = getCloudConfig();
  const connState = realtimeDb.getConnectionState();

  const header = el('div', { class: 'modal-header' }, [
    el('div', {}, [
      el('h3', { class: 'modal-title' }, ['Real-time & Connection Settings']),
      el('p', { class: 'modal-subtitle' }, [
        'Connect auditor and healthcare provider devices in real time.'
      ])
    ]),
    el(
      'button',
      {
        class: 'btn-icon',
        type: 'button',
        title: 'Tutup',
        onclick: () => close()
      },
      ['✕']
    )
  ]);

  // Section 1: Room Code & Quick Sharing Links
  const roomInput = el('input', {
    type: 'text',
    class: 'input room-code-input',
    value: currentRoom,
    placeholder: 'HEALTHKATHON-2026'
  });

  const shareLinkInput = el('input', {
    type: 'text',
    class: 'input text-sm',
    readonly: true,
    value: buildShareLink(currentRoom, 'aruna')
  });

  function updateShareLink() {
    const r = sanitizeRoom(roomInput.value);
    shareLinkInput.value = `${window.location.origin}${window.location.pathname}?role=faskes&demo=aruna&room=${r}`;
  }

  roomInput.oninput = () => updateShareLink();

  const copyBtn = el(
    'button',
    {
      class: 'btn btn-outline btn-sm',
      type: 'button',
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(shareLinkInput.value);
          copyBtn.textContent = 'Copied! ✓';
          setTimeout(() => {
            copyBtn.textContent = 'Copy Link';
          }, 2000);
        } catch {
          shareLinkInput.select();
        }
      }
    },
    ['Copy Link']
  );

  const applyRoomBtn = el(
    'button',
    {
      class: 'btn btn-primary btn-sm',
      type: 'button',
      onclick: async () => {
        const cleaned = sanitizeRoom(roomInput.value);
        authService.setRoom(cleaned);
        await realtimeDb.init(cleaned);
        close();
        if (onReloadApp) onReloadApp();
      }
    },
    ['Apply Room']
  );

  const roomSection = el('div', { class: 'conn-section' }, [
    el('h4', { class: 'conn-section-title' }, ['1. Session Room Code']),
    el('p', { class: 'text-sm text-muted mb-2' }, [
      'Use the same room code across devices to synchronize claims and tickets in real time.'
    ]),
    el('div', { class: 'input-row mb-3' }, [roomInput, applyRoomBtn]),
    el('label', { class: 'form-label text-xs' }, [
      'Direct Link for Partner (Provider on another device):'
    ]),
    el('div', { class: 'input-row' }, [shareLinkInput, copyBtn])
  ]);

  // Section 2: Quick Account Switcher
  const accountSection = el('div', { class: 'conn-section' }, [
    el('h4', { class: 'conn-section-title' }, ['2. Switch Demo Account']),
    el('div', { class: 'account-switcher-grid' }, [
      ...DEMO_ACCOUNTS.map((acc) => {
        const isActive = currentUser?.key === acc.key;
        return el(
          'button',
          {
            class: `account-card-btn ${isActive ? 'is-active' : ''}`,
            type: 'button',
            onclick: () => {
              authService.loginAs(acc.key);
              close();
              if (onReloadApp) onReloadApp();
            }
          },
          [
            el('div', { class: 'account-card-top' }, [
              el('span', { class: `badge ${acc.role === 'verifikator' ? 'badge-ok' : 'badge-info'}` }, [
                acc.role === 'verifikator' ? 'Verifikator' : 'Faskes'
              ]),
              isActive ? el('span', { class: 'account-active-tick' }, ['✓ Active']) : null
            ]),
            el('strong', { class: 'account-name' }, [acc.label]),
            el('small', { class: 'account-hint muted' }, [acc.hint])
          ]
        );
      })
    ])
  ]);

  // Section 3: Supabase Cloud Credentials (Optional)
  let cloudOpen = Boolean(cloudConfig);
  const cloudToggle = el('div', { class: 'conn-section-toggle cursor-pointer' }, [
    el('h4', { class: 'conn-section-title' }, ['3. Supabase Cloud Connection (Optional)']),
    el('small', { class: 'text-muted' }, [
      connState.mode === 'supabase' && connState.connected
        ? '● Connected to Cloud Real-time Server'
        : '● Local BroadcastChannel Sync Active'
    ])
  ]);

  const cloudBody = el('div', { class: 'cloud-config-body' });
  cloudBody.style.display = cloudOpen ? 'block' : 'none';

  cloudToggle.onclick = () => {
    cloudOpen = !cloudOpen;
    cloudBody.style.display = cloudOpen ? 'block' : 'none';
  };

  const urlInput = el('input', {
    type: 'text',
    class: 'input mb-2',
    placeholder: 'https://xxxx.supabase.co',
    value: cloudConfig?.url || ''
  });

  const keyInput = el('input', {
    type: 'password',
    class: 'input mb-3',
    placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    value: cloudConfig?.anonKey || ''
  });

  const saveCloudBtn = el(
    'button',
    {
      class: 'btn btn-primary btn-sm',
      type: 'button',
      onclick: async () => {
        const u = urlInput.value.trim();
        const k = keyInput.value.trim();
        if (u && k) {
          saveCloudConfig(u, k);
        } else {
          clearCloudConfig();
        }
        await realtimeDb.init(authService.getCurrentRoom());
        close();
        if (onReloadApp) onReloadApp();
      }
    },
    ['Save & Connect Cloud']
  );

  const clearCloudBtn = el(
    'button',
    {
      class: 'btn btn-outline btn-sm ml-2',
      type: 'button',
      onclick: async () => {
        clearCloudConfig();
        urlInput.value = '';
        keyInput.value = '';
        await realtimeDb.init(authService.getCurrentRoom());
        close();
        if (onReloadApp) onReloadApp();
      }
    },
    ['Use Local Sync']
  );

  cloudBody.appendChild(
    el('p', { class: 'text-xs text-muted mb-2' }, [
      'Enter your Supabase project credentials for cross-network synchronization over the public internet. Without credentials, local browser sync is used.'
    ])
  );
  cloudBody.appendChild(el('label', { class: 'form-label text-xs' }, ['Supabase Project URL']));
  cloudBody.appendChild(urlInput);
  cloudBody.appendChild(el('label', { class: 'form-label text-xs' }, ['Supabase Anon Key']));
  cloudBody.appendChild(keyInput);
  cloudBody.appendChild(el('div', { class: 'btn-row' }, [saveCloudBtn, clearCloudBtn]));

  const cloudSection = el('div', { class: 'conn-section' }, [cloudToggle, cloudBody]);

  // Section 4: Room Reset
  const resetSection = el('div', { class: 'conn-section danger-zone' }, [
    el('div', { class: 'card-header-flex' }, [
      el('div', {}, [
        el('strong', { class: 'text-warn' }, ['Reset Room Data']),
        el('p', { class: 'text-xs text-muted' }, [
          'Clear all session demo submissions in this room and restore the 40 baseline claims.'
        ])
      ]),
      el(
        'button',
        {
          class: 'btn btn-sm btn-outline btn-warn',
          type: 'button',
          onclick: async () => {
            if (
              confirm(
                `Are you sure you want to reset all demo submissions in room "${currentRoom}"?`
              )
            ) {
              await realtimeDb.clearRoomEvents(currentUser);
              if (onResetRoom) onResetRoom();
              close();
            }
          }
        },
        ['Reset to Baseline']
      )
    ])
  ]);

  modal.appendChild(header);
  modal.appendChild(roomSection);
  modal.appendChild(accountSection);
  modal.appendChild(cloudSection);
  modal.appendChild(resetSection);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function close() {
    if (overlay.parentElement) {
      overlay.parentElement.removeChild(overlay);
    }
  }

  overlay.onclick = (e) => {
    if (e.target === overlay) close();
  };
}
