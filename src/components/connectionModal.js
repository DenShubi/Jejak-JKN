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
      el('h3', { class: 'modal-title' }, ['Pengaturan Koneksi & Real-time']),
      el('p', { class: 'modal-subtitle' }, [
        'Hubungkan laptop verifikator dan perangkat faskes secara langsung.'
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
          copyBtn.textContent = 'Tersalin! ✓';
          setTimeout(() => {
            copyBtn.textContent = 'Salin Tautan';
          }, 2000);
        } catch {
          shareLinkInput.select();
        }
      }
    },
    ['Salin Tautan']
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
    ['Terapkan Ruang']
  );

  const roomSection = el('div', { class: 'conn-section' }, [
    el('h4', { class: 'conn-section-title' }, ['1. Kode Ruang Sesi (Demo Room)']),
    el('p', { class: 'text-sm text-muted mb-2' }, [
      'Gunakan kode ruang yang sama antara laptop Anda dan perangkat teman agar saling terhubung.'
    ]),
    el('div', { class: 'input-row mb-3' }, [roomInput, applyRoomBtn]),
    el('label', { class: 'form-label text-xs' }, [
      'Tautan Langsung untuk Teman (Petugas RS Aruna di HP/Laptop lain):'
    ]),
    el('div', { class: 'input-row' }, [shareLinkInput, copyBtn])
  ]);

  // Section 2: Quick Account Switcher
  const accountSection = el('div', { class: 'conn-section' }, [
    el('h4', { class: 'conn-section-title' }, ['2. Beralih Akun Demonstrasi']),
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
              isActive ? el('span', { class: 'account-active-tick' }, ['✓ Aktif']) : null
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
    el('h4', { class: 'conn-section-title' }, ['3. Sambungan Cloud Supabase Realtime (Opsional)']),
    el('small', { class: 'text-muted' }, [
      connState.mode === 'supabase' && connState.connected
        ? '● Terhubung ke Server Cloud Real-time'
        : '● Mode Sinkronisasi Lokal Aktif'
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
    ['Simpan & Sambungkan Cloud']
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
    ['Gunakan Sinkronisasi Lokal']
  );

  cloudBody.appendChild(
    el('p', { class: 'text-xs text-muted mb-2' }, [
      'Jika demonstrasi dilakukan antar-perangkat lewat internet tanpa Wi-Fi lokal yang sama, masukkan kredensial Supabase gratis Anda di sini. Tanpa kredensial, aplikasi otomatis memakai BroadcastChannel / localStorage sync lokal.'
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
        el('strong', { class: 'text-warn' }, ['Reset Data Ruang']),
        el('p', { class: 'text-xs text-muted' }, [
          'Hapus seluruh kiriman sesi demo baru di ruang ini dan kembalikan ke baseline 40 episode awal.'
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
                `Apakah Anda yakin ingin mereset seluruh data kiriman demo pada ruang "${currentRoom}"?`
              )
            ) {
              await realtimeDb.clearRoomEvents(currentUser);
              if (onResetRoom) onResetRoom();
              close();
            }
          }
        },
        ['Reset ke Baseline']
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
