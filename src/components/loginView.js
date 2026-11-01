// @ts-check
import { el } from '../utils/dom.js';
import { authService } from '../services/authService.js';
import { FACILITIES, DEFAULT_ROOM } from '../config.js';

/**
 * Separated Login View for Admin/Verifikator BPJS and Petugas Faskes
 */
export function createLoginView({ onLoginSuccess }) {
  const container = el('div', { class: 'login-gateway-container fade-in' });

  // Current active login tab: 'admin' | 'faskes'
  let activeTab = authService.getInitialPortalView() || 'admin';

  function render() {
    container.innerHTML = '';

    const currentRoom = authService.getCurrentRoom() || DEFAULT_ROOM;

    // Card Wrapper
    const card = el('div', { class: 'login-card' });

    // Portal Switcher Tabs
    const tabsRow = el('div', { class: 'login-tabs' }, [
      el(
        'button',
        {
          class: `login-tab ${activeTab === 'admin' ? 'is-active' : ''}`,
          type: 'button',
          onclick: () => {
            activeTab = 'admin';
            render();
          }
        },
        [
          el(
            'span',
            { class: 'tab-icon', 'aria-hidden': 'true' },
            [
              createSvgIcon(
                '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'
              )
            ]
          ),
          el('span', {}, [
            el('strong', {}, ['Verifikator BPJS']),
            el('small', { class: 'muted' }, ['Pemeriksaan Klaim Pusat'])
          ])
        ]
      ),
      el(
        'button',
        {
          class: `login-tab ${activeTab === 'faskes' ? 'is-active' : ''}`,
          type: 'button',
          onclick: () => {
            activeTab = 'faskes';
            render();
          }
        },
        [
          el(
            'span',
            { class: 'tab-icon', 'aria-hidden': 'true' },
            [
              createSvgIcon(
                '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22v-4h6v4"/><path d="M8 6h.01"/><path d="M16 6h.01"/><path d="M12 6h.01"/><path d="M12 10h.01"/><path d="M12 14h.01"/><path d="M16 10h.01"/><path d="M16 14h.01"/><path d="M8 10h.01"/><path d="M8 14h.01"/>'
              )
            ]
          ),
          el('span', {}, [
            el('strong', {}, ['Petugas Faskes']),
            el('small', { class: 'muted' }, ['Penyerahan Catatan RME'])
          ])
        ]
      )
    ]);

    card.appendChild(tabsRow);

    if (activeTab === 'admin') {
      card.appendChild(renderAdminSchema(currentRoom));
    } else {
      card.appendChild(renderFaskesSchema(currentRoom));
    }

    container.appendChild(card);
  }

  function createSvgIcon(pathContent) {
    const span = document.createElement('span');
    span.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="svg-login-icon">${pathContent}</svg>`;
    return span.firstElementChild;
  }

  function renderAdminSchema(currentRoom) {
    const section = el('div', { class: 'login-schema-body' });

    // Header
    const header = el('div', { class: 'login-header' }, [
      el('span', { class: 'login-badge-pill admin-pill' }, ['PORTAL VERIFIKATOR BPJS']),
      el('h2', { class: 'login-title' }, ['Ruang Kerja Verifikasi Klaim']),
      el('p', { class: 'login-subtitle' }, [
        'Pemeriksaan rekonsiliasi kesesuaian klaim fisioterapi program JKN berbasis bukti deterministik.'
      ])
    ]);

    // Inputs
    const emailInput = el('input', {
      type: 'email',
      class: 'input',
      value: 'verifikator@bpjs.go.id',
      placeholder: 'nama@bpjs.go.id'
    });

    const passInput = el('input', {
      type: 'password',
      class: 'input',
      value: 'demo2026',
      placeholder: '••••••••'
    });

    const roomInput = el('input', {
      type: 'text',
      class: 'input monospace font-bold',
      value: currentRoom,
      placeholder: 'HEALTHKATHON-2026'
    });

    const submitBtn = el(
      'button',
      {
        class: 'btn btn-primary btn-block login-submit-btn',
        type: 'button',
        onclick: () => {
          authService.loginAdmin({
            email: emailInput.value,
            password: passInput.value,
            roomCode: roomInput.value
          });
          onLoginSuccess('verifikator');
        }
      },
      ['Masuk ke Ruang Kerja']
    );

    const quickDemoBtn = el(
      'button',
      {
        class: 'btn btn-outline btn-block mt-2',
        type: 'button',
        onclick: () => {
          authService.loginAs('verifikator');
          onLoginSuccess('verifikator');
        }
      },
      ['Akses Cepat Demo: Verifikator BPJS']
    );

    const form = el('div', { class: 'login-form' }, [
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Email Kedinasan BPJS Kesehatan']),
        emailInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Kata Sandi']),
        passInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Kode Ruang Sesi Real-time']),
        roomInput
      ]),
      submitBtn,
      quickDemoBtn
    ]);

    const notice = el('div', { class: 'login-security-notice' }, [
      el('span', { class: 'notice-indicator', 'aria-hidden': 'true' }, ['●']),
      el('p', { class: 'text-xs text-muted' }, [
        'Akses internal terlindungi. Evaluasi berbasis aturan JEJAK-RULES-0.1.0 secara deterministik sesuai tata kelola Permenkes No. 16 Tahun 2019.'
      ])
    ]);

    section.appendChild(header);
    section.appendChild(form);
    section.appendChild(notice);
    return section;
  }

  function renderFaskesSchema(currentRoom) {
    const section = el('div', { class: 'login-schema-body' });

    // Header
    const header = el('div', { class: 'login-header' }, [
      el('span', { class: 'login-badge-pill faskes-pill' }, ['PORTAL FASILITAS KESEHATAN']),
      el('h2', { class: 'login-title' }, ['Portal Fasilitas Kesehatan (RME)']),
      el('p', { class: 'login-subtitle' }, [
        'Penyerahan catatan pelayanan klinis dan konfirmasi tiket klarifikasi klaim secara real-time.'
      ])
    ]);

    // Hospital Select
    const facSelect = el(
      'select',
      { class: 'input font-bold' },
      FACILITIES.map((fac) =>
        el('option', { value: fac.id }, [`${fac.name} (${fac.id})`])
      )
    );

    const officerInput = el('input', {
      type: 'text',
      class: 'input',
      value: 'Petugas RME RS Aruna'
    });

    facSelect.onchange = (e) => {
      const selected = FACILITIES.find((f) => f.id === e.target.value);
      if (selected) {
        officerInput.value = `Petugas RME ${selected.name}`;
      }
    };

    const passInput = el('input', {
      type: 'password',
      class: 'input',
      value: 'demo2026',
      placeholder: '••••••••'
    });

    const roomInput = el('input', {
      type: 'text',
      class: 'input monospace font-bold',
      value: currentRoom,
      placeholder: 'HEALTHKATHON-2026'
    });

    const submitBtn = el(
      'button',
      {
        class: 'btn btn-primary btn-block login-submit-btn',
        type: 'button',
        onclick: () => {
          authService.loginFaskes({
            facilityId: facSelect.value,
            officerName: officerInput.value,
            password: passInput.value,
            roomCode: roomInput.value
          });
          onLoginSuccess('faskes');
        }
      },
      ['Masuk ke Portal Faskes']
    );

    // Quick Hospital Demo Pickers
    const quickPickers = el('div', { class: 'quick-fac-grid mt-3' }, [
      el(
        'button',
        {
          class: 'btn btn-sm btn-outline',
          type: 'button',
          onclick: () => {
            authService.loginAs('aruna');
            onLoginSuccess('faskes');
          }
        },
        ['RS Aruna (F-DEMO-1)']
      ),
      el(
        'button',
        {
          class: 'btn btn-sm btn-outline',
          type: 'button',
          onclick: () => {
            authService.loginAs('bima');
            onLoginSuccess('faskes');
          }
        },
        ['RS Bima (Target EP-001)']
      ),
      el(
        'button',
        {
          class: 'btn btn-sm btn-outline',
          type: 'button',
          onclick: () => {
            authService.loginAs('cakra');
            onLoginSuccess('faskes');
          }
        },
        ['RS Cakra (Target EP-002)']
      )
    ]);

    const form = el('div', { class: 'login-form' }, [
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Pilih Fasilitas Kesehatan (Rumah Sakit)']),
        facSelect
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Nama Petugas / Terapis']),
        officerInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['PIN Akses Portal']),
        passInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Kode Ruang Sesi Real-time']),
        roomInput
      ]),
      submitBtn,
      el('div', { class: 'text-xs text-muted mt-2 text-center' }, [
        'Akses 1-Klik Akun Simulasi Rumah Sakit:'
      ]),
      quickPickers
    ]);

    const notice = el('div', { class: 'login-security-notice' }, [
      el('span', { class: 'notice-indicator', 'aria-hidden': 'true' }, ['●']),
      el('p', { class: 'text-xs text-muted' }, [
        'Terhubung via cloud real-time. Setiap pengiriman catatan tindakan fisioterapi langsung diterima oleh Verifikator BPJS dengan evaluasi deterministik.'
      ])
    ]);

    section.appendChild(header);
    section.appendChild(form);
    section.appendChild(notice);
    return section;
  }

  render();
  return {
    element: container
  };
}
