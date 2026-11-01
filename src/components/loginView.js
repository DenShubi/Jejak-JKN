// @ts-check
import { el } from '../utils/dom.js';
import { authService } from '../services/authService.js';
import { FACILITIES, DEFAULT_ROOM } from '../config.js';

/**
 * Separated Login View for Admin/BPJS Auditor and Healthcare Providers
 */
export function createLoginView({ onLoginSuccess }) {
  const container = el('div', { class: 'login-gateway-container fade-in' });

  // Current active login tab: 'admin' | 'faskes'
  let activeTab = authService.getInitialPortalView() || 'admin';

  function render() {
    container.innerHTML = '';

    const currentRoom = authService.getCurrentRoom() || DEFAULT_ROOM;

    // Brand Logo Header (rectangular, uncropped)
    const brandHeader = el('div', { class: 'login-brand-header' }, [
      el('img', {
        src: 'brand/jejak-jkn-logo-horizontal-dark.svg',
        alt: 'JEJAK JKN',
        class: 'login-logo-rect'
      })
    ]);

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
            el('strong', {}, ['BPJS Auditor']),
            el('small', { class: 'muted' }, ['Claims Verification'])
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
            el('strong', {}, ['Healthcare Provider']),
            el('small', { class: 'muted' }, ['Hospital EMR Submissions'])
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

    container.appendChild(brandHeader);
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
      el('span', { class: 'login-badge-pill admin-pill' }, ['BPJS AUDITOR PORTAL']),
      el('h2', { class: 'login-title' }, ['Claims Verification Sign In']),
      el('p', { class: 'login-subtitle' }, [
        'Deterministic reconciliation of health insurance claim records.'
      ])
    ]);

    // Inputs
    const emailInput = el('input', {
      type: 'email',
      class: 'input',
      value: 'auditor@bpjs.go.id',
      placeholder: 'name@bpjs.go.id'
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
      ['Sign In to Workbench']
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
      ['Quick Access: BPJS Auditor Demo']
    );

    const form = el('div', { class: 'login-form' }, [
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Official Email Address']),
        emailInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Password']),
        passInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Real-time Session Code']),
        roomInput
      ]),
      submitBtn,
      quickDemoBtn
    ]);

    const notice = el('div', { class: 'login-security-notice' }, [
      el('span', { class: 'notice-indicator', 'aria-hidden': 'true' }, ['●']),
      el('p', { class: 'text-xs text-muted' }, [
        'Secure session channel. Real-time deterministic rule evaluation.'
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
      el('span', { class: 'login-badge-pill faskes-pill' }, ['HEALTHCARE PROVIDER PORTAL']),
      el('h2', { class: 'login-title' }, ['Provider EMR Gateway']),
      el('p', { class: 'login-subtitle' }, [
        'Submit clinical encounter records and resolve claim clarification tickets in real time.'
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
      value: 'EMR Officer RS Aruna'
    });

    facSelect.onchange = (e) => {
      const selected = FACILITIES.find((f) => f.id === e.target.value);
      if (selected) {
        officerInput.value = `EMR Officer ${selected.name}`;
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
      ['Sign In to Provider Portal']
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
        el('label', { class: 'form-label' }, ['Select Healthcare Facility']),
        facSelect
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Staff / Therapist Name']),
        officerInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Portal Access PIN']),
        passInput
      ]),
      el('div', { class: 'form-group' }, [
        el('label', { class: 'form-label' }, ['Real-time Session Code']),
        roomInput
      ]),
      submitBtn,
      el('div', { class: 'text-xs text-muted mt-2 text-center' }, [
        '1-Click Simulation Hospital Accounts:'
      ]),
      quickPickers
    ]);

    const notice = el('div', { class: 'login-security-notice' }, [
      el('span', { class: 'notice-indicator', 'aria-hidden': 'true' }, ['●']),
      el('p', { class: 'text-xs text-muted' }, [
        'Connected via secure real-time channel. Immediate record reconciliation.'
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
