// activeASSET v2 — Kanban Board (v1 Column Layout) + Excel-like Loan & Tag Editor

const MAIN_COLUMNS = [
  {
    id: 'requesting',
    label: 'รอจัดของ',
    theme: 'theme-blue',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
    sortableByDocNo: true,
    subGroups: [
      { key: 'Requested', label: 'รอจัด' },
      { key: 'Dispatching', label: 'กำลังจัด' }
    ]
  },
  {
    id: 'dispatched',
    label: 'รอส่งมอบ',
    theme: 'theme-purple',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13" rx="1.5"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`,
    sortableByDocNo: true,
    subGroups: [
      { key: 'Dispatched', label: 'รอส่งมอบ' }
    ]
  },
  {
    id: 'in-use',
    label: 'กำลังยืม',
    theme: 'theme-emerald',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    sortableByDocNo: true,
    subGroups: [
      { key: 'Delivered', label: 'กำลังยืม' }
    ]
  },
  {
    id: 'overdue-and-partial',
    label: 'เกินกำหนด / คืนไม่ครบ',
    theme: 'theme-rose',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`,
    sortableByDocNo: false,
    subGroups: [
      { key: 'Overdue', label: 'เกินกำหนด' },
      { key: 'Partially_Returned', label: 'คืนไม่ครบ' }
    ]
  },
  {
    id: 'qc',
    label: 'รอตรวจ QC',
    theme: 'theme-amber',
    icon: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect><path d="m9 14 2 2 4-4"></path></svg>`,
    sortableByDocNo: true,
    subGroups: [
      { key: 'Pending_QC', label: 'รอตรวจสภาพ' },
      { key: 'Pending_Supplier_Return', label: 'คืน Supplier,คลังขาย' }
    ]
  }
];

const state = {
  today: '',
  assets: [],
  catalogs: [],
  loans: [],
  accessorySuggestions: [],
  locations: [],

  // View & Filter State
  viewMode: 'kanban', // 'kanban' | 'list' | 'returned' | 'stock'
  searchQuery: '',
  docNoSortOrder: 'asc', // 'asc' | 'desc'
  collapsedSubGroups: new Set(),
  expandedBrands: new Set(),
  highlightDocNo: null,
  stockSourceFilter: 'all',

  // Create / Edit Loan Modal State (Model-only, minimal request)
  editingLoanId: null, // null = creating new loan, string = editing existing loan
  loanDraftRows: [], // [{ brand, model, qty, source, accessories: [], free_note: '' }]
  activeLoanRowIdx: 0, // Currently active / expanded row index (previous rows collapse)
  printAfterSave: false,

  // Dispatch & Match S/N Modal State (Minimal in-line picking sheet)
  activeDispatchLoan: null,
  dispatchDraftItems: [], // [{ id, brand, model, tag_id, source, accessories: [], photos: [], free_note: '' }]
  activeDispatchRowIdx: null, // Expanded in-line row index (null = all collapsed)
  activeDispatchPhotoRowIdx: null, // Row index whose camera/file upload is active
  pendingMismatchAsset: null, // Scanned asset waiting for user choice when not matching exact model
  dispatchBeforePhotos: [],
  dispatchSignatureDirty: false,

  // Return & QC Modal State
  activeReturnLoan: null,
  returnDraftItems: [],
  returnAfterPhotos: [],

  // Print Modal State
  activePrintLoanId: null,
  printSize: 'auto',
  printZoomMode: '100',

  // Digital Signature Modal State
  activeSigRole: 'borrower', // 'borrower' | 'dispatcher' | 'receiver'
  activeSigMode: 'draw',     // 'draw' | 'upload'
  sigPenColor: '#0f172a',
  sigPenSize: 2.5,
  uploadedSigDataUrl: '',
  digitalSigDirty: false,

  // Company / Issuer Settings
  companySettings: {
    company_name: 'บริษัท ไอคอนเน็กท์ จำกัด',
    company_name_en: 'ICONNECT CO., LTD.',
    company_tax_id: '0105553012345',
    company_branch: 'สำนักงานใหญ่',
    company_address: '88/19 ถนนพัฒนาการ แขวงสวนหลวง เขตสวนหลวง กรุงเทพมหานคร 10250',
    company_phone: '02-722-8888, 081-999-8888',
    company_email: 'sales@iconnect.co.th',
    company_website: 'www.iconnect.co.th',
    company_logo: '',
    gatepass_terms: '* ผู้ยืมตกลงดูแลรักษาเครื่องและอุปกรณ์เสริมทั้งหมดให้อยู่ในสภาพสมบูรณ์ และนำส่งคืนภายในวันที่กำหนด'
  },
  currentUser: null,
  authConfig: {
    require_login: true,
    allowed_domains: 'active5.co.th',
    google_client_id: ''
  }
};
window.state = state;
window.openCreateLoanModal = openCreateLoanModal;
window.renderLoanExcelRows = renderLoanExcelRows;
window.ensureTrailingEmptyRow = ensureTrailingEmptyRow;
window.uploadNoteFiles = uploadNoteFiles;

function getLoggedInUserName() {
  if (state.currentUser && state.currentUser.name) return state.currentUser.name.trim();
  try {
    const saved = JSON.parse(localStorage.getItem('activeasset_current_user') || '{}');
    if (saved && saved.name) return saved.name.trim();
    if (saved && saved.email) return saved.email.trim();
  } catch (_) {}
  return 'เจ้าหน้าที่คลัง';
}
window.getLoggedInUserName = getLoggedInUserName;

function syncClearableInputBtn(inp) {
  if (!inp) return;
  const wrap = inp.closest('.input-clearable-wrap');
  if (!wrap) return;
  const btn = wrap.querySelector('.btn-input-clear');
  if (!btn) return;
  if (inp.value && String(inp.value).trim().length > 0) {
    btn.classList.remove('hidden');
  } else {
    btn.classList.add('hidden');
  }
}
window.syncClearableInputBtn = syncClearableInputBtn;

document.addEventListener('DOMContentLoaded', () => {
  restoreNavigationState();
  setupDialogsLightDismissFallback();
  setupSignatureCanvas();
  setupDigitalSignatureModal();
  setupCompanySettingsModal();
  setupSendEmailModal();
  setupDeliveryModal();
  setupSupplierSaleReturnModal();
  setupEventListeners();
  setupAuthSystem();
  fetchFullState();
  initRealtimeSync();
  initMobileKanbanBar();
  initMobileKeyboardControl();
});

function initMobileKanbanBar() {
  const bar = document.getElementById('kanbanMobileColBar');
  const scrollWrap = document.getElementById('kanbanClassicWrap');
  if (!bar || !scrollWrap) return;

  function getColTargetScrollLeft(idx) {
    const cols = scrollWrap.querySelectorAll('.kanban-col');
    const targetCol = cols[idx];
    if (!targetCol) return 0;
    const wrapWidth = scrollWrap.clientWidth;
    const colWidth = targetCol.offsetWidth;
    const left = targetCol.offsetLeft - Math.max(0, (wrapWidth - colWidth) / 2);
    return Math.max(0, left);
  }

  function getCurrentColIndex() {
    const cols = scrollWrap.querySelectorAll('.kanban-col');
    if (!cols.length) return 0;
    const currentCenter = scrollWrap.scrollLeft + (scrollWrap.clientWidth / 2);
    let closestIdx = 0;
    let minDiff = Infinity;
    cols.forEach((col, idx) => {
      const colCenter = col.offsetLeft + (col.offsetWidth / 2);
      const diff = Math.abs(currentCenter - colCenter);
      if (diff < minDiff) {
        minDiff = diff;
        closestIdx = idx;
      }
    });
    return closestIdx;
  }

  function scrollToColumnIndex(idx, smooth = true) {
    const cols = scrollWrap.querySelectorAll('.kanban-col');
    if (!cols[idx]) return;
    const targetLeft = getColTargetScrollLeft(idx);
    if (smooth) {
      scrollWrap.scrollTo({ left: targetLeft, behavior: 'smooth' });
    } else {
      scrollWrap.scrollLeft = targetLeft;
    }

    const targetColId = cols[idx].getAttribute('data-col-id');
    if (targetColId) {
      bar.querySelectorAll('.col-pill-btn').forEach(btn => {
        if (btn.getAttribute('data-col-target') === targetColId) {
          btn.classList.add('active');
          btn.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        } else {
          btn.classList.remove('active');
        }
      });
    }
  }
  window.scrollToKanbanColumn = scrollToColumnIndex;

  // 1. Column Navigation Pills Click
  bar.addEventListener('click', e => {
    const btn = e.target.closest('.col-pill-btn');
    if (!btn) return;
    const targetId = btn.getAttribute('data-col-target');
    const cols = Array.from(scrollWrap.querySelectorAll('.kanban-col'));
    const targetIdx = cols.findIndex(col => col.getAttribute('data-col-id') === targetId);
    if (targetIdx >= 0) {
      scrollToColumnIndex(targetIdx, true);
    }
  });

  // 2. Gesture Control with Half-Screen Swipe Threshold (รูดมาครึ่งจอก่อนค่อยเลื่อนแถว)
  let touchStartX = 0;
  let touchStartY = 0;
  let startScrollLeft = 0;
  let isSwipeDecided = false;
  let isHorizontalSwipe = false;
  let activeColIndex = 0;
  let isUserTouching = false;

  scrollWrap.addEventListener('touchstart', e => {
    if (window.innerWidth > 768) return;
    if (e.touches.length !== 1) return;

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    startScrollLeft = scrollWrap.scrollLeft;
    isSwipeDecided = false;
    isHorizontalSwipe = false;
    isUserTouching = true;
    activeColIndex = getCurrentColIndex();
  }, { passive: true });

  scrollWrap.addEventListener('touchmove', e => {
    if (window.innerWidth > 768 || !isUserTouching) return;
    if (e.touches.length !== 1) return;

    const currentX = e.touches[0].clientX;
    const currentY = e.touches[0].clientY;
    const dx = currentX - touchStartX;
    const dy = currentY - touchStartY;

    if (!isSwipeDecided) {
      const absX = Math.abs(dx);
      const absY = Math.abs(dy);

      if (absX > 10 || absY > 10) {
        isSwipeDecided = true;
        // Require horizontal motion to be distinctly dominant before treating as a horizontal column swipe
        isHorizontalSwipe = (absX > absY * 1.5) && (absX > 15);
      }
    }

    if (isSwipeDecided && isHorizontalSwipe) {
      // Horizontal swipe in progress: 1:1 live drag tracking
      scrollWrap.scrollLeft = startScrollLeft - dx;
    }
    // If vertical scroll: DO NOTHING AT ALL!
    // Never mutate scrollLeft or touch the DOM during vertical scrolling
    // so that iOS Safari retains 100% native hardware momentum and effortless scrolling!
  }, { passive: true });

  scrollWrap.addEventListener('touchend', e => {
    if (window.innerWidth > 768 || !isUserTouching) return;
    isUserTouching = false;

    if (isHorizontalSwipe) {
      const touchEndX = e.changedTouches[0].clientX;
      const deltaX = touchEndX - touchStartX;
      const cols = scrollWrap.querySelectorAll('.kanban-col');
      const numCols = cols.length;

      // Half-screen threshold: user must swipe at least 45% of screen width to switch columns
      const halfScreenThreshold = window.innerWidth * 0.45;

      let targetIndex = activeColIndex;

      if (deltaX < -halfScreenThreshold && activeColIndex < numCols - 1) {
        // Swiped left by at least half screen -> Advance to next column
        targetIndex = activeColIndex + 1;
      } else if (deltaX > halfScreenThreshold && activeColIndex > 0) {
        // Swiped right by at least half screen -> Go back to previous column
        targetIndex = activeColIndex - 1;
      } else {
        // Swiped less than half screen -> Snap BACK to current column
        targetIndex = activeColIndex;
      }

      scrollToColumnIndex(targetIndex, true);
    }
    // If vertical scroll: DO NOTHING!
    // Never call scrollTo or mutate DOM on touchend so native fling inertia continues uninterrupted!
  }, { passive: true });

  // 3. Fallback sync for active pill after smooth scroll finishes
  let scrollDebounce = null;
  scrollWrap.addEventListener('scroll', () => {
    if (window.innerWidth > 768 || isUserTouching) return;
    if (scrollDebounce) clearTimeout(scrollDebounce);
    scrollDebounce = setTimeout(() => {
      const closestIdx = getCurrentColIndex();
      const cols = scrollWrap.querySelectorAll('.kanban-col');
      const targetColId = cols[closestIdx]?.getAttribute('data-col-id');
      if (targetColId) {
        bar.querySelectorAll('.col-pill-btn').forEach(btn => {
          if (btn.getAttribute('data-col-target') === targetColId) {
            btn.classList.add('active');
          } else {
            btn.classList.remove('active');
          }
        });
      }
    }, 80);
  }, { passive: true });
}

function initMobileKeyboardControl() {
  let mobileKbdMode = localStorage.getItem('activeasset_mobile_keyboard_mode') || 'suppressed';
  window.mobileKeyboardMode = mobileKbdMode;

  let activeFocusedInput = null;
  let pillHideTimeout = null;

  const pill = document.getElementById('mobileKeyboardPill');
  const pillBtn = document.getElementById('btnMobileToggleKeyboard');
  const pillLabel = document.getElementById('kbdPillLabel');
  const btnToggleSearchKbd = document.getElementById('btnToggleSearchKeyboard');
  const btnToggleDispatchKbd = document.getElementById('btnToggleDispatchKeyboard');
  const btnMenuToggleMode = document.getElementById('btnToggleMobileKeyboardMode');
  const labelMenuToggleMode = document.getElementById('labelMobileKeyboardMode');

  function isInputEligible(el) {
    if (!el || !el.tagName) return false;
    const tag = el.tagName.toLowerCase();
    if (tag === 'textarea') return true;
    if (tag === 'input') {
      const type = (el.type || 'text').toLowerCase();
      return ['text', 'search', 'tel', 'url', 'email', 'number', 'password'].includes(type);
    }
    return false;
  }

  function updateMenuLabel() {
    if (!labelMenuToggleMode) return;
    if (window.mobileKeyboardMode === 'suppressed') {
      labelMenuToggleMode.textContent = 'คีย์บอร์ดมือถือ: ซ่อนอัตโนมัติ (เปิด/ปิดด้วยปุ่ม)';
    } else {
      labelMenuToggleMode.textContent = 'คีย์บอร์ดมือถือ: เด้งอัตโนมัติตามปกติ';
    }
  }
  updateMenuLabel();

  if (btnMenuToggleMode) {
    btnMenuToggleMode.addEventListener('click', () => {
      window.mobileKeyboardMode = window.mobileKeyboardMode === 'suppressed' ? 'auto' : 'suppressed';
      localStorage.setItem('activeasset_mobile_keyboard_mode', window.mobileKeyboardMode);
      updateMenuLabel();
      showToast(
        window.mobileKeyboardMode === 'suppressed'
          ? '🛡️ โหมดคีย์บอร์ดมือถือ: ซ่อนอัตโนมัติเมื่อแตะ/โฟกัส (มีปุ่มเปิด/ปิด)'
          : '📱 โหมดคีย์บอร์ดมือถือ: เด้งอัตโนมัติตามปกติ'
      );
    });
  }

  function syncPillParent(activeEl) {
    if (!pill) return;
    const activeDialog = activeEl ? activeEl.closest('dialog[open]') : document.querySelector('dialog[open]');
    if (activeDialog) {
      if (pill.parentElement !== activeDialog) {
        activeDialog.appendChild(pill);
      }
    } else {
      if (pill.parentElement !== document.body) {
        document.body.appendChild(pill);
      }
    }
  }

  function updatePillVisuals(inputEl) {
    if (!pill || !pillBtn) return;
    if (!inputEl) inputEl = activeFocusedInput || document.activeElement;
    if (!isInputEligible(inputEl)) {
      pill.classList.add('hidden');
      return;
    }

    syncPillParent(inputEl);

    const isKeyboardActive =
      inputEl.dataset.keyboardActive === 'true' ||
      (inputEl.getAttribute('inputmode') && inputEl.getAttribute('inputmode') !== 'none');

    if (isKeyboardActive) {
      pillBtn.classList.add('active');
      if (pillLabel) pillLabel.textContent = 'ซ่อนแป้นพิมพ์';
    } else {
      pillBtn.classList.remove('active');
      if (pillLabel) pillLabel.textContent = 'แสดงแป้นพิมพ์';
    }

    // Sync active state on all matching .btn-keyboard-toggle elements
    document.querySelectorAll('.btn-keyboard-toggle').forEach(btn => {
      const targetId = btn.getAttribute('data-keyboard-target');
      const wrap = btn.closest('.input-clearable-wrap, .search-wrap, .master-search-wrap, .barcode-scanner-bar, .company-input-wrap');
      const isTarget = (targetId && targetId === inputEl.id) || (wrap && wrap.contains(inputEl));
      if (isTarget) {
        if (isKeyboardActive) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }
    });

    if (isTouchOrMobileDevice()) {
      pill.classList.remove('hidden');
    } else {
      pill.classList.add('hidden');
    }
  }

  // Pre-suppress inputs on touchstart / pointerdown before iOS Safari attempts to spawn SIP keyboard
  const suppressOnTouch = (e) => {
    if (!isTouchOrMobileDevice() || window.mobileKeyboardMode !== 'suppressed') return;
    const target = e.target.closest('input, textarea');
    if (!target || !isInputEligible(target)) return;

    if (!target.dataset.keyboardActive) {
      if (!target.dataset.originalInputmode) {
        target.dataset.originalInputmode = target.getAttribute('inputmode') || (target.type === 'number' ? 'numeric' : 'text');
      }
      target.setAttribute('inputmode', 'none');
    }
  };

  document.addEventListener('touchstart', suppressOnTouch, { capture: true, passive: true });
  document.addEventListener('pointerdown', suppressOnTouch, { capture: true, passive: true });

  // On focusin: keep track of active input and present the accessory toggle
  document.addEventListener('focusin', (e) => {
    const target = e.target;
    if (!isInputEligible(target)) return;

    activeFocusedInput = target;
    if (pillHideTimeout) clearTimeout(pillHideTimeout);

    if (isTouchOrMobileDevice() && window.mobileKeyboardMode === 'suppressed') {
      if (!target.dataset.keyboardActive) {
        if (!target.dataset.originalInputmode) {
          target.dataset.originalInputmode = target.getAttribute('inputmode') || (target.type === 'number' ? 'numeric' : 'text');
        }
        target.setAttribute('inputmode', 'none');
      }
    }

    syncPillParent(target);
    updatePillVisuals(target);
  });

  // On focusout: smoothly hide the accessory pill after a short delay
  document.addEventListener('focusout', (e) => {
    pillHideTimeout = setTimeout(() => {
      const currentActive = document.activeElement;
      if (!isInputEligible(currentActive)) {
        if (pill) pill.classList.add('hidden');
        document.querySelectorAll('.btn-keyboard-toggle.active').forEach(b => b.classList.remove('active'));
        activeFocusedInput = null;
        if (pill && pill.parentElement !== document.body && !document.querySelector('dialog[open]')) {
          document.body.appendChild(pill);
        }
      }
    }, 280);
  });

  // Reset pill back to document.body when any dialog closes
  document.addEventListener('close', (e) => {
    if (e.target?.tagName?.toLowerCase() === 'dialog') {
      if (pill && pill.parentElement !== document.body) {
        document.body.appendChild(pill);
      }
      pill?.classList.add('hidden');
    }
  }, true);

  // Toggle function for a specific input
  function toggleInputKeyboard(inputEl) {
    if (!inputEl) inputEl = activeFocusedInput || document.activeElement;
    if (!isInputEligible(inputEl)) {
      const openDialog = document.querySelector('dialog[open]');
      if (openDialog) {
        inputEl = openDialog.querySelector('input:not([type="hidden"]):not([type="file"]):not([disabled]), textarea');
      } else {
        inputEl = document.getElementById('searchInput');
      }
    }
    if (!inputEl) return;

    activeFocusedInput = inputEl;
    const isCurrentlyActive =
      inputEl.dataset.keyboardActive === 'true' ||
      (inputEl.getAttribute('inputmode') && inputEl.getAttribute('inputmode') !== 'none');

    if (isCurrentlyActive) {
      // HIDE KEYBOARD
      delete inputEl.dataset.keyboardActive;
      inputEl.setAttribute('inputmode', 'none');
      inputEl.blur();
      setTimeout(() => {
        if (activeFocusedInput === inputEl) {
          inputEl.focus(); // Retain caret focus without popping up keyboard
        }
      }, 50);
      updatePillVisuals(inputEl);
    } else {
      // SHOW KEYBOARD
      inputEl.dataset.keyboardActive = 'true';
      const orig = inputEl.dataset.originalInputmode || (inputEl.type === 'number' ? 'numeric' : 'text');
      inputEl.blur();
      inputEl.setAttribute('inputmode', orig);
      inputEl.focus();
      updatePillVisuals(inputEl);
    }
  }
  window.toggleInputKeyboard = toggleInputKeyboard;

  // Hook floating pill button
  if (pillBtn) {
    pillBtn.addEventListener('mousedown', e => e.preventDefault());
    pillBtn.addEventListener('click', e => {
      e.preventDefault();
      toggleInputKeyboard(activeFocusedInput);
    });
  }

  // Generic delegated click handler for all .btn-keyboard-toggle buttons
  document.addEventListener('mousedown', e => {
    if (e.target.closest('.btn-keyboard-toggle')) {
      e.preventDefault(); // Keep active input focused
    }
  });

  document.addEventListener('click', e => {
    const kbdBtn = e.target.closest('.btn-keyboard-toggle');
    if (!kbdBtn) return;
    e.preventDefault();

    const targetId = kbdBtn.getAttribute('data-keyboard-target');
    let targetInp = targetId ? document.getElementById(targetId) : null;
    if (!targetInp) {
      const wrap = kbdBtn.closest('.input-clearable-wrap, .search-wrap, .master-search-wrap, .model-input-wrap, .barcode-scanner-bar, .company-input-wrap');
      targetInp = wrap?.querySelector('input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea');
    }
    if (!targetInp) targetInp = activeFocusedInput || document.activeElement;
    if (targetInp && isInputEligible(targetInp)) {
      toggleInputKeyboard(targetInp);
    }
  });

  // Universal Auto-Enhancement for all input fields across all pages/modals
  function enhanceInputsWithKeyboardToggle(root = document) {
    if (!isTouchOrMobileDevice()) {
      // On desktop devices: remove any existing virtual keyboard toggle buttons
      root.querySelectorAll('.btn-keyboard-toggle').forEach(b => b.remove());
      return;
    }

    const wraps = root.querySelectorAll(
      '.input-clearable-wrap, .search-wrap, .master-search-wrap, .model-input-wrap, .barcode-scanner-bar, .company-input-wrap'
    );

    wraps.forEach(wrap => {
      const input = wrap.querySelector(
        'input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), textarea'
      );
      if (!input || !isInputEligible(input)) return;
      if (wrap.querySelector('.btn-keyboard-toggle')) return; // Already has button

      const kbdBtn = document.createElement('button');
      kbdBtn.type = 'button';
      kbdBtn.className = 'btn-keyboard-toggle';
      kbdBtn.title = 'แสดง/ซ่อน แป้นพิมพ์บนหน้าจอ (Show/Hide Keyboard)';
      kbdBtn.setAttribute('aria-label', 'แสดง/ซ่อน แป้นพิมพ์');
      kbdBtn.innerHTML = `
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
          <line x1="6" y1="8" x2="6" y2="8"></line>
          <line x1="10" y1="8" x2="10" y2="8"></line>
          <line x1="14" y1="8" x2="14" y2="8"></line>
          <line x1="18" y1="8" x2="18" y2="8"></line>
          <line x1="6" y1="12" x2="6" y2="12"></line>
          <line x1="10" y1="12" x2="10" y2="12"></line>
          <line x1="14" y1="12" x2="14" y2="12"></line>
          <line x1="18" y1="12" x2="18" y2="12"></line>
          <line x1="7" y1="16" x2="17" y2="16"></line>
        </svg>
      `;

      let actionsEnd = wrap.querySelector('.input-actions-end');
      if (actionsEnd) {
        const arrow = actionsEnd.querySelector('.btn-input-dropdown-arrow');
        if (arrow) {
          actionsEnd.insertBefore(kbdBtn, arrow);
        } else {
          actionsEnd.appendChild(kbdBtn);
        }
      } else {
        const clearBtn = wrap.querySelector('.btn-input-clear, .clear-search, .btn-clear-model-input');
        if (clearBtn) {
          actionsEnd = document.createElement('div');
          actionsEnd.className = 'input-actions-end';
          clearBtn.after(actionsEnd);
          actionsEnd.appendChild(clearBtn);
          actionsEnd.appendChild(kbdBtn);
          wrap.classList.add('has-actions-end');
        } else {
          wrap.appendChild(kbdBtn);
        }
      }
    });
  }
  window.enhanceInputsWithKeyboardToggle = enhanceInputsWithKeyboardToggle;

  // Run enhancement immediately
  enhanceInputsWithKeyboardToggle();

  // Observe dynamically inserted dialogs, tables, and rows
  let enhanceDebounce = null;
  const observer = new MutationObserver(() => {
    if (enhanceDebounce) clearTimeout(enhanceDebounce);
    enhanceDebounce = setTimeout(() => {
      enhanceInputsWithKeyboardToggle();
    }, 60);
  });
  observer.observe(document.body, { childList: true, subtree: true });

  // Viewport tracking for iOS virtual keyboard
  if (window.visualViewport) {
    const updatePillPos = () => {
      if (!pill || pill.classList.contains('hidden')) return;
      const vv = window.visualViewport;
      const bottomOffset = window.innerHeight - (vv.offsetTop + vv.height);
      if (bottomOffset > 80) {
        pill.style.bottom = `${bottomOffset + 12}px`;
      } else {
        pill.style.bottom = '';
      }
    };
    window.visualViewport.addEventListener('resize', updatePillPos);
    window.visualViewport.addEventListener('scroll', updatePillPos);
  }
}

function restoreNavigationState() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return;
  const parts = hash.split(':');
  const view = parts[0];
  const param = parts[1];

  if (['kanban', 'list', 'returned', 'stock'].includes(view)) {
    state.viewMode = view;
  }
}

function updateUrlHash(action, param = '') {
  if (action === 'modal') {
    window.location.hash = param ? `modal:${param}` : state.viewMode;
  } else if (['kanban', 'list', 'returned', 'stock'].includes(action)) {
    window.location.hash = action;
  }
}

function syncNavigationFromHash() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return;
  const parts = hash.split(':');
  const type = parts[0];
  const param = parts[1];

  if (type === 'modal') {
    if (param === 'create') {
      openCreateLoanModal(false);
    } else if (param && param.startsWith('edit-')) {
      const loanId = param.replace('edit-', '');
      openEditLoanModal(loanId, false);
    } else if (param && param.startsWith('dispatch-')) {
      const loanId = param.replace('dispatch-', '');
      openDispatchModal(loanId, false);
    } else if (param && param.startsWith('return-')) {
      const loanId = param.replace('return-', '');
      openReturnModal(loanId, false);
    } else if (param && param.startsWith('print-')) {
      const loanId = param.replace('print-', '');
      openPrintModal(loanId, false);
      const urlParams = new URLSearchParams(window.location.search);
      const sigRole = urlParams.get('openSig');
      if (sigRole && window.openDigitalSigModalForRole) {
        setTimeout(() => window.openDigitalSigModalForRole(sigRole), 100);
      }
    }
  } else if (['kanban', 'list', 'returned', 'stock'].includes(type)) {
    if (state.viewMode !== type) {
      state.viewMode = type;
      renderActiveView();
    }
  }
}

function setupDialogsLightDismissFallback() {
  document.querySelectorAll('dialog.modal-dialog').forEach(dialog => {
    // When dialog closes, restore URL hash to current view and refocus search input
    dialog.addEventListener('close', () => {
      if (window.location.hash.startsWith('#modal:')) {
        window.location.hash = state.viewMode;
      }
      focusSearchInputIfIdle(120);
    });

    if (!('closedBy' in HTMLDialogElement.prototype)) {
      dialog.addEventListener('click', event => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        const isDialogContent =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (isDialogContent) return;
        smoothCloseDialog(dialog);
      });
    }
  });

  document.querySelectorAll('[data-close-dialog]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const dlg = document.getElementById(btn.getAttribute('data-close-dialog'));
      if (dlg) smoothCloseDialog(dlg, btn);
    });
  });
}

function smoothCloseDialog(dlg, triggerBtn) {
  if (!dlg) return;
  if (!dlg.hasAttribute('open') || dlg.classList.contains('dialog-closing')) {
    return;
  }
  dlg.classList.add('dialog-closing');
  if (triggerBtn) {
    triggerBtn.classList.add('btn-back-pressed');
  }
  setTimeout(() => {
    try {
      if (typeof dlg.close === 'function' && dlg.hasAttribute('open')) {
        dlg.close();
      }
    } catch (_) {}
    dlg.classList.remove('dialog-closing');
    if (triggerBtn) {
      triggerBtn.classList.remove('btn-back-pressed');
    }
  }, 130);
}
window.smoothCloseDialog = smoothCloseDialog;

function showConfirmDialog({
  title = 'ยืนยันการลบรายการ',
  message = 'คุณต้องการลบรายการนี้ใช่หรือไม่?',
  itemText = '',
  itemHtml = '',
  confirmText = '🗑️ ยืนยันลบ',
  cancelText = 'ยกเลิก',
  icon = '🗑️',
  confirmBtnClass = 'btn-danger'
} = {}) {
  return new Promise(resolve => {
    const dlg = document.getElementById('confirmModalDialog');
    if (!dlg) {
      return resolve(window.confirm(`${title}\n${message}`));
    }

    const titleEl = document.getElementById('confirmDialogTitle');
    const msgEl = document.getElementById('confirmDialogMessage');
    const iconEl = document.getElementById('confirmDialogIcon');
    const badgeEl = document.getElementById('confirmDialogItemBadge');
    const customHtmlEl = document.getElementById('confirmDialogCustomHtml');
    const btnCancel = document.getElementById('btnCancelConfirm');
    const btnClose = document.getElementById('btnCloseConfirmDialog');
    const btnApprove = document.getElementById('btnApproveConfirm');

    if (titleEl) titleEl.textContent = title;
    if (msgEl) msgEl.textContent = message;
    if (iconEl) iconEl.textContent = icon;

    if (customHtmlEl) {
      if (itemHtml) {
        customHtmlEl.innerHTML = itemHtml;
        customHtmlEl.style.display = 'block';
      } else {
        customHtmlEl.innerHTML = '';
        customHtmlEl.style.display = 'none';
      }
    }

    if (badgeEl) {
      if (itemText && !itemHtml) {
        badgeEl.textContent = itemText;
        badgeEl.style.display = 'block';
      } else {
        badgeEl.textContent = '';
        badgeEl.style.display = 'none';
      }
    }

    if (btnCancel) btnCancel.textContent = cancelText;
    if (btnApprove) {
      btnApprove.textContent = confirmText;
      btnApprove.className = `btn ${confirmBtnClass}`;
    }

    let answered = false;

    const cleanup = () => {
      if (btnCancel) btnCancel.removeEventListener('click', onCancel);
      if (btnClose) btnClose.removeEventListener('click', onCancel);
      if (btnApprove) btnApprove.removeEventListener('click', onApprove);
      dlg.removeEventListener('close', onClose);
    };

    const finish = (result) => {
      if (answered) return;
      answered = true;
      cleanup();
      smoothCloseDialog(dlg);
      resolve(result);
    };

    const onCancel = () => finish(false);
    const onApprove = () => finish(true);
    const onClose = () => finish(false);

    if (btnCancel) btnCancel.addEventListener('click', onCancel);
    if (btnClose) btnClose.addEventListener('click', onCancel);
    if (btnApprove) btnApprove.addEventListener('click', onApprove);
    dlg.addEventListener('close', onClose);

    dlg.showModal();
  });
}

async function fetchFullState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error('โหลดข้อมูลไม่สำเร็จ');
    const data = await res.json();
    applyServerState(data);
  } catch (err) {
    showToast('⚠️ ' + err.message);
  }
}

function applyServerState(data) {
  // Rule: Any card that changes status must be highlighted with a colored border (like new loans)
  const oldLoanStatusMap = new Map((state.loans || []).map(l => [l.id, l.status]));
  const newLoans = data.loans || [];

  if (oldLoanStatusMap.size > 0) {
    if (!state.recentlyChangedLoans) state.recentlyChangedLoans = new Set();
    newLoans.forEach(l => {
      const prevStatus = oldLoanStatusMap.get(l.id);
      if (prevStatus && prevStatus !== l.status) {
        state.recentlyChangedLoans.add(l.id);
        setTimeout(() => {
          if (state.recentlyChangedLoans) state.recentlyChangedLoans.delete(l.id);
          const card = document.querySelector(`.loan-card[data-card-loan="${l.id}"]`);
          if (card) card.classList.remove('card-status-changed', 'card-highlight');
        }, 6000);
      }
    });
  }

  state.today = data.today;
  state.assets = data.assets || [];
  state.catalogs = data.catalogs || [];
  state.loans = newLoans;
  state.accessorySuggestions = data.accessorySuggestions || [];
  state.locations = data.locations || [];
  if (data.users) {
    state.users = data.users;
  }
  if (data.companySettings) {
    state.companySettings = { ...state.companySettings, ...data.companySettings };
  }

  renderDatalists();
  renderHeaderCounters();
  renderActiveView();

  if (!state._initialAutoChecked) {
    state._initialAutoChecked = true;
    const urlParams = new URLSearchParams(window.location.search);
    const openDetailTag = urlParams.get('openDetail');
    if (openDetailTag) {
      setTimeout(() => {
        openAssetDetailModal(openDetailTag);
        const autoEdit = urlParams.get('edit');
        if (autoEdit === 'accessories') {
          document.getElementById('btnEditAccessories')?.click();
        } else if (autoEdit === 'location') {
          document.getElementById('btnEditLocation')?.click();
          if (urlParams.get('openDropdown')) {
            document.getElementById('btnToggleEditLocationDd')?.click();
          }
        } else if (autoEdit === 'source') {
          document.getElementById('btnEditSource')?.click();
          if (urlParams.get('openDropdown')) {
            document.getElementById('btnToggleEditSourceDd')?.click();
          }
        }
      }, 150);
    }
    const openSigRole = urlParams.get('openSig');
    if (openSigRole) {
      setTimeout(() => {
        window.openDigitalSigModalForRole?.(openSigRole);
      }, 300);
    }
    const openSettingsTab = urlParams.get('openSettings');
    if (openSettingsTab) {
      setTimeout(() => {
        window.openCompanySettingsModal?.(openSettingsTab);
        const sub = urlParams.get('masterSub');
        if (sub) {
          setTimeout(() => {
            document.querySelector(`.master-sub-tab[data-master-sub="${sub}"]`)?.click();
          }, 180);
        }
      }, 200);
    }

    const openCreate = urlParams.get('openCreate');
    if (openCreate) {
      setTimeout(() => {
        document.getElementById('btnOpenCreateLoan')?.click();
        const testComp = urlParams.get('searchComp');
        if (testComp) {
          setTimeout(() => {
            const accordion = document.getElementById('topInfoDetails');
            if (accordion && accordion.classList.contains('hidden')) {
              document.getElementById('btnToggleTopInfo')?.click();
            }
            const compInput = document.getElementById('loanCompany');
            if (compInput) {
              compInput.value = testComp;
              compInput.dispatchEvent(new Event('input', { bubbles: true }));
              compInput.focus();
            }
          }, 350);
        }
      }, 200);
    }

    // Auto-focus search input on initial page load if no modal is requested
    if (!openDetailTag && !openSigRole && !document.querySelector('dialog[open]')) {
      focusSearchInputIfIdle(200);
    }
  }
  syncNavigationFromHash();
}

function isTouchOrMobileDevice() {
  const isMobileUa = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  if (isMobileUa) return true;
  if (window.innerWidth <= 768) return true;
  if (window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    return false;
  }
  return ('ontouchstart' in window || navigator.maxTouchPoints > 0);
}
window.isTouchOrMobileDevice = isTouchOrMobileDevice;

function updateDeviceClasses() {
  const isTouch = isTouchOrMobileDevice();
  document.documentElement.classList.toggle('is-mobile-touch', isTouch);
  document.documentElement.classList.toggle('is-desktop-device', !isTouch);
}
updateDeviceClasses();
window.addEventListener('resize', () => {
  updateDeviceClasses();
  if (typeof enhanceInputsWithKeyboardToggle === 'function') {
    enhanceInputsWithKeyboardToggle();
  }
});

function focusSearchInputIfIdle(delay = 150) {
  if (isTouchOrMobileDevice()) return; // Never auto-focus and trigger virtual keyboard on mobile
  setTimeout(() => {
    const searchInput = document.getElementById('searchInput');
    const loginOverlay = document.getElementById('loginOverlay');
    if (
      searchInput &&
      (!loginOverlay || loginOverlay.classList.contains('hidden')) &&
      !document.querySelector('dialog[open]')
    ) {
      searchInput.focus();
    }
  }, delay);
}
window.focusSearchInputIfIdle = focusSearchInputIfIdle;

function can(perm) {
  if (!state.currentUser) return false;
  const role = state.currentUser.role_id || state.currentUser.role;
  if (role === 'admin' || role === 'Administrator') return true;
  return Boolean(state.currentUser.permissions?.[perm]);
}
window.can = can;

function applyPermissionsToUI() {
  const isAuth = Boolean(state.currentUser);

  // 1. Create loan permission
  const canCreate = can('create_loan');
  const btnCreate = document.getElementById('btnOpenCreateLoan');
  if (btnCreate) {
    btnCreate.style.display = canCreate ? '' : 'none';
  }
  const fabCreate = document.getElementById('fabActionCreateLoan');
  if (fabCreate) {
    fabCreate.style.display = canCreate ? '' : 'none';
  }

  // 2. Manage settings & roles permission
  const canSettings = can('manage_settings') || can('manage_roles');
  const btnSettingsFromUser = document.getElementById('btnOpenSettingsFromUser');
  if (btnSettingsFromUser) {
    btnSettingsFromUser.style.display = canSettings ? '' : 'none';
  }
  const btnCompanySettings = document.getElementById('btnOpenCompanySettings');
  if (btnCompanySettings) {
    btnCompanySettings.style.display = canSettings ? '' : 'none';
  }

  // 3. Manage assets permission
  const canAssets = can('manage_assets');
  const fabAddDemo = document.getElementById('fabActionAddDemo');
  if (fabAddDemo) {
    fabAddDemo.style.display = canAssets ? '' : 'none';
  }
  const btnAddDemo = document.getElementById('btnOpenAddDemoModal');
  if (btnAddDemo) {
    btnAddDemo.style.display = canAssets ? '' : 'none';
  }

  // 4. In Kanban cards & List view:
  const canEdit = can('edit_loan');
  const canCancel = can('cancel_loan');
  document.querySelectorAll('.btn-card-edit-minimal, [data-edit-loan]').forEach(el => {
    el.style.display = canEdit ? '' : 'none';
  });
  document.querySelectorAll('.btn-card-cancel-minimal, [data-cancel-loan]').forEach(el => {
    el.style.display = canCancel ? '' : 'none';
  });
}
window.applyPermissionsToUI = applyPermissionsToUI;

function renderDatalists() {
  const modelList = document.getElementById('modelDatalist');
  if (modelList) {
    modelList.innerHTML = state.catalogs
      .map(
        c =>
          `<option value="${escapeHtml(c.brand ? `${c.brand} ${c.model}` : c.model)}">📦 ว่าง ${c.available_count}/${c.total_count} เครื่อง</option>`
      )
      .join('');
  }

  const accList = document.getElementById('accessoryDatalist');
  if (accList) {
    accList.innerHTML = state.accessorySuggestions
      .map(s => `<option value="${escapeHtml(s)}"></option>`)
      .join('');
  }

  const assetPicker = document.getElementById('assetPickerDatalist');
  if (assetPicker) {
    const availAssets = state.assets.filter(a => a.status === 'Available');
    assetPicker.innerHTML = availAssets
      .map(
        a =>
          `<option value="${escapeHtml(a.tag_id)}">${escapeHtml(a.brand)} ${escapeHtml(a.model)} (S/N: ${escapeHtml(a.serial_no)}) — [${escapeHtml(a.source)}]</option>`
      )
      .join('');
  }

  const brandList = document.getElementById('brandSuggestionsDatalist');
  if (brandList) {
    const brands = [...new Set(state.catalogs.map(c => c.brand).filter(Boolean))];
    brandList.innerHTML = brands.map(b => `<option value="${escapeHtml(b)}"></option>`).join('');
  }

  const locList = document.getElementById('locationSuggestionsDatalist');
  if (locList) {
    locList.innerHTML = (state.locations || []).map(l => `<option value="${escapeHtml(l)}"></option>`).join('');
  }
}

function renderHeaderCounters() {
  const requestingCount = state.loans.filter(l => l.main_column === 'requesting').length;
  const dispatchedCount = state.loans.filter(l => l.main_column === 'dispatched').length;
  const inUseCount = state.loans.filter(l => l.main_column === 'in-use').length;
  const overdueCount = state.loans.filter(l => l.main_column === 'overdue-and-partial').length;
  const qcCount = state.loans.filter(l => l.main_column === 'qc' || l.status === 'Pending_QC' || l.status === 'Pending_Return_Supplier_Sale').length;
  const returnedCount = state.loans.filter(l => l.status === 'Returned').length;

  const elReq = document.getElementById('kpiRequesting');
  if (elReq) elReq.textContent = requestingCount;
  const elDisp = document.getElementById('kpiDispatched');
  if (elDisp) elDisp.textContent = dispatchedCount;
  const elUse = document.getElementById('kpiInUse');
  if (elUse) elUse.textContent = inUseCount;
  const elOver = document.getElementById('kpiOverdue');
  if (elOver) elOver.textContent = overdueCount;
  const elQc = document.getElementById('kpiQc');
  if (elQc) elQc.textContent = qcCount;
  const elMQc = document.getElementById('mCountColQc');
  if (elMQc) elMQc.textContent = qcCount;
  const elRet = document.getElementById('countReturnedTab');
  if (elRet) elRet.textContent = returnedCount;
  const elStock = document.getElementById('countStockTab');
  if (elStock) elStock.textContent = state.assets.length;

  const banner = document.getElementById('highlightBanner');
  if (state.highlightDocNo) {
    banner.classList.remove('hidden');
    document.getElementById('highlightDocNoText').textContent = state.highlightDocNo;
  } else {
    banner.classList.add('hidden');
  }
}

// ============================================================================
// FILTERING & VIEW SWITCHING
// ============================================================================
function getFilteredLoans() {
  const q = state.searchQuery.trim().toLowerCase();
  if (!q) return state.loans;

  return state.loans.filter(l => {
    const itemText = (l.items || [])
      .map(i => {
        const asset = i.tag_id ? state.assets.find(a => a.tag_id === i.tag_id) : null;
        const sn = asset?.serial_no || i.serial_no || '';
        return `${i.tag_id || ''} ${i.brand || ''} ${i.model || ''} ${sn} ${(i.loan_accessories || []).join(' ')}`;
      })
      .join(' ');
    const hay = `${l.id} ${l.customer_name || ''} ${l.customer_company || ''} ${l.customer_phone || ''} ${l.borrower_name || ''} ${l.purpose || ''} ${itemText}`.toLowerCase();
    return hay.includes(q);
  });
}

function renderActiveView() {
  const kanbanView = document.getElementById('kanbanView');
  const listView = document.getElementById('listView');
  const returnedView = document.getElementById('returnedView');
  const stockView = document.getElementById('stockView');

  kanbanView.classList.add('hidden');
  listView.classList.add('hidden');
  returnedView.classList.add('hidden');
  stockView.classList.add('hidden');

  // Sync view switcher buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.toggle('active', btn.getAttribute('data-view') === state.viewMode);
  });

  if (!window.location.hash.startsWith('#modal:')) {
    window.location.hash = state.viewMode;
  }

  if (state.viewMode === 'kanban') {
    kanbanView.classList.remove('hidden');
    renderKanbanBoard();
  } else if (state.viewMode === 'list') {
    listView.classList.remove('hidden');
    renderListView();
  } else if (state.viewMode === 'returned') {
    returnedView.classList.remove('hidden');
    renderReturnedView();
  } else if (state.viewMode === 'stock') {
    stockView.classList.remove('hidden');
    renderStockView();
  }
}

function focusLoanCardInKanban(loanId) {
  if (!loanId) return;

  // 1. Switch to kanban view if not already there
  if (state.viewMode !== 'kanban') {
    state.viewMode = 'kanban';
    document.querySelectorAll('.view-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-view') === 'kanban');
    });
    updateUrlHash('kanban');
  }

  // 2. Set highlight targets
  state.highlightDocNo = loanId;
  if (!state.recentlyChangedLoans) state.recentlyChangedLoans = new Set();
  state.recentlyChangedLoans.add(loanId);

  // 3. Render kanban view & header counters
  renderActiveView();
  renderHeaderCounters();

  // 4. Smooth scroll and focus the card on the board
  setTimeout(() => {
    const card = document.querySelector(`[data-card-loan="${loanId}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('card-highlight', 'card-status-changed');
      card.setAttribute('tabindex', '-1');
      card.focus?.();
    }
  }, 120);
}

// ============================================================================
// VIEW 1: KANBAN BOARD (MATCHING activeASSET v1 COLUMNS & SUB-STACKS)
// ============================================================================
function renderKanbanBoard() {
  const board = document.getElementById('kanbanBoard');
  if (!board) return;
  const filteredLoans = getFilteredLoans();

  board.innerHTML = MAIN_COLUMNS.map(col => {
    const colLoans = filteredLoans.filter(l => l.main_column === col.id);
    const sortHint = col.sortableByDocNo
      ? `<div class="col-subtext">เรียงตามเลขที่ ${state.docNoSortOrder === 'asc' ? '(001...)' : '(ล่าสุด...)'}</div>`
      : '';

    const subStacksHtml = col.subGroups
      .map(sg => {
        let sgItems = colLoans.filter(l => l.sub_group === sg.key);
        if (sg.key === 'Overdue') {
          sgItems = [...sgItems].sort((a, b) => (b.overdue_days || 0) - (a.overdue_days || 0));
        } else if (col.sortableByDocNo) {
          sgItems = [...sgItems].sort((a, b) => {
            const cmp = a.id.localeCompare(b.id, undefined, { numeric: true });
            return state.docNoSortOrder === 'asc' ? cmp : -cmp;
          });
        }
        if (sgItems.length === 0) return '';

        const stackKey = `${col.id}:${sg.key}`;
        const isCollapsed = state.collapsedSubGroups.has(stackKey);

        return `
          <div class="sub-stack">
            <button type="button" class="sub-stack-header" data-toggle-substack="${stackKey}">
              <div class="sub-header-left">
                <span class="sub-chevron">${isCollapsed ? '▸' : '▾'}</span>
                <span class="sub-label">${escapeHtml(sg.label)}</span>
              </div>
              <span class="sub-count">${sgItems.length}</span>
            </button>
            ${
              !isCollapsed
                ? `<div class="sub-stack-cards">
                    ${sgItems.map(loan => renderKanbanCard(loan)).join('')}
                  </div>`
                : ''
            }
          </div>
        `;
      })
      .filter(Boolean)
      .join('');

    return `
      <div class="kanban-col ${col.theme}" id="kanbanCol_${col.id}" data-col-id="${col.id}">
        <div class="col-header">
          <div class="col-header-left">
            <div class="col-icon-box">${col.icon}</div>
            <div>
              <div class="col-title">${escapeHtml(col.label)}</div>
              ${sortHint}
            </div>
          </div>
          <span class="col-count-badge">${colLoans.length}</span>
        </div>

        ${
          colLoans.length === 0
            ? `<div class="empty-col-box">ไม่มีรายการ</div>`
            : subStacksHtml
        }
      </div>
    `;
  }).join('');

  // Update mobile column selector badges
  const mBadgeMap = {
    requesting: 'mCountColWaitingDispatch',
    dispatched: 'mCountColWaitingDelivery',
    'in-use': 'mCountColActiveLoan',
    'overdue-and-partial': 'mCountColOverdue',
    qc: 'mCountColQc',
    waiting_dispatch: 'mCountColWaitingDispatch',
    waiting_delivery: 'mCountColWaitingDelivery',
    active_loan: 'mCountColActiveLoan',
    overdue: 'mCountColOverdue'
  };
  MAIN_COLUMNS.forEach(col => {
    const colLoans = filteredLoans.filter(l => l.main_column === col.id);
    const badgeEl = document.getElementById(mBadgeMap[col.id]);
    if (badgeEl) badgeEl.textContent = colLoans.length;
  });
}

const THAI_SHORT_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'
];

function renderMiniCalendar(dateStr, isOverdue, isDueSoon, overdueDays) {
  if (isOverdue) {
    return `<span class="due-pill overdue" title="กำหนดคืน: ${formatShortDate(dateStr)}">เกิน ${overdueDays}d</span>`;
  }
  if (!dateStr) return '';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return '';
  const monthIdx = parseInt(parts[1], 10) - 1;
  const dayNum = parseInt(parts[2], 10);
  const monthLabel = THAI_SHORT_MONTHS[monthIdx] || parts[1];

  const toneClass = isDueSoon ? 'cal-soon' : 'cal-normal';

  return `
    <div class="mini-cal-group" title="กำหนดคืน: ${formatShortDate(dateStr)}">
      <div class="mini-cal ${toneClass}">
        <div class="mini-cal-month">${monthLabel}</div>
        <div class="mini-cal-day">${dayNum}</div>
      </div>
    </div>
  `;
}

function renderKanbanCard(loan) {
  const isStatusChanged = state.recentlyChangedLoans && state.recentlyChangedLoans.has(loan.id);
  const isHighlight = loan.id === state.highlightDocNo || isStatusChanged;
  const statusClass = loan.status === 'Pending_QC' ? 'status-qc' : '';
  const miniCalHtml = renderMiniCalendar(
    loan.due_date,
    loan.is_overdue,
    loan.is_due_soon,
    loan.overdue_days
  );

  // Group items strictly by Brand + Model (NO Tag ID and NO extra details on the Kanban card)
  const modelCounts = new Map();
  for (const it of loan.items || []) {
    const label = `${it.brand || ''} ${it.model || ''}`.trim();
    if (!label) continue;
    modelCounts.set(label, (modelCounts.get(label) || 0) + 1);
  }

  const modelsHtml =
    modelCounts.size === 0
      ? `<span class="muted-hint">ไม่ได้ระบุรุ่น</span>`
      : [...modelCounts.entries()]
          .map(
            ([brandModel, qty]) => `
            <span class="card-model-pill">
              <strong>${escapeHtml(brandModel)}</strong>
              ${qty > 1 ? `<span class="model-qty">×${qty}</span>` : ''}
            </span>
          `
          )
          .join('');

  // Editable: Requested, Dispatching, Dispatched. Delivered: Note-only.
  const isEditable = loan.status === 'Requested' || loan.status === 'Dispatching' || loan.status === 'Dispatched';
  const isDeliveredStage = ['Delivered', 'Partially_Returned'].includes(loan.status);

  // Watermark (ลายน้ำปกติแสดงสถานะของการ์ด ไม่ใช่ปุ่มกด)
  let wmText = 'รอจัด';
  let wmClass = 'wm-requested';

  if (loan.is_overdue) {
    wmText = 'เกินกำหนด';
    wmClass = 'wm-overdue';
  } else if (loan.status === 'Requested') {
    wmText = 'รอจัด';
    wmClass = 'wm-requested';
  } else if (loan.status === 'Dispatching') {
    wmText = 'กำลังจัด';
    wmClass = 'wm-dispatching';
  } else if (loan.status === 'Dispatched') {
    wmText = 'จัดเสร็จ';
    wmClass = 'wm-dispatched';
  } else if (loan.status === 'Delivered') {
    wmText = 'ส่งมอบ';
    wmClass = 'wm-delivered';
  } else if (loan.status === 'Pending_QC') {
    wmText = 'รอตรวจ QC';
    wmClass = 'wm-qc';
  } else if (loan.status === 'Pending_Return_Supplier_Sale') {
    wmText = 'คืน Supp/ขาย';
    wmClass = 'wm-supplier-sale';
  } else if (loan.status === 'Partially_Returned') {
    wmText = 'คืนไม่ครบ';
    wmClass = 'wm-partial';
  } else if (loan.status === 'Returned') {
    wmText = 'คืนแล้ว';
    wmClass = 'wm-returned';
  }

  const companyHeadline = loan.customer_company || loan.customer_name || loan.borrower_name;

  const isSupplierReturnStage = loan.status === 'Pending_Return_Supplier_Sale' || loan.sub_group === 'Pending_Supplier_Return';

  // For supplier return stage: Brand & Model as Headline, and Notes as Line 3
  let supplierBrandModelHeadline = '';
  let supplierNotesText = '';
  if (isSupplierReturnStage) {
    if (modelCounts.size > 0) {
      supplierBrandModelHeadline = [...modelCounts.entries()]
        .map(([brandModel, qty]) => (qty > 1 ? `${brandModel} (×${qty})` : brandModel))
        .join(', ');
    } else if (loan.items && loan.items.length > 0 && loan.items[0].model) {
      supplierBrandModelHeadline = `${loan.items[0].brand || ''} ${loan.items[0].model}`.trim();
    } else {
      supplierBrandModelHeadline = 'ไม่ได้ระบุรุ่น';
    }

    const allNotes = [];
    for (const it of loan.items || []) {
      const n = String(it.loan_free_note || it.free_note || '').trim();
      if (n && n !== '-' && !allNotes.includes(n)) allNotes.push(n);
    }
    if (loan.supplier_return_note && loan.supplier_return_note.trim() && loan.supplier_return_note.trim() !== '-' && !allNotes.includes(loan.supplier_return_note.trim())) {
      allNotes.push(loan.supplier_return_note.trim());
    }
    if (loan.sale_return_note && loan.sale_return_note.trim() && loan.sale_return_note.trim() !== '-' && !allNotes.includes(loan.sale_return_note.trim())) {
      allNotes.push(loan.sale_return_note.trim());
    }
    if (loan.delivery_note && loan.delivery_note.trim() && loan.delivery_note.trim() !== '-' && !allNotes.includes(loan.delivery_note.trim())) {
      allNotes.push(loan.delivery_note.trim());
    }
    if (loan.note && loan.note.trim() && loan.note.trim() !== '-' && !allNotes.includes(loan.note.trim())) {
      allNotes.push(loan.note.trim());
    }
    supplierNotesText = allNotes.join(' · ');
  }

  return `
    <article
      class="loan-card clickable-card ${isHighlight ? 'card-highlight card-status-changed' : ''} ${statusClass} ${loan.is_overdue ? 'card-overdue' : ''}"
      data-card-loan="${escapeHtml(loan.id)}"
      title="${isEditable ? 'คลิกเพื่อเปิดหน้าจัดของ & Match S/N' : loan.status === 'Pending_QC' ? 'คลิกเพื่อเปิดหน้าตรวจสภาพ QC & รับเข้าคลัง' : loan.status === 'Pending_Return_Supplier_Sale' ? 'คลิกเพื่อเปิดหน้าคืน Supplier, คลังขาย' : 'คลิกเพื่อเปิดดูใบยืมแบบเต็มหน้าจอ'}"
    >
      <!-- Background Watermark (ลายน้ำสถานะ) -->
      <div class="card-watermark ${wmClass}" aria-hidden="true">${wmText}</div>

      <!-- Line 1: Prominent Company Name / Model + Mini Calendar -->
      <div class="card-top-row">
        <div class="card-top-left">
          ${isStatusChanged ? `<span class="badge-status-changed-pill">🔄 เพิ่งเปลี่ยนสถานะ</span>` : ''}
          <div class="card-company-headline" title="${escapeHtml(isSupplierReturnStage ? supplierBrandModelHeadline : companyHeadline)}">
            ${escapeHtml(isSupplierReturnStage ? supplierBrandModelHeadline : companyHeadline)}
          </div>
        </div>
        ${miniCalHtml}
      </div>

      <!-- Line 2: Borrower Name (Left) + Phone Number (Far Right Edge) -->
      <div class="card-sub-meta">
        <span class="card-borrower-name" title="ผู้ยืม: ${escapeHtml(loan.borrower_name)}">${escapeHtml(loan.borrower_name)}</span>
        ${loan.customer_phone ? `<span class="card-phone-meta" title="เบอร์โทรผู้ติดต่อ">📞 ${escapeHtml(loan.customer_phone)}</span>` : ''}
      </div>

      <!-- Line 3: เฉพาะสถานะคืน Supplier ให้แสดงหมายเหตุ / สถานะอื่นแสดง Brand & Model ปกติเดิม 100% -->
      ${isSupplierReturnStage ? `
        <div class="card-notes-row">
          ${supplierNotesText ? `
            <div class="card-note-item" title="${escapeHtml(supplierNotesText)}">
              <span class="note-quote-icon">📝</span>
              <span class="card-note-text">${escapeHtml(supplierNotesText)}</span>
            </div>
          ` : `
            <div class="card-note-item empty">
              <span class="muted-hint">-</span>
            </div>
          `}
        </div>
      ` : `
        <!-- Emphasize Brand & Model ONLY (No Tag ID, No extra details) -->
        <div class="card-models-wrap">
          ${modelsHtml}
        </div>
      `}

      <div class="card-footer">
        ${
          loan.status === 'Pending_Return_Supplier_Sale'
            ? `
          <div class="card-actions">
            <button type="button" class="btn-card-edit-minimal" data-open-sup-sale-return="${escapeHtml(loan.id)}" title="จัดการส่งคืน Supplier / คลังขาย" style="color:#4338ca; border-color:#c7d2fe; background:#e0e7ff; font-weight:600;">
              <span>คืน Supp/ขาย</span>
            </button>
          </div>
          `
            : ((isEditable || isDeliveredStage) && can('edit_loan')) || (loan.status === 'Requested' && can('cancel_loan'))
            ? `
          <div class="card-actions">
            ${can('edit_loan') ? `
            <button type="button" class="btn-card-edit-minimal" data-edit-loan="${escapeHtml(loan.id)}" title="${isDeliveredStage ? 'แก้ไขหมายเหตุใบยืม' : 'แก้ไขรายการใบยืม'}">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
              <span>${isDeliveredStage ? 'หมายเหตุ' : 'แก้ไข'}</span>
            </button>` : ''}
            ${loan.status === 'Requested' && can('cancel_loan') ? `
            <button type="button" class="btn-card-cancel-minimal" data-cancel-loan="${escapeHtml(loan.id)}" title="ยกเลิกใบยืมนี้">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:#ef4444; margin-right:2px; vertical-align:-1px;">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
              <span style="color:#ef4444;">ยกเลิก</span>
            </button>` : ''}
          </div>
        `
            : ''
        }
        <button type="button" class="doc-no doc-link-pill kanban-doc-pill card-footer-doc-pill" data-open-print="${escapeHtml(loan.id)}" title="คลิกเพื่อเปิดดูใบยืมจริง ${escapeHtml(loan.id)}">
          <span>${escapeHtml(loan.id)}</span>
          <svg class="doc-link-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
            <polyline points="15 3 21 3 21 9"></polyline>
            <line x1="10" y1="14" x2="21" y2="3"></line>
          </svg>
        </button>
      </div>
    </article>
  `;
}

// ============================================================================
// VIEW 2 & 3: LIST VIEW & RETURNED VIEW
// ============================================================================
function getLoanStatusBadge(loan) {
  const isOverdue = loan.is_overdue || (['Delivered', 'Partially_Returned'].includes(loan.status) && loan.overdue_days > 0);
  if (isOverdue) {
    return `<span class="min-status-badge overdue"><span class="status-dot red"></span>เกินกำหนด</span>`;
  }
  switch (loan.status) {
    case 'Requested':
      return `<span class="min-status-badge requested"><span class="status-dot yellow"></span>รอจัดของ</span>`;
    case 'Dispatching':
      return `<span class="min-status-badge dispatching"><span class="status-dot orange"></span>กำลังจัด</span>`;
    case 'Dispatched':
      return `<span class="min-status-badge dispatched"><span class="status-dot blue"></span>รอส่งมอบ</span>`;
    case 'Delivered':
      return `<span class="min-status-badge delivered"><span class="status-dot green"></span>กำลังยืม</span>`;
    case 'Pending_QC':
      return `<span class="min-status-badge pending-qc"><span class="status-dot amber"></span>รอตรวจ QC</span>`;
    case 'Pending_Return_Supplier_Sale':
      return `<span class="min-status-badge pending-supplier-sale"><span class="status-dot indigo"></span>คืน Supp/ขาย</span>`;
    case 'Partially_Returned':
      return `<span class="min-status-badge partial"><span class="status-dot purple"></span>คืนบางส่วน</span>`;
    case 'Returned':
      return `<span class="min-status-badge returned"><span class="status-dot gray"></span>คืนแล้ว</span>`;
    default:
      return `<span class="min-status-badge default">${escapeHtml(loan.status)}</span>`;
  }
}

function renderListView() {
  const tbody = document.getElementById('listTableBody');
  const activeLoans = getFilteredLoans().filter(l => l.status !== 'Returned');

  if (activeLoans.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="min-empty-cell"><div class="min-empty-wrap"><span>📦</span><span>ไม่พบรายการใบยืม</span></div></td></tr>`;
    return;
  }

  tbody.innerHTML = activeLoans
    .map(l => {
      const itemsHtml = (l.items || []).map(i => {
        const hasSn = Boolean(i.serial_no);
        const isItemReturned = Boolean(i.returned);
        const accList = (i.loan_accessories || []).join(', ');
        const tooltip = `${i.brand || ''} ${i.model || ''} ${hasSn ? `(S/N: ${i.serial_no})` : '(รอ Match S/N)'} ${accList ? `· อุปกรณ์: ${accList}` : ''}`;

        return `
          <div class="min-item-chip ${isItemReturned ? 'is-returned' : ''}" title="${escapeHtml(tooltip)}">
            <span class="min-item-name">${escapeHtml(i.model || i.brand || 'เครื่อง')}</span>
            ${hasSn ? `
              <span class="min-item-sn font-mono">${escapeHtml(i.serial_no)}</span>
            ` : `
              <span class="min-item-wait">รอจัด</span>
            `}
            ${isItemReturned ? `<span class="min-item-check" title="คืนแล้ว">✓</span>` : ''}
          </div>
        `;
      }).join('');

      const isEditable = l.status === 'Requested' || l.status === 'Dispatching' || l.status === 'Dispatched';
      const isDeliveredStage = ['Delivered', 'Partially_Returned', 'Returned'].includes(l.status);
      const isDispatched = l.status === 'Dispatched';
      const isReturnable = ['Delivered', 'Partially_Returned'].includes(l.status);
      const isOverdue = l.is_overdue || (['Delivered', 'Partially_Returned'].includes(l.status) && l.overdue_days > 0);
      const progressPercent = Math.min(100, Math.round((l.returned_items / (l.total_items || 1)) * 100));

      return `
        <tr class="min-table-row clickable-row ${isOverdue ? 'row-overdue' : ''}" data-card-loan="${escapeHtml(l.id)}" title="คลิกเพื่อเปิดใบยืม ${escapeHtml(l.id)}">
          <!-- Col 1: Doc ID -->
          <td>
            <span class="doc-link-pill list-doc-pill" title="คลิกเพื่อเปิดดูใบยืม ${escapeHtml(l.id)}">
              <span>${escapeHtml(l.id)}</span>
              <svg class="doc-link-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </span>
          </td>

          <!-- Col 2: Customer & Borrower -->
          <td>
            <div class="min-customer-cell">
              <div class="min-company-name" title="${escapeHtml(l.customer_company || l.customer_name)}">
                ${escapeHtml(l.customer_company || l.customer_name || '-')}
              </div>
              <div class="min-customer-sub">
                <span class="sub-borrower">ผู้ยืม: <strong>${escapeHtml(l.borrower_name || '-')}</strong></span>
                ${l.customer_name && l.customer_name !== l.customer_company ? `
                  <span class="sub-sep">·</span>
                  <span class="sub-contact" title="ผู้ติดต่อ">${escapeHtml(l.customer_name)}</span>
                ` : ''}
              </div>
            </div>
          </td>

          <!-- Col 3: Items Grid/Chips -->
          <td>
            <div class="min-items-wrap">
              ${itemsHtml}
            </div>
          </td>

          <!-- Col 4: Status Badge -->
          <td>
            ${getLoanStatusBadge(l)}
          </td>

          <!-- Col 5: Due Date & Progress -->
          <td>
            <div class="min-due-cell">
              <div class="min-due-date-row">
                ${isOverdue ? `
                  <span class="due-tag overdue">⚠️ เกิน ${l.overdue_days} วัน</span>
                ` : `
                  <span class="due-date-text">คืน <strong>${formatShortDate(l.due_date)}</strong></span>
                `}
              </div>
              <div class="min-progress-row">
                <span class="min-progress-track">
                  <span class="min-progress-bar" style="width: ${progressPercent}%;"></span>
                </span>
                <span class="min-progress-text">${l.returned_items}/${l.total_items} คืนแล้ว</span>
              </div>
            </div>
          </td>

          <!-- Col 6: Actions Toolbar (สอดคล้องกับสถานะใบยืม) -->
          <td style="text-align:right;">
            <div class="min-actions-toolbar">
              ${(isEditable || isDeliveredStage) && can('edit_loan') ? `
                <button type="button" class="btn-min-tool" data-edit-loan="${escapeHtml(l.id)}" title="${isDeliveredStage ? 'แก้ไขหมายเหตุใบยืม' : 'แก้ไขใบยืม'}">
                  ${isDeliveredStage ? '📝' : '✏️'}
                </button>
              ` : ''}
              ${l.status === 'Requested' && can('cancel_loan') ? `
                <button type="button" class="btn-min-tool danger" data-cancel-loan="${escapeHtml(l.id)}" title="ยกเลิกใบยืม">🗑️</button>
              ` : ''}
              ${isDispatched && can('deliver_loan') ? `
                <button type="button" class="btn-min-deliver" data-open-delivery="${escapeHtml(l.id)}" title="ส่งมอบสินค้าให้ลูกค้า">
                  <span>🚚 ส่งมอบ</span>
                </button>
              ` : ''}
              ${isReturnable && can('return_loan') ? `
                <button type="button" class="btn-min-return" data-open-return="${escapeHtml(l.id)}" title="รับคืนจากลูกค้า / ส่งตรวจ QC">
                  <span>📥 รับคืน</span>
                </button>
              ` : ''}
              ${l.status === 'Pending_QC' && can('return_loan') ? `
                <button type="button" class="btn-min-return btn-min-qc" data-open-return="${escapeHtml(l.id)}" title="ตรวจสภาพ QC และรับเข้าคลัง">
                  <span>🔍 ตรวจ QC</span>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function renderReturnedView() {
  const tbody = document.getElementById('returnedTableBody');
  const returnedLoans = getFilteredLoans().filter(l => l.status === 'Returned');

  if (returnedLoans.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="min-empty-cell"><div class="min-empty-wrap"><span>📦</span><span>ยังไม่มีรายการที่รับคืนครบแล้ว</span></div></td></tr>`;
    return;
  }

  tbody.innerHTML = returnedLoans
    .map(l => {
      const itemsHtml = (l.items || []).map(i => `
        <div class="min-item-chip is-returned" title="${escapeHtml(i.brand || '')} ${escapeHtml(i.model || '')} (Tag: ${escapeHtml(i.tag_id || '-')}, S/N: ${escapeHtml(i.serial_no || '-')}) · ผ่าน QC & เก็บคืนที่: ${escapeHtml(i.location_snapshot || '-')}">
          <span class="min-item-name font-mono">${escapeHtml(i.tag_id || i.model)}</span>
          <span class="min-item-sn">${escapeHtml(i.model)}</span>
          <span class="min-item-check" title="ผ่าน QC">✓</span>
        </div>
      `).join('');

      return `
        <tr class="min-table-row clickable-row" data-card-loan="${escapeHtml(l.id)}" title="คลิกเพื่อเปิดใบยืม ${escapeHtml(l.id)}">
          <td>
            <span class="doc-link-pill list-doc-pill" title="คลิกเพื่อเปิดดูใบยืม ${escapeHtml(l.id)}">
              <span>${escapeHtml(l.id)}</span>
              <svg class="doc-link-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </span>
          </td>
          <td>
            <div class="min-customer-cell">
              <div class="min-company-name" title="${escapeHtml(l.customer_name || l.customer_company)}">
                ${escapeHtml(l.customer_company || l.customer_name || '-')}
              </div>
              <div class="min-customer-sub">
                <span>ผู้ยืม: <strong>${escapeHtml(l.borrower_name || '-')}</strong></span>
              </div>
            </div>
          </td>
          <td>
            <div class="min-due-cell">
              <span class="due-date-text font-mono">${formatShortDate(l.checkout_date)} → <strong>${formatShortDate(l.return_date || l.due_date)}</strong></span>
            </div>
          </td>
          <td>
            <div class="min-items-wrap">
              ${itemsHtml}
            </div>
          </td>
          <td>
            <div style="font-size:12.5px; font-weight:600; color:#334155;">
              👤 ${escapeHtml(l.return_receiver || 'เจ้าหน้าที่คลัง')}
            </div>
          </td>
          <td style="text-align:right;">
            <div style="display:flex; justify-content:flex-end; gap:6px; align-items:center;">
              <button type="button" class="btn btn-sm btn-outline" data-open-return-slip="${escapeHtml(l.id)}" title="คลิกเพื่อเปิดพิมพ์ใบคืนสินค้า" style="font-size:11px; padding:2px 7px; color:#0f766e; border-color:#99f6e4; background:#f0fdfa;">
                🖨️ ใบคืน
              </button>
              <span style="display:inline-block; font-size:11.5px; font-weight:600; color:#15803d; background:#f0fdf4; border:1px solid #bbf7d0; padding:2px 8px; border-radius:6px;">✓ คืนครบแล้ว</span>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

// ============================================================================
// VIEW 4: MASTER ASSET STOCK CARDS (GROUPED BY BRAND, READ-ONLY CARD)
// ============================================================================
function getDeviceCategorySvg(category, model) {
  const cat = (category || '').toLowerCase();
  const mod = (model || '').toLowerCase();

  if (cat.includes('printer') || mod.includes('printer') || mod.includes('zd') || mod.includes('th240')) {
    // Barcode Printer SVG
    return `<svg class="device-svg-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M6 9V2h12v7"></path>
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path>
      <rect x="6" y="14" width="12" height="8" rx="1"></rect>
      <circle cx="18" cy="13" r="1" fill="currentColor"></circle>
    </svg>`;
  }
  if (cat.includes('scanner') || mod.includes('scanner') || mod.includes('ds2208') || mod.includes('1470g')) {
    // Barcode Scanner Gun / Imager SVG
    return `<svg class="device-svg-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M4 4h4v4H4z"></path>
      <path d="M16 4h4v4h-4z"></path>
      <path d="M4 16h4v4H4z"></path>
      <path d="M9 4h6"></path>
      <path d="M9 20h6"></path>
      <path d="M4 9v6"></path>
      <path d="M20 9v6"></path>
      <line x1="9" y1="12" x2="15" y2="12"></line>
    </svg>`;
  }
  if (cat.includes('tablet') || cat.includes('pad') || mod.includes('ipad') || mod.includes('tab')) {
    // Tablet SVG
    return `<svg class="device-svg-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2"></rect>
      <line x1="12" y1="18" x2="12.01" y2="18"></line>
    </svg>`;
  }
  if (cat.includes('rfid') || mod.includes('rfd40') || mod.includes('rfid')) {
    // RFID / Waves SVG
    return `<svg class="device-svg-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
      <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
      <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
      <line x1="12" y1="20" x2="12.01" y2="20"></line>
    </svg>`;
  }
  // Mobile Computer / Rugged Handheld Terminal
  return `<svg class="device-svg-icon" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <rect x="5" y="2" width="14" height="20" rx="3"></rect>
    <path d="M9 6h6"></path>
    <path d="M9 10h6"></path>
    <circle cx="12" cy="18" r="1" fill="currentColor"></circle>
  </svg>`;
}

const BRAND_PRESETS = {
  'Honeywell': { initial: 'H', gradient: 'linear-gradient(135deg, #ef4444, #b91c1c)', color: '#ffffff', pillColor: '#dc2626' },
  'Zebra': { initial: 'Z', gradient: 'linear-gradient(135deg, #0284c7, #0369a1)', color: '#ffffff', pillColor: '#0284c7' },
  'TSC': { initial: 'T', gradient: 'linear-gradient(135deg, #2563eb, #1d4ed8)', color: '#ffffff', pillColor: '#2563eb' },
  'Apple': { initial: 'A', gradient: 'linear-gradient(135deg, #475569, #1e293b)', color: '#ffffff', pillColor: '#334155' },
  'Samsung': { initial: 'S', gradient: 'linear-gradient(135deg, #1d4ed8, #1e3a8a)', color: '#ffffff', pillColor: '#1d4ed8' },
  'Cipherlap': { initial: 'C', gradient: 'linear-gradient(135deg, #0d9488, #0f766e)', color: '#ffffff', pillColor: '#0d9488' },
  'Nex-T': { initial: 'N', gradient: 'linear-gradient(135deg, #7c3aed, #6d28d9)', color: '#ffffff', pillColor: '#7c3aed' },
  'Bluebird': { initial: 'B', gradient: 'linear-gradient(135deg, #0284c7, #1e40af)', color: '#ffffff', pillColor: '#0369a1' },
  'Urovo': { initial: 'U', gradient: 'linear-gradient(135deg, #ea580c, #c2410c)', color: '#ffffff', pillColor: '#ea580c' },
  'Idata': { initial: 'I', gradient: 'linear-gradient(135deg, #4f46e5, #3730a3)', color: '#ffffff', pillColor: '#4f46e5' },
  'Bixolon': { initial: 'B', gradient: 'linear-gradient(135deg, #059669, #047857)', color: '#ffffff', pillColor: '#059669' },
};

function getBrandVisual(brand) {
  const clean = (brand || '').trim();
  if (BRAND_PRESETS[clean]) return BRAND_PRESETS[clean];
  const char = clean ? clean[0].toUpperCase() : '📦';
  return {
    initial: char,
    gradient: 'linear-gradient(135deg, #64748b, #475569)',
    color: '#ffffff',
    pillColor: '#475569'
  };
}

function getSourceClass(src) {
  const s = String(src || '').replace(/^[0-9]+\.\s*/, '').trim().toLowerCase();
  if (s === 'supplier') return 'src-supplier';
  if (s === 'คลังขาย') return 'src-sales';
  if (s === 'ทดแทนระหว่างซ่อม') return 'src-repair';
  return 'src-demo';
}

function getAssetWorkflowStatus(asset) {
  if (!asset) {
    return {
      text: 'ว่าง',
      pillCls: 'avail',
      dotCls: 'green',
      indicatorCls: 'avail',
      badgeIcon: '🟢',
      calloutBadge: '🟢 ว่างพร้อมยืม'
    };
  }
  if (asset.status === 'Available') {
    return {
      text: 'ว่าง',
      pillCls: 'avail',
      dotCls: 'green',
      indicatorCls: 'avail',
      badgeIcon: '🟢',
      calloutBadge: '🟢 ว่างพร้อมยืม'
    };
  }
  if (asset.status === 'Disposed') {
    return {
      text: 'จำหน่ายแล้ว',
      pillCls: 'disposed',
      dotCls: 'gray',
      indicatorCls: 'gray',
      badgeIcon: '⚪',
      calloutBadge: '📦 จำหน่ายออกจากระบบแล้ว'
    };
  }

  const activeLoan = asset.active_loan || (asset.current_loan_id && Array.isArray(state.loans) ? state.loans.find(l => l.id === asset.current_loan_id) : null);
  const loanStatus = activeLoan?.status || '';
  const src = String(asset.source || '').replace(/^[0-9]+\.\s*/, '').trim().toLowerCase();
  const isSupplier = src.includes('supplier');
  const isSale = src.includes('ขาย') || src.includes('sale');

  if (loanStatus === 'Pending_Return_Supplier_Sale') {
    if (isSupplier) {
      return {
        text: 'รอคืน Supplier',
        pillCls: 'purple',
        dotCls: 'purple',
        indicatorCls: 'purple',
        badgeIcon: '🚚',
        calloutBadge: '🚚 รอคืน Supplier (ภายนอก)'
      };
    }
    if (isSale) {
      return {
        text: 'รอคืนคลังขาย',
        pillCls: 'amber',
        dotCls: 'amber',
        indicatorCls: 'amber',
        badgeIcon: '🏢',
        calloutBadge: '🏢 รอส่งคืนคลังขาย'
      };
    }
    return {
      text: 'รอคืน Supp/ขาย',
      pillCls: 'purple',
      dotCls: 'purple',
      indicatorCls: 'purple',
      badgeIcon: '🚚',
      calloutBadge: '🚚 รอคืน Supplier, คลังขาย'
    };
  }

  if (loanStatus === 'Pending_QC' || asset.status === 'In_QC') {
    return {
      text: 'รอตรวจ QC',
      pillCls: 'amber',
      dotCls: 'amber',
      indicatorCls: 'amber',
      badgeIcon: '🔍',
      calloutBadge: '🔍 รอตรวจสภาพ QC'
    };
  }

  if (loanStatus === 'Dispatching') {
    return {
      text: 'รอจัดของ',
      pillCls: 'loaned',
      dotCls: 'blue',
      indicatorCls: 'loaned',
      badgeIcon: '📦',
      calloutBadge: '📦 อยู่ระหว่างจัดของ'
    };
  }

  if (loanStatus === 'Dispatched') {
    return {
      text: 'รอส่งมอบ',
      pillCls: 'loaned',
      dotCls: 'blue',
      indicatorCls: 'loaned',
      badgeIcon: '🚚',
      calloutBadge: '🚚 จัดของเสร็จแล้ว รอส่งมอบ'
    };
  }

  return {
    text: 'ถูกยืม',
    pillCls: 'loaned',
    dotCls: 'blue',
    indicatorCls: 'loaned',
    badgeIcon: '🔵',
    calloutBadge: '📄 กำลังอยู่ระหว่างการยืม'
  };
}

function renderStockView() {
  const container = document.getElementById('stockCardsContainer');
  const countBadge = document.getElementById('stockFilteredCountBadge');
  const availCountBadge = document.getElementById('stockAvailCount');
  const loanedCountBadge = document.getElementById('stockLoanedCount');
  const toggleAllText = document.getElementById('btnToggleAllBrandsText');
  const toggleAllIcon = document.getElementById('btnToggleAllBrandsIcon');

  const q = (state.searchQuery || '').trim().toLowerCase();
  const src = state.stockSourceFilter || 'all';

  const rows = (state.assets || []).filter(a => {
    if (src === 'disposed') {
      if (a.status !== 'Disposed') return false;
    } else if (src !== 'all') {
      const aSrc = (a.source || 'Demo').replace(/^[0-9]+\.\s*/, '').trim().toLowerCase();
      const targetSrc = src.replace(/^[0-9]+\.\s*/, '').trim().toLowerCase();
      if (aSrc !== targetSrc) return false;
    }
    if (q) {
      const activeBorrower = a.active_loan?.borrower_name || '';
      const activeCustomer = a.active_loan?.customer_company || a.active_loan?.customer_name || '';
      const activeLoanId = a.active_loan?.id || a.current_loan_id || '';
      const accs = (a.accessories || []).join(' ');
      const hay = [a.tag_id, a.model, a.brand, a.category, a.serial_no, a.location, a.free_note, accs, activeBorrower, activeCustomer, activeLoanId, a.disposed_reason, a.disposed_note]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    }
    return true;
  });

  const totalAvail = rows.filter(a => a.status === 'Available').length;
  const totalLoaned = rows.filter(a => a.status === 'On_Loan' || a.status === 'Issue').length;
  const totalDisposed = rows.filter(a => a.status === 'Disposed').length;

  if (countBadge) countBadge.textContent = `${rows.length} เครื่อง`;
  if (availCountBadge) availCountBadge.textContent = `${totalAvail}`;
  if (loanedCountBadge) loanedCountBadge.textContent = `${totalLoaned}`;
  const disposedCountBadge = document.getElementById('stockDisposedCount');
  if (disposedCountBadge) disposedCountBadge.textContent = `${totalDisposed}`;

  if (!container) return;

  if (rows.length === 0) {
    container.innerHTML = `
      <div class="stock-empty-state">
        <div class="empty-icon">📦</div>
        <div class="empty-title">ไม่พบเครื่องในเงื่อนไขที่เลือก</div>
        <div class="empty-desc">ลองค้นหาด้วยคำอื่น หรือกดตัวกรอง Source ด้านบน</div>
        <button type="button" class="btn btn-outline btn-sm" id="btnEmptyAddDemo">+ เพิ่มเครื่อง Demo ใหม่</button>
      </div>
    `;
    return;
  }

  // 1. Group assets by Brand
  const brandGroups = new Map();
  rows.forEach(a => {
    const brand = (a.brand || '').trim() || 'อื่นๆ';
    if (!brandGroups.has(brand)) {
      brandGroups.set(brand, []);
    }
    brandGroups.get(brand).push(a);
  });

  // Sort brands: by item count descending, with 'อื่นๆ' at the end
  const sortedBrands = [...brandGroups.keys()].sort((b1, b2) => {
    if (b1 === 'อื่นๆ') return 1;
    if (b2 === 'อื่นๆ') return -1;
    return brandGroups.get(b2).length - brandGroups.get(b1).length;
  });

  // Update Toggle All Brands button
  const allCollapsed = sortedBrands.length > 0 && sortedBrands.every(b => !state.expandedBrands.has(b));
  if (toggleAllText) toggleAllText.textContent = allCollapsed ? 'ขยายทั้งหมด' : 'ย่อทั้งหมด';
  if (toggleAllIcon) toggleAllIcon.textContent = allCollapsed ? '⬇️' : '⬆️';

  const sheetHeaderHtml = `
    <div class="stock-sheet-header">
      <div class="sheet-th col-toggle"></div>
      <div class="sheet-th col-brand">ยี่ห้อ (Brand)</div>
      <div class="sheet-th col-total">ทั้งหมด</div>
      <div class="sheet-th col-avail">🟢 ว่าง</div>
      <div class="sheet-th col-loaned">🔵 ถูกยืม</div>
    </div>
  `;

  // 2. Render each Brand section with luxury cards
  container.innerHTML = sheetHeaderHtml + sortedBrands
    .map(brand => {
      const groupAssets = brandGroups.get(brand) || [];
      const availCount = groupAssets.filter(a => a.status === 'Available').length;
      const loanedCount = groupAssets.filter(a => a.status === 'On_Loan' || a.status === 'Issue').length;
      const disposedCount = groupAssets.filter(a => a.status === 'Disposed').length;
      const isCollapsed = Boolean(q) ? false : !state.expandedBrands.has(brand);
      const brandMeta = getBrandVisual(brand);

      const cardsHtml = groupAssets.map(a => {
        const isAvailable = a.status === 'Available';
        const isDisposed = a.status === 'Disposed';
        const wf = getAssetWorkflowStatus(a);
        const sourceClass = getSourceClass(a.source);
        const accessories = a.accessories || [];
        const hasLoan = !isAvailable && !isDisposed && a.active_loan;
        const deviceSvg = getDeviceCategorySvg(a.category, a.model);

        // Remove redundant brand from model name if it already starts with brand
        let displayModel = a.model || '';
        if (a.brand && displayModel.toLowerCase().startsWith(a.brand.toLowerCase())) {
          displayModel = displayModel.slice(a.brand.length).trim();
        }

        // Clean redundant category prefix from location if present
        let displayLoc = a.location || 'คลังกลาง';
        if (a.category && displayLoc.toLowerCase().startsWith(a.category.toLowerCase())) {
          displayLoc = displayLoc.slice(a.category.length).trim();
        }

        return `
          <div class="asset-stock-card ${isAvailable ? 'is-avail' : (isDisposed ? 'is-disposed' : 'is-loaned')} is-clickable" data-open-asset-tag="${escapeHtml(a.tag_id)}" title="คลิกดูรายละเอียด ${escapeHtml(displayModel)} (S/N: ${escapeHtml(a.serial_no || '-')})">
            <!-- Top Row: Tag ID + Location + Status -->
            <div class="asset-card-top-bar">
              <div class="asset-top-tags">
                <span class="asset-tag-code font-mono">${escapeHtml(a.tag_id)}</span>
                ${a.source && a.source !== 'Demo' ? `<span class="asset-source-badge ${sourceClass}">${escapeHtml(a.source)}</span>` : ''}
                ${displayLoc ? `<span class="asset-loc-pill" title="ที่เก็บ: ${escapeHtml(displayLoc)}">📍 ${escapeHtml(displayLoc)}</span>` : ''}
              </div>
              <div class="asset-top-status">
                ${isAvailable ? `
                  <span class="asset-status-badge avail">
                    <span class="status-dot green"></span>ว่าง
                  </span>
                ` : isDisposed ? `
                  <span class="asset-status-badge disposed" title="จำหน่ายออกเมื่อ ${formatShortDate(a.disposed_at)} (${escapeHtml(a.disposed_reason || '')})">
                    <span class="status-dot gray"></span>จำหน่ายแล้ว
                  </span>
                ` : `
                  <span class="asset-status-badge ${wf.pillCls}" title="${escapeHtml(wf.text)}: ${escapeHtml(a.active_loan?.borrower_name || '')}">
                    <span class="status-dot ${wf.dotCls}"></span>${escapeHtml(wf.text)}
                  </span>
                `}
              </div>
            </div>

            <!-- Hero Section: Model Name & Serial Number -->
            <div class="asset-hero-section">
              <div class="asset-model-hero" title="${escapeHtml(displayModel)}">
                ${escapeHtml(displayModel)}
              </div>
              <div class="asset-sn-hero" title="Serial Number (S/N)">
                <span class="sn-hero-label">S/N</span>
                <span class="sn-hero-value font-mono">${escapeHtml(a.serial_no || '-')}</span>
              </div>
            </div>

            <!-- Active Loan Info (Minimal 2-Row Bar) -->
            ${hasLoan ? `
              <div class="asset-loan-minimal-bar">
                <div class="loan-min-row-1">
                  <span class="loan-min-icon">👤</span>
                  <strong class="loan-min-borrower">${escapeHtml(a.active_loan.borrower_name || '-')}</strong>
                  <span class="loan-min-sep">·</span>
                  <span class="loan-min-customer">${escapeHtml(a.active_loan.customer_company || a.active_loan.customer_name || '-')}</span>
                </div>
                <div class="loan-min-row-2">
                  <span class="loan-min-due">คืน <strong>${formatShortDate(a.active_loan.due_date)}</strong></span>
                  <button type="button" class="doc-link-pill stock-loan-pill font-mono" data-open-loan="${escapeHtml(a.active_loan.id)}" title="เปิดใบยืม ${escapeHtml(a.active_loan.id)}">
                    <span>${escapeHtml(a.active_loan.id)}</span>
                    <svg class="doc-link-icon" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                      <polyline points="15 3 21 3 21 9"></polyline>
                      <line x1="10" y1="14" x2="21" y2="3"></line>
                    </svg>
                  </button>
                </div>
              </div>
            ` : ''}

            <!-- Disposed Asset Info (Minimal Bar) -->
            ${isDisposed ? `
              <div class="asset-disposed-minimal-bar">
                <div class="disposed-min-row">
                  <span class="disposed-min-icon">📦</span>
                  <span class="disposed-min-text">จำหน่าย: <strong>${formatShortDate(a.disposed_at)}</strong> · ${escapeHtml(a.disposed_reason || 'จำหน่ายออก')}</span>
                </div>
              </div>
            ` : ''}

            <!-- Subtle Accessories / Note (Optional single line for available assets) -->
            ${!hasLoan && !isDisposed && (accessories.length > 0 || a.free_note) ? `
              <div class="asset-acc-mini-line">
                ${accessories.length > 0 ? `
                  <span class="acc-mini-text" title="${escapeHtml(accessories.join(', '))}">
                    ⚡ ${escapeHtml(accessories.slice(0, 2).join(' · '))}${accessories.length > 2 ? ` +${accessories.length - 2}` : ''}
                  </span>
                ` : ''}
                ${a.free_note ? `
                  <span class="note-mini-text" title="${escapeHtml(a.free_note)}">
                    💬 ${escapeHtml(a.free_note)}
                  </span>
                ` : ''}
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      return `
        <div class="brand-group-block ${isCollapsed ? 'is-collapsed' : ''}" data-brand="${escapeHtml(brand)}">
          <div class="excel-brand-line-header" role="button" tabindex="0" title="คลิกเพื่อย่อ/ขยายกลุ่ม ${escapeHtml(brand)}">
            <div class="excel-outline-btn">
              <span class="excel-box-icon">
                <svg class="excel-minus-plus-svg" width="12" height="12" viewBox="0 0 12 12">
                  <line class="svg-h-bar" x1="2.5" y1="6" x2="9.5" y2="6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></line>
                  <line class="svg-v-bar" x1="6" y1="2.5" x2="6" y2="9.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"></line>
                </svg>
              </span>
            </div>
            <div class="brand-line-identity">
              <div class="brand-avatar-mini" style="background: ${brandMeta.gradient}; color: ${brandMeta.color};">
                ${brandMeta.initial}
              </div>
              <span class="brand-line-name">${escapeHtml(brand)}</span>
            </div>
            <div class="brand-col-cell col-total">
              <span class="brand-pill-mini total">${groupAssets.length}</span>
            </div>
            <div class="brand-col-cell col-avail">
              <span class="brand-pill-mini avail">${availCount}</span>
            </div>
            <div class="brand-col-cell col-loaned">
              ${loanedCount > 0 
                ? `<span class="brand-pill-mini loaned">${loanedCount}</span>` 
                : `<span class="brand-pill-mini loaned is-zero">0</span>`
              }
            </div>
          </div>
          <div class="excel-group-body">
            <div class="excel-tree-rail"></div>
            <div class="stock-cards-grid">
              ${cardsHtml}
            </div>
          </div>
        </div>
      `;
    })
    .join('');

  requestAnimationFrame(updateStockStickyOffsets);
}

function updateStockStickyOffsets() {
  const stockView = document.getElementById('stockView');
  const headerCard = document.querySelector('.stock-header-card');
  const sheetHeader = document.querySelector('.stock-sheet-header');
  if (!stockView || !headerCard) return;

  const headerH = headerCard.offsetHeight;
  if (headerH > 0) {
    stockView.style.setProperty('--stock-filter-h', `${headerH}px`);
  }

  if (sheetHeader) {
    const sheetH = sheetHeader.offsetHeight;
    if (sheetH > 0) {
      stockView.style.setProperty('--stock-sheet-th-h', `${sheetH}px`);
    }
  }
}
window.addEventListener('resize', updateStockStickyOffsets);

// ============================================================================
// CUSTOM TOUCH-FRIENDLY SELECT COMPONENT (PURPOSE & STATUS)
// ============================================================================
function updateCustomSelectUI(selectId) {
  const sel = document.getElementById(selectId);
  if (!sel) return;
  const val = sel.value;
  const triggerVal = document.getElementById(`${selectId}Display`);
  const menu = document.getElementById(`${selectId}Menu`);
  if (menu) {
    let matchText = '';
    menu.querySelectorAll('.custom-select-item').forEach(item => {
      const match = item.getAttribute('data-val') === val;
      item.classList.toggle('active', match);
      if (match) {
        const titleEl = item.querySelector('.item-title');
        matchText = titleEl ? titleEl.textContent.trim() : item.textContent.trim();
      }
    });
    if (triggerVal && matchText) {
      triggerVal.textContent = matchText;
    }
  }
}

function initCustomSelect(selectId) {
  const trigger = document.getElementById(`${selectId}Trigger`);
  const menu = document.getElementById(`${selectId}Menu`);
  const sel = document.getElementById(selectId);
  if (!trigger || !menu || !sel) return;

  trigger.addEventListener('click', e => {
    e.stopPropagation();
    const isHidden = menu.classList.contains('hidden');
    document.querySelectorAll('.custom-select-menu').forEach(m => m.classList.add('hidden'));
    document.querySelectorAll('.custom-select-trigger').forEach(t => t.setAttribute('aria-expanded', 'false'));
    if (isHidden) {
      menu.classList.remove('hidden');
      trigger.setAttribute('aria-expanded', 'true');
    }
  });

  menu.addEventListener('click', e => {
    const item = e.target.closest('.custom-select-item');
    if (!item) return;
    const val = item.getAttribute('data-val');
    sel.value = val;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    updateCustomSelectUI(selectId);
    menu.classList.add('hidden');
    trigger.setAttribute('aria-expanded', 'false');
  });
}

// ============================================================================
// 3-TIER CUSTOMER COMPANY AUTOCOMPLETE (Local -> Online DBD -> Custom Fallback)
// ============================================================================
function initCompanyAutocomplete() {
  const companyInput = document.getElementById('loanCompany');
  const dropdown = document.getElementById('companyDropdownMenu');
  const spinner = document.getElementById('companySearchSpinner');
  const btnToggleDropdown = document.getElementById('btnToggleCompanyDropdown');
  if (!companyInput || !dropdown) return;

  let debounceTimer = null;
  let activeIndex = -1;
  let currentResults = [];
  let searchSeq = 0;
  let isSelecting = false;
  let selectedCompanyValue = '';

  const closeDropdown = () => {
    searchSeq++; // Invalidate and discard any in-flight async searches
    clearTimeout(debounceTimer);
    dropdown.classList.add('hidden');
    dropdown.innerHTML = '';
    activeIndex = -1;
    currentResults = [];
    if (spinner) spinner.classList.add('hidden');
  };

  const renderDropdown = (results, query) => {
    if (isSelecting) return;
    const currentVal = (companyInput.value || '').trim();
    if (selectedCompanyValue && currentVal === selectedCompanyValue) {
      closeDropdown();
      return;
    }

    dropdown.innerHTML = '';
    currentResults = results || [];
    activeIndex = -1;

    const trimmedQuery = (query || '').trim();

    // If no query and no results, close
    if (!trimmedQuery && currentResults.length === 0) {
      closeDropdown();
      return;
    }

    // Header if showing recent / top customers
    if (!trimmedQuery) {
      const headerEl = document.createElement('div');
      headerEl.style.cssText = 'padding:6px 10px; font-size:11px; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:0.02em; border-bottom:1px solid #f1f5f9; display:flex; align-items:center; gap:5px;';
      headerEl.innerHTML = `<span>🏢 ลูกค้าที่ใช้งานบ่อย / ล่าสุด</span>`;
      dropdown.appendChild(headerEl);
    }

    // 1. Render matched results from local/DBD
    currentResults.forEach((item, idx) => {
      const itemEl = document.createElement('div');
      itemEl.className = 'company-item';
      itemEl.setAttribute('role', 'option');
      itemEl.dataset.index = idx;

      let badgeClass = 'badge-custom';
      let badgeText = 'ลูกค้า';
      let icon = '🏢';

      if (item.source === 'history') {
        badgeClass = 'badge-history';
        badgeText = 'ลูกค้าเดิม';
        icon = '🏢';
      } else if (item.source === 'dbd') {
        badgeClass = 'badge-dbd';
        badgeText = 'DBD นิติบุคคล';
        icon = '🌐';
      } else if (item.source === 'online') {
        badgeClass = 'badge-online';
        badgeText = '🌐 ภายนอก (Auto-Save)';
        icon = '🌐';
      }

      const subParts = [];
      if (item.source === 'online') {
        subParts.push('<span style="color:#7c3aed; font-weight:500;">ดึงจากฐานข้อมูลธุรกิจภายนอก • บันทึกอัตโนมัติเมื่อเลือก</span>');
      }
      if (item.name_en) {
        subParts.push(`<span class="company-item-en">${escapeHtml(item.name_en)}</span>`);
      }
      if (item.tax_id) {
        subParts.push(`<span class="company-item-tax" style="color:#0284c7; font-weight:500;">เลขภาษี: ${escapeHtml(item.tax_id)}</span>`);
      }
      if (item.contact_name || item.phone) {
        const contactInfo = [item.contact_name, item.phone].filter(Boolean).join(' ');
        subParts.push(`<span style="color:#64748b;">👤 ${escapeHtml(contactInfo)}</span>`);
      }
      const subInfo = subParts.length > 0 ? `<div class="company-item-sub">${subParts.join(' · ')}</div>` : '';

      itemEl.innerHTML = `
        <div class="company-item-main">
          <span class="company-item-icon">${icon}</span>
          <div class="company-item-text-group">
            <span class="company-item-name">${escapeHtml(item.name)}</span>
            ${subInfo}
          </div>
        </div>
        <span class="company-item-badge ${badgeClass}">${badgeText}</span>
      `;

      itemEl.addEventListener('mousedown', (e) => {
        // Prevent input blur and unexpected focus bounce
        e.preventDefault();
      });

      itemEl.addEventListener('click', (e) => {
        e.stopPropagation();
        isSelecting = true;
        selectedCompanyValue = item.name;
        closeDropdown();

        companyInput.value = item.name;
        syncClearableInputBtn(companyInput);

        // Autofill contact & phone if available and currently empty
        const customerInput = document.getElementById('loanCustomer');
        const phoneInput = document.getElementById('loanCustomerPhone');
        if (customerInput && !customerInput.value.trim() && item.contact_name) {
          customerInput.value = item.contact_name;
          syncClearableInputBtn(customerInput);
        }
        if (phoneInput && !phoneInput.value.trim() && item.phone) {
          phoneInput.value = item.phone;
          syncClearableInputBtn(phoneInput);
        }

        // If from external online lookup, automatically learn & save into Master Data!
        if (item.source === 'online') {
          fetch('/api/customers/learn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: item.name,
              name_en: item.name_en || '',
              tax_id: item.tax_id || '',
              branch: item.branch || 'สำนักงานใหญ่',
              address: item.address || ''
            })
          }).catch(() => {});
          showToast(`💾 บันทึก "${item.name}" เข้าสู่ระบบเรียบร้อย`);
        }

        updateTopInfoSummary();

        // Advance focus to next input field (Customer / Contact name if empty, or phone)
        if (customerInput && !customerInput.value.trim()) {
          customerInput.focus();
        } else if (phoneInput && !phoneInput.value.trim()) {
          phoneInput.focus();
        }

        setTimeout(() => {
          isSelecting = false;
        }, 500);
      });

      dropdown.appendChild(itemEl);
    });

    // 2. Fallback: Always allow selecting and auto-saving the custom typed name
    if (trimmedQuery && !currentResults.some(r => r.name.toLowerCase() === trimmedQuery.toLowerCase())) {
      const addNewEl = document.createElement('div');
      addNewEl.className = 'company-add-new-item';
      addNewEl.style.cssText = 'display:flex; align-items:center; gap:8px; padding:10px 12px; background:#eff6ff; border:1px dashed #93c5fd; border-radius:8px; cursor:pointer; color:#1d4ed8; font-size:13px; margin-top:4px;';
      addNewEl.innerHTML = `
        <span style="font-size:15px;">➕</span>
        <div style="min-width:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
          ใช้ชื่อใหม่: <strong>"${escapeHtml(trimmedQuery)}"</strong> <span style="font-size:11px; color:#2563eb; opacity:0.85;">(บันทึกอัตโนมัติ)</span>
        </div>
      `;
      addNewEl.addEventListener('mousedown', (e) => {
        e.preventDefault();
      });
      addNewEl.addEventListener('click', async (e) => {
        e.stopPropagation();
        isSelecting = true;
        selectedCompanyValue = trimmedQuery;
        closeDropdown();

        companyInput.value = trimmedQuery;
        syncClearableInputBtn(companyInput);
        updateTopInfoSummary();

        const customerInput = document.getElementById('loanCustomer');
        if (customerInput && !customerInput.value.trim()) {
          customerInput.focus();
        }

        setTimeout(() => {
          isSelecting = false;
        }, 500);

        // Auto-learn in background into Master Data customers
        try {
          const learnRes = await fetch('/api/customers/learn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: trimmedQuery })
          });
          const learnData = await learnRes.json();
          if (learnRes.ok && learnData.isNew) {
            showToast(`✨ บันทึก "${trimmedQuery}" เข้าสู่ข้อมูลหลักอัตโนมัติแล้ว`);
            window.updateMasterBadgeCounts?.();
          }
        } catch (_) {}
      });
      dropdown.appendChild(addNewEl);
    }

    if (!isSelecting) {
      dropdown.classList.remove('hidden');
    }
  };

  const fetchCompanies = async (q) => {
    if (isSelecting) return;
    const thisSearchSeq = ++searchSeq;
    if (spinner) spinner.classList.remove('hidden');
    try {
      const res = await fetch(`/api/customers/search?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (thisSearchSeq !== searchSeq) {
        // Obsolete search or closed dropdown - discard stale response immediately
        return;
      }
      if (spinner) spinner.classList.add('hidden');
      if (json.success && !isSelecting) {
        renderDropdown(json.results, q);
      }
    } catch {
      if (thisSearchSeq === searchSeq && spinner) spinner.classList.add('hidden');
    }
  };

  companyInput.addEventListener('input', () => {
    syncClearableInputBtn(companyInput);
    if (isSelecting) return;
    const q = companyInput.value.trim();
    if (q !== selectedCompanyValue) {
      selectedCompanyValue = '';
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!isSelecting && companyInput.value.trim() !== selectedCompanyValue) {
        fetchCompanies(companyInput.value.trim());
      }
    }, 180);
  });

  companyInput.addEventListener('focus', () => {
    if (isSelecting) return;
    const q = companyInput.value.trim();
    // If input already has a selected value, NEVER auto-open on focus!
    if (q && q === selectedCompanyValue) return;
    // Only search on focus if input is empty (to show recent customers), NOT when it already has text!
    if (!q) {
      fetchCompanies('');
    }
  });

  // Dropdown toggle arrow button (GEMINI.md Rule 1)
  btnToggleDropdown?.addEventListener('click', (e) => {
    e.stopPropagation();
    if (!dropdown.classList.contains('hidden')) {
      closeDropdown();
    } else {
      isSelecting = false;
      selectedCompanyValue = ''; // Allow forced viewing of full list
      fetchCompanies(companyInput.value.trim());
      companyInput.focus();
    }
  });

  // Quick clear button (✕) resets selected state
  const clearBtn = companyInput.closest('.input-clearable-wrap')?.querySelector('.btn-input-clear');
  clearBtn?.addEventListener('click', () => {
    selectedCompanyValue = '';
    closeDropdown();
  });

  companyInput.addEventListener('keydown', (e) => {
    if (dropdown.classList.contains('hidden')) return;
    const items = dropdown.querySelectorAll('.company-item, .company-add-new-item');
    if (!items.length) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      activeIndex = (activeIndex + 1) % items.length;
      items.forEach((it, i) => it.classList.toggle('is-selected', i === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      activeIndex = (activeIndex - 1 + items.length) % items.length;
      items.forEach((it, i) => it.classList.toggle('is-selected', i === activeIndex));
      items[activeIndex]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && items[activeIndex]) {
        e.preventDefault();
        items[activeIndex].click();
      } else {
        closeDropdown();
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('.company-field-group')) {
      closeDropdown();
    }
  });
}

// ============================================================================
// TOP INFO COLLAPSIBLE ACCORDION
// ============================================================================
function updateTopInfoSummary() {
  const borrower = (document.getElementById('loanBorrower')?.value || '').trim();
  const company = (document.getElementById('loanCompany')?.value || '').trim();
  const customer = (document.getElementById('loanCustomer')?.value || '').trim();
  const phone = (document.getElementById('loanCustomerPhone')?.value || '').trim();
  const dueDate = document.getElementById('loanDueDate')?.value || '';

  const headlineEl = document.getElementById('topInfoHeadline');
  const subEl = document.getElementById('topInfoSub');
  const badgeEl = document.getElementById('topInfoBadge');
  const drawer = document.getElementById('loanTopDrawer');
  const isExpanded = drawer && !drawer.classList.contains('hidden');

  if (headlineEl) {
    if (borrower) {
      headlineEl.textContent = `${borrower}${company ? ` · ${company}` : ''}`;
    } else {
      headlineEl.textContent = 'ผู้ยืม & ลูกค้า';
    }
  }

  if (subEl) {
    const formattedDue = dueDate ? formatShortDate(dueDate) : '7 วัน';
    if (borrower) {
      const parts = [];
      if (customer) parts.push(customer);
      if (phone) parts.push(phone);
      parts.push(`คืน ${formattedDue}`);
      subEl.textContent = parts.join(' · ');
    } else {
      subEl.textContent = `ยังไม่ระบุ · คืน ${formattedDue}`;
    }
  }

  if (badgeEl) {
    if (isExpanded) {
      badgeEl.textContent = 'ย่อเก็บ ▴';
      badgeEl.classList.add('is-expanded');
    } else {
      badgeEl.textContent = borrower ? 'แก้ไข ▾' : 'ระบุข้อมูล ▾';
      badgeEl.classList.remove('is-expanded');
    }
  }
}

function collapseTopInfoDrawer() {
  const drawer = document.getElementById('loanTopDrawer');
  const trigger = document.getElementById('btnToggleTopInfo');
  const accordion = document.getElementById('loanTopAccordion');
  if (drawer) drawer.classList.add('hidden');
  if (trigger) trigger.setAttribute('aria-expanded', 'false');
  if (accordion) accordion.classList.remove('is-open');
  updateTopInfoSummary();
}

function expandTopInfoDrawer() {
  const drawer = document.getElementById('loanTopDrawer');
  const trigger = document.getElementById('btnToggleTopInfo');
  const accordion = document.getElementById('loanTopAccordion');
  if (drawer) drawer.classList.remove('hidden');
  if (trigger) trigger.setAttribute('aria-expanded', 'true');
  if (accordion) accordion.classList.add('is-open');
  updateTopInfoSummary();
}

// ============================================================================
// MODAL 1: CREATE OR EDIT LOAN (IN-LINE EXCEL-LIKE EDITING — MODEL & TAGS)
// ============================================================================
function openCreateLoanModal(updateHash = true) {
  if (!can('create_loan') && !state.editingLoanId) {
    showToast('⚠️ คุณไม่มีสิทธิ์ออกใบยืมสินค้า');
    return;
  }
  if (updateHash) updateUrlHash('modal', 'create');
  state.editingLoanId = null;
  state.editingLoanNoteOnly = false;

  const loanDialog = document.getElementById('loanDialog');
  if (loanDialog) {
    loanDialog.classList.remove('mode-note-only');
  }
  document.getElementById('loanNoteOnlyBanner')?.classList.add('hidden');

  // Ensure top info inputs are unlocked
  ['loanBorrower', 'loanCustomer', 'loanCustomerPhone', 'loanCompany'].forEach(inpId => {
    const el = document.getElementById(inpId);
    if (el) {
      el.readOnly = false;
      el.classList.remove('is-locked');
    }
  });

  const submitBtns = document.querySelectorAll('#loanForm button[type="submit"]');
  submitBtns.forEach(btn => {
    const span = btn.querySelector('span') || btn;
    span.textContent = 'ออกใบยืมสินค้า';
  });

  document.getElementById('loanDialogTitle').textContent = 'ออกใบยืมสินค้า';
  document.getElementById('btnLoanEditPrintPass')?.classList.add('hidden');

  const btnCancelEdit = document.getElementById('btnCancelLoanFromEdit');
  if (btnCancelEdit) {
    btnCancelEdit.classList.add('hidden');
    btnCancelEdit.removeAttribute('data-cancel-loan');
  }

  const defaultBorrower = state.currentUser?.name || '';
  const borrowerInput = document.getElementById('loanBorrower');
  if (borrowerInput) {
    borrowerInput.value = defaultBorrower;
    const clearBtn = borrowerInput.closest('.input-clearable-wrap')?.querySelector('.btn-input-clear');
    if (clearBtn) clearBtn.classList.toggle('hidden', !defaultBorrower);
  }
  document.getElementById('loanCustomer').value = '';
  document.getElementById('loanCustomerPhone').value = '';
  document.getElementById('loanCompany').value = '';
  document.getElementById('loanPurpose').value = 'Demo';
  document.getElementById('loanInitialStatus').value = 'Requested';
  updateCustomSelectUI('loanPurpose');
  updateCustomSelectUI('loanInitialStatus');

  const today = state.today || new Date().toISOString().slice(0, 10);
  document.getElementById('loanCheckoutDate').value = today;
  setDueDatePlusDays(7);

  // Collapse top info drawer by default so user directly sees the model input
  collapseTopInfoDrawer();
  updateTopInfoSummary();

  // Start with 1 empty row ready for typing (no accessories preloaded, empty list)
  state.activeLoanRowIdx = 0;
  state.loanDraftRows = [
    { brand: '', model: '', qty: 1, source: 'Demo', accessories: [], free_note: '', serials: [], attachments: [] }
  ];

  renderLoanExcelRows();

  document.getElementById('loanDialog').showModal();
  setTimeout(() => {
    const firstInput = document.querySelector('[data-excel-model-input="0"]');
    if (firstInput && !isTouchOrMobileDevice()) firstInput.focus();
  }, 100);
}

function isAssetMatchingModel(asset, brand, model) {
  if (!model) return false;
  const targetModel = String(model || '').trim().toLowerCase();
  const targetBrand = String(brand || '').trim().toLowerCase();

  const assetModel = String(asset.model || '').trim().toLowerCase();
  const assetBrand = String(asset.brand || '').trim().toLowerCase();
  const assetFull = `${assetBrand} ${assetModel}`.trim().toLowerCase();

  if (targetBrand && assetBrand && targetBrand !== assetBrand) {
    return false;
  }

  if (assetModel === targetModel) return true;
  if (assetFull === targetModel) return true;

  if (targetBrand && targetModel.startsWith(targetBrand)) {
    const stripped = targetModel.slice(targetBrand.length).trim();
    if (assetModel === stripped) return true;
  }
  if (assetBrand && targetModel.startsWith(assetBrand)) {
    const stripped = targetModel.slice(assetBrand.length).trim();
    if (assetModel === stripped) return true;
  }

  return false;
}

function getAvailableSnOptions(brand, model) {
  if (!model) return [];
  return (state.assets || []).filter(a => {
    return a.status === 'Available' && isAssetMatchingModel(a, brand, model);
  });
}

function findDemoAssetBySn(sn, brand, model) {
  if (!sn) return null;
  const target = String(sn).trim().toLowerCase();
  const brandTrim = String(brand || '').trim();
  const modelTrim = String(model || '').trim();

  return (state.assets || []).find(a => {
    const aSource = String(a.source || a.Source || 'Demo').trim().toLowerCase();
    if (aSource !== 'demo') return false;
    const aSn = String(a.serial_no || a.serialNo || '').trim().toLowerCase();
    const aTag = String(a.tag_id || a.tagId || '').trim().toLowerCase();
    if (aSn !== target && aTag !== target) return false;

    if (modelTrim && !isAssetMatchingModel(a, brandTrim, modelTrim)) {
      return false;
    }
    return true;
  });
}

function openEditLoanModal(loanId, updateHash = true) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) return;

  const isDeliveredStage = ['Delivered', 'Partially_Returned', 'Returned'].includes(loan.status);
  const isFullEditable = ['Requested', 'Dispatching', 'Dispatched'].includes(loan.status);

  if (!isFullEditable && !isDeliveredStage) {
    showToast('🔒 ใบยืมในสถานะนี้ไม่สามารถแก้ไขได้');
    return;
  }

  if (updateHash) updateUrlHash('modal', `edit-${loan.id}`);
  state.editingLoanId = loan.id;
  state.editingLoanNoteOnly = isDeliveredStage;

  const loanDialog = document.getElementById('loanDialog');
  if (loanDialog) {
    loanDialog.classList.toggle('mode-note-only', isDeliveredStage);
  }

  const titleEl = document.getElementById('loanDialogTitle');
  if (titleEl) {
    titleEl.textContent = isDeliveredStage
      ? `แก้ไขหมายเหตุใบยืม ${loan.id} (ส่งมอบแล้ว)`
      : `แก้ไขใบยืม ${loan.id}`;
  }
  document.getElementById('btnLoanEditPrintPass')?.classList.remove('hidden');

  const btnCancelEdit = document.getElementById('btnCancelLoanFromEdit');
  if (btnCancelEdit) {
    if (isFullEditable && ['Requested', 'Dispatching', 'Dispatched'].includes(loan.status)) {
      btnCancelEdit.classList.remove('hidden');
      btnCancelEdit.setAttribute('data-cancel-loan', loan.id);
    } else {
      btnCancelEdit.classList.add('hidden');
    }
  }

  // Update submit button labels
  const submitBtns = document.querySelectorAll('#loanForm button[type="submit"]');
  submitBtns.forEach(btn => {
    const span = btn.querySelector('span') || btn;
    if (isDeliveredStage) {
      span.textContent = 'บันทึกหมายเหตุ';
    } else {
      span.textContent = 'บันทึกการแก้ไข';
    }
  });

  // Lock/Unlock top info inputs for note-only mode
  ['loanBorrower', 'loanCustomer', 'loanCustomerPhone', 'loanCompany'].forEach(inpId => {
    const el = document.getElementById(inpId);
    if (el) {
      el.readOnly = isDeliveredStage;
      el.classList.toggle('is-locked', isDeliveredStage);
    }
  });

  document.getElementById('loanBorrower').value = loan.borrower_name || '';
  document.getElementById('loanCustomer').value = loan.customer_name || '';
  document.getElementById('loanCustomerPhone').value = loan.customer_phone || loan.borrower_phone || '';
  document.getElementById('loanCompany').value = loan.customer_company || '';
  document.getElementById('loanPurpose').value = loan.purpose || 'Demo';
  document.getElementById('loanInitialStatus').value = loan.status;
  updateCustomSelectUI('loanPurpose');
  updateCustomSelectUI('loanInitialStatus');
  document.getElementById('loanCheckoutDate').value = (loan.checkout_date || state.today).slice(0, 10);
  document.getElementById('loanDueDate').value = (loan.due_date || state.today).slice(0, 10);
  updateAgodaDateDisplay();

  const noteBanner = document.getElementById('loanNoteOnlyBanner');
  if (noteBanner) {
    noteBanner.classList.toggle('hidden', !isDeliveredStage);
  }

  if (isDeliveredStage) {
    // Delivered: each item keeps its distinct row & ID for individual note editing
    state.loanDraftRows = (loan.items || []).map(it => ({
      id: it.id,
      brand: it.brand || '',
      model: it.model || '',
      qty: 1,
      source: it.source_snapshot || 'Demo',
      accessories: [...(it.loan_accessories || [])],
      free_note: it.loan_free_note || '',
      attachments: [...(it.attachments || [])],
      serials: it.serial_no ? [it.serial_no] : []
    }));
  } else {
    // Group identical model rows when editing a pre-dispatch or dispatched loan
    const grouped = [];
    for (const it of loan.items || []) {
      const accStr = JSON.stringify(it.loan_accessories || []);
      const attStr = JSON.stringify(it.attachments || []);
      const existing = grouped.find(
        g =>
          g.brand === (it.brand || '') &&
          g.model === (it.model || '') &&
          g.source === (it.source_snapshot || 'Demo') &&
          g.free_note === (it.loan_free_note || '') &&
          JSON.stringify(g.accessories) === accStr &&
          JSON.stringify(g.attachments || []) === attStr
      );
      if (existing) {
        existing.qty += 1;
        if (it.serial_no) {
          if (!existing.serials) existing.serials = [];
          existing.serials.push(it.serial_no);
        }
      } else {
        grouped.push({
          id: it.id,
          brand: it.brand || '',
          model: it.model || '',
          qty: 1,
          source: it.source_snapshot || 'Demo',
          accessories: [...(it.loan_accessories || [])],
          free_note: it.loan_free_note || '',
          attachments: [...(it.attachments || [])],
          serials: it.serial_no ? [it.serial_no] : []
        });
      }
    }
    state.loanDraftRows =
      grouped.length > 0
        ? grouped
        : [{ brand: '', model: '', qty: 1, source: 'Demo', accessories: [], free_note: '', serials: [], attachments: [] }];
  }

  // Ensure trailing empty row is present for seamless adding
  ensureTrailingEmptyRow();

  collapseTopInfoDrawer();
  updateTopInfoSummary();

  renderLoanExcelRows();
  document.getElementById('loanDialog').showModal();
  setTimeout(() => {
    const firstInput = document.querySelector('[data-excel-model-input="0"]');
    if (firstInput && !isTouchOrMobileDevice()) firstInput.focus();
  }, 100);
}

function ensureTrailingEmptyRow() {
  if (state.editingLoanNoteOnly) return;
  const lastRow = state.loanDraftRows[state.loanDraftRows.length - 1];
  if (!lastRow || lastRow.model.trim() !== '') {
    state.loanDraftRows.push({
      brand: '',
      model: '',
      qty: 1,
      source: 'Demo',
      accessories: [],
      free_note: '',
      serials: [],
      attachments: []
    });
  }
}

state.activeSnModalRowIdx = null;

function closeSnDropdown() {
  const dropdown = document.getElementById('snModalDropdownMenu');
  if (dropdown) dropdown.classList.add('hidden');
}

function renderSnDropdown(slotIdx, query = '') {
  const dropdown = document.getElementById('snModalDropdownMenu');
  if (!dropdown) return;

  const targetInput = document.querySelector(`[data-sn-modal-idx="${slotIdx}"]`);
  if (!targetInput) return;

  const row = state.loanDraftRows[state.activeSnModalRowIdx];
  if (!row) return;

  // ถ้าระบุคลังอื่นที่ไม่ใช่ Demo (เช่น Supplier, คลังขาย) ไม่ต้องมี list แนะนำ S/N ขึ้นมา
  const isDemo = String(row.source || 'Demo').trim().toLowerCase() === 'demo';
  if (!isDemo) {
    closeSnDropdown();
    return;
  }

  const q = String(query || '').trim().toLowerCase();
  const modelName = String(row.model || '').trim().toLowerCase();
  const brandName = String(row.brand || '').trim().toLowerCase();

  // Get currently selected S/Ns in other slots of this modal to mark as selected/disabled
  const otherSlotInputs = Array.from(document.querySelectorAll('.sn-modal-slot-input'));
  const pickedSerials = new Set();
  otherSlotInputs.forEach((inp, idx) => {
    if (idx !== slotIdx && inp.value.trim()) {
      pickedSerials.add(inp.value.trim().toLowerCase());
    }
  });

  // Assets strictly matching model/brand from Demo warehouse
  let pool = (state.assets || []).filter(a => {
    const isAvail = (a.status === 'Available');
    if (!isAvail) return false;
    const isAssetDemo = String(a.source || 'Demo').trim().toLowerCase() === 'demo';
    if (!isAssetDemo) return false;
    if (!modelName) return false;
    return isAssetMatchingModel(a, brandName, modelName);
  });

  // Filter by query if user typed search characters
  let filtered = pool;
  if (q) {
    filtered = pool.filter(a => {
      const hay = `${a.serial_no || ''} ${a.tag_id || ''} ${a.location || ''} ${a.source || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }

  if (pool.length === 0) {
    const displayModel = row.model || 'ที่เลือก';
    dropdown.innerHTML = `<div class="model-dropdown-empty">ไม่มี S/N ว่างในคลัง Demo สำหรับรุ่น "${escapeHtml(displayModel)}" (สามารถพิมพ์ระบุเองได้)</div>`;
  } else if (filtered.length === 0) {
    dropdown.innerHTML = `<div class="model-dropdown-empty">ไม่พบ S/N ของรุ่น "${escapeHtml(row.model)}" ที่ตรงกับ "${escapeHtml(query)}" (กด Enter เพื่อใช้ค่านี้)</div>`;
  } else {
    let itemsHtml = '';
    filtered.forEach(a => {
      const snVal = a.serial_no || a.tag_id;
      const isAlreadyPicked = pickedSerials.has(snVal.toLowerCase());
      itemsHtml += `
        <div
          class="model-dropdown-item ${isAlreadyPicked ? 'disabled' : ''}"
          data-select-modal-sn="${escapeHtml(snVal)}"
          data-slot-idx="${slotIdx}"
          title="${isAlreadyPicked ? 'S/N นี้ถูกเลือกในช่องอื่นแล้ว' : 'แตะเพื่อเลือก S/N นี้'}"
        >
          <div class="model-item-main">
            <span class="model-item-name">🏷️ ${escapeHtml(snVal)}</span>
            <span class="model-item-sub">${escapeHtml(a.tag_id)} · คลัง: ${escapeHtml(a.source || 'Demo')} · ที่เก็บ: ${escapeHtml(a.location || '-')}</span>
          </div>
          <span class="model-count-box count-full" title="ว่าง พร้อมให้ยืม">ว่าง</span>
        </div>
      `;
    });

    dropdown.innerHTML = `
      <div class="dropdown-scroll-arrow top-arrow hidden" title="เลื่อนขึ้น">▲</div>
      <div class="dropdown-scroll-list">
        ${itemsHtml}
      </div>
      <div class="dropdown-scroll-arrow bottom-arrow" title="เลื่อนลง">▼</div>
    `;
    setupDropdownScrollArrows(dropdown);
  }

  // Position dropdown relative to snModalDialog (Always downwards below the slot)
  const dialog = document.getElementById('snModalDialog');
  const slotRow = targetInput.closest('.sn-modal-slot-row') || targetInput;
  if (dialog && slotRow) {
    const slotRect = slotRow.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();

    dropdown.style.setProperty('position', 'absolute', 'important');
    dropdown.style.setProperty('left', `${slotRect.left - dialogRect.left}px`, 'important');
    dropdown.style.setProperty('width', `${slotRect.width}px`, 'important');
    dropdown.style.setProperty('right', 'auto', 'important');

    // Always open DOWNWARDS below the input slot as requested
    dropdown.style.setProperty('top', `${slotRect.bottom - dialogRect.top + 6}px`, 'important');
    dropdown.style.setProperty('bottom', 'auto', 'important');

    // Calculate maximum available height downwards - maximize space utilization down to viewport bottom
    const availableBelow = Math.max(180, Math.floor(window.innerHeight - slotRect.bottom - 20));
    dropdown.style.setProperty('max-height', `${availableBelow}px`, 'important');
  }

  dropdown.classList.remove('hidden');
}

function openSnModal(rowIdx) {
  const row = state.loanDraftRows[rowIdx];
  if (!row) return;

  closeSnDropdown();
  state.activeSnModalRowIdx = rowIdx;
  const rowQty = Math.max(1, Number(row.qty || 1));
  const hasModel = Boolean(row.model && row.model.trim());
  let modelName = '';
  if (hasModel) {
    if (row.brand && row.model.toLowerCase().startsWith(row.brand.toLowerCase())) {
      modelName = row.model;
    } else if (row.brand) {
      modelName = `${row.brand} ${row.model}`;
    } else {
      modelName = row.model;
    }
  }
  const isDemo = String(row.source || 'Demo').trim().toLowerCase() === 'demo';

  const titleEl = document.getElementById('snModalTitle');
  const subEl = document.getElementById('snModalSubtitle');
  if (titleEl) {
    titleEl.textContent = rowQty > 1 ? `ระบุ S/N (${rowQty})` : 'ระบุ S/N';
  }
  if (subEl) {
    const sourceVal = row.source || 'Demo';
    if (hasModel) {
      subEl.innerHTML = `<span class="sn-sub-model">${escapeHtml(modelName)}</span><span class="sn-sub-source-pill">${escapeHtml(sourceVal)}</span>`;
    } else {
      subEl.innerHTML = `<span class="sn-sub-source-pill">${escapeHtml(sourceVal)}</span>`;
    }
  }

  const alertEl = document.getElementById('snModalAlert');
  if (alertEl) {
    alertEl.classList.add('hidden');
    alertEl.textContent = '';
  }

  // Populate slots for rowQty
  const container = document.getElementById('snModalSlotsList');
  if (container) {
    const currentSerials = row.serials || [];
    let slotsHtml = '';
    for (let snIdx = 0; snIdx < rowQty; snIdx++) {
      const curVal = currentSerials[snIdx] || '';
      slotsHtml += `
        <div class="sn-modal-slot-row">
          <span class="sn-slot-num">#${snIdx + 1}</span>
          <input
            type="text"
            class="sn-modal-slot-input"
            placeholder="สแกน / พิมพ์ S/N..."
            value="${escapeHtml(curVal)}"
            data-sn-modal-idx="${snIdx}"
            data-confirmed-sn="${escapeHtml(curVal)}"
            autocomplete="off"
          />
          <button type="button" class="btn-clear-sn-slot ${curVal ? '' : 'hidden'}" data-clear-modal-slot="${snIdx}" title="ล้าง S/N">✕</button>
          ${isDemo ? `<button type="button" class="btn-sn-slot-arrow" data-toggle-sn-slot="${snIdx}" title="เลือกจากรายการ">▾</button>` : ''}
        </div>
      `;
    }
    container.innerHTML = slotsHtml;
  }

  const dialog = document.getElementById('snModalDialog');
  if (dialog) dialog.showModal();

  setTimeout(() => {
    const firstInput = container ? container.querySelector('.sn-modal-slot-input') : null;
    if (firstInput && !isTouchOrMobileDevice()) {
      firstInput.focus();
    }
    closeSnDropdown();
  }, 120);
}

state.activeAccModalRowIdx = null;
state.tempAccList = [];

function openAccModal(rowIdx) {
  const row = state.loanDraftRows[rowIdx];
  if (!row) return;

  state.activeAccModalRowIdx = rowIdx;
  state.tempAccList = [...(row.accessories || [])];

  const modelName = row.model ? (row.brand ? `${row.brand} ${row.model}` : row.model) : `รายการที่ ${rowIdx + 1}`;
  const titleEl = document.getElementById('accModalTitle');
  const subEl = document.getElementById('accModalSubtitle');
  if (titleEl) titleEl.textContent = 'อุปกรณ์เสริม';
  if (subEl) subEl.textContent = modelName;

  const customInp = document.getElementById('accModalCustomInput');
  if (customInp) customInp.value = '';

  renderAccModalBody();

  const dialog = document.getElementById('accModalDialog');
  if (dialog) dialog.showModal();
}

function renderAccModalBody() {
  const selectedList = document.getElementById('accModalSelectedList');
  const countEl = document.getElementById('accModalSelectedCount');
  if (countEl) countEl.textContent = state.tempAccList.length;

  if (selectedList) {
    if (state.tempAccList.length === 0) {
      selectedList.innerHTML = `<span class="acc-modal-empty-hint">ยังไม่ได้เลือก</span>`;
    } else {
      selectedList.innerHTML = state.tempAccList.map((tag, idx) => `
        <span class="acc-tag-pill active">
          <span class="tag-name">✓ ${escapeHtml(tag)}</span>
          <button type="button" class="btn-rm-acc-tag" data-acc-temp-rm="${idx}" title="ลบออก">✕</button>
        </span>
      `).join('');
    }
  }

  const suggList = document.getElementById('accModalSuggestionsList');
  if (suggList) {
    const selectedSet = new Set(state.tempAccList);
    suggList.innerHTML = (state.accessorySuggestions || []).map(s => {
      const isSelected = selectedSet.has(s);
      return `
        <button type="button" class="acc-quick-btn ${isSelected ? 'selected' : ''}" data-toggle-sugg="${escapeHtml(s)}">
          <span class="icon">${isSelected ? '✓' : '＋'}</span>
          <span class="name">${escapeHtml(s)}</span>
        </button>
      `;
    }).join('');
  }
}

function matchCatalogModel(text) {
  const q = String(text || '').trim().toLowerCase();
  if (!q) return null;
  // 1. Exact match "Brand Model" or "Model"
  let match = state.catalogs.find(
    c =>
      `${c.brand} ${c.model}`.toLowerCase() === q ||
      c.model.toLowerCase() === q
  );
  if (match) return match;

  // 2. Starts with / includes
  match = state.catalogs.find(
    c =>
      `${c.brand} ${c.model}`.toLowerCase().startsWith(q) ||
      c.model.toLowerCase().startsWith(q)
  );
  if (match) return match;

  return state.catalogs.find(
    c =>
      `${c.brand} ${c.model}`.toLowerCase().includes(q) ||
      c.model.toLowerCase().includes(q)
  );
}

function setDueDatePlusDays(days) {
  const startStr = document.getElementById('loanCheckoutDate').value || state.today || new Date().toISOString().slice(0, 10);
  const dt = new Date(startStr + 'T00:00:00');
  dt.setDate(dt.getDate() + Number(days));
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  document.getElementById('loanDueDate').value = `${y}-${m}-${d}`;
  updateAgodaDateDisplay();
}

// ============================================================================
// AGODA-STYLE DATE RANGE PICKER (ช่วงวันที่ยืม - กำหนดคืน)
// ============================================================================
function formatDisplayDateThai(isoStr) {
  if (!isoStr) return '-';
  const parts = String(isoStr).split('-');
  if (parts.length !== 3) return isoStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function getDayOfWeekThai(isoStr) {
  if (!isoStr) return '';
  const days = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
  const dt = new Date(isoStr + 'T00:00:00');
  return isNaN(dt.getTime()) ? '' : days[dt.getDay()];
}

function getDayOfWeekShortThai(isoStr) {
  if (!isoStr) return '';
  const days = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const dt = new Date(isoStr + 'T00:00:00');
  return isNaN(dt.getTime()) ? '' : days[dt.getDay()];
}

function getDaysDiff(startStr, endStr) {
  if (!startStr || !endStr) return 0;
  const d1 = new Date(startStr + 'T00:00:00');
  const d2 = new Date(endStr + 'T00:00:00');
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) return 0;
  const diffTime = d2.getTime() - d1.getTime();
  return Math.max(0, Math.round(diffTime / (1000 * 60 * 60 * 24)));
}

function updateAgodaDateDisplay() {
  const checkoutInput = document.getElementById('loanCheckoutDate');
  const dueInput = document.getElementById('loanDueDate');
  if (!checkoutInput || !dueInput) return;

  const startStr = checkoutInput.value || state.today || new Date().toISOString().slice(0, 10);
  const endStr = dueInput.value || startStr;

  const startEl = document.getElementById('agodaDisplayCheckout');
  const startDayEl = document.getElementById('agodaDisplayCheckoutDay');
  const dueEl = document.getElementById('agodaDisplayDue');
  const dueDayEl = document.getElementById('agodaDisplayDueDay');
  const daysPillEl = document.getElementById('agodaDisplayDaysPill');

  if (startEl) startEl.textContent = formatDisplayDateThai(startStr);
  if (startDayEl) startDayEl.textContent = getDayOfWeekThai(startStr);
  if (dueEl) dueEl.textContent = formatDisplayDateThai(endStr);
  if (dueDayEl) dueDayEl.textContent = getDayOfWeekThai(endStr);

  const diff = getDaysDiff(startStr, endStr);
  if (daysPillEl) {
    const daysCount = diff === 0 ? 1 : diff;
    daysPillEl.textContent = `${daysCount} วัน`;
    daysPillEl.style.display = 'inline-block';
  }

  updateTopInfoSummary();
}

let agodaCalYear = 2026;
let agodaCalMonth = 10; // 0-based
let agodaTempStart = null;
let agodaTempEnd = null;
let agodaHoverDate = null;
let agodaPickingStage = 'start'; // 'start' | 'end'
let agodaDragState = {
  isDragging: false,
  handle: null, // 'start' | 'end' | 'both'
  pointerId: null,
  startX: 0,
  startY: 0,
  originDate: null
};
let justFinishedAgodaDrag = false;

function openAgodaDateRangeModal(stage = 'start') {
  const checkoutVal = document.getElementById('loanCheckoutDate')?.value || state.today || new Date().toISOString().slice(0, 10);
  const dueVal = document.getElementById('loanDueDate')?.value || checkoutVal;

  agodaTempStart = checkoutVal;
  agodaTempEnd = dueVal;
  agodaHoverDate = null;
  agodaPickingStage = (stage === 'end') ? 'end' : 'start';

  const targetDateStr = (agodaPickingStage === 'end' && dueVal) ? dueVal : checkoutVal;
  const targetDateObj = new Date(targetDateStr + 'T00:00:00');
  agodaCalYear = isNaN(targetDateObj.getFullYear()) ? 2026 : targetDateObj.getFullYear();
  agodaCalMonth = isNaN(targetDateObj.getMonth()) ? 10 : targetDateObj.getMonth();

  renderAgodaCalendar();

  const dialog = document.getElementById('agodaDateRangeDialog');
  if (dialog) dialog.showModal();
}

function closeAgodaDateRangeModal() {
  const dialog = document.getElementById('agodaDateRangeDialog');
  if (dialog) dialog.close();
}

function renderAgodaCalendar() {
  const monthLabel = document.getElementById('agodaMonthLabel');
  if (monthLabel) {
    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    monthLabel.textContent = `${thaiMonths[agodaCalMonth]} ${agodaCalYear}`;
  }

  const startValEl = document.getElementById('agodaModalStartVal');
  const endValEl = document.getElementById('agodaModalEndVal');
  const durTextEl = document.getElementById('agodaModalDurationText');
  const boxStart = document.getElementById('agodaBoxStart');
  const boxEnd = document.getElementById('agodaBoxEnd');

  if (startValEl) {
    startValEl.textContent = agodaTempStart ? `${formatDisplayDateThai(agodaTempStart)} (${getDayOfWeekShortThai(agodaTempStart)})` : '—';
  }
  if (endValEl) {
    endValEl.textContent = agodaTempEnd ? `${formatDisplayDateThai(agodaTempEnd)} (${getDayOfWeekShortThai(agodaTempEnd)})` : '—';
  }

  if (boxStart && boxEnd) {
    boxStart.classList.toggle('is-picking', agodaPickingStage === 'start');
    boxEnd.classList.toggle('is-picking', agodaPickingStage === 'end');
  }

  if (durTextEl) {
    if (agodaTempStart && agodaTempEnd) {
      const diff = getDaysDiff(agodaTempStart, agodaTempEnd);
      durTextEl.textContent = diff === 0 ? '1 วัน' : `${diff} วัน`;
    } else if (agodaTempStart) {
      durTextEl.textContent = 'เลือกวันคืน ➔';
    } else {
      durTextEl.textContent = '➔';
    }
  }

  const grid = document.getElementById('agodaDaysGrid');
  if (!grid) return;
  grid.innerHTML = '';

  const firstDayIndex = new Date(agodaCalYear, agodaCalMonth, 1).getDay();
  const daysInMonth = new Date(agodaCalYear, agodaCalMonth + 1, 0).getDate();
  const todayStr = state.today || new Date().toISOString().slice(0, 10);

  // Blank days before the 1st
  for (let i = 0; i < firstDayIndex; i++) {
    const emptyCell = document.createElement('div');
    emptyCell.className = 'agoda-day-cell is-empty';
    grid.appendChild(emptyCell);
  }

  const effectiveEnd = agodaTempEnd || (agodaPickingStage === 'end' ? agodaHoverDate : null);

  for (let day = 1; day <= daysInMonth; day++) {
    const mm = String(agodaCalMonth + 1).padStart(2, '0');
    const dd = String(day).padStart(2, '0');
    const dateStr = `${agodaCalYear}-${mm}-${dd}`;

    const cell = document.createElement('div');
    cell.className = 'agoda-day-cell';
    cell.setAttribute('data-date', dateStr);

    const isStart = (agodaTempStart === dateStr);
    const isEnd = (effectiveEnd === dateStr);
    const isInRange = (agodaTempStart && effectiveEnd && dateStr > agodaTempStart && dateStr < effectiveEnd);
    const isToday = (todayStr === dateStr);

    if (isStart) cell.classList.add('is-range-start');
    if (isEnd) cell.classList.add('is-range-end');
    if (isInRange) {
      if (agodaTempEnd) {
        cell.classList.add('is-in-range');
      } else {
        cell.classList.add('is-hover-range');
      }
    }
    if (isToday) cell.classList.add('is-today');

    cell.innerHTML = `<span class="day-inner">${day}</span>`;

    // Pointer-based drag to adjust loan start or end date
    cell.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      const isStart = (agodaTempStart === dateStr);
      const isEnd = (agodaTempEnd === dateStr);

      if (isStart || isEnd) {
        agodaDragState.isDragging = false;
        agodaDragState.handle = (isStart && isEnd) ? 'both' : (isStart ? 'start' : 'end');
        agodaDragState.pointerId = e.pointerId;
        agodaDragState.startX = e.clientX;
        agodaDragState.startY = e.clientY;
        agodaDragState.originDate = dateStr;

        try {
          cell.setPointerCapture(e.pointerId);
        } catch (err) {}
      }
    });

    cell.addEventListener('pointermove', (e) => {
      if (!agodaDragState.handle || agodaDragState.pointerId !== e.pointerId) return;

      const dist = Math.hypot(e.clientX - agodaDragState.startX, e.clientY - agodaDragState.startY);
      if (dist > 4) {
        agodaDragState.isDragging = true;
      }

      if (agodaDragState.isDragging) {
        const elUnder = document.elementFromPoint(e.clientX, e.clientY);
        const hoveredCell = elUnder ? elUnder.closest('.agoda-day-cell[data-date]') : null;
        if (hoveredCell) {
          const hoveredDate = hoveredCell.getAttribute('data-date');
          if (hoveredDate) {
            let changed = false;

            if (agodaDragState.handle === 'both') {
              if (hoveredDate > agodaTempStart) {
                agodaDragState.handle = 'end';
                agodaTempEnd = hoveredDate;
                changed = true;
              } else if (hoveredDate < agodaTempStart) {
                agodaDragState.handle = 'start';
                agodaTempStart = hoveredDate;
                changed = true;
              }
            } else if (agodaDragState.handle === 'start') {
              const targetDate = (agodaTempEnd && hoveredDate > agodaTempEnd) ? agodaTempEnd : hoveredDate;
              if (agodaTempStart !== targetDate) {
                agodaTempStart = targetDate;
                changed = true;
              }
            } else if (agodaDragState.handle === 'end') {
              const targetDate = (agodaTempStart && hoveredDate < agodaTempStart) ? agodaTempStart : hoveredDate;
              if (agodaTempEnd !== targetDate) {
                agodaTempEnd = targetDate;
                changed = true;
              }
            }

            if (changed) {
              updateAgodaCalendarCellsLive(agodaTempStart, agodaTempEnd, agodaDragState.handle);
              document.getElementById('loanCheckoutDate').value = agodaTempStart;
              document.getElementById('loanDueDate').value = agodaTempEnd;
              updateAgodaDateDisplay();
            }
          }
        }
      }
    });

    const handlePointerEnd = (e) => {
      if (agodaDragState.pointerId === e.pointerId) {
        const wasDragging = agodaDragState.isDragging;
        if (wasDragging) {
          justFinishedAgodaDrag = true;
          setTimeout(() => { justFinishedAgodaDrag = false; }, 120);
        }

        try {
          if (cell.hasPointerCapture(e.pointerId)) {
            cell.releasePointerCapture(e.pointerId);
          }
        } catch (err) {}

        agodaDragState = {
          isDragging: false,
          handle: null,
          pointerId: null,
          startX: 0,
          startY: 0,
          originDate: null
        };

        if (wasDragging) {
          agodaPickingStage = 'start';
          renderAgodaCalendar();
        }
      }
    };

    cell.addEventListener('pointerup', handlePointerEnd);
    cell.addEventListener('pointercancel', handlePointerEnd);

    cell.addEventListener('click', () => {
      if (justFinishedAgodaDrag) return;
      handleAgodaDayClick(dateStr);
    });

    cell.addEventListener('mouseenter', () => {
      if (agodaDragState.isDragging) return;
      if (agodaPickingStage === 'end' && agodaTempStart && dateStr >= agodaTempStart) {
        agodaHoverDate = dateStr;
        updateAgodaHoverVisuals(agodaTempStart, dateStr);
      }
    });

    grid.appendChild(cell);
  }

  grid.addEventListener('mouseleave', () => {
    if (agodaPickingStage === 'end' && !agodaTempEnd) {
      agodaHoverDate = null;
      const endValEl = document.getElementById('agodaModalEndVal');
      const durTextEl = document.getElementById('agodaModalDurationText');
      if (endValEl) endValEl.textContent = '—';
      if (durTextEl) durTextEl.textContent = 'เลือกวันคืน ➔';
      const cells = grid.querySelectorAll('.agoda-day-cell[data-date]');
      cells.forEach(c => {
        const d = c.getAttribute('data-date');
        if (d === agodaTempStart) {
          c.classList.add('is-range-start');
        } else {
          c.classList.remove('is-range-start', 'is-range-end', 'is-in-range', 'is-hover-range');
        }
      });
    }
  });
}

function updateAgodaHoverVisuals(startStr, hoverStr) {
  const grid = document.getElementById('agodaDaysGrid');
  if (!grid) return;
  const cells = grid.querySelectorAll('.agoda-day-cell[data-date]');
  cells.forEach(c => {
    const d = c.getAttribute('data-date');
    if (d === startStr) {
      c.classList.add('is-range-start');
      c.classList.remove('is-in-range', 'is-hover-range');
    } else if (d === hoverStr) {
      c.classList.add('is-range-end');
      c.classList.remove('is-in-range', 'is-hover-range');
    } else if (d > startStr && d < hoverStr) {
      c.classList.add('is-hover-range');
      c.classList.remove('is-range-start', 'is-range-end');
    } else {
      c.classList.remove('is-range-start', 'is-range-end', 'is-in-range', 'is-hover-range');
    }
  });

  const endValEl = document.getElementById('agodaModalEndVal');
  const durTextEl = document.getElementById('agodaModalDurationText');
  if (endValEl && hoverStr) {
    endValEl.textContent = `${formatDisplayDateThai(hoverStr)} (${getDayOfWeekShortThai(hoverStr)})`;
  }
  if (durTextEl && hoverStr) {
    const diff = getDaysDiff(startStr, hoverStr);
    durTextEl.textContent = diff === 0 ? '1 วัน' : `${diff} วัน`;
  }
}

function updateAgodaCalendarCellsLive(startStr, endStr, draggingHandle = null) {
  const grid = document.getElementById('agodaDaysGrid');
  if (!grid) return;

  const startValEl = document.getElementById('agodaModalStartVal');
  const endValEl = document.getElementById('agodaModalEndVal');
  const durTextEl = document.getElementById('agodaModalDurationText');

  if (startValEl) {
    startValEl.textContent = startStr ? `${formatDisplayDateThai(startStr)} (${getDayOfWeekShortThai(startStr)})` : '—';
  }
  if (endValEl) {
    endValEl.textContent = endStr ? `${formatDisplayDateThai(endStr)} (${getDayOfWeekShortThai(endStr)})` : '—';
  }
  if (durTextEl) {
    if (startStr && endStr) {
      const diff = getDaysDiff(startStr, endStr);
      durTextEl.textContent = diff === 0 ? '1 วัน' : `${diff} วัน`;
    } else if (startStr) {
      durTextEl.textContent = 'เลือกวันคืน ➔';
    } else {
      durTextEl.textContent = '➔';
    }
  }

  const cells = grid.querySelectorAll('.agoda-day-cell[data-date]');
  cells.forEach(c => {
    const d = c.getAttribute('data-date');
    const isStart = (d === startStr);
    const isEnd = (d === endStr);
    const isInRange = (startStr && endStr && d > startStr && d < endStr);

    c.classList.toggle('is-range-start', isStart);
    c.classList.toggle('is-range-end', isEnd);
    c.classList.toggle('is-in-range', isInRange);
    c.classList.remove('is-hover-range');

    const isDraggingCell = (draggingHandle === 'start' && isStart) || (draggingHandle === 'end' && isEnd);
    c.classList.toggle('is-dragging', Boolean(isDraggingCell));
  });
}

function handleAgodaDayClick(dateStr) {
  if (agodaPickingStage === 'start') {
    agodaTempStart = dateStr;
    agodaTempEnd = null;
    agodaHoverDate = null;
    agodaPickingStage = 'end';
    document.getElementById('loanCheckoutDate').value = agodaTempStart;
    renderAgodaCalendar();
  } else if (agodaPickingStage === 'end') {
    if (dateStr < agodaTempStart) {
      agodaTempStart = dateStr;
      agodaTempEnd = null;
      agodaHoverDate = null;
      agodaPickingStage = 'end';
      document.getElementById('loanCheckoutDate').value = agodaTempStart;
      renderAgodaCalendar();
    } else {
      agodaTempEnd = dateStr;
      agodaHoverDate = null;
      agodaPickingStage = 'start';
      // Immediately set on the form without waiting for "ตกลง"!
      document.getElementById('loanCheckoutDate').value = agodaTempStart;
      document.getElementById('loanDueDate').value = agodaTempEnd;
      updateAgodaDateDisplay();
      renderAgodaCalendar();
    }
  }
}

function applyAgodaDateRange() {
  if (!agodaTempStart) return;
  const start = agodaTempStart;
  const end = agodaTempEnd || agodaTempStart;

  document.getElementById('loanCheckoutDate').value = start;
  document.getElementById('loanDueDate').value = end;

  updateAgodaDateDisplay();
  closeAgodaDateRangeModal();
  showToast(`📅 ช่วงเวลายืม ${formatDisplayDateThai(start)} → ${formatDisplayDateThai(end)} (${getDaysDiff(start, end)} วัน)`);
}

function applyAgodaQuickPreset(days) {
  const start = agodaTempStart || document.getElementById('loanCheckoutDate')?.value || state.today || new Date().toISOString().slice(0, 10);
  const dt = new Date(start + 'T00:00:00');
  dt.setDate(dt.getDate() + Number(days));
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');

  agodaTempStart = start;
  agodaTempEnd = `${y}-${m}-${d}`;
  agodaHoverDate = null;
  agodaPickingStage = 'start';

  agodaCalYear = dt.getFullYear();
  agodaCalMonth = dt.getMonth();

  // Immediately set on the form without waiting for "ตกลง"!
  document.getElementById('loanCheckoutDate').value = agodaTempStart;
  document.getElementById('loanDueDate').value = agodaTempEnd;
  updateAgodaDateDisplay();

  renderAgodaCalendar();
}

function navAgodaMonth(delta) {
  agodaCalMonth += delta;
  if (agodaCalMonth < 0) {
    agodaCalMonth = 11;
    agodaCalYear -= 1;
  } else if (agodaCalMonth > 11) {
    agodaCalMonth = 0;
    agodaCalYear += 1;
  }
  renderAgodaCalendar();
}

function resetAgodaToToday() {
  const today = state.today || new Date().toISOString().slice(0, 10);
  const dt = new Date(today + 'T00:00:00');
  dt.setDate(dt.getDate() + 7);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');

  agodaTempStart = today;
  agodaTempEnd = `${y}-${m}-${d}`;
  agodaHoverDate = null;
  agodaPickingStage = 'start';

  const tObj = new Date(today + 'T00:00:00');
  agodaCalYear = tObj.getFullYear();
  agodaCalMonth = tObj.getMonth();

  renderAgodaCalendar();
}

let dropdownScrollAnimId = null;
let dropdownScrollTimer = null;

function stopDropdownAutoScroll() {
  if (dropdownScrollAnimId) {
    cancelAnimationFrame(dropdownScrollAnimId);
    dropdownScrollAnimId = null;
  }
  if (dropdownScrollTimer) {
    clearTimeout(dropdownScrollTimer);
    dropdownScrollTimer = null;
  }
}

function setupDropdownScrollArrows(dropdown) {
  const list = dropdown.querySelector('.dropdown-scroll-list');
  const topArrow = dropdown.querySelector('.dropdown-scroll-arrow.top-arrow');
  const bottomArrow = dropdown.querySelector('.dropdown-scroll-arrow.bottom-arrow');
  if (!list) return;

  function updateArrowVisibility() {
    if (topArrow) {
      topArrow.classList.toggle('hidden', list.scrollTop <= 4);
    }
    if (bottomArrow) {
      const isAtBottom = list.scrollTop + list.clientHeight >= list.scrollHeight - 6;
      const canScroll = list.scrollHeight > list.clientHeight + 4;
      bottomArrow.classList.toggle('hidden', !canScroll || isAtBottom);
    }
  }

  // Initial check after DOM paint
  requestAnimationFrame(updateArrowVisibility);
  list.addEventListener('scroll', updateArrowVisibility);

  function attachArrowHoldHandlers(arrowEl, direction) {
    if (!arrowEl) return;

    const handlePressStart = (e) => {
      e.preventDefault();
      e.stopPropagation();
      stopDropdownAutoScroll();

      // Step once immediately (~55px = 1 item) for quick click / tap
      const stepSize = direction === 'down' ? 55 : -55;
      list.scrollBy({ top: stepSize, behavior: 'smooth' });
      setTimeout(updateArrowVisibility, 100);

      // If user holds down (> 180ms), start gradual smooth scrolling
      dropdownScrollTimer = setTimeout(() => {
        function scrollLoop() {
          const speed = direction === 'down' ? 2.8 : -2.8;
          list.scrollTop += speed;
          updateArrowVisibility();

          const reachedEnd = direction === 'down'
            ? (list.scrollTop + list.clientHeight >= list.scrollHeight - 2)
            : (list.scrollTop <= 0);

          if (!reachedEnd) {
            dropdownScrollAnimId = requestAnimationFrame(scrollLoop);
          } else {
            stopDropdownAutoScroll();
          }
        }
        dropdownScrollAnimId = requestAnimationFrame(scrollLoop);
      }, 180);
    };

    const handlePressEnd = () => {
      stopDropdownAutoScroll();
      updateArrowVisibility();
    };

    arrowEl.addEventListener('pointerdown', handlePressStart);
    arrowEl.addEventListener('pointerup', handlePressEnd);
    arrowEl.addEventListener('pointercancel', handlePressEnd);
    arrowEl.addEventListener('pointerleave', handlePressEnd);
    arrowEl.addEventListener('contextmenu', e => e.preventDefault());

    // Window release safety to guarantee scrolling stops whenever finger/mouse is lifted
    window.addEventListener('pointerup', handlePressEnd, { passive: true });
    window.addEventListener('pointercancel', handlePressEnd, { passive: true });
    window.addEventListener('mouseup', handlePressEnd, { passive: true });
    window.addEventListener('touchend', handlePressEnd, { passive: true });
  }

  if (bottomArrow) {
    attachArrowHoldHandlers(bottomArrow, 'down');
  }

  if (topArrow) {
    attachArrowHoldHandlers(topArrow, 'up');
  }
}

function renderModelDropdown(rowIdx, query = '') {
  const dropdown = document.getElementById('globalModelDropdown');
  if (!dropdown) return;

  const targetInput = document.querySelector(`[data-excel-model-input="${rowIdx}"]`);
  if (!targetInput) return;

  const q = query.trim().toLowerCase();
  if (!q) {
    dropdown.classList.add('hidden');
    return;
  }

  const filtered = state.catalogs.filter(c => {
    const hay = `${c.brand} ${c.model} ${c.category || ''}`.toLowerCase();
    return hay.includes(q);
  });

  if (filtered.length === 0) {
    dropdown.innerHTML = `<div class="model-dropdown-empty">ไม่พบรุ่นสินค้าที่ตรงกับ "${escapeHtml(query)}" (กด Enter เพื่อใช้ชื่อนี้)</div>`;
  } else {
    // Group by Brand
    const byBrand = new Map();
    for (const c of filtered) {
      const brandName = c.brand || 'แบรนด์อื่นๆ';
      if (!byBrand.has(brandName)) byBrand.set(brandName, []);
      byBrand.get(brandName).push(c);
    }

    let html = '';
    const row = state.loanDraftRows[rowIdx];
    const targetSource = row ? (row.source || 'Demo') : 'Demo';

    for (const [brandName, items] of byBrand.entries()) {
      html += `<div class="model-dropdown-group-title">${escapeHtml(brandName)}</div>`;
      for (const it of items) {
        // Calculate stock matching the row's chosen warehouse (e.g. Demo)
        const modelAssets = (state.assets || []).filter(a => {
          const aSource = String(a.source || 'Demo').trim().toLowerCase();
          return aSource === targetSource.toLowerCase() && isAssetMatchingModel(a, it.brand, it.model);
        });
        const totalCount = modelAssets.length;
        const availCount = modelAssets.filter(a => (a.status === 'Available') || (state.editingLoanId && a.current_loan_id === state.editingLoanId)).length;

        const isAvail = availCount > 0;
        const isPartiallyLoaned = availCount < totalCount && availCount > 0;
        const isFullyLoaned = availCount === 0 && totalCount > 0;

        let badgeHtml = '';
        if (totalCount === 0) {
          badgeHtml = `<span class="model-count-box count-zero" title="ไม่มีเครื่องในคลัง ${escapeHtml(targetSource)}"><span class="count-num">0</span></span>`;
        } else if (isFullyLoaned) {
          badgeHtml = `<span class="model-count-box count-zero" title="ถูกยืมหมดทั้ง ${totalCount} เครื่อง ในคลัง ${escapeHtml(targetSource)}"><span class="count-num">0</span><span class="count-denom">/${totalCount}</span></span>`;
        } else if (isPartiallyLoaned) {
          badgeHtml = `<span class="model-count-box count-partial" title="ว่าง ${availCount} จากทั้งหมด ${totalCount} เครื่อง ในคลัง ${escapeHtml(targetSource)}"><span class="count-num">${availCount}</span><span class="count-denom">/${totalCount}</span></span>`;
        } else {
          badgeHtml = `<span class="model-count-box count-full" title="ว่างครบทั้ง ${availCount} เครื่อง ในคลัง ${escapeHtml(targetSource)}"><span class="count-num">${availCount}</span></span>`;
        }

        html += `
          <div
            class="model-dropdown-item"
            data-select-brand="${escapeHtml(it.brand)}"
            data-select-model="${escapeHtml(it.model)}"
            data-row="${rowIdx}"
          >
            <div class="model-item-main">
              <span class="model-item-name">${escapeHtml(it.brand)} ${escapeHtml(it.model)}</span>
              <span class="model-item-sub">${escapeHtml(it.category || 'อุปกรณ์')}</span>
            </div>
            ${badgeHtml}
          </div>
        `;
      }
    }
    dropdown.innerHTML = `
      <div class="dropdown-scroll-arrow top-arrow hidden" title="เลื่อนขึ้น">▲</div>
      <div class="dropdown-scroll-list">
        ${html}
      </div>
      <div class="dropdown-scroll-arrow bottom-arrow" title="เลื่อนลง">▼</div>
    `;
    setupDropdownScrollArrows(dropdown);
  }

  // Calculate viewport coordinates of targetInput to float dropdown completely outside the form & modal
  const inputRect = targetInput.getBoundingClientRect();
  const isMobile = window.innerWidth <= 640;
  const dropdownWidth = isMobile ? Math.min(window.innerWidth - 20, 420) : Math.max(380, inputRect.width);

  dropdown.style.width = `${dropdownWidth}px`;

  if (isMobile) {
    dropdown.style.left = `${Math.max(10, Math.floor((window.innerWidth - dropdownWidth) / 2))}px`;
  } else {
    dropdown.style.left = `${Math.max(10, Math.min(inputRect.left, window.innerWidth - dropdownWidth - 16))}px`;
  }

  const spaceBelow = window.innerHeight - inputRect.bottom - 20;
  const spaceAbove = inputRect.top - 20;

  if (spaceBelow < 180 && spaceAbove > spaceBelow) {
    // Show above the input if space below is too small
    const maxHeight = Math.max(160, Math.floor(spaceAbove));
    dropdown.style.maxHeight = `${maxHeight}px`;
    dropdown.style.bottom = `${window.innerHeight - inputRect.top + 6}px`;
    dropdown.style.top = 'auto';
  } else {
    // Show below the input and maximize usage of available space below
    const maxHeight = Math.max(180, Math.floor(spaceBelow));
    dropdown.style.maxHeight = `${maxHeight}px`;
    dropdown.style.top = `${inputRect.bottom + 6}px`;
    dropdown.style.bottom = 'auto';
  }

  dropdown.classList.remove('hidden');
}

function closeAllModelDropdowns() {
  stopDropdownAutoScroll();
  const modelDd = document.getElementById('globalModelDropdown');
  if (modelDd) modelDd.classList.add('hidden');
  const accDd = document.getElementById('globalAccessoryDropdown');
  if (accDd) accDd.classList.add('hidden');
  const srcDd = document.getElementById('globalSourceDropdown');
  if (srcDd) {
    srcDd.classList.add('hidden');
    srcDd.removeAttribute('data-active-row');
  }
  const brandDd = document.getElementById('globalBrandDropdown');
  if (brandDd) {
    brandDd.classList.add('hidden');
    brandDd.removeAttribute('data-active-row');
  }
  document.querySelectorAll('.model-dropdown-menu').forEach(d => d.classList.add('hidden'));
}

function renderAccessoryDropdown(rowIdx, query = '') {
  const dropdown = document.getElementById('globalAccessoryDropdown');
  if (!dropdown) return;

  const targetInput = document.querySelector(`[data-excel-add-tag="${rowIdx}"]`);
  if (!targetInput) return;

  const row = state.loanDraftRows[rowIdx];
  const existingTags = new Set((row ? row.accessories : []) || []);

  const q = query.trim().toLowerCase();
  const filtered = state.accessorySuggestions.filter(s => {
    if (existingTags.has(s)) return false; // Hide already chosen tags
    if (!q) return true;
    return s.toLowerCase().includes(q);
  });

  const headerHtml = `
    <div class="dropdown-header-bar">
      <span class="dropdown-header-title">🔌 เลือกอุปกรณ์เสริม (${filtered.length})</span>
      <button type="button" class="btn-close-dropdown" data-close-accessory-dropdown title="ปิด (✕)">✕</button>
    </div>
  `;

  if (filtered.length === 0) {
    if (q) {
      dropdown.innerHTML = `
        ${headerHtml}
        <div class="dropdown-scroll-list">
          <div class="model-dropdown-item" data-select-acc="${escapeHtml(query.trim())}" data-row="${rowIdx}">
            <div class="model-item-main">
              <span class="model-item-name">➕ เพิ่มป้ายใหม่: "${escapeHtml(query.trim())}"</span>
              <span class="model-item-sub">กดคลิกหรือกด Enter เพื่อเพิ่ม Tag นี้</span>
            </div>
          </div>
        </div>
      `;
    } else {
      dropdown.innerHTML = `
        ${headerHtml}
        <div class="model-dropdown-empty">เลือกครบทุกอุปกรณ์แนะนำแล้ว (พิมพ์เพิ่มใหม่ได้)</div>
      `;
    }
  } else {
    // Check if query is not an exact match to allow creating new custom tag too
    let html = '';
    const exactMatch = filtered.some(s => s.toLowerCase() === q);
    if (q && !exactMatch) {
      html += `
        <div class="model-dropdown-item" data-select-acc="${escapeHtml(query.trim())}" data-row="${rowIdx}" style="background:#f0fdf4;">
          <div class="model-item-main">
            <span class="model-item-name" style="color:#15803d;">➕ เพิ่ม Tag ใหม่: "${escapeHtml(query.trim())}"</span>
            <span class="model-item-sub">สร้างป้ายอุปกรณ์เสริมตามที่พิมพ์</span>
          </div>
        </div>
      `;
    }

    for (const item of filtered) {
      html += `
        <div
          class="model-dropdown-item"
          data-select-acc="${escapeHtml(item)}"
          data-row="${rowIdx}"
        >
          <div class="model-item-main">
            <span class="model-item-name">${escapeHtml(item)}</span>
            <span class="model-item-sub">อุปกรณ์เสริม</span>
          </div>
          <span class="model-item-badge badge-avail">+ เพิ่ม</span>
        </div>
      `;
    }
    dropdown.innerHTML = `
      ${headerHtml}
      <div class="dropdown-scroll-arrow top-arrow hidden" title="เลื่อนขึ้น">▲</div>
      <div class="dropdown-scroll-list">
        ${html}
      </div>
      <div class="dropdown-scroll-arrow bottom-arrow" title="เลื่อนลง">▼</div>
    `;
    setupDropdownScrollArrows(dropdown);
  }

  // Calculate viewport coordinates of targetInput
  const inputRect = targetInput.getBoundingClientRect();
  const isMobile = window.innerWidth <= 640;
  const dropdownWidth = isMobile ? Math.min(window.innerWidth - 20, 360) : 320;

  dropdown.style.width = `${dropdownWidth}px`;

  if (isMobile) {
    dropdown.style.left = `${Math.max(10, Math.floor((window.innerWidth - dropdownWidth) / 2))}px`;
  } else {
    dropdown.style.left = `${Math.max(10, Math.min(inputRect.left, window.innerWidth - dropdownWidth - 16))}px`;
  }

  const spaceBelow = window.innerHeight - inputRect.bottom - 20;
  const spaceAbove = inputRect.top - 20;

  if (spaceBelow < 180 && spaceAbove > spaceBelow) {
    const maxHeight = Math.max(160, Math.floor(spaceAbove));
    dropdown.style.maxHeight = `${maxHeight}px`;
    dropdown.style.bottom = `${window.innerHeight - inputRect.top + 6}px`;
    dropdown.style.top = 'auto';
  } else {
    const maxHeight = Math.max(180, Math.floor(spaceBelow));
    dropdown.style.maxHeight = `${maxHeight}px`;
    dropdown.style.top = `${inputRect.bottom + 6}px`;
    dropdown.style.bottom = 'auto';
  }

  dropdown.classList.remove('hidden');
}

function formatSourceLabel(source) {
  if (source === 'Supplier') return '2. Supplier';
  if (source === 'คลังขาย') return '3. คลังขาย';
  if (source === 'ทดแทนระหว่างซ่อม') return '4. ทดแทนระหว่างซ่อม';
  return '1. Demo';
}

function renderSourceDropdown(rowIdx) {
  const dropdown = document.getElementById('globalSourceDropdown');
  if (!dropdown) return;

  const targetBtn = document.querySelector(`[data-source-trigger="${rowIdx}"]`);
  if (!targetBtn) return;

  dropdown.setAttribute('data-active-row', String(rowIdx));

  const row = state.loanDraftRows[rowIdx];
  const currentSource = (row && row.source) ? row.source : 'Demo';

  const sourceOptions = [
    {
      value: 'Demo',
      name: '1. Demo',
      sub: 'เครื่องสาธิต / สินค้าตัวอย่างในคลัง Demo',
      badgeClass: 'badge-source-demo',
      badgeText: 'Demo'
    },
    {
      value: 'Supplier',
      name: '2. Supplier',
      sub: 'ยืมจากผู้ผลิต / ซัพพลายเออร์ภายนอก',
      badgeClass: 'badge-source-supplier',
      badgeText: 'Supplier'
    },
    {
      value: 'คลังขาย',
      name: '3. คลังขาย',
      sub: 'เบิกจากสต็อกขาย (Sales Stock)',
      badgeClass: 'badge-source-sales',
      badgeText: 'คลังขาย'
    },
    {
      value: 'ทดแทนระหว่างซ่อม',
      name: '4. ทดแทนระหว่างซ่อม',
      sub: 'เครื่องสำรองใช้งานระหว่างส่งซ่อม (Repair Swap)',
      badgeClass: 'badge-source-replacement',
      badgeText: 'ทดแทนระหว่างซ่อม'
    }
  ];

  const headerHtml = `
    <div class="dropdown-header-bar">
      <span class="dropdown-header-title">🏢 เลือกคลัง / แหล่งที่มา (Source)</span>
      <button type="button" class="btn-close-dropdown" data-close-source-dropdown title="ปิด (✕)">✕</button>
    </div>
  `;

  const itemsHtml = sourceOptions.map(opt => {
    const isSelected = (opt.value === currentSource);
    return `
      <div
        class="model-dropdown-item source-dropdown-item ${isSelected ? 'is-selected' : ''}"
        data-select-source="${escapeHtml(opt.value)}"
        data-row="${rowIdx}"
      >
        <div class="model-item-main">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="model-item-name" style="font-weight:700;">${escapeHtml(opt.name)}</span>
            ${isSelected ? '<span class="source-check-icon">✓</span>' : ''}
          </div>
          <span class="model-item-sub">${escapeHtml(opt.sub)}</span>
        </div>
        <span class="source-item-badge ${opt.badgeClass}">${escapeHtml(opt.badgeText)}</span>
      </div>
    `;
  }).join('');

  dropdown.innerHTML = `
    ${headerHtml}
    <div class="dropdown-scroll-list source-options-list">
      ${itemsHtml}
    </div>
  `;

  // Calculate viewport coordinates of targetBtn
  const btnRect = targetBtn.getBoundingClientRect();
  const isMobile = window.innerWidth <= 640;
  const dropdownWidth = isMobile ? Math.min(window.innerWidth - 20, 360) : 300;

  dropdown.style.width = `${dropdownWidth}px`;

  if (isMobile) {
    dropdown.style.left = `${Math.max(10, Math.floor((window.innerWidth - dropdownWidth) / 2))}px`;
  } else {
    dropdown.style.left = `${Math.max(10, Math.min(btnRect.left, window.innerWidth - dropdownWidth - 16))}px`;
  }

  const spaceBelow = window.innerHeight - btnRect.bottom - 20;
  const spaceAbove = btnRect.top - 20;

  if (spaceBelow < 200 && spaceAbove > spaceBelow) {
    const maxHeight = Math.max(200, Math.floor(spaceAbove));
    dropdown.style.maxHeight = `${maxHeight}px`;
    dropdown.style.bottom = `${window.innerHeight - btnRect.top + 6}px`;
    dropdown.style.top = 'auto';
  } else {
    const maxHeight = Math.max(260, Math.floor(spaceBelow));
    dropdown.style.maxHeight = `${maxHeight}px`;
    dropdown.style.top = `${btnRect.bottom + 6}px`;
    dropdown.style.bottom = 'auto';
  }

  dropdown.classList.remove('hidden');
}

function getAllAvailableBrands() {
  const brandSet = new Set();
  (state.catalogs || []).forEach(c => { if (c.brand && c.brand.trim()) brandSet.add(c.brand.trim()); });
  (state.assets || []).forEach(a => { if (a.brand && a.brand.trim()) brandSet.add(a.brand.trim()); });
  const commonBrands = [
    'Zebra', 'Honeywell', 'Bixolon', 'Point Mobile', 'Sunmi', 
    'Datalogic', 'Newland', 'Urovo', 'Seiko', 'CipherLab', 
    'Argox', 'Citizen', 'TSC', 'Godex', 'Epson', 'Apple', 'Samsung'
  ];
  commonBrands.forEach(b => brandSet.add(b));
  return Array.from(brandSet).sort((a, b) => a.localeCompare(b));
}

function renderBrandDropdown(rowIdx, query = '') {
  const dropdown = document.getElementById('globalBrandDropdown');
  if (!dropdown) return;

  const targetInput = document.querySelector(`[data-excel-brand-input="${rowIdx}"]`);
  if (!targetInput) return;

  dropdown.setAttribute('data-active-row', String(rowIdx));

  const allBrands = getAllAvailableBrands();
  const q = String(query || '').trim().toLowerCase();
  const filtered = q
    ? allBrands.filter(b => b.toLowerCase().includes(q))
    : allBrands;

  const exactMatch = allBrands.some(b => b.toLowerCase() === q);

  const headerHtml = `
    <div class="dropdown-header-bar">
      <div style="display:flex; align-items:center; gap:6px;">
        <span class="dropdown-header-title">🏷️ เลือกแบรนด์สินค้า</span>
        <span class="dropdown-count-badge">${filtered.length} แบรนด์</span>
      </div>
      <button type="button" class="btn-close-dropdown" data-close-brand-dropdown title="ปิด (✕)">✕</button>
    </div>
  `;

  let itemsHtml = '';

  // If query does not match any existing brand, offer adding as new brand (GEMINI.md rule 1.2)
  if (q && !exactMatch) {
    itemsHtml += `
      <div
        class="model-dropdown-item brand-dropdown-item brand-item-new"
        data-select-brand="${escapeHtml(query.trim())}"
        data-row="${rowIdx}"
      >
        <div class="model-item-main">
          <div style="display:flex; align-items:center; gap:6px;">
            <span class="brand-item-new-icon">➕</span>
            <span class="model-item-name" style="color:#2563eb; font-weight:700;">ใช้แบรนด์ใหม่: "${escapeHtml(query.trim())}"</span>
          </div>
          <span class="model-item-sub">บันทึกแบรนด์ใหม่นี้ลงฐานข้อมูลอัตโนมัติ</span>
        </div>
        <span class="source-item-badge badge-source-supplier">แบรนด์ใหม่</span>
      </div>
    `;
  }

  itemsHtml += filtered.map(brand => {
    const count = (state.assets || []).filter(a => (a.brand || '').toLowerCase() === brand.toLowerCase()).length;
    return `
      <div
        class="model-dropdown-item brand-dropdown-item"
        data-select-brand="${escapeHtml(brand)}"
        data-row="${rowIdx}"
      >
        <div class="model-item-main">
          <span class="model-item-name" style="font-weight:600;">${escapeHtml(brand)}</span>
          <span class="model-item-sub">${count > 0 ? `มีเครื่องในระบบ ${count} เครื่อง` : 'แบรนด์มาตรฐาน'}</span>
        </div>
        ${count > 0 ? `<span class="brand-count-badge">${count} เครื่อง</span>` : ''}
      </div>
    `;
  }).join('');

  if (!itemsHtml) {
    itemsHtml = `<div class="model-dropdown-empty">ไม่พบแบรนด์ที่ตรงกับคำค้นหา</div>`;
  }

  dropdown.innerHTML = `
    ${headerHtml}
    <div class="dropdown-scroll-list brand-options-list">
      ${itemsHtml}
    </div>
  `;

  const inputRect = targetInput.getBoundingClientRect();
  const isMobile = window.innerWidth <= 640;
  const dropdownWidth = isMobile ? Math.min(window.innerWidth - 20, 360) : 320;

  dropdown.style.width = `${dropdownWidth}px`;

  if (isMobile) {
    dropdown.style.left = `${Math.max(10, Math.floor((window.innerWidth - dropdownWidth) / 2))}px`;
  } else {
    dropdown.style.left = `${Math.max(10, Math.min(inputRect.left, window.innerWidth - dropdownWidth - 16))}px`;
  }

  const spaceBelow = window.innerHeight - inputRect.bottom - 20;
  const spaceAbove = inputRect.top - 20;

  if (spaceBelow < 220 && spaceAbove > spaceBelow) {
    const maxHeight = Math.max(200, Math.floor(spaceAbove));
    dropdown.style.maxHeight = `${maxHeight}px`;
    dropdown.style.bottom = `${window.innerHeight - inputRect.top + 6}px`;
    dropdown.style.top = 'auto';
  } else {
    const maxHeight = Math.max(240, Math.floor(spaceBelow));
    dropdown.style.maxHeight = `${maxHeight}px`;
    dropdown.style.top = `${inputRect.bottom + 6}px`;
    dropdown.style.bottom = 'auto';
  }

  dropdown.classList.remove('hidden');
}

function getModelAvailableStock(brand, model, source = 'Demo') {
  const brandTrim = String(brand || '').trim();
  const modelTrim = String(model || '').trim();
  if (!modelTrim) return 0;
  const targetSource = String(source || 'Demo').trim().toLowerCase();

  const availAssets = (state.assets || []).filter(a => {
    const aSource = String(a.source || 'Demo').trim().toLowerCase();
    if (aSource !== targetSource) return false;
    const isAvail = (a.status === 'Available') || (state.editingLoanId && a.current_loan_id === state.editingLoanId);
    if (!isAvail) return false;
    return isAssetMatchingModel(a, brandTrim, modelTrim);
  }).length;

  return availAssets;
}

function getLoanDraftStockSimulation() {
  const modelUsed = new Map();
  const rowSimulations = [];
  const modelSummary = new Map();

  state.loanDraftRows.forEach((r, rowIdx) => {
    const model = String(r.model || '').trim();
    if (!model) {
      rowSimulations.push(null);
      return;
    }
    const brand = String(r.brand || '').trim();
    const source = r.source || 'Demo';
    const key = `${source.toLowerCase()}::${brand} ${model}`.trim().toLowerCase();
    const rowQty = Math.max(1, parseInt(r.qty || 1, 10) || 1);

    const totalAvail = getModelAvailableStock(brand, model, source);
    const usedBefore = modelUsed.get(key) || 0;
    const availBefore = Math.max(0, totalAvail - usedBefore);

    const isSufficientRaw = (availBefore >= rowQty);
    const isSupplier = (source === 'Supplier');
    const isSale = (source === 'คลังขาย');
    const isAutoSupplier = isSupplier && !isSufficientRaw;
    const isAutoSale = isSale && !isSufficientRaw;
    const isSufficient = (isAutoSupplier || isAutoSale) ? true : isSufficientRaw;

    const allocated = Math.min(rowQty, availBefore);
    const shortage = (isAutoSupplier || isAutoSale) ? 0 : (isSufficient ? 0 : (rowQty - allocated));
    const remainingAfter = Math.max(0, availBefore - rowQty);

    modelUsed.set(key, usedBefore + rowQty);

    const sim = {
      rowIdx,
      key,
      brand,
      model,
      source,
      isAutoSupplier,
      isAutoSale,
      totalAvailable: totalAvail,
      rowQty,
      usedBefore,
      availBefore,
      isSufficient,
      shortage,
      remainingAfter,
      cumulativeRequested: usedBefore + rowQty
    };
    rowSimulations.push(sim);

    const prevSummary = modelSummary.get(key) || {
      key,
      brand,
      model,
      source,
      isAutoSupplier,
      isAutoSale,
      available: totalAvail,
      totalRequested: 0,
      isSufficient: true,
      shortage: 0,
      remaining: totalAvail
    };
    prevSummary.totalRequested += rowQty;
    if (isAutoSupplier || isAutoSale) {
      prevSummary.isSufficient = true;
      prevSummary.shortage = 0;
      prevSummary.isAutoSupplier = isAutoSupplier;
      prevSummary.isAutoSale = isAutoSale;
    } else {
      prevSummary.isSufficient = (prevSummary.totalRequested <= totalAvail);
      prevSummary.shortage = prevSummary.isSufficient ? 0 : (prevSummary.totalRequested - totalAvail);
      prevSummary.remaining = prevSummary.isSufficient ? (totalAvail - prevSummary.totalRequested) : 0;
    }
    modelSummary.set(key, prevSummary);
  });

  return {
    rowSimulations,
    modelSummary
  };
}

function getStockSimulationMap() {
  return getLoanDraftStockSimulation().modelSummary;
}

function formatFileSize(bytes) {
  if (!bytes || isNaN(bytes)) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function getFileIcon(type, name) {
  const n = (name || '').toLowerCase();
  const t = (type || '').toLowerCase();
  if (t.includes('pdf') || n.endsWith('.pdf')) return '📄';
  if (t.includes('word') || n.endsWith('.doc') || n.endsWith('.docx')) return '📝';
  if (t.includes('sheet') || t.includes('excel') || n.endsWith('.xls') || n.endsWith('.xlsx')) return '📊';
  if (t.includes('image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(n)) return '🖼️';
  return '📎';
}

function renderNoteAttachmentPills(attachments, rowIdx) {
  if (!Array.isArray(attachments) || attachments.length === 0) return '';
  return attachments
    .map((att, attIdx) => {
      const isImg = (att.type && att.type.startsWith('image/')) || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name || '');
      const icon = getFileIcon(att.type, att.name);
      const sizeStr = formatFileSize(att.size);
      return `
        <div class="note-file-tag" data-preview-att-row="${rowIdx}" data-preview-att-idx="${attIdx}" title="แตะเพื่อดูตัวอย่างไฟล์ (${escapeHtml(att.name)})">
          <span class="file-tag-num">${attIdx + 1}</span>
          ${isImg ? `
            <span class="file-tag-thumb-wrap">
              <img src="${escapeHtml(att.url)}" class="file-tag-thumb" alt="${escapeHtml(att.name)}" />
            </span>
          ` : `
            <span class="file-tag-icon">${icon}</span>
          `}
          <span class="file-tag-name" title="${escapeHtml(att.name)}">
            ${escapeHtml(att.name)}
          </span>
          ${sizeStr ? `<span class="file-tag-size">${sizeStr}</span>` : ''}
          <button type="button" class="btn-remove-file-tag" data-remove-att-row="${rowIdx}" data-remove-att-idx="${attIdx}" title="ลบไฟล์นี้" aria-label="ลบไฟล์แนบ">✕</button>
        </div>
      `;
    })
    .join('');
}

let previewGalleryItems = [];
let previewCurrentIndex = 0;

function openFilePreview(itemsOrSingle, initialIndex = 0) {
  const modal = document.getElementById('filePreviewModalDialog');
  if (!modal) return;

  // Normalize input into array of items
  let items = [];
  if (Array.isArray(itemsOrSingle)) {
    items = itemsOrSingle.map(it => {
      if (typeof it === 'string') return { url: it, name: 'รูปภาพ', type: 'image/jpeg' };
      return it;
    }).filter(it => it && it.url);
  } else if (itemsOrSingle && typeof itemsOrSingle === 'object') {
    if (itemsOrSingle.url) items = [itemsOrSingle];
  } else if (typeof itemsOrSingle === 'string') {
    items = [{ url: itemsOrSingle, name: 'รูปภาพ', type: 'image/jpeg' }];
  }

  if (items.length === 0) return;

  previewGalleryItems = items;
  previewCurrentIndex = Math.max(0, Math.min(items.length - 1, Number(initialIndex) || 0));

  renderCurrentPreviewItem();
  modal.showModal();
}

function renderCurrentPreviewItem() {
  if (previewGalleryItems.length === 0) return;
  const att = previewGalleryItems[previewCurrentIndex];
  if (!att) return;

  const total = previewGalleryItems.length;
  const isMulti = total > 1;

  const titleEl = document.getElementById('previewModalTitle');
  const metaEl = document.getElementById('previewModalMeta');
  const iconEl = document.getElementById('previewModalIcon');
  const linkEl = document.getElementById('previewExternalLink');
  const bodyEl = document.getElementById('previewLightboxBody');
  const counterEl = document.getElementById('previewGalleryCounter');
  const prevBtn = document.getElementById('btnPreviewPrev');
  const nextBtn = document.getElementById('btnPreviewNext');
  const footerEl = document.getElementById('previewLightboxFooter');
  const trackEl = document.getElementById('previewThumbnailsTrack');

  const sizeStr = formatFileSize(att.size);
  const icon = getFileIcon(att.type, att.name);
  const isImg = (att.type && att.type.startsWith('image/')) || /\.(jpg|jpeg|png|gif|webp)$/i.test(att.name || '') || (att.url && att.url.startsWith('data:image/'));
  const isPdf = (att.type && att.type.includes('pdf')) || (att.name || '').toLowerCase().endsWith('.pdf');

  if (titleEl) titleEl.textContent = att.name || 'ตัวอย่างไฟล์';
  if (metaEl) metaEl.textContent = sizeStr ? `${sizeStr}` : '';
  if (iconEl) iconEl.textContent = icon;
  if (linkEl) {
    linkEl.href = att.url;
    linkEl.setAttribute('download', att.name || 'download');
  }

  // Counter badge
  if (counterEl) {
    if (isMulti) {
      counterEl.textContent = `${previewCurrentIndex + 1} / ${total}`;
      counterEl.classList.remove('hidden');
    } else {
      counterEl.classList.add('hidden');
    }
  }

  // Prev / Next Buttons
  if (prevBtn) prevBtn.classList.toggle('hidden', !isMulti);
  if (nextBtn) nextBtn.classList.toggle('hidden', !isMulti);

  // Content
  if (bodyEl) {
    if (isImg) {
      bodyEl.innerHTML = `<img src="${escapeHtml(att.url)}" class="preview-img-content" alt="${escapeHtml(att.name || '')}" />`;
    } else if (isPdf) {
      bodyEl.innerHTML = `<iframe src="${escapeHtml(att.url)}" class="preview-iframe-content" title="${escapeHtml(att.name || '')}"></iframe>`;
    } else {
      bodyEl.innerHTML = `
        <div class="preview-card-fallback">
          <div class="preview-fallback-icon">${icon}</div>
          <div class="preview-fallback-name">${escapeHtml(att.name || '')}</div>
          <div class="preview-fallback-size">${sizeStr}</div>
          <a href="${escapeHtml(att.url)}" target="_blank" rel="noopener" class="btn btn-primary" style="margin-top:8px;">
            ⬇️ ดาวน์โหลด / เปิดไฟล์
          </a>
        </div>
      `;
    }
  }

  // Thumbnails track
  if (footerEl && trackEl) {
    if (isMulti) {
      footerEl.classList.remove('hidden');
      trackEl.innerHTML = previewGalleryItems
        .map((item, idx) => {
          const itemImg = (item.type && item.type.startsWith('image/')) || /\.(jpg|jpeg|png|gif|webp)$/i.test(item.name || '') || (item.url && item.url.startsWith('data:image/'));
          const activeClass = idx === previewCurrentIndex ? 'active' : '';
          return `
            <button type="button" class="preview-thumb-btn ${activeClass}" data-preview-goto-idx="${idx}" title="${escapeHtml(item.name || `รูปที่ ${idx + 1}`)}">
              ${itemImg ? `<img src="${escapeHtml(item.url)}" alt="" />` : `<span>${idx + 1}</span>`}
            </button>
          `;
        })
        .join('');

      // Auto scroll active thumbnail into view
      setTimeout(() => {
        const activeThumb = trackEl.querySelector('.preview-thumb-btn.active');
        if (activeThumb) {
          activeThumb.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }, 30);
    } else {
      footerEl.classList.add('hidden');
      trackEl.innerHTML = '';
    }
  }
}

function prevPreviewItem() {
  if (previewGalleryItems.length <= 1) return;
  previewCurrentIndex = (previewCurrentIndex - 1 + previewGalleryItems.length) % previewGalleryItems.length;
  renderCurrentPreviewItem();
}

function nextPreviewItem() {
  if (previewGalleryItems.length <= 1) return;
  previewCurrentIndex = (previewCurrentIndex + 1) % previewGalleryItems.length;
  renderCurrentPreviewItem();
}

window.openFilePreview = openFilePreview;
window.openFilePreviewModal = openFilePreview;
window.prevPreviewItem = prevPreviewItem;
window.nextPreviewItem = nextPreviewItem;

async function uploadNoteFiles(rowIdx, fileList) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;
  const row = state.loanDraftRows[rowIdx];
  if (!row) return;
  if (!row.attachments) row.attachments = [];

  // Check duplicate file names against existing attachments & current batch
  const existingNames = new Set(row.attachments.map(a => (a.name || '').trim().toLowerCase()));
  const validFiles = [];
  const duplicateNames = [];

  for (const file of files) {
    const norm = (file.name || '').trim().toLowerCase();
    if (existingNames.has(norm)) {
      duplicateNames.push(file.name);
    } else {
      existingNames.add(norm);
      validFiles.push(file);
    }
  }

  if (duplicateNames.length > 0) {
    showToast(`⚠️ ไฟล์ชื่อซ้ำ: ${duplicateNames.join(', ')}`);
  }

  if (validFiles.length === 0) return;

  showToast(`⏳ กำลังอัปโหลด ${validFiles.length} ไฟล์...`);

  for (const file of validFiles) {
    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: file.name,
          data: base64Data,
          size: file.size,
          type: file.type
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      row.attachments.push({
        name: data.name || file.name,
        url: data.url,
        size: data.size || file.size,
        type: data.type || file.type
      });
    } catch (err) {
      console.error('File upload error:', err);
      showToast(`⚠️ อัปโหลด ${file.name} ไม่สำเร็จ: ${err.message}`);
    }
  }

  renderLoanExcelRows();
  showToast('✅ แนบไฟล์เรียบร้อย');
}

function renderLoanExcelRows() {
  const tbody = document.getElementById('loanExcelRowsBody');
  if (!tbody) return;

  const thModel = document.getElementById('thLoanModel') || document.querySelector('.excel-loan-table thead .th-model');
  const hasCustomSource = (state.loanDraftRows || []).some(r => r.source === 'Supplier' || r.source === 'คลังขาย');
  if (thModel) {
    if (hasCustomSource) {
      thModel.innerHTML = `
        <div class="th-split-header">
          <span class="th-col-brand">แบรนด์ (Brand) <span class="req">*</span></span>
          <span class="th-col-model">รุ่นสินค้า (Model) <span class="req">*</span></span>
        </div>
      `;
    } else {
      thModel.innerHTML = `<span>เลือกรุ่นสินค้า</span>`;
    }
  }

  if (state.activeLoanRowIdx === undefined || state.activeLoanRowIdx === null) {
    state.activeLoanRowIdx = 0;
  }

  const { rowSimulations } = getLoanDraftStockSimulation();

  tbody.innerHTML = state.loanDraftRows
    .map((row, rowIdx) => {
      const isSupplierOrSale = row.source === 'Supplier' || row.source === 'คลังขาย';
      const hasBrand = Boolean(row.brand && row.brand.trim());
      const hasModel = Boolean(row.model && row.model.trim());
      const modelVal = row.model ? (row.brand ? `${row.brand} ${row.model}` : row.model) : '';
      const isBlankRow = !row.model && !row.brand;
      const isActive = (rowIdx === state.activeLoanRowIdx);
      const isNewRow = Boolean(row._isNew);
      const rowQty = Math.max(1, Number(row.qty || 1));
      const rowSerials = (row.serials || []).map(s => String(s || '').trim());
      const filledSn = rowSerials.filter(Boolean);

      const sim = rowSimulations[rowIdx] || null;

      // Duplicate readiness check:
      // Must have model selected (and brand for Supplier/คลังขาย), and IF S/N has been started it must be completely filled
      const hasIncompleteSn = (filledSn.length > 0 && filledSn.length < rowQty);
      const isRowComplete = isSupplierOrSale
        ? (hasBrand && hasModel && !hasIncompleteSn)
        : (hasModel && !hasIncompleteSn);

      let dupDisabledAttr = '';
      let dupTitle = 'คัดลอกรายการนี้';
      if (!isRowComplete) {
        dupDisabledAttr = 'disabled';
        if (isSupplierOrSale && !hasBrand) {
          dupTitle = 'กรุณาระบุแบรนด์สินค้าก่อนคัดลอก';
        } else if (!hasModel) {
          dupTitle = 'กรุณาเลือกรุ่นสินค้าก่อนคัดลอก';
        } else if (hasIncompleteSn) {
          dupTitle = `กรุณาระบุ S/N ให้ครบตามจำนวน (${filledSn.length}/${rowQty}) ก่อนคัดลอก`;
        }
      }

      // Case 1: Row has model/data and is NOT active -> COLLAPSED ROW SUMMARY
      if (!isActive && hasModel) {
        let snBadgeHtml = '';
        if (filledSn.length === rowQty && rowQty > 0) {
          snBadgeHtml = `<span class="collapsed-sn-pill complete" title="S/N: ${escapeHtml(filledSn.join(', '))}">🏷️ S/N: ${escapeHtml(filledSn.join(', '))}</span>`;
        } else if (filledSn.length > 0) {
          snBadgeHtml = `<span class="collapsed-sn-pill warn" title="ระบุแล้ว ${filledSn.length}/${rowQty} เครื่อง (ต้องครบตามจำนวน)">🏷️ S/N: ${filledSn.length}/${rowQty}</span>`;
        }

        const stockPillHtml = sim?.isAutoSupplier ? `
          <span
            class="collapsed-stock-pill auto-supplier"
            title="สินค้าจากการยืม Supplier จะถูกเพิ่มเข้าคลัง Supplier ในระบบอัตโนมัติ"
          >
            <span class="sim-dot auto-supplier"></span>
            เพิ่มเข้าคลัง Supplier อัตโนมัติ
          </span>
        ` : sim?.isAutoSale ? `
          <span
            class="collapsed-stock-pill auto-supplier"
            title="สินค้าจากคลังขาย จะถูกเพิ่มเข้าคลังในระบบอัตโนมัติ"
          >
            <span class="sim-dot auto-supplier"></span>
            เพิ่มเข้าคลังขาย อัตโนมัติ
          </span>
        ` : (sim && !sim.isSufficient) ? `
          <span
            class="collapsed-stock-pill short"
            title="ทดลองจอง: ขอ ${sim.rowQty} เครื่อง (สะสม ${sim.cumulativeRequested} / ในคลังมี ${sim.totalAvailable})"
          >
            <span class="sim-dot short"></span>
            ขาด ${sim.shortage} (มี ${sim.totalAvailable})
          </span>
        ` : '';

        const hasAcc = row.accessories && row.accessories.length > 0;
        const hasNote = Boolean(row.free_note && row.free_note.trim());
        const hasAtt = Boolean(row.attachments && row.attachments.length > 0);
        let detailsLineHtml = '';
        if (hasAcc || hasNote || hasAtt) {
          detailsLineHtml = `
            <div class="collapsed-details-line">
              ${hasAcc ? `<span class="collapsed-acc-text">📦 อุปกรณ์: ${escapeHtml(row.accessories.join(', '))}</span>` : ''}
              ${hasNote ? `<span class="collapsed-note-text">📝 ${escapeHtml(row.free_note.replace(/\n+/g, ' '))}</span>` : ''}
              ${hasAtt ? `<span class="collapsed-att-text">📎 ${row.attachments.length} ไฟล์แนบ</span>` : ''}
            </div>
          `;
        }

        return `
          <tr class="row-collapsed ${isNewRow ? 'row-newly-added' : ''}" data-row-idx="${rowIdx}" data-expand-row="${rowIdx}" title="แตะหรือคลิกเพื่อแก้ไขรายการนี้">
            <!-- 1. ลำดับ # -->
            <td class="cell-num text-center">
              <span class="collapsed-item-badge ${isRowComplete ? 'is-complete' : ''}">
                ${rowIdx + 1}
                ${isRowComplete ? `
                  <span class="badge-item-check-mini" title="เสร็จสมบูรณ์">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                      <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                  </span>
                ` : ''}
              </span>
            </td>

            <!-- 2. เลือกรุ่นสินค้า -->
            <td class="cell-model">
              <div class="collapsed-cell-model-wrap">
                <span class="collapsed-item-badge ${isRowComplete ? 'is-complete' : ''} mobile-only-badge">
                  ${rowIdx + 1}
                  ${isRowComplete ? `
                    <span class="badge-item-check-mini" title="เสร็จสมบูรณ์">
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
                    </span>
                  ` : ''}
                </span>
                <span class="collapsed-model-name">${escapeHtml(modelVal || (row.brand ? row.brand : ''))}</span>
                ${isSupplierOrSale && !hasBrand ? '<span class="badge-brand-missing" style="color:#ef4444; font-size:11px; margin-left:6px; font-weight:600;">(⚠️ ยังไม่ระบุแบรนด์)</span>' : ''}
                ${isNewRow ? '<span class="badge-card-new">ใหม่</span>' : ''}
              </div>
            </td>

            <!-- 3. จำนวน -->
            <td class="cell-qty text-center">
              <div class="collapsed-cell-qty-wrap">
                <span class="collapsed-qty-pill ${sim && !sim.isSufficient ? 'short' : ''}">${rowQty}</span>
                ${stockPillHtml}
              </div>
            </td>

            <!-- 4. Source (1-4) -->
            <td class="cell-source">
              <div class="collapsed-cell-source-wrap">
                <span class="collapsed-source-pill">${escapeHtml(row.source || 'Demo')}</span>
              </div>
            </td>

            <!-- 5. อุปกรณ์เสริม & S/N -->
            <td class="cell-options-cell">
              <div class="collapsed-cell-options-wrap">
                ${hasAcc ? `<span class="collapsed-acc-text" title="${escapeHtml(row.accessories.join(', '))}">📦 ${escapeHtml(row.accessories.join(', '))}</span>` : ''}
                ${snBadgeHtml}
                ${(!hasAcc && !snBadgeHtml) ? `<span class="collapsed-empty-dash">-</span>` : ''}
              </div>
            </td>

            <!-- 6. หมายเหตุ -->
            <td class="cell-note">
              <div class="collapsed-cell-note-wrap">
                ${hasNote ? `<span class="collapsed-note-text" title="${escapeHtml(row.free_note)}">📝 ${escapeHtml(row.free_note.replace(/\n+/g, ' '))}</span>` : ''}
                ${hasAtt ? `<span class="collapsed-att-text">📎 ${row.attachments.length} ไฟล์แนบ</span>` : ''}
                ${(!hasNote && !hasAtt) ? `<span class="collapsed-empty-dash">-</span>` : ''}
              </div>
            </td>

            <!-- 7. จัดการ -->
            <td class="cell-action text-center">
              <div class="cell-action-group">
                <button
                  type="button"
                  class="btn-item-edit btn-toggle-expand"
                  data-expand-row="${rowIdx}"
                  title="แก้ไขรายการนี้"
                  aria-label="แก้ไขรายการนี้"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button
                  type="button"
                  class="btn-item-dup"
                  data-excel-dup-row="${rowIdx}"
                  ${dupDisabledAttr}
                  title="${escapeHtml(dupTitle)}"
                  aria-label="${escapeHtml(dupTitle)}"
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                </button>
                <button type="button" class="btn-item-delete" data-excel-rm-row="${rowIdx}" title="ลบรายการนี้" aria-label="ลบรายการนี้">
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        `;
      }

      // Case 2: Row is blank and NOT active (trailing empty placeholder row)
      if (!isActive && isBlankRow) {
        return `
          <tr class="row-add-next-item" data-row-idx="${rowIdx}">
            <td colspan="7" class="cell-add-next-item">
              <button type="button" class="btn-add-next-item" data-expand-row="${rowIdx}">
                <span class="icon">＋</span>
                <span class="text">เพิ่มรายการที่ ${rowIdx + 1}</span>
              </button>
            </td>
          </tr>
        `;
      }

      // Case 3: Row is ACTIVE -> FULL EXPANDED EDITABLE CARD
      // 1. Accessories trigger button / summary (No static input fields)
      const accList = row.accessories || [];
      let accTriggerHtml = '';
      if (accList.length === 0) {
        accTriggerHtml = `
          <button type="button" class="btn-acc-trigger" data-open-acc-modal="${rowIdx}" title="แตะเพื่อเลือกอุปกรณ์เสริม">
            <span class="acc-trig-icon">📦</span>
            <span class="acc-trig-label">+ อุปกรณ์เสริม</span>
          </button>
        `;
      } else {
        const accSummary = accList.join(', ');
        accTriggerHtml = `
          <div class="acc-trig-filled-group">
            <button type="button" class="btn-acc-trigger filled" data-open-acc-modal="${rowIdx}" title="อุปกรณ์: ${escapeHtml(accSummary)} (แตะเพื่อแก้ไข)">
              <span class="acc-trig-icon">📦</span>
              <span class="acc-trig-label">อุปกรณ์ (${accList.length})</span>
              <span class="acc-trig-edit-hint">✏️</span>
            </button>
            <button type="button" class="btn-clear-acc-quick" data-clear-all-acc="${rowIdx}" title="ล้างอุปกรณ์เสริมทั้งหมด">✕</button>
          </div>
        `;
      }

      // 2. S/N trigger button / summary (No static input fields)
      let snTriggerHtml = '';
      if (filledSn.length === 0) {
        snTriggerHtml = `
          <button type="button" class="btn-sn-trigger" data-open-sn-modal="${rowIdx}" title="แตะเพื่อระบุ S/N เครื่อง">
            <span class="sn-trig-icon">🏷️</span>
            <span class="sn-trig-label">+ ระบุ S/N</span>
            <span class="sn-trig-qty-badge">${rowQty}</span>
          </button>
        `;
      } else if (filledSn.length === rowQty) {
        const snSummary = filledSn.join(', ');
        snTriggerHtml = `
          <div class="sn-trig-filled-group">
            <button type="button" class="btn-sn-trigger filled complete" data-open-sn-modal="${rowIdx}" title="S/N: ${escapeHtml(snSummary)} (แตะเพื่อแก้ไข)">
              <span class="sn-trig-icon">✅</span>
              <span class="sn-trig-label">S/N ครบ (${rowQty})</span>
            </button>
            <button type="button" class="btn-clear-sn-quick" data-clear-all-sn="${rowIdx}" title="ลบ S/N ออก">✕</button>
          </div>
        `;
      } else {
        snTriggerHtml = `
          <div class="sn-trig-filled-group">
            <button type="button" class="btn-sn-trigger filled warn" data-open-sn-modal="${rowIdx}" title="แตะเพื่อระบุ S/N ให้ครบตามจำนวน (${filledSn.length}/${rowQty})">
              <span class="sn-trig-icon">⚠️</span>
              <span class="sn-trig-label">S/N: ${filledSn.length}/${rowQty}</span>
            </button>
            <button type="button" class="btn-clear-sn-quick" data-clear-all-sn="${rowIdx}" title="ลบ S/N ออก">✕</button>
          </div>
        `;
      }

      return `
        <tr class="${isBlankRow ? 'row-empty' : ''} row-active-expanded ${isNewRow ? 'row-newly-added' : ''}" data-row-idx="${rowIdx}">
          <!-- Col 1: Index Number with Completion Indicator Symbol -->
          <td class="cell-num ${isRowComplete ? 'is-complete' : ''}" title="${isRowComplete ? 'รายการนี้เสร็จสมบูรณ์แล้ว' : 'รายการที่ ' + (rowIdx + 1)}">
            <span class="cell-num-badge">
              <span>${rowIdx + 1}</span>
              ${isRowComplete ? `
                <span class="badge-item-check" title="เสร็จสมบูรณ์">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </span>
              ` : ''}
            </span>
            <span class="mobile-item-title">เลือกรุ่น</span>
            ${isNewRow ? '<span class="badge-card-new">ใหม่</span>' : ''}
          </td>

          <!-- Col 2: Model Search Input (and Brand Input for Supplier/คลังขาย) -->
          <td class="model-picker-cell ${isSupplierOrSale ? 'is-custom-source-cell' : ''}">
            ${isSupplierOrSale ? `
              <div class="custom-source-inputs-wrap">
                <!-- Brand Input -->
                <div class="brand-field-wrap">
                  <div class="input-clearable-wrap has-dropdown">
                    <input
                      type="text"
                      class="cell-inline-edit brand-search-input"
                      placeholder="แบรนด์ (Brand)..."
                      value="${escapeHtml(row.brand || '')}"
                      data-excel-brand-input="${rowIdx}"
                      autocomplete="off"
                    />
                    <div class="input-actions-end">
                      <button type="button" class="btn-input-clear ${row.brand ? '' : 'hidden'}" data-clear-brand="${rowIdx}" title="ล้างค่า">✕</button>
                      <button type="button" class="btn-input-dropdown-arrow" data-brand-dropdown-trigger="${rowIdx}" title="เลือกแบรนด์">▾</button>
                    </div>
                  </div>
                </div>

                <!-- Model Input -->
                <div class="model-field-wrap">
                  <div class="model-input-wrap">
                    <input
                      type="text"
                      class="cell-inline-edit model-search-input"
                      placeholder="ระบุรุ่นสินค้า..."
                      value="${escapeHtml(row.model || '')}"
                      data-excel-model-input="${rowIdx}"
                      autocomplete="off"
                    />
                    <div class="input-actions-end">
                      <button
                        type="button"
                        class="btn-clear-model-input ${row.model ? '' : 'hidden'}"
                        data-clear-model="${rowIdx}"
                        title="ล้างรุ่นที่เลือก"
                        tabindex="-1"
                        aria-label="ล้างรุ่นที่เลือก"
                      >✕</button>
                    </div>
                  </div>
                </div>
              </div>
            ` : `
              <div class="model-input-wrap">
                <input
                  type="text"
                  class="cell-inline-edit model-search-input"
                  placeholder="พิมพ์ค้นหารุ่นสินค้า (เช่น EDA52, ZT411)..."
                  value="${escapeHtml(modelVal)}"
                  data-excel-model-input="${rowIdx}"
                  autocomplete="off"
                />
                <div class="input-actions-end">
                  <button
                    type="button"
                    class="btn-clear-model-input ${modelVal ? '' : 'hidden'}"
                    data-clear-model="${rowIdx}"
                    title="ล้างรุ่นที่เลือก"
                    tabindex="-1"
                    aria-label="ล้างรุ่นที่เลือก"
                  >✕</button>
                  <button
                    type="button"
                    class="btn-keyboard-toggle"
                    title="แสดง/ซ่อน แป้นพิมพ์บนหน้าจอ"
                    aria-label="แสดง/ซ่อน แป้นพิมพ์"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                      <line x1="6" y1="8" x2="6" y2="8"></line>
                      <line x1="10" y1="8" x2="10" y2="8"></line>
                      <line x1="14" y1="8" x2="14" y2="8"></line>
                      <line x1="18" y1="8" x2="18" y2="8"></line>
                      <line x1="6" y1="12" x2="6" y2="12"></line>
                      <line x1="10" y1="12" x2="10" y2="12"></line>
                      <line x1="14" y1="12" x2="14" y2="12"></line>
                      <line x1="18" y1="12" x2="18" y2="12"></line>
                      <line x1="7" y1="16" x2="17" y2="16"></line>
                    </svg>
                  </button>
                </div>
                <div class="model-dropdown-menu hidden" data-model-dropdown="${rowIdx}"></div>
              </div>
            `}
          </td>

          <!-- Col 3: Quantity with +/- Stepper & Real-time Stock Simulation -->
          <td class="cell-qty" style="text-align:center;">
            <div class="qty-stepper-wrap">
              <div class="qty-stepper ${sim && !sim.isSufficient ? 'is-qty-short' : ''}">
                <button type="button" class="qty-step-btn" data-qty-dec="${rowIdx}" title="ลดจำนวน">−</button>
                <input
                  type="number"
                  min="1"
                  max="99"
                  class="qty-step-input"
                  value="${rowQty}"
                  data-excel-qty="${rowIdx}"
                />
                <button type="button" class="qty-step-btn" data-qty-inc="${rowIdx}" title="เพิ่มจำนวน">+</button>
              </div>
              ${sim?.isAutoSupplier ? `
                <div class="stock-sim-tag auto-supplier" title="สินค้าจากการยืม Supplier จะถูกเพิ่มเข้าคลัง Supplier ในระบบอัตโนมัติ">
                  <span class="sim-dot auto-supplier"></span>
                  <span>เพิ่มเข้าคลัง Supplier อัตโนมัติ</span>
                </div>
              ` : sim?.isAutoSale ? `
                <div class="stock-sim-tag auto-supplier" title="สินค้าจากคลังขาย จะถูกเพิ่มเข้าคลังในระบบอัตโนมัติ">
                  <span class="sim-dot auto-supplier"></span>
                  <span>เพิ่มเข้าคลังขาย อัตโนมัติ</span>
                </div>
              ` : (sim && !sim.isSufficient) ? `
                <div class="stock-sim-tag short" title="ทดลองจอง: ขอ ${sim.rowQty} เครื่อง (สะสม ${sim.cumulativeRequested} / ในคลังมี ${sim.totalAvailable})">
                  <span class="sim-dot short"></span>
                  <span>ขาด ${sim.shortage} (มี ${sim.totalAvailable})</span>
                </div>
              ` : ''}
            </div>
          </td>

          <!-- Col 4: Source (1. Demo / 2. Supplier / 3. คลังขาย / 4. ทดแทนระหว่างซ่อม) -->
          <td class="cell-source">
            <button
              type="button"
              class="cell-inline-edit cell-source-btn"
              data-source-trigger="${rowIdx}"
              title="แตะเพื่อเลือกแหล่งที่มา (Demo / Supplier / คลังขาย / ทดแทนระหว่างซ่อม)"
            >
              <span class="source-btn-text">
                ${formatSourceLabel(row.source)}
              </span>
              <span class="source-btn-arrow">▾</span>
            </button>
            <input type="hidden" data-excel-source="${rowIdx}" value="${escapeHtml(row.source || 'Demo')}" />
          </td>

          <!-- Col 5: Triggers for Accessories & S/N (Buttons on same line, placed below Qty & Source) -->
          <td class="cell-options-cell">
            <div class="cell-options-wrap">
              ${accTriggerHtml}
              ${snTriggerHtml}
            </div>
          </td>

          <!-- Col 6: Free Text Note & Attachments -->
          <td class="cell-note">
            <div class="note-unified-box">
              <textarea
                class="cell-inline-edit note-box-textarea"
                placeholder="พิมพ์หมายเหตุ..."
                data-excel-free-note="${rowIdx}"
                rows="1"
              >${escapeHtml(row.free_note || '')}</textarea>
              <div class="note-box-tags" data-note-attachments="${rowIdx}">
                ${renderNoteAttachmentPills(row.attachments || [], rowIdx)}
              </div>
              <button type="button" class="btn-box-clip" data-trigger-attach="${rowIdx}" title="แนบไฟล์หรือรูปภาพ">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                </svg>
              </button>
              <input type="file" multiple class="hidden-file-input" data-note-file-input="${rowIdx}" style="display:none;" />
            </div>
          </td>

          <!-- Col 7: Actions (Duplicate & Delete) -->
          <td class="cell-action" style="text-align:center;">
            <div class="cell-action-group">
              ${hasModel ? `
                <button type="button" class="btn-collapse-mobile" data-collapse-row="${rowIdx}" title="ย่อรายการนี้" aria-label="ย่อรายการ">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="18 15 12 9 6 15"></polyline>
                  </svg>
                </button>
              ` : ''}
              <button
                type="button"
                class="btn-item-dup"
                data-excel-dup-row="${rowIdx}"
                ${dupDisabledAttr}
                title="${escapeHtml(dupTitle)}"
                aria-label="${escapeHtml(dupTitle)}"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button
                type="button"
                class="btn-item-delete btn-item-delete-active"
                data-excel-rm-row="${rowIdx}"
                ${(state.loanDraftRows.length <= 1 && !row.model && (!row.accessories || row.accessories.length === 0) && !row.free_note) ? 'disabled' : ''}
                title="ลบรายการนี้"
                aria-label="ลบรายการนี้"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  <line x1="10" y1="11" x2="10" y2="17"></line>
                  <line x1="14" y1="11" x2="14" y2="17"></line>
                </svg>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  // Auto-resize note textareas for pre-filled or multiline notes
  tbody.querySelectorAll('.note-box-textarea, .cell-note-textarea').forEach(ta => {
    if (ta.value && (ta.value.includes('\n') || ta.scrollHeight > 28)) {
      ta.style.height = 'auto';
      ta.style.height = `${ta.scrollHeight}px`;
    } else {
      ta.style.height = '22px';
    }
  });
}

function renderLoanBeforePhotosPreview() {
  const container = document.getElementById('loanBeforePhotosPreview');
  if (state.loanBeforePhotos.length === 0) {
    container.innerHTML = `<span class="muted-hint">ยังไม่มีรูปถ่ายก่อนส่ง (กดปุ่ม "+ ถ่ายรูป / แนบรูป" ด้านบนได้เลย)</span>`;
    return;
  }
  container.innerHTML = state.loanBeforePhotos
    .map(
      (src, idx) => `
      <div class="photo-thumb">
        <img src="${src}" alt="Before photo ${idx + 1}" />
        <button type="button" data-rm-before-photo="${idx}">×</button>
      </div>
    `
    )
    .join('');
}

// ============================================================================
// MODAL 1B: หน้าจัดของ & Match S/N (Minimal Excel-like Picking Sheet)
// ============================================================================
function updateDispatchSummary() {
  const total = (state.dispatchDraftItems || []).length;
  const matched = (state.dispatchDraftItems || []).filter(r => Boolean(r.tag_id)).length;
  const totalPhotos = (state.dispatchDraftItems || []).reduce((acc, r) => acc + (r.photos || []).length, 0);

  const loan = state.activeDispatchLoan;
  const isPendingQc = loan?.status === 'Pending_QC';
  const isDispatched = loan?.status === 'Dispatched';
  const isDelivered = loan?.status === 'Delivered';
  const isPartial = loan?.status === 'Partially_Returned';
  const isDeliveredLoan = isDelivered || isPartial;
  const isReadOnly = (isDispatched || isDeliveredLoan) && !state.dispatchOnsiteEditMode && !state.dispatchReturnMode;
  const hasBorrowerSig = Boolean(loan?.signatures?.borrower?.signature);

  const hintEl = document.getElementById('dispatchStatusHint');
  if (hintEl) {
    if (state.dispatchReturnMode) {
      const currentUserName = getLoggedInUserName();
      const existingInp = document.getElementById('dispatchReturnReceiverName');
      const currentReceiverVal = (existingInp && existingInp.value !== undefined) ? existingInp.value : currentUserName;
      const isSub = Boolean(currentReceiverVal && currentReceiverVal.trim() !== currentUserName);
      hintEl.innerHTML = `
        <div class="ret-inspector-box">
          <span class="ret-inspector-label">ผู้รับคืน:</span>
          <div class="input-clearable-wrap ret-inspector-input-wrap">
            <input 
              type="text" 
              id="dispatchReturnReceiverName" 
              class="form-control" 
              value="${escapeHtml(currentReceiverVal)}" 
              data-default-user="${escapeHtml(currentUserName)}"
              placeholder="ระบุชื่อผู้รับคืน..." 
              autocomplete="off" 
            />
            <button type="button" class="btn-input-clear ${currentReceiverVal ? '' : 'hidden'}" data-clear-target="dispatchReturnReceiverName" title="ล้างค่า">✕</button>
          </div>
          <span id="dispatchReceiverSubTag" class="${isSub ? '' : 'hidden'}" style="font-size:11px; font-weight:600; color:#b45309; background:#fef3c7; border:1px solid #fde68a; padding:2px 7px; border-radius:4px; white-space:nowrap;" title="บันทึกเป็นผู้รับคืนทดแทน">
            (ทดแทน)
          </span>
        </div>
      `;
    } else if (isDeliveredLoan) {
      const alreadyRetCount = (state.dispatchDraftItems || []).filter(r => r.returned).length;
      const unretCount = total - alreadyRetCount;
      hintEl.innerHTML = `
        <span class="dispatch-hint-badge ${isPartial ? 'warning' : 'success'}" style="${isPartial ? 'background:#fff7ed; color:#c2410c; border-color:#fed7aa;' : 'background:#eff6ff; color:#1d4ed8; border-color:#dbeafe;'}">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            ${isPartial ? '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>' : '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>'}
          </svg>
          <span>${isPartial ? `ยังไม่คืน ${unretCount}/${total} เครื่อง` : `กำลังยืม (${total} เครื่อง)`}</span>
        </span>
      `;
    } else if (isReadOnly) {
      hintEl.innerHTML = `
        <span class="dispatch-hint-badge success">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>พร้อมส่งมอบ (${matched}/${total})</span>
          <span style="opacity:0.4;">·</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          <span>${totalPhotos} รูป</span>
        </span>
      `;
    } else if (isDispatched && state.dispatchOnsiteEditMode) {
      hintEl.innerHTML = `
        <span class="dispatch-hint-badge pending" style="background:#fef3c7; color:#92400e; border-color:#fde68a;">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
          <span>แก้ไขหน้างาน (${matched}/${total})</span>
        </span>
      `;
    } else if (matched === total && total > 0) {
      hintEl.innerHTML = `
        <span class="dispatch-hint-badge success">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          <span>จัดครบแล้ว (${matched}/${total})</span>
          <span style="opacity:0.4;">·</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          <span>${totalPhotos} รูป</span>
        </span>
      `;
    } else {
      hintEl.innerHTML = `
        <span class="dispatch-hint-badge pending">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
          <span>จัดแล้ว ${matched}/${total}</span>
          <span style="opacity:0.4;">·</span>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
          <span>${totalPhotos} รูป</span>
        </span>
      `;
    }
  }

  const isComplete = total > 0 && matched === total;

  const btnCancelPre = document.getElementById('btnCancelPreDispatchLoan');
  if (btnCancelPre) {
    // Only allow canceling loan strictly before picking (status === 'Requested' and matched === 0)
    const canCancel = loan && loan.status === 'Requested' && matched === 0 && !state.dispatchReturnMode;
    btnCancelPre.classList.toggle('hidden', !canCancel);
    if (canCancel) {
      btnCancelPre.setAttribute('data-cancel-loan', loan.id);
      btnCancelPre.style.display = '';
    } else {
      btnCancelPre.removeAttribute('data-cancel-loan');
      btnCancelPre.style.display = 'none';
    }
  }

  const rightBtnsEl = document.getElementById('dispatchFooterRightBtns');
  if (rightBtnsEl) {
    if (state.dispatchReturnMode) {
      const isPendingQc = loan && loan.status === 'Pending_QC';
      const totalLoanItems = (state.dispatchDraftItems || []).length;
      const alreadyReturned = (state.dispatchDraftItems || []).filter(r => r.returned).length;
      const remainingToReturn = totalLoanItems - alreadyReturned;
      const currentSelected = (state.dispatchDraftItems || []).filter(r => r.selectedForReturn && !r.returned).length;
      const isPartial = currentSelected > 0 && currentSelected < remainingToReturn;

      const isEnabled = currentSelected > 0;
      rightBtnsEl.innerHTML = `
        ${isPendingQc ? `
          <button type="button" class="btn btn-ghost text-muted" id="btnRevertQcToDelivered" style="font-size:12px; margin-right:auto;" title="ย้อนกลับไปสถานะกำลังยืม">
            ↩️ ย้อนกลับเป็นกำลังยืม
          </button>
        ` : ''}
        <button type="button" class="btn btn-ghost" id="btnCancelReturnMode">
          ${isPendingQc ? 'ปิด' : 'ยกเลิก'}
        </button>
        <button 
          type="button" 
          class="btn ${isEnabled ? 'btn-success' : 'btn-secondary is-disabled'} btn-submit-return" 
          id="btnSubmitReturn" 
          ${isEnabled ? '' : 'disabled'}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>${isPendingQc ? `ตรวจ QC ผ่าน — รับเข้าคลัง (${currentSelected}/${remainingToReturn} เครื่อง)` : isEnabled ? `บันทึกการรับคืน (${currentSelected}/${remainingToReturn} เครื่อง)${isPartial ? ' — คืนบางส่วน' : ''}` : 'บันทึกการรับคืน (เลือกเครื่องที่คืน)'}</span>
        </button>
      `;
    } else if (isDeliveredLoan) {
      rightBtnsEl.innerHTML = `
        <button type="button" class="btn btn-outline btn-dispatch-edit-note" id="btnDispatchEditFromFooter" title="แก้ไขหมายเหตุการยืม">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          <span>แก้ไขหมายเหตุ</span>
        </button>
        <button type="button" class="btn btn-success btn-dispatch-return" id="btnDispatchStartReturn" title="เริ่มขั้นตอนการคืนสินค้า">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="7 10 12 15 17 10"></polyline>
            <line x1="12" y1="15" x2="12" y2="3"></line>
          </svg>
          <span>คืนสินค้า</span>
        </button>
      `;
    } else if (isReadOnly) {
      rightBtnsEl.innerHTML = `
        <button type="button" class="btn btn-outline btn-dispatch-edit-full" id="btnDispatchEditFromFooter" title="แก้ไขข้อมูลใบยืม / เพิ่มสินค้า">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
          <span>แก้ไขใบยืม</span>
        </button>
        <button type="button" class="btn btn-outline btn-borrower-sig ${hasBorrowerSig ? 'is-signed' : ''}" id="btnDispatchSignBorrower" title="ลงลายเซ็นดิจิทัลผู้ยืม / ผู้รับเครื่อง">
          ${
            hasBorrowerSig
              ? `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>เซ็นต์รับแล้ว</span>
          `
              : `
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 20h9"></path>
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>
            </svg>
            <span>เซ็นต์รับของ</span>
          `
          }
        </button>
        <button type="button" class="btn btn-primary btn-dispatch-deliver" id="btnDispatchDeliver" title="บันทึกการส่งมอบสินค้า (ถ่ายรูป + GPS)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="1" y="3" width="15" height="13"></rect>
            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
            <circle cx="5.5" cy="18.5" r="2.5"></circle>
            <circle cx="18.5" cy="18.5" r="2.5"></circle>
          </svg>
          <span>ส่งมอบสินค้า</span>
        </button>
      `;
    } else if (isDispatched && state.dispatchOnsiteEditMode) {
      rightBtnsEl.innerHTML = `
        <button type="button" class="btn btn-ghost" id="btnCancelOnsiteEdit">
          ยกเลิก
        </button>
        <button type="submit" class="btn btn-purple btn-save-dispatch ${isComplete ? '' : 'is-disabled'}" id="btnSubmitDispatch" ${isComplete ? '' : 'disabled'}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
            <polyline points="17 21 17 13 7 13 7 21"></polyline>
            <polyline points="7 3 7 8 15 8"></polyline>
          </svg>
          <span>บันทึกการแก้ไขหน้างาน</span>
        </button>
      `;
    } else {
      rightBtnsEl.innerHTML = `
        <button type="submit" class="btn btn-purple btn-save-dispatch ${isComplete ? '' : 'is-disabled'}" id="btnSubmitDispatch" ${isComplete ? '' : 'disabled'}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          <span>บันทึกการจัดของ</span>
        </button>
      `;
    }
  }
}

function openDispatchModal(loanId, updateHash = true) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) return;

  if (updateHash) updateUrlHash('modal', `dispatch-${loan.id}`);
  state.activeDispatchLoan = loan;
  const isPendingQc = loan.status === 'Pending_QC';
  state.dispatchReturnMode = isPendingQc;
  state.dispatchReturnPhotos = [];

  // Initialize draft items with their photos
  const isAlreadyDispatched = ['Dispatched', 'Overdue', 'Delivered', 'Pending_QC', 'Partially_Returned', 'Returned'].includes(loan.status);
  state.dispatchDraftItems = (loan.items || []).map(it => {
    const existingTag = isAlreadyDispatched ? (it.tag_id || '') : '';
    const assetObj = existingTag ? state.assets.find(a => a.tag_id === existingTag) : null;
    const existingPhotos = Array.isArray(it.photos)
      ? [...it.photos]
      : Array.isArray(it.attachments)
      ? it.attachments.filter(a => a.url).map(a => a.url)
      : [];

    const isAlreadyFullyReturned = Boolean(it.returned) && it.returned_to_location === 1 && it.qc_status !== 'Pending';
    const isInQcQueue = isPendingQc && !isAlreadyFullyReturned;

    return {
      id: it.id,
      brand: it.brand || (assetObj ? assetObj.brand : ''),
      model: it.model || (assetObj ? assetObj.model : ''),
      tag_id: existingTag,
      serial_no: it.serial_no || (assetObj ? assetObj.serial_no : ''),
      source: it.source_snapshot || (assetObj ? assetObj.source : 'Demo'),
      accessories:
        it.loan_accessories && it.loan_accessories.length > 0
          ? [...it.loan_accessories]
          : assetObj
          ? [...(assetObj.accessories || [])]
          : [],
      photos: existingPhotos,
      free_note: it.loan_free_note || (assetObj ? assetObj.free_note || '' : ''),
      attachments: [...(it.attachments || [])],
      returned: isAlreadyFullyReturned,
      returned_at: it.returned_at || it.return_date || (it.returned && loan.return_date ? loan.return_date : null),
      selectedForReturn: isPendingQc ? isInQcQueue : false,
      scannedSn: '',
      allAccessories: [...(it.loan_accessories || (assetObj ? assetObj.accessories : []) || [])],
      missingAccessories: new Set(it.missing_accessories || []),
      qcStatus: it.qc_status === 'Fail' ? 'Fail' : 'Pass',
      qcNote: it.qc_note || '',
      isInQcQueue
    };
  });

  // Set loan code in both desktop inline and mobile subline (as clickable doc link)
  const docLinkSvg = `<svg class="doc-link-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>`;
  const loanIdEl = document.getElementById('dispatchTitleLoanId');
  if (loanIdEl) {
    loanIdEl.innerHTML = `<button type="button" class="doc-link-pill dispatch-doc-pill" data-open-print="${escapeHtml(loan.id)}" title="คลิกเพื่อดูใบยืมจริง ${escapeHtml(loan.id)}"><span>${escapeHtml(loan.id)}</span>${docLinkSvg}</button>`;
  }
  const mobileLoanCodeEl = document.getElementById('dispatchMobileLoanCode');
  if (mobileLoanCodeEl) {
    mobileLoanCodeEl.innerHTML = `<button type="button" class="doc-link-pill dispatch-doc-pill" data-open-print="${escapeHtml(loan.id)}" title="คลิกเพื่อดูใบยืมจริง ${escapeHtml(loan.id)}"><span>${escapeHtml(loan.id)}</span>${docLinkSvg}</button>`;
  }

  const stageBadge = document.getElementById('dispatchStageBadge');
  state.dispatchOnsiteEditMode = false;
  const isDispatched = loan.status === 'Dispatched';
  const isDelivered = loan.status === 'Delivered';
  const isPartial = loan.status === 'Partially_Returned';
  const isOverdue = loan.is_overdue;

  const titleIconEl = document.querySelector('#dispatchDialogTitle .dispatch-title-icon');
  const titleTextEl = document.querySelector('#dispatchDialogTitle .dispatch-title-text');
  if (titleIconEl) {
    if (isPendingQc) {
      titleIconEl.textContent = '🔍';
    } else if (state.dispatchReturnMode) {
      titleIconEl.textContent = '📥';
    } else if (isDelivered || isPartial) {
      titleIconEl.textContent = '📦';
    } else if (isDispatched) {
      titleIconEl.textContent = '🚚';
    } else {
      titleIconEl.textContent = '📦';
    }
  }
  if (titleTextEl) {
    if (isPendingQc) {
      titleTextEl.textContent = 'ตรวจสภาพสินค้า (QC) & รับคืนเข้าคลัง';
    } else if (state.dispatchReturnMode) {
      titleTextEl.textContent = 'ตรวจรับคืนสินค้า';
    } else if (isPartial || isDelivered) {
      titleTextEl.textContent = 'รายการสินค้าที่กำลังยืม';
    } else if (isDispatched) {
      titleTextEl.textContent = 'ส่งมอบสินค้า';
    } else {
      titleTextEl.textContent = 'จัดของ & Match S/N';
    }
  }

  const scannerBar = document.getElementById('dispatchBarcodeScannerBar');
  if (scannerBar) {
    scannerBar.classList.toggle('hidden', (isDispatched || isDelivered || isPartial) && !isPendingQc && !state.dispatchOnsiteEditMode && !state.dispatchReturnMode);
  }

  if (stageBadge) {
    if (isPendingQc) {
      stageBadge.textContent = 'รอตรวจ QC';
      stageBadge.className = 'badge-stage-pill';
      stageBadge.style.background = '#fef3c7';
      stageBadge.style.color = '#b45309';
      stageBadge.style.borderColor = '#fde68a';
    } else if (state.dispatchReturnMode) {
      stageBadge.textContent = 'ตรวจรับคืนสินค้า';
      stageBadge.className = 'badge-stage-pill';
      stageBadge.style.background = '#dcfce7';
      stageBadge.style.color = '#15803d';
      stageBadge.style.borderColor = '#bbf7d0';
    } else if (isPartial) {
      stageBadge.textContent = 'คืนไม่ครบ';
      stageBadge.className = 'badge-stage-pill';
      stageBadge.style.background = '#ffedd5';
      stageBadge.style.color = '#9a3412';
      stageBadge.style.borderColor = '#fed7aa';
    } else if (isDelivered) {
      stageBadge.textContent = isOverdue ? 'เกินกำหนด' : 'กำลังยืม';
      stageBadge.className = 'badge-stage-pill';
      stageBadge.style.background = isOverdue ? '#fee2e2' : '#dbeafe';
      stageBadge.style.color = isOverdue ? '#991b1b' : '#1e40af';
      stageBadge.style.borderColor = isOverdue ? '#fecaca' : '#bfdbfe';
    } else if (isDispatched) {
      stageBadge.textContent = 'รอส่งมอบ';
      stageBadge.className = 'badge-stage-pill';
      stageBadge.style.background = '#e0e7ff';
      stageBadge.style.color = '#3730a3';
      stageBadge.style.borderColor = '#c7d2fe';
    } else {
      stageBadge.textContent = loan.status === 'Dispatching' ? 'กำลังจัดของ' : 'รอจัดของ';
      stageBadge.className = 'badge-stage-pill badge-stage-picking';
      stageBadge.style.background = '';
      stageBadge.style.color = '';
      stageBadge.style.borderColor = '';
    }
  }

  const proofSection = document.getElementById('dispatchReturnProofSection');
  if (proofSection) {
    proofSection.classList.toggle('hidden', !state.dispatchReturnMode);
  }

  // Populate Document Summary Strip
  const companyEl = document.getElementById('dispatchCustomerCompany');
  if (companyEl) companyEl.textContent = loan.customer_company || loan.customer_name || '-';

  const borrowerEl = document.getElementById('dispatchBorrowerName');
  if (borrowerEl) borrowerEl.textContent = loan.borrower_name || '-';

  const dueEl = document.getElementById('dispatchDueDate');
  if (dueEl) dueEl.textContent = formatShortDate(loan.due_date);

  const purposeEl = document.getElementById('dispatchPurpose');
  if (purposeEl) purposeEl.textContent = loan.purpose || 'Demo';

  const barcodeInput = document.getElementById('dispatchGlobalBarcodeInput');
  if (barcodeInput) {
    barcodeInput.value = '';
    barcodeInput.placeholder = state.dispatchReturnMode
      ? 'ยิงบาร์โค้ด S/N หรือ Tag ID เพื่อติ๊กคืนสินค้า...'
      : 'ยิงบาร์โค้ด S/N หรือ Tag ID เพื่อจัดของ...';
  }

  state.activeDispatchRowIdx = null; // Start with clean minimal checklist
  closeDispatchSnDropdown();
  closeLiveCamera();

  renderDispatchTable();
  updateDispatchSummary();
  document.getElementById('dispatchDialog').showModal();

  setTimeout(() => {
    const input = document.getElementById('dispatchGlobalBarcodeInput');
    const bar = document.getElementById('dispatchBarcodeScannerBar');
    if (input && bar && !bar.classList.contains('hidden')) {
      input.focus();
      input.select?.();
    }
  }, 100);
}

function closeDispatchSnDropdown() {
  const dropdown = document.getElementById('dispatchSnDropdownMenu');
  if (dropdown) dropdown.classList.add('hidden');

  let hasRestored = false;
  if (state.dispatchDraftItems) {
    for (const row of state.dispatchDraftItems) {
      if (!row.tag_id && row._backupTagId) {
        row.tag_id = row._backupTagId;
        delete row._backupTagId;
        hasRestored = true;
      }
    }
  }

  if (hasRestored) {
    renderDispatchTable();
  }
}

function renderDispatchReturnPhotosPreview() {
  const container = document.getElementById('dispatchReturnPhotosPreview');
  const watermark = document.getElementById('dispatchReturnWatermark');
  const box = document.getElementById('dispatchReturnImageBox');
  if (!container) return;

  const photos = state.dispatchReturnPhotos || [];
  if (watermark) {
    if (photos.length > 0) {
      watermark.classList.add('hidden');
    } else {
      watermark.classList.remove('hidden');
    }
  }
  if (box) {
    if (photos.length > 0) {
      box.classList.add('has-photos');
    } else {
      box.classList.remove('has-photos');
    }
  }

  if (photos.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = photos.map((src, idx) => `
    <div class="demo-photo-thumb-card" style="position:relative; width:82px; height:82px; border-radius:8px; overflow:hidden; border:1px solid #cbd5e1; box-shadow:0 1px 3px rgba(0,0,0,0.06); cursor:pointer;" data-preview-ret-photo="${idx}" title="คลิกเพื่อดูรูปขยาย">
      <img src="${src}" alt="Return Photo ${idx + 1}" style="width:100%; height:100%; object-fit:cover;" />
      <button type="button" data-rm-ret-photo="${idx}" style="position:absolute; top:3px; right:3px; width:20px; height:20px; background:rgba(239, 68, 68, 0.9); color:#fff; border:none; border-radius:50%; font-size:11px; cursor:pointer; display:flex; align-items:center; justify-content:center; box-shadow:0 1px 3px rgba(0,0,0,0.25);" title="ลบรูป">✕</button>
    </div>
  `).join('');
}

function closeDispatchAccDropdown() {
  const dropdown = document.getElementById('dispatchAccDropdownMenu');
  if (dropdown) dropdown.classList.add('hidden');
}

let suppressNextAccFocus = false;

function addAccToDispatchRow(rowIdx, val) {
  const row = (state.dispatchDraftItems || [])[rowIdx];
  if (!row) return;
  const cleanVal = (val || '').trim();
  if (!cleanVal) return;

  if (!row.accessories) row.accessories = [];
  if (!row.accessories.some(a => a.toLowerCase() === cleanVal.toLowerCase())) {
    row.accessories.push(cleanVal);
  }
  if (!state.accessorySuggestions.some(a => a.toLowerCase() === cleanVal.toLowerCase())) {
    state.accessorySuggestions.push(cleanVal);
    renderDatalists();
  }
  closeDispatchAccDropdown();
  renderDispatchTable();
  showToast(`✓ เพิ่มอุปกรณ์: ${cleanVal}`);
  suppressNextAccFocus = true;
  setTimeout(() => {
    const inp = document.getElementById(`dispatchAccInput_${rowIdx}`);
    if (inp) {
      inp.value = '';
      inp.focus();
    }
    setTimeout(() => {
      suppressNextAccFocus = false;
    }, 100);
  }, 40);
}

// ============================================================================
// LIVE CAMERA VIEWFINDER LOGIC (WebRTC + Snapshot to Canvas)
// ============================================================================
let liveCameraStream = null;
let currentFacingMode = 'environment';
let liveCameraRowIdx = null;

async function openLiveCamera(rowIdx) {
  liveCameraRowIdx = rowIdx;
  const row = (state.dispatchDraftItems || [])[rowIdx];
  const modal = document.getElementById('dispatchLiveCameraDialog');
  if (!modal) {
    state.activeDispatchPhotoRowIdx = rowIdx;
    document.getElementById('dispatchCameraInput')?.click();
    return;
  }

  const titleEl = document.getElementById('dispatchCameraDialogTitle');
  if (titleEl) {
    if (rowIdx === 'return') {
      titleEl.textContent = 'ถ่ายรูปหลักฐานการคืนสินค้า (รูปรวม)';
    } else {
      const modelName = row ? `${row.brand || ''} ${row.model || ''}`.trim() : '';
      titleEl.textContent = modelName ? `ถ่ายรูป: ${modelName}` : 'ถ่ายรูปสินค้า Demo';
    }
  }

  const video = document.getElementById('dispatchCameraVideo');
  const canvas = document.getElementById('dispatchCameraCanvas');
  const loading = document.getElementById('dispatchCameraLoading');
  const errorBox = document.getElementById('dispatchCameraError');
  const liveControls = document.getElementById('cameraLiveControls');
  const reviewControls = document.getElementById('cameraReviewControls');
  const switchBtn = document.getElementById('btnSwitchCamera');

  if (video) {
    video.style.display = 'block';
    video.srcObject = null;
  }
  if (canvas) canvas.style.display = 'none';
  if (loading) loading.style.display = 'flex';
  if (errorBox) errorBox.style.display = 'none';
  if (liveControls) liveControls.style.display = 'flex';
  if (reviewControls) reviewControls.style.display = 'none';

  modal.showModal();

  // Check camera support
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCameraError('เบราว์เซอร์นี้ไม่รองรับการเปิดกล้องโดยตรง');
    return;
  }

  try {
    const constraints = {
      video: {
        facingMode: { ideal: currentFacingMode },
        width: { ideal: 1280 },
        height: { ideal: 720 }
      },
      audio: false
    };

    liveCameraStream = await navigator.mediaDevices.getUserMedia(constraints);
    if (video) {
      video.srcObject = liveCameraStream;
      await video.play();
    }
    if (loading) loading.style.display = 'none';

    // Check if multiple cameras available
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(d => d.kind === 'videoinput');
      if (switchBtn) {
        switchBtn.style.display = videoDevices.length > 1 ? 'inline-flex' : 'none';
      }
    } catch (_) {}
  } catch (err) {
    console.warn('Cannot open live camera:', err);
    showCameraError(err.name === 'NotAllowedError' ? 'ไม่ได้รับอนุญาตให้เข้าถึงกล้อง (กรุณากด Allow เพื่อเปิดกล้อง)' : 'ไม่สามารถเปิดกล้องได้');
  }
}

function showCameraError(msg) {
  const loading = document.getElementById('dispatchCameraLoading');
  const errorBox = document.getElementById('dispatchCameraError');
  const errorMsg = document.getElementById('dispatchCameraErrorMsg');
  if (loading) loading.style.display = 'none';
  if (errorMsg) errorMsg.textContent = msg;
  if (errorBox) errorBox.style.display = 'flex';
}

function closeLiveCamera() {
  if (liveCameraStream) {
    liveCameraStream.getTracks().forEach(t => t.stop());
    liveCameraStream = null;
  }
  const video = document.getElementById('dispatchCameraVideo');
  if (video) video.srcObject = null;
  document.getElementById('dispatchLiveCameraDialog')?.close();
}

function snapLivePhoto() {
  const video = document.getElementById('dispatchCameraVideo');
  const canvas = document.getElementById('dispatchCameraCanvas');
  const liveControls = document.getElementById('cameraLiveControls');
  const reviewControls = document.getElementById('cameraReviewControls');

  if (!video || !canvas || !video.videoWidth) return;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  video.style.display = 'none';
  canvas.style.display = 'block';

  if (liveControls) liveControls.style.display = 'none';
  if (reviewControls) reviewControls.style.display = 'flex';
}

function retakeLivePhoto() {
  const video = document.getElementById('dispatchCameraVideo');
  const canvas = document.getElementById('dispatchCameraCanvas');
  const liveControls = document.getElementById('cameraLiveControls');
  const reviewControls = document.getElementById('cameraReviewControls');

  if (canvas) canvas.style.display = 'none';
  if (video) video.style.display = 'block';

  if (liveControls) liveControls.style.display = 'flex';
  if (reviewControls) reviewControls.style.display = 'none';
}

function useLivePhoto() {
  const canvas = document.getElementById('dispatchCameraCanvas');
  if (!canvas) return;

  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);

  if (liveCameraRowIdx === 'return') {
    if (!state.dispatchReturnPhotos) state.dispatchReturnPhotos = [];
    state.dispatchReturnPhotos.push(dataUrl);
    renderDispatchReturnPhotosPreview();
    showToast('📸 ถ่ายรูปหลักฐานการคืนเรียบร้อย');
    closeLiveCamera();
    return;
  }

  if (liveCameraRowIdx !== null && state.dispatchDraftItems[liveCameraRowIdx]) {
    const row = state.dispatchDraftItems[liveCameraRowIdx];
    if (!row.photos) row.photos = [];
    row.photos.push(dataUrl);
    renderDispatchTable();
    showToast('📸 ถ่ายรูปและบันทึกหลักฐานเรียบร้อย');
  }

  closeLiveCamera();
}

function renderDispatchSnDropdown(rowIdx, query = '') {
  const dropdown = document.getElementById('dispatchSnDropdownMenu');
  if (!dropdown) return;

  const targetInput = document.getElementById(`dispatchSnInput_${rowIdx}`) || document.querySelector(`[data-dispatch-sn-input="${rowIdx}"]`);
  if (!targetInput) return;

  const row = (state.dispatchDraftItems || [])[rowIdx];
  if (!row) return;

  const chosenSet = new Set(
    state.dispatchDraftItems
      .map((r, i) => (i !== rowIdx ? r.tag_id : null))
      .filter(Boolean)
  );

  const pool = state.assets.filter(
    a =>
      (a.status === 'Available' || a.tag_id === row.tag_id || a.tag_id === row._backupTagId) &&
      (!chosenSet.has(a.tag_id) || a.tag_id === row.tag_id || a.tag_id === row._backupTagId) &&
      a.model.toLowerCase() === (row.model || '').toLowerCase()
  );

  const q = String(query || '').trim().toLowerCase();
  let filtered = pool;
  if (q) {
    filtered = pool.filter(a => {
      const hay = `${a.serial_no || ''} ${a.tag_id || ''} ${a.location || ''} ${a.source || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }

  const modelTitle = `${row.brand || ''} ${row.model || ''}`.trim();
  const customItemHtml = q
    ? `
      <div
        class="model-dropdown-item custom-add-sn-item"
        data-add-custom-sn="${escapeHtml(query)}"
        data-row="${rowIdx}"
        title="เพิ่มและใช้ S/N นี้ทันที"
        style="background:#f5f3ff; border-top:1px dashed #c4b5fd; cursor:pointer;"
      >
        <div class="model-item-main">
          <span class="model-item-name" style="font-size:13px; font-weight:700; color:#7c3aed;">
            ➕ ใช้ S/N ใหม่: "${escapeHtml(query)}"
          </span>
          <span class="model-item-sub" style="color:#6b7280; font-size:11.5px;">
            สร้างเครื่องใหม่ในคลังและผูกกับ ${escapeHtml(modelTitle)} ทันที
          </span>
        </div>
        <span class="model-count-box" style="background:#ede9fe; color:#7c3aed; font-weight:700;">
          + เพิ่ม
        </span>
      </div>
    `
    : '';

  if (pool.length === 0 && !q) {
    dropdown.innerHTML = `
      <div class="dropdown-header-bar">
        <span class="dropdown-header-title">🏷️ เลือก S/N: ${escapeHtml(modelTitle)}</span>
        <button type="button" class="btn-close-dropdown" data-close-dispatch-sn title="ปิด">✕</button>
      </div>
      <div class="model-dropdown-empty">ไม่มีเครื่องว่างในคลังสำหรับรุ่นนี้</div>
    `;
  } else if (filtered.length === 0) {
    dropdown.innerHTML = `
      <div class="dropdown-header-bar">
        <span class="dropdown-header-title">🏷️ เลือก S/N: ${escapeHtml(modelTitle)} (${pool.length} เครื่อง)</span>
        <button type="button" class="btn-close-dropdown" data-close-dispatch-sn title="ปิด">✕</button>
      </div>
      <div class="dropdown-scroll-list">
        <div class="model-dropdown-empty" style="padding:10px 14px; font-size:12.5px;">ไม่พบ S/N ในคลังที่ตรงกับ "${escapeHtml(query)}"</div>
        ${customItemHtml}
      </div>
    `;
  } else {
    const itemsHtml = filtered
      .map(a => {
        const isCurrent = a.tag_id === row.tag_id || a.tag_id === row._backupTagId;
        return `
          <div
            class="model-dropdown-item ${isCurrent ? 'is-selected' : ''}"
            data-select-dispatch-sn="${escapeHtml(a.tag_id)}"
            data-row="${rowIdx}"
            title="แตะเพื่อเลือกเครื่องนี้"
          >
            <div class="model-item-main">
              <span class="model-item-name" style="font-family:monospace, sans-serif; font-size:13px; font-weight:700; color:#0f172a;">
                🏷️ ${escapeHtml(a.serial_no)}
              </span>
              <span class="model-item-sub">
                รหัส: <strong>${escapeHtml(a.tag_id)}</strong> · ที่เก็บ: ${escapeHtml(a.location || 'คลัง')}
              </span>
            </div>
            <span class="model-count-box ${isCurrent ? 'count-picked' : 'count-full'}">
              ${isCurrent ? '✓ เครื่องเดิม' : 'ว่าง'}
            </span>
          </div>
        `;
      })
      .join('');

    dropdown.innerHTML = `
      <div class="dropdown-header-bar">
        <span class="dropdown-header-title">🏷️ เลือกรหัส S/N: ${escapeHtml(modelTitle)} (ว่าง ${pool.length} เครื่อง)</span>
        <button type="button" class="btn-close-dropdown" data-close-dispatch-sn title="ปิด">✕</button>
      </div>
      <div class="dropdown-scroll-list">
        ${itemsHtml}
        ${customItemHtml}
      </div>
    `;
  }

  // Positioning relative to targetInput
  const inputRect = targetInput.getBoundingClientRect();
  const dropdownWidth = Math.min(window.innerWidth - 30, Math.max(380, inputRect.width));
  dropdown.style.setProperty('position', 'fixed', 'important');
  dropdown.style.setProperty('z-index', '99999', 'important');
  dropdown.style.setProperty('width', `${dropdownWidth}px`, 'important');
  dropdown.style.setProperty('left', `${Math.max(12, Math.min(inputRect.left, window.innerWidth - dropdownWidth - 16))}px`, 'important');

  const spaceBelow = window.innerHeight - inputRect.bottom - 20;
  const spaceAbove = inputRect.top - 20;

  if (spaceBelow < 220 && spaceAbove > spaceBelow) {
    dropdown.style.setProperty('top', 'auto', 'important');
    dropdown.style.setProperty('bottom', `${window.innerHeight - inputRect.top + 6}px`, 'important');
    dropdown.style.setProperty('max-height', `${Math.max(160, Math.min(340, spaceAbove))}px`, 'important');
  } else {
    dropdown.style.setProperty('top', `${inputRect.bottom + 6}px`, 'important');
    dropdown.style.setProperty('bottom', 'auto', 'important');
    dropdown.style.setProperty('max-height', `${Math.max(180, Math.min(340, spaceBelow))}px`, 'important');
  }

  dropdown.classList.remove('hidden');
}

function renderDispatchAccDropdown(rowIdx, query = '') {
  const dropdown = document.getElementById('dispatchAccDropdownMenu');
  if (!dropdown) return;

  const targetInput = document.getElementById(`dispatchAccInput_${rowIdx}`) || document.querySelector(`[data-dispatch-acc-input="${rowIdx}"]`);
  if (!targetInput) return;

  const row = (state.dispatchDraftItems || [])[rowIdx];
  if (!row) return;

  const currentAccs = new Set(row.accessories || []);
  const PRESET_ACCS = ['สาย USB', 'Power Adapter', 'Power Cord', 'แบตเตอรี่', 'Cradle'];

  // All candidates from presets + suggestions
  const allCandidates = Array.from(new Set([...PRESET_ACCS, ...(state.accessorySuggestions || [])]))
    .filter(name => !currentAccs.has(name));

  const q = String(query || '').trim().toLowerCase();
  let filtered = allCandidates;
  if (q) {
    filtered = allCandidates.filter(name => name.toLowerCase().includes(q));
  }

  const exactMatch = filtered.some(name => name.toLowerCase() === q);
  const trimmedQ = String(query || '').trim();
  const customItemHtml = trimmedQ && !exactMatch
    ? `
      <div
        class="model-dropdown-item custom-add-acc-item"
        data-add-custom-acc="${escapeHtml(trimmedQ)}"
        data-row="${rowIdx}"
        title="กดเพื่อเพิ่มอุปกรณ์นี้ทันที"
        style="background:#f0fdf4; border-bottom:1px dashed #86efac; cursor:pointer;"
      >
        <div class="model-item-main">
          <span class="model-item-name" style="font-weight:700; color:#15803d;">
            ➕ เพิ่มอุปกรณ์ใหม่: "${escapeHtml(trimmedQ)}"
          </span>
          <span class="model-item-sub">
            กดคลิกหรือกด Enter เพื่อเพิ่มอุปกรณ์เสริมนี้
          </span>
        </div>
        <span class="model-count-box" style="background:#dcfce7; color:#15803d; font-weight:700;">
          + เพิ่ม
        </span>
      </div>
    `
    : '';

  const itemsHtml = filtered
    .map(name => `
      <div
        class="model-dropdown-item"
        data-select-dispatch-acc="${escapeHtml(name)}"
        data-row="${rowIdx}"
        title="แตะเพื่อเลือกอุปกรณ์นี้"
      >
        <div class="model-item-main">
          <span class="model-item-name">🔌 ${escapeHtml(name)}</span>
        </div>
        <span class="model-count-box count-full">+ เลือก</span>
      </div>
    `)
    .join('');

  const headerHtml = `
    <div class="dropdown-header-bar">
      <span class="dropdown-header-title">🔌 เลือกอุปกรณ์เสริม (${filtered.length} รายการ)</span>
      <button type="button" class="btn-close-dropdown" data-close-dispatch-acc title="ปิด">✕</button>
    </div>
  `;

  if (filtered.length === 0 && !customItemHtml) {
    dropdown.innerHTML = `
      ${headerHtml}
      <div class="model-dropdown-empty">เลือกอุปกรณ์เสริมครบทุกรายการแล้ว (พิมพ์เพิ่มใหม่ได้)</div>
    `;
  } else {
    dropdown.innerHTML = `
      ${headerHtml}
      <div class="dropdown-scroll-list">
        ${customItemHtml}
        ${itemsHtml}
      </div>
    `;
  }

  // Positioning relative to targetInput
  const inputRect = targetInput.getBoundingClientRect();
  const dropdownWidth = Math.min(window.innerWidth - 30, Math.max(340, inputRect.width));
  dropdown.style.setProperty('position', 'fixed', 'important');
  dropdown.style.setProperty('z-index', '99999', 'important');
  dropdown.style.setProperty('width', `${dropdownWidth}px`, 'important');
  dropdown.style.setProperty('left', `${Math.max(12, Math.min(inputRect.left, window.innerWidth - dropdownWidth - 16))}px`, 'important');

  const spaceBelow = window.innerHeight - inputRect.bottom - 20;
  const spaceAbove = inputRect.top - 20;

  if (spaceBelow < 220 && spaceAbove > spaceBelow) {
    dropdown.style.setProperty('top', 'auto', 'important');
    dropdown.style.setProperty('bottom', `${window.innerHeight - inputRect.top + 6}px`, 'important');
    dropdown.style.setProperty('max-height', `${Math.max(160, Math.min(300, spaceAbove))}px`, 'important');
  } else {
    dropdown.style.setProperty('top', `${inputRect.bottom + 6}px`, 'important');
    dropdown.style.setProperty('bottom', 'auto', 'important');
    dropdown.style.setProperty('max-height', `${Math.max(160, Math.min(300, spaceBelow))}px`, 'important');
  }

  dropdown.classList.remove('hidden');
}

function renderDispatchTable() {
  const tbody = document.getElementById('dispatchTableBody');
  if (!tbody) return;

  const loan = state.activeDispatchLoan;
  const isPendingQc = loan?.status === 'Pending_QC';
  const isDispatched = loan?.status === 'Dispatched';
  const isDeliveredLoan = loan?.status === 'Delivered' || loan?.status === 'Partially_Returned' || loan?.status === 'Returned';
  const isReadOnly = (isDispatched || isDeliveredLoan) && !state.dispatchOnsiteEditMode;

  const thead = document.querySelector('.dispatch-table thead');

  if (state.dispatchReturnMode) {
    if (thead) {
      thead.innerHTML = `
        <tr>
          <th style="width:40px; text-align:center;">#</th>
          <th style="width:44%;">
            <span class="th-icon-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
              <span>1. ตรวจอุปกรณ์หลัก (เครื่อง &amp; S/N)</span>
            </span>
          </th>
          <th style="width:28%;">
            <span class="th-icon-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6"></path><path d="M6 8h12"></path><path d="M7 8v5a5 5 0 0 0 10 0V8"></path><line x1="12" y1="18" x2="12" y2="22"></line></svg>
              <span>2. ตรวจอุปกรณ์เสริม</span>
            </span>
          </th>
          <th style="width:28%;">
            <span class="th-icon-title">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              <span>3. หมายเหตุ (ถ้ามี)</span>
            </span>
          </th>
        </tr>
      `;
    }

    tbody.innerHTML = (state.dispatchDraftItems || [])
      .map((row, rowIdx) => {
        const isReturned = Boolean(row.selectedForReturn);
        const hasMissing = (row.missingAccessories || new Set()).size > 0;

        return `
          <tr class="dispatch-row return-qc-row ${row.returned ? 'row-ret-completed' : (isReturned ? 'row-ret-checked' : 'row-ret-pending')}" data-ret-row="${rowIdx}">
            <td style="text-align:center; font-weight:600; color:#94a3b8; font-size:12px; vertical-align:middle;">
              ${rowIdx + 1}
            </td>
            <!-- Step 1: ตรวจอุปกรณ์หลัก (Switch Toggle + เครื่อง & S/N) -->
            <td style="vertical-align:middle; padding:12px 14px;">
              <div class="ret-main-device-cell" style="display:flex; align-items:center; gap:14px;">
                <!-- Modern iOS-style Switch Toggle -->
                <label class="toggle-switch ret-item-switch" title="${row.returned ? 'คืนเรียบร้อยแล้ว' : (isReturned ? 'แตะเพื่อยกเลิกการคืนเครื่องนี้' : 'แตะเพื่อรับคืนเครื่องนี้')}">
                  <input 
                    type="checkbox" 
                    class="ret-item-checkbox" 
                    data-ret-item-check="${rowIdx}" 
                    ${row.returned ? 'checked disabled' : (isReturned ? 'checked' : '')} 
                  />
                  <span class="toggle-slider"></span>
                </label>

                <!-- Model Name & S/N Badge -->
                <div style="display:flex; flex-direction:column; gap:4px; min-width:0;">
                  <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span class="dispatch-model-name" style="font-size:14px; font-weight:700; color:#1e293b; line-height:1.2;">
                      ${escapeHtml(row.brand || '')} <strong>${escapeHtml(row.model || '')}</strong>
                    </span>
                    ${row.returned 
                      ? `<span class="ret-status-badge badge-returned" style="font-size:11px; padding:2px 8px;">✓ คืนเข้าคลังแล้ว</span>`
                      : (isPendingQc && row.isInQcQueue)
                      ? `<span class="ret-status-badge" style="font-size:11px; padding:2px 8px; background:#fef3c7; color:#92400e; border:1px solid #fde68a;">🔍 กำลังรอตรวจ QC</span>`
                      : `<span class="ret-status-badge ${isReturned ? 'badge-returned' : 'badge-pending'}" style="font-size:11px; padding:2px 8px;">
                          ${isReturned ? '✓ ได้รับเครื่องแล้ว' : '⏳ รอรับคืน'}
                        </span>`
                    }
                  </div>

                  <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <div class="sn-target-badge" style="padding:3px 10px; font-size:12px; font-family:monospace; font-weight:600; background:${isReturned ? '#f0fdf4' : '#f8fafc'}; border:1px solid ${isReturned ? '#86efac' : '#cbd5e1'}; border-radius:6px; color:${isReturned ? '#15803d' : '#334155'}; transition:all 0.2s;" title="S/N ของเครื่องที่ต้องรับคืน">
                      <span style="color:#64748b; font-weight:normal; margin-right:4px;">S/N:</span>
                      <strong style="color:${isReturned ? '#15803d' : '#0f172a'};">${escapeHtml(row.serial_no || row.tag_id || '-')}</strong>
                      ${row.tag_id ? `<span style="margin-left:4px; font-size:11px; color:#64748b; font-weight:normal;">(${escapeHtml(row.tag_id)})</span>` : ''}
                    </div>
                  </div>
                </div>
              </div>
            </td>
            <!-- Step 2: ตรวจอุปกรณ์เสริม -->
            <td style="vertical-align:middle; padding:12px 14px;">
              <div class="ret-acc-cell" style="display:flex; flex-direction:column; gap:4px;">
                <div class="ret-acc-container" style="display:flex; flex-wrap:wrap; gap:5px;">
                  ${
                    (row.allAccessories || []).length === 0
                      ? `<span style="color:#94a3b8; font-size:12px; font-style:italic;">ไม่มีอุปกรณ์เสริม</span>`
                      : (row.allAccessories || []).map(acc => {
                          const isMissing = (row.missingAccessories || new Set()).has(acc);
                          return `
                            <button
                              type="button"
                              class="acc-pill-btn ${isMissing ? 'is-missing' : 'active is-selected'}"
                              data-ret-toggle-acc="${rowIdx}"
                              data-acc-name="${escapeHtml(acc)}"
                              title="${isMissing ? 'แตะเพื่อเปลี่ยนเป็นได้รับครบ' : 'แตะหากอุปกรณ์ชิ้นนี้ขาด/หาย'}"
                              style="padding:4px 10px; font-size:12px; border-radius:6px;"
                            >
                              ${isMissing 
                                ? `<span style="color:#ef4444; margin-right:4px; font-weight:700;">✕ ขาด:</span><span>${escapeHtml(acc)}</span>` 
                                : `<span style="color:#16a34a; margin-right:4px; font-weight:700;">✓</span><span>${escapeHtml(acc)}</span>`
                              }
                            </button>
                          `;
                        }).join('')
                  }
                </div>
                ${hasMissing ? `<span style="font-size:11px; color:#ef4444; font-weight:600;">⚠️ อุปกรณ์ไม่ครบ (${(row.missingAccessories || new Set()).size} รายการ)</span>` : ''}
              </div>
            </td>
            <!-- Step 3: หมายเหตุ (ถ้ามี) -->
            <td style="vertical-align:middle; padding:12px 14px;">
              ${row.returned 
                ? `<div style="font-size:12px; color:#15803d; font-weight:600; padding:4px 0;">✓ คืนเมื่อ ${formatDateTimeThai(row.returned_at || loan?.return_date || '') || 'เรียบร้อยแล้ว'}${row.qcNote ? ` (${escapeHtml(row.qcNote)})` : ''}</div>`
                : `<div class="input-clearable-wrap" style="width:100%;">
                    <input 
                      type="text" 
                      class="form-control" 
                      id="retQcNote_${rowIdx}" 
                      data-ret-qc-note="${rowIdx}" 
                      placeholder="ระบุหมายเหตุ (ถ้ามี)..." 
                      value="${escapeHtml(row.qcNote || '')}" 
                      autocomplete="off" 
                    />
                    <button type="button" class="btn-input-clear ${row.qcNote ? '' : 'hidden'}" data-clear-ret-qc="${rowIdx}" title="ล้างค่า">✕</button>
                  </div>`
              }
            </td>
          </tr>
        `;
      })
      .join('');
    return;
  }

  // Restore regular picking thead if not in return mode (only allow deleting if more than 1 item remains)
  const draftItemCount = (state.dispatchDraftItems && state.dispatchDraftItems.length) || (loan?.items && loan.items.length) || 0;
  const canDeleteItems = !state.dispatchReturnMode && 
    (loan?.status === 'Requested' || loan?.status === 'Dispatching') && 
    draftItemCount > 1;

  if (thead) {
    thead.innerHTML = `
      <tr>
        <th class="col-num" style="width:40px; min-width:40px; max-width:40px; text-align:center;">#</th>
        <th class="col-model" style="width:33%;">
          <span class="th-icon-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
            <span>สินค้า &amp; ตำแหน่ง</span>
          </span>
        </th>
        <th class="col-sn" style="width:28%;">
          <span class="th-icon-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
            <span>S/N</span>
          </span>
        </th>
        <th class="col-acc" style="width:23%;">
          <span class="th-icon-title">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6"></path><path d="M6 8h12"></path><path d="M7 8v5a5 5 0 0 0 10 0V8"></path><line x1="12" y1="18" x2="12" y2="22"></line></svg>
            <span>อุปกรณ์เสริม</span>
          </span>
        </th>
        <th class="col-photo" style="width:64px; min-width:64px; max-width:64px; text-align:center;">
          <span class="th-icon-title" style="justify-content:center;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
            <span>รูปถ่าย</span>
          </span>
        </th>
        <th class="col-chevron" style="${canDeleteItems ? 'width:72px; min-width:72px; max-width:72px;' : 'width:40px; min-width:40px; max-width:40px;'} text-align:center;"></th>
      </tr>
    `;
  }

  const chosenSet = new Set(state.dispatchDraftItems.map(r => r.tag_id).filter(Boolean));
  const PRESET_ACCS = ['สาย USB', 'Power Adapter', 'Power Cord', 'แบตเตอรี่', 'Cradle'];

  tbody.innerHTML = state.dispatchDraftItems
    .map((row, rowIdx) => {
      const assetObj = state.assets.find(a => a.tag_id === row.tag_id);
      const isMatched = Boolean(row.tag_id && assetObj);
      const isExpanded = state.activeDispatchRowIdx === rowIdx;

      // Available assets strictly matching this row's model
      const sameModelAssets = state.assets.filter(
        a =>
          (a.status === 'Available' || a.tag_id === row.tag_id || a.tag_id === row._backupTagId) &&
          (!chosenSet.has(a.tag_id) || a.tag_id === row.tag_id || a.tag_id === row._backupTagId) &&
          (a.model || '').toLowerCase() === (row.model || '').toLowerCase()
      );

      const availCount = sameModelAssets.length;
      const allSameAssets = state.assets.filter(a => (a.model || '').toLowerCase() === (row.model || '').toLowerCase());
      const guideLoc = assetObj?.location || sameModelAssets[0]?.location || allSameAssets[0]?.location || 'Main Stock';

      const photoCount = (row.photos || []).length;
      const accList = row.accessories || [];
      const unselectedPresets = PRESET_ACCS.filter(p => !accList.includes(p));

      const activePillsHtml = accList
        .map(
          acc => `
          <button
            type="button"
            class="acc-pill-btn active is-selected"
            data-inline-toggle-acc="${escapeHtml(acc)}"
            data-row="${rowIdx}"
            title="แตะเพื่อนำ ${escapeHtml(acc)} ออก"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:3px; vertical-align:-1px;"><polyline points="20 6 9 17 4 12"></polyline></svg>
            <span>${escapeHtml(acc)}</span>
            <span class="acc-pill-rm-x" style="margin-left:4px; opacity:0.65; font-size:10px;">✕</span>
          </button>
        `
        )
        .join('');

      const presetPillsHtml = unselectedPresets
        .map(
          acc => `
          <button
            type="button"
            class="acc-pill-btn"
            data-inline-toggle-acc="${escapeHtml(acc)}"
            data-row="${rowIdx}"
            title="แตะเพื่อเพิ่ม ${escapeHtml(acc)}"
          >
            <span style="opacity:0.6; margin-right:3px;">+</span>
            <span>${escapeHtml(acc)}</span>
          </button>
        `
        )
        .join('');

      const isItemReturned = Boolean(row.returned);
      const isPartialLoan = loan?.status === 'Partially_Returned';
      const isUnreturned = isPartialLoan && !isItemReturned;
      const itemRowStatusClass = isDeliveredLoan
        ? (isItemReturned ? 'row-item-returned' : (isPartialLoan ? 'row-item-pending-return' : 'row-item-on-loan'))
        : '';

      const mainRowHtml = `
        <tr class="dispatch-row ${isMatched ? 'row-picked' : 'row-empty'} ${itemRowStatusClass} ${isExpanded ? 'row-expanded' : ''}" data-dispatch-row="${rowIdx}">
          <!-- # -->
          <td style="text-align:center; font-weight:600; color:#94a3b8; font-size:12px;">
            ${rowIdx + 1}
          </td>

          <!-- Model & Location -->
          <td>
            <div class="dispatch-model-cell">
              <span class="dispatch-model-name">${escapeHtml(row.brand || '')} <strong>${escapeHtml(row.model || '')}</strong></span>
              ${
                !isMatched
                  ? `
              <div class="dispatch-model-sub">
                <span class="pick-loc-badge">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                  <span>${escapeHtml(guideLoc)}</span>
                </span>
                <span class="stock-mini ${availCount > 0 ? '' : 'out'}">(ว่าง ${availCount})</span>
              </div>
              `
                  : ''
              }
            </div>
          </td>

          <!-- S/N Status -->
          <td>
            ${
              isMatched
                ? `
              <div class="sn-picked-display ${isUnreturned ? 'is-unreturned-sn' : ''}">
                ${
                  isUnreturned
                    ? ''
                    : `
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                `
                }
                <span class="sn-picked-val">${escapeHtml(assetObj ? assetObj.serial_no : (row.tag_id || '-'))}</span>
                ${
                  !isReadOnly
                    ? `
                <button type="button" class="btn-quick-unpick" data-unpick-row="${rowIdx}" title="ปลด S/N">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
                `
                    : ''
                }
              </div>
            `
                : `
              <span class="badge-sn-waiting" title="รอสแกน S/N">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>
                <span>รอสแกน</span>
              </span>
            `
            }
          </td>

          <!-- Accessories -->
          <td>
            ${
              accList.length > 0
                ? `<span class="pick-acc-text">${escapeHtml(accList.join(', '))}</span>`
                : `<span style="color:#cbd5e1; font-size:12px;">-</span>`
            }
          </td>

          <!-- Photo Badge -->
          <td style="text-align:center;">
            ${
              photoCount > 0
                ? `<span class="photo-badge-mini clickable-photo-badge" data-preview-row-photos="${rowIdx}" title="คลิกดูรูปถ่าย (${photoCount} รูป)"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg> <span>${photoCount}</span></span>`
                : `<span style="color:#cbd5e1; font-size:12px;">-</span>`
            }
          </td>

          <!-- Actions & Chevron -->
          <td style="text-align:center; vertical-align:middle; white-space:nowrap;">
            <div class="dispatch-row-action-btns" style="display:inline-flex; align-items:center; justify-content:center; gap:6px;">
              ${
                canDeleteItems
                  ? `
                <button type="button" 
                  class="btn-dispatch-delete-item" 
                  data-delete-dispatch-item="${rowIdx}" 
                  title="ลบรายการนี้ออกจากใบยืม"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"></path>
                    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                    <line x1="10" y1="11" x2="10" y2="17"></line>
                    <line x1="14" y1="11" x2="14" y2="17"></line>
                  </svg>
                </button>
              `
                  : ''
              }
              <span class="inline-chevron-wrap">
                <svg class="inline-chevron-svg ${isExpanded ? 'open' : ''}" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="6 9 12 15 18 9"></polyline>
                </svg>
              </span>
            </div>
          </td>
        </tr>
      `;

      if (!isExpanded) {
        return mainRowHtml;
      }

      // Compact, Balanced In-line Detail Panel
      const inlinePanelHtml = `
        <tr class="dispatch-inline-row ${isReadOnly ? 'is-readonly' : ''} ${itemRowStatusClass} ${isMatched ? 'row-picked' : ''}" data-dispatch-inline-for="${rowIdx}">
          <td colspan="6" class="dispatch-inline-td">
            <div class="dispatch-inline-clean">
              <!-- 1. เลือก S/N -->
              <div class="inline-field-line inline-sn-field-line">
                <span class="inline-field-title" title="${isReadOnly ? 'S/N สินค้า' : 'เลือก S/N จากคลัง'}">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path><line x1="7" y1="7" x2="7.01" y2="7"></line></svg>
                  <span>S/N:</span>
                </span>
                <div class="inline-sn-selector-container">
                  ${
                    isMatched
                      ? `
                    <div class="sn-matched-card ${isReadOnly ? 'readonly-card' : ''} ${isUnreturned ? 'is-unreturned-card' : ''}">
                      <div class="sn-matched-main">
                        ${isUnreturned ? '' : '<span class="sn-matched-check">✓</span>'}
                        <strong class="sn-matched-code">${escapeHtml(assetObj ? assetObj.serial_no : (row.tag_id || '-'))}</strong>
                        <span class="sn-matched-tag">รหัส: ${escapeHtml(assetObj ? assetObj.tag_id : (row.tag_id || '-'))}</span>
                      </div>
                      ${
                        !isReadOnly
                          ? `
                      <div class="sn-matched-actions">
                        <button type="button" class="btn-sn-change-action" data-change-dispatch-sn="${rowIdx}" title="เปลี่ยนเครื่อง">
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                          </svg>
                        </button>
                        <button type="button" class="btn-sn-unpick-action" data-unpick-row="${rowIdx}" title="ปลดเครื่องนี้ออก">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                          </svg>
                        </button>
                      </div>
                      `
                          : ''
                      }
                    </div>
                  `
                      : `
                    <div class="input-clearable-wrap has-dropdown inline-sn-input-wrap">
                      <input
                        type="text"
                        id="dispatchSnInput_${rowIdx}"
                        class="form-control inline-sn-picker-input"
                        placeholder="${sameModelAssets.length > 0 ? `แตะเพื่อเลือก หรือพิมพ์ค้นหา S/N (ว่าง ${sameModelAssets.length} เครื่อง)...` : 'ไม่มีเครื่องว่างในคลัง'}"
                        autocomplete="off"
                        data-dispatch-sn-input="${rowIdx}"
                        ${sameModelAssets.length === 0 ? 'disabled' : ''}
                      />
                      <div class="input-actions-end">
                        <button type="button" class="btn-input-clear hidden" data-clear-dispatch-sn="${rowIdx}" title="ล้างค่า">✕</button>
                        <button type="button" class="btn-keyboard-toggle" data-keyboard-target="dispatchSnInput_${rowIdx}" title="แสดง/ซ่อน แป้นพิมพ์บนหน้าจอ" aria-label="แสดง/ซ่อน แป้นพิมพ์">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                            <line x1="6" y1="8" x2="6" y2="8"></line>
                            <line x1="10" y1="8" x2="10" y2="8"></line>
                            <line x1="14" y1="8" x2="14" y2="8"></line>
                            <line x1="18" y1="8" x2="18" y2="8"></line>
                            <line x1="6" y1="12" x2="6" y2="12"></line>
                            <line x1="10" y1="12" x2="10" y2="12"></line>
                            <line x1="14" y1="12" x2="14" y2="12"></line>
                            <line x1="18" y1="12" x2="18" y2="12"></line>
                            <line x1="7" y1="16" x2="17" y2="16"></line>
                          </svg>
                        </button>
                        <button type="button" class="btn-input-dropdown-arrow" data-toggle-dispatch-sn="${rowIdx}" title="แสดงรายการ S/N">▾</button>
                      </div>
                    </div>
                  `
                  }
                </div>
              </div>

              <!-- 2. อุปกรณ์เสริม -->
              <div class="inline-field-line inline-acc-field-line">
                <span class="inline-field-title" title="อุปกรณ์เสริม">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6"></path><path d="M6 8h12"></path><path d="M7 8v5a5 5 0 0 0 10 0V8"></path><line x1="12" y1="18" x2="12" y2="22"></line></svg>
                  <span>อุปกรณ์:</span>
                </span>
                <div class="inline-acc-container">
                  ${
                    isReadOnly
                      ? `
                    <div class="readonly-acc-pills-wrap">
                      ${
                        accList.length > 0
                          ? accList.map(acc => `<span class="badge-subtle-pill"><span class="badge-dot"></span>${escapeHtml(acc)}</span>`).join('')
                          : '<span class="text-muted-empty">ไม่มีอุปกรณ์เสริมเพิ่มเติม</span>'
                      }
                    </div>
                    `
                      : `
                    <div class="inline-acc-pills-wrap">
                      ${activePillsHtml}
                      ${presetPillsHtml}
                    </div>
                    <div class="input-clearable-wrap has-dropdown inline-acc-input-wrap">
                      <input
                        type="text"
                        id="dispatchAccInput_${rowIdx}"
                        class="form-control inline-acc-picker-input"
                        placeholder="พิมพ์ หรือแตะเลือกอุปกรณ์เสริมเพิ่ม..."
                        autocomplete="off"
                        data-dispatch-acc-input="${rowIdx}"
                      />
                      <div class="input-actions-end">
                        <button type="button" class="btn-input-clear hidden" data-clear-dispatch-acc="${rowIdx}" title="ล้างค่า">✕</button>
                        <button type="button" class="btn-keyboard-toggle" data-keyboard-target="dispatchAccInput_${rowIdx}" title="แสดง/ซ่อน แป้นพิมพ์บนหน้าจอ" aria-label="แสดง/ซ่อน แป้นพิมพ์">
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                            <line x1="6" y1="8" x2="6" y2="8"></line>
                            <line x1="10" y1="8" x2="10" y2="8"></line>
                            <line x1="14" y1="8" x2="14" y2="8"></line>
                            <line x1="18" y1="8" x2="18" y2="8"></line>
                            <line x1="6" y1="12" x2="6" y2="12"></line>
                            <line x1="10" y1="12" x2="10" y2="12"></line>
                            <line x1="14" y1="12" x2="14" y2="12"></line>
                            <line x1="18" y1="12" x2="18" y2="12"></line>
                            <line x1="7" y1="16" x2="17" y2="16"></line>
                          </svg>
                        </button>
                        <button type="button" class="btn-input-dropdown-arrow" data-toggle-dispatch-acc="${rowIdx}" title="แสดงรายการอุปกรณ์เสริม">▾</button>
                      </div>
                    </div>
                    `
                  }
                </div>
              </div>

              <!-- เส้นแบ่งระหว่างฮาร์ดแวร์/อุปกรณ์ กับ ข้อมูลสภาพเครื่อง -->
              <div class="inline-detail-divider"></div>

              <!-- 3. รูปถ่ายสภาพสินค้า -->
              <div class="inline-field-line inline-photo-field-line">
                <span class="inline-field-title" title="รูปถ่ายสภาพสินค้า">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>
                  <span>รูปถ่าย:</span>
                </span>
                <div class="inline-photo-controls ${isReadOnly ? 'readonly-photo-wrap' : ''}">
                  ${
                    !isReadOnly
                      ? `
                    <button type="button" class="btn-inline-icon-action" data-inline-snap-row="${rowIdx}" title="ถ่ายรูปด้วยกล้อง">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                      </svg>
                    </button>
                    <button type="button" class="btn-inline-icon-action" data-inline-upload-row="${rowIdx}" title="แนบไฟล์รูปภาพ">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
                      </svg>
                    </button>
                    `
                      : ''
                  }
                  ${
                    (row.photos || []).length > 0
                      ? (row.photos || [])
                          .map(
                            (src, pIdx) => `
                        <div class="mini-photo-thumb" data-preview-inline-photo="${pIdx}" data-row="${rowIdx}" title="คลิกดูรูปใหญ่" style="cursor:pointer;">
                          <img src="${src}" data-preview-inline-photo="${pIdx}" data-row="${rowIdx}" alt="รูปสภาพเครื่อง" />
                          ${
                            !isReadOnly
                              ? `
                          <button type="button" class="btn-del-mini" data-rm-inline-photo="${pIdx}" data-row="${rowIdx}" title="ลบรูป">
                            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                          </button>
                          `
                              : ''
                          }
                        </div>
                      `
                          )
                          .join('')
                      : isReadOnly
                      ? '<span class="text-muted-empty">ไม่มีรูปถ่ายสภาพเครื่อง</span>'
                      : ''
                  }
                </div>
              </div>

              <!-- 4. หมายเหตุเครื่องนี้ -->
              <div class="inline-field-line inline-note-field-line">
                <span class="inline-field-title" title="หมายเหตุเฉพาะเครื่องนี้">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                  <span>หมายเหตุ:</span>
                </span>
                <div class="inline-note-container">
                  ${
                    isReadOnly
                      ? `
                    <div class="readonly-note-box">
                      ${(() => {
                        if (isItemReturned) {
                          const returnTime = row.returned_at || loan?.return_date || '';
                          const formattedTime = returnTime ? formatDateTimeThai(returnTime) : '';
                          const retPrefix = formattedTime ? `คืนเมื่อ ${formattedTime}` : 'คืนเรียบร้อยแล้ว';
                          const fullNote = row.free_note ? `${retPrefix} (${row.free_note})` : retPrefix;
                          return `<span class="note-quote-icon" style="color:#16a34a;">✓</span> <span style="color:#15803d; font-weight:600;">${escapeHtml(fullNote)}</span>`;
                        }
                        return row.free_note
                          ? `<span class="note-quote-icon">💬</span> <span>${escapeHtml(row.free_note)}</span>`
                          : '<span class="text-muted-empty">ไม่มีหมายเหตุ</span>';
                      })()}
                    </div>
                    `
                      : `
                    <div class="input-clearable-wrap inline-note-input-wrap">
                      <svg class="note-prefix-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                      <input
                        type="text"
                        id="inlineNoteInput_${rowIdx}"
                        class="form-control inline-clean-note-input"
                        placeholder="หมายเหตุเครื่องนี้ เช่น สภาพเครื่อง, ตำหนิ (ถ้ามี)..."
                        value="${escapeHtml(row.free_note || '')}"
                        data-inline-note-row="${rowIdx}"
                        autocomplete="off"
                      />
                      <button
                        type="button"
                        class="btn-input-clear ${row.free_note ? '' : 'hidden'}"
                        data-clear-inline-note="${rowIdx}"
                        title="ล้างหมายเหตุ"
                      >✕</button>
                    </div>
                    `
                  }
                </div>
              </div>

              ${
                canDeleteItems
                  ? `
              <div class="inline-delete-row-wrap" style="display:flex; justify-content:flex-end; padding-top:10px; border-top:1px dashed #e2e8f0; margin-top:10px;">
                <button type="button" class="btn btn-outline btn-sm btn-delete-item-inline" data-delete-dispatch-item="${rowIdx}" style="color:#ef4444; border-color:#fecaca; background:#fff; font-size:12px; height:30px; display:inline-flex; align-items:center; gap:5px; cursor:pointer;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                  </svg>
                  <span>ลบรายการนี้ออกจากใบยืม</span>
                </button>
              </div>
              `
                  : ''
              }
            </div>
          </td>
        </tr>
      `;

      return mainRowHtml + inlinePanelHtml;
    })
    .join('');

  updateDispatchSummary();
}

async function addAndAssignCustomSn(rowIdx, serialNo) {
  const row = (state.dispatchDraftItems || [])[rowIdx];
  if (!row) return;
  const sn = (serialNo || '').trim();
  if (!sn) return;

  try {
    const payload = {
      serial_no: sn,
      brand: row.brand || '',
      model: row.model || 'Demo Unit',
      category: 'Mobile Computer',
      source: row.source || 'Demo',
      location: 'Main Stock (ตู้โชว์/คลังกลาง)'
    };
    const res = await fetch('/api/assets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const resJson = await res.json();
    if (!res.ok) {
      showToast(`❌ ${resJson.error || 'เกิดข้อผิดพลาดในการสร้างเครื่อง'}`);
      return;
    }

    const newTagId = resJson.createdTagId || resJson.tag_id;
    if (resJson.state?.assets) {
      state.assets = resJson.state.assets;
    }
    const created = state.assets.find(a => a.tag_id === newTagId) || {
      tag_id: newTagId,
      serial_no: sn,
      brand: row.brand || '',
      model: row.model || 'Demo Unit',
      source: row.source || 'Demo',
      status: 'Available'
    };
    if (!state.assets.some(a => a.tag_id === created.tag_id)) {
      state.assets.push(created);
    }

    row.tag_id = created.tag_id;
    delete row._backupTagId;
    row.source = created.source || 'Demo';
    if (!row.accessories || row.accessories.length === 0) {
      row.accessories = [...(created.accessories || [])];
    }

    closeDispatchSnDropdown();
    renderDispatchTable();
    showToast(`✅ เพิ่มและเลือก S/N ใหม่: ${created.serial_no} (${created.tag_id}) เรียบร้อย`);
  } catch (err) {
    showToast(`❌ เกิดข้อผิดพลาด: ${err.message}`);
  }
}

function handleDispatchBarcodeScan(scannedCode) {
  const code = (scannedCode || '').trim();
  if (!code) return;

  const codeUpper = code.toUpperCase();

  // If in Return Mode: match directly against this loan's items and mark as returned!
  if (state.dispatchReturnMode) {
    const matchedIdx = (state.dispatchDraftItems || []).findIndex(r => 
      !r.returned && (
        (r.serial_no && r.serial_no.trim().toUpperCase() === codeUpper) ||
        (r.tag_id && r.tag_id.trim().toUpperCase() === codeUpper) ||
        (r.serial_no && r.serial_no.toUpperCase().includes(codeUpper) && codeUpper.length >= 4) ||
        (r.tag_id && r.tag_id.toUpperCase().includes(codeUpper) && codeUpper.length >= 4)
      )
    );

    if (matchedIdx >= 0) {
      const row = state.dispatchDraftItems[matchedIdx];
      row.selectedForReturn = true;
      row.scannedSn = code;
      renderDispatchTable();
      updateDispatchSummary();
      showToast(`✅ สแกนรับคืนสำเร็จ: ${row.brand} ${row.model} (S/N: ${row.serial_no})`);
      const barcodeInput = document.getElementById('dispatchGlobalBarcodeInput');
      if (barcodeInput) {
        barcodeInput.value = '';
        barcodeInput.focus();
      }
      return;
    } else {
      showToast(`⚠️ ไม่พบเครื่องที่มี S/N หรือ Tag ID "${code}" ที่ยังไม่ได้รับคืนในใบยืมนี้`);
      return;
    }
  }

  // 1. Exact match (by serial_no or tag_id)
  let matchedAssets = state.assets.filter(
    a =>
      (a.serial_no && a.serial_no.trim().toUpperCase() === codeUpper) ||
      (a.tag_id && a.tag_id.trim().toUpperCase() === codeUpper)
  );

  // 2. If no exact match, try prefix / substring match (e.g. typing "12345" matches "1234567890")
  if (matchedAssets.length === 0) {
    matchedAssets = state.assets.filter(
      a =>
        (a.serial_no && a.serial_no.toUpperCase().includes(codeUpper)) ||
        (a.tag_id && a.tag_id.toUpperCase().includes(codeUpper))
    );
  }

  // Prevent borrowing disposed assets
  const disposedMatch = matchedAssets.find(a => a.status === 'Disposed');
  if (disposedMatch && matchedAssets.every(a => a.status === 'Disposed')) {
    showToast(`⚠️ เครื่อง ${disposedMatch.tag_id} (S/N: ${disposedMatch.serial_no}) ถูกจำหน่ายออกจากระบบแล้ว (${formatShortDate(disposedMatch.disposed_at)}) ไม่สามารถนำมาจ่ายยืมได้`);
    return;
  }
  matchedAssets = matchedAssets.filter(a => a.status !== 'Disposed');

  // CASE A: Matching asset(s) found in catalog
  if (matchedAssets.length > 0) {
    // If multiple, try to find one matching an unpicked row of the same model
    const bestMatch =
      matchedAssets.find(a => {
        const isPicked = state.dispatchDraftItems.some(r => r.tag_id === a.tag_id);
        if (isPicked) return false;
        return state.dispatchDraftItems.some(
          r => !r.tag_id && (r.model || '').trim().toLowerCase() === (a.model || '').trim().toLowerCase()
        );
      }) ||
      matchedAssets.find(a => !state.dispatchDraftItems.some(r => r.tag_id === a.tag_id)) ||
      matchedAssets[0];

    const alreadyPickedIdx = state.dispatchDraftItems.findIndex(r => r.tag_id === bestMatch.tag_id);
    if (alreadyPickedIdx >= 0) {
      showToast(`⚠️ เครื่อง S/N: ${bestMatch.serial_no} (${bestMatch.tag_id}) ถูกเลือกในรายการที่ ${alreadyPickedIdx + 1} แล้ว`);
      return;
    }

    // Try to match first empty row with the EXACT model
    const exactUnpickedIdx = state.dispatchDraftItems.findIndex(
      r => !r.tag_id && (r.model || '').trim().toLowerCase() === (bestMatch.model || '').trim().toLowerCase()
    );

    if (exactUnpickedIdx >= 0) {
      const row = state.dispatchDraftItems[exactUnpickedIdx];
      row.tag_id = bestMatch.tag_id;
      delete row._backupTagId;
      row.source = bestMatch.source || 'Demo';
      if (!row.accessories || row.accessories.length === 0) {
        row.accessories = [...(bestMatch.accessories || [])];
      }
      if (!row.brand) row.brand = bestMatch.brand;
      if (!row.model) row.model = bestMatch.model;

      renderDispatchTable();
      showToast(`⚡ สแกนสำเร็จ: รายการที่ ${exactUnpickedIdx + 1} S/N ${bestMatch.serial_no}`);

      const barcodeInput = document.getElementById('dispatchGlobalBarcodeInput');
      if (barcodeInput) {
        barcodeInput.value = '';
        barcodeInput.focus();
      }
      return;
    }

    // Mismatch! Scanned machine does not match any open row of this model.
    // Prompt the user to notify them and ask which item row to assign it to!
    openDispatchMismatchDialog(bestMatch);
    return;
  }

  // CASE B: Not found in state.assets at all!
  // Prompt user to add this new S/N to one of the rows in the loan!
  openDispatchMismatchDialog({
    isNew: true,
    serial_no: code,
    tag_id: 'สร้างใหม่อัตโนมัติ',
    brand: '',
    model: 'เครื่องใหม่',
    source: 'Demo'
  });
}

function openDispatchMismatchDialog(asset) {
  state.pendingMismatchAsset = asset;
  const dialog = document.getElementById('dispatchMismatchDialog');
  if (!dialog) return;

  const isNew = Boolean(asset.isNew);
  const iconBubble = document.getElementById('mismatchIconBubble');
  const titleEl = document.getElementById('dispatchMismatchTitle');
  const subEl = document.getElementById('dispatchMismatchSub');
  const cardLabel = document.getElementById('mismatchCardLabel');
  const nameEl = document.getElementById('mismatchScannedName');
  const snEl = document.getElementById('mismatchScannedSn');
  const tagEl = document.getElementById('mismatchScannedTag');
  const choiceLabel = document.getElementById('mismatchChoiceLabel');
  const btnApply = document.getElementById('btnApplyMismatchChoice');

  if (iconBubble) iconBubble.textContent = isNew ? '➕' : '⚡';
  if (titleEl) titleEl.textContent = isNew ? `ไม่พบ S/N "${asset.serial_no}" ในระบบคลัง` : 'สแกนได้เครื่องไม่ตรงรุ่นในใบยืม';
  if (subEl) subEl.textContent = isNew ? 'คุณสามารถเพิ่ม S/N นี้เป็นเครื่องใหม่ และผูกเข้ากับรายการในใบยืมได้ทันที' : 'เครื่องที่สแกนไม่ตรงกับรุ่นที่ยังไม่ได้สแกนในใบยืมนี้';
  if (cardLabel) cardLabel.textContent = isNew ? 'S/N ใหม่ที่ต้องการเพิ่ม:' : 'เครื่องที่ยิงบาร์โค้ดได้:';
  if (nameEl) nameEl.textContent = isNew ? 'เครื่องใหม่ (ระบุ S/N เอง)' : `${asset.brand || ''} ${asset.model || ''}`;
  if (snEl) snEl.textContent = asset.serial_no || '-';
  if (tagEl) tagEl.textContent = isNew ? 'จะออกรหัส ACT ให้อัตโนมัติ' : (asset.tag_id || '-');
  if (choiceLabel) choiceLabel.textContent = isNew ? '🎯 กรุณาเลือกว่าต้องการผูก S/N ใหม่นี้เข้ากับรายการใดในใบยืม:' : '🎯 กรุณาเลือกว่าต้องการนำเครื่องนี้ไปลงแทนที่รายการใดในใบยืม:';
  if (btnApply) {
    btnApply.textContent = isNew ? '➕ ยืนยันเพิ่มและผูก S/N เข้ากับรายการที่เลือก' : '✓ ยืนยันลงรายการที่เลือก';
    btnApply.disabled = false;
  }

  // Select first unpicked row by default (or currently active row if unpicked)
  let defaultIdx = -1;
  if (state.activeDispatchRowIdx !== null && !state.dispatchDraftItems[state.activeDispatchRowIdx]?.tag_id) {
    defaultIdx = state.activeDispatchRowIdx;
  }
  if (defaultIdx < 0) {
    defaultIdx = state.dispatchDraftItems.findIndex(r => !r.tag_id);
  }
  if (defaultIdx < 0) defaultIdx = 0;

  const listContainer = document.getElementById('mismatchItemsChoiceList');
  if (listContainer) {
    listContainer.innerHTML = state.dispatchDraftItems
      .map((r, idx) => {
        const isUnpicked = !r.tag_id;
        const isChecked = idx === defaultIdx;
        const currentAsset = r.tag_id ? state.assets.find(a => a.tag_id === r.tag_id) : null;

        return `
          <label class="mismatch-option-card ${isChecked ? 'selected' : ''}" data-mismatch-opt="${idx}">
            <input
              type="radio"
              name="mismatchTargetRow"
              class="mismatch-option-radio"
              value="${idx}"
              ${isChecked ? 'checked' : ''}
            />
            <div class="mismatch-opt-info">
              <div class="mismatch-opt-title">
                รายการที่ ${idx + 1}: <strong>${escapeHtml(r.brand || '')} ${escapeHtml(r.model || '')}</strong>
              </div>
              <div class="mismatch-opt-status ${isUnpicked ? 'empty' : 'filled'}">
                ${
                  isUnpicked
                    ? '⏳ ยังไม่ได้สแกน (ว่าง — แนะนำเลือกลงช่องนี้)'
                    : `⚠️ มีเครื่องอยู่แล้ว: S/N ${escapeHtml(currentAsset?.serial_no || r.tag_id)} (จะถูกแทนที่)`
                }
              </div>
            </div>
          </label>
        `;
      })
      .join('');
  }

  if (btnApply) btnApply.disabled = false;
  dialog.showModal();
}

// ============================================================================
// MODAL 2: RETURN & QC INSPECTION (ตรวจตามรายการยืม & อุปกรณ์เสริม + ถ่ายรูป + คืนที่เดิม)
// ============================================================================
function openReturnModal(loanId, updateHash = true) {
  openDispatchModal(loanId, updateHash);
}

function renderReturnAfterPhotosPreview() {
  const container = document.getElementById('returnAfterPhotosPreview');
  if (state.returnAfterPhotos.length === 0) {
    container.innerHTML = `<span class="muted-hint">กด "+ ถ่ายรูปรับคืน" เพื่อแนบรูปหลักฐานตอนรับของกลับ</span>`;
    return;
  }
  container.innerHTML = state.returnAfterPhotos
    .map(
      (src, idx) => `
      <div class="photo-thumb">
        <img src="${src}" alt="After photo ${idx + 1}" />
        <button type="button" data-rm-after-photo="${idx}">×</button>
      </div>
    `
    )
    .join('');
}

function renderReturnChecklistItems() {
  const container = document.getElementById('returnItemsContainer');
  container.innerHTML = state.returnDraftItems
    .map((item, idx) => {
      const hasMissing = item.missingSet.size > 0;
      const effectiveFail = item.qcStatus === 'Fail' || hasMissing;
      const missingStr = [...item.missingSet].join(', ');

      return `
        <div class="qc-item-card">
          <div class="qc-item-top">
            <label class="qc-item-title">
              <input type="checkbox" data-ret-select="${idx}" ${item.selectedForReturn ? 'checked' : ''} />
              <span class="mini-tag-code">${escapeHtml(item.tag_id)}</span>
              <span>${escapeHtml(item.brand)} ${escapeHtml(item.model)}</span>
              <span class="muted-hint">(S/N: ${escapeHtml(item.serial_no)})</span>
              <span class="src-badge src-${escapeHtml(item.source_snapshot)}">Source: ${escapeHtml(item.source_snapshot)}</span>
            </label>

            <div class="qc-status-toggle">
              <button type="button" class="qc-radio-btn pass ${!effectiveFail ? 'active' : ''}" data-qc-status="${idx}" data-val="Pass">
                ✅ ปกติ (ผ่าน QC)
              </button>
              <button type="button" class="qc-radio-btn fail ${effectiveFail ? 'active' : ''}" data-qc-status="${idx}" data-val="Fail">
                ⚠️ มีปัญหา / ของไม่ครบ
              </button>
            </div>
          </div>

          <div class="qc-acc-section">
            <div class="qc-acc-label">🔌 ตรวจเช็คอุปกรณ์เสริมตามใบยืม (จิ้มที่ป้ายหากชิ้นไหนขาด/ไม่มา):</div>
            <div class="qc-tag-pills">
              ${
                item.allAccessories.length === 0
                  ? `<span class="muted-hint">ไม่มีรายการอุปกรณ์เสริม</span>`
                  : item.allAccessories
                      .map(acc => {
                        const isMissing = item.missingSet.has(acc);
                        return `
                          <button type="button" class="qc-tag-pill ${isMissing ? 'missing' : ''}" data-toggle-ret-acc="${idx}" data-acc="${escapeHtml(acc)}">
                            ${isMissing ? '❌ ขาด:' : '✅'} ${escapeHtml(acc)}
                          </button>
                        `;
                      })
                      .join('')
              }
            </div>
          </div>

          <input
            type="text"
            class="cell-input"
            placeholder="พิมพ์หมายเหตุ QC ตอนรับคืน (ถ้ามี)..."
            value="${escapeHtml(item.qcNote)}"
            data-qc-note="${idx}"
          />

          ${
            !effectiveFail
              ? `
              <div class="qc-destination-banner dest-pass">
                <div>
                  📍 เสร็จแล้วนำกลับไปเก็บคืนที่เดิม: <strong>${escapeHtml(item.location_snapshot)}</strong>
                  <span>(Source: ${escapeHtml(item.source_snapshot)})</span>
                </div>
                <label style="display:flex;align-items:center;gap:6px;cursor:pointer;">
                  <input type="checkbox" data-qc-confirm-loc="${idx}" ${item.confirmedLocation ? 'checked' : ''} />
                  <span>ยืนยันนำเก็บเข้าที่เดิมแล้ว</span>
                </label>
              </div>
            `
              : `
              <div class="qc-destination-banner dest-fail">
                <div>
                  ⚠️ คืนไม่ครบ / ไม่ผ่าน QC ${hasMissing ? `(ขาด: ${escapeHtml(missingStr)})` : ''} —
                  การ์ดจะอยู่ในคอลัมน์ <strong>"เกินกำหนด / คืนไม่ครบ"</strong> เพื่อติดตามต่อ
                </div>
              </div>
            `
          }
        </div>
      `;
    })
    .join('');
}

// ============================================================================
// MODAL 3: CUSTOMER GATE PASS PRINT (NO LOCATION SHOWN TO CUSTOMER)
// ============================================================================
function openPrintModal(loanId, updateHash = true) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) return;
  if (updateHash) updateUrlHash('modal', `print-${loan.id}`);
  state.activePrintLoanId = loanId;
  state.printZoomMode = '100'; // Default always to 100%
  document.title = loan.id;
  renderGatePassHtml();
  const dialog = document.getElementById('printDialog');
  dialog?.showModal();
  dialog?.addEventListener('close', () => {
    document.title = 'activeASSET v2 - Minimal Asset Loan & QC Tracking';
  }, { once: true });
  requestAnimationFrame(() => {
    updateGatePassPreviewScale();
  });
  const scrollEl = dialog?.querySelector('.print-preview-scroll');
  if (scrollEl) {
    scrollEl.scrollTop = 0;
    scrollEl.scrollLeft = 0;
    setTimeout(() => { scrollEl.scrollTop = 0; scrollEl.scrollLeft = 0; updateGatePassPreviewScale(); }, 50);
    setTimeout(() => { scrollEl.scrollTop = 0; scrollEl.scrollLeft = 0; updateGatePassPreviewScale(); }, 150);
  }
}

function formatDateTimeThai(dateStr) {
  if (!dateStr) return '';
  try {
    const safeStr = typeof dateStr === 'string' && dateStr.includes(' ') && !dateStr.includes('T')
      ? dateStr.replace(' ', 'T')
      : dateStr;
    const d = new Date(safeStr);
    if (isNaN(d.getTime())) return dateStr;
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes} น.`;
  } catch (_) {
    return dateStr;
  }
}

function generateQrSvg(text) {
  try {
    if (typeof qrcode === 'function' && text) {
      const qr = qrcode(0, 'M');
      qr.addData(String(text));
      qr.make();
      return qr.createSvgTag({ scalable: true, margin: 0 });
    }
  } catch (err) {
    console.error('generateQrSvg error:', err);
  }
  return '';
}

function renderSingleGatePassSheet(loan, copyType = '', sizeClass = '') {
  let badgeHtml = '';
  if (copyType === 'original') {
    badgeHtml = `<span class="gp-sheet-badge original">ต้นฉบับ • ORIGINAL</span>`;
  } else if (copyType === 'copy') {
    badgeHtml = `<span class="gp-sheet-badge copy">สำเนา • COPY</span>`;
  }

  const company = state.companySettings || {};
  const companyLogo = company.company_logo || '';
  const termsText = company.gatepass_terms || '* ผู้ยืมตกลงดูแลรักษาเครื่องและอุปกรณ์เสริมทั้งหมดให้อยู่ในสภาพสมบูรณ์ และนำส่งคืนภายในวันที่กำหนด';
  const qrSvg = generateQrSvg(loan.id);
  const isDelivered = ['Delivered', 'Partially_Returned', 'Returned'].includes(loan.status);

  return `
    <div class="gate-pass-sheet ${sizeClass} ${copyType ? `sheet-${copyType}` : ''}">
      <div class="gp-header">
        <!-- ฝั่งซ้าย: โลโก้ & ชื่อบริษัท/เลขผู้เสียภาษีด้านขวาของโลโก้ และที่อยู่ด้านล่าง -->
        <div class="gp-header-issuer">
          <div class="gp-issuer-top-row">
            ${companyLogo ? `
              <div class="gp-issuer-logo-box">
                <img src="${escapeHtml(companyLogo)}" alt="Logo" class="gp-issuer-logo" onerror="this.onerror=null; const p = this.closest('.gp-issuer-logo-box'); if (p) p.style.display='none';" />
              </div>
            ` : ''}
            <div class="gp-issuer-brand-block">
              <div class="gp-issuer-brand">
                <span class="gp-issuer-name-th">${escapeHtml(company.company_name || 'บริษัท แอคทีฟ 5 จำกัด')}</span>
                ${company.company_name_en ? `<span class="gp-issuer-name-en">(${escapeHtml(company.company_name_en)})</span>` : ''}
              </div>
              ${company.company_tax_id ? `<div class="gp-issuer-meta-tax">เลขประจำตัวผู้เสียภาษี: ${escapeHtml(company.company_tax_id)}${company.company_branch ? ` (${escapeHtml(company.company_branch)})` : ''}</div>` : ''}
            </div>
          </div>
          <div class="gp-issuer-bottom-details">
            ${company.company_address ? `<div class="gp-issuer-address">${escapeHtml(company.company_address)}</div>` : ''}
            ${(company.company_phone || company.company_website || company.company_email) ? `
              <div class="gp-issuer-contact">
                ${[
                  company.company_phone ? `
                    <span class="gp-contact-item">
                      <svg class="gp-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                      <span>${escapeHtml(company.company_phone.replace(/^(โทร|tel|phone)\s*:\s*/i, '').trim())}</span>
                    </span>
                  ` : '',
                  company.company_website ? `
                    <span class="gp-contact-item">
                      <svg class="gp-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                      </svg>
                      <span>${escapeHtml(company.company_website.replace(/^(เว็บ|เว็บไซต์|web|website)\s*:\s*/i, '').trim())}</span>
                    </span>
                  ` : '',
                  company.company_email ? `
                    <span class="gp-contact-item">
                      <svg class="gp-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                      </svg>
                      <span>${escapeHtml(company.company_email.replace(/^(อีเมล|email|e-mail)\s*:\s*/i, '').trim())}</span>
                    </span>
                  ` : ''
                ].filter(Boolean).join('<span class="gp-bullet">•</span>')}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- ฝั่งขวา: ชื่อเอกสาร & ข้อมูลอ้างอิง (Document Title & Meta พร้อม QR Code หน้าเลขที่เอกสาร) -->
        <div class="gp-header-doc">
          <div class="gp-doc-heading">
            <h1 class="gp-title">ใบยืมอุปกรณ์ / GATE PASS</h1>
            ${badgeHtml}
          </div>
          <div class="gp-meta-block-wrap">
            ${qrSvg ? `
              <div class="gp-doc-qr-wrap" title="สแกนรหัสเอกสาร: ${escapeHtml(loan.id)}">
                ${qrSvg}
              </div>
            ` : ''}
            <div class="gp-meta-table">
              <div class="gp-meta-row">
                <span class="gp-meta-lbl">เลขที่เอกสาร:</span>
                <span class="gp-meta-val gp-meta-id">${escapeHtml(loan.id)}</span>
              </div>
              <div class="gp-meta-row">
                <span class="gp-meta-lbl">วันที่ทำรายการ:</span>
                <span class="gp-meta-val">${formatShortDate(loan.checkout_date)}</span>
              </div>
              <div class="gp-meta-row gp-meta-due-row">
                <span class="gp-meta-lbl">กำหนดส่งคืน:</span>
                <span class="gp-meta-val gp-meta-due">${formatShortDate(loan.due_date)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="gp-info-grid">
        <div class="gp-info-item"><span class="gp-info-lbl">ลูกค้า:</span> <span class="gp-info-val">${escapeHtml(loan.customer_name || '-')}${loan.customer_phone ? ` <span class="gp-phone">(${escapeHtml(loan.customer_phone)})</span>` : ''}</span></div>
        <div class="gp-info-item"><span class="gp-info-lbl">บริษัท:</span> <span class="gp-info-val">${escapeHtml(loan.customer_company || '-')}</span></div>
        <div class="gp-info-item"><span class="gp-info-lbl">ผู้ยืม / Sales:</span> <span class="gp-info-val">${escapeHtml(loan.borrower_name)}</span></div>
        <div class="gp-info-item"><span class="gp-info-lbl">วัตถุประสงค์:</span> <span class="gp-info-val">${escapeHtml(loan.purpose || 'Demo')}</span></div>
      </div>

      <div class="gp-table-wrap">
        <table class="gp-table">
          <thead>
            <tr>
              <th class="gp-th-idx">#</th>
              <th class="gp-th-model">รุ่นสินค้า (Brand / Model)</th>
              <th class="gp-th-sn">Serial No. (S/N)</th>
              <th class="gp-th-acc">อุปกรณ์เสริมที่ได้รับไป</th>
              <th class="gp-th-note">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            ${(loan.items || [])
              .map(
                (it, idx) => `
              <tr>
                <td class="gp-td-idx">${idx + 1}</td>
                <td class="gp-td-model">
                  <strong>${escapeHtml(it.brand)} ${escapeHtml(it.model)}</strong>
                </td>
                <td class="gp-td-sn">
                  ${
                    it.serial_no && it.serial_no.trim() !== '-'
                      ? `<code class="gp-sn-code">${escapeHtml(it.serial_no)}</code>`
                      : ''
                  }
                </td>
                <td class="gp-td-acc">
                  ${
                    (it.loan_accessories || []).length === 0
                      ? '-'
                      : it.loan_accessories.map(a => `<span class="gp-acc-tag">☑ ${escapeHtml(a)}</span>`).join('')
                  }
                </td>
                <td class="gp-td-note">
                  ${(() => {
                    const parts = [];
                    // Return date info: for Partially_Returned or Returned loans
                    if (it.returned && (it.returned_at || loan.return_date)) {
                      const retDate = it.returned_at || loan.return_date;
                      parts.push(`<div class="gp-ret-tag gp-ret-returned">วันที่คืน: ${formatShortDate(retDate)}</div>`);
                    } else if (loan.status === 'Partially_Returned' && !it.returned) {
                      parts.push(`<div class="gp-ret-tag gp-ret-pending">ยังไม่คืน</div>`);
                    }

                    if (it.loan_free_note && it.loan_free_note.trim() && it.loan_free_note.trim() !== '-') {
                      parts.push(`<div class="gp-note-free">${escapeHtml(it.loan_free_note).replace(/\n/g, '<br/>')}</div>`);
                    }

                    if (it.qc_note && it.qc_note.trim() && it.qc_note.trim() !== '-') {
                      parts.push(`<div class="gp-note-qc">QC: ${escapeHtml(it.qc_note)}</div>`);
                    }

                    if (it.attachments && it.attachments.length > 0) {
                      parts.push(`
                        <div class="print-attachments-list">
                          📎 ไฟล์แนบ: ${it.attachments.map(a => `<span class="gp-att-chip">${escapeHtml(a.name)}</span>`).join(', ')}
                        </div>
                      `);
                    }

                    return parts.join('');
                  })()}
                </td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>

      ${
        loan.before_photos && loan.before_photos.length > 0
          ? `
          <div style="margin-bottom:6px; font-size:11.5px; font-weight:600;">รูปถ่ายก่อนส่งมอบ:</div>
          <div class="gp-photos-row">
            ${loan.before_photos.map(u => `<img src="${u}" alt="Before photo" />`).join('')}
          </div>
        `
          : ''
      }

      <div class="gp-terms-notice">
        ${escapeHtml(termsText)}
      </div>

      <div class="gp-signatures">
        <!-- 1. ผู้ยืม / ผู้รับเครื่อง -->
        <div class="gp-sig-box" data-sig-role="borrower">
          <div class="gp-sig-slot">
            ${loan.borrower_signature ? `
              <div class="gp-sig-preview-wrap">
                <img class="gp-sig-img" src="${escapeHtml(loan.borrower_signature)}" alt="ลายเซ็นผู้ยืม" />
                ${!isDelivered ? `
                  <div class="gp-sig-hover-actions no-print">
                    <button type="button" class="btn-sig-icon-action" data-open-sig="borrower" title="แก้ไข">✎</button>
                    <button type="button" class="btn-sig-icon-action btn-sig-clear" data-clear-sig="borrower" title="ลบ">✕</button>
                  </div>
                ` : ''}
              </div>
            ` : (
              !isDelivered ? `
                <div class="gp-sig-empty-wrap no-print">
                  <button type="button" class="btn-open-signature" data-open-sig="borrower">
                    เซ็นชื่อ
                  </button>
                </div>
              ` : ''
            )}
          </div>
          <div class="gp-sig-line"></div>
          <div class="gp-sig-info">
            <div class="gp-sig-role">ผู้ยืม / ผู้รับเครื่อง</div>
            <div class="gp-sig-name">(${escapeHtml(loan.customer_name || loan.borrower_name)})</div>
            ${loan.borrower_signed_at ? `<div class="gp-sig-time">เซ็นเมื่อ: ${formatDateTimeThai(loan.borrower_signed_at)}</div>` : ''}
          </div>
        </div>

        <!-- 2. ผู้จ่ายเครื่อง / เจ้าหน้าที่คลัง -->
        <div class="gp-sig-box" data-sig-role="dispatcher">
          <div class="gp-sig-slot">
            ${(loan.dispatcher_signature || state.companySettings?.dispatcher_signature) ? `
              <div class="gp-sig-preview-wrap">
                <img class="gp-sig-img" src="${escapeHtml(loan.dispatcher_signature || state.companySettings?.dispatcher_signature)}" alt="ลายเซ็นผู้จ่ายเครื่อง" />
                ${!isDelivered ? `
                  <div class="gp-sig-hover-actions no-print">
                    <button type="button" class="btn-sig-icon-action" data-open-sig="dispatcher" title="แก้ไข">✎</button>
                    <button type="button" class="btn-sig-icon-action btn-sig-clear" data-clear-sig="dispatcher" title="ลบ">✕</button>
                  </div>
                ` : ''}
              </div>
            ` : (
              !isDelivered ? `
                <div class="gp-sig-empty-wrap no-print">
                  <button type="button" class="btn-open-signature" data-open-sig="dispatcher">
                    เซ็นชื่อ
                  </button>
                </div>
              ` : ''
            )}
          </div>
          <div class="gp-sig-line"></div>
          <div class="gp-sig-info">
            <div class="gp-sig-role">ผู้จ่ายเครื่อง / เจ้าหน้าที่คลัง</div>
            <div class="gp-sig-date">${loan.dispatcher_signed_at ? `วันที่ ${formatShortDate(loan.dispatcher_signed_at)}` : ((loan.dispatcher_signature || state.companySettings?.dispatcher_signature) ? `วันที่ ${formatShortDate(loan.checkout_date || new Date().toISOString())}` : 'วันที่ ....../....../......')}</div>
            ${loan.dispatcher_signed_at ? `<div class="gp-sig-time">เซ็นเมื่อ: ${formatDateTimeThai(loan.dispatcher_signed_at)}</div>` : ((!loan.dispatcher_signature && state.companySettings?.dispatcher_signature) ? '<div class="gp-sig-time">ลายเซ็นประจำระบบ</div>' : '')}
          </div>
        </div>

        <!-- 3. ผู้ตรวจรับคืน (QC) -->
        <div class="gp-sig-box" data-sig-role="receiver">
          <div class="gp-sig-slot">
            ${loan.receiver_signature ? `
              <div class="gp-sig-preview-wrap">
                <img class="gp-sig-img" src="${escapeHtml(loan.receiver_signature)}" alt="ลายเซ็นผู้ตรวจรับคืน" />
                <div class="gp-sig-hover-actions no-print">
                  <button type="button" class="btn-sig-icon-action" data-open-sig="receiver" title="แก้ไข">✎</button>
                  <button type="button" class="btn-sig-icon-action btn-sig-clear" data-clear-sig="receiver" title="ลบ">✕</button>
                </div>
              </div>
            ` : `
              <div class="gp-sig-empty-wrap no-print">
                <button type="button" class="btn-open-signature" data-open-sig="receiver">
                  เซ็นชื่อ
                </button>
              </div>
            `}
          </div>
          <div class="gp-sig-line"></div>
          <div class="gp-sig-info">
            <div class="gp-sig-role">ผู้ตรวจรับคืน (QC)</div>
            <div class="gp-sig-date">${escapeHtml(loan.return_receiver || (loan.receiver_signed_at ? `วันที่ ${formatShortDate(loan.receiver_signed_at)}` : 'วันที่ ....../....../......'))}</div>
            ${loan.receiver_signed_at ? `<div class="gp-sig-time">เซ็นเมื่อ: ${formatDateTimeThai(loan.receiver_signed_at)}</div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function isLoanExceedingHalfPage(loan) {
  if (!loan) return false;
  const items = loan.items || [];
  // More than 5 items definitely exceeds half page (148.5mm)
  if (items.length > 5) return true;
  // If photos exist, always full page
  if (loan.before_photos && loan.before_photos.length > 0) return true;

  // If 4-5 items with lots of accessories or long notes/attachments
  if (items.length >= 4) {
    let totalAcc = 0;
    let longNotes = 0;
    for (const it of items) {
      totalAcc += (it.loan_accessories || []).length;
      if (it.loan_free_note && it.loan_free_note.trim().length > 30) longNotes++;
      if (it.attachments && it.attachments.length > 0) return true;
    }
    if (totalAcc > 10 || longNotes >= 2) return true;
  }
  if (items.length === 3) {
    let totalAcc = 0;
    for (const it of items) {
      totalAcc += (it.loan_accessories || []).length;
      if (it.attachments && it.attachments.length > 0) return true;
    }
    if (totalAcc > 16) return true;
  }
  return false;
}

const PRINT_SIZE_OPTIONS = [
  {
    value: 'auto',
    label: 'อัตโนมัติ (แนะนำ)',
    title: '📄 อัตโนมัติ (Smart Auto)',
    sub: 'วิเคราะห์รายการยืมอัตโนมัติ (สลับ A4 แบ่งครึ่ง หรือ เต็มหน้า 2 ใบ)',
    badge: '<span class="print-opt-badge badge-recommended">✨ แนะนำ</span>'
  },
  {
    value: 'dual',
    label: 'A4 แบ่งครึ่ง',
    title: '📄 A4 แบ่งครึ่ง (2-in-1)',
    sub: 'ต้นฉบับ + สำเนา ในแผ่นเดียว พร้อมเส้นประรอยปรุตัดแบ่งครึ่ง',
    badge: '<span class="print-opt-badge badge-eco">🌿 ประหยัดกระดาษ</span>'
  },
  {
    value: 'full-pair',
    label: 'A4 เต็มหน้า 2 ใบ',
    title: '📑 A4 เต็มหน้า 2 ใบ (หน้าละใบ)',
    sub: 'หน้า 1 ต้นฉบับ + หน้า 2 สำเนา (เหมาะกับรายการยาว หรือมีรูปถ่าย)',
    badge: '<span class="print-opt-badge badge-photo">📷 รูปภาพ/รายการยาว</span>'
  },
  {
    value: 'a4',
    label: 'A4 เฉพาะต้นฉบับ',
    title: '📄 A4 เฉพาะต้นฉบับ (Original)',
    sub: 'พิมพ์เฉพาะใบต้นฉบับ 1 แผ่นเต็มหน้า A4 ไม่พิมพ์สำเนา',
    badge: '<span class="print-opt-badge badge-single">1 แผ่น</span>'
  },
  {
    value: 'half',
    label: 'ครึ่งแผ่น A4',
    title: '📄 ครึ่งแผ่น A4 (Single Half)',
    sub: 'พิมพ์เฉพาะครึ่งแผ่นด้านบน ประหยัดพื้นที่จัดเก็บ',
    badge: '<span class="print-opt-badge badge-compact">กะทัดรัด</span>'
  }
];

function renderPrintSizeDropdownItems() {
  const dropdown = document.getElementById('printSizeDropdown');
  if (!dropdown) return;

  const currentSize = state.printSize || 'auto';

  let itemsHtml = `
    <div class="dropdown-header-bar">
      <div class="dropdown-header-title">
        <span>📄 รูปแบบการจัดหน้ากระดาษ</span>
        <span class="dropdown-header-count">5 รูปแบบ</span>
      </div>
      <button type="button" class="btn-close-dropdown" id="btnClosePrintSizeDropdown" title="ปิด (✕)">✕</button>
    </div>
    <div class="dropdown-scroll-list">
  `;

  for (const opt of PRINT_SIZE_OPTIONS) {
    const isSelected = opt.value === currentSize;
    itemsHtml += `
      <div class="model-dropdown-item print-size-opt-item ${isSelected ? 'is-selected' : ''}" data-print-size-val="${opt.value}">
        <div class="model-item-main">
          <div class="print-opt-title-line">
            <span class="print-opt-name">${opt.title}</span>
            ${opt.badge}
          </div>
          <span class="print-opt-sub">${opt.sub}</span>
        </div>
        ${isSelected ? '<span class="print-opt-check">✓</span>' : ''}
      </div>
    `;
  }

  itemsHtml += `</div>`;
  dropdown.innerHTML = itemsHtml;

  // Add click listeners to items
  dropdown.querySelectorAll('.print-size-opt-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const val = item.getAttribute('data-print-size-val');
      selectPrintSize(val);
    });
  });

  document.getElementById('btnClosePrintSizeDropdown')?.addEventListener('click', (e) => {
    e.stopPropagation();
    closePrintSizeDropdown();
  });
}

function selectPrintSize(sizeVal) {
  state.printSize = sizeVal;
  const opt = PRINT_SIZE_OPTIONS.find(o => o.value === sizeVal) || PRINT_SIZE_OPTIONS[0];
  const lbl = document.getElementById('printSizeCurrentLabel');
  if (lbl) lbl.textContent = opt.label;

  const hiddenSelect = document.getElementById('printSizeSelect');
  if (hiddenSelect) hiddenSelect.value = sizeVal;

  closePrintSizeDropdown();
  renderGatePassHtml();
}

function openPrintSizeDropdown() {
  const trigger = document.getElementById('btnPrintSizeTrigger');
  const dropdown = document.getElementById('printSizeDropdown');
  if (!trigger || !dropdown) return;

  renderPrintSizeDropdownItems();
  dropdown.classList.remove('hidden');
  trigger.classList.add('is-active');

  const rect = trigger.getBoundingClientRect();
  const dropdownWidth = 360;
  const isMobile = window.innerWidth <= 768;

  if (isMobile) {
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${Math.min(window.innerHeight - 340, rect.bottom + 6)}px`;
    dropdown.style.left = '10px';
    dropdown.style.right = '10px';
    dropdown.style.width = 'auto';
  } else {
    dropdown.style.position = 'fixed';
    dropdown.style.top = `${rect.bottom + 6}px`;
    dropdown.style.left = `${Math.min(window.innerWidth - dropdownWidth - 16, Math.max(16, rect.left))}px`;
    dropdown.style.right = 'auto';
    dropdown.style.width = `${dropdownWidth}px`;
  }
}

function closePrintSizeDropdown() {
  const trigger = document.getElementById('btnPrintSizeTrigger');
  const dropdown = document.getElementById('printSizeDropdown');
  if (dropdown) dropdown.classList.add('hidden');
  if (trigger) trigger.classList.remove('is-active');
}

function renderGatePassHtml() {
  const loan = state.loans.find(l => l.id === state.activePrintLoanId);
  if (!loan) return;

  const idBadge = document.getElementById('printLoanIdBadge');
  if (idBadge) idBadge.textContent = loan.id;

  // Auto-detect if content exceeds half an A4 page
  const exceedsHalf = isLoanExceedingHalfPage(loan);
  let effectiveSize = state.printSize;
  if (effectiveSize === 'auto') {
    effectiveSize = exceedsHalf ? 'full-pair' : 'dual';
  }

  const noticeEl = document.getElementById('printModeNotice');
  if (noticeEl) {
    if (effectiveSize === 'full-pair') {
      noticeEl.innerHTML = `<span class="badge-mode-tag mode-full" title="ระบบปรับเป็นพิมพ์แยก 2 ใบอัตโนมัติ">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="7" y="2" width="13" height="16" rx="2"></rect>
          <path d="M4 8H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-1"></path>
        </svg>
        <span>เต็มหน้า 2 ใบ</span>
      </span>`;
    } else if (effectiveSize === 'dual') {
      noticeEl.innerHTML = `<span class="badge-mode-tag mode-dual" title="พิมพ์ 2-in-1 ต้นฉบับ+สำเนา ในกระดาษแผ่นเดียว">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"></rect>
          <line x1="3" y1="12" x2="21" y2="12"></line>
        </svg>
        <span>A4 แบ่งครึ่ง</span>
      </span>`;
    } else {
      noticeEl.innerHTML = '';
    }
  }

  // Update select value and custom trigger label if not matched
  const selectEl = document.getElementById('printSizeSelect');
  if (selectEl && selectEl.value !== state.printSize) {
    selectEl.value = state.printSize;
  }
  const curOpt = PRINT_SIZE_OPTIONS.find(o => o.value === state.printSize) || PRINT_SIZE_OPTIONS[0];
  const currentLblEl = document.getElementById('printSizeCurrentLabel');
  if (currentLblEl) currentLblEl.textContent = curOpt.label;

  let html = '';
  if (effectiveSize === 'dual') {
    html = `
      <div class="gate-pass-dual-wrapper">
        <!-- ครึ่งบน: ต้นฉบับ (Original) -->
        <div class="gp-half-slot gp-half-top">
          ${renderSingleGatePassSheet(loan, 'original', 'size-dual')}
        </div>

        <!-- เส้นประแบ่งครึ่งหน้ากระดาษ A4 สำหรับตัด/ฉีก (กึ่งกลาง 148.5mm พอดี) -->
        <div class="gp-perforation-divider">
          <div class="gp-perf-line"></div>
          <span class="gp-perf-label">✂️ รอยปรุ / ตัดแบ่งครึ่งหน้ากระดาษ A4 (ต้นฉบับ - สำเนา)</span>
          <div class="gp-perf-line"></div>
        </div>

        <!-- ครึ่งล่าง: สำเนา (Copy) -->
        <div class="gp-half-slot gp-half-bottom">
          ${renderSingleGatePassSheet(loan, 'copy', 'size-dual')}
        </div>
      </div>
    `;
  } else if (effectiveSize === 'full-pair') {
    html = `
      <div class="gate-pass-full-pair-wrapper">
        <!-- แผ่นที่ 1: ต้นฉบับ เต็มหน้า A4 -->
        <div class="gp-page-sheet gp-page-original">
          <div class="gp-page-indicator no-print">
            <span class="indicator-title">★ แผ่นที่ 1: ต้นฉบับ (ORIGINAL)</span>
            <span class="indicator-page">หน้า 1/2</span>
          </div>
          ${renderSingleGatePassSheet(loan, 'original', 'size-a4')}
        </div>

        <!-- แผ่นที่ 2: สำเนา เต็มหน้า A4 -->
        <div class="gp-page-sheet gp-page-copy">
          <div class="gp-page-indicator no-print">
            <span class="indicator-title">📑 แผ่นที่ 2: สำเนา (COPY)</span>
            <span class="indicator-page">หน้า 2/2</span>
          </div>
          ${renderSingleGatePassSheet(loan, 'copy', 'size-a4')}
        </div>
      </div>
    `;
  } else if (effectiveSize === 'half') {
    html = `
      <div class="gate-pass-half-wrapper">
        <div class="gp-half-slot gp-half-top">
          ${renderSingleGatePassSheet(loan, 'original', 'size-half size-dual')}
        </div>
        <div class="gp-perforation-divider">
          <div class="gp-perf-line"></div>
          <span class="gp-perf-label">✂️ รอยตัดแบ่งครึ่งหน้ากระดาษ A4</span>
          <div class="gp-perf-line"></div>
        </div>
      </div>
    `;
  } else {
    // effectiveSize === 'a4' or other
    html = `
      <div class="gate-pass-single-a4-wrapper">
        ${renderSingleGatePassSheet(loan, 'original', 'size-a4')}
      </div>
    `;
  }

  document.getElementById('printPreviewContainer').innerHTML = html;
  document.getElementById('printMount').innerHTML = html;
  requestAnimationFrame(() => {
    updateGatePassPreviewScale();
  });
}

function updateGatePassPreviewScale() {
  const dialog = document.getElementById('printDialog');
  if (!dialog || !dialog.open) return;
  const scrollContainer = dialog.querySelector('.print-preview-scroll');
  const viewport = document.getElementById('printScaleViewport');
  const sheetWrap = document.getElementById('printPreviewContainer');
  const segmentedWrap = document.getElementById('printZoomSegmented');
  const btnFit = document.getElementById('btnZoomFit');
  const btn100 = document.getElementById('btnZoom100');

  if (!scrollContainer || !sheetWrap) return;

  const isMobile = window.innerWidth <= 768;
  if (!isMobile) {
    if (viewport) {
      viewport.style.width = '';
      viewport.style.height = '';
      viewport.style.position = '';
    }
    sheetWrap.style.transform = '';
    sheetWrap.style.transformOrigin = '';
    sheetWrap.style.position = '';
    sheetWrap.style.left = '';
    sheetWrap.style.top = '';
    if (segmentedWrap) segmentedWrap.style.display = 'none';
    return;
  }

  if (segmentedWrap) segmentedWrap.style.display = 'inline-flex';

  if (!state.printZoomMode) {
    state.printZoomMode = '100';
  }

  if (state.printZoomMode === '100') {
    if (viewport) {
      viewport.style.width = '780px';
      viewport.style.height = 'auto';
      viewport.style.position = 'relative';
    }
    sheetWrap.style.transform = 'scale(1)';
    sheetWrap.style.transformOrigin = '0 0';
    sheetWrap.style.position = 'relative';
    sheetWrap.style.left = '';
    sheetWrap.style.top = '';

    btn100?.classList.add('is-active');
    btnFit?.classList.remove('is-active');
  } else {
    // Default 'fit' mode (พอดีจอ)
    state.printZoomMode = 'fit';
    const availableWidth = scrollContainer.clientWidth - 20; // 10px padding each side
    const baseWidth = 780;
    const scale = Math.min(1, Math.max(0.35, availableWidth / baseWidth));
    const unscaledHeight = sheetWrap.offsetHeight || 1100;
    const scaledWidth = Math.round(baseWidth * scale);
    const scaledHeight = Math.round(unscaledHeight * scale);

    if (viewport) {
      viewport.style.width = `${scaledWidth}px`;
      viewport.style.height = `${scaledHeight}px`;
      viewport.style.position = 'relative';
    }
    sheetWrap.style.transformOrigin = '0 0';
    sheetWrap.style.transform = `scale(${scale})`;
    sheetWrap.style.position = 'absolute';
    sheetWrap.style.left = '0';
    sheetWrap.style.top = '0';

    btnFit?.classList.add('is-active');
    btn100?.classList.remove('is-active');
  }
}

function setupDigitalSignatureModal() {
  const modal = document.getElementById('digitalSignatureModal');
  const canvas = document.getElementById('digitalSigCanvas');
  if (!modal || !canvas) return;

  const ctx = canvas.getContext('2d');
  let drawing = false;
  let lastPos = null;

  function resizeCanvas() {
    const wrap = document.getElementById('sigCanvasWrap');
    if (!wrap) return;
    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 2;
    const isRotated = modal.classList.contains('is-rotated-landscape');

    // In rotated mode, wrap bounding rect width is screen width, height is screen height.
    // Local width of canvas corresponds to rect.height, local height corresponds to rect.width.
    const width = isRotated ? Math.round(rect.height || 540) : Math.round(rect.width || 540);
    const height = isRotated ? Math.round(rect.width || 220) : Math.round(rect.height || 220);

    canvas.width = Math.max(300, width * dpr);
    canvas.height = Math.max(160, height * dpr);

    ctx.scale(dpr, dpr);
    ctx.strokeStyle = state.sigPenColor || '#0f172a';
    ctx.lineWidth = Number(state.sigPenSize) || 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const isRotated = modal.classList.contains('is-rotated-landscape');
    const dpr = window.devicePixelRatio || 2;
    const localWidth = canvas.width / dpr;
    const localHeight = canvas.height / dpr;

    if (isRotated) {
      // +90 deg clockwise:
      // Screen top-right is local (0, 0)
      // Screen Y increases going down -> local X increases
      // Screen X decreases going left -> local Y increases
      const x = ((e.clientY - rect.top) / rect.height) * localWidth;
      const y = ((rect.right - e.clientX) / rect.width) * localHeight;
      return { x, y };
    } else {
      const x = ((e.clientX - rect.left) / rect.width) * localWidth;
      const y = ((e.clientY - rect.top) / rect.height) * localHeight;
      return { x, y };
    }
  }

  function startDraw(e) {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    drawing = true;
    state.digitalSigDirty = true;
    const wrap = document.getElementById('sigCanvasWrap');
    if (wrap) {
      wrap.classList.add('has-signature', 'is-drawing');
    }
    document.getElementById('sigCanvasWatermark')?.classList.add('hidden');
    lastPos = getCanvasPos(e);
    const penSize = Number(state.sigPenSize) || 2.5;
    ctx.beginPath();
    ctx.arc(lastPos.x, lastPos.y, penSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = state.sigPenColor || '#0f172a';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
  }

  function drawMove(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = getCanvasPos(e);
    const penSize = Number(state.sigPenSize) || 2.5;
    ctx.strokeStyle = state.sigPenColor || '#0f172a';
    ctx.lineWidth = penSize;
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPos = p;
  }

  function stopDraw(e) {
    if (!drawing) return;
    drawing = false;
    document.getElementById('sigCanvasWrap')?.classList.remove('is-drawing');
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch (_) {}
  }

  canvas.addEventListener('pointerdown', startDraw);
  canvas.addEventListener('pointermove', drawMove);
  canvas.addEventListener('pointerup', stopDraw);
  canvas.addEventListener('pointercancel', stopDraw);

  // Orientation toggle for mobile
  const btnToggleOrient = document.getElementById('btnToggleSigOrient');
  const orientText = document.getElementById('sigOrientText');
  btnToggleOrient?.addEventListener('click', () => {
    state.isSigLandscapeRotated = !state.isSigLandscapeRotated;
    modal.classList.toggle('is-rotated-landscape', state.isSigLandscapeRotated);
    if (orientText) {
      orientText.textContent = state.isSigLandscapeRotated ? 'แนวตั้ง' : 'แนวนอน';
    }
    setTimeout(() => {
      resizeCanvas();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      state.digitalSigDirty = false;
      const wrap = document.getElementById('sigCanvasWrap');
      wrap?.classList.remove('has-signature');
      document.getElementById('sigCanvasWatermark')?.classList.remove('hidden');
    }, 60);
  });

  window.addEventListener('resize', () => {
    if (modal.open && state.activeSigMode === 'draw') {
      resizeCanvas();
    }
  });

  // Clear button
  document.getElementById('btnClearDigitalSig')?.addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    state.digitalSigDirty = false;
    const wrap = document.getElementById('sigCanvasWrap');
    wrap?.classList.remove('has-signature');
    document.getElementById('sigCanvasWatermark')?.classList.remove('hidden');
  });

  // Color picker
  document.querySelectorAll('.sig-color-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.sig-color-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.sigPenColor = btn.getAttribute('data-color') || '#0f172a';
      ctx.strokeStyle = state.sigPenColor;
      document.documentElement.style.setProperty('--sig-active-pen-color', state.sigPenColor);
    });
  });

  // Pen size slider scale
  const sizeSlider = document.getElementById('sigPenSizeSlider');
  const sizeBadge = document.getElementById('sigPenSizeVal');
  sizeSlider?.addEventListener('input', e => {
    const val = parseFloat(e.target.value) || 2.5;
    state.sigPenSize = val;
    ctx.lineWidth = val;
    if (sizeBadge) {
      sizeBadge.textContent = `${val.toFixed(1).replace('.0', '')}px`;
    }
  });

  // Tabs: Draw vs Upload
  document.querySelectorAll('.sig-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.getAttribute('data-sig-mode');
      state.activeSigMode = mode;
      document.querySelectorAll('.sig-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      if (mode === 'draw') {
        document.getElementById('sigDrawSection')?.classList.remove('hidden');
        document.getElementById('sigUploadSection')?.classList.add('hidden');
        resizeCanvas();
      } else {
        document.getElementById('sigDrawSection')?.classList.add('hidden');
        document.getElementById('sigUploadSection')?.classList.remove('hidden');
      }
    });
  });

  // File Upload
  const fileInp = document.getElementById('sigFileInput');
  const dropzone = document.getElementById('sigUploadDropzone');
  dropzone?.addEventListener('click', () => fileInp?.click());
  fileInp?.addEventListener('change', async e => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, 800, 0.9);
      state.uploadedSigDataUrl = dataUrl;
      const previewImg = document.getElementById('sigUploadPreviewImg');
      if (previewImg) previewImg.src = dataUrl;
      document.getElementById('sigUploadPreviewWrap')?.classList.remove('hidden');
      dropzone.classList.add('hidden');
    } catch (err) {
      showAlert('อัปโหลดไฟล์ไม่สำเร็จ: ' + err.message);
    }
  });

  document.getElementById('btnRemoveUploadedSig')?.addEventListener('click', () => {
    state.uploadedSigDataUrl = '';
    if (fileInp) fileInp.value = '';
    document.getElementById('sigUploadPreviewWrap')?.classList.add('hidden');
    dropzone?.classList.remove('hidden');
  });

  // Close / Cancel modal
  const closeSig = () => modal.close();
  document.getElementById('btnCloseSigModal')?.addEventListener('click', closeSig);
  document.getElementById('btnCancelSigModal')?.addEventListener('click', closeSig);

  // Apply saved dispatcher signature from settings
  document.getElementById('btnApplySavedDispatcherSig')?.addEventListener('click', () => {
    const saved = state.companySettings?.dispatcher_signature;
    if (!saved) {
      showToast('⚠️ ไม่พบลายเซ็นผู้จ่ายเครื่องที่บันทึกไว้ในระบบ');
      return;
    }
    state.activeSigMode = 'upload';
    state.uploadedSigDataUrl = saved;
    document.querySelectorAll('.sig-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-sig-mode') === 'upload');
    });
    document.getElementById('sigDrawSection')?.classList.add('hidden');
    document.getElementById('sigUploadSection')?.classList.remove('hidden');

    const previewImg = document.getElementById('sigUploadPreviewImg');
    if (previewImg) previewImg.src = saved;
    document.getElementById('sigUploadPreviewWrap')?.classList.remove('hidden');
    document.getElementById('sigUploadDropzone')?.classList.add('hidden');
    showToast('⚡ ดึงลายเซ็นที่บันทึกไว้มาใช้เรียบร้อย');
  });

  // Save Signature
  document.getElementById('btnSaveDigitalSig')?.addEventListener('click', async () => {
    let sigData = '';
    if (state.activeSigMode === 'draw') {
      if (!state.digitalSigDirty) {
        showAlert('กรุณาวาดลายเซ็นก่อนกดบันทึก');
        return;
      }
      sigData = canvas.toDataURL('image/png');
    } else {
      if (!state.uploadedSigDataUrl) {
        showAlert('กรุณาเลือกไฟล์รูปลายเซ็น');
        return;
      }
      sigData = state.uploadedSigDataUrl;
    }

    const saveBtn = document.getElementById('btnSaveDigitalSig');

    // Case 0: Custom callback handler (e.g. Return Modal, Supplier/Sales Return, Delivery Modal)
    if (typeof state.customSignatureCallback === 'function') {
      try {
        state.customSignatureCallback(sigData);
      } catch (err) {
        console.error('customSignatureCallback error:', err);
      }
      state.customSignatureCallback = null;
      modal.close();
      showToast('✅ เซ็นชื่อเรียบร้อย');
      return;
    }

    // Case 1: Saving system default dispatcher signature from Company Settings
    if (state.activeSigRole === 'dispatcher_setting') {
      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = 'บันทึก...';
      }
      try {
        const res = await fetch('/api/company-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dispatcher_signature: sigData })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'บันทึกลายเซ็นไม่สำเร็จ');
        if (data.success && data.settings) {
          state.companySettings = data.settings;
          const savedUrl = data.settings.dispatcher_signature || sigData;
          if (typeof window.updateCompanyDispatcherSigPreview === 'function') {
            window.updateCompanyDispatcherSigPreview(savedUrl);
          }
          renderGatePassHtml();
        }
        modal.close();
        showToast('✅ บันทึกลายเซ็นผู้จ่ายเครื่องในโปรแกรมเรียบร้อย');
      } catch (err) {
        showAlert(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = 'บันทึก';
        }
      }
      return;
    }

    // Case 2: Saving signature for a specific loan
    const loan = state.loans.find(l => l.id === state.activePrintLoanId);
    if (!loan) return;

    const saveAsDefault = state.activeSigRole === 'dispatcher' && Boolean(document.getElementById('chkSaveDefaultDispatcherSig')?.checked);

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'บันทึก...';
    }

    try {
      const res = await fetch(`/api/loans/${encodeURIComponent(loan.id)}/signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role: state.activeSigRole,
          signature: sigData,
          signed_at: new Date().toISOString(),
          save_as_default: saveAsDefault
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกลายเซ็นไม่สำเร็จ');
      applyServerState(data);
      if (saveAsDefault) {
        state.companySettings = {
          ...state.companySettings,
          dispatcher_signature: sigData
        };
        if (typeof window.updateCompanyDispatcherSigPreview === 'function') {
          window.updateCompanyDispatcherSigPreview(sigData);
        }
      }
      if (state.activeDispatchLoan) {
        state.activeDispatchLoan = state.loans.find(l => l.id === state.activeDispatchLoan.id) || state.activeDispatchLoan;
        updateDispatchSummary();
      }
      renderGatePassHtml();
      modal.close();
      showToast(saveAsDefault ? '✅ บันทึกลายเซ็นและบันทึกเป็นค่าเริ่มต้นประจำระบบเรียบร้อย' : '✅ บันทึกลายเซ็นเรียบร้อย');
    } catch (err) {
      showAlert(err.message || 'เกิดข้อผิดพลาดในการบันทึก');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'บันทึก';
      }
    }
  });

  // Global delegation on gate pass preview for signature clicks
  document.getElementById('printPreviewContainer')?.addEventListener('click', async e => {
    const openBtn = e.target.closest('[data-open-sig]');
    if (openBtn) {
      e.stopPropagation();
      const role = openBtn.getAttribute('data-open-sig');
      const loan = state.loans.find(l => l.id === state.activePrintLoanId);
      const isDelivered = loan && ['Delivered', 'Partially_Returned', 'Returned'].includes(loan.status);
      if (isDelivered && role !== 'receiver') {
        showToast('🔒 ใบยืมนี้ส่งมอบแล้ว ไม่สามารถแก้ไขลายเซ็นต์ได้');
        return;
      }
      openDigitalSigModalForRole(role);
      return;
    }

    const clearBtn = e.target.closest('[data-clear-sig]');
    if (clearBtn) {
      e.stopPropagation();
      const role = clearBtn.getAttribute('data-clear-sig');
      const loan = state.loans.find(l => l.id === state.activePrintLoanId);
      if (!loan) return;

      const isDelivered = ['Delivered', 'Partially_Returned', 'Returned'].includes(loan.status);
      if (isDelivered && role !== 'receiver') {
        showToast('🔒 ใบยืมนี้ส่งมอบแล้ว ไม่สามารถลบลายเซ็นต์ได้');
        return;
      }

      const roleTitles = {
        borrower: 'ผู้ยืม / ผู้รับเครื่อง',
        dispatcher: 'ผู้จ่ายเครื่อง / คลัง',
        receiver: 'ผู้ตรวจรับคืน (QC)'
      };
      const rolePersons = {
        borrower: loan.customer_name || loan.borrower_name,
        dispatcher: 'เจ้าหน้าที่คลัง',
        receiver: loan.return_receiver || 'เจ้าหน้าที่ QC'
      };
      const roleSigMap = {
        borrower: loan.borrower_signature,
        dispatcher: loan.dispatcher_signature,
        receiver: loan.receiver_signature
      };
      const currentSigImg = roleSigMap[role];

      const confirmed = await showConfirmDialog({
        title: 'ยืนยันการลบลายเซ็น',
        message: 'คุณต้องการนำลายเซ็นนี้ออกจากเอกสารใช่หรือไม่? การกระทำนี้ไม่สามารถเรียกคืนได้',
        itemHtml: `
          <div class="confirm-sig-preview-card">
            ${currentSigImg ? `<div class="confirm-sig-thumb"><img src="${escapeHtml(currentSigImg)}" alt="ลายเซ็น" /></div>` : ''}
            <div class="confirm-sig-meta">
              <span class="confirm-sig-role">${escapeHtml(roleTitles[role] || 'ผู้ลงนาม')}</span>
              ${rolePersons[role] ? `<span class="gp-bullet">•</span><span class="confirm-sig-person">${escapeHtml(rolePersons[role])}</span>` : ''}
            </div>
          </div>
        `,
        confirmText: 'ลบลายเซ็น',
        cancelText: 'ยกเลิก',
        icon: '🖋️',
        confirmBtnClass: 'btn-danger'
      });
      if (!confirmed) return;

      try {
        const res = await fetch(`/api/loans/${encodeURIComponent(loan.id)}/signature`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            role,
            clear: true
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'ลบลายเซ็นไม่สำเร็จ');
        applyServerState(data);
        if (state.activeDispatchLoan) {
          state.activeDispatchLoan = state.loans.find(l => l.id === state.activeDispatchLoan.id) || state.activeDispatchLoan;
          updateDispatchSummary();
        }
        renderGatePassHtml();
        showToast('ลบลายเซ็นเรียบร้อย');
      } catch (err) {
        showAlert(err.message || 'เกิดข้อผิดพลาด');
      }
    }
  });

  window.openDigitalSigModalForRole = function(role, options = {}) {
    if (typeof options === 'function') {
      options = { onSave: options };
    }
    state.customSignatureCallback = options.onSave || null;

    if (role !== 'dispatcher_setting' && !state.customSignatureCallback) {
      if (!state.activePrintLoanId && state.loans.length > 0) {
        state.activePrintLoanId = state.loans[0].id;
      }
      const loan = state.loans.find(l => l.id === state.activePrintLoanId);
      if (!loan) return;

      const isDelivered = ['Delivered', 'Partially_Returned', 'Returned'].includes(loan.status);
      if (isDelivered && role !== 'receiver') {
        showToast('🔒 ใบยืมนี้ส่งมอบแล้ว ไม่สามารถแก้ไขลายเซ็นต์ได้');
        return;
      }
    }
    state.activeSigRole = role || 'borrower';
    state.activeSigMode = 'draw';
    state.uploadedSigDataUrl = '';
    state.digitalSigDirty = false;

    const roleTitles = {
      borrower: 'ผู้ยืม / ผู้รับเครื่อง',
      dispatcher: 'ผู้จ่ายเครื่อง / คลัง',
      receiver: 'ผู้ตรวจรับคืน (QC)',
      return_receiver: 'ผู้รับคืนสินค้า / ตัวแทน Supplier'
    };
    const loan = state.loans.find(l => l.id === state.activePrintLoanId);
    const rolePersons = {
      borrower: (loan && (loan.customer_name || loan.borrower_name)) || '',
      dispatcher: 'เจ้าหน้าที่คลัง',
      receiver: (loan && (loan.return_receiver || 'เจ้าหน้าที่ QC')) || '',
      return_receiver: 'ผู้รับคืนสินค้า'
    };

    const titleEl = document.getElementById('sigModalTitle');
    const subEl = document.getElementById('sigModalSubtitle');
    const banner = document.getElementById('sigSavedDispatcherBanner');
    const chkSaveDefaultWrap = document.getElementById('lblSaveDefaultDispatcherSig');
    const chkSaveDefault = document.getElementById('chkSaveDefaultDispatcherSig');

    if (options.title) {
      if (titleEl) titleEl.textContent = options.title;
      if (subEl) subEl.textContent = options.subtitle || '';
      if (chkSaveDefaultWrap) chkSaveDefaultWrap.classList.add('hidden');
      if (banner) banner.classList.add('hidden');
    } else if (role === 'dispatcher_setting') {
      if (titleEl) titleEl.textContent = 'บันทึกลายเซ็นผู้จ่ายเครื่อง';
      if (subEl) subEl.textContent = 'บันทึกเป็นลายเซ็นประจำโปรแกรม (ใช้ซ้ำทุกใบยืมอัตโนมัติ)';
      if (chkSaveDefaultWrap) chkSaveDefaultWrap.classList.add('hidden');
      if (banner) banner.classList.add('hidden');
    } else {
      if (titleEl) titleEl.textContent = 'เซ็นชื่อ';
      if (subEl) subEl.textContent = `${roleTitles[role] || 'ผู้ลงนาม'} • ${(loan && (rolePersons[role] || loan.id)) || ''}`;

      if (role === 'dispatcher') {
        if (chkSaveDefaultWrap) chkSaveDefaultWrap.classList.remove('hidden');
        if (chkSaveDefault) chkSaveDefault.checked = false;
        if (banner) {
          if (state.companySettings?.dispatcher_signature) {
            banner.classList.remove('hidden');
          } else {
            banner.classList.add('hidden');
          }
        }
      } else {
        if (chkSaveDefaultWrap) chkSaveDefaultWrap.classList.add('hidden');
        if (banner) banner.classList.add('hidden');
      }
    }

    const timeEl = document.getElementById('sigCurrentTimeText');
    if (timeEl) timeEl.textContent = `🕒 ${formatDateTimeThai(new Date().toISOString())}`;

    // Auto-detect mobile portrait orientation and enable rotated landscape for big signature pad
    const isMobilePortrait = window.innerWidth <= 640 && window.innerHeight > window.innerWidth;
    state.isSigLandscapeRotated = isMobilePortrait;
    modal.classList.toggle('is-rotated-landscape', state.isSigLandscapeRotated);
    const orientText = document.getElementById('sigOrientText');
    if (orientText) {
      orientText.textContent = state.isSigLandscapeRotated ? 'แนวตั้ง' : 'แนวนอน';
    }

    // Reset tabs
    document.querySelectorAll('.sig-tab-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-sig-mode') === 'draw');
    });
    document.getElementById('sigDrawSection')?.classList.remove('hidden');
    document.getElementById('sigUploadSection')?.classList.add('hidden');

    // Sync pen color & size slider UI
    const curColor = state.sigPenColor || '#0f172a';
    document.querySelectorAll('.sig-color-btn').forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-color') === curColor);
    });
    document.documentElement.style.setProperty('--sig-active-pen-color', curColor);

    const curSize = parseFloat(state.sigPenSize) || 2.5;
    const curSlider = document.getElementById('sigPenSizeSlider');
    const curBadge = document.getElementById('sigPenSizeVal');
    if (curSlider) curSlider.value = curSize;
    if (curBadge) curBadge.textContent = `${curSize.toFixed(1).replace('.0', '')}px`;

    // Reset Upload
    document.getElementById('sigUploadPreviewWrap')?.classList.add('hidden');
    document.getElementById('sigUploadDropzone')?.classList.remove('hidden');
    if (fileInp) fileInp.value = '';

    const wrap = document.getElementById('sigCanvasWrap');
    wrap?.classList.remove('has-signature');
    document.getElementById('sigCanvasWatermark')?.classList.remove('hidden');

    modal.showModal();
    setTimeout(() => {
      resizeCanvas();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      document.getElementById('sigCanvasWatermark')?.classList.remove('hidden');
    }, 60);
  };
}

function setupCompanySettingsModal() {
  const modal = document.getElementById('companySettingsModal');
  const btnOpen = document.getElementById('btnOpenCompanySettings');
  const btnClose = document.getElementById('btnCloseCompanySettings');
  const btnCancel = document.getElementById('btnCancelCompanySettings');
  const btnSave = document.getElementById('btnSaveCompanySettings');
  if (!modal) return;

  function switchEmailProviderTab(provider) {
    const hiddenInp = document.getElementById('settingEmailProvider');
    if (hiddenInp) hiddenInp.value = provider;

    const tabs = document.querySelectorAll('.provider-tab');
    tabs.forEach(t => {
      t.classList.toggle('active', t.dataset.provider === provider);
    });

    const panelApi = document.getElementById('panelEmailApi');
    const panelSmtp = document.getElementById('panelEmailSmtp');
    const badge = document.getElementById('smtpActiveProviderBadge');
    const guideResend = document.getElementById('guideNoteResend');
    const guideSendGrid = document.getElementById('guideNoteSendGrid');
    const apiKeyInp = document.getElementById('settingEmailApiKey');
    const lblApiKey = document.getElementById('lblEmailApiKey');

    if (provider === 'smtp') {
      if (panelApi) panelApi.classList.add('hidden');
      if (panelSmtp) panelSmtp.classList.remove('hidden');
      if (badge) {
        badge.textContent = '📧 Gmail SMTP';
        badge.style.color = '#dc2626';
        badge.style.background = '#fef2f2';
        badge.style.borderColor = '#fecaca';
      }
    } else {
      if (panelApi) panelApi.classList.remove('hidden');
      if (panelSmtp) panelSmtp.classList.add('hidden');
      if (provider === 'sendgrid') {
        if (guideResend) guideResend.classList.add('hidden');
        if (guideSendGrid) guideSendGrid.classList.remove('hidden');
        if (apiKeyInp) apiKeyInp.placeholder = 'SG.xxxxxxxxxxxxxxxxxxxxxxxx';
        if (lblApiKey) lblApiKey.textContent = 'SendGrid API Key *';
        if (badge) {
          badge.textContent = '✉️ SendGrid API';
          badge.style.color = '#0284c7';
          badge.style.background = '#f0f9ff';
          badge.style.borderColor = '#bae6fd';
        }
      } else {
        // Resend
        if (guideResend) guideResend.classList.remove('hidden');
        if (guideSendGrid) guideSendGrid.classList.add('hidden');
        if (apiKeyInp) apiKeyInp.placeholder = 're_xxxxxxxxxxxxxxxxxxxxxxxx';
        if (lblApiKey) lblApiKey.textContent = 'Resend API Key *';
        if (badge) {
          badge.textContent = '⚡ แนะนำ: Resend API';
          badge.style.color = '#2563eb';
          badge.style.background = '#eff6ff';
          badge.style.borderColor = '#bfdbfe';
        }
      }
    }
  }

  function populateModal() {
    const c = state.companySettings || {};
    const setVal = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = v || '';
    };
    setVal('settingCompanyName', c.company_name);
    setVal('settingCompanyNameEn', c.company_name_en);
    setVal('settingCompanyTaxId', c.company_tax_id);
    setVal('settingCompanyBranch', c.company_branch);
    setVal('settingCompanyAddress', c.company_address);
    setVal('settingCompanyPhone', c.company_phone);
    setVal('settingCompanyEmail', c.company_email);
    setVal('settingCompanyWebsite', c.company_website);
    setVal('settingGatepassTerms', c.gatepass_terms);

    // Email provider & API key
    const initProvider = c.email_provider || (c.email_api_key ? (c.email_api_key.startsWith('SG.') ? 'sendgrid' : 'resend') : (c.smtp_user ? 'smtp' : 'resend'));
    setVal('settingEmailProvider', initProvider);

    const cachedKey = localStorage.getItem('activeasset_cached_email_api_key') || '';
    const resolvedKey = c.email_api_key || cachedKey;
    setVal('settingEmailApiKey', resolvedKey);
    setVal('settingEmailFromAddress', c.email_from_address || 'a5@active5.co.th');
    setVal('settingEmailFromName', c.email_from_name || c.company_name || 'บริษัท แอคทีฟ 5 จำกัด');

    // Auto-sync cached key to server if server database was re-seeded on cloud deploy
    if (!c.email_api_key && cachedKey) {
      fetch('/api/company-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email_api_key: cachedKey, email_provider: initProvider })
      }).then(r => r.json()).then(res => {
        if (res.success && res.settings) state.companySettings = res.settings;
      }).catch(() => {});
    }

    // Gmail SMTP fallback fields
    setVal('settingSmtpUser', c.smtp_user);
    setVal('settingSmtpPass', c.smtp_pass);
    setVal('settingSmtpFromName', c.smtp_from_name);
    setVal('companyLogoUrlVal', c.company_logo);

    // Auth & Google Workspace settings
    const chkAuth = document.getElementById('settingAuthRequireLogin');
    if (chkAuth) chkAuth.checked = c.auth_require_login !== '0';
    setVal('settingAuthAllowedDomains', c.auth_allowed_domains || 'active5.co.th');
    setVal('settingAuthGoogleClientId', c.auth_google_client_id || '');

    switchEmailProviderTab(initProvider);

    const apiStatusBox = document.getElementById('apiTestStatusBox');
    if (apiStatusBox) {
      apiStatusBox.className = 'smtp-status-box hidden';
      apiStatusBox.textContent = '';
    }

    const smtpStatusBox = document.getElementById('smtpTestStatusBox');
    if (smtpStatusBox) {
      smtpStatusBox.className = 'smtp-status-box hidden';
      smtpStatusBox.textContent = '';
    }

    updateLogoPreview(c.company_logo || '');
    updateDispatcherSigPreview(c.dispatcher_signature || '');
  }

  function updateDispatcherSigPreview(url) {
    const previewImg = document.getElementById('companyDispatcherSigPreviewImg');
    const placeholder = document.getElementById('companyDispatcherSigPlaceholder');
    const btnRemove = document.getElementById('btnRemoveCompanyDispatcherSig');
    const sigUrlVal = document.getElementById('companyDispatcherSigUrlVal');

    if (sigUrlVal) sigUrlVal.value = url || '';
    if (url) {
      if (previewImg) {
        previewImg.src = url;
        previewImg.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (btnRemove) btnRemove.classList.remove('hidden');
    } else {
      if (previewImg) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (btnRemove) btnRemove.classList.add('hidden');
    }
  }
  window.updateCompanyDispatcherSigPreview = updateDispatcherSigPreview;

  function updateLogoPreview(url) {
    const previewImg = document.getElementById('companyLogoPreviewImg');
    const placeholder = document.getElementById('companyLogoPlaceholder');
    const btnRemove = document.getElementById('btnRemoveCompanyLogo');
    const btnChoose = document.getElementById('btnChooseCompanyLogo');
    const logoUrlVal = document.getElementById('companyLogoUrlVal');

    if (logoUrlVal) logoUrlVal.value = url;
    if (url) {
      if (previewImg) {
        previewImg.src = url;
        previewImg.classList.remove('hidden');
      }
      if (placeholder) placeholder.classList.add('hidden');
      if (btnRemove) btnRemove.classList.remove('hidden');
      if (btnChoose) btnChoose.textContent = 'เปลี่ยนรูปภาพ';
    } else {
      if (previewImg) {
        previewImg.src = '';
        previewImg.classList.add('hidden');
      }
      if (placeholder) placeholder.classList.remove('hidden');
      if (btnRemove) btnRemove.classList.add('hidden');
      if (btnChoose) btnChoose.textContent = 'เลือกรูปภาพ';
    }
  }

  function switchCompanyMainTab(tabKey) {
    const mainTabBtns = document.querySelectorAll('.company-main-tab');
    mainTabBtns.forEach(btn => {
      btn.classList.toggle('is-active', btn.dataset.companyTab === tabKey);
    });

    const panelInfo = document.getElementById('tabPanelCompanyInfo');
    const panelEmail = document.getElementById('tabPanelCompanyEmail');
    const panelAuth = document.getElementById('tabPanelCompanyAuth');
    const panelRoles = document.getElementById('tabPanelCompanyRoles');
    const panelUsers = document.getElementById('tabPanelCompanyUsers');
    const panelMaster = document.getElementById('tabPanelCompanyMaster');

    if (panelInfo) panelInfo.classList.toggle('hidden', tabKey !== 'info');
    if (panelEmail) panelEmail.classList.toggle('hidden', tabKey !== 'email');
    if (panelAuth) panelAuth.classList.toggle('hidden', tabKey !== 'auth');
    if (panelRoles) panelRoles.classList.toggle('hidden', tabKey !== 'roles');
    if (panelUsers) panelUsers.classList.toggle('hidden', tabKey !== 'users');
    if (panelMaster) panelMaster.classList.toggle('hidden', tabKey !== 'master');

    if (tabKey === 'roles' || tabKey === 'users') {
      loadRolesAndUsersUI();
    } else if (tabKey === 'master') {
      if (typeof loadMasterDataUI === 'function') loadMasterDataUI();
    }
  }

  // Wire main tabs click (ข้อมูลบริษัท vs บริการส่งอีเมล vs สิทธิ์)
  const mainTabBtns = document.querySelectorAll('.company-main-tab');
  mainTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchCompanyMainTab(btn.dataset.companyTab);
    });
  });

  window.openCompanySettingsModal = function(initialTab = 'info') {
    if (!can('manage_settings') && !can('manage_roles')) {
      showToast('⚠️ คุณไม่มีสิทธิ์เข้าถึงการตั้งค่าระบบ (ต้องใช้สิทธิ์ Admin)');
      return;
    }
    populateModal();
    switchCompanyMainTab(initialTab);
    modal.showModal();
  };

  if (btnOpen) {
    btnOpen.addEventListener('click', () => {
      window.openCompanySettingsModal('info');
    });
  }

  const btnBack = document.getElementById('btnBackCompanySettings');
  const btnHeaderSave = document.getElementById('btnHeaderSaveCompanySettings');
  const closeModal = (e) => smoothCloseDialog(modal, e?.currentTarget);
  if (btnClose) btnClose.addEventListener('click', closeModal);
  if (btnCancel) btnCancel.addEventListener('click', closeModal);
  if (btnBack) btnBack.addEventListener('click', closeModal);
  if (btnHeaderSave) {
    btnHeaderSave.addEventListener('click', () => {
      btnSave?.click();
    });
  }

  // Email Provider Tab switching
  const providerTabs = document.querySelectorAll('.provider-tab');
  providerTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchEmailProviderTab(tab.dataset.provider);
    });
  });

  // Password / Key Toggle for API Key
  const btnToggleApiKey = document.getElementById('btnToggleApiKey');
  const inputApiKey = document.getElementById('settingEmailApiKey');
  if (btnToggleApiKey && inputApiKey) {
    btnToggleApiKey.addEventListener('click', () => {
      const isPwd = inputApiKey.type === 'password';
      inputApiKey.type = isPwd ? 'text' : 'password';
      btnToggleApiKey.textContent = isPwd ? '🙈' : '👁️';
    });
  }

  // Auto-detect provider prefix when pasting/typing API key
  if (inputApiKey) {
    inputApiKey.addEventListener('input', e => {
      const val = e.target.value.trim();
      if (val.startsWith('SG.') && document.getElementById('settingEmailProvider')?.value !== 'sendgrid') {
        switchEmailProviderTab('sendgrid');
      } else if (val.startsWith('re_') && document.getElementById('settingEmailProvider')?.value !== 'resend') {
        switchEmailProviderTab('resend');
      }
    });
  }

  // Test Email API Key
  const btnTestApiKey = document.getElementById('btnTestEmailApiKey');
  const btnTestApiKeyText = document.getElementById('btnTestApiKeyText');
  const apiStatusBox = document.getElementById('apiTestStatusBox');
  if (btnTestApiKey) {
    btnTestApiKey.addEventListener('click', async () => {
      const provider = document.getElementById('settingEmailProvider')?.value || 'resend';
      const apiKey = (document.getElementById('settingEmailApiKey')?.value || '').trim();
      if (!apiKey) {
        showToast('⚠️ กรุณากรอก API Key ก่อนทดสอบ');
        document.getElementById('settingEmailApiKey')?.focus();
        return;
      }
      try {
        btnTestApiKey.disabled = true;
        if (btnTestApiKeyText) btnTestApiKeyText.textContent = '⏳ กำลังทดสอบ API Key...';
        if (apiStatusBox) {
          apiStatusBox.className = 'smtp-status-box loading';
          apiStatusBox.textContent = `กำลังเชื่อมต่อและตรวจสอบคีย์กับ ${provider === 'sendgrid' ? 'SendGrid' : 'Resend'} API...`;
          apiStatusBox.classList.remove('hidden');
        }

        const res = await fetch('/api/email/test-api-key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, apiKey })
        });
        const data = await res.json();
        if (data.success) {
          // Immediately cache and persist the verified key
          localStorage.setItem('activeasset_cached_email_api_key', apiKey);
          localStorage.setItem('activeasset_cached_email_provider', provider);

          fetch('/api/company-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email_api_key: apiKey, email_provider: provider })
          }).then(r => r.json()).then(saved => {
            if (saved.success && saved.settings) state.companySettings = saved.settings;
          }).catch(() => {});

          if (apiStatusBox) {
            apiStatusBox.className = 'smtp-status-box success';
            apiStatusBox.textContent = `✅ ${data.message || 'API Key ถูกต้อง พร้อมใช้งาน (บันทึกเข้าระบบเรียบร้อยแล้ว)!'}`;
          }
          showToast(`✅ ${data.message || 'API Key ถูกต้อง (บันทึกเรียบร้อย)'}`);
        } else {
          if (apiStatusBox) {
            apiStatusBox.className = 'smtp-status-box error';
            apiStatusBox.textContent = `❌ ${data.error || 'API Key ไม่ถูกต้อง'}`;
          }
          showToast(`❌ ${data.error || 'API Key ไม่ถูกต้อง'}`);
        }
      } catch (err) {
        if (apiStatusBox) {
          apiStatusBox.className = 'smtp-status-box error';
          apiStatusBox.textContent = `❌ เกิดข้อผิดพลาด: ${err.message}`;
        }
        showToast(`❌ ${err.message}`);
      } finally {
        btnTestApiKey.disabled = false;
        if (btnTestApiKeyText) btnTestApiKeyText.textContent = '⚡ ทดสอบ API Key';
      }
    });
  }

  // Password Toggle for SMTP
  const btnToggleSmtpPass = document.getElementById('btnToggleSmtpPass');
  const inputSmtpPass = document.getElementById('settingSmtpPass');
  if (btnToggleSmtpPass && inputSmtpPass) {
    btnToggleSmtpPass.addEventListener('click', () => {
      const isPwd = inputSmtpPass.type === 'password';
      inputSmtpPass.type = isPwd ? 'text' : 'password';
      btnToggleSmtpPass.textContent = isPwd ? '🙈' : '👁️';
    });
  }

  // Test SMTP Connection
  const btnTestSmtp = document.getElementById('btnTestSmtpConnection');
  const btnTestSmtpText = document.getElementById('btnTestSmtpText');
  const smtpStatusBox = document.getElementById('smtpTestStatusBox');
  if (btnTestSmtp) {
    btnTestSmtp.addEventListener('click', async () => {
      const user = (document.getElementById('settingSmtpUser')?.value || '').trim();
      const pass = (document.getElementById('settingSmtpPass')?.value || '').trim();
      if (!user || !pass) {
        showToast('⚠️ กรุณากรอกบัญชี Gmail และ Google App Password');
        document.getElementById('settingSmtpUser')?.focus();
        return;
      }
      try {
        btnTestSmtp.disabled = true;
        if (btnTestSmtpText) btnTestSmtpText.textContent = '⏳ กำลังทดสอบ...';
        if (smtpStatusBox) {
          smtpStatusBox.className = 'smtp-status-box loading';
          smtpStatusBox.textContent = 'กำลังเชื่อมต่อ smtp.gmail.com:465 และยืนยันตัวตน...';
          smtpStatusBox.classList.remove('hidden');
        }

        const res = await fetch('/api/smtp/test', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user, pass })
        });
        const data = await res.json();
        if (data.success) {
          if (smtpStatusBox) {
            smtpStatusBox.className = 'smtp-status-box success';
            smtpStatusBox.textContent = '✅ เชื่อมต่อและยืนยันตัวตนกับ Gmail สำเร็จ พร้อมส่งอีเมล!';
          }
          showToast('✅ เชื่อมต่อ Gmail สำเร็จ');
        } else {
          if (smtpStatusBox) {
            smtpStatusBox.className = 'smtp-status-box error';
            smtpStatusBox.textContent = `❌ ${data.error || 'เชื่อมต่อไม่สำเร็จ'}`;
          }
          showToast(`❌ ${data.error || 'เชื่อมต่อไม่สำเร็จ'}`);
        }
      } catch (err) {
        if (smtpStatusBox) {
          smtpStatusBox.className = 'smtp-status-box error';
          smtpStatusBox.textContent = `❌ เกิดข้อผิดพลาด: ${err.message}`;
        }
        showToast(`❌ ${err.message}`);
      } finally {
        btnTestSmtp.disabled = false;
        if (btnTestSmtpText) btnTestSmtpText.textContent = '⚡ ทดสอบเชื่อมต่อ Gmail';
      }
    });
  }

  // Logo file selection
  const btnChooseLogo = document.getElementById('btnChooseCompanyLogo');
  const fileInput = document.getElementById('companyLogoFileInput');
  const btnRemoveLogo = document.getElementById('btnRemoveCompanyLogo');

  if (btnChooseLogo && fileInput) {
    btnChooseLogo.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('⚠️ กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, SVG, WEBP)');
        return;
      }
      const reader = new FileReader();
      reader.onload = async evt => {
        const dataUrl = evt.target.result;
        try {
          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              data: dataUrl,
              size: file.size,
              type: file.type
            })
          });
          const uploadData = await uploadRes.json();
          if (uploadData.success && uploadData.url) {
            updateLogoPreview(uploadData.url);
          } else {
            updateLogoPreview(dataUrl);
          }
        } catch (_) {
          updateLogoPreview(dataUrl);
        }
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnRemoveLogo) {
    btnRemoveLogo.addEventListener('click', () => {
      if (fileInput) fileInput.value = '';
      updateLogoPreview('');
    });
  }

  // Dispatcher Default Signature controls
  const btnDrawDispatcherSig = document.getElementById('btnDrawCompanyDispatcherSig');
  const btnUploadDispatcherSig = document.getElementById('btnUploadCompanyDispatcherSig');
  const dispatcherSigFileInput = document.getElementById('companyDispatcherSigFileInput');
  const btnRemoveDispatcherSig = document.getElementById('btnRemoveCompanyDispatcherSig');

  if (btnDrawDispatcherSig) {
    btnDrawDispatcherSig.addEventListener('click', () => {
      openDigitalSigModalForRole('dispatcher_setting');
    });
  }

  if (btnUploadDispatcherSig && dispatcherSigFileInput) {
    btnUploadDispatcherSig.addEventListener('click', () => dispatcherSigFileInput.click());
    dispatcherSigFileInput.addEventListener('change', async e => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        showToast('⚠️ กรุณาเลือกไฟล์รูปภาพ (PNG, JPG, WEBP)');
        return;
      }
      try {
        const dataUrl = await compressImageFile(file, 800, 0.9);
        const uploadRes = await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: file.name,
            data: dataUrl,
            size: file.size,
            type: file.type
          })
        });
        const uploadData = await uploadRes.json();
        const savedUrl = (uploadData.success && uploadData.url) ? uploadData.url : dataUrl;

        // Persist immediately to company_settings
        const setRes = await fetch('/api/company-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dispatcher_signature: savedUrl })
        });
        const setData = await setRes.json();
        if (setData.success && setData.settings) {
          state.companySettings = setData.settings;
        } else {
          state.companySettings = { ...state.companySettings, dispatcher_signature: savedUrl };
        }
        updateDispatcherSigPreview(savedUrl);
        renderGatePassHtml();
        showToast('✅ อัปโหลดและบันทึกลายเซ็นผู้จ่ายเครื่องเรียบร้อย');
      } catch (err) {
        showToast('❌ อัปโหลดรูปภาพไม่สำเร็จ: ' + err.message);
      }
    });
  }

  if (btnRemoveDispatcherSig) {
    btnRemoveDispatcherSig.addEventListener('click', async () => {
      if (dispatcherSigFileInput) dispatcherSigFileInput.value = '';
      updateDispatcherSigPreview('');
      try {
        const setRes = await fetch('/api/company-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dispatcher_signature: '' })
        });
        const setData = await setRes.json();
        if (setData.success && setData.settings) {
          state.companySettings = setData.settings;
        } else {
          state.companySettings = { ...state.companySettings, dispatcher_signature: '' };
        }
        renderGatePassHtml();
        showToast('ลบลายเซ็นผู้จ่ายเครื่องเรียบร้อย');
      } catch (err) {
        showToast('❌ ลบลายเซ็นไม่สำเร็จ: ' + err.message);
      }
    });
  }

  if (btnSave) {
    btnSave.addEventListener('click', async () => {
      const getVal = id => {
        const el = document.getElementById(id);
        return el ? el.value.trim() : '';
      };
      const name = getVal('settingCompanyName');
      if (!name) {
        showToast('⚠️ กรุณาระบุชื่อบริษัท');
        document.getElementById('settingCompanyName')?.focus();
        return;
      }

      const payload = {
        company_name: name,
        company_name_en: getVal('settingCompanyNameEn'),
        company_tax_id: getVal('settingCompanyTaxId'),
        company_branch: getVal('settingCompanyBranch'),
        company_address: getVal('settingCompanyAddress'),
        company_phone: getVal('settingCompanyPhone'),
        company_email: getVal('settingCompanyEmail'),
        company_website: getVal('settingCompanyWebsite'),
        gatepass_terms: getVal('settingGatepassTerms'),
        email_provider: getVal('settingEmailProvider') || 'resend',
        email_api_key: getVal('settingEmailApiKey'),
        email_from_address: getVal('settingEmailFromAddress') || 'a5@active5.co.th',
        email_from_name: getVal('settingEmailFromName') || name,
        smtp_user: getVal('settingSmtpUser'),
        smtp_pass: getVal('settingSmtpPass'),
        smtp_from_name: getVal('settingSmtpFromName'),
        company_logo: document.getElementById('companyLogoUrlVal')?.value || '',
        dispatcher_signature: document.getElementById('companyDispatcherSigUrlVal')?.value || '',
        auth_require_login: document.getElementById('settingAuthRequireLogin')?.checked ? '1' : '0',
        auth_allowed_domains: getVal('settingAuthAllowedDomains') || 'active5.co.th',
        auth_google_client_id: getVal('settingAuthGoogleClientId')
      };

      try {
        btnSave.disabled = true;
        btnSave.textContent = 'กำลังบันทึก...';
        const res = await fetch('/api/company-settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.settings) {
          state.companySettings = data.settings;
          if (payload.email_api_key) {
            localStorage.setItem('activeasset_cached_email_api_key', payload.email_api_key);
          }
          modal.close();
          renderGatePassHtml();
          showToast('บันทึกข้อมูลเรียบร้อยแล้ว');
        } else {
          throw new Error(data.error || 'บันทึกไม่สำเร็จ');
        }
      } catch (err) {
        showToast(err.message);
      } finally {
        btnSave.disabled = false;
        btnSave.textContent = 'บันทึก';
      }
    });
  }

  // -------------------------------------------------------------
  // Roles & Permissions Management (Tab 4: Column Matrix Layout)
  // -------------------------------------------------------------
  let cachedRoles = [];
  let cachedUsers = [];
  let cachedPermissionKeys = [];
  let isAddingInlineRole = false;
  let inlineRoleDraftName = '';
  let inlineRoleDraftPermissions = {};
  let inlineEditingRoleId = null;
  let inlineEditingRoleName = '';

  async function loadRolesAndUsersUI(opts = {}) {
    const isSilent = opts && opts.silent === true;
    const preserveUsers = opts && opts.preserveUsersList === true;
    const matrixWrap = document.getElementById('rolesMatrixWrap');
    const usersList = document.getElementById('usersRolesList');

    try {
      // Only show placeholder if not silent and container is empty to prevent page flickering
      if (!isSilent) {
        if (matrixWrap && !matrixWrap.children.length) {
          matrixWrap.innerHTML = '<div style="padding:24px; text-align:center; color:#64748b;">กำลังโหลดตารางสิทธิ์แนวคอลัมน์...</div>';
        }
        if (usersList && !usersList.children.length) {
          usersList.innerHTML = '<div style="padding:14px; color:#64748b;">กำลังโหลดรายชื่อผู้ใช้...</div>';
        }
      }

      const [rolesRes, usersRes] = await Promise.all([
        fetch('/api/roles'),
        fetch('/api/users')
      ]);

      if (!rolesRes.ok || !usersRes.ok) throw new Error('โหลดข้อมูลสิทธิ์ไม่สำเร็จ');

      const rolesData = await rolesRes.json();
      const usersData = await usersRes.json();

      cachedRoles = rolesData.roles || [];
      cachedPermissionKeys = rolesData.permissionKeys || [];
      cachedUsers = usersData.users || [];

      renderRolesColumnMatrix(cachedRoles, cachedPermissionKeys);
      if (!preserveUsers) {
        renderUsersRolesList(cachedUsers, cachedRoles);
      }
    } catch (err) {
      if (matrixWrap && !matrixWrap.children.length) matrixWrap.innerHTML = `<div style="color:#ef4444; padding:16px;">❌ ${escapeHtml(err.message)}</div>`;
      if (usersList && !usersList.children.length) usersList.innerHTML = `<div style="color:#ef4444; padding:16px;">❌ ${escapeHtml(err.message)}</div>`;
    }
  }

  function renderRolesColumnMatrix(roles, permKeys) {
    const container = document.getElementById('rolesMatrixWrap');
    if (!container) return;

    if (!roles || roles.length === 0) {
      container.innerHTML = '<div style="padding:24px; text-align:center; color:#64748b;">ยังไม่มีบทบาทในระบบ</div>';
      return;
    }

    // Group permission keys by group
    const groupsMap = new Map();
    permKeys.forEach(p => {
      const g = p.group || 'ทั่วไป';
      if (!groupsMap.has(g)) groupsMap.set(g, []);
      groupsMap.get(g).push(p);
    });

    // 1. Role Headers (Ultra-Minimal + In-line Rename)
    let thRolesHtml = roles.map(r => {
      const isSystem = r.is_system;
      const isSystemAdmin = r.id === 'admin';
      const roleIcon = isSystemAdmin ? '👑' : (r.id === 'user' ? '👤' : '🛠️');

      if (inlineEditingRoleId === r.id) {
        return `
          <th class="col-role-header" data-role-id="${escapeHtml(r.id)}">
            <div class="role-inline-rename-card">
              <input type="text" class="input-inline-rename" id="inputRenameRole_${escapeHtml(r.id)}" value="${escapeHtml(inlineEditingRoleName || r.name)}" autocomplete="off" maxlength="50" />
              <div class="inline-role-actions-group">
                <button type="button" class="btn-inline-action save" data-confirm-rename="${escapeHtml(r.id)}" title="บันทึกชื่อ (Enter)">✓</button>
                <button type="button" class="btn-inline-action cancel" data-cancel-rename="${escapeHtml(r.id)}" title="ยกเลิก (Esc)">✕</button>
              </div>
            </div>
          </th>
        `;
      }

      return `
        <th class="col-role-header" data-role-id="${escapeHtml(r.id)}">
          <div class="role-col-minimal-card" title="${escapeHtml(r.description || r.name)}">
            <div class="role-col-top-row">
              <div class="role-col-identity">
                <span class="role-col-icon">${roleIcon}</span>
                <span class="role-col-name">${escapeHtml(r.name)}</span>
                <span class="role-col-user-count" title="${r.user_count || 0} คนใช้งาน">👤 ${r.user_count || 0}</span>
              </div>
              ${!isSystem ? `
                <div class="role-col-ghost-actions">
                  <button type="button" class="btn-role-ghost-action" data-edit-role="${escapeHtml(r.id)}" title="แก้ไขชื่อบทบาท">✏️</button>
                  <button type="button" class="btn-role-ghost-action danger" data-delete-role="${escapeHtml(r.id)}" title="ลบบทบาทนี้">🗑️</button>
                </div>
              ` : ''}
            </div>
            <div class="role-col-bot-row">
              ${!isSystemAdmin ? `
                <div class="role-col-toggles-minimal">
                  <button type="button" class="btn-role-toggle-text" data-col-quick="all" data-role-id="${escapeHtml(r.id)}">เปิดหมด</button>
                  <span class="role-toggle-sep">·</span>
                  <button type="button" class="btn-role-toggle-text" data-col-quick="none" data-role-id="${escapeHtml(r.id)}">ปิดหมด</button>
                </div>
              ` : `
                <span class="role-col-full-perm-minimal">สิทธิ์เต็มระบบ</span>
              `}
            </div>
          </div>
        </th>
      `;
    }).join('');

    // 2. Add Role Column Header (In-line Mode vs Button)
    const thAddRole = isAddingInlineRole ? `
      <th class="col-add-role-header active-inline-add">
        <div class="inline-role-add-card" id="inlineRoleAddBox">
          <div class="inline-role-input-line">
            <span class="inline-role-lead-icon">🛠️</span>
            <input 
              type="text" 
              id="inputInlineRoleName" 
              class="input-inline-new-role" 
              placeholder="ชื่อบทบาทใหม่..." 
              value="${escapeHtml(inlineRoleDraftName)}" 
              autocomplete="off" 
              maxlength="50" 
            />
            <div class="inline-role-actions-group">
              <button type="button" class="btn-inline-action save" id="btnSaveInlineRole" title="สร้างบทบาท (Enter)">✓</button>
              <button type="button" class="btn-inline-action cancel" id="btnCancelInlineRole" title="ยกเลิก (Esc)">✕</button>
            </div>
          </div>
          <div class="inline-role-bottom-line">
            <div class="inline-role-toggles">
              <button type="button" class="btn-role-toggle-text" id="btnDraftPermAll" title="เปิดทุกสิทธิ์">เปิดหมด</button>
              <span class="role-toggle-sep">·</span>
              <button type="button" class="btn-role-toggle-text" id="btnDraftPermNone" title="ปิดทุกสิทธิ์">ปิดหมด</button>
            </div>
            <span class="inline-role-hint-text">Enter บันทึก</span>
          </div>
        </div>
      </th>
    ` : `
      <th class="col-add-role-header">
        <button type="button" class="btn-add-role-minimal" id="btnColumnAddRole" title="สร้างบทบาทใหม่ในตาราง">
          <span class="btn-add-role-icon">➕</span>
          <span>สร้างบทบาทใหม่</span>
        </button>
      </th>
    `;

    // 3. Build Table Body
    let tbodyHtml = '';
    for (const [groupName, pList] of groupsMap.entries()) {
      tbodyHtml += `
        <tr class="row-perm-group">
          <td colspan="${roles.length + 2}">
            <span>${escapeHtml(groupName)}</span>
            <span style="font-size:11.5px; font-weight:500; color:#64748b; margin-left:6px;">(${pList.length} สิทธิ์)</span>
          </td>
        </tr>
      `;

      pList.forEach(p => {
        let cellsHtml = roles.map(r => {
          const isChecked = Boolean(r.permissions && r.permissions[p.key]);
          const isLockedAdmin = (r.id === 'admin' && (p.key === 'manage_settings' || p.key === 'manage_roles'));

          return `
            <td class="col-role-cell">
              <label class="switch-toggle-wrap" title="${isLockedAdmin ? 'Admin ต้องมีสิทธิ์นี้เสมอ' : (isChecked ? 'คลิกเพื่อปิดสิทธิ์' : 'คลิกเพื่อเปิดสิทธิ์')}">
                <input type="checkbox"
                  class="matrix-perm-switch"
                  data-role-id="${escapeHtml(r.id)}"
                  data-perm-key="${escapeHtml(p.key)}"
                  ${isChecked ? 'checked' : ''}
                  ${isLockedAdmin ? 'disabled' : ''}
                />
                <span class="switch-slider"></span>
              </label>
            </td>
          `;
        }).join('');

        const rightCellHtml = isAddingInlineRole ? `
          <td class="col-role-cell col-add-role-cell active-draft">
            <label class="switch-toggle-wrap" title="คลิกเพื่อเปิด/ปิดสิทธิ์สำหรับบทบาทใหม่">
              <input type="checkbox"
                class="matrix-perm-switch-draft"
                data-perm-key="${escapeHtml(p.key)}"
                ${inlineRoleDraftPermissions[p.key] ? 'checked' : ''}
              />
              <span class="switch-slider"></span>
            </label>
          </td>
        ` : `
          <td class="col-add-role-cell empty-col"></td>
        `;

        tbodyHtml += `
          <tr class="row-perm-item">
            <td class="col-feature-sticky">
              <div class="perm-cell-info">
                <div class="perm-cell-title">${escapeHtml(p.label)}</div>
                <div class="perm-cell-desc">${escapeHtml(p.desc || '')}</div>
              </div>
            </td>
            ${cellsHtml}
            ${rightCellHtml}
          </tr>
        `;
      });
    }

    container.innerHTML = `
      <div class="roles-matrix-table-container">
        <table class="roles-matrix-table">
          <thead>
            <tr>
              <th class="col-feature-sticky">
                <div class="feature-head-minimal">
                  <span class="feature-head-title">สิทธิ์การใช้งาน</span>
                  <span class="feature-head-count">${permKeys.length}</span>
                </div>
              </th>
              ${thRolesHtml}
              ${thAddRole}
            </tr>
          </thead>
          <tbody>
            ${tbodyHtml}
          </tbody>
        </table>
      </div>
    `;

    // 4. Wire Matrix Switches for Existing Roles
    container.querySelectorAll('.matrix-perm-switch').forEach(sw => {
      sw.addEventListener('change', async (e) => {
        const roleId = e.target.dataset.roleId;
        const permKey = e.target.dataset.permKey;
        const isChecked = e.target.checked;
        await updateSingleRolePermission(roleId, permKey, isChecked);
      });
    });

    // Wire Quick Toggles (All / None) for Existing Roles
    container.querySelectorAll('[data-col-quick]').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const roleId = e.currentTarget.dataset.roleId;
        const action = e.currentTarget.dataset.colQuick;
        await setAllPermissionsForRole(roleId, action === 'all');
      });
    });

    // Wire Delete Role
    container.querySelectorAll('[data-delete-role]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const roleId = e.currentTarget.dataset.deleteRole;
        deleteCustomRole(roleId);
      });
    });

    // Wire In-line Rename Role (✏️)
    container.querySelectorAll('[data-edit-role]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const roleId = e.currentTarget.dataset.editRole;
        const role = cachedRoles.find(r => r.id === roleId);
        if (!role) return;
        inlineEditingRoleId = roleId;
        inlineEditingRoleName = role.name;
        renderRolesColumnMatrix(cachedRoles, cachedPermissionKeys);
        const inp = document.getElementById('inputRenameRole_' + roleId);
        if (inp) {
          inp.focus();
          inp.select();
        }
      });
    });

    // Wire In-line Rename Confirm/Cancel
    container.querySelectorAll('[data-confirm-rename]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const roleId = e.currentTarget.dataset.confirmRename;
        commitRenameRole(roleId);
      });
    });

    container.querySelectorAll('[data-cancel-rename]').forEach(btn => {
      btn.addEventListener('click', () => {
        cancelRenameRole();
      });
    });

    if (inlineEditingRoleId) {
      const inpRename = document.getElementById('inputRenameRole_' + inlineEditingRoleId);
      if (inpRename) {
        inpRename.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitRenameRole(inlineEditingRoleId);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelRenameRole();
          }
        });
      }
    }

    // 5. Wire In-line Add Role Trigger and Card Controls
    if (!isAddingInlineRole) {
      const btnAddCol = container.querySelector('#btnColumnAddRole');
      if (btnAddCol) {
        btnAddCol.addEventListener('click', () => {
          isAddingInlineRole = true;
          inlineRoleDraftName = '';
          inlineRoleDraftPermissions = {};
          // Default: give standard user permissions (everything except system settings & security)
          cachedPermissionKeys.forEach(p => {
            inlineRoleDraftPermissions[p.key] = (p.group !== 'การตั้งค่าระบบ' && p.group !== 'ความปลอดภัย');
          });
          renderRolesColumnMatrix(cachedRoles, cachedPermissionKeys);
          setTimeout(() => {
            const wrap = document.getElementById('rolesMatrixWrap');
            if (wrap) {
              wrap.scrollTo({ left: wrap.scrollWidth, behavior: 'smooth' });
            }
            const inp = document.getElementById('inputInlineRoleName');
            if (inp) {
              inp.focus();
            }
          }, 60);
        });
      }
    } else {
      const inpName = document.getElementById('inputInlineRoleName');
      if (inpName) {
        inpName.addEventListener('input', (e) => {
          inlineRoleDraftName = e.target.value;
        });
        inpName.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            commitCreateInlineRole();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            cancelCreateInlineRole();
          }
        });
      }

      const btnSave = document.getElementById('btnSaveInlineRole');
      if (btnSave) {
        btnSave.addEventListener('click', () => commitCreateInlineRole());
      }

      const btnCancel = document.getElementById('btnCancelInlineRole');
      if (btnCancel) {
        btnCancel.addEventListener('click', () => cancelCreateInlineRole());
      }

      const btnDraftAll = document.getElementById('btnDraftPermAll');
      if (btnDraftAll) {
        btnDraftAll.addEventListener('click', () => {
          cachedPermissionKeys.forEach(p => inlineRoleDraftPermissions[p.key] = true);
          container.querySelectorAll('.matrix-perm-switch-draft').forEach(cb => cb.checked = true);
        });
      }

      const btnDraftNone = document.getElementById('btnDraftPermNone');
      if (btnDraftNone) {
        btnDraftNone.addEventListener('click', () => {
          cachedPermissionKeys.forEach(p => inlineRoleDraftPermissions[p.key] = false);
          container.querySelectorAll('.matrix-perm-switch-draft').forEach(cb => cb.checked = false);
        });
      }

      // Wire draft switches in body
      container.querySelectorAll('.matrix-perm-switch-draft').forEach(cb => {
        cb.addEventListener('change', (e) => {
          const permKey = e.target.dataset.permKey;
          inlineRoleDraftPermissions[permKey] = e.target.checked;
        });
      });
    }
  }

  async function commitCreateInlineRole() {
    const inp = document.getElementById('inputInlineRoleName');
    const name = (inp ? inp.value : inlineRoleDraftName).trim();
    if (!name) {
      showToast('⚠️ กรุณากรอกชื่อบทบาทใหม่');
      inp?.focus();
      return;
    }

    const id = 'role-' + Date.now();
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id,
          name,
          description: '',
          is_system: false,
          permissions: inlineRoleDraftPermissions
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'สร้างบทบาทไม่สำเร็จ');

      isAddingInlineRole = false;
      inlineRoleDraftName = '';
      inlineRoleDraftPermissions = {};
      cachedRoles = data.roles || [];
      renderRolesColumnMatrix(cachedRoles, cachedPermissionKeys);
      setTimeout(() => {
        const wrap = document.getElementById('rolesMatrixWrap');
        if (wrap) {
          wrap.scrollTo({ left: wrap.scrollWidth, behavior: 'smooth' });
        }
      }, 60);
      showToast(`✓ สร้างบทบาท "${name}" เรียบร้อยแล้ว`);
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  }

  function cancelCreateInlineRole() {
    isAddingInlineRole = false;
    inlineRoleDraftName = '';
    inlineRoleDraftPermissions = {};
    renderRolesColumnMatrix(cachedRoles, cachedPermissionKeys);
  }

  async function commitRenameRole(roleId) {
    const inp = document.getElementById('inputRenameRole_' + roleId);
    const newName = (inp ? inp.value : '').trim();
    if (!newName) {
      showToast('⚠️ ชื่อบทบาทต้องไม่เว้นว่าง');
      inp?.focus();
      return;
    }

    const role = cachedRoles.find(r => r.id === roleId);
    if (!role) return;

    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: role.id,
          name: newName,
          description: role.description || '',
          permissions: role.permissions || {}
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เปลี่ยนชื่อบทบาทไม่สำเร็จ');

      inlineEditingRoleId = null;
      inlineEditingRoleName = '';
      cachedRoles = data.roles || [];
      renderRolesColumnMatrix(cachedRoles, cachedPermissionKeys);
      showToast(`✓ เปลี่ยนชื่อเป็น "${newName}" เรียบร้อยแล้ว`);
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  }

  function cancelRenameRole() {
    inlineEditingRoleId = null;
    inlineEditingRoleName = '';
    renderRolesColumnMatrix(cachedRoles, cachedPermissionKeys);
  }

  async function updateSingleRolePermission(roleId, permKey, isEnabled) {
    const role = cachedRoles.find(r => r.id === roleId);
    if (!role) return;

    if (!role.permissions) role.permissions = {};
    role.permissions[permKey] = isEnabled;

    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: role.id,
          name: role.name,
          description: role.description,
          permissions: role.permissions
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'อัปเดตสิทธิ์ไม่สำเร็จ');

      cachedRoles = data.roles || [];
      showToast(`✓ อัปเดตสิทธิ์ "${role.name}" เรียบร้อยแล้ว`);

      // Update current user live if matching
      if (state.currentUser && (state.currentUser.role_id === role.id || state.currentUser.role === role.id)) {
        state.currentUser.permissions = role.permissions;
        localStorage.setItem('activeasset_current_user', JSON.stringify(state.currentUser));
        applyPermissionsToUI();
        renderActiveView();
      }
    } catch (err) {
      showToast(`❌ ${err.message}`);
      await loadRolesAndUsersUI();
    }
  }

  async function setAllPermissionsForRole(roleId, enableAll) {
    const role = cachedRoles.find(r => r.id === roleId);
    if (!role) return;

    const newPerms = {};
    cachedPermissionKeys.forEach(p => {
      if (role.id === 'admin' && (p.key === 'manage_settings' || p.key === 'manage_roles')) {
        newPerms[p.key] = true;
      } else {
        newPerms[p.key] = enableAll;
      }
    });

    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: role.id,
          name: role.name,
          description: role.description,
          permissions: newPerms
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกสิทธิ์ไม่สำเร็จ');

      cachedRoles = data.roles || [];
      renderRolesColumnMatrix(cachedRoles, cachedPermissionKeys);
      showToast(`✓ ปรับสิทธิ์ "${role.name}" เป็น ${enableAll ? 'เปิดทั้งหมด' : 'ปิดทั้งหมด'} สำเร็จ`);

      if (state.currentUser && (state.currentUser.role_id === role.id || state.currentUser.role === role.id)) {
        state.currentUser.permissions = newPerms;
        localStorage.setItem('activeasset_current_user', JSON.stringify(state.currentUser));
        applyPermissionsToUI();
        renderActiveView();
      }
    } catch (err) {
      showToast(`❌ ${err.message}`);
      await loadRolesAndUsersUI();
    }
  }

  let activeUserRoleTargetEmail = null;

  function openUserRoleSelectDropdown(email, triggerBtn) {
    const dropdown = document.getElementById('userRoleSelectDropdown');
    if (!dropdown || !triggerBtn) return;

    activeUserRoleTargetEmail = email;
    const user = cachedUsers.find(u => u.email === email);
    const currentRoleId = user?.role_id || 'user';

    document.querySelectorAll('.btn-user-role-dropdown-trigger').forEach(b => b.classList.remove('is-open'));
    triggerBtn.classList.add('is-open');

    const headerHtml = `
      <div class="model-dropdown-header">
        <span>เลือกบทบาท (${cachedRoles.length})</span>
        <button type="button" class="btn-close-dropdown" id="btnCloseUserRoleSelectDd" title="ปิด">✕</button>
      </div>
    `;

    const itemsHtml = cachedRoles.map(r => {
      const isSelected = r.id === currentRoleId;
      const roleIcon = r.id === 'admin' ? '👑' : (r.id === 'user' ? '👤' : '🛠️');
      const badgeText = r.is_system ? 'มาตรฐาน' : 'กำหนดเอง';
      return `
        <div class="model-dropdown-item ${isSelected ? 'is-selected' : ''}" data-select-user-role="${escapeHtml(r.id)}">
          <div class="model-item-main">
            <span class="model-item-name">${roleIcon} ${escapeHtml(r.name)}</span>
            <span class="model-item-sub">${escapeHtml(r.description || 'กำหนดสิทธิ์การใช้งาน')}</span>
          </div>
          <div class="model-item-end">
            <span class="model-count-box"><span class="count-num">${badgeText}</span></span>
            ${isSelected ? '<span class="model-item-check">✓</span>' : ''}
          </div>
        </div>
      `;
    }).join('');

    dropdown.innerHTML = `
      ${headerHtml}
      <div class="dropdown-scroll-list">
        ${itemsHtml}
      </div>
    `;

    positionRoleDropdown(dropdown, triggerBtn);
  }

  function positionRoleDropdown(dropdown, triggerBtn) {
    if (!dropdown || !triggerBtn) return;
    const btnRect = triggerBtn.getBoundingClientRect();
    const dialog = dropdown.closest('dialog');
    const dialogRect = dialog ? dialog.getBoundingClientRect() : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight, width: window.innerWidth };

    const isMobile = window.innerWidth <= 640;
    const width = isMobile ? Math.min(300, window.innerWidth - 24) : 280;
    dropdown.style.width = `${width}px`;

    const relRight = btnRect.right - dialogRect.left;
    const targetLeft = Math.max(10, Math.min(relRight - width, dialogRect.width - width - 12));
    dropdown.style.left = `${targetLeft}px`;

    const relTop = btnRect.bottom - dialogRect.top + 6;
    const spaceBelow = window.innerHeight - btnRect.bottom - 20;
    const spaceAbove = btnRect.top - 20;

    if (spaceBelow < 180 && spaceAbove > spaceBelow) {
      dropdown.style.maxHeight = `${Math.max(140, Math.min(260, Math.floor(spaceAbove)))}px`;
      dropdown.style.bottom = `${dialogRect.bottom - btnRect.top + 6}px`;
      dropdown.style.top = 'auto';
    } else {
      dropdown.style.maxHeight = `${Math.max(160, Math.min(280, Math.floor(spaceBelow)))}px`;
      dropdown.style.top = `${relTop}px`;
      dropdown.style.bottom = 'auto';
    }

    dropdown.classList.remove('hidden');
  }

  function renderUsersRolesList(users, roles) {
    const container = document.getElementById('usersRolesList');
    if (!container) return;

    const countBadge = document.getElementById('countUsersRolesBadge');
    if (countBadge) countBadge.textContent = String(users.length || 0);

    const searchInput = document.getElementById('inputSearchUserRoles');
    const query = (searchInput?.value || '').trim().toLowerCase();

    const filtered = query
      ? users.filter(u => (u.name || '').toLowerCase().includes(query) || (u.email || '').toLowerCase().includes(query))
      : users;

    if (filtered.length === 0) {
      container.innerHTML = `<div style="padding:24px; text-align:center; color:#64748b;">${query ? 'ไม่พบพนักงานที่ตรงกับคำค้นหา' : 'ไม่พบผู้ใช้งานในระบบ'}</div>`;
      return;
    }

    container.innerHTML = filtered.map(u => {
      const initial = (u.name || u.email || 'U').charAt(0);
      const currentRole = roles.find(r => r.id === u.role_id) || roles.find(r => r.id === 'user') || { id: u.role_id || 'user', name: u.role_id || 'ผู้ใช้งาน' };
      const roleIcon = currentRole.id === 'admin' ? '👑' : (currentRole.id === 'user' ? '👤' : '🛠️');
      const isDisabled = u.status === 'disabled';
      const isSelf = state.currentUser && state.currentUser.email === u.email;

      return `
        <div class="user-role-row ${isDisabled ? 'is-disabled' : ''}" data-user-email="${escapeHtml(u.email)}">
          <div class="user-role-info">
            <div class="user-row-avatar ${isDisabled ? 'is-disabled' : ''}">${escapeHtml(initial)}</div>
            <div class="user-row-names">
              <div class="user-row-fullname">
                ${escapeHtml(u.name || '-')}
                ${isDisabled ? '<span class="user-status-pill is-disabled">ระงับการใช้งาน</span>' : ''}
                ${isSelf ? '<span class="user-self-pill">คุณ</span>' : ''}
              </div>
              <div class="user-row-email">${escapeHtml(u.email)}</div>
            </div>
          </div>

          <div class="user-row-actions">
            <div class="user-role-selector-wrap">
              <button type="button" 
                class="btn-user-role-dropdown-trigger ${currentRole.id === 'admin' ? 'is-admin' : ''}" 
                data-user-role-trigger="${escapeHtml(u.email)}"
                title="คลิกเพื่อสลับบทบาท (${escapeHtml(currentRole.name)})"
                ${isDisabled ? 'disabled' : ''}
              >
                <span class="role-badge-icon">${roleIcon}</span>
                <span class="role-badge-name">${escapeHtml(currentRole.name)}</span>
                <span class="role-badge-arrow">▾</span>
              </button>
            </div>

            <!-- Toggle Disable / Active -->
            <button type="button"
              class="btn-user-status-toggle ${isDisabled ? 'is-disabled' : 'is-active'}"
              data-user-status-toggle="${escapeHtml(u.email)}"
              data-current-status="${isDisabled ? 'disabled' : 'active'}"
              title="${isSelf ? 'ไม่สามารถระงับบัญชีตนเองได้' : (isDisabled ? 'คลิกเพื่อเปิดใช้งานบัญชี' : 'คลิกเพื่อระงับการใช้งานบัญชี')}"
              ${isSelf ? 'disabled' : ''}
            >
              ${isDisabled 
                ? '<span class="status-dot dot-red"></span> ระงับ' 
                : '<span class="status-dot dot-green"></span> ใช้งาน'}
            </button>

            <!-- Delete User Button -->
            <button type="button"
              class="btn-user-delete"
              data-user-delete="${escapeHtml(u.email)}"
              title="${isSelf ? 'ไม่สามารถลบบัญชีตนเองได้' : 'ลบผู้ใช้นี้ออกจากระบบ'}"
              ${isSelf ? 'disabled' : ''}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M3 6h18"></path>
                <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path>
                <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path>
                <line x1="10" y1="11" x2="10" y2="17"></line>
                <line x1="14" y1="11" x2="14" y2="17"></line>
              </svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Wire user search input
    if (searchInput && !searchInput.dataset.wired) {
      searchInput.dataset.wired = 'true';
      searchInput.addEventListener('input', () => {
        renderUsersRolesList(cachedUsers, cachedRoles);
      });
    }

    // Direct event listener for role selector trigger buttons
    container.querySelectorAll('[data-user-role-trigger]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const email = btn.dataset.userRoleTrigger;
        const dropdown = document.getElementById('userRoleSelectDropdown');
        if (dropdown && !dropdown.classList.contains('hidden') && activeUserRoleTargetEmail === email) {
          dropdown.classList.add('hidden');
          btn.classList.remove('is-open');
          return;
        }
        openUserRoleSelectDropdown(email, btn);
      });
    });

    // Wire status toggle buttons
    container.querySelectorAll('[data-user-status-toggle]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const email = btn.dataset.userStatusToggle;
        const currentStatus = btn.dataset.currentStatus;
        if (email) toggleUserStatus(email, currentStatus);
      });
    });

    // Wire delete buttons
    container.querySelectorAll('[data-user-delete]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const email = btn.dataset.userDelete;
        if (email) deleteUser(email);
      });
    });
  }

  // Global handler for user role selector dropdown popover
  document.addEventListener('click', async (e) => {
    const trigger = e.target.closest('[data-user-role-trigger]');
    if (trigger) {
      e.stopPropagation();
      const email = trigger.dataset.userRoleTrigger;
      const dropdown = document.getElementById('userRoleSelectDropdown');
      if (dropdown && !dropdown.classList.contains('hidden') && activeUserRoleTargetEmail === email) {
        dropdown.classList.add('hidden');
        trigger.classList.remove('is-open');
        return;
      }
      openUserRoleSelectDropdown(email, trigger);
      return;
    }

    if (e.target.closest('#btnCloseUserRoleSelectDd')) {
      document.getElementById('userRoleSelectDropdown')?.classList.add('hidden');
      document.querySelectorAll('.btn-user-role-dropdown-trigger').forEach(b => b.classList.remove('is-open'));
      return;
    }

    const roleItem = e.target.closest('[data-select-user-role]');
    if (roleItem) {
      const newRoleId = roleItem.dataset.selectUserRole;
      const email = activeUserRoleTargetEmail;
      document.getElementById('userRoleSelectDropdown')?.classList.add('hidden');
      document.querySelectorAll('.btn-user-role-dropdown-trigger').forEach(b => b.classList.remove('is-open'));

      if (email && newRoleId) {
        await assignUserRole(email, newRoleId);
      }
      return;
    }

    if (!e.target.closest('#userRoleSelectDropdown') && !e.target.closest('[data-user-role-trigger]')) {
      document.getElementById('userRoleSelectDropdown')?.classList.add('hidden');
      document.querySelectorAll('.btn-user-role-dropdown-trigger').forEach(b => b.classList.remove('is-open'));
    }
  });

  function openRoleEditorModal(roleId = null) {
    const modal = document.getElementById('roleEditorModalDialog');
    const title = document.getElementById('roleEditorTitle');
    const inpId = document.getElementById('roleEditId');
    const inpName = document.getElementById('roleEditName');
    const inpDesc = document.getElementById('roleEditDesc');
    const container = document.getElementById('permissionsGroupsContainer');
    if (!modal) return;

    let role = null;
    if (roleId) {
      role = cachedRoles.find(r => r.id === roleId);
    }

    const isNew = !role;
    title.textContent = isNew ? '➕ สร้างบทบาทใหม่ (Add Role)' : `✏️ แก้ไขบทบาท: ${role.name}`;
    inpId.value = role ? role.id : '';
    inpId.disabled = !isNew;
    inpName.value = role ? role.name : '';
    inpDesc.value = role ? (role.description || '') : '';

    // Group permissions
    const groups = {};
    for (const p of cachedPermissionKeys) {
      const grp = p.group || 'ทั่วไป';
      if (!groups[grp]) groups[grp] = [];
      groups[grp].push(p);
    }

    container.innerHTML = Object.entries(groups).map(([grpName, perms]) => {
      const rowsHtml = perms.map(p => {
        const isChecked = role ? Boolean(role.permissions && role.permissions[p.key]) : (grpName !== 'การตั้งค่าระบบ' && grpName !== 'ความปลอดภัย');
        const isLockedAdmin = (role?.id === 'admin' && (p.key === 'manage_settings' || p.key === 'manage_roles'));
        return `
          <div class="perm-toggle-row">
            <div class="perm-toggle-info">
              <label class="perm-toggle-label" for="perm_${p.key}">${escapeHtml(p.label)}</label>
              <div class="perm-toggle-desc">${escapeHtml(p.desc || '')}</div>
            </div>
            <label class="switch-toggle-wrap">
              <input type="checkbox" id="perm_${p.key}" data-perm-key="${p.key}" ${isChecked ? 'checked' : ''} ${isLockedAdmin ? 'disabled title="Admin ต้องมีสิทธิ์นี้เสมอ"' : ''} />
              <span class="switch-slider"></span>
            </label>
          </div>
        `;
      }).join('');

      return `
        <div class="permissions-group-box">
          <div class="perm-group-header">${escapeHtml(grpName)}</div>
          <div class="perm-group-rows">${rowsHtml}</div>
        </div>
      `;
    }).join('');

    modal.showModal();
  }

  async function saveRoleEditor(e) {
    e.preventDefault();
    const inpId = document.getElementById('roleEditId');
    const inpName = document.getElementById('roleEditName');
    const inpDesc = document.getElementById('roleEditDesc');
    const btnSaveRole = document.getElementById('btnSaveRoleEditor');

    const id = inpId.value.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-');
    const name = inpName.value.trim();
    const description = inpDesc.value.trim();

    if (!id || !name) {
      showToast('⚠️ กรุณากรอกรหัสบทบาทและชื่อบทบาท');
      return;
    }

    // Collect permissions
    const permissions = {};
    document.querySelectorAll('#permissionsGroupsContainer input[data-perm-key]').forEach(cb => {
      permissions[cb.dataset.permKey] = cb.checked;
    });

    try {
      if (btnSaveRole) {
        btnSaveRole.disabled = true;
        btnSaveRole.textContent = 'กำลังบันทึก...';
      }

      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, name, description, permissions })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกบทบาทไม่สำเร็จ');

      cachedRoles = data.roles || [];
      renderRolesCards(cachedRoles, cachedPermissionKeys);
      document.getElementById('roleEditorModalDialog')?.close();
      showToast(data.message || 'บันทึกบทบาทเรียบร้อยแล้ว');

      // If current logged-in user has this role, update their local permissions
      if (state.currentUser && (state.currentUser.role_id === id || state.currentUser.role === id)) {
        state.currentUser.permissions = permissions;
        localStorage.setItem('activeasset_current_user', JSON.stringify(state.currentUser));
        applyPermissionsToUI();
        renderActiveView();
      }
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      if (btnSaveRole) {
        btnSaveRole.disabled = false;
        btnSaveRole.textContent = '💾 บันทึกบทบาท';
      }
    }
  }

  async function deleteCustomRole(roleId) {
    const role = cachedRoles.find(r => r.id === roleId);
    const name = role ? role.name : roleId;
    const ok = await showConfirmDialog({
      title: `ลบบทบาท "${name}" หรือไม่?`,
      message: `ผู้ใช้งานที่เคยมีบทบาทนี้ทั้งหมด (${role?.user_count || 0} คน) จะถูกปรับเป็นบทบาท User ตามค่าเริ่มต้น`,
      confirmText: '🗑️ ยืนยันลบบทบาท',
      cancelText: 'ยกเลิก',
      icon: '🗑️',
      confirmBtnClass: 'btn-danger'
    });
    if (!ok) return;

    try {
      const res = await fetch(`/api/roles/${encodeURIComponent(roleId)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบบทบาทไม่สำเร็จ');
      cachedRoles = data.roles || [];
      renderRolesCards(cachedRoles, cachedPermissionKeys);
      await loadRolesAndUsersUI({ silent: true });
      showToast(data.message || 'ลบบทบาทเรียบร้อยแล้ว');
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  }

  async function toggleUserStatus(email, currentStatus) {
    const isCurrentlyDisabled = currentStatus === 'disabled';
    const newStatus = isCurrentlyDisabled ? 'active' : 'disabled';
    const targetUser = cachedUsers.find(u => u.email === email);
    const userName = targetUser?.name || email;

    if (!isCurrentlyDisabled) {
      const confirmed = await showConfirmDialog({
        title: 'ระงับการใช้งานบัญชีผู้ใช้',
        message: `ต้องการระงับการใช้งานของ "${userName}" (${email}) ใช่หรือไม่?`,
        itemHtml: `<div style="font-size:12.5px; color:#64748b; line-height:1.5;">เมื่อระงับแล้ว บัญชีนี้จะไม่สามารถเข้าสู่ระบบ activeASSET ได้จนกว่าจะได้รับการเปิดใช้งานอีกครั้ง</div>`,
        confirmText: '🚫 ระงับการใช้งาน',
        cancelText: 'ยกเลิก',
        icon: '🚫',
        confirmBtnClass: 'btn-danger'
      });
      if (!confirmed) return;
    }

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(email)}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เปลี่ยนสถานะไม่สำเร็จ');

      showToast(data.message || 'อัปเดตสถานะผู้ใช้เรียบร้อยแล้ว');
      // Update locally without flickering
      const user = cachedUsers.find(u => u.email === email);
      if (user) user.status = newStatus;
      renderUsersRolesList(cachedUsers, cachedRoles);
      await loadRolesAndUsersUI({ silent: true, preserveUsersList: true });
    } catch (err) {
      showToast(`❌ ${err.message}`);
      await loadRolesAndUsersUI({ silent: true });
    }
  }

  async function deleteUser(email) {
    const targetUser = cachedUsers.find(u => u.email === email);
    const userName = targetUser?.name || email;

    const confirmed = await showConfirmDialog({
      title: 'ลบผู้ใช้งานออกจากระบบ',
      message: `ยืนยันการลบ "${userName}" (${email}) ใช่หรือไม่?`,
      itemHtml: `<div style="font-size:12.5px; color:#ef4444; line-height:1.5;">⚠️ ข้อมูลบัญชีผู้ใช้นี้จะถูกลบออกจากระบบทันที (ประวัติและเอกสารใบยืมเดิมจะยังคงอยู่เพื่อการตรวจสอบ)</div>`,
      confirmText: '🗑️ ยืนยันลบผู้ใช้',
      cancelText: 'ยกเลิก',
      icon: '🗑️',
      confirmBtnClass: 'btn-danger'
    });
    if (!confirmed) return;

    // Smoothly animate the row slide-out without flickering the entire list
    const rowEl = document.querySelector(`.user-role-row[data-user-email="${CSS.escape(email)}"]`);
    if (rowEl) {
      rowEl.style.transition = 'opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1), transform 0.22s cubic-bezier(0.4, 0, 0.2, 1)';
      rowEl.style.opacity = '0';
      rowEl.style.transform = 'translateX(24px) scale(0.97)';
      rowEl.style.pointerEvents = 'none';
    }

    try {
      const res = await fetch(`/api/users/${encodeURIComponent(email)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบผู้ใช้ไม่สำเร็จ');

      showToast(data.message || 'ลบผู้ใช้เรียบร้อยแล้ว');
      
      // Update local array & smoothly collapse row height without rebuilding DOM
      cachedUsers = cachedUsers.filter(u => u.email !== email);
      if (rowEl) {
        rowEl.style.transition = 'max-height 0.22s ease-out, padding 0.22s ease-out, margin 0.22s ease-out';
        rowEl.style.maxHeight = '0px';
        rowEl.style.paddingTop = '0px';
        rowEl.style.paddingBottom = '0px';
        rowEl.style.marginTop = '0px';
        rowEl.style.marginBottom = '0px';
        rowEl.style.border = 'none';
        rowEl.style.overflow = 'hidden';
        setTimeout(() => rowEl.remove(), 240);
      }
      
      const countBadge = document.getElementById('usersRolesCountBadge');
      if (countBadge) countBadge.textContent = cachedUsers.length;

      // Silently sync role user counts in background
      await loadRolesAndUsersUI({ silent: true, preserveUsersList: true });
    } catch (err) {
      if (rowEl) {
        rowEl.style.opacity = '1';
        rowEl.style.transform = 'none';
        rowEl.style.pointerEvents = 'auto';
      }
      showToast(`❌ ${err.message}`);
      await loadRolesAndUsersUI({ silent: true });
    }
  }

  async function assignUserRole(email, newRoleId) {
    try {
      const res = await fetch(`/api/users/${encodeURIComponent(email)}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRoleId })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เปลี่ยนบทบาทไม่สำเร็จ');

      showToast(data.message || 'เปลี่ยนบทบาทเรียบร้อยแล้ว');
      // If updating current user
      if (state.currentUser && state.currentUser.email === email) {
        state.currentUser = data.user;
        localStorage.setItem('activeasset_current_user', JSON.stringify(data.user));
        updateUserProfileUI();
        applyPermissionsToUI();
        renderActiveView();
      }
      const user = cachedUsers.find(u => u.email === email);
      if (user) user.role_id = newRoleId;
      renderUsersRolesList(cachedUsers, cachedRoles);
      await loadRolesAndUsersUI({ silent: true, preserveUsersList: true });
    } catch (err) {
      showToast(`❌ ${err.message}`);
      await loadRolesAndUsersUI({ silent: true });
    }
  }

  // Wire Tab 4 Events
  const btnCreateRole = document.getElementById('btnOpenCreateRoleModal');
  if (btnCreateRole) {
    btnCreateRole.addEventListener('click', () => openRoleEditorModal(null));
  }

  const roleEditorModal = document.getElementById('roleEditorModalDialog');
  const btnCloseRoleEditor = document.getElementById('btnCloseRoleEditorModal');
  const btnCancelRoleEditor = document.getElementById('btnCancelRoleEditor');
  if (btnCloseRoleEditor && roleEditorModal) {
    btnCloseRoleEditor.addEventListener('click', () => roleEditorModal.close());
  }
  if (btnCancelRoleEditor && roleEditorModal) {
    btnCancelRoleEditor.addEventListener('click', () => roleEditorModal.close());
  }

  const roleForm = document.getElementById('roleEditorForm');
  if (roleForm) {
    roleForm.addEventListener('submit', saveRoleEditor);
  }

  const btnSelectAll = document.getElementById('btnSelectAllPerms');
  if (btnSelectAll) {
    btnSelectAll.addEventListener('click', () => {
      document.querySelectorAll('#permissionsGroupsContainer input[type="checkbox"]').forEach(cb => {
        if (!cb.disabled) cb.checked = true;
      });
    });
  }

  const btnDeselectAll = document.getElementById('btnDeselectAllPerms');
  if (btnDeselectAll) {
    btnDeselectAll.addEventListener('click', () => {
      document.querySelectorAll('#permissionsGroupsContainer input[type="checkbox"]').forEach(cb => {
        if (!cb.disabled) cb.checked = false;
      });
    });
  }

  const rolesCardsList = document.getElementById('rolesCardsList');
  if (rolesCardsList) {
    rolesCardsList.addEventListener('click', e => {
      const editBtn = e.target.closest('[data-edit-role]');
      if (editBtn) {
        openRoleEditorModal(editBtn.dataset.editRole);
        return;
      }
      const delBtn = e.target.closest('[data-delete-role]');
      if (delBtn) {
        deleteCustomRole(delBtn.dataset.deleteRole);
        return;
      }
    });
  }

  const usersRolesList = document.getElementById('usersRolesList');
  if (usersRolesList) {
    usersRolesList.addEventListener('change', e => {
      const select = e.target.closest('[data-assign-user-role]');
      if (select) {
        const email = select.dataset.assignUserRole;
        const newRoleId = select.value;
        assignUserRole(email, newRoleId);
      }
    });
  }
}

function generateLoanEmailText(loan, company) {
  const customerName = loan.customer_name || loan.borrower_name || 'ลูกค้าผู้มีอุปการคุณ';
  const companyName = company.company_name || 'บริษัท แอคทีฟ 5 จำกัด';
  const phone = company.company_phone ? `โทร: ${company.company_phone}` : '';
  const website = company.company_website || '';

  const itemsText = (loan.items || []).map((it, idx) => {
    const accList = (it.loan_accessories && it.loan_accessories.length > 0)
      ? ` | อุปกรณ์เสริม: ${it.loan_accessories.join(', ')}`
      : '';
    const snText = it.serial_no ? `(S/N: ${it.serial_no})` : '(รอจัด Match S/N)';
    const noteText = it.loan_free_note ? ` [หมายเหตุ: ${it.loan_free_note}]` : '';
    return `${idx + 1}. ${it.brand} ${it.model} ${snText}${accList}${noteText}`.trim();
  }).join('\n');

  return `เรียน ${customerName}${loan.customer_company ? ` (${loan.customer_company})` : ''}

เรื่อง: รายละเอียดการส่งมอบอุปกรณ์ Demo / ใบยืมเลขที่ ${loan.id}

บริษัทฯ ขอแจ้งรายละเอียดการส่งมอบอุปกรณ์ Demo ตามเอกสารใบยืมเลขที่ ${loan.id} ดังต่อไปนี้:

• เลขที่เอกสาร: ${loan.id}
• วันที่ทำรายการ: ${formatShortDate(loan.checkout_date)}
• กำหนดส่งคืน: ${formatShortDate(loan.due_date)}
• วัตถุประสงค์: ${loan.purpose || 'Demo'}
• ผู้ประสานงาน / ผู้ส่งมอบ: ${loan.borrower_name || '-'}

รายการอุปกรณ์ที่ส่งมอบ:
${itemsText}

* เงื่อนไข: ผู้ยืมตกลงดูแลรักษาเครื่องและอุปกรณ์เสริมทั้งหมดให้อยู่ในสภาพสมบูรณ์ และนำส่งคืนภายในวันที่กำหนด

หากมีข้อสงสัยหรือต้องการสอบถามข้อมูลเพิ่มเติม สามารถติดต่อได้ที่:
${companyName}
${[phone, website].filter(Boolean).join(' • ')}

ขอแสดงความนับถือ,
${companyName}`;
}

// ==========================================================================
// MASTER DATA (ข้อมูลหลัก) FRONTEND LOGIC
// ==========================================================================
let currentMasterSubTab = 'customers';
let masterCustomerPage = 1;
let masterCustomerQuery = '';
let masterCatalogQuery = '';

window.loadMasterDataUI = async function() {
  await updateMasterBadgeCounts();
  switchMasterSubTab(currentMasterSubTab);
};

async function updateMasterBadgeCounts() {
  try {
    const res = await fetch('/api/master/summary');
    if (!res.ok) return;
    const data = await res.json();
    if (data.counts) {
      const c = data.counts;
      const bCust = document.getElementById('badgeMasterCustCount');
      const bCat = document.getElementById('badgeMasterCatCount');
      const bCategory = document.getElementById('badgeMasterCategoryCount');
      const bBrand = document.getElementById('badgeMasterBrandCount');
      const bLoc = document.getElementById('badgeMasterLocationCount');
      const bAcc = document.getElementById('badgeMasterAccCount');

      if (bCust) bCust.textContent = c.customers.toLocaleString();
      if (bCat) bCat.textContent = c.catalogs.toLocaleString();
      if (bCategory) bCategory.textContent = c.categories.toLocaleString();
      if (bBrand) bBrand.textContent = c.brands.toLocaleString();
      if (bLoc) bLoc.textContent = c.locations.toLocaleString();
      if (bAcc) bAcc.textContent = c.accessories.toLocaleString();
    }
  } catch (_) {}
}

function switchMasterSubTab(subKey) {
  currentMasterSubTab = subKey;
  const tabs = document.querySelectorAll('.master-sub-tab');
  tabs.forEach(tab => {
    tab.classList.toggle('is-active', tab.dataset.masterSub === subKey);
  });

  const contentArea = document.getElementById('masterDataContentArea');
  if (!contentArea) return;

  if (subKey === 'customers') {
    renderMasterCustomersTab(contentArea);
  } else if (subKey === 'catalogs') {
    renderMasterCatalogsTab(contentArea);
  } else if (subKey === 'categories') {
    renderMasterOptionsTab(contentArea, 'category');
  } else if (subKey === 'brands') {
    renderMasterOptionsTab(contentArea, 'brand');
  } else if (subKey === 'locations') {
    renderMasterOptionsTab(contentArea, 'location');
  } else if (subKey === 'accessories') {
    renderMasterOptionsTab(contentArea, 'accessory');
  }
}

// --------------------------------------------------------------------------
// 1. Customers Master Tab
// --------------------------------------------------------------------------
async function renderMasterCustomersTab(container) {
  container.innerHTML = `
    <div class="master-toolbar">
      <div class="master-toolbar-title-group">
        <span class="master-toolbar-title">🏢 ข้อมูลลูกค้า &amp; บริษัทคู่ค้า</span>
      </div>
      <div class="master-toolbar-actions">
        <div class="input-clearable-wrap master-search-wrap has-actions-end">
          <input type="text" id="masterCustomerSearchInput" class="form-control" placeholder="🔍 ค้นหาลูกค้า, เลขภาษี, ผู้ติดต่อ..." value="${escapeHtml(masterCustomerQuery)}" autocomplete="off" />
          <div class="input-actions-end">
            <button type="button" class="btn-input-clear ${masterCustomerQuery ? '' : 'hidden'}" data-clear-target="masterCustomerSearchInput" title="ล้างค่า">✕</button>
            <button type="button" class="btn-keyboard-toggle" data-keyboard-target="masterCustomerSearchInput" title="แสดง/ซ่อน แป้นพิมพ์บนหน้าจอ" aria-label="แสดง/ซ่อน แป้นพิมพ์">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                <line x1="6" y1="8" x2="6" y2="8"></line>
                <line x1="10" y1="8" x2="10" y2="8"></line>
                <line x1="14" y1="8" x2="14" y2="8"></line>
                <line x1="18" y1="8" x2="18" y2="8"></line>
                <line x1="6" y1="12" x2="6" y2="12"></line>
                <line x1="10" y1="12" x2="10" y2="12"></line>
                <line x1="14" y1="12" x2="14" y2="12"></line>
                <line x1="18" y1="12" x2="18" y2="12"></line>
                <line x1="7" y1="16" x2="17" y2="16"></line>
              </svg>
            </button>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btnAddNewMasterCustomer">
          <span>➕ เพิ่มลูกค้าใหม่</span>
        </button>
      </div>
    </div>
    <div class="master-table-card">
      <div class="master-table-scroll" id="masterCustomerTableContainer">
        <div style="padding:32px; text-align:center; color:#64748b;">กำลังโหลดข้อมูลลูกค้า...</div>
      </div>
    </div>
  `;

  const searchInp = document.getElementById('masterCustomerSearchInput');
  const btnAdd = document.getElementById('btnAddNewMasterCustomer');
  const tableContainer = document.getElementById('masterCustomerTableContainer');

  btnAdd?.addEventListener('click', () => openCustomerEditor(null));

  let debounceTimer = null;
  searchInp?.addEventListener('input', e => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      masterCustomerQuery = e.target.value.trim();
      masterCustomerPage = 1;
      fetchAndRenderCustomers(tableContainer);
    }, 250);
  });

  const clearBtn = container.querySelector('.btn-input-clear[data-clear-target="masterCustomerSearchInput"]');
  clearBtn?.addEventListener('click', () => {
    masterCustomerQuery = '';
    masterCustomerPage = 1;
    fetchAndRenderCustomers(tableContainer);
  });

  await fetchAndRenderCustomers(tableContainer);
}

async function fetchAndRenderCustomers(container, opts = {}) {
  if (!container) return;
  const isSilent = opts && opts.silent === true;
  if (!isSilent && !container.querySelector('table')) {
    container.innerHTML = `<div style="padding:32px; text-align:center; color:#64748b;"><span class="status-spinner"></span> กำลังโหลด...</div>`;
  }
  try {
    const res = await fetch(`/api/master/customers?q=${encodeURIComponent(masterCustomerQuery)}&page=${masterCustomerPage}&limit=50`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'โหลดข้อมูลลูกค้าไม่สำเร็จ');

    const list = data.customers || [];
    if (list.length === 0) {
      if (masterCustomerQuery && masterCustomerQuery.length >= 2) {
        container.innerHTML = `
          <div style="padding:40px 20px; text-align:center; color:#64748b;">
            <div style="font-size:32px; margin-bottom:8px;">🏢</div>
            <div style="font-size:14px; font-weight:600; color:#334155;">ไม่พบลูกค้า "${escapeHtml(masterCustomerQuery)}" ในระบบ</div>
            <div style="font-size:12px; margin-top:4px; color:#64748b;">คุณสามารถค้นหาดึงข้อมูลจากภายนอกมาบันทึกเข้าระบบได้ฟรีทันที</div>
            <div style="margin-top:14px;">
              <button type="button" class="btn btn-outline btn-sm" id="btnSearchMasterCustomerOnline" style="background:#f5f3ff; color:#7c3aed; border-color:#c4b5fd; padding:7px 16px; font-size:13px; font-weight:600;">
                🌐 ค้นหา "${escapeHtml(masterCustomerQuery)}" จากฐานข้อมูลภายนอก (ฟรี)
              </button>
            </div>
          </div>
        `;

        document.getElementById('btnSearchMasterCustomerOnline')?.addEventListener('click', async () => {
          container.innerHTML = `<div style="padding:40px 20px; text-align:center; color:#64748b;"><span class="status-spinner"></span> กำลังค้นหาข้อมูลจากฐานข้อมูลภายนอก...</div>`;
          try {
            const resOnline = await fetch(`/api/customers/search?q=${encodeURIComponent(masterCustomerQuery)}`);
            const dOnline = await resOnline.json();
            const onlineItems = (dOnline.results || []).filter(r => r.source === 'online' || !list.some(l => l.name === r.name));
            if (!onlineItems || onlineItems.length === 0) {
              container.innerHTML = `
                <div style="padding:40px 20px; text-align:center; color:#64748b;">
                  <div style="font-size:32px; margin-bottom:8px;">🔍</div>
                  <div style="font-size:14px; font-weight:600; color:#334155;">ไม่พบบริษัทที่ตรงกับ "${escapeHtml(masterCustomerQuery)}" จากภายนอก</div>
                  <div style="margin-top:12px;">
                    <button type="button" class="btn btn-primary btn-sm" id="btnManualAddCustPrompt">
                      ➕ เพิ่มบริษัทนี้ด้วยตนเอง
                    </button>
                  </div>
                </div>
              `;
              document.getElementById('btnManualAddCustPrompt')?.addEventListener('click', () => {
                openCustomerEditor({ name: masterCustomerQuery });
              });
              return;
            }

            container.innerHTML = `
              <div style="padding:10px 16px; background:#f5f3ff; border-bottom:1px solid #ddd6fe; color:#6b21a8; font-size:12.5px; font-weight:600; display:flex; justify-content:space-between; align-items:center;">
                <span>🌐 พบบริษัทจากฐานข้อมูลธุรกิจภายนอก (${onlineItems.length} รายการ)</span>
                <span style="font-size:11px; font-weight:normal; color:#7c3aed;">คลิก "เพิ่มเข้าระบบ" เพื่อบันทึกเข้าสู่ Master Data ทันที</span>
              </div>
              <table class="master-table">
                <thead>
                  <tr>
                    <th style="width:40px; text-align:center;">#</th>
                    <th>ชื่อบริษัท (ภายนอก)</th>
                    <th style="width:140px; text-align:center;">แหล่งที่มา</th>
                    <th style="width:130px; text-align:center;">การดำเนินการ</th>
                  </tr>
                </thead>
                <tbody>
                  ${onlineItems.map((item, idx) => `
                    <tr>
                      <td style="text-align:center; color:#94a3b8; font-size:12px;">${idx + 1}</td>
                      <td>
                        <div style="font-weight:600; color:#1e293b;">${escapeHtml(item.name)}</div>
                      </td>
                      <td style="text-align:center;">
                        <span class="company-item-badge badge-online">🌐 ภายนอก</span>
                      </td>
                      <td style="text-align:center;">
                        <button type="button" class="btn btn-primary btn-xs btn-add-online-to-master" data-online-name="${escapeHtml(item.name)}">
                          ➕ เพิ่มเข้าระบบ
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            `;

            container.querySelectorAll('.btn-add-online-to-master').forEach(btn => {
              btn.addEventListener('click', async e => {
                const bName = e.currentTarget.dataset.onlineName;
                try {
                  btn.disabled = true;
                  btn.textContent = 'กำลังบันทึก...';
                  const lRes = await fetch('/api/customers/learn', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: bName })
                  });
                  const lData = await lRes.json();
                  if (!lRes.ok) throw new Error(lData.error || 'บันทึกไม่สำเร็จ');
                  showToast(`✅ เพิ่ม "${bName}" เข้าสู่ระบบเรียบร้อย`);
                  await updateMasterBadgeCounts();
                  masterCustomerQuery = bName;
                  const sInp = document.getElementById('masterCustomerSearchInput');
                  if (sInp) sInp.value = bName;
                  fetchAndRenderCustomers(container);
                } catch (err) {
                  showToast(`❌ ${err.message}`);
                  btn.disabled = false;
                  btn.textContent = '➕ เพิ่มเข้าระบบ';
                }
              });
            });
          } catch (err) {
            container.innerHTML = `<div style="padding:30px; text-align:center; color:#ef4444;">❌ ค้นหาภายนอกไม่สำเร็จ: ${escapeHtml(err.message)}</div>`;
          }
        });
        return;
      }

      container.innerHTML = `
        <div style="padding:40px 20px; text-align:center; color:#64748b;">
          <div style="font-size:32px; margin-bottom:8px;">🏢</div>
          <div style="font-size:14px; font-weight:600; color:#334155;">ไม่พบข้อมูลลูกค้า</div>
          <div style="font-size:12px; margin-top:4px;">ลองเปลี่ยนคำค้นหา หรือกดปุ่ม "เพิ่มลูกค้าใหม่" ด้านบน</div>
        </div>
      `;
      return;
    }

    const startIndex = (data.page - 1) * data.limit + 1;
    container.innerHTML = `
      <table class="master-table">
        <thead>
          <tr>
            <th style="width:40px; text-align:center;">#</th>
            <th style="min-width:220px;">ชื่อลูกค้า / บริษัท</th>
            <th style="min-width:140px;">เลขประจำตัวผู้เสียภาษี &amp; สาขา</th>
            <th style="min-width:140px;">ผู้ติดต่อ</th>
            <th style="min-width:150px;">เบอร์โทร &amp; อีเมล</th>
            <th style="width:90px; text-align:center;">แหล่งที่มา</th>
            <th style="width:70px; text-align:center;">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((c, idx) => `
            <tr>
              <td style="text-align:center; color:#94a3b8; font-size:12px;">${startIndex + idx}</td>
              <td>
                <div class="master-item-name-th">${escapeHtml(c.name)}</div>
                ${c.name_en ? `<div class="master-item-name-en">${escapeHtml(c.name_en)}</div>` : ''}
                ${c.address ? `<div style="font-size:11.5px; color:#64748b; margin-top:3px; max-width:320px; line-height:1.3;">📍 ${escapeHtml(c.address)}</div>` : ''}
              </td>
              <td>
                <div>${escapeHtml(c.tax_id || '-')}</div>
                ${c.branch ? `<div style="font-size:11.5px; color:#64748b;">สาขา: ${escapeHtml(c.branch)}</div>` : ''}
              </td>
              <td>${escapeHtml(c.contact_name || '-')}</td>
              <td>
                ${c.phone ? `<div>📞 ${escapeHtml(c.phone)}</div>` : ''}
                ${c.email ? `<div style="font-size:11.5px; color:#2563eb;">✉️ ${escapeHtml(c.email)}</div>` : ''}
                ${!c.phone && !c.email ? `<span style="color:#94a3b8;">-</span>` : ''}
              </td>
              <td style="text-align:center;">
                <span class="master-badge-source source-${c.source || 'custom'}">
                  ${c.source === 'custom' ? 'เพิ่มเอง' : c.source === 'history' ? 'ประวัติใบยืม' : 'DBD'}
                </span>
              </td>
              <td style="text-align:center;">
                <div class="master-action-btn-group">
                  <button type="button" class="btn-master-action" data-edit-master-cust="${c.id}" title="แก้ไขข้อมูลลูกค้า">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>
                  </button>
                  <button type="button" class="btn-master-action btn-master-delete" data-delete-master-cust="${c.id}" data-cust-name="${escapeHtml(c.name)}" title="ลบข้อมูลลูกค้า">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                  </button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <div class="master-pagination-bar">
        <div>แสดงรายการที่ <strong>${startIndex} - ${startIndex + list.length - 1}</strong> จากทั้งหมด <strong>${data.total.toLocaleString()}</strong> รายการ</div>
        <div class="master-page-btn-group">
          <button type="button" class="btn btn-xs btn-outline" id="btnCustPrevPage" ${data.page <= 1 ? 'disabled' : ''}>◀ หน้าก่อน</button>
          <span>หน้า ${data.page} / ${data.totalPages || 1}</span>
          <button type="button" class="btn btn-xs btn-outline" id="btnCustNextPage" ${data.page >= data.totalPages ? 'disabled' : ''}>หน้าถัดไป ▶</button>
        </div>
      </div>
    `;

    // Wire pagination
    document.getElementById('btnCustPrevPage')?.addEventListener('click', () => {
      if (masterCustomerPage > 1) {
        masterCustomerPage--;
        fetchAndRenderCustomers(container);
      }
    });
    document.getElementById('btnCustNextPage')?.addEventListener('click', () => {
      if (masterCustomerPage < data.totalPages) {
        masterCustomerPage++;
        fetchAndRenderCustomers(container);
      }
    });

    // Wire Edit & Delete clicks
    container.querySelectorAll('[data-edit-master-cust]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.editMasterCust, 10);
        const cust = list.find(item => item.id === id);
        if (cust) openCustomerEditor(cust);
      });
    });

    container.querySelectorAll('[data-delete-master-cust]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.deleteMasterCust, 10);
        const name = btn.dataset.custName;
        const confirmed = await showConfirmDialog({
          title: 'ลบข้อมูลลูกค้า',
          message: `คุณต้องการลบข้อมูลลูกค้า "${name}" ใช่หรือไม่?`,
          itemHtml: `<div style="font-size:12.5px; color:#64748b;">ระบบจะไม่อนุญาตให้ลบหากลูกค้ารายนี้มีประวัติการยืมในระบบ</div>`,
          confirmText: '🗑️ ยืนยันลบ',
          cancelText: 'ยกเลิก',
          icon: '🗑️',
          confirmBtnClass: 'btn-danger'
        });
        if (!confirmed) return;

        const tr = btn.closest('tr');
        if (tr) {
          tr.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
          tr.style.opacity = '0';
          tr.style.transform = 'translateX(16px)';
        }

        try {
          const delRes = await fetch(`/api/master/customers/${id}`, { method: 'DELETE' });
          const delData = await delRes.json();
          if (!delRes.ok) throw new Error(delData.error || 'ลบข้อมูลลูกค้าไม่สำเร็จ');
          showToast(`✅ ${delData.message || 'ลบข้อมูลลูกค้าเรียบร้อยแล้ว'}`);
          await updateMasterBadgeCounts();
          fetchAndRenderCustomers(container, { silent: true });
        } catch (err) {
          if (tr) { tr.style.opacity = '1'; tr.style.transform = 'none'; }
          showToast(`❌ ${err.message}`);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div style="padding:24px; text-align:center; color:#ef4444;">❌ ${escapeHtml(err.message)}</div>`;
  }
}

function openCustomerEditor(cust = null) {
  const modal = document.getElementById('customerEditorModalDialog');
  const titleEl = document.getElementById('customerEditorTitle');
  const idInput = document.getElementById('customerEditId');
  const nameInput = document.getElementById('custEditName');
  const nameEnInput = document.getElementById('custEditNameEn');
  const taxIdInput = document.getElementById('custEditTaxId');
  const branchInput = document.getElementById('custEditBranch');
  const addrInput = document.getElementById('custEditAddress');
  const contactInput = document.getElementById('custEditContact');
  const phoneInput = document.getElementById('custEditPhone');
  const emailInput = document.getElementById('custEditEmail');

  if (!modal) return;

  if (cust) {
    if (titleEl) titleEl.textContent = '🏢 แก้ไขข้อมูลลูกค้า';
    if (idInput) idInput.value = cust.id;
    if (nameInput) nameInput.value = cust.name || '';
    if (nameEnInput) nameEnInput.value = cust.name_en || '';
    if (taxIdInput) taxIdInput.value = cust.tax_id || '';
    if (branchInput) branchInput.value = cust.branch || 'สำนักงานใหญ่';
    if (addrInput) addrInput.value = cust.address || '';
    if (contactInput) contactInput.value = cust.contact_name || '';
    if (phoneInput) phoneInput.value = cust.phone || '';
    if (emailInput) emailInput.value = cust.email || '';
  } else {
    if (titleEl) titleEl.textContent = '🏢 เพิ่มข้อมูลลูกค้าใหม่';
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    if (nameEnInput) nameEnInput.value = '';
    if (taxIdInput) taxIdInput.value = '';
    if (branchInput) branchInput.value = 'สำนักงานใหญ่';
    if (addrInput) addrInput.value = '';
    if (contactInput) contactInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (emailInput) emailInput.value = '';
  }

  // Update clear buttons
  [nameInput, nameEnInput, taxIdInput, branchInput, contactInput, phoneInput, emailInput].forEach(inp => {
    if (inp) {
      const clearBtn = inp.parentElement?.querySelector('.btn-input-clear');
      if (clearBtn) clearBtn.classList.toggle('hidden', !inp.value);
    }
  });

  modal.showModal();
}

// --------------------------------------------------------------------------
// 2. Product Catalogs Master Tab
// --------------------------------------------------------------------------
async function renderMasterCatalogsTab(container) {
  container.innerHTML = `
    <div class="master-toolbar">
      <div class="master-toolbar-title-group">
        <span class="master-toolbar-title">📦 แคตตาล็อกสินค้า &amp; รุ่นเครื่อง</span>
      </div>
      <div class="master-toolbar-actions">
        <div class="input-clearable-wrap master-search-wrap has-actions-end">
          <input type="text" id="masterCatalogSearchInput" class="form-control" placeholder="🔍 ค้นหารุ่น, ยี่ห้อ, หมวดหมู่..." value="${escapeHtml(masterCatalogQuery)}" autocomplete="off" />
          <div class="input-actions-end">
            <button type="button" class="btn-input-clear ${masterCatalogQuery ? '' : 'hidden'}" data-clear-target="masterCatalogSearchInput" title="ล้างค่า">✕</button>
            <button type="button" class="btn-keyboard-toggle" data-keyboard-target="masterCatalogSearchInput" title="แสดง/ซ่อน แป้นพิมพ์บนหน้าจอ" aria-label="แสดง/ซ่อน แป้นพิมพ์">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="2" y="4" width="20" height="16" rx="2" ry="2"></rect>
                <line x1="6" y1="8" x2="6" y2="8"></line>
                <line x1="10" y1="8" x2="10" y2="8"></line>
                <line x1="14" y1="8" x2="14" y2="8"></line>
                <line x1="18" y1="8" x2="18" y2="8"></line>
                <line x1="6" y1="12" x2="6" y2="12"></line>
                <line x1="10" y1="12" x2="10" y2="12"></line>
                <line x1="14" y1="12" x2="14" y2="12"></line>
                <line x1="18" y1="12" x2="18" y2="12"></line>
                <line x1="7" y1="16" x2="17" y2="16"></line>
              </svg>
            </button>
          </div>
        </div>
        <button type="button" class="btn btn-primary btn-sm" id="btnAddNewMasterCatalog">
          <span>➕ เพิ่มรุ่นใหม่</span>
        </button>
      </div>
    </div>
    <div class="master-table-card">
      <div class="master-table-scroll" id="masterCatalogTableContainer">
        <div style="padding:32px; text-align:center; color:#64748b;">กำลังโหลดแคตตาล็อก...</div>
      </div>
    </div>
  `;

  const searchInp = document.getElementById('masterCatalogSearchInput');
  const btnAdd = document.getElementById('btnAddNewMasterCatalog');
  const tableContainer = document.getElementById('masterCatalogTableContainer');

  btnAdd?.addEventListener('click', () => openCatalogEditor(null));

  let debounceTimer = null;
  searchInp?.addEventListener('input', e => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      masterCatalogQuery = e.target.value.trim();
      fetchAndRenderCatalogs(tableContainer);
    }, 250);
  });

  const clearBtn = container.querySelector('.btn-input-clear[data-clear-target="masterCatalogSearchInput"]');
  clearBtn?.addEventListener('click', () => {
    masterCatalogQuery = '';
    fetchAndRenderCatalogs(tableContainer);
  });

  await fetchAndRenderCatalogs(tableContainer);
}

async function fetchAndRenderCatalogs(container, opts = {}) {
  if (!container) return;
  const isSilent = opts && opts.silent === true;
  if (!isSilent && !container.querySelector('table')) {
    container.innerHTML = `<div style="padding:32px; text-align:center; color:#64748b;"><span class="status-spinner"></span> กำลังโหลด...</div>`;
  }
  try {
    const res = await fetch(`/api/master/catalogs?q=${encodeURIComponent(masterCatalogQuery)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'โหลดแคตตาล็อกไม่สำเร็จ');

    const list = data.catalogs || [];
    if (list.length === 0) {
      container.innerHTML = `
        <div style="padding:40px 20px; text-align:center; color:#64748b;">
          <div style="font-size:32px; margin-bottom:8px;">📦</div>
          <div style="font-size:14px; font-weight:600; color:#334155;">ไม่พบแคตตาล็อกรุ่นสินค้า</div>
          <div style="font-size:12px; margin-top:4px;">กดปุ่ม "เพิ่มรุ่นใหม่" ด้านบนเพื่อเพิ่มรายการเข้าสู่ระบบ</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="master-table">
        <thead>
          <tr>
            <th style="width:40px; text-align:center;">#</th>
            <th style="min-width:180px;">ยี่ห้อ &amp; รุ่น (Brand &amp; Model)</th>
            <th style="min-width:140px;">หมวดหมู่ (Category)</th>
            <th style="min-width:180px;">สเปกย่อ (Specifications)</th>
            <th style="min-width:180px;">อุปกรณ์เสริมมาตรฐาน</th>
            <th style="width:110px; text-align:center;">จำนวนในคลัง</th>
            <th style="width:70px; text-align:center;">จัดการ</th>
          </tr>
        </thead>
        <tbody>
          ${list.map((c, idx) => {
            let accs = [];
            try { accs = JSON.parse(c.default_accessories || '[]'); } catch (_) { accs = []; }
            return `
              <tr>
                <td style="text-align:center; color:#94a3b8; font-size:12px;">${idx + 1}</td>
                <td>
                  <div class="master-item-name-th">${escapeHtml(c.model)}</div>
                  <div class="master-item-name-en">ยี่ห้อ: <strong>${escapeHtml(c.brand)}</strong></div>
                </td>
                <td>
                  <span style="display:inline-block; padding:2px 8px; border-radius:6px; background:#f1f5f9; color:#334155; font-size:12px; font-weight:500;">
                    ${escapeHtml(c.category)}
                  </span>
                </td>
                <td style="font-size:12px; color:#475569;">${escapeHtml(c.default_specs || '-')}</td>
                <td>
                  ${accs.length > 0
                    ? `<div style="display:flex; flex-wrap:wrap; gap:3px;">
                        ${accs.map(a => `<span style="display:inline-block; padding:1px 6px; border-radius:4px; background:#f8fafc; border:1px solid #e2e8f0; font-size:11px; color:#475569;">${escapeHtml(a)}</span>`).join('')}
                      </div>`
                    : `<span style="color:#94a3b8;">-</span>`
                  }
                </td>
                <td style="text-align:center;">
                  <span style="display:inline-flex; align-items:center; gap:4px; padding:3px 9px; border-radius:9999px; font-size:12px; font-weight:600; ${c.asset_count > 0 ? 'background:#eff6ff; color:#1d4ed8;' : 'background:#f1f5f9; color:#94a3b8;'}">
                    <span>${c.asset_count}</span>
                    <span style="font-weight:400; font-size:11px;">เครื่อง</span>
                  </span>
                </td>
                <td style="text-align:center;">
                  <div class="master-action-btn-group">
                    <button type="button" class="btn-master-action" data-edit-master-cat="${c.id}" title="แก้ไขแคตตาล็อก">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>
                    </button>
                    <button type="button" class="btn-master-action btn-master-delete" data-delete-master-cat="${c.id}" data-cat-model="${escapeHtml(c.model)}" title="ลบรุ่นสินค้า">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                    </button>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;

    // Wire Edit & Delete clicks
    container.querySelectorAll('[data-edit-master-cat]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.editMasterCat, 10);
        const cat = list.find(item => item.id === id);
        if (cat) openCatalogEditor(cat);
      });
    });

    container.querySelectorAll('[data-delete-master-cat]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.deleteMasterCat, 10);
        const model = btn.dataset.catModel;
        const confirmed = await showConfirmDialog({
          title: 'ลบแคตตาล็อกรุ่นสินค้า',
          message: `คุณต้องการลบรุ่น "${model}" ออกจากแคตตาล็อกใช่หรือไม่?`,
          itemHtml: `<div style="font-size:12.5px; color:#64748b;">หากมีเครื่องในสต็อกที่ใช้รุ่นนี้อยู่ จะไม่สามารถลบได้</div>`,
          confirmText: '🗑️ ยืนยันลบ',
          cancelText: 'ยกเลิก',
          icon: '🗑️',
          confirmBtnClass: 'btn-danger'
        });
        if (!confirmed) return;

        const tr = btn.closest('tr');
        if (tr) {
          tr.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
          tr.style.opacity = '0';
          tr.style.transform = 'translateX(16px)';
        }

        try {
          const delRes = await fetch(`/api/master/catalogs/${id}`, { method: 'DELETE' });
          const delData = await delRes.json();
          if (!delRes.ok) throw new Error(delData.error || 'ลบแคตตาล็อกไม่สำเร็จ');
          showToast(`✅ ${delData.message || 'ลบเรียบร้อยแล้ว'}`);
          await updateMasterBadgeCounts();
          fetchAndRenderCatalogs(container, { silent: true });
        } catch (err) {
          if (tr) { tr.style.opacity = '1'; tr.style.transform = 'none'; }
          showToast(`❌ ${err.message}`);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div style="padding:24px; text-align:center; color:#ef4444;">❌ ${escapeHtml(err.message)}</div>`;
  }
}

function openCatalogEditor(cat = null) {
  const modal = document.getElementById('catalogEditorModalDialog');
  const titleEl = document.getElementById('catalogEditorTitle');
  const idInput = document.getElementById('catalogEditId');
  const brandInput = document.getElementById('catalogEditBrand');
  const modelInput = document.getElementById('catalogEditModel');
  const categoryInput = document.getElementById('catalogEditCategory');
  const specsInput = document.getElementById('catalogEditSpecs');
  const accInput = document.getElementById('catalogEditAccessories');

  if (!modal) return;

  if (cat) {
    if (titleEl) titleEl.textContent = '📦 แก้ไขแคตตาล็อกรุ่นสินค้า';
    if (idInput) idInput.value = cat.id;
    if (brandInput) brandInput.value = cat.brand || '';
    if (modelInput) modelInput.value = cat.model || '';
    if (categoryInput) categoryInput.value = cat.category || '';
    if (specsInput) specsInput.value = cat.default_specs || '';
    let accs = [];
    try { accs = JSON.parse(cat.default_accessories || '[]'); } catch (_) { accs = []; }
    if (accInput) accInput.value = Array.isArray(accs) ? accs.join(', ') : '';
  } else {
    if (titleEl) titleEl.textContent = '📦 เพิ่มรุ่นสินค้าใหม่เข้าแคตตาล็อก';
    if (idInput) idInput.value = '';
    if (brandInput) brandInput.value = '';
    if (modelInput) modelInput.value = '';
    if (categoryInput) categoryInput.value = 'Mobile Computer';
    if (specsInput) specsInput.value = '';
    if (accInput) accInput.value = 'สาย USB, Power Adapter, Power Cord, แบตเตอรี่';
  }

  modal.showModal();
}

// --------------------------------------------------------------------------
// 3. Master Options Tab (Categories / Brands / Locations / Accessories) - Clean Minimal List & Inline Editing
// --------------------------------------------------------------------------
async function renderMasterOptionsTab(container, type) {
  const typeMetas = {
    category: {
      title: 'หมวดหมู่สินค้า',
      sub: 'Categories',
      label: 'หมวดหมู่',
      iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2H2v10l9.29 9.29c.94.94 2.48.94 3.42 0l6.58-6.58c.94-.94.94-2.48 0-3.42L12 2Z"></path><path d="M7 7h.01"></path></svg>'
    },
    brand: {
      title: 'ยี่ห้อสินค้า',
      sub: 'Brands',
      label: 'ยี่ห้อ',
      iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="6"></circle><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"></path></svg>'
    },
    location: {
      title: 'สถานที่จัดเก็บ / ตู้เก็บเครื่อง',
      sub: 'Storage Locations',
      label: 'สถานที่จัดเก็บ',
      iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"></path><circle cx="12" cy="10" r="3"></circle></svg>'
    },
    accessory: {
      title: 'อุปกรณ์เสริมมาตรฐาน',
      sub: 'Preset Accessories',
      label: 'อุปกรณ์เสริม',
      iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v6"></path><path d="M6 8a6 6 0 0 0 12 0"></path><path d="M12 14v8"></path><line x1="8" y1="2" x2="8" y2="4"></line><line x1="16" y1="2" x2="16" y2="4"></line></svg>'
    }
  };

  const meta = typeMetas[type] || {
    title: 'ตัวเลือก',
    sub: type,
    label: 'รายการ',
    iconSvg: '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>'
  };

  container.innerHTML = `
    <div class="master-toolbar">
      <div class="master-toolbar-title-group" style="display:flex; align-items:center; gap:8px;">
        <span style="color:#2563eb; display:inline-flex; align-items:center;">${meta.iconSvg}</span>
        <span class="master-toolbar-title">${meta.title}</span>
        <span style="font-size:12px; color:#94a3b8; font-weight:normal;">(${meta.sub})</span>
      </div>
    </div>

    <!-- Minimal Inline Quick Add Bar -->
    <div class="master-inline-add-bar">
      <input 
        type="text" 
        id="masterOptQuickInput" 
        class="master-opt-quick-input" 
        placeholder="➕ พิมพ์ชื่อ${meta.label}ใหม่... (แล้วกด Enter เพื่อเพิ่มทันที)" 
        autocomplete="off" 
      />
      <button type="button" class="btn btn-primary btn-sm" id="btnMasterQuickAdd" style="white-space:nowrap; display:inline-flex; align-items:center; gap:5px;">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        <span>เพิ่ม${meta.label}</span>
      </button>
    </div>

    <!-- Minimal List Container -->
    <div id="masterOptionListContainer">
      <div style="padding:32px; text-align:center; color:#64748b;"><span class="status-spinner"></span> กำลังโหลด...</div>
    </div>
  `;

  const quickInput = document.getElementById('masterOptQuickInput');
  const btnQuickAdd = document.getElementById('btnMasterQuickAdd');
  const listContainer = document.getElementById('masterOptionListContainer');

  const handleQuickAdd = async () => {
    const val = (quickInput?.value || '').trim();
    if (!val) {
      showToast(`⚠️ กรุณากรอกชื่อ${meta.label}`);
      quickInput?.focus();
      return;
    }

    try {
      if (btnQuickAdd) btnQuickAdd.disabled = true;
      const res = await fetch('/api/master/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name: val })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'เพิ่มไม่สำเร็จ');

      quickInput.value = '';
      showToast(`✅ เพิ่ม "${val}" เรียบร้อยแล้ว`);
      await updateMasterBadgeCounts();
      await fetchAndRenderOptions(listContainer, type, { silent: true });
      quickInput.focus();
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      if (btnQuickAdd) btnQuickAdd.disabled = false;
    }
  };

  quickInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleQuickAdd();
    }
  });

  btnQuickAdd?.addEventListener('click', handleQuickAdd);

  await fetchAndRenderOptions(listContainer, type);
}

async function fetchAndRenderOptions(container, type, opts = {}) {
  if (!container) return;
  const isSilent = opts && opts.silent === true;
  if (!isSilent && !container.querySelector('.master-opt-list')) {
    container.innerHTML = `<div style="padding:32px; text-align:center; color:#64748b;"><span class="status-spinner"></span> กำลังโหลด...</div>`;
  }

  try {
    const res = await fetch(`/api/master/options?type=${encodeURIComponent(type)}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'โหลดข้อมูลไม่สำเร็จ');

    const list = data.options || [];
    if (list.length === 0) {
      container.innerHTML = `
        <div style="padding:40px 20px; text-align:center; color:#64748b; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px;">
          <div style="font-size:24px; margin-bottom:6px; opacity:0.6;">📋</div>
          <div style="font-size:13.5px; font-weight:600; color:#334155;">ยังไม่มีรายการในหมวดนี้</div>
          <div style="font-size:12px; margin-top:4px; color:#94a3b8;">พิมพ์ชื่อในกล่องด้านบนแล้วกด Enter เพื่อเพิ่มรายการแรก</div>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="master-opt-list">
        ${list.map(opt => `
          <div class="master-opt-row" data-opt-id="${opt.id}" data-opt-name="${escapeHtml(opt.name)}">
            <!-- Normal Display Mode -->
            <div class="master-opt-display">
              <div class="master-opt-name-wrap">
                <span class="master-opt-bullet"></span>
                <span class="master-opt-name" data-trigger-edit="${opt.id}" title="ดับเบิลคลิกเพื่อแก้ไขชื่อ">${escapeHtml(opt.name)}</span>
                ${type !== 'accessory' ? `
                  <span class="master-opt-meta ${opt.asset_count > 0 ? 'has-assets' : ''}">
                    ${opt.asset_count > 0 ? `${opt.asset_count} เครื่องในคลัง` : '0 เครื่อง'}
                  </span>
                ` : ''}
              </div>
              <div class="master-opt-actions">
                <button type="button" class="btn-opt-action btn-opt-edit" data-edit-opt="${opt.id}" title="แก้ไขชื่อ">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>
                </button>
                <button type="button" class="btn-opt-action btn-opt-delete" data-delete-opt="${opt.id}" data-opt-name="${escapeHtml(opt.name)}" title="ลบ">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                </button>
              </div>
            </div>

            <!-- In-place Inline Edit Mode -->
            <div class="master-opt-edit hidden">
              <input type="text" class="form-control master-opt-inline-input" value="${escapeHtml(opt.name)}" autocomplete="off" />
              <div class="master-opt-edit-btns">
                <button type="button" class="btn btn-primary btn-sm btn-opt-save-inline" data-save-opt="${opt.id}" title="บันทึก (Enter)" style="display:inline-flex; align-items:center; gap:4px; height:32px; padding:0 10px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                  <span>บันทึก</span>
                </button>
                <button type="button" class="btn btn-outline btn-sm btn-opt-cancel-inline" data-cancel-opt="${opt.id}" title="ยกเลิก (Esc)" style="display:inline-flex; align-items:center; gap:4px; height:32px; padding:0 10px;">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                  <span>ยกเลิก</span>
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Wire Inline Edit Triggers
    const startInlineEdit = (optId) => {
      const row = container.querySelector(`.master-opt-row[data-opt-id="${optId}"]`);
      if (!row) return;

      // Close any other row currently in edit mode first
      container.querySelectorAll('.master-opt-row').forEach(r => {
        if (r !== row) {
          r.querySelector('.master-opt-display')?.classList.remove('hidden');
          r.querySelector('.master-opt-edit')?.classList.add('hidden');
        }
      });

      const displayArea = row.querySelector('.master-opt-display');
      const editArea = row.querySelector('.master-opt-edit');
      const input = row.querySelector('.master-opt-inline-input');

      if (displayArea) displayArea.classList.add('hidden');
      if (editArea) editArea.classList.remove('hidden');
      if (input) {
        input.focus();
        input.select();
      }
    };

    const cancelInlineEdit = (optId) => {
      const row = container.querySelector(`.master-opt-row[data-opt-id="${optId}"]`);
      if (!row) return;

      const displayArea = row.querySelector('.master-opt-display');
      const editArea = row.querySelector('.master-opt-edit');
      const input = row.querySelector('.master-opt-inline-input');
      const originalName = row.dataset.optName;

      if (input) input.value = originalName;
      if (editArea) editArea.classList.add('hidden');
      if (displayArea) displayArea.classList.remove('hidden');
    };

    const saveInlineEdit = async (optId) => {
      const row = container.querySelector(`.master-opt-row[data-opt-id="${optId}"]`);
      if (!row) return;

      const input = row.querySelector('.master-opt-inline-input');
      const saveBtn = row.querySelector('.btn-opt-save-inline');
      const newName = (input?.value || '').trim();
      const originalName = row.dataset.optName;

      if (!newName) {
        showToast('⚠️ กรุณาระบุชื่อ');
        input?.focus();
        return;
      }

      if (newName === originalName) {
        cancelInlineEdit(optId);
        return;
      }

      try {
        if (saveBtn) saveBtn.disabled = true;
        const putRes = await fetch(`/api/master/options/${optId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newName })
        });
        const putData = await putRes.json();
        if (!putRes.ok) throw new Error(putData.error || 'บันทึกไม่สำเร็จ');

        // Update row DOM in place smoothly
        row.dataset.optName = newName;
        const nameEl = row.querySelector('.master-opt-name');
        if (nameEl) nameEl.textContent = newName;

        const deleteBtn = row.querySelector('.btn-opt-delete');
        if (deleteBtn) deleteBtn.dataset.optName = newName;

        const displayArea = row.querySelector('.master-opt-display');
        const editArea = row.querySelector('.master-opt-edit');
        if (editArea) editArea.classList.add('hidden');
        if (displayArea) displayArea.classList.remove('hidden');

        showToast(`✅ แก้ไขเป็น "${newName}" เรียบร้อยแล้ว`);
      } catch (err) {
        showToast(`❌ ${err.message}`);
        input?.focus();
      } finally {
        if (saveBtn) saveBtn.disabled = false;
      }
    };

    // Attach Event Listeners for Edit, Save, Cancel, and Delete
    container.querySelectorAll('.btn-opt-edit').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        startInlineEdit(btn.dataset.editOpt);
      });
    });

    container.querySelectorAll('[data-trigger-edit]').forEach(el => {
      el.addEventListener('dblclick', () => {
        startInlineEdit(el.dataset.triggerEdit);
      });
    });

    container.querySelectorAll('.btn-opt-cancel-inline').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelInlineEdit(btn.dataset.cancelOpt);
      });
    });

    container.querySelectorAll('.btn-opt-save-inline').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveInlineEdit(btn.dataset.saveOpt);
      });
    });

    container.querySelectorAll('.master-opt-inline-input').forEach(inp => {
      inp.addEventListener('keydown', (e) => {
        const row = inp.closest('.master-opt-row');
        const optId = row?.dataset?.optId;
        if (!optId) return;

        if (e.key === 'Enter') {
          e.preventDefault();
          saveInlineEdit(optId);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          cancelInlineEdit(optId);
        }
      });
    });

    container.querySelectorAll('.btn-opt-delete').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = parseInt(btn.dataset.deleteOpt, 10);
        const name = btn.dataset.optName;
        const confirmed = await showConfirmDialog({
          title: 'ลบรายการ',
          message: `คุณต้องการลบ "${name}" ใช่หรือไม่?`,
          itemHtml: type !== 'accessory' ? `<div style="font-size:12.5px; color:#64748b;">หากมีเครื่องในคลังที่ใช้รายการนี้อยู่ จะไม่สามารถลบได้</div>` : '',
          confirmText: '🗑️ ยืนยันลบ',
          cancelText: 'ยกเลิก',
          icon: '🗑️',
          confirmBtnClass: 'btn-danger'
        });
        if (!confirmed) return;

        const row = btn.closest('.master-opt-row');
        if (row) {
          row.style.transition = 'opacity 0.22s ease, transform 0.22s ease';
          row.style.opacity = '0';
          row.style.transform = 'translateX(16px)';
        }

        try {
          const delRes = await fetch(`/api/master/options/${id}`, { method: 'DELETE' });
          const delData = await delRes.json();
          if (!delRes.ok) throw new Error(delData.error || 'ลบไม่สำเร็จ');
          showToast(`✅ ${delData.message || 'ลบเรียบร้อยแล้ว'}`);
          await updateMasterBadgeCounts();
          
          if (row) {
            row.style.transition = 'max-height 0.22s ease-out, padding 0.22s ease-out, margin 0.22s ease-out';
            row.style.maxHeight = '0px';
            row.style.overflow = 'hidden';
            setTimeout(() => row.remove(), 240);
          }
        } catch (err) {
          if (row) { row.style.opacity = '1'; row.style.transform = 'none'; }
          showToast(`❌ ${err.message}`);
        }
      });
    });
  } catch (err) {
    container.innerHTML = `<div style="padding:24px; text-align:center; color:#ef4444;">❌ ${escapeHtml(err.message)}</div>`;
  }
}

function openOptionEditor(type, opt = null) {
  const modal = document.getElementById('optionEditorModalDialog');
  const titleEl = document.getElementById('optionEditorTitle');
  const idInput = document.getElementById('optionEditId');
  const typeInput = document.getElementById('optionEditType');
  const nameInput = document.getElementById('optionEditName');
  const nameLabel = document.getElementById('optionEditNameLabel');

  if (!modal) return;

  const labels = {
    category: 'ชื่อหมวดหมู่',
    brand: 'ชื่อยี่ห้อ',
    location: 'ชื่อสถานที่จัดเก็บ / ตู้เก็บ',
    accessory: 'ชื่ออุปกรณ์เสริม'
  };

  if (typeInput) typeInput.value = type;
  if (nameLabel) nameLabel.textContent = `${labels[type] || 'ชื่อรายการ'} *`;

  if (opt) {
    if (titleEl) titleEl.textContent = `✏️ แก้ไข${labels[type] || 'รายการ'}`;
    if (idInput) idInput.value = opt.id;
    if (nameInput) nameInput.value = opt.name || '';
  } else {
    if (titleEl) titleEl.textContent = `➕ เพิ่ม${labels[type] || 'รายการ'}ใหม่`;
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
  }

  modal.showModal();
}

// --------------------------------------------------------------------------
// Wire Master Data Sub-tabs and Form Submissions
// --------------------------------------------------------------------------
function setupMasterDataEvents() {
  // Sub-tabs click
  const subTabBtns = document.querySelectorAll('.master-sub-tab');
  subTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      switchMasterSubTab(btn.dataset.masterSub);
    });
  });

  // Customer Editor Form
  const custModal = document.getElementById('customerEditorModalDialog');
  const custForm = document.getElementById('customerEditorForm');
  const btnCloseCust = document.getElementById('btnCloseCustomerEditor');
  const btnCancelCust = document.getElementById('btnCancelCustomerEditor');

  btnCloseCust?.addEventListener('click', () => custModal?.close());
  btnCancelCust?.addEventListener('click', () => custModal?.close());

  custForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('customerEditId')?.value;
    const name = (document.getElementById('custEditName')?.value || '').trim();
    const name_en = (document.getElementById('custEditNameEn')?.value || '').trim();
    const tax_id = (document.getElementById('custEditTaxId')?.value || '').trim();
    const branch = (document.getElementById('custEditBranch')?.value || 'สำนักงานใหญ่').trim();
    const address = (document.getElementById('custEditAddress')?.value || '').trim();
    const contact_name = (document.getElementById('custEditContact')?.value || '').trim();
    const phone = (document.getElementById('custEditPhone')?.value || '').trim();
    const email = (document.getElementById('custEditEmail')?.value || '').trim();

    if (!name) {
      showToast('⚠️ กรุณาระบุชื่อลูกค้าหรือชื่อบริษัท');
      return;
    }

    const payload = { name, name_en, tax_id, branch, address, contact_name, phone, email };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/master/customers/${id}` : '/api/master/customers';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกข้อมูลลูกค้าไม่สำเร็จ');

      showToast(`✅ ${data.message || 'บันทึกเรียบร้อยแล้ว'}`);
      custModal?.close();
      await updateMasterBadgeCounts();
      if (currentMasterSubTab === 'customers') {
        fetchAndRenderCustomers(document.getElementById('masterCustomerTableContainer'));
      }
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  });

  // Catalog Editor Form
  const catModal = document.getElementById('catalogEditorModalDialog');
  const catForm = document.getElementById('catalogEditorForm');
  const btnCloseCat = document.getElementById('btnCloseCatalogEditor');
  const btnCancelCat = document.getElementById('btnCancelCatalogEditor');

  btnCloseCat?.addEventListener('click', () => catModal?.close());
  btnCancelCat?.addEventListener('click', () => catModal?.close());

  catForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('catalogEditId')?.value;
    const brand = (document.getElementById('catalogEditBrand')?.value || '').trim();
    const model = (document.getElementById('catalogEditModel')?.value || '').trim();
    const category = (document.getElementById('catalogEditCategory')?.value || 'Mobile Computer').trim();
    const default_specs = (document.getElementById('catalogEditSpecs')?.value || '').trim();
    const accStr = (document.getElementById('catalogEditAccessories')?.value || '').trim();
    const default_accessories = accStr ? accStr.split(',').map(s => s.trim()).filter(Boolean) : [];

    if (!model) {
      showToast('⚠️ กรุณาระบุชื่อรุ่นสินค้า (Model)');
      return;
    }
    if (!brand) {
      showToast('⚠️ กรุณาระบุยี่ห้อสินค้า (Brand)');
      return;
    }

    const payload = { brand, model, category, default_specs, default_accessories };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/master/catalogs/${id}` : '/api/master/catalogs';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกแคตตาล็อกไม่สำเร็จ');

      showToast(`✅ ${data.message || 'บันทึกเรียบร้อยแล้ว'}`);
      catModal?.close();
      await updateMasterBadgeCounts();
      if (currentMasterSubTab === 'catalogs') {
        fetchAndRenderCatalogs(document.getElementById('masterCatalogTableContainer'));
      }
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  });

  // Option Editor Form
  const optModal = document.getElementById('optionEditorModalDialog');
  const optForm = document.getElementById('optionEditorForm');
  const btnCloseOpt = document.getElementById('btnCloseOptionEditor');
  const btnCancelOpt = document.getElementById('btnCancelOptionEditor');

  btnCloseOpt?.addEventListener('click', () => optModal?.close());
  btnCancelOpt?.addEventListener('click', () => optModal?.close());

  optForm?.addEventListener('submit', async e => {
    e.preventDefault();
    const id = document.getElementById('optionEditId')?.value;
    const type = document.getElementById('optionEditType')?.value;
    const name = (document.getElementById('optionEditName')?.value || '').trim();

    if (!name) {
      showToast('⚠️ กรุณาระบุชื่อรายการ');
      return;
    }

    const payload = { type, name };
    const method = id ? 'PUT' : 'POST';
    const url = id ? `/api/master/options/${id}` : '/api/master/options';

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');

      showToast(`✅ ${data.message || 'บันทึกเรียบร้อยแล้ว'}`);
      optModal?.close();
      await updateMasterBadgeCounts();
      fetchAndRenderOptions(document.getElementById('masterOptionCardsContainer'), type);
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  });
}

// Call on startup
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupMasterDataEvents);
} else {
  setupMasterDataEvents();
}

function setupSendEmailModal() {
  const modal = document.getElementById('sendEmailModalDialog');
  const btnOpen = document.getElementById('btnOpenSendEmailModal');
  const btnOpenMobile = document.getElementById('btnOpenSendEmailModalMobile');
  const btnClose = document.getElementById('btnCloseSendEmailModal');
  const btnCancel = document.getElementById('btnCancelSendEmail');
  const btnCopy = document.getElementById('btnCopyEmailBody');
  const btnLaunch = document.getElementById('btnLaunchMailClient');

  if (!modal) return;

  function openEmailModal() {
    const loan = state.loans.find(l => l.id === state.activePrintLoanId);
    if (!loan) {
      showAlert('ไม่พบข้อมูลเอกสารใบยืมที่ต้องการส่งอีเมล');
      return;
    }
    const c = state.companySettings || {};

    const subEl = document.getElementById('sendEmailModalSubtitle');
    if (subEl) {
      subEl.textContent = `${loan.id} • ${loan.customer_name || loan.borrower_name}${loan.customer_company ? ` (${loan.customer_company})` : ''}`;
    }

    const toInp = document.getElementById('emailToInput');
    if (toInp) toInp.value = loan.customer_email || '';

    // Resolve CC email to the creator of this specific loan
    function resolveLoanCreatorEmail(l) {
      if (!l) return '';
      // 1. Direct created_by email if it contains '@'
      if (l.created_by && l.created_by.includes('@')) {
        return l.created_by.trim();
      }

      const users = state.users || [];
      const searchTarget = (l.created_by || l.borrower_name || '').trim();
      if (searchTarget) {
        // Strip suffixes like '(Sales)', '(Admin)', etc.
        const cleanName = searchTarget.replace(/\s*\([^)]*\)/g, '').trim().toLowerCase();

        // Exact match with user name
        const exact = users.find(u => (u.name || '').trim().toLowerCase() === cleanName);
        if (exact && exact.email) return exact.email.trim();

        // Substring / partial match with user name or email
        const partial = users.find(u => {
          const uName = (u.name || '').trim().toLowerCase();
          return uName && (cleanName.includes(uName) || uName.includes(cleanName));
        });
        if (partial && partial.email) return partial.email.trim();
      }

      // 2. Current user if name matches borrower_name
      if (state.currentUser && state.currentUser.email) {
        const curName = (state.currentUser.name || '').trim().toLowerCase();
        const bName = (l.borrower_name || '').toLowerCase();
        if (curName && bName.includes(curName)) {
          return state.currentUser.email.trim();
        }
      }

      // 3. Fallback: current logged in user
      if (state.currentUser && state.currentUser.email) {
        return state.currentUser.email.trim();
      }

      // 4. Fallback to company email
      return c.company_email || '';
    }

    const creatorEmail = resolveLoanCreatorEmail(loan);
    const ccInp = document.getElementById('emailCcInput');
    if (ccInp) ccInp.value = creatorEmail;

    const ccLabel = document.getElementById('emailCcLabel');
    if (ccLabel) {
      const creatorName = (loan.created_by && !loan.created_by.includes('@') ? loan.created_by : loan.borrower_name || '').replace(/\s*\([^)]*\)/g, '').trim();
      ccLabel.textContent = creatorName ? `สำเนา (CC) • ${creatorName}` : 'สำเนา (CC) • ผู้สร้างใบยืม';
    }

    const subjInp = document.getElementById('emailSubjectInput');
    if (subjInp) {
      subjInp.value = `[ใบยืมอุปกรณ์ ${loan.purpose || 'DEMO'}] ${loan.id} - ${loan.customer_name || loan.borrower_name} (${c.company_name || 'Active 5'})`;
    }

    const bodyArea = document.getElementById('emailBodyTextarea');
    if (bodyArea) {
      bodyArea.value = generateLoanEmailText(loan, c);
    }

    const attachNameEl = document.getElementById('emailAttachmentFileName');
    if (attachNameEl) attachNameEl.textContent = `${loan.id}.pdf`;

    const previewPdfBtn = document.getElementById('btnPreviewPdfDownload');
    if (previewPdfBtn) {
      previewPdfBtn.href = `/api/loans/${encodeURIComponent(loan.id)}/pdf`;
    }

    // Set Dynamic Direct Send button text with active provider
    const hasApiKey = Boolean((c.email_api_key || '').trim());
    const hasSmtp = Boolean((c.smtp_user || '').trim() && (c.smtp_pass || '').trim());
    const activeProvider = c.email_provider || (hasApiKey ? (c.email_api_key.startsWith('SG.') ? 'sendgrid' : 'resend') : (hasSmtp ? 'smtp' : 'resend'));
    const btnDirectSendText = document.getElementById('btnDirectSendEmailText');
    if (btnDirectSendText) {
      const pLabel = activeProvider === 'resend' ? 'Resend' : activeProvider === 'sendgrid' ? 'SendGrid' : 'Gmail';
      btnDirectSendText.textContent = 'ส่ง Email';
      btnDirectSend?.setAttribute('title', `ส่ง Email ผ่าน ${pLabel} (แนบ PDF อัตโนมัติ)`);
    }

    const emailStatusBox = document.getElementById('emailSendStatusBox');
    if (emailStatusBox) {
      emailStatusBox.className = 'email-status-banner hidden';
      emailStatusBox.textContent = '';
    }

    modal.showModal();
    if (toInp && !toInp.value && !isTouchOrMobileDevice()) {
      setTimeout(() => toInp.focus(), 80);
    }
  }

  btnOpen?.addEventListener('click', openEmailModal);
  btnOpenMobile?.addEventListener('click', openEmailModal);

  const closeModal = (e) => smoothCloseDialog(modal, e?.currentTarget);
  btnClose?.addEventListener('click', closeModal);
  btnCancel?.addEventListener('click', closeModal);

  // Link to Open SMTP Settings in Company Modal (Switches directly to Email tab)
  const btnOpenSmtpSettings = document.getElementById('btnOpenSmtpSettingsFromModal');
  btnOpenSmtpSettings?.addEventListener('click', () => {
    modal.close();
    if (typeof window.openCompanySettingsModal === 'function') {
      window.openCompanySettingsModal('email');
    } else {
      document.getElementById('btnOpenCompanySettings')?.click();
    }
  });

  // Direct Send Email with PDF Attachment
  const btnDirectSend = document.getElementById('btnDirectSendEmail');
  const btnDirectSendText = document.getElementById('btnDirectSendEmailText');
  const emailStatusBox = document.getElementById('emailSendStatusBox');

  btnDirectSend?.addEventListener('click', async () => {
    const loanId = state.activePrintLoanId;
    const to = (document.getElementById('emailToInput')?.value || '').trim();
    const cc = (document.getElementById('emailCcInput')?.value || '').trim();
    const subject = (document.getElementById('emailSubjectInput')?.value || '').trim();
    const body = (document.getElementById('emailBodyTextarea')?.value || '').trim();

    if (!to) {
      if (emailStatusBox) {
        emailStatusBox.className = 'email-status-banner error';
        emailStatusBox.innerHTML = '⚠️ กรุณาระบุอีเมลลูกค้าผู้รับ (To)';
        emailStatusBox.classList.remove('hidden');
        emailStatusBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      showToast('⚠️ กรุณาระบุอีเมลลูกค้าผู้รับ');
      document.getElementById('emailToInput')?.focus();
      return;
    }

    const c = state.companySettings || {};
    const activeProvider = c.email_provider || ((c.email_api_key || '').startsWith('SG.') ? 'sendgrid' : 'resend');
    const pLabel = activeProvider === 'resend' ? 'Resend API' : activeProvider === 'sendgrid' ? 'SendGrid API' : 'Gmail SMTP';

    try {
      btnDirectSend.disabled = true;
      if (btnDirectSendText) btnDirectSendText.textContent = 'กำลังส่ง...';
      if (emailStatusBox) {
        emailStatusBox.className = 'email-status-banner loading';
        emailStatusBox.innerHTML = `<span class="status-spinner"></span> กำลังสร้างเอกสาร PDF และส่งออกผ่าน ${pLabel}...`;
        emailStatusBox.classList.remove('hidden');
        emailStatusBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }

      const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/send-email-direct`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, cc, subject, body })
      });
      const data = await res.json();

      if (data.success) {
        if (data.state) {
          state.loans = data.state.loans;
          state.assets = data.state.assets;
        }
        if (emailStatusBox) {
          emailStatusBox.className = 'email-status-banner success';
          emailStatusBox.innerHTML = `✅ ${data.message || 'ส่งอีเมลพร้อมแนบ PDF สำเร็จเรียบร้อย'}`;
          emailStatusBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        showToast(`✉️ ส่งอีเมลพร้อมแนบ PDF ให้ ${to} เรียบร้อยแล้ว`);
        setTimeout(() => {
          modal.close();
          if (emailStatusBox) emailStatusBox.classList.add('hidden');
        }, 1800);
      } else {
        throw new Error(data.error || 'ส่งอีเมลไม่สำเร็จ');
      }
    } catch (err) {
      if (emailStatusBox) {
        emailStatusBox.className = 'email-status-banner error';
        const isConfigErr = err.message.includes('ตั้งค่า') || err.message.includes('API Key') || err.message.includes('SMTP');
        emailStatusBox.innerHTML = `❌ ${err.message}${isConfigErr ? ' <button type="button" class="btn btn-xs btn-outline" style="margin-left:6px;padding:2px 8px;font-size:11px;background:#fff;" onclick="document.getElementById(\'btnOpenSmtpSettingsFromModal\')?.click()">⚙️ ไปตั้งค่า</button>' : ''}`;
        emailStatusBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
      showToast(`❌ ${err.message}`);
    } finally {
      btnDirectSend.disabled = false;
      if (btnDirectSendText) {
        btnDirectSendText.textContent = 'ส่ง Email';
      }
    }
  });

  btnCopy?.addEventListener('click', async () => {
    const bodyArea = document.getElementById('emailBodyTextarea');
    if (!bodyArea) return;
    try {
      await navigator.clipboard.writeText(bodyArea.value);
      showToast('📋 คัดลอกข้อความอีเมลเรียบร้อยแล้ว');
    } catch (_) {
      bodyArea.select();
      document.execCommand('copy');
      showToast('📋 คัดลอกข้อความเรียบร้อยแล้ว');
    }
  });

  async function persistCustomerEmail(email) {
    if (!state.activePrintLoanId || !email) return;
    try {
      await fetch(`/api/loans/${encodeURIComponent(state.activePrintLoanId)}/customer-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const loan = state.loans.find(l => l.id === state.activePrintLoanId);
      if (loan) loan.customer_email = email;
    } catch (_) {}
  }

  btnLaunch?.addEventListener('click', async () => {
    const to = (document.getElementById('emailToInput')?.value || '').trim();
    const cc = (document.getElementById('emailCcInput')?.value || '').trim();
    const subject = (document.getElementById('emailSubjectInput')?.value || '').trim();
    const body = (document.getElementById('emailBodyTextarea')?.value || '').trim();

    if (!to) {
      showAlert('กรุณาระบุอีเมลลูกค้าผู้รับ');
      document.getElementById('emailToInput')?.focus();
      return;
    }

    await persistCustomerEmail(to);

    const mailtoParams = new URLSearchParams();
    if (cc) mailtoParams.append('cc', cc);
    if (subject) mailtoParams.append('subject', subject);
    if (body) mailtoParams.append('body', body);

    const mailtoUri = `mailto:${encodeURIComponent(to)}?${mailtoParams.toString().replace(/\+/g, '%20')}`;
    window.location.href = mailtoUri;
    modal.close();
    showToast('✉️ เปิดโปรแกรมส่งอีเมลเรียบร้อยแล้ว');
  });
}

// ============================================================================
// DELIVERY / PROOF OF DELIVERY (ส่งมอบสินค้าหน้างาน - FAB & Modal)
// ============================================================================
let currentDeliveryPhotos = [];

function setupDeliveryModal() {
  const dialog = document.getElementById('deliveryModalDialog');
  const form = document.getElementById('deliveryModalForm');
  const fabBtn = document.getElementById('btnFabDeliverLoan');
  const snapBtn = document.getElementById('btnSnapDeliveryCamera');
  const pickBtn = document.getElementById('btnPickDeliveryFile');
  const camInput = document.getElementById('deliveryCameraInput');
  const fileInput = document.getElementById('deliveryFileInput');
  const refreshGpsBtn = document.getElementById('btnRefreshDeliveryGps');

  // FAB button in printDialog
  fabBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    const loanId = fabBtn.getAttribute('data-loan-id') || state.activePrintLoanId;
    if (loanId) {
      openDeliveryModal(loanId);
    }
  });

  // Camera snap
  snapBtn?.addEventListener('click', () => {
    camInput?.click();
  });

  camInput?.addEventListener('change', async (e) => {
    await handleDeliveryPhotoFiles(e.target.files);
    camInput.value = '';
  });

  // File pick
  pickBtn?.addEventListener('click', () => {
    fileInput?.click();
  });

  fileInput?.addEventListener('change', async (e) => {
    await handleDeliveryPhotoFiles(e.target.files);
    fileInput.value = '';
  });

  // Remove photo via event delegation on grid
  const photoGrid = document.getElementById('deliveryPhotoGrid');
  photoGrid?.addEventListener('click', (e) => {
    const rmBtn = e.target.closest('[data-rm-photo]');
    if (rmBtn) {
      const idx = parseInt(rmBtn.getAttribute('data-rm-photo'), 10);
      if (!isNaN(idx) && idx >= 0 && idx < currentDeliveryPhotos.length) {
        currentDeliveryPhotos.splice(idx, 1);
        renderDeliveryPhotoGrid();
      }
    }
  });

  // Refresh GPS
  refreshGpsBtn?.addEventListener('click', (e) => {
    e.preventDefault();
    captureDeliveryGps();
  });

  // Remember Delivery Sender in localStorage on this device
  const senderInput = document.getElementById('deliverySender');
  const onSenderChange = (e) => {
    const val = (e.target.value || '').trim();
    if (val) {
      try {
        localStorage.setItem('activeasset_delivery_sender', val);
      } catch (_) {}
    }
  };
  senderInput?.addEventListener('input', onSenderChange);
  senderInput?.addEventListener('change', onSenderChange);

  // Submit form
  form?.addEventListener('submit', submitDeliveryForm);
}

function openDeliveryModal(loanId) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) {
    showToast('⚠️ ไม่พบข้อมูลเอกสาร');
    return;
  }

  const dialog = document.getElementById('deliveryModalDialog');
  if (!dialog) return;

  const syncInp = (inp) => {
    if (!inp) return;
    const btn = inp.closest('.input-clearable-wrap')?.querySelector('.btn-input-clear');
    if (btn) btn.classList.toggle('hidden', !(inp.value && String(inp.value).trim().length > 0));
  };

  // Set loan ID
  const loanIdEl = document.getElementById('deliveryLoanId');
  if (loanIdEl) loanIdEl.value = loan.id;

  const badgeEl = document.getElementById('deliveryLoanBadge');
  if (badgeEl) badgeEl.textContent = loan.id;

  const subtitleEl = document.getElementById('deliveryCustomerSubtitle');
  if (subtitleEl) {
    const cust = loan.customer_company ? `${loan.customer_company} (${loan.customer_name})` : (loan.customer_name || 'ลูกค้า');
    subtitleEl.textContent = `ลูกค้า: ${cust} • วัตถุประสงค์: ${loan.purpose || 'Demo'}`;
  }

  // Prepopulate Sender (ผู้ส่ง):
  // 1. loan.delivery_sender (if previously recorded on loan)
  // 2. localStorage saved sender on this machine (activeasset_delivery_sender)
  // 3. loan.sales_rep
  // 4. Default 'พนักงานส่งมอบ'
  let savedSender = '';
  try {
    savedSender = (localStorage.getItem('activeasset_delivery_sender') || '').trim();
  } catch (_) {}

  const senderInput = document.getElementById('deliverySender');
  if (senderInput) {
    senderInput.value = loan.delivery_sender || state.currentUser?.name || savedSender || loan.sales_rep || 'พนักงานส่งมอบ';
    syncInp(senderInput);
  }

  // Prepopulate Receiver (ผู้รับ): default to loan.delivery_receiver or loan.customer_name
  const receiverInput = document.getElementById('deliveryReceiver');
  if (receiverInput) {
    receiverInput.value = loan.delivery_receiver || loan.customer_name || '';
    syncInp(receiverInput);
  }

  // Delivery Note
  const noteInput = document.getElementById('deliveryNote');
  if (noteInput) {
    noteInput.value = loan.delivery_note || '';
    syncInp(noteInput);
  }

  // Photos
  currentDeliveryPhotos = Array.isArray(loan.delivery_photos) ? [...loan.delivery_photos] : [];
  renderDeliveryPhotoGrid();

  // Timestamp
  updateDeliveryTimestamp();

  // GPS
  captureDeliveryGps();

  dialog.showModal();
}

function renderDeliveryPhotoGrid() {
  const grid = document.getElementById('deliveryPhotoGrid');
  const countBadge = document.getElementById('deliveryPhotoCountBadge');
  if (countBadge) {
    countBadge.textContent = `${currentDeliveryPhotos.length} รูป`;
  }
  if (!grid) return;

  if (currentDeliveryPhotos.length === 0) {
    grid.innerHTML = `<div class="text-muted text-xs" style="grid-column: 1 / -1; padding: 4px 0;">ยังไม่มีรูปถ่ายหลักฐานส่งงาน (กดถ่ายรูปหรือเลือกรูปด้านบน)</div>`;
    return;
  }

  grid.innerHTML = currentDeliveryPhotos.map((src, idx) => `
    <div class="delivery-photo-thumb" data-photo-idx="${idx}">
      <img src="${escapeHtml(src)}" alt="หลักฐานส่งงาน #${idx + 1}" />
      <button type="button" class="btn-del-photo-rm" data-rm-photo="${idx}" title="ลบรูปนี้">✕</button>
    </div>
  `).join('');
}

async function handleDeliveryPhotoFiles(files) {
  if (!files || files.length === 0) return;
  showToast(`⏳ กำลังเตรียมรูปถ่าย ${files.length} รูป...`);
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const compressed = await compressImageFile(file, 1200, 0.85);
      currentDeliveryPhotos.push(compressed);
    } catch (err) {
      console.warn('Failed to compress image:', err);
    }
  }
  renderDeliveryPhotoGrid();
}

function updateDeliveryTimestamp() {
  const now = new Date();
  const isoStr = now.toISOString();

  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = now.getDate();
  const month = thaiMonths[now.getMonth()];
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  const displayStr = `${day} ${month} ${year}, ${hours}:${mins}:${secs} น.`;

  const dispEl = document.getElementById('deliveryTimestampDisplay');
  if (dispEl) dispEl.textContent = displayStr;
  const valEl = document.getElementById('deliveryTimestampVal');
  if (valEl) valEl.value = isoStr;
}

function captureDeliveryGps() {
  const dispEl = document.getElementById('deliveryGpsDisplay');
  const valEl = document.getElementById('deliveryGpsVal');
  if (dispEl) dispEl.innerHTML = `<span class="text-muted">กำลังค้นหาพิกัด GPS...</span>`;
  if (valEl) valEl.value = '';

  if (!navigator.geolocation) {
    if (dispEl) dispEl.innerHTML = `<span class="text-muted">อุปกรณ์ไม่รองรับ GPS</span>`;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const acc = Math.round(pos.coords.accuracy || 0);
      const coordsStr = `${lat}, ${lng}`;
      if (valEl) valEl.value = coordsStr;
      if (dispEl) {
        dispEl.innerHTML = `<strong>${coordsStr}</strong> <span class="text-xs text-muted">(±${acc}m)</span> • <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">ดูแผนที่ ↗</a>`;
      }
    },
    err => {
      console.warn('Geolocation error:', err);
      let errMsg = 'ไม่สามารถระบุพิกัดได้ (ปิดการเข้าถึง GPS)';
      if (err.code === 1) errMsg = 'ไม่อนุญาตให้เข้าถึงตำแหน่งที่ตั้ง';
      else if (err.code === 2) errMsg = 'ไม่พบสัญญาณพิกัด GPS';
      else if (err.code === 3) errMsg = 'หมดเวลาค้นหาพิกัด GPS';
      if (dispEl) dispEl.innerHTML = `<span class="text-muted">${errMsg}</span>`;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

async function submitDeliveryForm(e) {
  e.preventDefault();
  const loanId = document.getElementById('deliveryLoanId')?.value;
  if (!loanId) return;

  const sender = (document.getElementById('deliverySender')?.value || '').trim();
  const receiver = (document.getElementById('deliveryReceiver')?.value || '').trim();
  const gps = (document.getElementById('deliveryGpsVal')?.value || '').trim();
  const timestamp = (document.getElementById('deliveryTimestampVal')?.value || '').trim() || new Date().toISOString();
  const note = (document.getElementById('deliveryNote')?.value || '').trim();

  if (!sender) {
    showToast('⚠️ กรุณาระบุชื่อผู้ส่งสินค้า');
    document.getElementById('deliverySender')?.focus();
    return;
  }
  try {
    localStorage.setItem('activeasset_delivery_sender', sender);
  } catch (_) {}
  if (!receiver) {
    showToast('⚠️ กรุณาระบุชื่อผู้รับสินค้า');
    document.getElementById('deliveryReceiver')?.focus();
    return;
  }

  const submitBtn = document.getElementById('btnSubmitDelivery');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = '⏳ กำลังบันทึกการส่งมอบ...';
  }

  try {
    const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/deliver`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender,
        receiver,
        photos: currentDeliveryPhotos,
        gps,
        timestamp,
        note
      })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'บันทึกการส่งมอบไม่สำเร็จ');

    applyServerState(data);

    // Close delivery dialog
    const delDialog = document.getElementById('deliveryModalDialog');
    if (delDialog?.open) delDialog.close();

    // Re-render Gate pass if printDialog is open
    if (document.getElementById('printDialog')?.open && state.activePrintLoanId === loanId) {
      renderGatePassHtml();
    }

    showToast(`✅ บันทึกส่งมอบใบยืม ${loanId} เรียบร้อยแล้ว (สถานะ: กำลังยืม)`);
  } catch (err) {
    showToast('⚠️ ' + err.message);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = '🚚 ยืนยันการส่งมอบสินค้า';
    }
  }
}

// ============================================================================
// IMAGE COMPRESSION & SIGNATURE CANVAS
// ============================================================================
function compressImageFile(file, maxWidth = 1100, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let w = img.width;
        let h = img.height;
        if (w > maxWidth) {
          h = Math.round((h * maxWidth) / w);
          w = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function setupSignatureCanvas() {
  const canvas = document.getElementById('dispatchSignatureCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.strokeStyle = '#0f172a';
  ctx.lineWidth = 2.2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  let drawing = false;
  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  }
  function start(e) {
    drawing = true;
    state.dispatchSignatureDirty = true;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  }
  function move(e) {
    if (!drawing) return;
    e.preventDefault();
    const p = getPos(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  }
  function stop() {
    drawing = false;
  }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  window.addEventListener('touchend', stop);
}

function clearSignatureCanvas() {
  const canvas = document.getElementById('dispatchSignatureCanvas');
  if (!canvas) return;
  canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  state.dispatchSignatureDirty = false;
}

// ============================================================================
// SUPPLIER & SALES STOCK RETURN (คืน Supplier, คลังขาย)
// ============================================================================
let currentSupplierReturnPhotos = [];
let currentSupplierReturnSignature = '';
let currentSaleActions = {};

function setupSupplierSaleReturnModal() {
  const dialog = document.getElementById('supplierSaleReturnDialog');
  const btnSubmit = document.getElementById('btnSubmitSupSaleReturn');
  const btnRevert = document.getElementById('btnRevertSupSaleReturn');

  btnRevert?.addEventListener('click', async () => {
    if (!state.activeSupplierSaleLoan) return;
    const loanId = state.activeSupplierSaleLoan.id;
    if (!confirm(`ต้องการย้อนสถานะใบยืม "${loanId}" กลับเป็นกำลังยืมหรือไม่?`)) return;
    try {
      const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/revert-qc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถย้อนสถานะได้');
      applyServerState(data);
      dialog?.close();
      showToast(`↩️ ย้อนสถานะใบยืม "${loanId}" เรียบร้อย`);
    } catch (err) {
      showToast(`❌ ${err.message}`);
    }
  });

  btnSubmit?.addEventListener('click', async () => {
    if (!state.activeSupplierSaleLoan) return;
    const loan = state.activeSupplierSaleLoan;
    const loanId = loan.id;

    const senderVal = (document.getElementById('supRetSender')?.value || '').trim();
    const receiverVal = (document.getElementById('supRetReceiver')?.value || '').trim();
    const timestampVal = (document.getElementById('supRetTimestamp')?.value || '').trim();
    const noteVal = (document.getElementById('supRetNote')?.value || '').trim();
    const gpsVal = (document.getElementById('supGpsVal')?.value || '').trim();

    if (!senderVal) {
      showToast('⚠️ กรุณาระบุชื่อผู้ส่งสินค้า');
      document.getElementById('supRetSender')?.focus();
      return;
    }
    if (!receiverVal) {
      showToast('⚠️ กรุณาระบุชื่อผู้รับสินค้า');
      document.getElementById('supRetReceiver')?.focus();
      return;
    }

    btnSubmit.disabled = true;
    btnSubmit.innerHTML = '<span>กำลังบันทึกและออกใบคืน...</span>';

    try {
      const payload = {
        supplier_return_receiver: receiverVal,
        supplier_return_sender: senderVal,
        supplier_return_timestamp: timestampVal || new Date().toISOString(),
        supplier_return_note: noteVal,
        supplier_return_gps: gpsVal,
        supplier_return_photos: currentSupplierReturnPhotos,
        supplier_return_signature: currentSupplierReturnSignature,
        sale_return_sender: senderVal,
        sale_return_timestamp: timestampVal || new Date().toISOString(),
        sale_return_note: noteVal,
        sale_actions: currentSaleActions
      };

      const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/complete-supplier-sale-return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกการส่งคืนไม่สำเร็จ');

      applyServerState(data);
      dialog?.close();
      showToast(`✅ บันทึกส่งคืนและออกใบคืน (${loanId}) เรียบร้อยแล้ว`);

      // Immediately open Return Slip modal
      openReturnSlipModal(loanId);
    } catch (err) {
      showToast(`❌ ${err.message}`);
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.innerHTML = '<span>📄 บันทึกและออกใบคืน</span>';
    }
  });

  // Direct print button in Return Slip dialog
  const btnPrintReturnSlipDirect = document.getElementById('btnPrintReturnSlipDirect');
  btnPrintReturnSlipDirect?.addEventListener('click', () => {
    window.print();
  });
}

async function handleSupPhotoFiles(files) {
  if (!files || !files.length) return;
  showToast(`⏳ กำลังเตรียมรูปถ่าย ${files.length} รูป...`);
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue;
    try {
      const compressed = await compressImageFile(file, 1200, 0.85);
      currentSupplierReturnPhotos.push(compressed);
    } catch (e) {
      console.warn('Failed to compress supplier return photo:', e);
    }
  }
  renderSupPhotoGrid();
}

function renderSupPhotoGrid() {
  const grid = document.getElementById('supPhotoGrid');
  const countBadge = document.getElementById('supPhotoCountBadge');
  if (countBadge) countBadge.textContent = `${currentSupplierReturnPhotos.length} รูป`;
  if (!grid) return;
  if (currentSupplierReturnPhotos.length === 0) {
    grid.innerHTML = `<div class="text-muted text-xs" style="grid-column: 1 / -1; padding: 4px 0;">ยังไม่มีรูปถ่ายหลักฐานส่งงาน (กดถ่ายรูปหรือเลือกรูปด้านบน)</div>`;
    return;
  }
  grid.innerHTML = currentSupplierReturnPhotos.map((src, idx) => `
    <div class="delivery-photo-thumb" data-photo-idx="${idx}">
      <img src="${escapeHtml(src)}" alt="หลักฐานส่งงาน #${idx + 1}" />
      <button type="button" class="btn-del-photo-rm" data-rm-sup-photo="${idx}" title="ลบรูปนี้">✕</button>
    </div>
  `).join('');
}

function updateSupTimestamp() {
  const now = new Date();
  const isoStr = now.toISOString();

  const thaiMonths = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const day = now.getDate();
  const month = thaiMonths[now.getMonth()];
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const mins = String(now.getMinutes()).padStart(2, '0');
  const secs = String(now.getSeconds()).padStart(2, '0');
  const displayStr = `${day} ${month} ${year}, ${hours}:${mins}:${secs} น.`;

  const dispEl = document.getElementById('supTimestampDisplay');
  if (dispEl) dispEl.textContent = displayStr;
  const valEl = document.getElementById('supRetTimestamp');
  if (valEl) valEl.value = isoStr;
}

function captureSupGps() {
  const dispEl = document.getElementById('supGpsDisplay');
  const valEl = document.getElementById('supGpsVal');
  if (dispEl) dispEl.innerHTML = `<span class="text-muted">กำลังค้นหาพิกัด GPS...</span>`;
  if (valEl) valEl.value = '';

  if (!navigator.geolocation) {
    if (dispEl) dispEl.innerHTML = `<span class="text-muted">อุปกรณ์ไม่รองรับ GPS</span>`;
    return;
  }

  navigator.geolocation.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lng = pos.coords.longitude.toFixed(6);
      const acc = Math.round(pos.coords.accuracy || 0);
      const coordsStr = `${lat}, ${lng}`;
      if (valEl) valEl.value = coordsStr;
      if (dispEl) {
        dispEl.innerHTML = `<strong>${coordsStr}</strong> <span class="text-xs text-muted">(±${acc}m)</span> • <a href="https://www.google.com/maps?q=${lat},${lng}" target="_blank" rel="noopener">ดูแผนที่ ↗</a>`;
      }
    },
    err => {
      console.warn('Geolocation error:', err);
      let errMsg = 'ไม่สามารถระบุพิกัดได้ (ปิดการเข้าถึง GPS)';
      if (err.code === 1) errMsg = 'ไม่อนุญาตให้เข้าถึงตำแหน่งที่ตั้ง';
      else if (err.code === 2) errMsg = 'ไม่พบสัญญาณพิกัด GPS';
      else if (err.code === 3) errMsg = 'หมดเวลาค้นหาพิกัด GPS';
      if (dispEl) dispEl.innerHTML = `<span class="text-muted">${errMsg}</span>`;
    },
    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
  );
}

function attachSupplierSaleModalEvents() {
  const contentWrap = document.getElementById('supSaleContentWrap');
  if (!contentWrap) return;

  // 1. Action switcher for sales stock
  contentWrap.querySelectorAll('.sale-action-option').forEach(opt => {
    opt.addEventListener('click', () => {
      const switcher = opt.closest('.sale-action-switcher');
      const tagId = switcher?.getAttribute('data-sale-tag');
      const val = opt.getAttribute('data-action-val');
      if (tagId && val) {
        currentSaleActions[tagId] = val;
        switcher.querySelectorAll('.sale-action-option').forEach(o => {
          o.classList.remove('active-sale', 'active-demo');
        });
        if (val === 'return_to_sale') opt.classList.add('active-sale');
        if (val === 'convert_to_demo') opt.classList.add('active-demo');
      }
    });
  });

  // 2. Quick clear buttons
  contentWrap.querySelectorAll('.btn-input-clear').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-clear-target');
      const inp = document.getElementById(targetId);
      if (inp) {
        inp.value = '';
        btn.classList.add('hidden');
        inp.focus();
      }
    });
  });

  // 3. Clear button toggle on typing
  contentWrap.querySelectorAll('input').forEach(inp => {
    inp.addEventListener('input', () => {
      const btn = inp.closest('.input-clearable-wrap')?.querySelector('.btn-input-clear');
      if (btn) btn.classList.toggle('hidden', !(inp.value && inp.value.trim().length > 0));
    });
  });

  // 4. Camera snap and file pick for photos
  const snapBtn = document.getElementById('btnSnapSupCamera');
  const pickBtn = document.getElementById('btnPickSupFile');
  const camInput = document.getElementById('supCameraInput');
  const fileInput = document.getElementById('supFileInput');

  snapBtn?.addEventListener('click', () => camInput?.click());
  camInput?.addEventListener('change', async (e) => {
    await handleSupPhotoFiles(e.target.files);
    camInput.value = '';
  });

  pickBtn?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async (e) => {
    await handleSupPhotoFiles(e.target.files);
    fileInput.value = '';
  });

  // 5. Remove photo
  const grid = document.getElementById('supPhotoGrid');
  grid?.addEventListener('click', (e) => {
    const rmBtn = e.target.closest('[data-rm-sup-photo]');
    if (rmBtn) {
      const idx = Number(rmBtn.getAttribute('data-rm-sup-photo'));
      if (!isNaN(idx) && idx >= 0 && idx < currentSupplierReturnPhotos.length) {
        currentSupplierReturnPhotos.splice(idx, 1);
        renderSupPhotoGrid();
      }
    }
  });

  // 6. Refresh GPS button
  const refreshGpsBtn = document.getElementById('btnRefreshSupGps');
  refreshGpsBtn?.addEventListener('click', () => {
    captureSupGps();
  });

  // 7. Signature events for Receiver (เซ็นรับของคืน)
  const btnOpenSig = document.getElementById('btnOpenSupRetSignature');
  const btnEditSig = document.getElementById('btnEditSupSig');
  const btnClearSig = document.getElementById('btnClearSupSig');

  const triggerSigModal = () => {
    const receiverName = (document.getElementById('supRetReceiver')?.value || '').trim() || 'ตัวแทน Supplier / คลัง';
    openDigitalSigModalForRole('return_receiver', {
      title: 'เซ็นรับของคืน',
      subtitle: `ผู้รับคืนสินค้า • ${receiverName}`,
      onSave: (sigData) => {
        currentSupplierReturnSignature = sigData;
        const previewEl = document.getElementById('supSigImgPreview');
        if (previewEl) previewEl.src = sigData;
        document.getElementById('supSigEmptyWrap')?.classList.add('hidden');
        document.getElementById('supSigPreviewWrap')?.classList.remove('hidden');
      }
    });
  };

  btnOpenSig?.addEventListener('click', triggerSigModal);
  btnEditSig?.addEventListener('click', triggerSigModal);

  btnClearSig?.addEventListener('click', () => {
    currentSupplierReturnSignature = '';
    const previewEl = document.getElementById('supSigImgPreview');
    if (previewEl) previewEl.src = '';
    document.getElementById('supSigPreviewWrap')?.classList.add('hidden');
    document.getElementById('supSigEmptyWrap')?.classList.remove('hidden');
  });
}

function openSupplierSaleReturnModal(loanId) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) return;
  state.activeSupplierSaleLoan = loan;
  currentSupplierReturnPhotos = Array.isArray(loan.supplier_return_photos) ? [...loan.supplier_return_photos] : [];
  currentSupplierReturnSignature = loan.supplier_return_signature || loan.receiver_signature || '';
  currentSaleActions = { ...(loan.sale_return_action || {}) };

  const dialog = document.getElementById('supplierSaleReturnDialog');
  if (!dialog) return;

  const loanBadge = document.getElementById('supSaleLoanBadge');
  if (loanBadge) loanBadge.textContent = loan.id;
  const subEl = document.getElementById('supSaleCustomerSubtitle');
  if (subEl) {
    const cust = loan.customer_company ? `${loan.customer_company} (${loan.customer_name})` : (loan.customer_name || 'ลูกค้า');
    const purpose = loan.purpose ? ` • วัตถุประสงค์: ${loan.purpose}` : '';
    subEl.textContent = `ลูกค้า: ${cust}${purpose}`;
  }

  const hiddenId = document.getElementById('supSaleLoanId');
  if (hiddenId) hiddenId.value = loan.id;

  const items = loan.items || [];
  const supplierItems = items.filter(it => (it.source_snapshot || 'Demo') === 'Supplier');
  const saleItems = items.filter(it => (it.source_snapshot || 'Demo') === 'คลังขาย');

  // Pre-fill default actions for sale items
  saleItems.forEach(it => {
    if (!currentSaleActions[it.tag_id]) {
      currentSaleActions[it.tag_id] = 'return_to_sale';
    }
  });

  const contentWrap = document.getElementById('supSaleContentWrap');
  if (!contentWrap) return;

  const defaultUser = getLoggedInUserName() || loan.borrower_name || '';
  const senderVal = loan.supplier_return_sender || loan.sale_return_sender || defaultUser;
  const receiverVal = loan.supplier_return_receiver || '';
  const noteVal = loan.supplier_return_note || loan.sale_return_note || '';

  let html = '';

  // SECTION 1: SUPPLIER ITEMS (ถ้ามี)
  if (supplierItems.length > 0) {
    html += `
      <div class="return-section-block" style="margin-bottom:14px;">
        <div class="return-section-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div class="return-section-title-wrap" style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">🚚</span>
            <h4 class="return-section-title" style="margin:0; font-size:14px; font-weight:700; color:#1e293b;">1. รายการคืน Supplier</h4>
            <span class="badge" style="background:#e0e7ff; color:#4338ca; border:1px solid #c7d2fe; font-size:12px; padding:2px 8px; border-radius:999px;">
              ${supplierItems.length} เครื่อง
            </span>
          </div>
          <div class="return-flow-notice supplier-flow" style="padding:3px 8px; font-size:11.5px; border-radius:6px; background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe;">
            ⚡ ไม่ต้องผ่าน QC (ส่งคืน Supplier ภายนอก)
          </div>
        </div>

        <table class="return-items-table">
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">#</th>
              <th>แบรนด์ & รุ่น</th>
              <th>Serial Number (S/N)</th>
              <th>อุปกรณ์เสริม</th>
            </tr>
          </thead>
          <tbody>
            ${supplierItems.map((it, idx) => `
              <tr>
                <td style="text-align:center; color:#64748b; font-weight:600;">${idx + 1}</td>
                <td>
                  <strong style="color:#0f172a;">${escapeHtml(it.brand || '')}</strong>
                  <div style="color:#475569;">${escapeHtml(it.model || '')}</div>
                </td>
                <td>
                  <span class="return-sn-pill">${escapeHtml(it.serial_no || it.tag_id || '-')}</span>
                </td>
                <td style="color:#64748b; font-size:12px;">
                  ${Array.isArray(it.loan_accessories) && it.loan_accessories.length > 0 ? it.loan_accessories.join(', ') : 'ตัวเครื่องมาตรฐาน'}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // SECTION 2: SALE ITEMS (ถ้ามี)
  if (saleItems.length > 0) {
    html += `
      <div class="return-section-block" style="margin-bottom:14px;">
        <div class="return-section-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
          <div class="return-section-title-wrap" style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:18px;">🏢</span>
            <h4 class="return-section-title" style="margin:0; font-size:14px; font-weight:700; color:#1e293b;">2. รายการคืนคลังขาย</h4>
            <span class="badge" style="background:#fef3c7; color:#b45309; border:1px solid #fde68a; font-size:12px; padding:2px 8px; border-radius:999px;">
              ${saleItems.length} เครื่อง
            </span>
          </div>
          <div class="return-flow-notice" style="padding:3px 8px; font-size:11.5px; border-radius:6px; background:#f0fdf4; color:#15803d; border:1px solid #bbf7d0;">
            ✅ ผ่านการตรวจสภาพ QC เรียบร้อยแล้ว
          </div>
        </div>

        <table class="return-items-table">
          <thead>
            <tr>
              <th style="width:40px; text-align:center;">#</th>
              <th>แบรนด์ & รุ่น</th>
              <th>Serial Number (S/N)</th>
              <th style="min-width:240px;">การจัดการสต็อก (เลือกปลายทาง)</th>
            </tr>
          </thead>
          <tbody>
            ${saleItems.map((it, idx) => {
              const currentAction = currentSaleActions[it.tag_id] || 'return_to_sale';
              return `
                <tr>
                  <td style="text-align:center; color:#64748b; font-weight:600;">${idx + 1}</td>
                  <td>
                    <strong style="color:#0f172a;">${escapeHtml(it.brand || '')}</strong>
                    <div style="color:#475569;">${escapeHtml(it.model || '')}</div>
                  </td>
                  <td>
                    <span class="return-sn-pill">${escapeHtml(it.serial_no || it.tag_id || '-')}</span>
                  </td>
                  <td>
                    <div class="sale-action-switcher" data-sale-tag="${escapeHtml(it.tag_id)}">
                      <div class="sale-action-option ${currentAction === 'return_to_sale' ? 'active-sale' : ''}" data-action-val="return_to_sale">
                        <span>🏢 คืนคลังขายปกติ</span>
                      </div>
                      <div class="sale-action-option ${currentAction === 'convert_to_demo' ? 'active-demo' : ''}" data-action-val="convert_to_demo">
                        <span>📦 ตีเป็น Demo</span>
                      </div>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  // UNIFIED EXECUTION FORM (EXACTLY MATCHING DELIVERY MODAL / IMAGE 2)
  html += `
    <!-- Row 1: ผู้ส่ง & ผู้รับ -->
    <div class="form-grid grid-2-col">
      <div class="form-group">
        <label class="form-label" for="supRetSender">ผู้ส่งสินค้า <span class="required">*</span></label>
        <div class="input-clearable-wrap">
          <input type="text" id="supRetSender" class="form-control" placeholder="ชื่อ-นามสกุล ผู้ส่งสินค้า" value="${escapeHtml(senderVal)}" required autocomplete="off" />
          <button type="button" class="btn-input-clear ${senderVal ? '' : 'hidden'}" data-clear-target="supRetSender" title="ล้างค่า">✕</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label" for="supRetReceiver">ผู้รับสินค้า <span class="required">*</span></label>
        <div class="input-clearable-wrap">
          <input type="text" id="supRetReceiver" class="form-control" placeholder="ชื่อ-นามสกุล / ตำแหน่ง ผู้รับ" value="${escapeHtml(receiverVal)}" required autocomplete="off" />
          <button type="button" class="btn-input-clear ${receiverVal ? '' : 'hidden'}" data-clear-target="supRetReceiver" title="ล้างค่า">✕</button>
        </div>
      </div>
    </div>

    <!-- Row 1.5: ปุ่มเซ็นรับของคืน (Signature Widget) -->
    <div class="form-group" style="margin-bottom:14px;">
      <div id="supSigEmptyWrap" class="${currentSupplierReturnSignature ? 'hidden' : ''}">
        <button type="button" class="btn btn-outline" id="btnOpenSupRetSignature" style="display:flex; align-items:center; justify-content:center; gap:8px; width:100%; padding:10px 16px; border:1.5px dashed #93c5fd; background:#f0f7ff; color:#1d4ed8; font-weight:700; font-size:13px; border-radius:10px; cursor:pointer; transition:all 0.15s ease;">
          <span style="font-size:16px;">✍️</span>
          <span>เซ็นรับของคืน</span>
        </button>
      </div>

      <div id="supSigPreviewWrap" class="${currentSupplierReturnSignature ? '' : 'hidden'}" style="display:flex; align-items:center; justify-content:space-between; padding:8px 14px; background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px;">
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="display:flex; flex-direction:column; gap:2px;">
            <span style="font-size:11.5px; color:#15803d; font-weight:700; display:flex; align-items:center; gap:4px;">
              <span>✓</span> เซ็นรับของคืนแล้ว
            </span>
            <img id="supSigImgPreview" src="${escapeHtml(currentSupplierReturnSignature || '')}" alt="ลายเซ็นผู้รับคืน" style="height:44px; max-width:200px; object-fit:contain; background:#ffffff; border-radius:6px; padding:2px 8px; border:1px solid #e2e8f0;" />
          </div>
        </div>
        <div style="display:flex; gap:6px;">
          <button type="button" class="btn btn-sm btn-outline" id="btnEditSupSig" style="font-size:11.5px; padding:4px 10px; font-weight:600;">✎ เซ็นใหม่</button>
          <button type="button" class="btn btn-sm btn-outline" id="btnClearSupSig" style="font-size:11.5px; padding:4px 8px; color:#ef4444; border-color:#fecaca;" title="ลบลายเซ็น">✕</button>
        </div>
      </div>
    </div>

    <!-- Row 2: ถ่ายรูปส่งงาน / หลักฐานหน้างาน -->
    <div class="form-group">
      <div class="photo-upload-header">
        <label class="form-label mb-0">ถ่ายรูปส่งงาน / หลักฐานหน้างาน</label>
        <span class="photo-count-badge" id="supPhotoCountBadge">${currentSupplierReturnPhotos.length} รูป</span>
      </div>
      <div class="delivery-photo-actions">
        <input type="file" id="supCameraInput" accept="image/*" capture="environment" class="hidden" />
        <input type="file" id="supFileInput" accept="image/*" multiple class="hidden" />
        <button type="button" class="btn btn-outline btn-photo-snap" id="btnSnapSupCamera">
          📷 ถ่ายรูปด้วยกล้อง
        </button>
        <button type="button" class="btn btn-outline btn-photo-pick" id="btnPickSupFile">
          📁 เลือกจากคลังรูปภาพ
        </button>
      </div>
      <!-- Grid of uploaded photo previews -->
      <div id="supPhotoGrid" class="delivery-photo-grid"></div>
    </div>

    <!-- Row 3: GPS & Timestamp Card -->
    <div class="delivery-meta-card">
      <div class="delivery-meta-row">
        <div class="delivery-meta-icon">📍</div>
        <div class="delivery-meta-info">
          <div class="delivery-meta-label">พิกัดสถานที่ส่งมอบ (GPS)</div>
          <div class="delivery-meta-value" id="supGpsDisplay">กำลังค้นหาพิกัด...</div>
          <input type="hidden" id="supGpsVal" name="supGps" />
        </div>
        <button type="button" class="btn btn-sm btn-outline btn-refresh-gps" id="btnRefreshSupGps" title="ดึงพิกัดใหม่">
          🔄 ดึงพิกัดใหม่
        </button>
      </div>
      <div class="delivery-meta-divider"></div>
      <div class="delivery-meta-row">
        <div class="delivery-meta-icon">🕒</div>
        <div class="delivery-meta-info">
          <div class="delivery-meta-label">วันเวลาที่ส่งมอบ (Timestamp)</div>
          <div class="delivery-meta-value" id="supTimestampDisplay">-</div>
          <input type="hidden" id="supRetTimestamp" name="supRetTimestamp" />
        </div>
      </div>
    </div>

    <!-- Row 4: หมายเหตุเพิ่มเติม (ถ้ามี) -->
    <div class="form-group mb-0">
      <label class="form-label" for="supRetNote">หมายเหตุการส่งมอบ (ถ้ามี)</label>
      <div class="input-clearable-wrap">
        <input type="text" id="supRetNote" class="form-control" placeholder="เช่น ฝากไว้ที่ป้อม รปภ., วางที่โต๊ะประชาสัมพันธ์..." value="${escapeHtml(noteVal)}" autocomplete="off" />
        <button type="button" class="btn-input-clear ${noteVal ? '' : 'hidden'}" data-clear-target="supRetNote" title="ล้างค่า">✕</button>
      </div>
    </div>
  `;

  contentWrap.innerHTML = html;

  renderSupPhotoGrid();
  updateSupTimestamp();
  captureSupGps();
  attachSupplierSaleModalEvents();

  dialog.showModal();
}

function renderReturnSlipSheet(loan, sizeClass = 'size-a4') {
  const company = state.companySettings || {};
  const companyLogo = company.company_logo || '';
  const qrSvg = generateQrSvg(loan.id);

  const items = loan.items || [];
  const supplierItems = items.filter(it => (it.source_snapshot || 'Demo') === 'Supplier');
  const saleItems = items.filter(it => (it.source_snapshot || 'Demo') === 'คลังขาย');
  const demoItems = items.filter(it => (it.source_snapshot || 'Demo') === 'Demo');

  const supReceiver = loan.supplier_return_receiver || '';
  const supSender = loan.supplier_return_sender || loan.borrower_name || '';
  const supTimestamp = loan.supplier_return_timestamp ? formatDateTimeThai(loan.supplier_return_timestamp) : '';
  const supNote = loan.supplier_return_note || '';

  const saleSender = loan.sale_return_sender || loan.borrower_name || '';
  const saleTimestamp = loan.sale_return_timestamp ? formatDateTimeThai(loan.sale_return_timestamp) : '';
  const saleNote = loan.sale_return_note || '';
  const saleActions = loan.sale_return_action || {};

  const returnDateStr = loan.supplier_return_timestamp || loan.sale_return_timestamp || loan.return_date || new Date().toISOString();

  const primarySender = supSender || saleSender || loan.borrower_name || '-';
  const primaryReceiver = supplierItems.length > 0 ? (supReceiver || 'ตัวแทน Supplier') : (saleSender || 'เจ้าหน้าที่คลังสินค้า');

  let rowsHtml = '';
  let rowIdx = 1;

  if (supplierItems.length > 0) {
    if (saleItems.length > 0 || demoItems.length > 0) {
      rowsHtml += `
        <tr class="gp-group-header-row">
          <td colspan="5" style="background:#eff6ff; font-weight:700; color:#1e40af; padding:6px 12px; font-size:12.5px; border:1px solid #64748b;">
            🚚 รายการส่งคืนให้ Supplier (ยืมภายนอก)
          </td>
        </tr>
      `;
    }
    supplierItems.forEach(it => {
      rowsHtml += `
        <tr>
          <td class="gp-td-idx">${rowIdx++}</td>
          <td class="gp-td-model">
            <strong>${escapeHtml(it.brand || '')} ${escapeHtml(it.model || '')}</strong>
          </td>
          <td class="gp-td-sn">
            ${it.serial_no && it.serial_no.trim() !== '-' ? `<code class="gp-sn-code">${escapeHtml(it.serial_no)}</code>` : '<span style="color:#94a3b8;">-</span>'}
          </td>
          <td class="gp-td-acc">
            ${(it.loan_accessories || []).length === 0 ? '<span style="color:#94a3b8;">ตัวเครื่องมาตรฐาน</span>' : it.loan_accessories.map(a => `<span class="gp-acc-tag">☑ ${escapeHtml(a)}</span>`).join('')}
          </td>
          <td class="gp-td-note">
            <div class="gp-ret-tag" style="background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; font-weight:600;">
              🚚 ส่งคืน Supplier เรียบร้อย
            </div>
            ${it.loan_free_note && it.loan_free_note.trim() && it.loan_free_note.trim() !== '-' ? `<div class="gp-note-free" style="margin-top:4px;">${escapeHtml(it.loan_free_note)}</div>` : ''}
          </td>
        </tr>
      `;
    });
  }

  if (saleItems.length > 0) {
    if (supplierItems.length > 0 || demoItems.length > 0) {
      rowsHtml += `
        <tr class="gp-group-header-row">
          <td colspan="5" style="background:#fef3c7; font-weight:700; color:#b45309; padding:6px 12px; font-size:12.5px; border:1px solid #64748b;">
            🏢 รายการคืนคลังขาย (เบิกสต็อกขาย)
          </td>
        </tr>
      `;
    }
    saleItems.forEach(it => {
      const action = saleActions[it.tag_id] || it.return_action || 'return_to_sale';
      const isConvert = action === 'convert_to_demo';
      rowsHtml += `
        <tr>
          <td class="gp-td-idx">${rowIdx++}</td>
          <td class="gp-td-model">
            <strong>${escapeHtml(it.brand || '')} ${escapeHtml(it.model || '')}</strong>
          </td>
          <td class="gp-td-sn">
            ${it.serial_no && it.serial_no.trim() !== '-' ? `<code class="gp-sn-code">${escapeHtml(it.serial_no)}</code>` : '<span style="color:#94a3b8;">-</span>'}
          </td>
          <td class="gp-td-acc">
            ${(it.loan_accessories || []).length === 0 ? '<span style="color:#94a3b8;">ตัวเครื่องมาตรฐาน</span>' : it.loan_accessories.map(a => `<span class="gp-acc-tag">☑ ${escapeHtml(a)}</span>`).join('')}
          </td>
          <td class="gp-td-note">
            <div class="gp-ret-tag" style="background:${isConvert ? '#f5f3ff' : '#ecfdf5'}; color:${isConvert ? '#6d28d9' : '#047857'}; border:1px solid ${isConvert ? '#ddd6fe' : '#a7f3d0'}; font-weight:600;">
              ${isConvert ? '📦 ตีเข้าเป็นคลัง Demo' : '🏢 คืนสต็อกคลังขายปกติ'}
            </div>
            ${it.loan_free_note && it.loan_free_note.trim() && it.loan_free_note.trim() !== '-' ? `<div class="gp-note-free" style="margin-top:4px;">${escapeHtml(it.loan_free_note)}</div>` : ''}
          </td>
        </tr>
      `;
    });
  }

  if (demoItems.length > 0 && supplierItems.length === 0 && saleItems.length === 0) {
    demoItems.forEach(it => {
      rowsHtml += `
        <tr>
          <td class="gp-td-idx">${rowIdx++}</td>
          <td class="gp-td-model">
            <strong>${escapeHtml(it.brand || '')} ${escapeHtml(it.model || '')}</strong>
          </td>
          <td class="gp-td-sn">
            ${it.serial_no && it.serial_no.trim() !== '-' ? `<code class="gp-sn-code">${escapeHtml(it.serial_no)}</code>` : '<span style="color:#94a3b8;">-</span>'}
          </td>
          <td class="gp-td-acc">
            ${(it.loan_accessories || []).length === 0 ? '<span style="color:#94a3b8;">ตัวเครื่องมาตรฐาน</span>' : it.loan_accessories.map(a => `<span class="gp-acc-tag">☑ ${escapeHtml(a)}</span>`).join('')}
          </td>
          <td class="gp-td-note">
            <div class="gp-ret-tag gp-ret-returned">
              ✅ รับเข้าคลัง Demo (QC ผ่าน)
            </div>
            ${it.loan_free_note && it.loan_free_note.trim() && it.loan_free_note.trim() !== '-' ? `<div class="gp-note-free" style="margin-top:4px;">${escapeHtml(it.loan_free_note)}</div>` : ''}
          </td>
        </tr>
      `;
    });
  }

  const notesList = [];
  if (supNote && supNote !== '-') {
    notesList.push(`• <strong>หมายเหตุคืน Supplier:</strong> ${escapeHtml(supNote)}`);
  }
  if (saleNote && saleNote !== '-') {
    notesList.push(`• <strong>หมายเหตุคืนคลังขาย:</strong> ${escapeHtml(saleNote)}`);
  }
  if (loan.note && loan.note !== '-') {
    notesList.push(`• <strong>หมายเหตุใบยืม:</strong> ${escapeHtml(loan.note)}`);
  }

  return `
    <div class="gate-pass-sheet ${sizeClass}">
      <div class="gp-header">
        <!-- ฝั่งซ้าย: โลโก้ & ชื่อบริษัท/เลขผู้เสียภาษีด้านขวาของโลโก้ และที่อยู่ด้านล่าง -->
        <div class="gp-header-issuer">
          <div class="gp-issuer-top-row">
            ${companyLogo ? `
              <div class="gp-issuer-logo-box">
                <img src="${escapeHtml(companyLogo)}" alt="Logo" class="gp-issuer-logo" onerror="this.onerror=null; const p = this.closest('.gp-issuer-logo-box'); if (p) p.style.display='none';" />
              </div>
            ` : ''}
            <div class="gp-issuer-brand-block">
              <div class="gp-issuer-brand">
                <span class="gp-issuer-name-th">${escapeHtml(company.company_name || 'บริษัท แอคทีฟ 5 จำกัด')}</span>
                ${company.company_name_en ? `<span class="gp-issuer-name-en">(${escapeHtml(company.company_name_en)})</span>` : ''}
              </div>
              ${company.company_tax_id ? `<div class="gp-issuer-meta-tax">เลขประจำตัวผู้เสียภาษี: ${escapeHtml(company.company_tax_id)}${company.company_branch ? ` (${escapeHtml(company.company_branch)})` : ''}</div>` : ''}
            </div>
          </div>
          <div class="gp-issuer-bottom-details">
            ${company.company_address ? `<div class="gp-issuer-address">${escapeHtml(company.company_address)}</div>` : ''}
            ${(company.company_phone || company.company_website || company.company_email) ? `
              <div class="gp-issuer-contact">
                ${[
                  company.company_phone ? `
                    <span class="gp-contact-item">
                      <svg class="gp-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                      </svg>
                      <span>${escapeHtml(company.company_phone.replace(/^(โทร|tel|phone)\s*:\s*/i, '').trim())}</span>
                    </span>
                  ` : '',
                  company.company_website ? `
                    <span class="gp-contact-item">
                      <svg class="gp-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="2" y1="12" x2="22" y2="12"></line>
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path>
                      </svg>
                      <span>${escapeHtml(company.company_website.replace(/^(เว็บ|เว็บไซต์|web|website)\s*:\s*/i, '').trim())}</span>
                    </span>
                  ` : '',
                  company.company_email ? `
                    <span class="gp-contact-item">
                      <svg class="gp-contact-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect width="20" height="16" x="2" y="4" rx="2"></rect>
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"></path>
                      </svg>
                      <span>${escapeHtml(company.company_email.replace(/^(อีเมล|email|e-mail)\s*:\s*/i, '').trim())}</span>
                    </span>
                  ` : ''
                ].filter(Boolean).join('<span class="gp-bullet">•</span>')}
              </div>
            ` : ''}
          </div>
        </div>

        <!-- ฝั่งขวา: ชื่อเอกสาร & ข้อมูลอ้างอิง -->
        <div class="gp-header-doc">
          <div class="gp-doc-heading">
            <h1 class="gp-title">ใบส่งคืนสินค้า / RETURN PASS</h1>
            <span class="gp-sheet-badge copy" style="background:#0284c7; color:#fff;">ใบคืนสินค้า • RETURN RECEIPT</span>
          </div>
          <div class="gp-meta-block-wrap">
            ${qrSvg ? `
              <div class="gp-doc-qr-wrap" title="สแกนรหัสเอกสาร: ${escapeHtml(loan.id)}">
                ${qrSvg}
              </div>
            ` : ''}
            <div class="gp-meta-table">
              <div class="gp-meta-row">
                <span class="gp-meta-lbl">เลขที่เอกสาร:</span>
                <span class="gp-meta-val gp-meta-id">${escapeHtml(loan.id)}</span>
              </div>
              <div class="gp-meta-row">
                <span class="gp-meta-lbl">วันที่ส่งคืน:</span>
                <span class="gp-meta-val">${formatShortDate(returnDateStr)}</span>
              </div>
              <div class="gp-meta-row gp-meta-due-row">
                <span class="gp-meta-lbl">วันที่ยืมเดิม:</span>
                <span class="gp-meta-val gp-meta-due">${formatShortDate(loan.checkout_date)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="gp-info-grid">
        <div class="gp-info-item"><span class="gp-info-lbl">ลูกค้า:</span> <span class="gp-info-val">${escapeHtml(loan.customer_name || '-')}${loan.customer_phone ? ` <span class="gp-phone">(${escapeHtml(loan.customer_phone)})</span>` : ''}</span></div>
        <div class="gp-info-item"><span class="gp-info-lbl">บริษัท:</span> <span class="gp-info-val">${escapeHtml(loan.customer_company || '-')}</span></div>
        <div class="gp-info-item"><span class="gp-info-lbl">ผู้ยืม / Sales:</span> <span class="gp-info-val">${escapeHtml(loan.borrower_name)}</span></div>
        <div class="gp-info-item"><span class="gp-info-lbl">วัตถุประสงค์:</span> <span class="gp-info-val">${escapeHtml(loan.purpose || 'Demo')}</span></div>
        <div class="gp-info-item"><span class="gp-info-lbl">ผู้ส่งคืน:</span> <span class="gp-info-val">${escapeHtml(primarySender)}</span></div>
        <div class="gp-info-item"><span class="gp-info-lbl">ผู้รับคืน:</span> <span class="gp-info-val">${escapeHtml(primaryReceiver)}</span></div>
      </div>

      <div class="gp-table-wrap">
        <table class="gp-table">
          <thead>
            <tr>
              <th class="gp-th-idx">#</th>
              <th class="gp-th-model">รุ่นสินค้า (Brand / Model)</th>
              <th class="gp-th-sn">Serial No. (S/N)</th>
              <th class="gp-th-acc">อุปกรณ์เสริมที่ส่งคืน</th>
              <th class="gp-th-note">ผลการจัดการสต็อก / สถานะคืน</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml}
          </tbody>
        </table>
      </div>

      ${notesList.length > 0 ? `
        <div class="gp-terms-notice" style="font-style:normal; margin-bottom:12px;">
          ${notesList.join('<br/>')}
        </div>
      ` : `
        <div class="gp-terms-notice">
          * ได้รับเครื่องและอุปกรณ์เสริมที่ระบุไว้ข้างต้นคืนเรียบร้อยแล้ว ในสภาพสมบูรณ์ถูกต้องตามรายการ
        </div>
      `}

      <div class="gp-signatures">
        <!-- 1. ผู้ส่งคืนสินค้า -->
        <div class="gp-sig-box" data-sig-role="return-sender">
          <div class="gp-sig-slot">
            ${loan.borrower_signature ? `
              <div class="gp-sig-preview-wrap">
                <img class="gp-sig-img" src="${escapeHtml(loan.borrower_signature)}" alt="ลายเซ็นผู้ส่งคืน" />
              </div>
            ` : ''}
          </div>
          <div class="gp-sig-line"></div>
          <div class="gp-sig-info">
            <div class="gp-sig-role">ผู้ส่งคืนสินค้า / พนักงาน</div>
            <div class="gp-sig-name">(${escapeHtml(primarySender)})</div>
            ${supTimestamp || saleTimestamp ? `<div class="gp-sig-time">เวลาส่งคืน: ${escapeHtml(supTimestamp || saleTimestamp)}</div>` : ''}
          </div>
        </div>

        <!-- 2. ผู้รับคืนสินค้า / ตัวแทน Supplier / คลังขาย -->
        <div class="gp-sig-box" data-sig-role="return-receiver">
          <div class="gp-sig-slot">
            ${(loan.supplier_return_signature || loan.receiver_signature || loan.dispatcher_signature || state.companySettings?.dispatcher_signature) ? `
              <div class="gp-sig-preview-wrap">
                <img class="gp-sig-img" src="${escapeHtml(loan.supplier_return_signature || loan.receiver_signature || loan.dispatcher_signature || state.companySettings?.dispatcher_signature)}" alt="ลายเซ็นผู้รับคืน" />
              </div>
            ` : ''}
          </div>
          <div class="gp-sig-line"></div>
          <div class="gp-sig-info">
            <div class="gp-sig-role">ผู้รับคืนสินค้า / ตัวแทน Supplier / คลัง</div>
            <div class="gp-sig-name">(${escapeHtml(primaryReceiver)})</div>
            ${supTimestamp || saleTimestamp ? `<div class="gp-sig-time">เวลารับคืน: ${escapeHtml(supTimestamp || saleTimestamp)}</div>` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

function openReturnSlipModal(loanId) {
  const loan = state.loans.find(l => l.id === loanId);
  if (!loan) return;

  const dialog = document.getElementById('returnSlipDialog');
  if (!dialog) return;

  const badgeEl = document.getElementById('returnSlipLoanBadge');
  if (badgeEl) badgeEl.textContent = `${loan.id} (ใบคืน)`;

  const container = document.getElementById('returnSlipPreviewContainer');
  const printMount = document.getElementById('printMount');

  const sheetHtml = `
    <div class="gate-pass-single-a4-wrapper">
      ${renderReturnSlipSheet(loan, 'size-a4')}
    </div>
  `;

  if (container) {
    container.innerHTML = sheetHtml;
  }
  if (printMount) {
    printMount.innerHTML = sheetHtml;
  }

  dialog.showModal();
}

// ============================================================================
// TOP SEARCH & UNIVERSAL BARCODE & QR SCANNER (CAMERA)
// ============================================================================
let searchHtml5QrCode = null;
let currentCameraFacing = 'environment'; // 'environment' (back) or 'user' (front)
let isTorchOn = false;
let isScanningActive = false;
let currentBarcodeScanTarget = null; // null for search bar, or { onScan: fn, title: '...', subtitle: '...' }

function playScanBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1040, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.18, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.09);
  } catch (_) {}
}

async function startBarcodeCamera(facingMode) {
  const loading = document.getElementById('scannerLoadingIndicator');
  const errorBox = document.getElementById('scannerErrorBox');
  const torchBtn = document.getElementById('btnSearchBarcodeTorch');
  if (loading) loading.style.display = 'flex';
  if (errorBox) errorBox.classList.add('hidden');

  try {
    await stopBarcodeCamera();

    const config = {
      fps: 15,
      qrbox: (viewfinderWidth, viewfinderHeight) => {
        const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
        const boxWidth = Math.floor(minEdge * 0.78);
        const boxHeight = Math.floor(minEdge * 0.55);
        return { width: Math.max(boxWidth, 200), height: Math.max(boxHeight, 140) };
      }
    };

    const onScanSuccess = (decodedText) => {
      handleSearchBarcodeScanned(decodedText);
    };

    let started = false;
    let lastErr = null;

    // Strategy 1: Enumerate real cameras via Html5Qrcode.getCameras() (Most reliable on Android)
    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras && cameras.length > 0) {
        let targetCamera = cameras[0];
        if (facingMode === 'environment') {
          const backCam = cameras.find(c => /back|rear|environment|หลัง|wide|0/i.test(c.label));
          targetCamera = backCam || cameras[cameras.length - 1];
        } else {
          const frontCam = cameras.find(c => /front|user|หน้า/i.test(c.label));
          targetCamera = frontCam || cameras[0];
        }

        if (targetCamera && targetCamera.id) {
          await searchHtml5QrCode.start(
            targetCamera.id,
            config,
            onScanSuccess,
            () => {}
          );
          started = true;
        }
      }
    } catch (e1) {
      console.warn('Strategy 1 (getCameras) failed:', e1);
      lastErr = e1;
    }

    // Strategy 2: Direct ideal facingMode constraint
    if (!started) {
      try {
        await searchHtml5QrCode.start(
          { facingMode: { ideal: facingMode } },
          config,
          onScanSuccess,
          () => {}
        );
        started = true;
      } catch (e2) {
        console.warn('Strategy 2 (ideal facingMode) failed:', e2);
        lastErr = e2;
      }
    }

    // Strategy 3: Direct facingMode string
    if (!started) {
      try {
        await searchHtml5QrCode.start(
          { facingMode: facingMode },
          config,
          onScanSuccess,
          () => {}
        );
        started = true;
      } catch (e3) {
        console.warn('Strategy 3 (simple facingMode) failed:', e3);
        lastErr = e3;
      }
    }

    // Strategy 4: Fallback to bare true without constraints
    if (!started) {
      try {
        await searchHtml5QrCode.start(
          true,
          config,
          onScanSuccess,
          () => {}
        );
        started = true;
      } catch (e4) {
        console.error('All camera strategies failed:', e4);
        throw e4 || lastErr;
      }
    }

    isScanningActive = true;
    if (loading) loading.style.display = 'none';

    // Torch capabilities check
    try {
      const caps = searchHtml5QrCode.getRunningTrackCapabilities();
      if (caps && caps.torch && torchBtn) {
        torchBtn.classList.remove('hidden');
        isTorchOn = false;
        torchBtn.textContent = '🔦';
      } else if (torchBtn) {
        torchBtn.classList.add('hidden');
      }
    } catch (_) {
      if (torchBtn) torchBtn.classList.add('hidden');
    }
  } catch (err) {
    console.warn('Failed to start barcode camera:', err);
    if (loading) loading.style.display = 'none';
    if (errorBox) {
      const msgEl = document.getElementById('scannerErrorMsg');
      if (msgEl) {
        const isNotAllowed = err.name === 'NotAllowedError' || /permission/i.test(err.message || '');
        msgEl.innerHTML = isNotAllowed
          ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง<br><small style="color:#94a3b8; font-weight:normal;">กรุณากดอนุญาต (Allow) การใช้งานกล้องในการตั้งค่าของเบราว์เซอร์</small>'
          : 'ไม่สามารถเปิดกล้องได้<br><small style="color:#94a3b8; font-weight:normal;">หากเปิดผ่านแอป Line แนะนำกด ⋯ ที่มุมขวาบน แล้วเลือก "เปิดด้วยเบราว์เซอร์อื่น" หรือถ่ายรูปบาร์โค้ด</small>';
      }
      errorBox.classList.remove('hidden');
    }
  }
}

async function stopBarcodeCamera() {
  if (searchHtml5QrCode && isScanningActive) {
    try {
      await searchHtml5QrCode.stop();
    } catch (_) {}
    isScanningActive = false;
  }
}

function closeSearchBarcodeScanner() {
  stopBarcodeCamera();
  const modal = document.getElementById('searchBarcodeModal');
  if (modal) smoothCloseDialog(modal);
  currentBarcodeScanTarget = null;
}

function handleSearchBarcodeScanned(rawCode) {
  const code = (rawCode || '').trim();
  if (!code) return;

  playScanBeep();
  if (navigator.vibrate) navigator.vibrate(60);

  const activeTarget = currentBarcodeScanTarget;
  closeSearchBarcodeScanner();

  if (activeTarget && typeof activeTarget.onScan === 'function') {
    activeTarget.onScan(code);
    return;
  }

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = code;
    state.searchQuery = code;

    const btnClearSearch = document.getElementById('btnClearSearch');
    if (btnClearSearch) btnClearSearch.classList.remove('hidden');

    const searchKbd = document.getElementById('searchKbdHint');
    if (searchKbd) searchKbd.classList.add('hidden');

    renderActiveView();
    searchInput.focus();
    searchInput.select();
  }

  showToast(`📷 สแกนบาร์โค้ดสำเร็จ: "${code}"`);
}

async function openUniversalBarcodeScanner(options = {}) {
  currentBarcodeScanTarget = options;
  const modal = document.getElementById('searchBarcodeModal');
  if (!modal) return;

  const titleEl = document.getElementById('searchBarcodeModalTitle');
  const subEl = modal.querySelector('.scanner-header-sub');
  if (titleEl) {
    titleEl.textContent = options.title || 'สแกนบาร์โค้ด / QR Code';
  }
  if (subEl) {
    subEl.textContent = options.subtitle || 'ส่องกล้องไปที่ S/N, Tag ID หรือบาร์โค้ด';
  }

  const loading = document.getElementById('scannerLoadingIndicator');
  const errorBox = document.getElementById('scannerErrorBox');
  if (loading) loading.style.display = 'flex';
  if (errorBox) errorBox.classList.add('hidden');

  modal.showModal();

  if (typeof Html5Qrcode === 'undefined') {
    if (loading) loading.style.display = 'none';
    if (errorBox) {
      const msgEl = document.getElementById('scannerErrorMsg');
      if (msgEl) msgEl.textContent = 'ระบบสแกนกล้องยังไม่พร้อมใช้งาน';
      errorBox.classList.remove('hidden');
    }
    return;
  }

  try {
    if (!searchHtml5QrCode) {
      searchHtml5QrCode = new Html5Qrcode('searchBarcodeReader', {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.UPC_A,
          Html5QrcodeSupportedFormats.UPC_E,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.ITF
        ],
        verbose: false
      });
    }

    await startBarcodeCamera(currentCameraFacing);
  } catch (err) {
    console.error('Cannot open scanner:', err);
    if (loading) loading.style.display = 'none';
    if (errorBox) {
      const msgEl = document.getElementById('scannerErrorMsg');
      if (msgEl) msgEl.textContent = err.message || 'ไม่สามารถเปิดกล้องได้';
      errorBox.classList.remove('hidden');
    }
  }
}

function setupSearchBarcodeScanner() {
  const btnScan = document.getElementById('btnSearchBarcodeScan');
  const modal = document.getElementById('searchBarcodeModal');
  const btnClose = document.getElementById('btnCloseSearchBarcode');
  const btnCancel = document.getElementById('btnCancelSearchBarcode');
  const btnSwitch = document.getElementById('btnSearchBarcodeSwitchCam');
  const btnTorch = document.getElementById('btnSearchBarcodeTorch');
  const fileInput = document.getElementById('searchBarcodeFileInput');
  const fileInputFallback = document.getElementById('searchBarcodeFileInputFallback');

  if (!modal) return;

  btnScan?.addEventListener('click', async () => {
    openUniversalBarcodeScanner({
      title: 'ค้นหาด้วยบาร์โค้ด / QR Code',
      subtitle: 'ส่องกล้องไปที่ S/N, Tag ID หรือบาร์โค้ด',
      onScan: (code) => {
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
          searchInput.value = code;
          state.searchQuery = code;

          const btnClearSearch = document.getElementById('btnClearSearch');
          if (btnClearSearch) btnClearSearch.classList.remove('hidden');

          const searchKbd = document.getElementById('searchKbdHint');
          if (searchKbd) searchKbd.classList.add('hidden');

          renderActiveView();
          searchInput.focus();
          searchInput.select();
        }
        showToast(`📷 สแกนบาร์โค้ดสำเร็จ: "${code}"`);
      }
    });
  });

  // Generic delegate for any [data-camera-scan-target]
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('[data-camera-scan-target]');
    if (trigger) {
      e.preventDefault();
      const targetId = trigger.getAttribute('data-camera-scan-target');
      const targetInput = document.getElementById(targetId);
      const title = trigger.getAttribute('title') || 'สแกนบาร์โค้ดด้วยกล้อง';
      openUniversalBarcodeScanner({
        title: title,
        subtitle: 'ส่องกล้องไปที่บาร์โค้ด S/N หรือ Tag ID',
        onScan: (code) => {
          if (targetInput) {
            targetInput.value = code;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            targetInput.dispatchEvent(new Event('change', { bubbles: true }));
            targetInput.focus();
          }
          showToast(`📷 สแกนสำเร็จ: "${code}"`);
        }
      });
    }
  });

  if (btnClose) btnClose.addEventListener('click', closeSearchBarcodeScanner);
  if (btnCancel) btnCancel.addEventListener('click', closeSearchBarcodeScanner);

  if (btnSwitch) {
    btnSwitch.addEventListener('click', async () => {
      currentCameraFacing = currentCameraFacing === 'environment' ? 'user' : 'environment';
      if (isScanningActive) {
        await startBarcodeCamera(currentCameraFacing);
      }
    });
  }

  if (btnTorch) {
    btnTorch.addEventListener('click', async () => {
      if (!searchHtml5QrCode || !isScanningActive) return;
      try {
        isTorchOn = !isTorchOn;
        await searchHtml5QrCode.applyVideoConstraints({
          advanced: [{ torch: isTorchOn }]
        });
        btnTorch.textContent = isTorchOn ? '⚡' : '🔦';
      } catch (err) {
        console.warn('Torch toggle failed:', err);
      }
    });
  }

  const handleFileScan = async (file) => {
    if (!file) return;
    const loading = document.getElementById('scannerLoadingIndicator');
    if (loading) loading.style.display = 'flex';
    try {
      if (!searchHtml5QrCode) {
        searchHtml5QrCode = new Html5Qrcode('searchBarcodeReader', { verbose: false });
      }
      const res = await searchHtml5QrCode.scanFile(file, true);
      if (res) {
        handleSearchBarcodeScanned(res);
      }
    } catch (err) {
      alert('ไม่พบบาร์โค้ดหรือ QR Code ในรูปภาพที่เลือก กรุณาลองถ่ายให้ชัดเจนขึ้น');
    } finally {
      if (loading) loading.style.display = 'none';
    }
  };

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileScan(e.target.files[0]);
      }
    });
  }

  if (fileInputFallback) {
    fileInputFallback.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        handleFileScan(e.target.files[0]);
      }
    });
  }

  const btnExternalChrome = document.getElementById('btnOpenExternalChrome');
  if (btnExternalChrome) {
    const isInApp = /Line|FBAN|FBAV|Instagram|TikTok|MicroMessenger/i.test(navigator.userAgent);
    if (isInApp && /android/i.test(navigator.userAgent)) {
      btnExternalChrome.classList.remove('hidden');
      btnExternalChrome.addEventListener('click', (e) => {
        e.preventDefault();
        const currentUrl = window.location.href.replace(/^https?:\/\//, '');
        window.location.href = `intent://${currentUrl}#Intent;scheme=https;package=com.android.chrome;end`;
      });
    } else {
      btnExternalChrome.classList.add('hidden');
    }
  }
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================
function setupEventListeners() {
  // Top Info Accordion Toggle
  const btnToggleTopInfo = document.getElementById('btnToggleTopInfo');
  if (btnToggleTopInfo) {
    btnToggleTopInfo.addEventListener('click', e => {
      e.preventDefault();
      const drawer = document.getElementById('loanTopDrawer');
      if (drawer && drawer.classList.contains('hidden')) {
        expandTopInfoDrawer();
        const borrowerInp = document.getElementById('loanBorrower');
        if (borrowerInp && !borrowerInp.value) borrowerInp.focus();
      } else {
        collapseTopInfoDrawer();
      }
    });
  }

  const btnCloseTopDrawer = document.getElementById('btnCloseTopDrawer');
  if (btnCloseTopDrawer) {
    btnCloseTopDrawer.addEventListener('click', e => {
      e.preventDefault();
      collapseTopInfoDrawer();
      const firstInput = document.querySelector('[data-excel-model-input="0"]');
      if (firstInput) firstInput.focus();
    });
  }

  // Auto-collapse when user fills required fields in top drawer and presses Enter
  ['loanBorrower', 'loanCompany', 'loanCustomer', 'loanCustomerPhone'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const borrower = document.getElementById('loanBorrower').value.trim();
        const company = document.getElementById('loanCompany').value.trim();
        const customer = document.getElementById('loanCustomer').value.trim();
        if (borrower && company && customer) {
          collapseTopInfoDrawer();
          const firstInput = document.querySelector('[data-excel-model-input="0"]');
          if (firstInput) firstInput.focus();
        } else if (!borrower) {
          document.getElementById('loanBorrower').focus();
        } else if (!company) {
          document.getElementById('loanCompany').focus();
        } else {
          document.getElementById('loanCustomer').focus();
        }
      }
    });
    el.addEventListener('input', updateTopInfoSummary);
  });

  // Auto-collapse top drawer when cursor focuses or clicks on the borrowed items section (รายการยืม)
  const loanForm = document.getElementById('loanForm');
  if (loanForm) {
    const handleItemsFocusOrClick = e => {
      const isInsideItems = e.target.closest('#loanItemsSection') ||
                            e.target.closest('.excel-table-wrap') ||
                            e.target.matches('[data-excel-model-input]');
      if (isInsideItems) {
        const drawer = document.getElementById('loanTopDrawer');
        if (drawer && !drawer.classList.contains('hidden')) {
          collapseTopInfoDrawer();
        }
      }
    };

    loanForm.addEventListener('focusin', handleItemsFocusOrClick);
    loanForm.addEventListener('click', handleItemsFocusOrClick);
  }

  // Initialize Custom Touch-friendly Selects
  initCustomSelect('loanPurpose');
  initCustomSelect('loanInitialStatus');
  initCompanyAutocomplete();

  document.addEventListener('click', e => {
    if (!e.target.closest('.custom-select-wrap')) {
      document.querySelectorAll('.custom-select-menu').forEach(m => m.classList.add('hidden'));
      document.querySelectorAll('.custom-select-trigger').forEach(t => t.setAttribute('aria-expanded', 'false'));
    }
  });

  // Search Input & ⌘K Shortcut
  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const searchKbd = document.getElementById('searchKbdHint');

  window.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      if (searchInput) {
        searchInput.focus();
        searchInput.select();
      }
    }
  });

  if (searchInput && searchKbd) {
    searchInput.addEventListener('focus', () => searchKbd.classList.add('hidden'));
    searchInput.addEventListener('blur', () => {
      if (!searchInput.value) searchKbd.classList.remove('hidden');
    });
  }

  searchInput.addEventListener('input', () => {
    state.searchQuery = searchInput.value;
    btnClearSearch.classList.toggle('hidden', !state.searchQuery);
    if (searchKbd) searchKbd.classList.toggle('hidden', Boolean(state.searchQuery));
    renderActiveView();
  });

  // Enter on search input: confirm search filter and blur to hide keyboard (do not auto-open loan)
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      state.searchQuery = searchInput.value;
      btnClearSearch.classList.toggle('hidden', !state.searchQuery);
      if (searchKbd) searchKbd.classList.toggle('hidden', Boolean(state.searchQuery));
      renderActiveView();
      searchInput.blur(); // Blur to dismiss virtual keyboard and view filtered results comfortably
    }
  });
  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    state.searchQuery = '';
    btnClearSearch.classList.add('hidden');
    if (searchKbd) searchKbd.classList.remove('hidden');
    renderActiveView();
  });

  setupSearchBarcodeScanner();

  // View Switcher
  document.getElementById('viewSwitcher').addEventListener('click', e => {
    const btn = e.target.closest('.view-btn');
    if (!btn) return;
    document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.viewMode = btn.getAttribute('data-view');
    updateUrlHash(state.viewMode);
    renderActiveView();
  });

  // Listen to popstate / hashchange for browser back/forward buttons
  window.addEventListener('hashchange', () => {
    syncNavigationFromHash();
  });

  // Sort Toggle
  document.getElementById('btnToggleSort').addEventListener('click', () => {
    state.docNoSortOrder = state.docNoSortOrder === 'asc' ? 'desc' : 'asc';
    const sortLabel = document.getElementById('sortLabelText');
    if (sortLabel) {
      sortLabel.textContent = state.docNoSortOrder === 'asc' ? '001...' : 'ล่าสุด...';
    }
    const btnSort = document.getElementById('btnToggleSort');
    if (btnSort) {
      btnSort.title = state.docNoSortOrder === 'asc'
        ? 'เรียงตามเลขที่ใบยืม: น้อย → มาก (001...) (คลิกเพื่อสลับลำดับ)'
        : 'เรียงตามเลขที่ใบยืม: มาก → น้อย (ล่าสุด...) (คลิกเพื่อสลับลำดับ)';
    }
    renderActiveView();
  });

  // "+ ออกใบยืม" CTA on Desktop Header
  const btnCreate = document.getElementById('btnOpenCreateLoan');
  if (btnCreate) btnCreate.addEventListener('click', openCreateLoanModal);

  // Mobile Speed-Dial FAB (+)
  const fabWrap = document.getElementById('fabSpeedDialWrap');
  const btnFabMain = document.getElementById('btnFabMain');
  const fabBackdrop = document.getElementById('fabBackdrop');
  const fabActionCreate = document.getElementById('fabActionCreateLoan');
  const fabActionAddDemo = document.getElementById('fabActionAddDemo');

  function toggleSpeedDial(force) {
    if (!fabWrap || !btnFabMain) return;
    const willOpen = typeof force === 'boolean' ? force : !fabWrap.classList.contains('is-open');
    fabWrap.classList.toggle('is-open', willOpen);
    btnFabMain.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
    const menu = document.getElementById('fabMenu');
    if (menu) menu.setAttribute('aria-hidden', willOpen ? 'false' : 'true');
  }

  if (btnFabMain) {
    btnFabMain.addEventListener('click', e => {
      e.stopPropagation();
      toggleSpeedDial();
    });
  }

  if (fabBackdrop) {
    fabBackdrop.addEventListener('click', () => toggleSpeedDial(false));
  }

  if (fabActionCreate) {
    fabActionCreate.addEventListener('click', () => {
      toggleSpeedDial(false);
      openCreateLoanModal();
    });
  }

  if (fabActionAddDemo) {
    fabActionAddDemo.addEventListener('click', () => {
      toggleSpeedDial(false);
      if (typeof openAddDemoModal === 'function') {
        openAddDemoModal();
      } else if (window.openAddDemoModal) {
        window.openAddDemoModal();
      } else {
        document.getElementById('btnOpenAddDemoModal')?.click();
      }
    });
  }

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && fabWrap && fabWrap.classList.contains('is-open')) {
      toggleSpeedDial(false);
    }
  });

  // Highlight Banner buttons
  document.getElementById('btnPrintHighlighted').addEventListener('click', () => {
    if (state.highlightDocNo) openPrintModal(state.highlightDocNo);
  });
  document.getElementById('btnDismissHighlight').addEventListener('click', () => {
    state.highlightDocNo = null;
    renderHeaderCounters();
    renderActiveView();
  });

  async function handleCancelLoan(loanId) {
    if (!loanId) return;
    const loan = state.loans.find(l => l.id === loanId);
    if (loan && loan.status !== 'Requested' && loan.status !== 'Dispatching' && loan.status !== 'Dispatched') {
      showToast('⚠️ ยกเลิกได้เฉพาะใบยืมที่ยังไม่ได้ส่งมอบสินค้าเท่านั้น');
      return;
    }

    const company = loan?.customer_company || loan?.customer_name || '';
    const itemsSummary = (loan?.items || [])
      .map(it => `${it.brand || ''} ${it.model || ''}${it.qty && it.qty > 1 ? ` (${it.qty} เครื่อง)` : ''}`.trim())
      .filter(Boolean)
      .join(', ');

    const itemHtml = `
      <div class="confirm-loan-card">
        <div class="confirm-loan-header">
          <span class="confirm-loan-id">${escapeHtml(loanId)}</span>
          <span class="confirm-loan-badge">รอจัดของ</span>
        </div>
        <div class="confirm-loan-details">
          <div class="confirm-loan-row">
            <span class="confirm-loan-label">🏢 ลูกค้า:</span>
            <strong class="confirm-loan-val">${escapeHtml(company || '-')}</strong>
          </div>
          ${loan?.borrower_name ? `
          <div class="confirm-loan-row">
            <span class="confirm-loan-label">👤 ผู้ยืม:</span>
            <span class="confirm-loan-val">${escapeHtml(loan.borrower_name)}</span>
          </div>` : ''}
          ${itemsSummary ? `
          <div class="confirm-loan-row">
            <span class="confirm-loan-label">📦 สินค้า:</span>
            <span class="confirm-loan-val font-medium">${escapeHtml(itemsSummary)}</span>
          </div>` : ''}
        </div>
      </div>
    `;

    const confirmed = await showConfirmDialog({
      title: 'ยืนยันการยกเลิกใบยืมสินค้า',
      message: 'การยกเลิกจะลบใบยืมนี้และปลดล็อกเครื่องเดโม่คืนเข้าคลังทันที',
      itemHtml: itemHtml,
      icon: '🗑️',
      confirmText: '🗑️ ยืนยันยกเลิกใบยืม',
      cancelText: 'ไม่ยกเลิก (คงไว้)',
      confirmBtnClass: 'btn-danger'
    });

    if (!confirmed) {
      return;
    }

    try {
      const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'ไม่สามารถยกเลิกใบยืมได้');
      }

      // Close any opened dialog
      document.getElementById('dispatchDialog')?.close();
      document.getElementById('loanDialog')?.close();

      // Update state and re-render
      applyServerState(data.state || data);

      showToast(`🗑️ ยกเลิกใบยืม ${loanId} เรียบร้อยแล้ว`);
    } catch (err) {
      showToast('❌ ' + err.message);
    }
  }

  // Kanban & Table Delegated Actions
  document.addEventListener('click', async e => {
    // 1. Collapse / expand sub-status stack
    const subBtn = e.target.closest('[data-toggle-substack]');
    if (subBtn) {
      const key = subBtn.getAttribute('data-toggle-substack');
      if (state.collapsedSubGroups.has(key)) state.collapsedSubGroups.delete(key);
      else state.collapsedSubGroups.add(key);
      renderKanbanBoard();
      return;
    }

    // 2. Quick Advance Loan Stage on Kanban Card (รอจัดของ -> จัดเสร็จ Match S/N -> รอส่งมอบ -> กำลังยืม)
    const advBtn = e.target.closest('[data-advance-loan]');
    if (advBtn) {
      const loanId = advBtn.getAttribute('data-advance-loan');
      const nextStatus = advBtn.getAttribute('data-next-status');

      // When clicking "จัดเสร็จ" (Dispatched), open the Dispatch & Match S/N dialog!
      if (nextStatus === 'Dispatched') {
        if (document.getElementById('printDialog').open) {
          document.getElementById('printDialog').close();
        }
        openDispatchModal(loanId);
        return;
      }

      // When clicking "ส่งมอบ" (Delivered), open the Delivery Modal!
      if (nextStatus === 'Delivered') {
        openDeliveryModal(loanId);
        return;
      }

      try {
        const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: nextStatus })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'อัปเดตสถานะไม่สำเร็จ');
        applyServerState(data);
        if (document.getElementById('printDialog').open && state.activePrintLoanId === loanId) {
          renderGatePassHtml();
        }
        showToast(`✅ ย้ายใบยืม ${loanId} ไปยังสถานะถัดไปเรียบร้อย`);
      } catch (err) {
        showToast('⚠️ ' + err.message);
      }
      return;
    }

    // 3. Edit Loan / Tags
    const editBtn = e.target.closest('[data-edit-loan]');
    if (editBtn) {
      openEditLoanModal(editBtn.getAttribute('data-edit-loan'));
      return;
    }

    // 3.1 Cancel Loan (เฉพาะใบที่ยังไม่ได้จัดของ: Requested หรือ Dispatching)
    const cancelBtn = e.target.closest('[data-cancel-loan]');
    if (cancelBtn) {
      e.preventDefault();
      e.stopPropagation();
      const loanId = cancelBtn.getAttribute('data-cancel-loan');
      handleCancelLoan(loanId);
      return;
    }

    // 3.2 Open Delivery Modal (จากปุ่ม "ส่งมอบ" ในตาราง List หรือหน้าพิมพ์)
    const delBtn = e.target.closest('[data-open-delivery]');
    if (delBtn) {
      const loanId = delBtn.getAttribute('data-open-delivery');
      if (document.getElementById('printDialog')?.open) {
        document.getElementById('printDialog').close();
      }
      openDeliveryModal(loanId);
      return;
    }

    // 4. Open Return / QC Modal (uses unified Dispatch/Return modal)
    const retBtn = e.target.closest('[data-open-return]');
    if (retBtn) {
      openDispatchModal(retBtn.getAttribute('data-open-return'));
      return;
    }

    // 5. Open Print Gate Pass Modal (from Kanban Card, List Table, or any document link)
    const prtBtn = e.target.closest('[data-open-print], [data-open-loan]');
    if (prtBtn) {
      const loanId = prtBtn.getAttribute('data-open-print') || prtBtn.getAttribute('data-open-loan');
      if (loanId) {
        const assetDlg = document.getElementById('assetDetailModalDialog');
        if (assetDlg && assetDlg.hasAttribute('open')) {
          state.returnToAssetDetailTagId = state.currentDetailTagId;
          const activeTabBtn = document.querySelector('.asset-nav-tab-btn.active');
          state.returnToAssetDetailTab = activeTabBtn ? activeTabBtn.getAttribute('data-tab-target') : 'info';
        }
        openPrintModal(loanId);
      }
      return;
    }

    const editFromPrintBtn = e.target.closest('[data-edit-from-print]');
    if (editFromPrintBtn) {
      document.getElementById('printDialog').close();
      openEditLoanModal(editFromPrintBtn.getAttribute('data-edit-from-print'));
      return;
    }

    const retFromPrintBtn = e.target.closest('[data-return-from-print]');
    if (retFromPrintBtn) {
      document.getElementById('printDialog')?.close();
      openDispatchModal(retFromPrintBtn.getAttribute('data-return-from-print'));
      return;
    }

    const deliverFromPrintBtn = e.target.closest('[data-deliver-from-print]');
    if (deliverFromPrintBtn) {
      document.getElementById('printDialog').close();
      openDeliveryModal(deliverFromPrintBtn.getAttribute('data-deliver-from-print'));
      return;
    }

    const returnSlipBtn = e.target.closest('[data-open-return-slip]');
    if (returnSlipBtn) {
      e.preventDefault();
      e.stopPropagation();
      openReturnSlipModal(returnSlipBtn.getAttribute('data-open-return-slip'));
      return;
    }

    const supSaleReturnBtn = e.target.closest('[data-open-sup-sale-return]');
    if (supSaleReturnBtn) {
      e.preventDefault();
      e.stopPropagation();
      openSupplierSaleReturnModal(supSaleReturnBtn.getAttribute('data-open-sup-sale-return'));
      return;
    }

    const cardEl = e.target.closest('[data-card-loan]');
    if (cardEl && !e.target.closest('.min-actions-toolbar') && (!e.target.closest('button') || e.target.closest('.list-doc-pill'))) {
      const loanId = cardEl.getAttribute('data-card-loan');
      const loan = state.loans.find(l => l.id === loanId);
      if (loan && loan.status === 'Pending_Return_Supplier_Sale') {
        openSupplierSaleReturnModal(loan.id);
        return;
      }
      // If loan is waiting for picking, awaiting delivery, currently on loan, or pending QC:
      // Open the Dispatch & Item Inspection / Return screen directly!
      if (loan && (loan.status === 'Requested' || loan.status === 'Dispatching' || loan.status === 'Dispatched' || loan.status === 'Delivered' || loan.status === 'Pending_QC' || loan.status === 'Partially_Returned')) {
        openDispatchModal(loan.id);
        return;
      }
      openPrintModal(loanId);
      return;
    }
  });

  // ==========================================================================
  // EXCEL-LIKE LOAN MODAL EVENTS (MODEL-ONLY AT REQUEST TIME)
  // ==========================================================================
  const btnStart = document.getElementById('btnOpenAgodaStart');
  if (btnStart) {
    btnStart.addEventListener('click', e => {
      e.preventDefault();
      openAgodaDateRangeModal('start');
    });
  }

  const btnEnd = document.getElementById('btnOpenAgodaEnd');
  if (btnEnd) {
    btnEnd.addEventListener('click', e => {
      e.preventDefault();
      openAgodaDateRangeModal('end');
    });
  }

  const btnOpenAgodaDatePicker = document.getElementById('btnOpenAgodaDatePicker');
  if (btnOpenAgodaDatePicker) {
    btnOpenAgodaDatePicker.addEventListener('click', () => openAgodaDateRangeModal('start'));
  }

  const btnCloseAgodaDatePicker = document.getElementById('btnCloseAgodaDatePicker');
  if (btnCloseAgodaDatePicker) {
    btnCloseAgodaDatePicker.addEventListener('click', closeAgodaDateRangeModal);
  }

  const btnCancelAgodaPicker = document.getElementById('btnCancelAgodaPicker');
  if (btnCancelAgodaPicker) {
    btnCancelAgodaPicker.addEventListener('click', closeAgodaDateRangeModal);
  }

  const btnApplyAgodaPicker = document.getElementById('btnApplyAgodaPicker');
  if (btnApplyAgodaPicker) {
    btnApplyAgodaPicker.addEventListener('click', applyAgodaDateRange);
  }

  const btnAgodaReset = document.getElementById('btnAgodaReset');
  if (btnAgodaReset) {
    btnAgodaReset.addEventListener('click', resetAgodaToToday);
  }

  const btnAgodaPrevMonth = document.getElementById('btnAgodaPrevMonth');
  if (btnAgodaPrevMonth) {
    btnAgodaPrevMonth.addEventListener('click', () => navAgodaMonth(-1));
  }

  const btnAgodaNextMonth = document.getElementById('btnAgodaNextMonth');
  if (btnAgodaNextMonth) {
    btnAgodaNextMonth.addEventListener('click', () => navAgodaMonth(1));
  }

  document.querySelectorAll('[data-agoda-quick]').forEach(btn => {
    btn.addEventListener('click', () => {
      applyAgodaQuickPreset(btn.getAttribute('data-agoda-quick'));
    });
  });

  document.querySelectorAll('[data-add-days]').forEach(btn => {
    btn.addEventListener('click', () => setDueDatePlusDays(btn.getAttribute('data-add-days')));
  });

  const btnAddLoanRow = document.getElementById('btnAddLoanRow');
  if (btnAddLoanRow) {
    btnAddLoanRow.addEventListener('click', () => {
      const lastIdx = state.loanDraftRows.length - 1;
      const lastRow = state.loanDraftRows[lastIdx];
      let targetIdx;
      if (lastRow && !lastRow.model) {
        targetIdx = lastIdx;
      } else {
        ensureTrailingEmptyRow();
        targetIdx = state.loanDraftRows.length - 1;
      }
      if (state.loanDraftRows[targetIdx]) {
        state.loanDraftRows[targetIdx]._isNew = true;
      }
      state.activeLoanRowIdx = targetIdx;
      renderLoanExcelRows();
      setTimeout(() => {
        const inp = excelTbody.querySelector(`[data-excel-model-input="${state.activeLoanRowIdx}"]`);
        if (inp) inp.focus();
      }, 50);
    });
  }

  const excelTbody = document.getElementById('loanExcelRowsBody');

  // Input event: typing model name, accessory tag, qty, or free note
  excelTbody.addEventListener('input', e => {
    // 0. In-line Brand Input (for Supplier & คลังขาย)
    if (e.target.matches('[data-excel-brand-input]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-brand-input'));
      const text = e.target.value;
      const wrap = e.target.closest('.brand-field-wrap');
      const clearBtn = wrap ? wrap.querySelector('[data-clear-brand]') : null;
      if (clearBtn) {
        clearBtn.classList.toggle('hidden', !text.trim());
      }
      state.loanDraftRows[rowIdx].brand = text;
      renderBrandDropdown(rowIdx, text);
      return;
    }

    // 1. In-line Model Input: filter the dropdown in real-time WITHOUT re-rendering the whole table
    if (e.target.matches('[data-excel-model-input]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-model-input'));
      const text = e.target.value;
      const wrap = e.target.closest('.model-input-wrap');
      const clearBtn = wrap ? wrap.querySelector('.btn-clear-model-input') : null;
      if (clearBtn) {
        clearBtn.classList.toggle('hidden', !text.trim());
      }

      const isCustomSource = state.loanDraftRows[rowIdx]?.source === 'Supplier' || state.loanDraftRows[rowIdx]?.source === 'คลังขาย';
      if (isCustomSource) {
        state.loanDraftRows[rowIdx].model = text;
        // Keep brand intact for Supplier / คลังขาย
        return;
      }

      const matched = matchCatalogModel(text);

      if (matched) {
        state.loanDraftRows[rowIdx].brand = matched.brand;
        state.loanDraftRows[rowIdx].model = matched.model;
      } else {
        state.loanDraftRows[rowIdx].brand = '';
        state.loanDraftRows[rowIdx].model = text;
      }

      // Filter and position dropdown smoothly only when text is typed
      if (text.trim().length > 0) {
        renderModelDropdown(rowIdx, text);
      } else {
        closeAllModelDropdowns();
      }
      return;
    }

    // 2. In-line Accessory Tag Input: filter accessory suggestions dropdown in real-time
    if (e.target.matches('[data-excel-add-tag]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-add-tag'));
      renderAccessoryDropdown(rowIdx, e.target.value);
      return;
    }

    if (e.target.matches('[data-excel-source]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-source'));
      state.loanDraftRows[rowIdx].source = e.target.value;
      return;
    }

    if (e.target.matches('[data-excel-qty]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-qty'));
      state.loanDraftRows[rowIdx].qty = Math.max(1, parseInt(e.target.value || '1', 10) || 1);
      renderLoanExcelRows();
      return;
    }

    if (e.target.matches('[data-excel-free-note]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-free-note'));
      state.loanDraftRows[rowIdx].free_note = e.target.value;
      // Auto-expand textarea height as user types multiple lines, start at 1 line
      e.target.style.height = 'auto';
      if (e.target.value && (e.target.value.includes('\n') || e.target.scrollHeight > 26)) {
        e.target.style.height = `${Math.min(96, Math.max(22, e.target.scrollHeight))}px`;
      } else {
        e.target.style.height = '22px';
      }
    }
  });

  // Focus event: clicking or tabbing into inputs opens the corresponding rich floating list
  excelTbody.addEventListener('focusin', e => {
    if (e.target.matches('[data-excel-brand-input]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-brand-input'));
      closeAllModelDropdowns();
      renderBrandDropdown(rowIdx, e.target.value);
    } else if (e.target.matches('[data-excel-model-input]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-model-input'));
      const isCustomSource = state.loanDraftRows[rowIdx]?.source === 'Supplier' || state.loanDraftRows[rowIdx]?.source === 'คลังขาย';
      closeAllModelDropdowns();
      if (!isCustomSource && e.target.value.trim().length > 0) {
        renderModelDropdown(rowIdx, e.target.value);
      }
    } else if (e.target.matches('[data-excel-add-tag]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-add-tag'));
      closeAllModelDropdowns();
      renderAccessoryDropdown(rowIdx, e.target.value);
    }
  });

  // Prevent blur when clicking clear button in model / brand input or triggers
  document.addEventListener('mousedown', e => {
    if (e.target.closest('[data-clear-model]') || e.target.closest('[data-clear-brand]') || e.target.closest('[data-brand-dropdown-trigger]')) {
      e.preventDefault();
    }
  });

  // Clicking an item from either the rich model dropdown or the rich accessory dropdown
  document.addEventListener('click', e => {
    // 0a. Clear Brand for this row
    const clearBrandBtn = e.target.closest('[data-clear-brand]');
    if (clearBrandBtn) {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = Number(clearBrandBtn.getAttribute('data-clear-brand'));
      if (state.loanDraftRows[rowIdx]) {
        state.loanDraftRows[rowIdx].brand = '';
        const brandInp = excelTbody.querySelector(`[data-excel-brand-input="${rowIdx}"]`);
        if (brandInp) {
          brandInp.value = '';
          brandInp.focus();
        }
        clearBrandBtn.classList.add('hidden');
        renderBrandDropdown(rowIdx, '');
      }
      return;
    }

    // 0b. Toggle Brand Dropdown (▾ button)
    const brandArrowBtn = e.target.closest('[data-brand-dropdown-trigger]');
    if (brandArrowBtn) {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = Number(brandArrowBtn.getAttribute('data-brand-dropdown-trigger'));
      const brandDd = document.getElementById('globalBrandDropdown');
      const isCurrentlyOpen = brandDd && !brandDd.classList.contains('hidden') && brandDd.getAttribute('data-active-row') === String(rowIdx);
      closeAllModelDropdowns();
      if (!isCurrentlyOpen) {
        const brandInp = excelTbody.querySelector(`[data-excel-brand-input="${rowIdx}"]`);
        const q = brandInp ? brandInp.value : '';
        renderBrandDropdown(rowIdx, q);
      }
      return;
    }

    // 0c. Close Brand Dropdown (X button in header)
    if (e.target.closest('[data-close-brand-dropdown]')) {
      e.preventDefault();
      e.stopPropagation();
      closeAllModelDropdowns();
      return;
    }

    // 0d. Pick Brand item
    const brandItem = e.target.closest('.brand-dropdown-item[data-select-brand]');
    if (brandItem) {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = Number(brandItem.getAttribute('data-row'));
      const chosenBrand = brandItem.getAttribute('data-select-brand');
      if (state.loanDraftRows[rowIdx]) {
        state.loanDraftRows[rowIdx].brand = chosenBrand;
        const brandInp = excelTbody.querySelector(`[data-excel-brand-input="${rowIdx}"]`);
        if (brandInp) {
          brandInp.value = chosenBrand;
          const wrap = brandInp.closest('.brand-field-wrap');
          const clearBtn = wrap ? wrap.querySelector('[data-clear-brand]') : null;
          if (clearBtn) clearBtn.classList.remove('hidden');
        }
        // Advance focus to Model input
        const modelInp = excelTbody.querySelector(`[data-excel-model-input="${rowIdx}"]`);
        if (modelInp) {
          modelInp.focus();
        }
      }
      closeAllModelDropdowns();
      return;
    }

    // 0. Clear Model for this row (X button inside model input)
    const clearModelBtn = e.target.closest('[data-clear-model]');
    if (clearModelBtn) {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = Number(clearModelBtn.getAttribute('data-clear-model'));
      if (state.loanDraftRows[rowIdx]) {
        const isCustomSource = state.loanDraftRows[rowIdx].source === 'Supplier' || state.loanDraftRows[rowIdx].source === 'คลังขาย';
        if (!isCustomSource) {
          state.loanDraftRows[rowIdx].brand = '';
        }
        state.loanDraftRows[rowIdx].model = '';
        state.loanDraftRows[rowIdx].serials = [];
        state.loanDraftRows[rowIdx].accessories = [];
        closeAllModelDropdowns();
        renderLoanExcelRows();
        setTimeout(() => {
          const inp = excelTbody.querySelector(`[data-excel-model-input="${rowIdx}"]`);
          if (inp) {
            inp.focus();
          }
        }, 30);
      }
      return;
    }

    // 0. Close Accessory / Model Dropdown (X button)
    if (e.target.closest('[data-close-accessory-dropdown], .btn-close-dropdown')) {
      e.preventDefault();
      e.stopPropagation();
      closeAllModelDropdowns();
      return;
    }

    // Pick Model item
    const modelItem = e.target.closest('.model-dropdown-item[data-select-model]');
    if (modelItem) {
      const rowIdx = Number(modelItem.getAttribute('data-row'));
      const brand = modelItem.getAttribute('data-select-brand');
      const model = modelItem.getAttribute('data-select-model');
      if (state.loanDraftRows[rowIdx]) {
        state.loanDraftRows[rowIdx].brand = brand;
        state.loanDraftRows[rowIdx].model = model;
        ensureTrailingEmptyRow();
        renderLoanExcelRows();
        // Focus to tag input for this row so user can start adding tags immediately
        const tagInp = excelTbody.querySelector(`[data-excel-add-tag="${rowIdx}"]`);
        if (tagInp) tagInp.focus();
      }
      closeAllModelDropdowns();
      return;
    }

    // Pick Accessory item
    const accItem = e.target.closest('.model-dropdown-item[data-select-acc]');
    if (accItem) {
      const rowIdx = Number(accItem.getAttribute('data-row'));
      const accName = accItem.getAttribute('data-select-acc');
      if (state.loanDraftRows[rowIdx] && accName) {
        if (!state.loanDraftRows[rowIdx].accessories.includes(accName)) {
          state.loanDraftRows[rowIdx].accessories.push(accName);
        }
        renderLoanExcelRows();
        const tagInp = excelTbody.querySelector(`[data-excel-add-tag="${rowIdx}"]`);
        if (tagInp) {
          tagInp.value = '';
          tagInp.focus();
          renderAccessoryDropdown(rowIdx, '');
        }
      }
      return;
    }

    // Trigger Source dropdown
    const srcTrigger = e.target.closest('[data-source-trigger]');
    if (srcTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = Number(srcTrigger.getAttribute('data-source-trigger'));
      const dropdown = document.getElementById('globalSourceDropdown');
      const isCurrentlyOpen = dropdown && !dropdown.classList.contains('hidden') && dropdown.getAttribute('data-active-row') === String(rowIdx);
      closeAllModelDropdowns();
      if (!isCurrentlyOpen) {
        renderSourceDropdown(rowIdx);
      }
      return;
    }

    // Pick Source item
    const srcItem = e.target.closest('.model-dropdown-item[data-select-source]');
    if (srcItem) {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = Number(srcItem.getAttribute('data-row'));
      const chosenSource = srcItem.getAttribute('data-select-source');
      if (state.loanDraftRows[rowIdx]) {
        state.loanDraftRows[rowIdx].source = chosenSource;
        renderLoanExcelRows();
        // If switched to Supplier or คลังขาย, auto focus brand input
        if (chosenSource === 'Supplier' || chosenSource === 'คลังขาย') {
          setTimeout(() => {
            const brandInp = excelTbody.querySelector(`[data-excel-brand-input="${rowIdx}"]`);
            if (brandInp) {
              brandInp.focus();
              renderBrandDropdown(rowIdx, brandInp.value);
            }
          }, 50);
        }
      }
      closeAllModelDropdowns();
      return;
    }

    // Click outside -> close dropdowns
    if (
      !e.target.closest('.model-picker-cell') &&
      !e.target.closest('.tag-editor') &&
      !e.target.closest('.cell-source') &&
      !e.target.closest('.brand-field-wrap') &&
      !e.target.closest('#globalModelDropdown') &&
      !e.target.closest('#globalAccessoryDropdown') &&
      !e.target.closest('#globalSourceDropdown') &&
      !e.target.closest('#globalBrandDropdown')
    ) {
      closeAllModelDropdowns();
    }
  });

  // Change event: when user changes dropdown or completes input
  excelTbody.addEventListener('change', e => {
    if (e.target.matches('[data-excel-brand-input]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-brand-input'));
      state.loanDraftRows[rowIdx].brand = e.target.value.trim();
      return;
    }

    if (e.target.matches('[data-excel-model-input]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-model-input'));
      const text = e.target.value;
      const isCustomSource = state.loanDraftRows[rowIdx]?.source === 'Supplier' || state.loanDraftRows[rowIdx]?.source === 'คลังขาย';
      if (isCustomSource) {
        state.loanDraftRows[rowIdx].model = text.trim();
        ensureTrailingEmptyRow();
        return;
      }
      const matched = matchCatalogModel(text);
      if (matched) {
        state.loanDraftRows[rowIdx].brand = matched.brand;
        state.loanDraftRows[rowIdx].model = matched.model;
      } else {
        state.loanDraftRows[rowIdx].brand = '';
        state.loanDraftRows[rowIdx].model = text.trim();
      }
      ensureTrailingEmptyRow();
      renderLoanExcelRows();
      return;
    }

    // Change Source in Excel row
    if (e.target.matches('[data-excel-source]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-source'));
      state.loanDraftRows[rowIdx].source = e.target.value;
      return;
    }
  });

  // Adding Accessory Tag (Type and select from datalist, press Enter or comma)
  function commitAccessoryTag(inp) {
    const val = inp.value.replace(/,/g, '').trim();
    if (!val) return;
    const rowIdx = Number(inp.getAttribute('data-excel-add-tag'));
    if (!state.loanDraftRows[rowIdx]) return;
    const list = state.loanDraftRows[rowIdx].accessories;
    if (!list.includes(val)) {
      list.push(val);
      if (!state.accessorySuggestions.includes(val)) {
        state.accessorySuggestions.push(val);
        renderDatalists();
      }
    }
    renderLoanExcelRows();
    const nextInp = excelTbody.querySelector(`[data-excel-add-tag="${rowIdx}"]`);
    if (nextInp) {
      nextInp.value = '';
      nextInp.focus();
    }
  }

  excelTbody.addEventListener('change', e => {
    if (e.target.matches('[data-excel-add-tag]')) {
      commitAccessoryTag(e.target);
    }
  });

  excelTbody.addEventListener('keydown', e => {
    // Brand Input (Enter picks first item or text, advances to model input)
    if (e.target.matches('[data-excel-brand-input]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-brand-input'));
      if (e.key === 'Enter') {
        e.preventDefault();
        const brandDd = document.getElementById('globalBrandDropdown');
        const firstItem = brandDd ? brandDd.querySelector('.brand-dropdown-item') : null;
        if (firstItem && !brandDd.classList.contains('hidden')) {
          const chosen = firstItem.getAttribute('data-select-brand');
          if (chosen) {
            state.loanDraftRows[rowIdx].brand = chosen;
            e.target.value = chosen;
          }
        } else {
          state.loanDraftRows[rowIdx].brand = e.target.value.trim();
        }
        closeAllModelDropdowns();
        const modelInp = excelTbody.querySelector(`[data-excel-model-input="${rowIdx}"]`);
        if (modelInp) modelInp.focus();
      } else if (e.key === 'Escape') {
        closeAllModelDropdowns();
      }
      return;
    }

    if (e.target.matches('[data-excel-add-tag]')) {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        commitAccessoryTag(e.target);
      }
    }
    // Pressing Enter in free note confirms note and advances (Shift+Enter allows multiline)
    if (e.target.matches('[data-excel-free-note]') && e.key === 'Enter') {
      if (e.shiftKey) {
        // Shift+Enter: allow typing multiline without advancing
        return;
      }
      e.preventDefault();
      const rowIdx = Number(e.target.getAttribute('data-excel-free-note'));
      state.loanDraftRows[rowIdx].free_note = e.target.value.trim();
      e.target.value = state.loanDraftRows[rowIdx].free_note;

      // If user pressed Ctrl+Enter / Cmd+Enter, or if there is already a next row, advance to next row
      if (e.ctrlKey || e.metaKey) {
        ensureTrailingEmptyRow();
        state.activeLoanRowIdx = rowIdx + 1;
        renderLoanExcelRows();
        setTimeout(() => {
          const nextInp = excelTbody.querySelector(`[data-excel-model-input="${rowIdx + 1}"], [data-excel-brand-input="${rowIdx + 1}"]`);
          if (nextInp) {
            nextInp.focus();
            nextInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
        return;
      }

      if (rowIdx < state.loanDraftRows.length - 1) {
        state.activeLoanRowIdx = rowIdx + 1;
        renderLoanExcelRows();
        setTimeout(() => {
          const nextInp = excelTbody.querySelector(`[data-excel-model-input="${rowIdx + 1}"], [data-excel-brand-input="${rowIdx + 1}"]`);
          if (nextInp) {
            nextInp.focus();
            nextInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 50);
      } else {
        // Last row: keep note confirmed and advance focus to submit button
        e.target.blur();
        const submitBtn = document.getElementById('btnSubmitLoan') || document.querySelector('#loanForm button[type="submit"]');
        if (submitBtn) {
          submitBtn.focus();
        }
      }
      return;
    }

    // Pressing Enter or Down arrow in model input
    if (e.target.matches('[data-excel-model-input]')) {
      const rowIdx = Number(e.target.getAttribute('data-excel-model-input'));
      const dropdown = excelTbody.querySelector(`[data-model-dropdown="${rowIdx}"]`);
      if (e.key === 'Enter') {
        e.preventDefault();
        // If first dropdown item is visible, pick it
        const firstItem = dropdown ? dropdown.querySelector('.model-dropdown-item') : null;
        if (firstItem && !dropdown.classList.contains('hidden')) {
          const brand = firstItem.getAttribute('data-select-brand');
          const model = firstItem.getAttribute('data-select-model');
          state.loanDraftRows[rowIdx].brand = brand;
          state.loanDraftRows[rowIdx].model = model;
        }
        closeAllModelDropdowns();
        ensureTrailingEmptyRow();
        renderLoanExcelRows();
        const tagInp = excelTbody.querySelector(`[data-excel-add-tag="${rowIdx}"]`);
        if (tagInp) tagInp.focus();
      } else if (e.key === 'Escape') {
        closeAllModelDropdowns();
      }
    }
  });

  excelTbody.addEventListener('click', async e => {
    // 1. Expand a collapsed item card or placeholder row
    const expandTarget = e.target.closest('[data-expand-row]');
    if (expandTarget && !e.target.closest('[data-excel-rm-row]') && !e.target.closest('[data-excel-dup-row]')) {
      const rowIdx = Number(expandTarget.getAttribute('data-expand-row'));
      const targetRow = state.loanDraftRows[rowIdx];
      const isBlank = !targetRow || !targetRow.model;
      if (isBlank && targetRow) {
        targetRow._isNew = true;
      }
      state.activeLoanRowIdx = rowIdx;
      renderLoanExcelRows();
      setTimeout(() => {
        const rowEl = excelTbody.querySelector(`[data-row-idx="${rowIdx}"]`);
        if (rowEl) {
          rowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
        closeAllModelDropdowns();
        // Only focus model input if this is a blank new row, never when expanding an existing item to edit
        if (isBlank) {
          const inp = excelTbody.querySelector(`[data-excel-model-input="${rowIdx}"]`);
          if (inp) inp.focus();
        }
      }, 50);
      return;
    }

    // 2. Collapse active row
    const collapseTarget = e.target.closest('[data-collapse-row]');
    if (collapseTarget) {
      state.activeLoanRowIdx = -1;
      renderLoanExcelRows();
      return;
    }

    // 3. Step to next item helper
    const nextBtn = e.target.closest('[data-next-row]');
    if (nextBtn) {
      const curIdx = Number(nextBtn.getAttribute('data-next-row'));
      ensureTrailingEmptyRow();
      state.activeLoanRowIdx = curIdx + 1;
      renderLoanExcelRows();
      setTimeout(() => {
        const nextInp = excelTbody.querySelector(`[data-excel-model-input="${curIdx + 1}"]`);
        if (nextInp) {
          nextInp.focus();
          nextInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 50);
      return;
    }

    const rmTag = e.target.closest('[data-excel-rm-tag]');
    if (rmTag) {
      const rowIdx = Number(rmTag.getAttribute('data-excel-rm-tag'));
      const tagIdx = Number(rmTag.getAttribute('data-tag-idx'));
      state.loanDraftRows[rowIdx].accessories.splice(tagIdx, 1);
      renderLoanExcelRows();
      return;
    }
    const rmRow = e.target.closest('[data-excel-rm-row]');
    if (rmRow) {
      const rowIdx = Number(rmRow.getAttribute('data-excel-rm-row'));
      const row = state.loanDraftRows[rowIdx];
      if (!row) return;

      // Check if editing an existing loan AND this is the last remaining item with data
      if (state.editingLoanId) {
        const remainingFilledRows = state.loanDraftRows.filter((r, idx) => idx !== rowIdx && r.model && r.model.trim());
        if (remainingFilledRows.length === 0) {
          const modelDisplay = row.brand ? `${row.brand} ${row.model}` : (row.model || 'สินค้านี้');
          const confirmed = await showConfirmDialog({
            title: '⚠️ ลบรายการสุดท้าย & ยกเลิกใบยืม',
            message: `รายการนี้เป็นสินค้าชิ้นสุดท้ายในใบยืม ${state.editingLoanId}\nหากลบรายการนี้ ระบบจะทำการ "ยกเลิกใบยืมนี้" ทั้งหมด\n\nคุณแน่ใจหรือไม่ว่าต้องการลบรายการนี้และยกเลิกใบยืม?`,
            itemText: `${modelDisplay} (จำนวน ${row.qty || 1} เครื่อง)`,
            icon: '⚠️',
            confirmText: '🗑️ ยืนยันลบ & ยกเลิกใบยืม',
            cancelText: 'ยกเลิก (คงรายการไว้)',
            confirmBtnClass: 'btn-danger'
          });

          if (!confirmed) return;

          try {
            const loanId = state.editingLoanId;
            const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/cancel`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' }
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'ไม่สามารถยกเลิกใบยืมได้');

            document.getElementById('loanDialog')?.close();
            state.editingLoanId = null;
            applyServerState(data.state || data);
            showToast(`🗑️ ลบรายการสุดท้ายและยกเลิกใบยืม ${loanId} เรียบร้อยแล้ว`);

            if (state.viewMode !== 'kanban') {
              state.viewMode = 'kanban';
              document.querySelectorAll('.view-btn').forEach(b => {
                b.classList.toggle('active', b.getAttribute('data-view') === 'kanban');
              });
              updateUrlHash('kanban');
            }
            renderActiveView();
            renderHeaderCounters();
          } catch (err) {
            showToast('⚠️ ' + err.message);
          }
          return;
        }
      }

      const hasModel = Boolean(row.model && row.model.trim());
      const hasAccessories = Boolean(row.accessories && row.accessories.length > 0);
      const hasNote = Boolean(row.free_note && row.free_note.trim());
      const hasAtt = Boolean(row.attachments && row.attachments.length > 0);
      const hasQty = Number(row.qty || 1) > 1;

      const hasData = hasModel || hasAccessories || hasNote || hasQty || hasAtt;

      if (hasData) {
        let itemLabel = '';
        if (hasModel) {
          const modelDisplay = row.brand ? `${row.brand} ${row.model}` : row.model;
          itemLabel = `${modelDisplay} (จำนวน ${row.qty || 1} เครื่อง)`;
        } else if (hasAccessories) {
          itemLabel = `อุปกรณ์เสริม: ${row.accessories.join(', ')}`;
        } else if (hasNote) {
          itemLabel = `หมายเหตุ: ${row.free_note}`;
        } else if (hasAtt) {
          itemLabel = `ไฟล์แนบ (${row.attachments.length} ไฟล์)`;
        }

        const confirmed = await showConfirmDialog({
          title: 'ยืนยันการลบรายการ',
          message: 'แถวนี้มีข้อมูลระบุไว้ คุณต้องการลบรายการนี้ใช่หรือไม่?',
          itemText: itemLabel,
          confirmText: '🗑️ ยืนยันลบ',
          cancelText: 'ยกเลิก',
          icon: '🗑️'
        });

        if (!confirmed) return;
      }

      if (state.loanDraftRows.length > 1) {
        state.loanDraftRows.splice(rowIdx, 1);
      } else {
        state.loanDraftRows[0] = { brand: '', model: '', qty: 1, source: 'Demo', accessories: [], free_note: '', serials: [], attachments: [] };
      }
      if (state.activeLoanRowIdx >= state.loanDraftRows.length) {
        state.activeLoanRowIdx = Math.max(0, state.loanDraftRows.length - 1);
      }
      ensureTrailingEmptyRow();
      renderLoanExcelRows();
      return;
    }

    // Duplicate Row (Copy item to edit)
    const dupBtn = e.target.closest('[data-excel-dup-row]');
    if (dupBtn) {
      if (dupBtn.disabled) return;
      const rowIdx = Number(dupBtn.getAttribute('data-excel-dup-row'));
      const srcRow = state.loanDraftRows[rowIdx];
      if (srcRow) {
        const rowQty = Math.max(1, Number(srcRow.qty || 1));
        const filledSn = (srcRow.serials || []).map(s => String(s || '').trim()).filter(Boolean);
        const hasModel = Boolean(srcRow.model && srcRow.model.trim());
        const hasIncompleteSn = (filledSn.length > 0 && filledSn.length < rowQty);

        if (!hasModel) {
          showToast('⚠️ กรุณาเลือกรุ่นสินค้าก่อนคัดลอก', 'warning');
          return;
        }
        if (hasIncompleteSn) {
          showToast(`⚠️ กรุณาระบุ S/N ให้ครบตามจำนวน (${filledSn.length}/${rowQty}) ก่อนคัดลอก`, 'warning');
          return;
        }

        const cloned = {
          brand: srcRow.brand || '',
          model: srcRow.model || '',
          qty: Number(srcRow.qty || 1),
          source: srcRow.source || 'Demo',
          accessories: [...(srcRow.accessories || [])],
          free_note: srcRow.free_note || '',
          attachments: (srcRow.attachments || []).map(a => ({ ...a })),
          serials: [], // empty so physical S/N is not accidentally cloned
          _isNew: true
        };
        state.loanDraftRows.splice(rowIdx + 1, 0, cloned);
        state.activeLoanRowIdx = rowIdx + 1;
        ensureTrailingEmptyRow();
        renderLoanExcelRows();
        showToast(`📋 คัดลอกรายการ ${srcRow.model || ''} เรียบร้อย`);
        setTimeout(() => {
          const newRowEl = excelTbody.querySelector(`[data-row-idx="${rowIdx + 1}"]`);
          if (newRowEl) {
            newRowEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          }
          closeAllModelDropdowns();
        }, 50);
      }
      return;
    }

    // Open Accessories Modal (Click button to pick/configure accessories)
    const openAccBtn = e.target.closest('[data-open-acc-modal]');
    if (openAccBtn) {
      const rowIdx = Number(openAccBtn.getAttribute('data-open-acc-modal'));
      openAccModal(rowIdx);
      return;
    }

    // Clear all accessories for this row
    const clearAllAccBtn = e.target.closest('[data-clear-all-acc]');
    if (clearAllAccBtn) {
      const rowIdx = Number(clearAllAccBtn.getAttribute('data-clear-all-acc'));
      if (state.loanDraftRows[rowIdx]) {
        state.loanDraftRows[rowIdx].accessories = [];
        renderLoanExcelRows();
        showToast('ล้างอุปกรณ์เสริมของรายการนี้เรียบร้อย');
      }
      return;
    }

    // Open S/N Modal (Click button to enter S/N for booked quantity)
    const openSnBtn = e.target.closest('[data-open-sn-modal]');
    if (openSnBtn) {
      const rowIdx = Number(openSnBtn.getAttribute('data-open-sn-modal'));
      openSnModal(rowIdx);
      return;
    }

    // Clear all S/N for this row
    const clearAllSnBtn = e.target.closest('[data-clear-all-sn]');
    if (clearAllSnBtn) {
      const rowIdx = Number(clearAllSnBtn.getAttribute('data-clear-all-sn'));
      if (state.loanDraftRows[rowIdx]) {
        state.loanDraftRows[rowIdx].serials = [];
        renderLoanExcelRows();
        showToast('ล้าง S/N ของรายการนี้เรียบร้อย');
      }
      return;
    }

    // Step - button (decrease quantity)
    const decBtn = e.target.closest('[data-qty-dec]');
    if (decBtn) {
      const rowIdx = Number(decBtn.getAttribute('data-qty-dec'));
      const cur = Number(state.loanDraftRows[rowIdx].qty || 1);
      const next = Math.max(1, cur - 1);
      state.loanDraftRows[rowIdx].qty = next;
      if (state.loanDraftRows[rowIdx].serials && state.loanDraftRows[rowIdx].serials.length > next) {
        state.loanDraftRows[rowIdx].serials = state.loanDraftRows[rowIdx].serials.slice(0, next);
      }
      renderLoanExcelRows();
      return;
    }

    // Step + button (increase quantity)
    const incBtn = e.target.closest('[data-qty-inc]');
    if (incBtn) {
      const rowIdx = Number(incBtn.getAttribute('data-qty-inc'));
      const cur = Number(state.loanDraftRows[rowIdx].qty || 1);
      const next = Math.min(99, cur + 1);
      state.loanDraftRows[rowIdx].qty = next;
      renderLoanExcelRows();
      return;
    }

    // Trigger Attach File in Note
    const triggerAttachBtn = e.target.closest('[data-trigger-attach]');
    if (triggerAttachBtn) {
      const rowIdx = Number(triggerAttachBtn.getAttribute('data-trigger-attach'));
      const fileInput = excelTbody.querySelector(`[data-note-file-input="${rowIdx}"]`);
      if (fileInput) {
        fileInput.value = '';
        fileInput.click();
      }
      return;
    }

    // Remove Attachment from Note
    const rmAttBtn = e.target.closest('[data-remove-att-row]');
    if (rmAttBtn) {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = Number(rmAttBtn.getAttribute('data-remove-att-row'));
      const attIdx = Number(rmAttBtn.getAttribute('data-remove-att-idx'));
      if (state.loanDraftRows[rowIdx] && state.loanDraftRows[rowIdx].attachments) {
        const removed = state.loanDraftRows[rowIdx].attachments.splice(attIdx, 1);
        renderLoanExcelRows();
        showToast(`🗑️ ลบไฟล์แนบ ${removed[0]?.name || ''} เรียบร้อย`);
      }
      return;
    }

    // Preview Attachment from Note
    const previewTrigger = e.target.closest('[data-preview-att-row]');
    if (previewTrigger) {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = Number(previewTrigger.getAttribute('data-preview-att-row'));
      const attIdx = Number(previewTrigger.getAttribute('data-preview-att-idx'));
      const row = state.loanDraftRows[rowIdx];
      if (row && row.attachments && row.attachments[attIdx]) {
        openFilePreview(row.attachments, attIdx);
      }
      return;
    }
  });

  // File input change for note attachments
  excelTbody.addEventListener('change', async e => {
    if (e.target.matches('[data-note-file-input]')) {
      const rowIdx = Number(e.target.getAttribute('data-note-file-input'));
      await uploadNoteFiles(rowIdx, e.target.files);
    }
  });

  // Paste image/file into note textarea
  excelTbody.addEventListener('paste', async e => {
    if (e.target.matches('[data-excel-free-note]')) {
      const clipboardData = e.clipboardData || window.clipboardData;
      if (!clipboardData || !clipboardData.items) return;
      const filesToUpload = [];
      for (const item of clipboardData.items) {
        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (file) filesToUpload.push(file);
        }
      }
      if (filesToUpload.length > 0) {
        e.preventDefault();
        const rowIdx = Number(e.target.getAttribute('data-excel-free-note'));
        await uploadNoteFiles(rowIdx, filesToUpload);
      }
    }
  });

  // File Preview Modal Close handlers & Gallery Navigation
  const filePreviewModal = document.getElementById('filePreviewModalDialog');
  if (filePreviewModal) {
    document.getElementById('btnClosePreviewModal')?.addEventListener('click', () => {
      filePreviewModal.close();
    });
    filePreviewModal.addEventListener('click', e => {
      if (e.target === filePreviewModal) {
        filePreviewModal.close();
      }
    });

    // Carousel Prev/Next Buttons
    document.getElementById('btnPreviewPrev')?.addEventListener('click', e => {
      e.stopPropagation();
      prevPreviewItem();
    });
    document.getElementById('btnPreviewNext')?.addEventListener('click', e => {
      e.stopPropagation();
      nextPreviewItem();
    });

    // Carousel Thumbnail strip clicks
    document.getElementById('previewThumbnailsTrack')?.addEventListener('click', e => {
      const btn = e.target.closest('[data-preview-goto-idx]');
      if (btn) {
        e.stopPropagation();
        const idx = Number(btn.getAttribute('data-preview-goto-idx'));
        if (!isNaN(idx)) {
          previewCurrentIndex = idx;
          renderCurrentPreviewItem();
        }
      }
    });

    // Keyboard navigation (ArrowLeft / ArrowRight / Escape)
    window.addEventListener('keydown', e => {
      if (filePreviewModal && filePreviewModal.open) {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          prevPreviewItem();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          nextPreviewItem();
        }
      }
    });

    // Touch swipe navigation for mobile & tablet
    const lightboxBody = document.getElementById('previewLightboxBody');
    if (lightboxBody) {
      let touchStartX = 0;
      let touchStartY = 0;
      lightboxBody.addEventListener('touchstart', e => {
        if (e.touches && e.touches.length === 1) {
          touchStartX = e.touches[0].clientX;
          touchStartY = e.touches[0].clientY;
        }
      }, { passive: true });

      lightboxBody.addEventListener('touchend', e => {
        if (e.changedTouches && e.changedTouches.length === 1) {
          const diffX = e.changedTouches[0].clientX - touchStartX;
          const diffY = e.changedTouches[0].clientY - touchStartY;
          // Threshold of 40px and predominantly horizontal
          if (Math.abs(diffX) > 40 && Math.abs(diffX) > Math.abs(diffY) * 1.5) {
            if (diffX < 0) {
              nextPreviewItem();
            } else {
              prevPreviewItem();
            }
          }
        }
      }, { passive: true });
    }
  }

  const clearDispatchSigBtn = document.getElementById('btnClearDispatchSignature');
  if (clearDispatchSigBtn) {
    clearDispatchSigBtn.addEventListener('click', clearSignatureCanvas);
  }

  document.querySelectorAll('[form="loanForm"], #loanForm button[type="submit"]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.printAfterSave = btn.getAttribute('data-print-after') === 'true';
    });
  });

  document.getElementById('loanForm').addEventListener('submit', async e => {
    e.preventDefault();

    if (state.editingLoanNoteOnly && state.editingLoanId) {
      const notePayload = {
        items: state.loanDraftRows.map(r => ({
          id: r.id,
          free_note: r.free_note || ''
        }))
      };
      try {
        const targetId = state.editingLoanId;
        const res = await fetch(`/api/loans/${encodeURIComponent(targetId)}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notePayload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
        applyServerState(data);
        showToast(`✅ บันทึกหมายเหตุใบยืม ${targetId} เรียบร้อย`);
        document.getElementById('loanDialog')?.close();
        if (state.printAfterSave) openPrintModal(targetId);
        focusLoanCardInKanban(targetId);
      } catch (err) {
        showToast('⚠️ ' + err.message);
      }
      return;
    }

    // Auto-commit any pending text in tag inputs
    document.querySelectorAll('[data-excel-add-tag]').forEach(inp => {
      const val = inp.value.replace(/,/g, '').trim();
      const idx = Number(inp.getAttribute('data-excel-add-tag'));
      if (val && state.loanDraftRows[idx] && !state.loanDraftRows[idx].accessories.includes(val)) {
        state.loanDraftRows[idx].accessories.push(val);
      }
    });

    const validRows = state.loanDraftRows.filter(r => r.model && r.model.trim());
    if (validRows.length === 0) {
      showToast('⚠️ กรุณาเลือกรุ่นสินค้าในตารางอย่างน้อย 1 รุ่น');
      state.activeLoanRowIdx = 0;
      renderLoanExcelRows();
      const firstInput = document.querySelector('[data-excel-model-input="0"]');
      if (firstInput) {
        firstInput.focus();
        firstInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
        firstInput.classList.add('input-attention-ring');
        setTimeout(() => firstInput.classList.remove('input-attention-ring'), 1500);
      }
      return;
    }

    // Validate Brand for Supplier & คลังขาย items
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const isSupplierOrSale = r.source === 'Supplier' || r.source === 'คลังขาย';
      if (isSupplierOrSale && (!r.brand || !r.brand.trim())) {
        showToast(`⚠️ รายการที่ ${i + 1} (${r.model || 'สินค้านี้'}): กรุณาระบุแบรนด์สินค้าสำหรับสินค้าจาก ${r.source}`);
        state.activeLoanRowIdx = state.loanDraftRows.indexOf(r);
        renderLoanExcelRows();
        setTimeout(() => {
          const brandInp = document.querySelector(`[data-excel-brand-input="${state.activeLoanRowIdx}"]`);
          if (brandInp) {
            brandInp.focus();
            brandInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
            brandInp.classList.add('input-attention-ring');
            setTimeout(() => brandInp.classList.remove('input-attention-ring'), 1500);
          }
        }, 100);
        return;
      }
    }

    // Validate optional S/N vs Quantity rule: If S/N is entered, must have exact count of qty
    for (let i = 0; i < validRows.length; i++) {
      const r = validRows[i];
      const rowQty = Math.max(1, Number(r.qty || 1));
      const filledSerials = (r.serials || []).map(s => String(s || '').trim()).filter(Boolean);
      if (filledSerials.length > 0 && filledSerials.length !== rowQty) {
        showToast(`⚠️ รายการที่ ${i + 1} (${r.model || 'สินค้านี้'}): ระบุ S/N ไม่ครบตามจำนวน (ใส่ ${filledSerials.length}/${rowQty} เครื่อง) หากต้องการระบุ S/N ต้องใส่ให้ครบตามจำนวน หรือลบ S/N ออกเพื่อรอคนจัดของ Match ภายหลัง`);
        state.activeLoanRowIdx = state.loanDraftRows.indexOf(r);
        renderLoanExcelRows();
        setTimeout(() => {
          openSnModal(state.activeLoanRowIdx);
        }, 100);
        return;
      }
    }

    const borrowerName = document.getElementById('loanBorrower').value.trim();
    if (!borrowerName) {
      showToast('⚠️ กรุณาระบุชื่อผู้ยืม (Sales)');

      // ย่อรายการยืมของแต่ละรายการทั้งหมดก่อนจะให้กรอกชื่อผู้ยืม ตามคำขอของผู้ใช้
      state.activeLoanRowIdx = -1;
      renderLoanExcelRows();

      expandTopInfoDrawer();
      const borrowerInp = document.getElementById('loanBorrower');
      if (borrowerInp) {
        borrowerInp.focus();
        borrowerInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        borrowerInp.classList.add('input-attention-ring');
        setTimeout(() => borrowerInp.classList.remove('input-attention-ring'), 1500);
      }
      return;
    }

    const companyName = document.getElementById('loanCompany').value.trim();
    if (!companyName) {
      showToast('⚠️ กรุณาระบุบริษัทลูกค้า');

      state.activeLoanRowIdx = -1;
      renderLoanExcelRows();

      expandTopInfoDrawer();
      const companyInp = document.getElementById('loanCompany');
      if (companyInp) {
        companyInp.focus();
        companyInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        companyInp.classList.add('input-attention-ring');
        setTimeout(() => companyInp.classList.remove('input-attention-ring'), 1500);
      }
      return;
    }

    const customerName = document.getElementById('loanCustomer').value.trim();
    if (!customerName) {
      showToast('⚠️ กรุณาระบุชื่อผู้ติดต่อ');

      state.activeLoanRowIdx = -1;
      renderLoanExcelRows();

      expandTopInfoDrawer();
      const customerInp = document.getElementById('loanCustomer');
      if (customerInp) {
        customerInp.focus();
        customerInp.scrollIntoView({ behavior: 'smooth', block: 'center' });
        customerInp.classList.add('input-attention-ring');
        setTimeout(() => customerInp.classList.remove('input-attention-ring'), 1500);
      }
      return;
    }

    // Real-time stock simulation check before final submission
    const simMap = getStockSimulationMap();
    const shortItems = [];
    for (const [key, sim] of simMap.entries()) {
      if (sim.isAutoSupplier || sim.isAutoSale) continue;
      if (!sim.isSufficient) {
        shortItems.push(`• รุ่น ${key.toUpperCase()}: ขอรวม ${sim.totalRequested} เครื่อง (ในคลังว่าง ${sim.available} เครื่อง, ขาด ${sim.shortage} เครื่อง)`);
      }
    }

    if (shortItems.length > 0) {
      const proceed = await showConfirmDialog({
        title: '⚠️ สินค้าในคลังมีไม่พอตามจำนวนที่ขอ',
        message: `ระบบทดลองจองสินค้าพบว่าจำนวนที่ขอเกินสต็อกพร้อมส่งในคลัง:\n\n${shortItems.join('\n')}\n\nต้องการบันทึกใบยืมเพื่อรอจัดหาต่อหรือไม่?`,
        confirmText: 'ยืนยันบันทึก',
        cancelText: 'กลับไปปรับจำนวน',
        icon: '⚠️'
      });
      if (!proceed) return;
    }

    // Auto-dispatch check: If all valid items have full S/N, loan is considered complete and ready for handover!
    const totalUnits = validRows.reduce((sum, r) => sum + Math.max(1, Number(r.qty || 1)), 0);
    const unitsWithSn = validRows.reduce((sum, r) => {
      const rowQty = Math.max(1, Number(r.qty || 1));
      const f = (r.serials || []).map(s => String(s || '').trim()).filter(Boolean);
      return sum + (f.length === rowQty ? f.length : 0);
    }, 0);

    let submitStatus = document.getElementById('loanInitialStatus').value;
    if (totalUnits > 0 && unitsWithSn === totalUnits) {
      submitStatus = 'Dispatched';
    }

    const payload = {
      borrower_name: borrowerName,
      customer_name: document.getElementById('loanCustomer').value.trim(),
      customer_phone: document.getElementById('loanCustomerPhone').value.trim(),
      customer_company: document.getElementById('loanCompany').value.trim(),
      purpose: document.getElementById('loanPurpose').value,
      status: submitStatus,
      checkout_date: document.getElementById('loanCheckoutDate').value,
      due_date: document.getElementById('loanDueDate').value,
      items: validRows,
      created_by: (state.currentUser && state.currentUser.email) || ''
    };

    try {
      if (state.editingLoanId) {
        const targetId = state.editingLoanId;
        const res = await fetch(`/api/loans/${encodeURIComponent(targetId)}/update`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'บันทึกไม่สำเร็จ');
        applyServerState(data);

        // Collapse all items
        state.activeLoanRowIdx = -1;
        state.editingLoanId = null;

        showToast(`✅ บันทึกการแก้ไขใบยืม ${targetId} เรียบร้อย`);
        document.getElementById('loanDialog')?.close();
        if (state.printAfterSave) openPrintModal(targetId);
        focusLoanCardInKanban(targetId);
      } else {
        const res = await fetch('/api/loans', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const result = await res.json();
        if (!res.ok) throw new Error(result.error || 'ออกใบยืมไม่สำเร็จ');
        const targetId = result.loanId;
        applyServerState(result.state);

        // Collapse all items and reset editing state
        state.activeLoanRowIdx = -1;
        state.editingLoanId = null;

        showToast(`✅ ออกใบยืม ${targetId} เรียบร้อยแล้ว`);
        document.getElementById('loanDialog')?.close();
        if (state.printAfterSave) openPrintModal(targetId);
        focusLoanCardInKanban(targetId);
      }
    } catch (err) {
      showToast('⚠️ ' + err.message);
    }
  });

  // ==========================================================================
  // S/N PICKER MODAL EVENTS (สำหรับผู้ยืม/Sales ที่มีเครื่องในมือแล้ว)
  // ==========================================================================
  // S/N Slots Validation & Real-time Confirmation
  let isSnSlotValidating = false;

  function advanceToNextSnSlot(inputEl) {
    const container = document.getElementById('snModalSlotsList');
    if (!container) return;
    const slotIdx = Number(inputEl.getAttribute('data-sn-modal-idx'));
    const nextInput = container.querySelector(`[data-sn-modal-idx="${slotIdx + 1}"]`);
    if (nextInput) {
      nextInput.focus();
      nextInput.select();
    } else {
      // Last slot -> check if all slots are filled, then automatically confirm and save!
      const allInputs = Array.from(container.querySelectorAll('.sn-modal-slot-input'));
      const allFilled = allInputs.length > 0 && allInputs.every(inp => inp.value.trim().length > 0);
      if (allFilled) {
        document.getElementById('btnSaveSnModal')?.click();
      } else {
        const emptyInp = allInputs.find(inp => !inp.value.trim());
        if (emptyInp) {
          emptyInp.focus();
        } else {
          inputEl.blur();
        }
      }
    }
  }

  async function validateAndConfirmSlot(inputEl, advanceOnSuccess = false) {
    if (isSnSlotValidating || !inputEl) return true;
    const val = inputEl.value.trim();
    const row = state.loanDraftRows[state.activeSnModalRowIdx];
    if (!row) return true;

    const isDemo = String(row.source || 'Demo').trim().toLowerCase() === 'demo';
    if (!isDemo || !val) {
      if (val) {
        inputEl.dataset.confirmedSn = val;
      } else {
        inputEl.dataset.confirmedSn = '';
      }
      closeSnDropdown();
      if (advanceOnSuccess && val) {
        advanceToNextSnSlot(inputEl);
      }
      return true;
    }

    // Check if found in Demo database for this model
    const asset = findDemoAssetBySn(val, row.brand, row.model);
    if (asset) {
      inputEl.dataset.confirmedSn = val;
      closeSnDropdown();
      if (advanceOnSuccess) advanceToNextSnSlot(inputEl);
      return true;
    }

    // If already confirmed by user for this exact S/N
    if (inputEl.dataset.confirmedSn === val) {
      closeSnDropdown();
      if (advanceOnSuccess) advanceToNextSnSlot(inputEl);
      return true;
    }

    // Not found in Demo warehouse -> Show confirmation dialog immediately when finished entering
    closeSnDropdown();
    isSnSlotValidating = true;
    const modelDisplayName = row.brand ? `${row.brand} ${row.model}` : (row.model || 'สินค้านี้');

    const confirmed = await showConfirmDialog({
      title: '⚠️ ไม่พบ S/N ในฐานข้อมูลคลัง Demo',
      message: `ไม่พบ S/N "${val}" ในฐานข้อมูลสินค้าคลัง Demo (${modelDisplayName})\n\nคุณต้องการยืนยันเพิ่ม S/N นี้เข้าเอกสารหรือไม่?`,
      itemText: `S/N: ${val}`,
      confirmText: '✓ ยืนยันเพิ่มเข้าเอกสาร',
      cancelText: 'ยกเลิก / แก้ไขใหม่',
      icon: '⚠️',
      confirmBtnClass: 'btn-primary'
    });

    isSnSlotValidating = false;

    if (confirmed) {
      inputEl.dataset.confirmedSn = val;
      if (advanceOnSuccess) advanceToNextSnSlot(inputEl);
      return true;
    } else {
      inputEl.dataset.confirmedSn = '';
      inputEl.value = '';
      const rowEl = inputEl.closest('.sn-modal-slot-row');
      const clearBtn = rowEl ? rowEl.querySelector('.btn-clear-sn-slot') : null;
      if (clearBtn) clearBtn.classList.add('hidden');
      inputEl.focus();
      return false;
    }
  }

  const snModalSlotsContainer = document.getElementById('snModalSlotsList');
  if (snModalSlotsContainer) {
    snModalSlotsContainer.addEventListener('focusin', e => {
      if (e.target.matches('.sn-modal-slot-input')) {
        const val = (e.target.value || '').trim();
        const row = state.loanDraftRows[state.activeSnModalRowIdx];
        const isDemo = row && String(row.source || 'Demo').trim().toLowerCase() === 'demo';
        if (isDemo && val.length > 0) {
          const slotIdx = Number(e.target.getAttribute('data-sn-modal-idx'));
          renderSnDropdown(slotIdx, e.target.value);
        }
      }
    });

    snModalSlotsContainer.addEventListener('input', e => {
      if (e.target.matches('.sn-modal-slot-input')) {
        const slotIdx = Number(e.target.getAttribute('data-sn-modal-idx'));
        const val = e.target.value;
        const row = state.loanDraftRows[state.activeSnModalRowIdx];
        const isDemo = row && String(row.source || 'Demo').trim().toLowerCase() === 'demo';

        // Reset confirmedSn if user modifies the text
        if (e.target.dataset.confirmedSn && e.target.dataset.confirmedSn !== val.trim()) {
          e.target.dataset.confirmedSn = '';
        }

        // Dropdown list appears only when typing or arrow clicked
        if (isDemo && val.trim().length > 0) {
          renderSnDropdown(slotIdx, val);
        } else {
          closeSnDropdown();
        }

        const rowEl = e.target.closest('.sn-modal-slot-row');
        const clearBtn = rowEl ? rowEl.querySelector('.btn-clear-sn-slot') : null;
        if (clearBtn) {
          clearBtn.classList.toggle('hidden', !val.trim());
        }
      }
    });

    // When finished typing and leaving slot (blur/change)
    snModalSlotsContainer.addEventListener('change', e => {
      if (e.target.matches('.sn-modal-slot-input')) {
        validateAndConfirmSlot(e.target, false);
      }
    });

    // When pressing Enter (or scanned by barcode reader)
    snModalSlotsContainer.addEventListener('keydown', e => {
      if (e.target.matches('.sn-modal-slot-input') && e.key === 'Enter') {
        e.preventDefault();
        validateAndConfirmSlot(e.target, true);
      }
    });

    snModalSlotsContainer.addEventListener('click', e => {
      // Toggle dropdown arrow
      const toggleArrow = e.target.closest('[data-toggle-sn-slot]');
      if (toggleArrow) {
        e.stopPropagation();
        const row = state.loanDraftRows[state.activeSnModalRowIdx];
        const isDemo = row && String(row.source || 'Demo').trim().toLowerCase() === 'demo';
        if (!isDemo) {
          closeSnDropdown();
          return;
        }
        const slotIdx = Number(toggleArrow.getAttribute('data-toggle-sn-slot'));
        const inp = snModalSlotsContainer.querySelector(`[data-sn-modal-idx="${slotIdx}"]`);
        const dropdown = document.getElementById('snModalDropdownMenu');
        if (dropdown && !dropdown.classList.contains('hidden')) {
          closeSnDropdown();
        } else {
          renderSnDropdown(slotIdx, inp ? inp.value : '');
        }
        return;
      }

      // Clear single slot
      const clearSlotBtn = e.target.closest('[data-clear-modal-slot]');
      if (clearSlotBtn) {
        const rowEl = clearSlotBtn.closest('.sn-modal-slot-row');
        const inp = rowEl ? rowEl.querySelector('.sn-modal-slot-input') : null;
        if (inp) {
          inp.value = '';
          inp.dataset.confirmedSn = '';
          clearSlotBtn.classList.add('hidden');
          closeSnDropdown();
          inp.focus();
        }
      }
    });
  }

  // Handle click on S/N dropdown item
  const snDropdownMenu = document.getElementById('snModalDropdownMenu');
  if (snDropdownMenu) {
    snDropdownMenu.addEventListener('click', e => {
      const item = e.target.closest('[data-select-modal-sn]');
      if (item && !item.classList.contains('disabled')) {
        const snVal = item.getAttribute('data-select-modal-sn');
        const slotIdx = Number(item.getAttribute('data-slot-idx'));
        const targetInput = document.querySelector(`[data-sn-modal-idx="${slotIdx}"]`);
        if (targetInput) {
          targetInput.value = snVal;
          targetInput.dataset.confirmedSn = snVal;
          const rowEl = targetInput.closest('.sn-modal-slot-row');
          const clearBtn = rowEl ? rowEl.querySelector('.btn-clear-sn-slot') : null;
          if (clearBtn) clearBtn.classList.remove('hidden');

          closeSnDropdown();

          // If there is a next slot, focus next slot
          advanceToNextSnSlot(targetInput);
        }
      }
    });
  }

  // Close S/N dropdown on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('#snModalDropdownMenu') &&
        !e.target.closest('.sn-modal-slot-row') &&
        !e.target.closest('[data-toggle-sn-slot]')) {
      closeSnDropdown();
    }
  });

  document.getElementById('btnCloseSnModal')?.addEventListener('click', closeSnDropdown);
  document.getElementById('btnCancelSnModal')?.addEventListener('click', closeSnDropdown);

  document.getElementById('btnSaveSnModal')?.addEventListener('click', async () => {
    if (state.activeSnModalRowIdx === null || !state.loanDraftRows[state.activeSnModalRowIdx]) {
      document.getElementById('snModalDialog')?.close();
      return;
    }
    const savedRowIdx = state.activeSnModalRowIdx;
    const row = state.loanDraftRows[savedRowIdx];
    const rowQty = Math.max(1, Number(row.qty || 1));
    const inputs = Array.from(document.querySelectorAll('.sn-modal-slot-input[data-sn-modal-idx]'));
    const values = inputs.map(i => i.value.trim());
    const filled = values.filter(Boolean);

    const alertEl = document.getElementById('snModalAlert');

    if (filled.length > 0 && filled.length !== rowQty) {
      if (alertEl) {
        alertEl.textContent = `⚠️ ต้องใส่ S/N ให้ครบทั้ง ${rowQty} เครื่อง (ระบุแล้ว ${filled.length}/${rowQty}) หรือกด 'ล้าง' หากไม่ต้องการระบุ`;
        alertEl.classList.remove('hidden');
      }
      const emptyInp = inputs.find(i => !i.value.trim());
      if (emptyInp) {
        emptyInp.focus();
        emptyInp.classList.add('input-attention-ring');
        setTimeout(() => emptyInp.classList.remove('input-attention-ring'), 1500);
      }
      return;
    }

    if (filled.length === 0) {
      row.serials = [];
      renderLoanExcelRows();
      document.getElementById('snModalDialog')?.close();
      showToast('⚪ ยังไม่ระบุ S/N (รอคนจัดของ Match)');
      setTimeout(() => {
        if (savedRowIdx !== null && savedRowIdx !== undefined) {
          const noteTa = document.querySelector(`[data-excel-free-note="${savedRowIdx}"]`);
          if (noteTa) noteTa.focus();
        }
      }, 80);
      return;
    }

    // Safety check: ensure any unconfirmed Demo S/N is confirmed before saving
    const isDemo = String(row.source || 'Demo').trim().toLowerCase() === 'demo';
    if (isDemo) {
      for (const inp of inputs) {
        const val = inp.value.trim();
        if (val && !findDemoAssetBySn(val, row.brand, row.model) && inp.dataset.confirmedSn !== val) {
          const ok = await validateAndConfirmSlot(inp, false);
          if (!ok) return;
        }
      }
    }

    const finalValues = inputs.map(i => i.value.trim());
    row.serials = [...finalValues];
    renderLoanExcelRows();
    document.getElementById('snModalDialog')?.close();
    showToast(`✅ ระบุ S/N ครบ ${rowQty} เครื่องเรียบร้อย`);
    setTimeout(() => {
      if (savedRowIdx !== null && savedRowIdx !== undefined) {
        const noteTa = document.querySelector(`[data-excel-free-note="${savedRowIdx}"]`);
        if (noteTa) {
          noteTa.focus();
        }
      }
    }, 80);
  });

  document.getElementById('btnClearSnModal')?.addEventListener('click', () => {
    if (state.activeSnModalRowIdx !== null && state.loanDraftRows[state.activeSnModalRowIdx]) {
      state.loanDraftRows[state.activeSnModalRowIdx].serials = [];
      renderLoanExcelRows();
      document.getElementById('snModalDialog')?.close();
      showToast('ล้าง S/N เรียบร้อย');
    }
  });

  document.querySelectorAll('#btnCloseSnModal, #btnCancelSnModal, [data-close-sn-dialog]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('snModalDialog')?.close();
    });
  });

  // ==========================================================================
  // ACCESSORIES PICKER MODAL EVENTS (กดปุ่มเลือกอุปกรณ์เสริม)
  // ==========================================================================
  const accModalBody = document.querySelector('#accModalDialog .acc-modal-body');
  if (accModalBody) {
    accModalBody.addEventListener('click', e => {
      // 1. Remove selected tag
      const rmBtn = e.target.closest('[data-acc-temp-rm]');
      if (rmBtn) {
        const idx = Number(rmBtn.getAttribute('data-acc-temp-rm'));
        state.tempAccList.splice(idx, 1);
        renderAccModalBody();
        return;
      }

      // 2. Toggle suggestion pill
      const toggleBtn = e.target.closest('[data-toggle-sugg]');
      if (toggleBtn) {
        const name = toggleBtn.getAttribute('data-toggle-sugg');
        const existingIdx = state.tempAccList.indexOf(name);
        if (existingIdx >= 0) {
          state.tempAccList.splice(existingIdx, 1);
        } else {
          state.tempAccList.push(name);
        }
        renderAccModalBody();
        return;
      }
    });
  }

  function commitCustomAccTag() {
    const inp = document.getElementById('accModalCustomInput');
    if (!inp) return;
    const val = inp.value.trim();
    if (!val) return;
    if (!state.tempAccList.includes(val)) {
      state.tempAccList.push(val);
      if (!state.accessorySuggestions.includes(val)) {
        state.accessorySuggestions.push(val);
      }
      renderAccModalBody();
    }
    inp.value = '';
    inp.focus();
  }

  document.getElementById('btnAccModalAddCustom')?.addEventListener('click', commitCustomAccTag);
  document.getElementById('accModalCustomInput')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commitCustomAccTag();
    }
  });

  document.getElementById('btnSaveAccModal')?.addEventListener('click', () => {
    if (state.activeAccModalRowIdx === null || !state.loanDraftRows[state.activeAccModalRowIdx]) {
      document.getElementById('accModalDialog')?.close();
      return;
    }
    state.loanDraftRows[state.activeAccModalRowIdx].accessories = [...state.tempAccList];
    renderLoanExcelRows();
    document.getElementById('accModalDialog')?.close();
    showToast(`✓ บันทึกอุปกรณ์เสริม (${state.tempAccList.length} ชิ้น) เรียบร้อย`);
  });

  document.getElementById('btnClearAccModal')?.addEventListener('click', () => {
    state.tempAccList = [];
    if (state.activeAccModalRowIdx !== null && state.loanDraftRows[state.activeAccModalRowIdx]) {
      state.loanDraftRows[state.activeAccModalRowIdx].accessories = [];
    }
    renderLoanExcelRows();
    document.getElementById('accModalDialog')?.close();
    showToast('ล้างอุปกรณ์เสริมเรียบร้อย');
  });

  document.querySelectorAll('#btnCloseAccModal, #btnCancelAccModal, [data-close-acc-dialog]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('accModalDialog')?.close();
    });
  });

  // ==========================================================================
  // DISPATCH & MATCH S/N MODAL EVENTS (Excel-like Minimal Picking Sheet)
  // ==========================================================================
  // 1. Barcode scanner bar
  const barcodeInput = document.getElementById('dispatchGlobalBarcodeInput');
  barcodeInput?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleDispatchBarcodeScan(e.target.value);
    }
  });

  document.getElementById('btnFocusScanner')?.addEventListener('click', () => {
    barcodeInput?.focus();
  });

  const btnDispatchCameraScan = document.getElementById('btnDispatchCameraScan');
  btnDispatchCameraScan?.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openUniversalBarcodeScanner({
      title: state.dispatchReturnMode ? 'สแกนคืนสินค้า & Match S/N' : 'สแกนจัดของ & Match S/N',
      subtitle: state.dispatchReturnMode
        ? 'ส่องกล้องไปที่บาร์โค้ด S/N หรือ Tag ID เพื่อติ๊กคืน'
        : 'ส่องกล้องไปที่บาร์โค้ด S/N หรือ Tag ID ของเครื่องที่ต้องการจัด',
      onScan: (code) => {
        const input = document.getElementById('dispatchGlobalBarcodeInput');
        if (input) input.value = code;
        handleDispatchBarcodeScan(code);
      }
    });
  });

  // 2. Dispatch Table Delegation (Minimal In-line Accordion Picking)
  const dispatchTableBody = document.getElementById('dispatchTableBody');
  dispatchTableBody?.addEventListener('change', e => {
    // Return checklist: toggle item checkbox / switch
    const retCheck = e.target.closest('[data-ret-item-check]');
    if (retCheck) {
      const rowIdx = Number(retCheck.getAttribute('data-ret-item-check'));
      if (state.dispatchDraftItems[rowIdx] && !state.dispatchDraftItems[rowIdx].returned) {
        state.dispatchDraftItems[rowIdx].selectedForReturn = retCheck.checked;
        if (!retCheck.checked) {
          state.dispatchDraftItems[rowIdx].scannedSn = '';
        }
        renderDispatchTable();
        updateDispatchSummary();
      }
      return;
    }
  });

  async function handleDeleteDispatchItem(rowIdx) {
    const loan = state.activeDispatchLoan;
    if (!loan) return;

    if (loan.status !== 'Requested' && loan.status !== 'Dispatching') {
      showToast('⚠️ สามารถลบรายการได้เฉพาะใบยืมที่ยังไม่ได้จัดของ หรือกำลังจัดของเท่านั้น');
      return;
    }

    if (!state.dispatchDraftItems || state.dispatchDraftItems.length <= 1) {
      showToast('⚠️ ไม่สามารถลบรายการสุดท้ายได้ (ใบยืมต้องมีสินค้าอย่างน้อย 1 รายการ หากต้องการยกเลิกใบยืมทั้งหมด กรุณาใช้ปุ่มยกเลิกใบยืม)');
      return;
    }

    const row = state.dispatchDraftItems[rowIdx];
    if (!row) return;

    const itemName = `${row.brand || ''} ${row.model || ''}`.trim() || `รายการที่ ${rowIdx + 1}`;

    const confirmed = await showConfirmDialog({
      title: 'ลบรายการออกจากใบยืม',
      message: `คุณต้องการลบ "${itemName}" ออกจากใบยืม ${loan.id} ใช่หรือไม่?`,
      itemHtml: `<div style="font-size:12.5px; color:#64748b; line-height:1.5;">เมื่อยืนยัน รายการนี้จะถูกตัดออกจากใบยืมทันที และเครื่องจะถูกปลดคืนสู่สต็อกพร้อมยืม</div>`,
      confirmText: '🗑️ ยืนยันลบรายการ',
      cancelText: 'ยกเลิก',
      icon: '🗑️',
      confirmBtnClass: 'btn-danger'
    });
    if (!confirmed) return;

    if (row.id) {
      try {
        const res = await fetch(`/api/loans/${encodeURIComponent(loan.id)}/items/${encodeURIComponent(row.id)}`, {
          method: 'DELETE'
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'ลบรายการไม่สำเร็จ');

        applyServerState(data.state);
        const updatedLoan = state.loans.find(l => l.id === loan.id);
        if (updatedLoan) {
          state.activeDispatchLoan = updatedLoan;
          state.dispatchDraftItems = (updatedLoan.items || []).map(it => {
            const existingTag = it.tag_id || '';
            const assetObj = existingTag ? state.assets.find(a => a.tag_id === existingTag) : null;
            const existingPhotos = Array.isArray(it.photos)
              ? [...it.photos]
              : Array.isArray(it.attachments)
              ? it.attachments.filter(a => a.url).map(a => a.url)
              : [];
            return {
              id: it.id,
              brand: it.brand || (assetObj ? assetObj.brand : ''),
              model: it.model || (assetObj ? assetObj.model : ''),
              tag_id: existingTag,
              serial_no: it.serial_no || (assetObj ? assetObj.serial_no : ''),
              source: it.source_snapshot || (assetObj ? assetObj.source : 'Demo'),
              accessories:
                it.loan_accessories && it.loan_accessories.length > 0
                  ? [...it.loan_accessories]
                  : assetObj
                  ? [...(assetObj.accessories || [])]
                  : [],
              photos: existingPhotos,
              free_note: it.loan_free_note || (assetObj ? assetObj.free_note || '' : ''),
              attachments: [...(it.attachments || [])],
              returned: Boolean(it.returned)
            };
          });
        } else {
          state.dispatchDraftItems.splice(rowIdx, 1);
        }

        state.activeDispatchRowIdx = null;
        renderDispatchTable();
        updateDispatchSummary();
        renderActiveView();
        renderHeaderCounters();
        showToast(data.message || `✓ ลบ ${itemName} ออกจากใบยืมเรียบร้อยแล้ว`);
      } catch (err) {
        showToast(`❌ ${err.message}`);
      }
    } else {
      state.dispatchDraftItems.splice(rowIdx, 1);
      state.activeDispatchRowIdx = null;
      renderDispatchTable();
      updateDispatchSummary();
      showToast(`✓ ลบ ${itemName} ออกจากรายการจัด`);
    }
  }

  dispatchTableBody?.addEventListener('click', e => {
    // Delete item from dispatch/picking modal
    const delItemBtn = e.target.closest('[data-delete-dispatch-item]');
    if (delItemBtn) {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = Number(delItemBtn.getAttribute('data-delete-dispatch-item'));
      handleDeleteDispatchItem(rowIdx);
      return;
    }

    // Return checklist: clear scanned S/N
    const clearScanBtn = e.target.closest('[data-clear-ret-scan]');
    if (clearScanBtn) {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = Number(clearScanBtn.getAttribute('data-clear-ret-scan'));
      if (state.dispatchDraftItems[rowIdx] && !state.dispatchDraftItems[rowIdx].returned) {
        state.dispatchDraftItems[rowIdx].scannedSn = '';
        state.dispatchDraftItems[rowIdx].selectedForReturn = false;
        renderDispatchTable();
        updateDispatchSummary();
      }
      return;
    }

    // Return checklist: toggle accessory missing
    const retAccBtn = e.target.closest('[data-ret-toggle-acc]');
    if (retAccBtn) {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = Number(retAccBtn.getAttribute('data-ret-toggle-acc'));
      const accName = retAccBtn.getAttribute('data-acc-name');
      const row = state.dispatchDraftItems[rowIdx];
      if (row && accName) {
        if (!row.missingAccessories) row.missingAccessories = new Set();
        if (row.missingAccessories.has(accName)) {
          row.missingAccessories.delete(accName);
        } else {
          row.missingAccessories.add(accName);
          row.qcStatus = 'Fail';
        }
        renderDispatchTable();
      }
      return;
    }

    // Return checklist: toggle QC status
    const retQcBtn = e.target.closest('[data-ret-qc-status]');
    if (retQcBtn) {
      e.preventDefault();
      e.stopPropagation();
      const rowIdx = Number(retQcBtn.getAttribute('data-ret-qc-status'));
      const val = retQcBtn.getAttribute('data-val');
      const row = state.dispatchDraftItems[rowIdx];
      if (row) {
        row.qcStatus = val;
        renderDispatchTable();
      }
      return;
    }

    // Unpick S/N (ปลดเครื่องออก)
    const unpickBtn = e.target.closest('[data-unpick-row]');
    if (unpickBtn) {
      e.stopPropagation();
      const rowIdx = Number(unpickBtn.getAttribute('data-unpick-row'));
      if (state.dispatchDraftItems[rowIdx]) {
        state.dispatchDraftItems[rowIdx].tag_id = '';
        delete state.dispatchDraftItems[rowIdx]._backupTagId;
      }
      renderDispatchTable();
      showToast('ปลดเครื่องออกจากรายการเรียบร้อย');
      return;
    }

    // Collapse button inside inline panel
    const collapseBtn = e.target.closest('[data-inline-collapse]');
    if (collapseBtn) {
      e.stopPropagation();
      state.activeDispatchRowIdx = null;
      renderDispatchTable();
      return;
    }

    // Inline S/N Card selection (แตะเลือกเครื่อง)
    const snCard = e.target.closest('[data-inline-sn-tag]');
    if (snCard) {
      e.stopPropagation();
      const tagId = snCard.getAttribute('data-inline-sn-tag');
      const rowIdx = Number(snCard.getAttribute('data-row'));
      const row = state.dispatchDraftItems[rowIdx];
      if (row) {
        row.tag_id = tagId;
        const asset = state.assets.find(a => a.tag_id === tagId);
        if (asset) {
          row.source = asset.source || 'Demo';
          if (!row.accessories || row.accessories.length === 0) {
            row.accessories = [...(asset.accessories || [])];
          }
        }
        renderDispatchTable();
        showToast(`✓ เลือก S/N: ${asset?.serial_no || tagId} เรียบร้อย`);
      }
      return;
    }

    // Toggle Accessory Chip
    const accChip = e.target.closest('[data-inline-toggle-acc]');
    if (accChip) {
      e.stopPropagation();
      const acc = accChip.getAttribute('data-inline-toggle-acc');
      const rowIdx = Number(accChip.getAttribute('data-row'));
      const row = state.dispatchDraftItems[rowIdx];
      if (row) {
        if (!row.accessories) row.accessories = [];
        const idx = row.accessories.indexOf(acc);
        if (idx >= 0) {
          row.accessories.splice(idx, 1);
        } else {
          row.accessories.push(acc);
        }
        renderDispatchTable();
      }
      return;
    }

    // Snap photo button (เปิดกล้องจริง Live WebRTC Viewfinder)
    const snapBtn = e.target.closest('[data-inline-snap-row]');
    if (snapBtn) {
      e.stopPropagation();
      const rowIdx = Number(snapBtn.getAttribute('data-inline-snap-row'));
      openLiveCamera(rowIdx);
      return;
    }

    // Upload photo button
    const uploadBtn = e.target.closest('[data-inline-upload-row]');
    if (uploadBtn) {
      e.stopPropagation();
      state.activeDispatchPhotoRowIdx = Number(uploadBtn.getAttribute('data-inline-upload-row'));
      document.getElementById('dispatchPhotoInput')?.click();
      return;
    }

    // Remove photo
    const rmPhotoBtn = e.target.closest('[data-rm-inline-photo]');
    if (rmPhotoBtn) {
      e.stopPropagation();
      const rowIdx = Number(rmPhotoBtn.getAttribute('data-row'));
      const pIdx = Number(rmPhotoBtn.getAttribute('data-rm-inline-photo'));
      if (state.dispatchDraftItems[rowIdx]?.photos) {
        state.dispatchDraftItems[rowIdx].photos.splice(pIdx, 1);
        renderDispatchTable();
      }
      return;
    }

    // Zoom/preview photo (เปิดดูรูปภาพขนาดใหญ่ แบบเลื่อนไปมาได้)
    const previewImg = e.target.closest('[data-preview-inline-photo]');
    if (previewImg) {
      e.stopPropagation();
      const rowIdx = Number(previewImg.getAttribute('data-row'));
      const pIdx = Number(previewImg.getAttribute('data-preview-inline-photo'));
      const row = state.dispatchDraftItems[rowIdx];
      const photos = (row?.photos || []).map((src, i) => ({
        url: src,
        name: `สภาพ_${row.brand || ''}_${row.model || 'item'}_${i + 1}.jpg`,
        type: 'image/jpeg'
      }));
      if (photos.length > 0) {
        openFilePreview(photos, pIdx);
      }
      return;
    }

    // Click photo badge in table row
    const photoBadge = e.target.closest('[data-preview-row-photos]');
    if (photoBadge) {
      e.stopPropagation();
      const rowIdx = Number(photoBadge.getAttribute('data-preview-row-photos'));
      const row = state.dispatchDraftItems[rowIdx];
      const photos = (row?.photos || []).map((src, i) => ({
        url: src,
        name: `สภาพ_${row.brand || ''}_${row.model || 'item'}_${i + 1}.jpg`,
        type: 'image/jpeg'
      }));
      if (photos.length > 0) {
        openFilePreview(photos, 0);
      }
      return;
    }

    // Main row click -> Toggle expand/collapse
    const mainRow = e.target.closest('[data-dispatch-row]');
    if (mainRow) {
      const rowIdx = Number(mainRow.getAttribute('data-dispatch-row'));
      if (state.activeDispatchRowIdx === rowIdx) {
        state.activeDispatchRowIdx = null; // Toggle collapse
      } else {
        state.activeDispatchRowIdx = rowIdx; // Expand this row
      }
      closeDispatchSnDropdown();
      closeDispatchAccDropdown();
      renderDispatchTable();
      return;
    }

    // Toggle S/N dropdown arrow
    const toggleSnBtn = e.target.closest('[data-toggle-dispatch-sn]');
    if (toggleSnBtn) {
      e.stopPropagation();
      closeDispatchAccDropdown();
      const rowIdx = Number(toggleSnBtn.getAttribute('data-toggle-dispatch-sn'));
      const dropdown = document.getElementById('dispatchSnDropdownMenu');
      if (dropdown && !dropdown.classList.contains('hidden')) {
        closeDispatchSnDropdown();
      } else {
        const inp = document.getElementById(`dispatchSnInput_${rowIdx}`);
        renderDispatchSnDropdown(rowIdx, inp ? inp.value : '');
        inp?.focus();
      }
      return;
    }

    // Toggle Accessory dropdown arrow
    const toggleAccBtn = e.target.closest('[data-toggle-dispatch-acc]');
    if (toggleAccBtn) {
      e.stopPropagation();
      closeDispatchSnDropdown();
      const rowIdx = Number(toggleAccBtn.getAttribute('data-toggle-dispatch-acc'));
      const dropdown = document.getElementById('dispatchAccDropdownMenu');
      if (dropdown && !dropdown.classList.contains('hidden')) {
        closeDispatchAccDropdown();
      } else {
        const inp = document.getElementById(`dispatchAccInput_${rowIdx}`);
        renderDispatchAccDropdown(rowIdx, inp ? inp.value : '');
        inp?.focus();
      }
      return;
    }

    // Clear Accessory search input
    const clearAccBtn = e.target.closest('[data-clear-dispatch-acc]');
    if (clearAccBtn) {
      e.stopPropagation();
      const rowIdx = Number(clearAccBtn.getAttribute('data-clear-dispatch-acc'));
      const inp = document.getElementById(`dispatchAccInput_${rowIdx}`);
      if (inp) {
        inp.value = '';
        clearAccBtn.classList.add('hidden');
        inp.focus();
        renderDispatchAccDropdown(rowIdx, '');
      }
      return;
    }

    // Clear S/N search input
    const clearSnBtn = e.target.closest('[data-clear-dispatch-sn]');
    if (clearSnBtn) {
      e.stopPropagation();
      const rowIdx = Number(clearSnBtn.getAttribute('data-clear-dispatch-sn'));
      const inp = document.getElementById(`dispatchSnInput_${rowIdx}`);
      if (inp) {
        inp.value = '';
        clearSnBtn.classList.add('hidden');
        inp.focus();
        renderDispatchSnDropdown(rowIdx, '');
      }
      return;
    }

    // Clear inline Note input
    const clearNoteBtn = e.target.closest('[data-clear-inline-note]');
    if (clearNoteBtn) {
      e.stopPropagation();
      const rowIdx = Number(clearNoteBtn.getAttribute('data-clear-inline-note'));
      if (state.dispatchDraftItems[rowIdx]) {
        state.dispatchDraftItems[rowIdx].free_note = '';
      }
      const inp = document.getElementById(`inlineNoteInput_${rowIdx}`);
      if (inp) {
        inp.value = '';
        clearNoteBtn.classList.add('hidden');
        inp.focus();
      }
      return;
    }

    // Change S/N from matched card
    const changeSnBtn = e.target.closest('[data-change-dispatch-sn]');
    if (changeSnBtn) {
      e.stopPropagation();
      const rowIdx = Number(changeSnBtn.getAttribute('data-change-dispatch-sn'));

      // If any other row had pending backup, restore it first
      if (state.dispatchDraftItems) {
        for (let i = 0; i < state.dispatchDraftItems.length; i++) {
          const r = state.dispatchDraftItems[i];
          if (i !== rowIdx && !r.tag_id && r._backupTagId) {
            r.tag_id = r._backupTagId;
            delete r._backupTagId;
          }
        }
      }

      const row = state.dispatchDraftItems[rowIdx];
      if (row) {
        row._backupTagId = row.tag_id;
        row.tag_id = '';
        renderDispatchTable();
        setTimeout(() => {
          const inp = document.getElementById(`dispatchSnInput_${rowIdx}`);
          if (inp) {
            renderDispatchSnDropdown(rowIdx, '');
            inp.focus();
          }
        }, 40);
      }
      return;
    }
  });

  // S/N Picker Input & Search
  dispatchTableBody?.addEventListener('focusin', e => {
    const input = e.target.closest('[data-dispatch-sn-input]');
    if (input) {
      const rowIdx = Number(input.getAttribute('data-dispatch-sn-input'));
      renderDispatchSnDropdown(rowIdx, input.value);
    }
  });

  dispatchTableBody?.addEventListener('input', e => {
    const input = e.target.closest('[data-dispatch-sn-input]');
    if (input) {
      const rowIdx = Number(input.getAttribute('data-dispatch-sn-input'));
      const clearBtn = input.parentElement?.querySelector('[data-clear-dispatch-sn]');
      if (clearBtn) {
        clearBtn.classList.toggle('hidden', !input.value.trim());
      }
      renderDispatchSnDropdown(rowIdx, input.value);
    }
  });

  dispatchTableBody?.addEventListener('keydown', async e => {
    const input = e.target.closest('[data-dispatch-sn-input]');
    if (!input) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      closeDispatchSnDropdown();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      const rowIdx = Number(input.getAttribute('data-dispatch-sn-input'));
      const val = (input.value || '').trim();
      if (!val) return;

      const row = state.dispatchDraftItems[rowIdx];
      if (!row) return;

      const valUpper = val.toUpperCase();
      const match = state.assets.find(
        a =>
          a.model.toLowerCase() === (row.model || '').toLowerCase() &&
          ((a.serial_no && a.serial_no.toUpperCase().includes(valUpper)) ||
           (a.tag_id && a.tag_id.toUpperCase().includes(valUpper)))
      );

      if (match) {
        row.tag_id = match.tag_id;
        delete row._backupTagId;
        row.source = match.source || 'Demo';
        if (!row.accessories || row.accessories.length === 0) {
          row.accessories = [...(match.accessories || [])];
        }
        closeDispatchSnDropdown();
        renderDispatchTable();
        showToast(`✓ เลือก S/N: ${match.serial_no} เรียบร้อย`);
      } else {
        await addAndAssignCustomSn(rowIdx, val);
      }
    }
  });

  // Handle click on S/N dropdown items in #dispatchSnDropdownMenu
  const dispatchSnDropdown = document.getElementById('dispatchSnDropdownMenu');
  dispatchSnDropdown?.addEventListener('click', e => {
    const closeBtn = e.target.closest('[data-close-dispatch-sn]');
    if (closeBtn) {
      closeDispatchSnDropdown();
      return;
    }

    const customItem = e.target.closest('[data-add-custom-sn]');
    if (customItem) {
      e.stopPropagation();
      const sn = customItem.getAttribute('data-add-custom-sn');
      const rowIdx = Number(customItem.getAttribute('data-row'));
      addAndAssignCustomSn(rowIdx, sn);
      return;
    }

    const item = e.target.closest('[data-select-dispatch-sn]');
    if (item) {
      const tagId = item.getAttribute('data-select-dispatch-sn');
      const rowIdx = Number(item.getAttribute('data-row'));
      const row = state.dispatchDraftItems[rowIdx];
      if (row) {
        row.tag_id = tagId;
        delete row._backupTagId;
        const asset = state.assets.find(a => a.tag_id === tagId);
        if (asset) {
          row.source = asset.source || 'Demo';
          if (!row.accessories || row.accessories.length === 0) {
            row.accessories = [...(asset.accessories || [])];
          }
        }
        closeDispatchSnDropdown();
        renderDispatchTable();
        showToast(`✓ เลือก S/N: ${asset?.serial_no || tagId} เรียบร้อย`);
      }
    }
  });

  // Accessory Picker Input & Search
  dispatchTableBody?.addEventListener('focusin', e => {
    const input = e.target.closest('[data-dispatch-acc-input]');
    if (input) {
      closeDispatchSnDropdown();
      if (suppressNextAccFocus) return;
      const rowIdx = Number(input.getAttribute('data-dispatch-acc-input'));
      renderDispatchAccDropdown(rowIdx, input.value);
    }
  });

  dispatchTableBody?.addEventListener('input', e => {
    const input = e.target.closest('[data-dispatch-acc-input]');
    if (input) {
      const rowIdx = Number(input.getAttribute('data-dispatch-acc-input'));
      const clearBtn = input.parentElement?.querySelector('[data-clear-dispatch-acc]');
      if (clearBtn) {
        clearBtn.classList.toggle('hidden', !input.value.trim());
      }
      renderDispatchAccDropdown(rowIdx, input.value);
    }
  });

  dispatchTableBody?.addEventListener('keydown', e => {
    const input = e.target.closest('[data-dispatch-acc-input]');
    if (input && e.key === 'Enter') {
      e.preventDefault();
      const rowIdx = Number(input.getAttribute('data-dispatch-acc-input'));
      const val = (input.value || '').trim();
      if (!val) return;
      addAccToDispatchRow(rowIdx, val);
    }
  });

  // Handle click on Accessory dropdown items in #dispatchAccDropdownMenu
  const dispatchAccDropdown = document.getElementById('dispatchAccDropdownMenu');
  dispatchAccDropdown?.addEventListener('click', e => {
    const closeBtn = e.target.closest('[data-close-dispatch-acc]');
    if (closeBtn) {
      closeDispatchAccDropdown();
      return;
    }

    const customItem = e.target.closest('[data-add-custom-acc]');
    if (customItem) {
      e.stopPropagation();
      const acc = customItem.getAttribute('data-add-custom-acc');
      const rowIdx = Number(customItem.getAttribute('data-row'));
      addAccToDispatchRow(rowIdx, acc);
      return;
    }

    const item = e.target.closest('[data-select-dispatch-acc]');
    if (item) {
      e.stopPropagation();
      const acc = item.getAttribute('data-select-dispatch-acc');
      const rowIdx = Number(item.getAttribute('data-row'));
      addAccToDispatchRow(rowIdx, acc);
    }
  });

  // Close dropdown on outside click
  document.addEventListener('click', e => {
    if (
      !e.target.closest('#dispatchSnDropdownMenu') &&
      !e.target.closest('.inline-sn-input-wrap') &&
      !e.target.closest('[data-change-dispatch-sn]')
    ) {
      closeDispatchSnDropdown();
    }
    if (
      !e.target.closest('#dispatchAccDropdownMenu') &&
      !e.target.closest('.inline-acc-input-wrap')
    ) {
      closeDispatchAccDropdown();
    }
  });

  // Inline Note Input
  dispatchTableBody?.addEventListener('input', e => {
    if (e.target.matches('[data-inline-note-row]')) {
      const rowIdx = Number(e.target.getAttribute('data-inline-note-row'));
      if (state.dispatchDraftItems[rowIdx]) {
        state.dispatchDraftItems[rowIdx].free_note = e.target.value;
      }
      const clearBtn = e.target.parentElement?.querySelector('[data-clear-inline-note]');
      if (clearBtn) {
        clearBtn.classList.toggle('hidden', !e.target.value.trim());
      }
    }
  });

  // Handle Photo files for inline picking
  const handleDispatchPhotos = async (files) => {
    if (state.activeDispatchPhotoRowIdx === null || !state.dispatchDraftItems[state.activeDispatchPhotoRowIdx]) return;
    const row = state.dispatchDraftItems[state.activeDispatchPhotoRowIdx];
    if (!row.photos) row.photos = [];

    let count = 0;
    for (const f of files) {
      if (f.type && f.type.startsWith('image/')) {
        const dataUrl = await compressImageFile(f);
        row.photos.push(dataUrl);
        count++;
      }
    }

    if (count > 0) {
      renderDispatchTable();
      showToast(`📸 แนบรูปถ่ายสภาพเครื่องเรียบร้อย (${count} รูป)`);
    }
  };

  const dispatchCameraInput = document.getElementById('dispatchCameraInput');
  const dispatchPhotoInput = document.getElementById('dispatchPhotoInput');

  dispatchCameraInput?.addEventListener('change', async e => {
    await handleDispatchPhotos(Array.from(e.target.files || []));
    e.target.value = '';
  });

  dispatchPhotoInput?.addEventListener('change', async e => {
    await handleDispatchPhotos(Array.from(e.target.files || []));
    e.target.value = '';
  });

  // Live Camera Viewfinder Dialog Controls
  document.getElementById('btnCloseLiveCamera')?.addEventListener('click', closeLiveCamera);
  document.getElementById('btnCameraShutter')?.addEventListener('click', snapLivePhoto);
  document.getElementById('btnRetakePhoto')?.addEventListener('click', retakeLivePhoto);
  document.getElementById('btnUsePhoto')?.addEventListener('click', useLivePhoto);
  document.getElementById('btnFallbackFileInput')?.addEventListener('click', () => {
    closeLiveCamera();
    state.activeDispatchPhotoRowIdx = liveCameraRowIdx;
    document.getElementById('dispatchPhotoInput')?.click();
  });
  document.getElementById('btnSwitchCamera')?.addEventListener('click', async () => {
    currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
    if (liveCameraStream) {
      liveCameraStream.getTracks().forEach(t => t.stop());
    }
    await openLiveCamera(liveCameraRowIdx);
  });

  // 4. Mismatch Dialog Selection & Actions (เมื่อสแกนไม่ตรงรุ่น แล้วเลือกรายการที่จะลง)
  const mismatchList = document.getElementById('mismatchItemsChoiceList');
  mismatchList?.addEventListener('change', e => {
    if (e.target.matches('input[name="mismatchTargetRow"]')) {
      document.querySelectorAll('.mismatch-option-card').forEach(card => card.classList.remove('selected'));
      e.target.closest('.mismatch-option-card')?.classList.add('selected');
      const btn = document.getElementById('btnApplyMismatchChoice');
      if (btn) btn.disabled = false;
    }
  });

  mismatchList?.addEventListener('click', e => {
    const card = e.target.closest('.mismatch-option-card');
    if (card && e.target.tagName !== 'INPUT') {
      const radio = card.querySelector('input[type="radio"]');
      if (radio && !radio.checked) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  });

  const closeMismatchModal = () => {
    state.pendingMismatchAsset = null;
    document.getElementById('dispatchMismatchDialog')?.close();
    const barcodeInput = document.getElementById('dispatchGlobalBarcodeInput');
    if (barcodeInput) {
      barcodeInput.value = '';
      barcodeInput.focus();
    }
  };

  document.getElementById('btnCancelMismatchChoice')?.addEventListener('click', closeMismatchModal);
  document.getElementById('btnCloseMismatchDialog')?.addEventListener('click', closeMismatchModal);

  document.getElementById('btnApplyMismatchChoice')?.addEventListener('click', async () => {
    if (!state.pendingMismatchAsset) return;
    const checked = document.querySelector('input[name="mismatchTargetRow"]:checked');
    if (!checked) return;

    const rowIdx = Number(checked.value);
    const targetRow = state.dispatchDraftItems[rowIdx];
    if (!targetRow) return;

    const asset = state.pendingMismatchAsset;

    if (asset.isNew) {
      // 1. Create brand new asset via API
      try {
        const payload = {
          serial_no: asset.serial_no,
          brand: targetRow.brand || '',
          model: targetRow.model || 'Demo Unit',
          category: 'Mobile Computer',
          source: targetRow.source || 'Demo',
          location: 'Main Stock (ตู้โชว์/คลังกลาง)'
        };
        const res = await fetch('/api/assets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const resJson = await res.json();
        if (!res.ok) {
          showToast(`❌ ${resJson.error || 'เกิดข้อผิดพลาดในการสร้างเครื่อง'}`);
          return;
        }

        const newTagId = resJson.createdTagId || resJson.tag_id;
        if (resJson.state?.assets) {
          state.assets = resJson.state.assets;
        }
        const created = state.assets.find(a => a.tag_id === newTagId) || {
          tag_id: newTagId,
          serial_no: asset.serial_no,
          brand: targetRow.brand || '',
          model: targetRow.model || 'Demo Unit',
          source: targetRow.source || 'Demo',
          status: 'Available'
        };
        if (!state.assets.some(a => a.tag_id === created.tag_id)) {
          state.assets.push(created);
        }

        // Assign to target row
        targetRow.tag_id = created.tag_id;
        targetRow.source = created.source || 'Demo';
        targetRow.brand = created.brand;
        targetRow.model = created.model;
        if (!targetRow.accessories || targetRow.accessories.length === 0) {
          targetRow.accessories = [...(created.accessories || [])];
        }

        document.getElementById('dispatchMismatchDialog')?.close();
        renderDispatchTable();
        showToast(`✅ เพิ่มและเลือก S/N ใหม่: ${created.serial_no} (${created.tag_id}) ในรายการที่ ${rowIdx + 1} เรียบร้อย`);
        state.pendingMismatchAsset = null;
      } catch (err) {
        showToast(`❌ เกิดข้อผิดพลาด: ${err.message}`);
        return;
      }
    } else {
      // 2. Existing asset substitution
      const originalModel = targetRow.model;

      targetRow.tag_id = asset.tag_id;
      targetRow.source = asset.source || 'Demo';
      targetRow.brand = asset.brand;
      targetRow.model = asset.model;
      if (!targetRow.accessories || targetRow.accessories.length === 0) {
        targetRow.accessories = [...(asset.accessories || [])];
      }
      if (originalModel && originalModel.toLowerCase() !== asset.model.toLowerCase()) {
        targetRow.free_note = (targetRow.free_note ? targetRow.free_note + ' ' : '') + `(สลับรุ่นแทน ${originalModel})`;
      }

      document.getElementById('dispatchMismatchDialog')?.close();
      renderDispatchTable();
      showToast(`✅ เลือกลงรายการที่ ${rowIdx + 1} ด้วย S/N: ${asset.serial_no} (${asset.model}) เรียบร้อย`);
      state.pendingMismatchAsset = null;
    }

    const barcodeInput = document.getElementById('dispatchGlobalBarcodeInput');
    if (barcodeInput) {
      barcodeInput.value = '';
      barcodeInput.focus();
    }
  });

  // View Gate Pass button from dispatch header
  const btnViewPrint = document.getElementById('btnDispatchViewPrintPass');
  btnViewPrint?.addEventListener('click', () => {
    if (state.activeDispatchLoan) {
      document.getElementById('dispatchDialog')?.close();
      openPrintModal(state.activeDispatchLoan.id);
    }
  });

  // Edit loan / notes button from dispatch dialog (header & footer)
  document.addEventListener('click', e => {
    const editBtn = e.target.closest('#btnDispatchEditLoan, #btnDispatchEditFromFooter');
    if (editBtn && state.activeDispatchLoan) {
      e.preventDefault();
      const loanId = state.activeDispatchLoan.id;
      document.getElementById('dispatchDialog')?.close();
      openEditLoanModal(loanId);
    }
  });

  // View Gate Pass button from return header
  const btnReturnPrint = document.getElementById('btnReturnViewPrintPass');
  btnReturnPrint?.addEventListener('click', () => {
    if (state.activeReturnLoan) {
      document.getElementById('returnDialog')?.close();
      openPrintModal(state.activeReturnLoan.id);
    }
  });

  // View Gate Pass button from edit loan header
  const btnLoanPrint = document.getElementById('btnLoanEditPrintPass');
  btnLoanPrint?.addEventListener('click', () => {
    if (state.editingLoanId) {
      document.getElementById('loanDialog')?.close();
      openPrintModal(state.editingLoanId);
    }
  });

  // Intercept click on save button container when incomplete to provide instant error feedback
  document.querySelector('#dispatchDialog .footer-right-btns')?.addEventListener('click', e => {
    const btnSubmit = e.target.closest('#btnSubmitDispatch');
    if (!btnSubmit) return;
    const unpicked = (state.dispatchDraftItems || []).filter(r => !r.tag_id);
    if (unpicked.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      const firstUnpickedIdx = state.dispatchDraftItems.findIndex(r => !r.tag_id);
      if (firstUnpickedIdx >= 0) {
        state.activeDispatchRowIdx = firstUnpickedIdx;
        renderDispatchTable();
      }
      showToast(`⚠️ ยังจัดของไม่ครบ: กรุณาสแกนหรือเลือก S/N ให้ครบก่อนบันทึก (เหลืออีก ${unpicked.length} เครื่อง)`);
    }
  });

  // Action buttons delegation in dispatchDialog (Edit On-site, Sign Borrower, Deliver)
  document.getElementById('dispatchDialog')?.addEventListener('click', e => {
    // 1. Toggle On-site Edit mode
    const btnToggleEdit = e.target.closest('#btnToggleOnsiteEdit');
    if (btnToggleEdit) {
      e.preventDefault();
      state.dispatchOnsiteEditMode = true;
      const scannerBar = document.getElementById('dispatchBarcodeScannerBar');
      if (scannerBar) scannerBar.classList.remove('hidden');
      renderDispatchTable();
      showToast('✏️ เปิดโหมดแก้ไขหน้างาน: สามารถเปลี่ยน S/N, อุปกรณ์ หรือถ่ายรูปเพิ่มได้แล้ว');
      return;
    }

    // 2. Cancel On-site Edit mode (revert changes)
    const btnCancelEdit = e.target.closest('#btnCancelOnsiteEdit');
    if (btnCancelEdit) {
      e.preventDefault();
      if (state.activeDispatchLoan) {
        const loan = state.activeDispatchLoan;
        state.dispatchDraftItems = (loan.items || []).map(it => {
          const existingTag = it.tag_id || '';
          const assetObj = existingTag ? state.assets.find(a => a.tag_id === existingTag) : null;
          const existingPhotos = Array.isArray(it.photos)
            ? [...it.photos]
            : Array.isArray(it.attachments)
            ? it.attachments.filter(a => a.url).map(a => a.url)
            : [];
          return {
            id: it.id,
            brand: it.brand || (assetObj ? assetObj.brand : ''),
            model: it.model || (assetObj ? assetObj.model : ''),
            tag_id: existingTag,
            source: it.source_snapshot || (assetObj ? assetObj.source : 'Demo'),
            accessories:
              it.loan_accessories && it.loan_accessories.length > 0
                ? [...it.loan_accessories]
                : assetObj
                ? [...(assetObj.accessories || [])]
                : [],
            photos: existingPhotos,
            free_note: it.loan_free_note || (assetObj ? assetObj.free_note || '' : ''),
            attachments: [...(it.attachments || [])]
          };
        });
      }
      state.dispatchOnsiteEditMode = false;
      const scannerBar = document.getElementById('dispatchBarcodeScannerBar');
      if (scannerBar) scannerBar.classList.add('hidden');
      renderDispatchTable();
      showToast('ยกเลิกการแก้ไขหน้างาน');
      return;
    }

    // 3. Sign for delivery (ลายเซ็นผู้ยืม / ผู้รับเครื่อง)
    const btnSignBorrower = e.target.closest('#btnDispatchSignBorrower');
    if (btnSignBorrower) {
      e.preventDefault();
      if (!state.activeDispatchLoan) return;
      state.activePrintLoanId = state.activeDispatchLoan.id;
      if (window.openDigitalSigModalForRole) {
        window.openDigitalSigModalForRole('borrower');
      }
      return;
    }

    // 4. Deliver item modal (ส่งมอบสินค้า)
    const btnDeliver = e.target.closest('#btnDispatchDeliver');
    if (btnDeliver) {
      e.preventDefault();
      if (!state.activeDispatchLoan) return;
      const loanId = state.activeDispatchLoan.id;
      document.getElementById('dispatchDialog')?.close();
      openDeliveryModal(loanId);
      return;
    }

    // 4.2. Open Inspection for Pending_QC card
    const btnInspectQc = e.target.closest('[data-inspect-qc]');
    if (btnInspectQc) {
      e.preventDefault();
      e.stopPropagation();
      const loanId = btnInspectQc.getAttribute('data-inspect-qc');
      if (loanId) {
        openDispatchModal(loanId);
      }
      return;
    }

    // 4.3. Revert QC back to Delivered
    const btnRevertQc = e.target.closest('#btnRevertQcToDelivered');
    if (btnRevertQc) {
      e.preventDefault();
      if (!state.activeDispatchLoan) return;
      const loanId = state.activeDispatchLoan.id;
      (async () => {
        try {
          const res = await fetch(`/api/loans/${encodeURIComponent(loanId)}/revert-qc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'ไม่สามารถย้อนสถานะได้');
          applyServerState(data);
          document.getElementById('dispatchDialog')?.close();
          showToast(`↩️ ย้อนสถานะใบยืม "${loanId}" กลับเป็นกำลังยืมเรียบร้อย`);
        } catch (err) {
          showToast(`❌ ${err.message}`);
        }
      })();
      return;
    }

    // 5. Start Return mode (กดปุ่ม "คืนสินค้า")
    const btnStartReturn = e.target.closest('#btnDispatchStartReturn');
    if (btnStartReturn) {
      e.preventDefault();
      if (!state.activeDispatchLoan) return;
      state.dispatchReturnMode = true;
      state.dispatchReturnPhotos = [];
      // Unreturned items start unchecked so user can check/scan them
      (state.dispatchDraftItems || []).forEach(r => {
        if (!r.returned) {
          r.selectedForReturn = false;
          r.scannedSn = '';
        }
      });
      const titleIconEl = document.querySelector('#dispatchDialogTitle .dispatch-title-icon');
      const titleTextEl = document.querySelector('#dispatchDialogTitle .dispatch-title-text');
      if (titleIconEl) titleIconEl.textContent = '📥';
      if (titleTextEl) titleTextEl.textContent = 'ตรวจรับคืนสินค้า';
      const stageBadge = document.getElementById('dispatchStageBadge');
      if (stageBadge) {
        stageBadge.textContent = 'ตรวจรับคืนสินค้า';
        stageBadge.className = 'badge-stage-pill';
        stageBadge.style.background = '#dcfce7';
        stageBadge.style.color = '#15803d';
        stageBadge.style.borderColor = '#bbf7d0';
      }
      const scannerBar = document.getElementById('dispatchBarcodeScannerBar');
      if (scannerBar) scannerBar.classList.remove('hidden');
      const barcodeInput = document.getElementById('dispatchGlobalBarcodeInput');
      if (barcodeInput) {
        barcodeInput.placeholder = 'ยิงบาร์โค้ด S/N หรือ Tag ID เพื่อติ๊กคืนสินค้า...';
        barcodeInput.value = '';
        setTimeout(() => barcodeInput.focus(), 50);
      }
      const proofSection = document.getElementById('dispatchReturnProofSection');
      if (proofSection) proofSection.classList.remove('hidden');
      renderDispatchReturnPhotosPreview();
      renderDispatchTable();
      updateDispatchSummary();
      showToast('📥 เข้าสู่ขั้นตอนตรวจรับคืน: ตรวจเครื่อง, อุปกรณ์ และแนบรูปคืน');
      return;
    }

    // 6. Cancel Return mode
    const btnCancelReturn = e.target.closest('#btnCancelReturnMode');
    if (btnCancelReturn) {
      e.preventDefault();
      state.dispatchReturnMode = false;
      if (state.activeDispatchLoan) {
        openDispatchModal(state.activeDispatchLoan.id, false);
      }
      return;
    }

    // 7. Submit Return
    const btnSubmitReturn = e.target.closest('#btnSubmitReturn');
    if (btnSubmitReturn) {
      e.preventDefault();
      if (!state.activeDispatchLoan) return;
      const loan = state.activeDispatchLoan;
      const selectedItems = (state.dispatchDraftItems || []).filter(r => r.selectedForReturn && !r.returned);
      if (selectedItems.length === 0) {
        showToast('⚠️ กรุณาเลือกหรือสแกนอย่างน้อย 1 เครื่องที่จะบันทึกรับคืน');
        return;
      }

      btnSubmitReturn.disabled = true;
      btnSubmitReturn.innerHTML = '<span>กำลังบันทึก...</span>';

      (async () => {
        try {
          const isPendingQc = loan.status === 'Pending_QC';
          const payload = {
            items: selectedItems.map(r => ({
              tag_id: r.tag_id,
              returned_accessories: (r.allAccessories || []).filter(a => !(r.missingAccessories || new Set()).has(a)),
              missing_accessories: [...(r.missingAccessories || new Set())],
              qc_status: 'Pass',
              qc_note: r.qcNote || '',
              returned_to_location: 1
            })),
            after_photos: state.dispatchReturnPhotos || [],
            return_receiver: (() => {
              const defaultUser = getLoggedInUserName();
              const entered = (document.getElementById('dispatchReturnReceiverName')?.value || '').trim() || defaultUser;
              if (entered && entered !== defaultUser && !entered.includes('ทดแทน')) {
                return `${entered} (ทดแทน)`;
              }
              return entered;
            })(),
            is_qc_completion: isPendingQc
          };

          const res = await fetch(`/api/loans/${encodeURIComponent(loan.id)}/return`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'บันทึกการรับคืนไม่สำเร็จ');
          state.highlightDocNo = loan.id;
          if (!state.recentlyChangedLoans) state.recentlyChangedLoans = new Set();
          state.recentlyChangedLoans.add(loan.id);

          applyServerState(data);
          document.getElementById('dispatchDialog')?.close();

          const updatedLoan = (state.loans || []).find(l => l.id === loan.id);
          const nextStatus = updatedLoan?.status;

          // On mobile: switch to target column automatically so user sees the newly moved card
          if (window.innerWidth <= 768) {
            const qcColBtn = document.querySelector('.col-pill-btn[data-col-target="qc"]');
            qcColBtn?.click();
          }

          // Smooth scroll to highlight the card with colored border
          setTimeout(() => {
            const card = document.querySelector(`.loan-card[data-card-loan="${loan.id}"]`);
            if (card) {
              card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
              card.classList.add('card-highlight', 'card-status-changed');
            }
          }, 200);

          if (nextStatus === 'Pending_Return_Supplier_Sale') {
            if (isPendingQc) {
              showToast(`✅ ตรวจ QC ผ่านเรียบร้อย — ส่งต่อไปยังขั้นตอน "คืน Supplier,คลังขาย"`);
            } else {
              showToast(`📥 รับคืนเรียบร้อย — สินค้า Supplier ส่งไปยังขั้นตอน "คืน Supplier,คลังขาย"`);
            }
          } else if (isPendingQc) {
            const isAllDone = updatedLoan ? updatedLoan.status === 'Returned' : false;
            showToast(isAllDone 
              ? `✅ ตรวจ QC ผ่าน — รับสินค้า ${loan.id} เข้าคลังเรียบร้อยแล้ว` 
              : `✅ ตรวจ QC ผ่านบางส่วน (${selectedItems.length} เครื่อง) รับเข้าคลังเรียบร้อย`
            );
          } else {
            showToast(`📥 บันทึกการรับคืนเรียบร้อย — ส่งไปเข้าคิว "รอตรวจ QC" (${selectedItems.length} เครื่อง)`);
          }
        } catch (err) {
          showToast('⚠️ ' + err.message);
          btnSubmitReturn.disabled = false;
          btnSubmitReturn.innerHTML = `
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>บันทึกการรับคืน</span>
          `;
        }
      })();
      return;
    }
  });

  function processRowSnScan(scannedVal, rowIdx) {
    const code = (scannedVal || '').trim().toUpperCase();
    if (!code) return;
    const row = state.dispatchDraftItems[rowIdx];
    if (!row || row.returned) return;

    const targetSn = (row.serial_no || '').trim().toUpperCase();
    const targetTag = (row.tag_id || '').trim().toUpperCase();

    if (code === targetSn || code === targetTag || (targetSn && targetSn.endsWith(code) && code.length >= 4) || (targetSn && targetSn.includes(code) && code.length >= 5)) {
      row.scannedSn = scannedVal.trim();
      row.selectedForReturn = true;
      renderDispatchTable();
      updateDispatchSummary();
      showToast(`✅ สแกน S/N ถูกต้อง: ${row.brand} ${row.model} (ติ๊กรับคืนแล้ว)`);
      const nextIdx = state.dispatchDraftItems.findIndex((r, i) => i > rowIdx && !r.returned && !r.selectedForReturn);
      if (nextIdx >= 0) {
        setTimeout(() => {
          const nextInp = document.querySelector(`[data-ret-scan-input="${nextIdx}"]`);
          if (nextInp) nextInp.focus();
        }, 60);
      }
      return;
    }

    const otherIdx = state.dispatchDraftItems.findIndex(r => 
      !r.returned && (
        (r.serial_no && r.serial_no.trim().toUpperCase() === code) ||
        (r.tag_id && r.tag_id.trim().toUpperCase() === code) ||
        (r.serial_no && r.serial_no.toUpperCase().includes(code) && code.length >= 5)
      )
    );

    if (otherIdx >= 0) {
      const otherRow = state.dispatchDraftItems[otherIdx];
      otherRow.scannedSn = scannedVal.trim();
      otherRow.selectedForReturn = true;
      renderDispatchTable();
      updateDispatchSummary();
      showToast(`✅ ติ๊กรับคืน ${otherRow.brand} ${otherRow.model} (S/N: ${otherRow.serial_no})`);
      return;
    }

    showToast(`⚠️ S/N หรือ Tag ID "${scannedVal.trim()}" ไม่ตรงกับเครื่องในใบยืมนี้`);
  }

  // Row-level scan input keydown & input
  dispatchTableBody?.addEventListener('keydown', e => {
    const scanInput = e.target.closest('[data-ret-scan-input]');
    if (scanInput && e.key === 'Enter') {
      e.preventDefault();
      const rowIdx = Number(scanInput.getAttribute('data-ret-scan-input'));
      processRowSnScan(scanInput.value, rowIdx);
    }
  });

  dispatchTableBody?.addEventListener('input', e => {
    const scanInput = e.target.closest('[data-ret-scan-input]');
    if (scanInput) {
      const rowIdx = Number(scanInput.getAttribute('data-ret-scan-input'));
      const val = scanInput.value.trim().toUpperCase();
      const row = state.dispatchDraftItems[rowIdx];
      if (row) {
        row.scannedSn = scanInput.value;
        const targetSn = (row.serial_no || '').trim().toUpperCase();
        const targetTag = (row.tag_id || '').trim().toUpperCase();
        if (val && (val === targetSn || val === targetTag)) {
          processRowSnScan(scanInput.value, rowIdx);
        }
      }
    }
  });

  // Delegate input for QC note inside return mode table
  dispatchTableBody?.addEventListener('input', e => {
    const qcNoteInput = e.target.closest('[data-ret-qc-note]');
    if (qcNoteInput) {
      const rowIdx = Number(qcNoteInput.getAttribute('data-ret-qc-note'));
      if (state.dispatchDraftItems && state.dispatchDraftItems[rowIdx]) {
        state.dispatchDraftItems[rowIdx].qcNote = qcNoteInput.value;
      }
      const clearBtn = qcNoteInput.parentElement?.querySelector('[data-clear-ret-qc]');
      if (clearBtn) {
        clearBtn.classList.toggle('hidden', !qcNoteInput.value);
      }
    }
  });

  // Delegate click for QC note clear button
  dispatchTableBody?.addEventListener('click', e => {
    const clearBtn = e.target.closest('[data-clear-ret-qc]');
    if (clearBtn) {
      const rowIdx = Number(clearBtn.getAttribute('data-clear-ret-qc'));
      const input = document.getElementById(`retQcNote_${rowIdx}`) || document.querySelector(`[data-ret-qc-note="${rowIdx}"]`);
      if (input) {
        input.value = '';
        if (state.dispatchDraftItems && state.dispatchDraftItems[rowIdx]) {
          state.dispatchDraftItems[rowIdx].qcNote = '';
        }
        clearBtn.classList.add('hidden');
        input.focus();
      }
    }
  });

  // Return Loan Photo upload & remove handlers (แนบรูปของใบยืม รูปรวมเหมือนตอนยืม)
  const returnPhotoInput = document.getElementById('dispatchReturnPhotoInput');
  returnPhotoInput?.addEventListener('change', async e => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      const dataUrl = await compressImageFile(f);
      if (!state.dispatchReturnPhotos) state.dispatchReturnPhotos = [];
      state.dispatchReturnPhotos.push(dataUrl);
    }
    e.target.value = '';
    renderDispatchReturnPhotosPreview();
  });

  document.getElementById('dispatchReturnProofSection')?.addEventListener('click', e => {
    const rmBtn = e.target.closest('[data-rm-ret-photo]');
    if (rmBtn) {
      e.preventDefault();
      e.stopPropagation();
      const idx = Number(rmBtn.getAttribute('data-rm-ret-photo'));
      if (state.dispatchReturnPhotos && state.dispatchReturnPhotos[idx] !== undefined) {
        state.dispatchReturnPhotos.splice(idx, 1);
        renderDispatchReturnPhotosPreview();
      }
      return;
    }

    const snapBtn = e.target.closest('#btnSnapReturnPhoto');
    if (snapBtn) {
      e.preventDefault();
      openLiveCamera('return');
      return;
    }

    const previewPhoto = e.target.closest('[data-preview-ret-photo]');
    if (previewPhoto) {
      e.preventDefault();
      const pIdx = Number(previewPhoto.getAttribute('data-preview-ret-photo'));
      const photos = (state.dispatchReturnPhotos || []).map((src, i) => ({
        url: src,
        name: `หลักฐานรับคืน_${state.activeDispatchLoan?.id || 'loan'}_${i + 1}.jpg`,
        type: 'image/jpeg'
      }));
      if (photos.length > 0) {
        openFilePreview(photos, pIdx);
      }
      return;
    }

    const imgBox = e.target.closest('#dispatchReturnImageBox');
    if (imgBox) {
      e.preventDefault();
      document.getElementById('dispatchReturnPhotoInput')?.click();
      return;
    }
  });

  document.getElementById('dispatchForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!state.activeDispatchLoan) return;

    const unpicked = state.dispatchDraftItems.filter(r => !r.tag_id);
    if (unpicked.length > 0) {
      const firstUnpickedIdx = state.dispatchDraftItems.findIndex(r => !r.tag_id);
      if (firstUnpickedIdx >= 0) {
        state.activeDispatchRowIdx = firstUnpickedIdx;
        renderDispatchTable();
      }
      showToast(`⚠️ ยังสแกนหรือเลือก S/N ไม่ครบ (เหลืออีก ${unpicked.length} เครื่อง)`);
      return;
    }

    // Collect all photos from all rows to save into before_photos
    const allBeforePhotos = state.dispatchDraftItems.flatMap(r => r.photos || []);

    const itemsPayload = state.dispatchDraftItems.map(it => ({
      ...it,
      attachments: (it.photos || []).map((url, pIdx) => ({
        name: `สภาพ_${it.model || 'item'}_${pIdx + 1}.png`,
        url,
        size: 0,
        type: 'image/png'
      }))
    }));

    try {
      const res = await fetch(`/api/loans/${encodeURIComponent(state.activeDispatchLoan.id)}/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsPayload,
          before_photos: allBeforePhotos,
          dispatcher_name: state.currentUser?.name || 'เจ้าหน้าที่คลัง'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกการจัดของไม่สำเร็จ');
      applyServerState(data);

      if (state.activeDispatchLoan?.status === 'Dispatched') {
        state.dispatchOnsiteEditMode = false;
        state.activeDispatchLoan = state.loans.find(l => l.id === state.activeDispatchLoan.id) || state.activeDispatchLoan;
        const scannerBar = document.getElementById('dispatchBarcodeScannerBar');
        if (scannerBar) scannerBar.classList.add('hidden');
        renderDispatchTable();
        showToast(`✅ บันทึกการแก้ไขหน้างานใบยืม ${state.activeDispatchLoan.id} เรียบร้อย`);
      } else {
        document.getElementById('dispatchDialog').close();
        showToast(`✅ จัดของและ Match S/N ใบยืม ${state.activeDispatchLoan.id} สำเร็จ (ย้ายไปรอส่งมอบ)`);
      }
    } catch (err) {
      showToast('⚠️ ' + err.message);
    }
  });

  // ==========================================================================
  // RETURN & QC MODAL EVENTS
  // ==========================================================================
  document.getElementById('returnPhotoInput').addEventListener('change', async e => {
    const files = Array.from(e.target.files || []);
    for (const f of files) {
      const dataUrl = await compressImageFile(f);
      state.returnAfterPhotos.push(dataUrl);
    }
    e.target.value = '';
    renderReturnAfterPhotosPreview();
  });

  document.getElementById('returnAfterPhotosPreview').addEventListener('click', e => {
    const btn = e.target.closest('[data-rm-after-photo]');
    if (btn) {
      const idx = Number(btn.getAttribute('data-rm-after-photo'));
      state.returnAfterPhotos.splice(idx, 1);
      renderReturnAfterPhotosPreview();
    }
  });

  const retContainer = document.getElementById('returnItemsContainer');
  retContainer.addEventListener('click', e => {
    const accBtn = e.target.closest('[data-toggle-ret-acc]');
    if (accBtn) {
      const idx = Number(accBtn.getAttribute('data-toggle-ret-acc'));
      const acc = accBtn.getAttribute('data-acc');
      const item = state.returnDraftItems[idx];
      if (item.missingSet.has(acc)) item.missingSet.delete(acc);
      else item.missingSet.add(acc);
      renderReturnChecklistItems();
      return;
    }

    const stBtn = e.target.closest('[data-qc-status]');
    if (stBtn) {
      const idx = Number(stBtn.getAttribute('data-qc-status'));
      const val = stBtn.getAttribute('data-val');
      state.returnDraftItems[idx].qcStatus = val;
      if (val === 'Pass') state.returnDraftItems[idx].missingSet.clear();
      renderReturnChecklistItems();
    }
  });

  retContainer.addEventListener('change', e => {
    if (e.target.matches('[data-ret-select]')) {
      const idx = Number(e.target.getAttribute('data-ret-select'));
      state.returnDraftItems[idx].selectedForReturn = e.target.checked;
    }
    if (e.target.matches('[data-qc-confirm-loc]')) {
      const idx = Number(e.target.getAttribute('data-qc-confirm-loc'));
      state.returnDraftItems[idx].confirmedLocation = e.target.checked;
    }
  });

  retContainer.addEventListener('input', e => {
    if (e.target.matches('[data-qc-note]')) {
      const idx = Number(e.target.getAttribute('data-qc-note'));
      state.returnDraftItems[idx].qcNote = e.target.value;
    }
  });

  document.getElementById('returnForm').addEventListener('submit', async e => {
    e.preventDefault();
    if (!state.activeReturnLoan) return;

    const chosen = state.returnDraftItems.filter(i => i.selectedForReturn);
    if (chosen.length === 0) {
      showToast('กรุณาติ๊กเลือกเครื่องที่รับคืนอย่างน้อย 1 เครื่อง');
      return;
    }

    for (const it of chosen) {
      const isFail = it.qcStatus === 'Fail' || it.missingSet.size > 0;
      if (!isFail && !it.confirmedLocation) {
        showToast(`📍 กรุณาติ๊กยืนยันนำเครื่อง ${it.tag_id} เก็บเข้าที่เดิม (${it.location_snapshot})`);
        return;
      }
    }

    const itemsPayload = chosen.map(it => {
      const missing = [...it.missingSet];
      const returned = it.allAccessories.filter(a => !it.missingSet.has(a));
      const isFail = it.qcStatus === 'Fail' || missing.length > 0;
      return {
        tag_id: it.tag_id,
        returned_accessories: returned,
        missing_accessories: missing,
        qc_status: isFail ? 'Fail' : 'Pass',
        qc_note: it.qcNote,
        returned_to_location: !isFail && it.confirmedLocation
      };
    });

    try {
      const res = await fetch(`/api/loans/${encodeURIComponent(state.activeReturnLoan.id)}/return`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: itemsPayload,
          after_photos: state.returnAfterPhotos,
          return_receiver: (() => {
            const defaultUser = getLoggedInUserName();
            const entered = (document.getElementById('returnReceiverName')?.value || '').trim() || defaultUser;
            if (entered && entered !== defaultUser && !entered.includes('ทดแทน')) {
              return `${entered} (ทดแทน)`;
            }
            return entered;
          })()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกรับคืนไม่สำเร็จ');
      applyServerState(data);
      document.getElementById('returnDialog').close();
      showToast('✅ บันทึกการรับคืนและผลตรวจ QC เรียบร้อยแล้ว');
    } catch (err) {
      showToast('⚠️ ' + err.message);
    }
  });

  // ==========================================================================
  // STOCK VIEW (CARDS & ADD DEMO EVENTS)
  // ==========================================================================
  document.getElementById('stockSourceFilter')?.addEventListener('click', e => {
    const chip = e.target.closest('.chip, .chip-filter');
    if (!chip) return;
    document.querySelectorAll('#stockSourceFilter .chip, #stockSourceFilter .chip-filter').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.stockSourceFilter = chip.getAttribute('data-src');
    renderStockView();
  });

  // Toggle All Brands Collapse / Expand
  document.getElementById('btnToggleAllBrands')?.addEventListener('click', () => {
    const allBlocks = Array.from(document.querySelectorAll('.brand-group-block'));
    const allBrands = allBlocks.map(b => b.getAttribute('data-brand')).filter(Boolean);
    const allCollapsed = allBrands.length > 0 && allBrands.every(b => !state.expandedBrands.has(b));
    if (allCollapsed) {
      allBrands.forEach(b => state.expandedBrands.add(b));
    } else {
      state.expandedBrands.clear();
    }
    renderStockView();
  });

  const stockContainer = document.getElementById('stockCardsContainer') || document.getElementById('stockTableBody');
  if (stockContainer) {
    stockContainer.addEventListener('click', async e => {
      // Empty state "Add Demo" button
      if (e.target.id === 'btnEmptyAddDemo') {
        openAddDemoModal();
        return;
      }

      // Brand group header clicked -> collapse/expand!
      const brandHeader = e.target.closest('.excel-brand-line-header, .brand-group-header-banner, .brand-group-header');
      if (brandHeader) {
        const block = brandHeader.closest('.brand-group-block');
        if (block) {
          const brand = block.getAttribute('data-brand');
          if (state.expandedBrands.has(brand)) {
            state.expandedBrands.delete(brand);
          } else {
            state.expandedBrands.add(brand);
          }
          renderStockView();
        }
        return;
      }

      // Loan link clicked -> handled by global document listener
      if (e.target.closest('[data-open-loan], [data-open-print]')) {
        return;
      }

      // Card clicked -> open Asset Detail Modal!
      const card = e.target.closest('[data-open-asset-tag]');
      if (card) {
        const tagId = card.getAttribute('data-open-asset-tag');
        openAssetDetailModal(tagId);
      }
    });

    stockContainer.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && (e.target.classList.contains('excel-brand-line-header') || e.target.classList.contains('brand-group-header-banner') || e.target.classList.contains('brand-group-header'))) {
        e.preventDefault();
        e.target.click();
      }
    });
  }

  // --------------------------------------------------------------------------
  // ASSET DETAIL & EDIT MODAL CONTROLLER
  // --------------------------------------------------------------------------
  state.editAssetAccessories = [];

  function renderEditAssetAccChips() {
    const wrap = document.getElementById('editAssetAccWrap');
    const hint = document.getElementById('editAssetAccCountHint');
    if (!wrap) return;

    if (hint) hint.textContent = `${state.editAssetAccessories.length} ชิ้น`;

    const chipsHtml = (state.editAssetAccessories || []).map((acc, idx) => `
      <span class="asset-chip-tag">
        <span class="chip-text">${escapeHtml(acc)}</span>
        <button type="button" class="chip-remove-btn" data-rm-edit-asset-acc="${idx}" title="ลบ">×</button>
      </span>
    `).join('');

    wrap.innerHTML = `
      ${chipsHtml}
      <div class="tag-input-with-arrow">
        <input type="text" id="editAssetNewAccInput" class="tag-add-inline" placeholder="+ พิมพ์อุปกรณ์แล้วกด Enter..." autocomplete="off" />
        <button type="button" class="btn-tag-dropdown-arrow" id="btnToggleEditAssetAcc" title="เลือกจากรายการ">▾</button>
      </div>
    `;
  }

  // --------------------------------------------------------------------------
  // MODAL ACCESSORY DROPDOWN (Matches loan form format)
  // --------------------------------------------------------------------------
  function closeModalAccDropdown(mode) {
    if (mode === 'edit' || !mode) {
      const d = document.getElementById('assetDetailAccessoryDropdown');
      if (d) d.classList.add('hidden');
    }
    if (mode === 'add' || !mode) {
      const d = document.getElementById('addDemoAccessoryDropdown');
      if (d) d.classList.add('hidden');
    }
  }

  function renderModalAccDropdown(mode, query = '') {
    const isEdit = mode === 'edit';
    const dropdown = document.getElementById(isEdit ? 'assetDetailAccessoryDropdown' : 'addDemoAccessoryDropdown');
    const targetInput = document.getElementById(isEdit ? 'editAssetNewAccInput' : 'addDemoNewAccInput');
    if (!dropdown || !targetInput) return;

    const currentTags = isEdit ? state.editAssetAccessories : state.addDemoAccessories;
    const existingTags = new Set(currentTags || []);

    const q = (query || '').trim().toLowerCase();
    const filtered = (state.accessorySuggestions || []).filter(s => {
      if (existingTags.has(s)) return false;
      if (!q) return true;
      return s.toLowerCase().includes(q);
    });

    const headerHtml = `
      <div class="dropdown-header-bar">
        <span class="dropdown-header-title">🔌 เลือกอุปกรณ์เสริม (${filtered.length})</span>
        <button type="button" class="btn-close-dropdown" data-close-modal-acc="${mode}" title="ปิด (✕)">✕</button>
      </div>
    `;

    if (filtered.length === 0) {
      if (q) {
        dropdown.innerHTML = `
          ${headerHtml}
          <div class="dropdown-scroll-list">
            <div class="model-dropdown-item" data-modal-select-acc="${escapeHtml(query.trim())}" data-modal-mode="${mode}">
              <div class="model-item-main">
                <span class="model-item-name">➕ เพิ่ม Tag ใหม่: "${escapeHtml(query.trim())}"</span>
                <span class="model-item-sub">กดคลิกหรือกด Enter เพื่อเพิ่ม Tag นี้</span>
              </div>
              <span class="model-item-badge badge-avail">+ เพิ่ม</span>
            </div>
          </div>
        `;
      } else {
        dropdown.innerHTML = `
          ${headerHtml}
          <div class="model-dropdown-empty">เลือกครบทุกอุปกรณ์แนะนำแล้ว (พิมพ์เพิ่มใหม่ได้)</div>
        `;
      }
    } else {
      let html = '';
      const exactMatch = filtered.some(s => s.toLowerCase() === q);
      if (q && !exactMatch) {
        html += `
          <div class="model-dropdown-item" data-modal-select-acc="${escapeHtml(query.trim())}" data-modal-mode="${mode}" style="background:#f0fdf4;">
            <div class="model-item-main">
              <span class="model-item-name" style="color:#15803d;">➕ เพิ่ม Tag ใหม่: "${escapeHtml(query.trim())}"</span>
              <span class="model-item-sub">สร้างป้ายอุปกรณ์เสริมตามที่พิมพ์</span>
            </div>
            <span class="model-item-badge badge-avail">+ เพิ่ม</span>
          </div>
        `;
      }

      for (const item of filtered) {
        html += `
          <div
            class="model-dropdown-item"
            data-modal-select-acc="${escapeHtml(item)}"
            data-modal-mode="${mode}"
          >
            <div class="model-item-main">
              <span class="model-item-name">${escapeHtml(item)}</span>
              <span class="model-item-sub">อุปกรณ์เสริม</span>
            </div>
            <span class="model-item-badge badge-avail">+ เพิ่ม</span>
          </div>
        `;
      }

      dropdown.innerHTML = `
        ${headerHtml}
        <div class="dropdown-scroll-arrow top-arrow hidden" title="เลื่อนขึ้น">▲</div>
        <div class="dropdown-scroll-list">
          ${html}
        </div>
        <div class="dropdown-scroll-arrow bottom-arrow" title="เลื่อนลง">▼</div>
      `;
      setupDropdownScrollArrows(dropdown);
    }

    // Positioning
    const inputRect = targetInput.getBoundingClientRect();
    const isMobile = window.innerWidth <= 640;
    const dropdownWidth = isMobile ? Math.min(window.innerWidth - 24, 360) : 340;

    dropdown.style.width = `${dropdownWidth}px`;

    if (isMobile) {
      dropdown.style.left = `${Math.max(10, Math.floor((window.innerWidth - dropdownWidth) / 2))}px`;
    } else {
      dropdown.style.left = `${Math.max(10, Math.min(inputRect.left, window.innerWidth - dropdownWidth - 16))}px`;
    }

    const spaceBelow = window.innerHeight - inputRect.bottom - 20;
    const spaceAbove = inputRect.top - 20;

    if (spaceBelow < 200 && spaceAbove > spaceBelow) {
      const maxHeight = Math.max(160, Math.floor(spaceAbove));
      dropdown.style.maxHeight = `${maxHeight}px`;
      dropdown.style.bottom = `${window.innerHeight - inputRect.top + 6}px`;
      dropdown.style.top = 'auto';
    } else {
      const maxHeight = Math.max(180, Math.floor(spaceBelow));
      dropdown.style.maxHeight = `${maxHeight}px`;
      dropdown.style.top = `${inputRect.bottom + 6}px`;
      dropdown.style.bottom = 'auto';
    }

    dropdown.classList.remove('hidden');
  }

  // Client-side image resize & compression using HTML5 Canvas
  async function compressAndResizeImage(file, maxDimension = 1400, quality = 0.82) {
    if (!file || !file.type || !file.type.startsWith('image/')) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve({ dataUrl: reader.result, name: file ? file.name : 'file', size: file ? file.size : 0, type: file ? file.type : '' });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = e => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            if (width > height) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            } else {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          // Force JPEG or PNG for optimal compression
          const mime = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          const resizedDataUrl = canvas.toDataURL(mime, quality);

          const base64Len = resizedDataUrl.length - (resizedDataUrl.indexOf(',') + 1);
          const approxBytes = Math.round((base64Len * 3) / 4);

          resolve({
            dataUrl: resizedDataUrl,
            name: file.name.replace(/\.[^/.]+$/, '') + (mime === 'image/png' ? '.png' : '.jpg'),
            size: approxBytes,
            type: mime
          });
        };
        img.onerror = () => {
          resolve({ dataUrl: e.target.result, name: file.name, size: file.size, type: file.type });
        };
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Helper: Upload image file to server via /api/upload with automatic compression
  async function uploadImageFile(file) {
    if (!file) throw new Error('ไม่พบไฟล์');
    if (!file.type || !file.type.startsWith('image/')) throw new Error('กรุณาเลือกไฟล์ที่เป็นรูปภาพ');

    const compressed = await compressAndResizeImage(file, 1400, 0.82);

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: compressed.name,
        data: compressed.dataUrl,
        size: compressed.size,
        type: compressed.type
      })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'อัปโหลดรูปภาพไม่สำเร็จ');
    return data.url;
  }

  function switchAssetDetailTab(tab) {
    const dialog = document.getElementById('assetDetailModalDialog');
    const btnInfo = document.getElementById('btnTabAssetInfo');
    const btnHist = document.getElementById('btnTabAssetHistory');
    const btnLogs = document.getElementById('btnTabAssetAuditLogs');
    const paneInfo = document.getElementById('assetTabPaneInfo');
    const paneHist = document.getElementById('assetTabPaneHistory');
    const paneLogs = document.getElementById('assetTabPaneLogs');
    const btnCancel = document.getElementById('btnCancelAssetDetail');

    // Reset all tabs & panes
    [btnInfo, btnHist, btnLogs].forEach(b => {
      b?.classList.remove('active');
      b?.setAttribute('aria-selected', 'false');
    });
    [paneInfo, paneHist, paneLogs].forEach(p => p?.classList.add('hidden'));

    if (tab === 'history') {
      dialog?.classList.add('tab-history-active');
      dialog?.classList.remove('tab-logs-active');
      btnHist?.classList.add('active');
      btnHist?.setAttribute('aria-selected', 'true');
      paneHist?.classList.remove('hidden');
    } else if (tab === 'logs') {
      dialog?.classList.remove('tab-history-active');
      dialog?.classList.add('tab-logs-active');
      btnLogs?.classList.add('active');
      btnLogs?.setAttribute('aria-selected', 'true');
      paneLogs?.classList.remove('hidden');
    } else {
      dialog?.classList.remove('tab-history-active');
      dialog?.classList.remove('tab-logs-active');
      btnInfo?.classList.add('active');
      btnInfo?.setAttribute('aria-selected', 'true');
      paneInfo?.classList.remove('hidden');
    }
    if (btnCancel) btnCancel.textContent = 'ปิด';
  }

  state.currentAssetHistory = [];
  state.assetHistoryPage = 1;
  state.assetHistoryPageSize = 5;

  function renderLibraryCardPage() {
    const tbody = document.getElementById('libraryCardRowsBody');
    const curPageEl = document.getElementById('libCurrentPage');
    const totalPagesEl = document.getElementById('libTotalPages');
    const totalRecordsEl = document.getElementById('libTotalRecords');
    const prevBtn = document.getElementById('btnLibPrevPage');
    const nextBtn = document.getElementById('btnLibNextPage');
    const pillsWrap = document.getElementById('libPagePillsWrap');

    const totalRecords = state.currentAssetHistory.length;
    const totalPages = Math.max(1, Math.ceil(totalRecords / state.assetHistoryPageSize));

    if (state.assetHistoryPage > totalPages) state.assetHistoryPage = totalPages;
    if (state.assetHistoryPage < 1) state.assetHistoryPage = 1;

    if (curPageEl) curPageEl.textContent = state.assetHistoryPage;
    if (totalPagesEl) totalPagesEl.textContent = totalPages;
    if (totalRecordsEl) totalRecordsEl.textContent = totalRecords;
    if (prevBtn) prevBtn.disabled = (state.assetHistoryPage <= 1);
    if (nextBtn) nextBtn.disabled = (state.assetHistoryPage >= totalPages);

    if (pillsWrap) {
      if (totalPages > 1) {
        let pillsHtml = '';
        for (let p = 1; p <= totalPages; p++) {
          pillsHtml += `<button type="button" class="lib-page-pill-btn ${p === state.assetHistoryPage ? 'active' : ''}" data-lib-page="${p}">${p}</button>`;
        }
        pillsWrap.innerHTML = pillsHtml;
      } else {
        pillsWrap.innerHTML = '';
      }
    }

    if (!tbody) return;

    const startIdx = (state.assetHistoryPage - 1) * state.assetHistoryPageSize;
    const pageItems = state.currentAssetHistory.slice(startIdx, startIdx + state.assetHistoryPageSize);

    let rowsHtml = '';

    pageItems.forEach(h => {
      if (h.is_disposition) {
        const isDischarge = h.action === 'dispose';
        rowsHtml += `
          <tr class="lib-row-disposition ${isDischarge ? 'row-dispose' : 'row-reactivate'}">
            <td>
              <span class="lib-date-val font-mono" style="font-weight:700; color:${isDischarge ? '#dc2626' : '#16a34a'};">${escapeHtml(h.action_date || '—')}</span>
            </td>
            <td>—</td>
            <td>—</td>
            <td>
              <span class="lib-borrower-name">${escapeHtml(h.user_name || 'เจ้าหน้าที่')}</span>
              <div class="lib-borrower-role" style="color:#64748b;">${isDischarge ? 'ผู้บันทึกจำหน่าย' : 'ผู้รับกลับเข้าคลัง'}</div>
            </td>
            <td>
              <div style="font-weight:700; font-size:13px; color:${isDischarge ? '#dc2626' : '#16a34a'};">
                ${isDischarge ? '📦 บันทึกจำหน่ายเครื่องออกจากระบบ' : '📥 นำเครื่องกลับเข้าคลัง'}
              </div>
              <div style="font-size:12px; color:#475569; margin-top:2px;">
                ${escapeHtml(h.reason ? `สาเหตุ: ${h.reason}` : '')} ${escapeHtml(h.note ? `(หมายเหตุ: ${h.note})` : '')}
              </div>
            </td>
            <td style="text-align:center;">
              <span class="lib-stamp ${isDischarge ? 'stamped-overdue' : 'stamped-returned'}">
                ${isDischarge ? '📦 จำหน่ายออก' : '📥 กลับเข้าคลัง'}
              </span>
            </td>
          </tr>
        `;
        return;
      }

      const isReturnedComplete = Boolean(h.returned || h.loan_status === 'Returned');
      const isWaitingSupplier = h.loan_status === 'Pending_Return_Supplier_Sale';
      const isWaitingQc = h.loan_status === 'Pending_QC';
      const hasReturnedFromCustomer = Boolean(h.returned_at || h.return_date || isReturnedComplete || isWaitingSupplier || isWaitingQc);

      const rawReturnDate = h.returned_at || h.return_date || (hasReturnedFromCustomer ? (h.supplier_return_timestamp || h.sale_return_timestamp || h.updated_at) : null);
      let returnDateDisplay = '—';
      if (rawReturnDate) {
        returnDateDisplay = String(rawReturnDate).slice(0, 10);
      } else if (hasReturnedFromCustomer) {
        returnDateDisplay = (h.checkout_date ? String(h.checkout_date).slice(0, 10) : 'คืนแล้ว');
      }

      const isOverdue = !hasReturnedFromCustomer && h.due_date && (new Date(h.due_date).getTime() < new Date().setHours(0,0,0,0));

      let stampHtml = '';
      if (isReturnedComplete) {
        stampHtml = '<span class="lib-stamp stamped-returned">✅ คืนแล้ว</span>';
      } else if (isWaitingSupplier) {
        stampHtml = '<span class="lib-stamp stamped-supplier">🚚 รอคืน Supplier</span>';
      } else if (isWaitingQc) {
        stampHtml = '<span class="lib-stamp stamped-qc">🔍 รอตรวจ QC</span>';
      } else if (isOverdue) {
        stampHtml = '<span class="lib-stamp stamped-overdue">🔴 เกินกำหนด</span>';
      } else {
        stampHtml = '<span class="lib-stamp stamped-ongoing">🔵 กำลังยืม</span>';
      }

      const accList = Array.isArray(h.loan_accessories) ? h.loan_accessories : [];
      const accText = accList.length > 0 ? accList.join(', ') : '';

      rowsHtml += `
        <tr>
          <td>
            <span class="lib-date-val">${escapeHtml(h.checkout_date || '—')}</span>
          </td>
          <td>
            <span class="lib-date-val ${!hasReturnedFromCustomer ? 'due-ongoing' : ''}">${escapeHtml(h.due_date || '—')}</span>
          </td>
          <td>
            <span class="lib-date-val ${hasReturnedFromCustomer ? 'returned-ok font-mono' : ''}">${escapeHtml(returnDateDisplay)}</span>
          </td>
          <td>
            <span class="lib-borrower-name">${escapeHtml(h.borrower_name || '—')}</span>
            ${h.borrower_phone ? `<div class="lib-borrower-role">${escapeHtml(h.borrower_phone)}</div>` : ''}
          </td>
          <td>
            <div style="display:flex; align-items:center; gap:6px; overflow:hidden;">
              ${h.loan_id ? `
                <button type="button" class="doc-link-pill lib-loan-link" data-open-loan="${escapeHtml(h.loan_id)}" title="คลิกเพื่อเปิดดูใบยืมจริง ${escapeHtml(h.loan_id)}">
                  <span>${escapeHtml(h.loan_id)}</span>
                  <svg class="doc-link-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                    <polyline points="15 3 21 3 21 9"></polyline>
                    <line x1="10" y1="14" x2="21" y2="3"></line>
                  </svg>
                </button>
              ` : '<span class="lib-loan-slip-tag">LOAN</span>'}
              <span class="lib-company-name" title="${escapeHtml(h.customer_company || h.customer_name || '')}">
                ${escapeHtml(h.customer_company || h.customer_name || '—')}
              </span>
            </div>
            ${accText ? `<span class="lib-acc-summary" title="${escapeHtml(accText)}">🎒 ${escapeHtml(accText)}</span>` : ''}
          </td>
          <td style="text-align:center;">
            ${stampHtml}
          </td>
        </tr>
      `;
    });

    // Fill remaining rows to always equal 5 fixed rows
    const blankCount = state.assetHistoryPageSize - pageItems.length;
    for (let i = 0; i < blankCount; i++) {
      rowsHtml += `
        <tr class="lib-blank-row">
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td>—</td>
          <td>${pageItems.length === 0 && i === 2 ? '<span style="color:#a8a29e; font-size:12px; font-weight:500;">( บัตรว่าง — ยังไม่มีประวัติการยืม )</span>' : '—'}</td>
          <td style="text-align:center;">—</td>
        </tr>
      `;
    }

    tbody.innerHTML = rowsHtml;
  }

  async function loadAssetLoanHistory(asset) {
    const histTabBadge = document.getElementById('assetHistoryTabBadge');
    const histCalloutCount = document.getElementById('assetDetailHistoryCount');
    const libCardTag = document.getElementById('libCardTag');
    const libCardModel = document.getElementById('libCardModel');
    const libCardSn = document.getElementById('libCardSn');
    const libCardTotalBadge = document.getElementById('libCardTotalBadge');
    const libCardCurrStatus = document.getElementById('libCardCurrStatus');

    if (libCardTag) libCardTag.textContent = asset.tag_id;
    if (libCardModel) libCardModel.textContent = asset.brand ? `${asset.brand} ${asset.model}` : asset.model;
    if (libCardSn) libCardSn.textContent = asset.serial_no || '—';

    const isAvailable = asset.status === 'Available';
    const isDisposed = asset.status === 'Disposed';
    const wf = getAssetWorkflowStatus(asset);
    if (libCardCurrStatus) {
      if (isAvailable) {
        libCardCurrStatus.innerHTML = '<span class="lib-status-pill avail">🟢 ว่างพร้อมยืม</span>';
      } else if (isDisposed) {
        libCardCurrStatus.innerHTML = `<span class="lib-status-pill disposed font-mono" style="background:#fee2e2; color:#b91c1c; border:1px solid #fca5a5;">⚪ จำหน่ายแล้ว (${formatShortDate(asset.disposed_at) || asset.disposed_at || '-'})</span>`;
      } else {
        const curLoanId = asset.current_loan_id || '';
        libCardCurrStatus.innerHTML = curLoanId
          ? `<button type="button" class="doc-link-pill lib-status-pill ${wf.pillCls}" data-open-loan="${escapeHtml(curLoanId)}" title="คลิกเพื่อเปิดดูใบยืมจริง ${escapeHtml(curLoanId)}"><span>${wf.badgeIcon} ${escapeHtml(wf.text)} (${escapeHtml(curLoanId)})</span><svg class="doc-link-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg></button>`
          : `<span class="lib-status-pill ${wf.pillCls}">${wf.badgeIcon} ${escapeHtml(wf.text)}</span>`;
      }
    }

    state.assetHistoryPage = 1;
    state.currentAssetHistory = [];

    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(asset.tag_id)}/history`);
      if (!res.ok) throw new Error('Failed to fetch history');
      const data = await res.json();
      
      const loanRecords = Array.isArray(data.history) ? data.history : [];
      const dispRecords = (data.disposition_logs || []).map(dl => ({
        is_disposition: true,
        action: dl.action,
        action_date: dl.action_date,
        reason: dl.reason,
        note: dl.note,
        user_name: dl.user_name,
        created_at: dl.created_at,
        checkout_date: dl.action_date
      }));

      // Combine and sort by date descending
      state.currentAssetHistory = [...loanRecords, ...dispRecords].sort((a, b) => {
        const dateA = a.action_date || a.checkout_date || '';
        const dateB = b.action_date || b.checkout_date || '';
        return dateB.localeCompare(dateA);
      });

      const totalLoans = loanRecords.length;
      if (histTabBadge) histTabBadge.textContent = state.currentAssetHistory.length;
      if (histCalloutCount) histCalloutCount.textContent = totalLoans;
      if (libCardTotalBadge) libCardTotalBadge.textContent = `ยืมสะสม ${totalLoans} ครั้ง`;

      renderLibraryCardPage();
    } catch (err) {
      console.error('Failed to load asset history:', err);
      renderLibraryCardPage();
    }
  }

  // --------------------------------------------------------------------------
  // ASSET AUDIT LOG CONTROLLERS & RENDERERS (บันทึกประวัติกิจกรรมสินค้า)
  // --------------------------------------------------------------------------
  state.currentAssetAuditLogs = [];

  async function loadAssetAuditLogs(asset) {
    const badge = document.getElementById('assetAuditLogTabBadge');
    const totalBadge = document.getElementById('auditLogTotalBadge');
    const timeline = document.getElementById('assetAuditLogTimeline');

    if (badge) badge.textContent = '...';
    if (totalBadge) totalBadge.textContent = '...';
    if (timeline) timeline.innerHTML = `<div style="text-align:center; padding:30px; color:#94a3b8;"><span class="spinner-sm"></span> กำลังโหลดประวัติกิจกรรม...</div>`;

    state.currentAssetAuditLogs = [];

    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(asset.tag_id)}/audit-logs`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ไม่สามารถดึงข้อมูล Audit Log ได้');

      state.currentAssetAuditLogs = Array.isArray(data.logs) ? data.logs : [];
      if (badge) badge.textContent = state.currentAssetAuditLogs.length;
      if (totalBadge) totalBadge.textContent = `${state.currentAssetAuditLogs.length} รายการ`;

      renderAssetAuditLogs(state.currentAssetAuditLogs);
    } catch (err) {
      console.error('Failed to load asset audit logs:', err);
      if (badge) badge.textContent = '0';
      if (totalBadge) totalBadge.textContent = '0 รายการ';
      if (timeline) {
        timeline.innerHTML = `
          <div class="audit-log-empty">
            <div class="audit-log-empty-icon">⚠️</div>
            <div>ไม่สามารถโหลดบันทึกประวัติได้: ${escapeHtml(err.message)}</div>
          </div>
        `;
      }
    }
  }

  function renderAssetAuditLogs(logs) {
    const timeline = document.getElementById('assetAuditLogTimeline');
    if (!timeline) return;

    if (!logs || logs.length === 0) {
      timeline.innerHTML = `
        <div class="audit-log-empty">
          <div class="audit-log-empty-icon">📜</div>
          <div style="font-weight:600; font-size:14px; color:#334155; margin-bottom:4px;">ยังไม่มีบันทึกประวัติกิจกรรม</div>
          <div style="font-size:12px;">เมื่อเครื่องนี้มีการยืม ส่งมอบ ตรวจ QC หรือแก้ไขข้อมูล ระบบจะบันทึกประวัติไว้ที่นี่อัตโนมัติ</div>
        </div>
      `;
      return;
    }

    const typeConfig = {
      CREATE: { icon: '✨', pointCls: 'type-create', badgeCls: 'type-create', badgeText: 'เพิ่มเข้าระบบ' },
      UPDATE: { icon: '✏️', pointCls: 'type-update', badgeCls: 'type-update', badgeText: 'แก้ไขข้อมูล' },
      LOAN_RESERVED: { icon: '📄', pointCls: 'type-loan', badgeCls: 'type-loan', badgeText: 'ระบุในใบยืม' },
      DISPATCH: { icon: '🚚', pointCls: 'type-dispatch', badgeCls: 'type-dispatch', badgeText: 'จ่ายสินค้า' },
      DELIVER: { icon: '📍', pointCls: 'type-deliver', badgeCls: 'type-deliver', badgeText: 'ส่งมอบสินค้า' },
      QC: { icon: '🔍', pointCls: 'type-qc', badgeCls: 'type-qc', badgeText: 'ตรวจสภาพ QC' },
      RETURN: { icon: '↩️', pointCls: 'type-return', badgeCls: 'type-return', badgeText: 'คืนคลัง Demo' },
      RETURN_SUPPLIER: { icon: '🚚', pointCls: 'type-return', badgeCls: 'type-return', badgeText: 'คืน Supplier' },
      RETURN_SALE: { icon: '🏢', pointCls: 'type-return', badgeCls: 'type-return', badgeText: 'คืนคลังขาย' },
      DISPOSE: { icon: '📦', pointCls: 'type-dispose', badgeCls: 'type-dispose', badgeText: 'จำหน่ายออก' },
      REACTIVATE: { icon: '📥', pointCls: 'type-reactivate', badgeCls: 'type-reactivate', badgeText: 'นำกลับเข้าคลัง' }
    };

    timeline.innerHTML = logs.map(item => {
      const cfg = typeConfig[item.action_type] || { icon: '📋', pointCls: 'type-update', badgeCls: 'type-update', badgeText: item.action_type || 'กิจกรรม' };
      const meta = item.metadata || {};
      const loanId = meta.loanId || '';
      const timeStr = item.created_at ? formatDateTimeThai(item.created_at) : '-';

      let pillsHtml = '';
      if (loanId) {
        pillsHtml += `
          <button type="button" class="doc-link-pill" data-open-loan="${escapeHtml(loanId)}" style="font-size:11.5px; padding:2px 8px;" title="เปิดดูใบยืม ${escapeHtml(loanId)}">
            <span>${escapeHtml(loanId)}</span>
            <svg class="doc-link-icon" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </button>
        `;
      }
      if (meta.delivery_gps || meta.supplierGps) {
        const gps = meta.delivery_gps || meta.supplierGps;
        pillsHtml += `<span class="badge" style="background:#ecfeff; color:#0e7490; border:1px solid #cffafe; font-size:11px;">📍 GPS: ${escapeHtml(gps)}</span>`;
      }
      if (meta.qc_status) {
        const isPass = meta.qc_status === 'Pass';
        pillsHtml += `<span class="badge" style="background:${isPass ? '#dcfce7' : '#fee2e2'}; color:${isPass ? '#15803d' : '#b91c1c'}; border:1px solid ${isPass ? '#bbf7d0' : '#fecaca'}; font-size:11px;">${isPass ? 'QC: ผ่าน' : 'QC: มีตำหนิ'}</span>`;
      }

      return `
        <div class="audit-log-item">
          <div class="audit-log-point ${cfg.pointCls}">${cfg.icon}</div>
          <div class="audit-log-card">
            <div class="audit-log-card-header">
              <div class="audit-log-card-title-group">
                <span class="audit-log-badge ${cfg.badgeCls}">${cfg.badgeText}</span>
                <span class="audit-log-card-title">${escapeHtml(item.action_title || '')}</span>
              </div>
              <div class="audit-log-timestamp">🕒 ${escapeHtml(timeStr)}</div>
            </div>
            ${item.details ? `<div class="audit-log-details">${escapeHtml(item.details)}</div>` : ''}
            <div class="audit-log-footer">
              <div class="audit-log-actor">
                <span style="color:#94a3b8;">ผู้บันทึก:</span>
                <strong>${escapeHtml(item.actor_name || 'ระบบ')}</strong>
              </div>
              ${pillsHtml ? `<div class="audit-log-meta-pills">${pillsHtml}</div>` : ''}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // --------------------------------------------------------------------------
  // ASSET DETAIL: READ-ONLY VIEW RENDERERS & INLINE EDIT CONTROLLERS
  // --------------------------------------------------------------------------
  function renderDetailPhotosReadOnly(asset) {
    const gallery = document.getElementById('detailPhotosReadOnlyGallery');
    const countBadge = document.getElementById('detailPhotoCountBadge');
    if (!gallery) return;

    const images = Array.isArray(asset.images) && asset.images.length > 0
      ? asset.images
      : (asset.image_url ? [asset.image_url] : []);

    if (countBadge) countBadge.textContent = `${images.length} รูป`;

    if (images.length === 0) {
      gallery.innerHTML = `
        <div class="detail-photos-empty-view">
          <span>📷</span>
          <span>ยังไม่มีรูปภาพเครื่อง</span>
        </div>
      `;
      return;
    }

    gallery.innerHTML = images.map((url, idx) => `
      <div class="detail-photo-thumb-readonly" data-preview-img="${escapeHtml(url)}" title="รูปที่ ${idx + 1}${idx === 0 ? ' (รูปหลัก)' : ''}">
        <img src="${escapeHtml(url)}" alt="รูปที่ ${idx + 1}" />
        ${idx === 0 ? '<span class="primary-badge">หลัก</span>' : ''}
      </div>
    `).join('');
  }

  function renderDetailSourceReadOnly(asset) {
    const el = document.getElementById('detailSourceViewVal');
    if (!el) return;
    const src = asset.source || 'Demo';
    const sourceClass = getSourceClass(src);
    el.innerHTML = `<span class="asset-source-pill ${sourceClass}">${escapeHtml(src)}</span>`;
  }

  function renderDetailLocationReadOnly(asset) {
    const el = document.getElementById('detailLocationViewVal');
    if (!el) return;
    if (asset.location && asset.location.trim()) {
      el.innerHTML = `<span>📍 ${escapeHtml(asset.location.trim())}</span>`;
    } else {
      el.innerHTML = `<span class="detail-empty-text">ไม่ได้ระบุที่เก็บ</span>`;
    }
  }

  function renderDetailAccessoriesReadOnly(asset) {
    const el = document.getElementById('detailAccReadOnlyChips');
    const badge = document.getElementById('detailAccCountBadge');
    if (!el) return;
    const accList = asset.accessories || [];
    if (badge) badge.textContent = `${accList.length} ชิ้น`;

    if (accList.length === 0) {
      el.innerHTML = `<span class="detail-empty-text">- ไม่มีอุปกรณ์เสริม -</span>`;
      return;
    }

    el.innerHTML = accList.map(item => `
      <span class="detail-acc-chip-ro">${escapeHtml(item)}</span>
    `).join('');
  }

  function renderDetailNoteReadOnly(asset) {
    const el = document.getElementById('detailNoteViewVal');
    if (!el) return;
    if (asset.free_note && asset.free_note.trim()) {
      el.textContent = asset.free_note.trim();
      el.className = 'detail-note-view-text';
    } else {
      el.textContent = '- ไม่มีหมายเหตุเพิ่มเติม -';
      el.className = 'detail-val-box detail-empty-text';
    }
  }

  function resetAllDetailInlineEdits() {
    // Photos
    document.getElementById('detailPhotosViewMode')?.classList.remove('hidden');
    document.getElementById('detailPhotosEditMode')?.classList.add('hidden');
    document.getElementById('detailSectionPhotos')?.classList.remove('is-editing');

    // Source
    document.getElementById('detailSourceViewMode')?.classList.remove('hidden');
    document.getElementById('detailSourceEditMode')?.classList.add('hidden');
    document.getElementById('detailSectionSource')?.classList.remove('is-editing');
    document.getElementById('editAssetSourceDropdown')?.classList.add('hidden');

    // Location
    document.getElementById('detailLocationViewMode')?.classList.remove('hidden');
    document.getElementById('detailLocationEditMode')?.classList.add('hidden');
    document.getElementById('detailSectionLocation')?.classList.remove('is-editing');
    document.getElementById('editAssetLocationDropdown')?.classList.add('hidden');

    // Accessories
    document.getElementById('detailAccessoriesViewMode')?.classList.remove('hidden');
    document.getElementById('detailAccessoriesEditMode')?.classList.add('hidden');
    document.getElementById('detailSectionAccessories')?.classList.remove('is-editing');
    closeModalAccDropdown('edit');

    // Note
    document.getElementById('detailNoteViewMode')?.classList.remove('hidden');
    document.getElementById('detailNoteEditMode')?.classList.add('hidden');
    document.getElementById('detailSectionNote')?.classList.remove('is-editing');
  }

  function renderEditAssetSourceList() {
    window.renderEditAssetSourceList = renderEditAssetSourceList;
    const listWrap = document.getElementById('editAssetSourceList');
    if (!listWrap) return;

    const currentSource = (state.currentDetailAsset?.source || 'Demo').trim().toLowerCase();

    const standardSources = [
      { value: 'Demo', display: '1. Demo', icon: '🏷️', sub: 'คลังเครื่องตัวอย่าง' },
      { value: 'Supplier', display: '2. Supplier', icon: '🏭', sub: 'เครื่องส่งคืน / ยืมจากผู้ผลิต' },
      { value: 'คลังขาย', display: '3. คลังขาย', icon: '💼', sub: 'คลังสินค้าสำหรับจำหน่าย' },
      { value: 'ทดแทนระหว่างซ่อม', display: '4. ทดแทนระหว่างซ่อม', icon: '🔧', sub: 'เครื่องสำรองระหว่างซ่อม' }
    ];

    const srcMap = new Map();
    standardSources.forEach(s => srcMap.set(s.value.toLowerCase(), s));

    (state.assets || []).forEach(a => {
      const s = (a.source || '').trim();
      if (s && !srcMap.has(s.toLowerCase())) {
        srcMap.set(s.toLowerCase(), {
          value: s,
          display: s,
          icon: '📦',
          sub: 'คลังสินค้า'
        });
      }
    });

    const allSources = Array.from(srcMap.values());

    listWrap.innerHTML = allSources.map(s => {
      const isSelected = s.value.toLowerCase() === currentSource;
      const count = (state.assets || []).filter(a => (a.source || '').trim().toLowerCase() === s.value.toLowerCase()).length;
      return `
        <div class="source-select-option ${isSelected ? 'is-selected' : ''}" data-source-option="${escapeHtml(s.value)}" role="button" tabindex="0">
          <div class="source-option-main">
            <span class="source-option-icon">${s.icon}</span>
            <div class="source-option-text">
              <span class="source-option-name">${escapeHtml(s.display)}</span>
              <span class="source-option-sub">${escapeHtml(s.sub)}</span>
            </div>
          </div>
          <div class="source-option-end">
            <span class="source-option-count">${count} เครื่อง</span>
            <span class="source-option-check">${isSelected ? '✓' : ''}</span>
          </div>
        </div>
      `;
    }).join('');
  }

  function renderEditAssetLocationDropdown(query = '', forceOpen = false) {
    window.renderEditAssetLocationDropdown = renderEditAssetLocationDropdown;
    const dropdown = document.getElementById('editAssetLocationDropdown');
    const targetInput = document.getElementById('editAssetLocationInput');
    if (!dropdown || !targetInput) return;

    const q = (query || '').trim().toLowerCase();

    const locsSet = new Set(state.locations || []);
    (state.assets || []).forEach(a => a.location && locsSet.add(a.location.trim()));
    if (locsSet.size === 0) {
      locsSet.add('Main Stock (ตู้โชว์/คลังกลาง)');
    }
    const allLocs = Array.from(locsSet).filter(Boolean);
    const filtered = q ? allLocs.filter(l => l.toLowerCase().includes(q)) : allLocs;

    const headerHtml = `
      <div class="dropdown-header-bar">
        <span class="dropdown-header-title">📍 เลือกที่เก็บประจำ (${filtered.length})</span>
        <button type="button" class="btn-close-dropdown" id="btnCloseEditAssetLocDd" title="ปิด (✕)">✕</button>
      </div>
    `;

    let itemsHtml = '';
    if (q && !allLocs.some(l => l.toLowerCase() === q)) {
      itemsHtml += `
        <div class="model-dropdown-item" data-select-edit-location="${escapeHtml(query.trim())}" style="background:#f0fdf4;">
          <div class="model-item-main">
            <span class="model-item-name" style="color:#15803d;">➕ ใช้ที่เก็บใหม่: "${escapeHtml(query.trim())}"</span>
            <span class="model-item-sub">บันทึกเป็นชื่อที่เก็บตามที่พิมพ์</span>
          </div>
          <span class="model-item-badge badge-avail">+ เลือก</span>
        </div>
      `;
    }

    for (const loc of filtered) {
      const locAssetsCount = (state.assets || []).filter(a => (a.location || '').trim().toLowerCase() === loc.toLowerCase()).length;
      itemsHtml += `
        <div class="model-dropdown-item" data-select-edit-location="${escapeHtml(loc)}">
          <div class="model-item-main">
            <span class="model-item-name">📍 ${escapeHtml(loc)}</span>
            <span class="model-item-sub">ตำแหน่งจัดเก็บ</span>
          </div>
          <span class="model-count-box count-full"><span class="count-num">${locAssetsCount} เครื่อง</span></span>
        </div>
      `;
    }

    dropdown.innerHTML = `
      ${headerHtml}
      <div class="dropdown-scroll-arrow top-arrow hidden" title="เลื่อนขึ้น">▲</div>
      <div class="dropdown-scroll-list">
        ${itemsHtml}
      </div>
      <div class="dropdown-scroll-arrow bottom-arrow" title="เลื่อนลง">▼</div>
    `;
    setupDropdownScrollArrows(dropdown);

    positionAddDemoDropdown(dropdown, targetInput);
  }

  function openAssetDetailModal(tagId) {
    const asset = state.assets.find(a => a.tag_id === tagId);
    if (!asset) return;

    state.currentDetailAsset = asset;
    state.currentDetailTagId = tagId;

    const dialog = document.getElementById('assetDetailModalDialog');
    if (!dialog) return;

    // Reset tab to Info
    switchAssetDetailTab('info');

    // Reset and initiate History fetch
    const histTabBadge = document.getElementById('assetHistoryTabBadge');
    if (histTabBadge) histTabBadge.textContent = '...';
    const histCalloutCount = document.getElementById('assetDetailHistoryCount');
    if (histCalloutCount) histCalloutCount.textContent = '...';
    loadAssetLoanHistory(asset);

    // Reset and initiate Audit Log fetch
    const logTabBadge = document.getElementById('assetAuditLogTabBadge');
    if (logTabBadge) logTabBadge.textContent = '...';
    loadAssetAuditLogs(asset);

    // Header Info
    const catIconEl = document.getElementById('assetDetailCatIcon');
    if (catIconEl) {
      const cat = (asset.category || '').toLowerCase();
      if (cat.includes('printer') || cat.includes('พิมพ์')) catIconEl.textContent = '🖨️';
      else if (cat.includes('scanner') || cat.includes('สแกน')) catIconEl.textContent = '📟';
      else if (cat.includes('tablet') || cat.includes('แท็บเล็ต')) catIconEl.textContent = '📲';
      else if (cat.includes('rfid')) catIconEl.textContent = '📡';
      else if (cat.includes('computer') || cat.includes('mobile')) catIconEl.textContent = '📱';
      else catIconEl.textContent = '📦';
    }

    const tagBadge = document.getElementById('assetDetailTagBadge');
    if (tagBadge) tagBadge.textContent = asset.tag_id;

    const sourcePill = document.getElementById('assetDetailSourcePill');
    if (sourcePill) {
      sourcePill.textContent = asset.source || 'Demo';
      const sourceClass = getSourceClass(asset.source);
      sourcePill.className = `asset-source-pill ${sourceClass}`;
    }

    const statusPill = document.getElementById('assetDetailStatusPill');
    const isAvailable = asset.status === 'Available';
    const isDisposed = asset.status === 'Disposed';
    const wf = getAssetWorkflowStatus(asset);
    if (statusPill) {
      if (isAvailable) {
        statusPill.className = 'asset-status-pill avail';
        statusPill.innerHTML = '<span class="status-indicator-dot avail"></span>ว่าง';
      } else if (isDisposed) {
        statusPill.className = 'asset-status-pill disposed';
        statusPill.innerHTML = '<span class="status-indicator-dot gray"></span>จำหน่ายแล้ว';
      } else {
        statusPill.className = `asset-status-pill ${wf.pillCls}`;
        statusPill.innerHTML = `<span class="status-indicator-dot ${wf.indicatorCls}"></span>${escapeHtml(wf.text)}`;
      }
    }

    // Header Action Buttons
    const btnDispose = document.getElementById('btnOpenDisposeModal');
    const btnReactivate = document.getElementById('btnOpenReactivateModal');
    if (btnDispose && btnReactivate) {
      if (isDisposed) {
        btnDispose.classList.add('hidden');
        btnReactivate.classList.remove('hidden');
      } else if (isAvailable) {
        btnDispose.classList.remove('hidden');
        btnReactivate.classList.add('hidden');
      } else {
        btnDispose.classList.add('hidden');
        btnReactivate.classList.add('hidden');
      }
    }

    const btnDelete = document.getElementById('btnDeleteAssetDirect');
    if (btnDelete) {
      btnDelete.classList.toggle('hidden', asset.status === 'On_Loan');
    }

    const titleEl = document.getElementById('assetDetailModalTitle');
    if (titleEl) {
      titleEl.textContent = asset.brand ? `${asset.brand} ${asset.model}` : asset.model;
    }

    const snValEl = document.getElementById('assetDetailSnVal');
    if (snValEl) snValEl.textContent = asset.serial_no || '-';

    const catValEl = document.getElementById('assetDetailCatVal');
    if (catValEl) catValEl.textContent = asset.category || 'Mobile Computer';

    // Disposed Callout
    const disposedBox = document.getElementById('assetDetailDisposedCallout');
    if (disposedBox) {
      if (isDisposed) {
        disposedBox.classList.remove('hidden');
        const dDate = document.getElementById('assetDetailDisposedDate');
        if (dDate) dDate.textContent = formatShortDate(asset.disposed_at) || asset.disposed_at || '-';
        const dReason = document.getElementById('assetDetailDisposedReason');
        if (dReason) dReason.textContent = asset.disposed_reason || 'จำหน่ายออก';
        const dNote = document.getElementById('assetDetailDisposedNote');
        if (dNote) dNote.textContent = asset.disposed_note || '-';
        const dBy = document.getElementById('assetDetailDisposedBy');
        if (dBy) dBy.textContent = asset.disposed_by || '-';
      } else {
        disposedBox.classList.add('hidden');
      }
    }

    // Loan Callout
    const loanBox = document.getElementById('assetDetailLoanCallout');
    if (loanBox) {
      if (!isAvailable && !isDisposed && asset.active_loan) {
        loanBox.classList.remove('hidden');
        const loanBadgeEl = document.getElementById('assetDetailLoanBadge');
        if (loanBadgeEl) {
          loanBadgeEl.textContent = wf.calloutBadge;
        }
        const activeLoanId = asset.active_loan.id || asset.current_loan_id || 'ใบยืม';
        const loanIdBtn = document.getElementById('assetDetailLoanId');
        if (loanIdBtn) {
          loanIdBtn.setAttribute('data-open-loan', activeLoanId);
          loanIdBtn.title = `คลิกเพื่อเปิดดูใบยืมจริง ${activeLoanId}`;
          const idTxt = loanIdBtn.querySelector('.doc-link-id-text');
          if (idTxt) idTxt.textContent = activeLoanId;
          else loanIdBtn.textContent = activeLoanId;
        }
        document.getElementById('assetDetailBorrower').textContent = asset.active_loan.borrower_name || '-';
        document.getElementById('assetDetailCustomer').textContent = asset.active_loan.customer_company || asset.active_loan.customer_name || '-';
        document.getElementById('assetDetailDueDate').textContent = asset.active_loan.due_date || '-';
      } else {
        loanBox.classList.add('hidden');
      }
    }

    // Reset all inline edits to Read-Only View Mode
    resetAllDetailInlineEdits();

    // Render Read-Only Views
    renderDetailPhotosReadOnly(asset);
    renderDetailSourceReadOnly(asset);
    renderDetailLocationReadOnly(asset);
    renderDetailAccessoriesReadOnly(asset);
    renderDetailNoteReadOnly(asset);

    // Populate Edit Mode inputs with current values
    const editTagInp = document.getElementById('editAssetTagId');
    if (editTagInp) editTagInp.value = asset.tag_id;

    state.editAssetImages = Array.isArray(asset.images) && asset.images.length > 0
      ? [...asset.images]
      : (asset.image_url ? [asset.image_url] : []);
    renderEditAssetPhotosGallery();

    const editSrcInp = document.getElementById('editAssetSourceInput');
    if (editSrcInp) editSrcInp.value = asset.source || 'Demo';

    const editLocInp = document.getElementById('editAssetLocationInput');
    if (editLocInp) {
      editLocInp.value = asset.location || '';
      syncClearableInputBtn(editLocInp);
    }

    state.editAssetAccessories = [...(asset.accessories || [])];
    renderEditAssetAccChips();

    const editNoteInp = document.getElementById('editAssetNoteInput');
    if (editNoteInp) editNoteInp.value = asset.free_note || '';

    dialog.showModal();
  }

  // Expose to window for external triggers
  window.openAssetDetailModal = openAssetDetailModal;
  window.renderLibraryCardPage = renderLibraryCardPage;
  window.switchAssetDetailTab = switchAssetDetailTab;
  window.state = state;

  // --------------------------------------------------------------------------
  // ASSET DISPOSITION (จำหน่ายออก & นำกลับเข้าคลัง)
  // --------------------------------------------------------------------------
  const DISPOSE_REASONS = [
    { value: 'ขายสินค้าให้ลูกค้า (Sales Stock)', title: 'ขายสินค้าให้ลูกค้า (Sales Stock)', desc: 'จำหน่ายเครื่องจากคลังขายส่งมอบให้ลูกค้าสำเร็จ', icon: '🏷️', badge: 'ขาย' },
    { value: 'ส่งคืน Supplier / คืนเจ้าของเครื่อง', title: 'ส่งคืน Supplier / คืนเจ้าของเครื่อง', desc: 'ส่งคืนตัวเดโมให้ซัพพลายเออร์หรือบริษัทเจ้าของสินค้า', icon: '🔄', badge: 'ส่งคืน' },
    { value: 'ตัดจำหน่ายชำรุด / เสื่อมสภาพ', title: 'ตัดจำหน่ายชำรุด / เสื่อมสภาพ', desc: 'เครื่องชำรุดเสียหายหนัก ไม่คุ้มค่าการซ่อม หรือหมดอายุการใช้งาน', icon: '⚠️', badge: 'ชำรุด' },
    { value: 'โอนย้ายไปสาขาอื่น', title: 'โอนย้ายไปสาขาอื่น', desc: 'ตัดโอนย้ายสินทรัพย์ไปยังสาขาหรือสำนักงานอื่น', icon: '🚚', badge: 'โอนย้าย' },
    { value: 'สูญหาย / ตรวจนับไม่พบ', title: 'สูญหาย / ตรวจนับไม่พบ', desc: 'ตรวจสอบสต็อกแล้วไม่พบเครื่อง หรือสูญหายระหว่างใช้งาน', icon: '🔍', badge: 'สูญหาย' },
    { value: 'หมดความจำเป็นในการใช้งาน (Obsolete)', title: 'หมดความจำเป็นในการใช้งาน (Obsolete)', desc: 'ตกรุ่น หรือไม่มีความต้องการนำไปเดโมต่อในอนาคต', icon: '📦', badge: 'ตกรุ่น' },
    { value: 'อื่นๆ', title: 'อื่นๆ (ระบุเอง)', desc: 'ระบุเหตุผลอื่นๆ ตามความเหมาะสม', icon: '✏️', badge: 'กำหนดเอง' }
  ];

  function renderDisposeReasonDropdown(query = '') {
    const dropdown = document.getElementById('disposeReasonDropdown');
    const targetInput = document.getElementById('disposeReason');
    if (!dropdown || !targetInput) return;

    const q = (query || '').trim().toLowerCase();
    const filtered = q
      ? DISPOSE_REASONS.filter(r => r.title.toLowerCase().includes(q) || r.desc.toLowerCase().includes(q) || r.value.toLowerCase().includes(q))
      : DISPOSE_REASONS;

    const headerHtml = `
      <div class="model-dropdown-header">
        <span>เลือกสาเหตุการจำหน่าย (${filtered.length})</span>
        <button type="button" class="btn-close-dropdown" id="btnCloseDisposeReasonDd" title="ปิด">✕</button>
      </div>
    `;

    let itemsHtml = '';
    if (filtered.length === 0 && q) {
      itemsHtml = `
        <div class="model-dropdown-item custom-add" data-select-dispose-reason="${escapeHtml(q)}">
          <div class="model-item-main">
            <span class="model-item-name">➕ ใช้สาเหตุใหม่: "${escapeHtml(q)}"</span>
            <span class="model-item-sub">บันทึกเป็นสาเหตุการจำหน่าย</span>
          </div>
        </div>
      `;
    } else {
      itemsHtml = filtered.map(r => `
        <div class="model-dropdown-item" data-select-dispose-reason="${escapeHtml(r.value)}">
          <div class="model-item-main">
            <span class="model-item-name">${r.icon} ${escapeHtml(r.title)}</span>
            <span class="model-item-sub">${escapeHtml(r.desc)}</span>
          </div>
          <span class="model-count-box count-full"><span class="count-num">${escapeHtml(r.badge)}</span></span>
        </div>
      `).join('');

      if (q && !DISPOSE_REASONS.some(r => r.value.toLowerCase() === q)) {
        itemsHtml += `
          <div class="model-dropdown-item custom-add" data-select-dispose-reason="${escapeHtml(q)}">
            <div class="model-item-main">
              <span class="model-item-name">➕ ใช้สาเหตุใหม่: "${escapeHtml(q)}"</span>
              <span class="model-item-sub">บันทึกเป็นสาเหตุการจำหน่าย</span>
            </div>
          </div>
        `;
      }
    }

    dropdown.innerHTML = `
      ${headerHtml}
      <div class="dropdown-scroll-arrow top-arrow hidden" title="เลื่อนขึ้น">▲</div>
      <div class="dropdown-scroll-list">
        ${itemsHtml}
      </div>
      <div class="dropdown-scroll-arrow bottom-arrow" title="เลื่อนลง">▼</div>
    `;
    setupDropdownScrollArrows(dropdown);
    positionAddDemoDropdown(dropdown, targetInput);
    dropdown.classList.remove('hidden');
  }

  function renderReactivateLocationDropdown(query = '') {
    const dropdown = document.getElementById('reactivateLocationDropdown');
    const targetInput = document.getElementById('reactivateLocation');
    if (!dropdown || !targetInput) return;

    const q = (query || '').trim().toLowerCase();
    const locsSet = new Set(state.locations || []);
    (state.assets || []).forEach(a => a.location && locsSet.add(a.location.trim()));
    if (locsSet.size === 0) {
      locsSet.add('Main Stock (ตู้โชว์/คลังกลาง)');
    }
    const allLocs = Array.from(locsSet).filter(Boolean);
    const filtered = q ? allLocs.filter(l => l.toLowerCase().includes(q)) : allLocs;

    const headerHtml = `
      <div class="model-dropdown-header">
        <span>เลือกสถานที่จัดเก็บ (${filtered.length})</span>
        <button type="button" class="btn-close-dropdown" id="btnCloseReactivateLocDd" title="ปิด">✕</button>
      </div>
    `;

    let itemsHtml = '';
    if (filtered.length === 0 && q) {
      itemsHtml = `
        <div class="model-dropdown-item custom-add" data-select-reactivate-loc="${escapeHtml(q)}">
          <div class="model-item-main">
            <span class="model-item-name">➕ ใช้ที่เก็บใหม่: "${escapeHtml(q)}"</span>
            <span class="model-item-sub">บันทึกเป็นสถานที่จัดเก็บ</span>
          </div>
        </div>
      `;
    } else {
      itemsHtml = filtered.map(loc => `
        <div class="model-dropdown-item" data-select-reactivate-loc="${escapeHtml(loc)}">
          <div class="model-item-main">
            <span class="model-item-name">📍 ${escapeHtml(loc)}</span>
            <span class="model-item-sub">ตำแหน่งจัดเก็บในคลัง</span>
          </div>
        </div>
      `).join('');

      if (q && !allLocs.some(l => l.toLowerCase() === q)) {
        itemsHtml += `
          <div class="model-dropdown-item custom-add" data-select-reactivate-loc="${escapeHtml(q)}">
            <div class="model-item-main">
              <span class="model-item-name">➕ ใช้ที่เก็บใหม่: "${escapeHtml(q)}"</span>
              <span class="model-item-sub">บันทึกเป็นสถานที่จัดเก็บ</span>
            </div>
          </div>
        `;
      }
    }

    dropdown.innerHTML = `
      ${headerHtml}
      <div class="dropdown-scroll-arrow top-arrow hidden" title="เลื่อนขึ้น">▲</div>
      <div class="dropdown-scroll-list">
        ${itemsHtml}
      </div>
      <div class="dropdown-scroll-arrow bottom-arrow" title="เลื่อนลง">▼</div>
    `;
    setupDropdownScrollArrows(dropdown);
    positionAddDemoDropdown(dropdown, targetInput);
    dropdown.classList.remove('hidden');
  }

  function openDisposeAssetDialog(tagId) {
    const asset = state.assets.find(a => a.tag_id === tagId);
    if (!asset) return;
    if (asset.status === 'On_Loan') {
      showToast('⚠️ ไม่สามารถจำหน่ายได้เนื่องจากเครื่องกำลังถูกยืมอยู่ กรุณารับคืนก่อน');
      return;
    }

    const dialog = document.getElementById('disposeAssetModalDialog');
    if (!dialog) return;

    document.getElementById('disposeTargetTagId').value = asset.tag_id;
    document.getElementById('disposeBannerModel').textContent = `${asset.brand || ''} ${asset.model || ''}`.trim();
    document.getElementById('disposeBannerTag').textContent = asset.tag_id;
    document.getElementById('disposeBannerSn').textContent = asset.serial_no || '-';

    const srcEl = document.getElementById('disposeBannerSource');
    if (srcEl) {
      srcEl.textContent = asset.source || 'Demo';
      srcEl.className = `asset-source-badge ${getSourceClass(asset.source)}`;
    }

    document.getElementById('disposeActionDate').value = new Date().toISOString().split('T')[0];
    const reasonInp = document.getElementById('disposeReason');
    if (reasonInp) {
      reasonInp.value = asset.source === 'คลังขาย'
        ? 'ขายสินค้าให้ลูกค้า (Sales Stock)'
        : (asset.source === 'Supplier' ? 'ส่งคืน Supplier / คืนเจ้าของเครื่อง' : 'ตัดจำหน่ายชำรุด / เสื่อมสภาพ');
      syncClearableInputBtn(reasonInp);
    }
    const noteInp = document.getElementById('disposeNote');
    if (noteInp) {
      noteInp.value = '';
      syncClearableInputBtn(noteInp);
    }

    document.getElementById('disposeReasonDropdown')?.classList.add('hidden');
    dialog.showModal();
  }

  function openReactivateAssetDialog(tagId) {
    const asset = state.assets.find(a => a.tag_id === tagId);
    if (!asset) return;

    const dialog = document.getElementById('reactivateAssetModalDialog');
    if (!dialog) return;

    document.getElementById('reactivateTargetTagId').value = asset.tag_id;
    document.getElementById('reactivateBannerModel').textContent = `${asset.brand || ''} ${asset.model || ''}`.trim();
    document.getElementById('reactivateBannerTag').textContent = asset.tag_id;
    document.getElementById('reactivateBannerSn').textContent = asset.serial_no || '-';
    document.getElementById('reactivateBannerDisposedDate').textContent = formatShortDate(asset.disposed_at) || asset.disposed_at || '-';

    document.getElementById('reactivateActionDate').value = new Date().toISOString().split('T')[0];
    const locInp = document.getElementById('reactivateLocation');
    if (locInp) {
      locInp.value = asset.location || 'Main Stock (ตู้โชว์/คลังกลาง)';
      syncClearableInputBtn(locInp);
    }
    const noteInp = document.getElementById('reactivateNote');
    if (noteInp) {
      noteInp.value = '';
      syncClearableInputBtn(noteInp);
    }

    document.getElementById('reactivateLocationDropdown')?.classList.add('hidden');
    dialog.showModal();
  }

  window.openDisposeAssetDialog = openDisposeAssetDialog;
  window.openReactivateAssetDialog = openReactivateAssetDialog;
  window.renderDisposeReasonDropdown = renderDisposeReasonDropdown;
  window.renderReactivateLocationDropdown = renderReactivateLocationDropdown;

  // Dispose Reason Dropdown Events
  const disposeReasonInp = document.getElementById('disposeReason');
  if (disposeReasonInp) {
    disposeReasonInp.addEventListener('input', e => {
      renderDisposeReasonDropdown(e.target.value);
    });
    disposeReasonInp.addEventListener('focus', e => {
      renderDisposeReasonDropdown(e.target.value);
    });
  }

  // Reactivate Location Dropdown Events
  const reactivateLocInp = document.getElementById('reactivateLocation');
  if (reactivateLocInp) {
    reactivateLocInp.addEventListener('input', e => {
      renderReactivateLocationDropdown(e.target.value);
    });
    reactivateLocInp.addEventListener('focus', e => {
      renderReactivateLocationDropdown(e.target.value);
    });
  }

  // Arrow triggers for disposition dropdowns
  document.addEventListener('click', e => {
    const arrow = e.target.closest('[data-dropdown-trigger]');
    if (!arrow) return;
    const trigger = arrow.getAttribute('data-dropdown-trigger');

    if (trigger === 'disposeReason') {
      e.stopPropagation();
      const dd = document.getElementById('disposeReasonDropdown');
      if (dd && !dd.classList.contains('hidden')) {
        dd.classList.add('hidden');
      } else {
        renderDisposeReasonDropdown(document.getElementById('disposeReason')?.value || '');
      }
    } else if (trigger === 'reactivateLocation') {
      e.stopPropagation();
      const dd = document.getElementById('reactivateLocationDropdown');
      if (dd && !dd.classList.contains('hidden')) {
        dd.classList.add('hidden');
      } else {
        renderReactivateLocationDropdown(document.getElementById('reactivateLocation')?.value || '');
      }
    }
  });

  // Handle selection in Dispose Reason dropdown
  document.getElementById('disposeReasonDropdown')?.addEventListener('click', e => {
    if (e.target.closest('#btnCloseDisposeReasonDd')) {
      document.getElementById('disposeReasonDropdown')?.classList.add('hidden');
      return;
    }
    const item = e.target.closest('[data-select-dispose-reason]');
    if (item) {
      const val = item.getAttribute('data-select-dispose-reason');
      const inp = document.getElementById('disposeReason');
      if (inp) {
        inp.value = val;
        syncClearableInputBtn(inp);
        inp.focus();
      }
      document.getElementById('disposeReasonDropdown')?.classList.add('hidden');
    }
  });

  // Handle selection in Reactivate Location dropdown
  document.getElementById('reactivateLocationDropdown')?.addEventListener('click', e => {
    if (e.target.closest('#btnCloseReactivateLocDd')) {
      document.getElementById('reactivateLocationDropdown')?.classList.add('hidden');
      return;
    }
    const item = e.target.closest('[data-select-reactivate-loc]');
    if (item) {
      const val = item.getAttribute('data-select-reactivate-loc');
      const inp = document.getElementById('reactivateLocation');
      if (inp) {
        inp.value = val;
        syncClearableInputBtn(inp);
        inp.focus();
      }
      document.getElementById('reactivateLocationDropdown')?.classList.add('hidden');
    }
  });

  // Dismiss dropdowns on outside click
  document.addEventListener('click', e => {
    if (!e.target.closest('#disposeReasonDropdown') && !e.target.closest('#disposeReason') && !e.target.closest('[data-dropdown-trigger="disposeReason"]')) {
      document.getElementById('disposeReasonDropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('#reactivateLocationDropdown') && !e.target.closest('#reactivateLocation') && !e.target.closest('[data-dropdown-trigger="reactivateLocation"]')) {
      document.getElementById('reactivateLocationDropdown')?.classList.add('hidden');
    }
  });

  document.getElementById('btnOpenDisposeModal')?.addEventListener('click', () => {
    if (state.currentDetailTagId) {
      openDisposeAssetDialog(state.currentDetailTagId);
    }
  });

  document.getElementById('btnOpenReactivateModal')?.addEventListener('click', () => {
    if (state.currentDetailTagId) {
      openReactivateAssetDialog(state.currentDetailTagId);
    }
  });

  document.getElementById('btnReactivateFromCallout')?.addEventListener('click', () => {
    if (state.currentDetailTagId) {
      openReactivateAssetDialog(state.currentDetailTagId);
    }
  });

  document.getElementById('btnDeleteAssetDirect')?.addEventListener('click', async () => {
    const asset = state.currentDetailAsset;
    if (!asset) return;

    if (asset.status === 'On_Loan') {
      showToast('⚠️ ไม่สามารถลบเครื่องที่กำลังถูกยืมอยู่ได้');
      return;
    }

    const modelDisplay = asset.brand ? `${asset.brand} ${asset.model}` : asset.model;
    const confirmed = await showConfirmDialog({
      title: '🗑️ ยืนยันการลบเครื่องออกจากระบบ',
      message: `คุณต้องการลบเครื่อง "${modelDisplay}" (รหัส ${asset.tag_id}, S/N: ${asset.serial_no || '-'}) ออกจากฐานข้อมูลคลังสินค้าใช่หรือไม่?\n\nการกระทำนี้จะลบข้อมูลเครื่องถาวร ไม่สามารถย้อนกลับได้`,
      itemText: `${asset.tag_id}: ${modelDisplay}`,
      icon: '🗑️',
      confirmText: '🗑️ ยืนยันลบเครื่อง',
      cancelText: 'ยกเลิก',
      confirmBtnClass: 'btn-danger'
    });

    if (!confirmed) return;

    try {
      const res = await fetch(`/api/assets/${encodeURIComponent(asset.tag_id)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'ลบเครื่องไม่สำเร็จ');

      document.getElementById('assetDetailModalDialog')?.close();
      applyServerState(data.state || data);
      showToast(`🗑️ ลบเครื่อง ${asset.tag_id} เรียบร้อยแล้ว`);
      renderActiveView();
      renderHeaderCounters();
    } catch (err) {
      showToast('⚠️ ' + err.message);
    }
  });

  document.getElementById('btnCancelDisposeAsset')?.addEventListener('click', () => {
    document.getElementById('disposeAssetModalDialog')?.close();
  });

  document.getElementById('btnCancelReactivateAsset')?.addEventListener('click', () => {
    document.getElementById('reactivateAssetModalDialog')?.close();
  });

  document.getElementById('disposeAssetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tagId = document.getElementById('disposeTargetTagId').value;
    const actionDate = document.getElementById('disposeActionDate').value;
    const reason = document.getElementById('disposeReason').value;
    const note = document.getElementById('disposeNote').value;
    const currentUser = JSON.parse(localStorage.getItem('activeasset_current_user') || '{}');

    try {
      showToast('⏳ กำลังบันทึกจำหน่ายออก...');
      const res = await fetch(`/api/assets/${encodeURIComponent(tagId)}/dispose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_date: actionDate,
          reason,
          note,
          user_name: currentUser.name || 'Admin'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'บันทึกจำหน่ายไม่สำเร็จ');

      applyServerState(data.state || data);
      document.getElementById('disposeAssetModalDialog')?.close();
      showToast(`✅ บันทึกจำหน่ายเครื่อง ${tagId} ออกจากระบบเรียบร้อยแล้ว`);

      // Refresh Detail Modal if open
      const detailDialog = document.getElementById('assetDetailModalDialog');
      if (detailDialog && detailDialog.open) {
        openAssetDetailModal(tagId);
      }
      renderStockView();
    } catch (err) {
      showToast('❌ ' + err.message);
    }
  });

  document.getElementById('reactivateAssetForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const tagId = document.getElementById('reactivateTargetTagId').value;
    const actionDate = document.getElementById('reactivateActionDate').value;
    const location = document.getElementById('reactivateLocation').value;
    const note = document.getElementById('reactivateNote').value;
    const currentUser = JSON.parse(localStorage.getItem('activeasset_current_user') || '{}');

    try {
      showToast('⏳ กำลังนำเครื่องกลับเข้าคลัง...');
      const res = await fetch(`/api/assets/${encodeURIComponent(tagId)}/reactivate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action_date: actionDate,
          location,
          note,
          user_name: currentUser.name || 'Admin'
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'นำเครื่องกลับเข้าคลังไม่สำเร็จ');

      applyServerState(data.state || data);
      document.getElementById('reactivateAssetModalDialog')?.close();
      showToast(`✅ นำเครื่อง ${tagId} กลับเข้าคลังและเปิดใช้งานเรียบร้อยแล้ว`);

      // Refresh Detail Modal if open
      const detailDialog = document.getElementById('assetDetailModalDialog');
      if (detailDialog && detailDialog.open) {
        openAssetDetailModal(tagId);
      }
      renderStockView();
    } catch (err) {
      showToast('❌ ' + err.message);
    }
  });

  // Adding accessories in Asset Detail modal
  document.getElementById('editAssetAccWrap')?.addEventListener('keydown', e => {
    if (e.target.id === 'editAssetNewAccInput' && (e.key === 'Enter' || e.key === ',')) {
      e.preventDefault();
      const val = e.target.value.replace(/,/g, '').trim();
      if (!val) return;
      if (!state.editAssetAccessories.includes(val)) {
        state.editAssetAccessories.push(val);
        renderEditAssetAccChips();
        const nextInp = document.getElementById('editAssetNewAccInput');
        if (nextInp) {
          nextInp.focus();
          renderModalAccDropdown('edit', '');
        }
      }
    } else if (e.key === 'Escape') {
      closeModalAccDropdown('edit');
    }
  });

  // Focus & typing triggers dropdown (loan form format)
  document.getElementById('editAssetAccWrap')?.addEventListener('focusin', e => {
    if (e.target.id === 'editAssetNewAccInput') {
      renderModalAccDropdown('edit', e.target.value);
    }
  });

  document.getElementById('editAssetAccWrap')?.addEventListener('input', e => {
    if (e.target.id === 'editAssetNewAccInput') {
      renderModalAccDropdown('edit', e.target.value);
    }
  });

  // Removing accessories or clicking arrow in Asset Detail modal
  document.getElementById('editAssetAccWrap')?.addEventListener('click', e => {
    const arrowBtn = e.target.closest('#btnToggleEditAssetAcc');
    if (arrowBtn) {
      e.preventDefault();
      e.stopPropagation();
      const dd = document.getElementById('assetDetailAccessoryDropdown');
      if (dd && !dd.classList.contains('hidden')) {
        closeModalAccDropdown('edit');
      } else {
        const inp = document.getElementById('editAssetNewAccInput');
        if (inp) inp.focus();
        renderModalAccDropdown('edit', inp ? inp.value : '');
      }
      return;
    }

    const rmBtn = e.target.closest('[data-rm-edit-asset-acc]');
    if (rmBtn) {
      const idx = Number(rmBtn.getAttribute('data-rm-edit-asset-acc'));
      state.editAssetAccessories.splice(idx, 1);
      renderEditAssetAccChips();
      closeModalAccDropdown('edit');
    }
  });

  // Dropdown item selection & close for Asset Detail modal
  document.getElementById('assetDetailAccessoryDropdown')?.addEventListener('click', e => {
    const closeBtn = e.target.closest('[data-close-modal-acc]');
    if (closeBtn) {
      closeModalAccDropdown('edit');
      return;
    }
    const item = e.target.closest('[data-modal-select-acc]');
    if (item) {
      e.preventDefault();
      e.stopPropagation();
      const val = item.getAttribute('data-modal-select-acc');
      if (val && !state.editAssetAccessories.includes(val)) {
        state.editAssetAccessories.push(val);
        renderEditAssetAccChips();
        const inp = document.getElementById('editAssetNewAccInput');
        if (inp) {
          inp.value = '';
          inp.focus();
          renderModalAccDropdown('edit', '');
        }
      }
    }
  });

  // Asset Detail Modal Multi-Photo Gallery Controller
  state.editAssetImages = [];

  function renderEditAssetPhotosGallery() {
    window.renderEditAssetPhotosGallery = renderEditAssetPhotosGallery;
    const gallery = document.getElementById('editAssetPhotosGallery');
    const watermark = document.getElementById('editAssetWatermark');
    const countHint = document.getElementById('editAssetPhotoCountHint');
    const imageBox = document.getElementById('editAssetImageBox');
    if (!gallery) return;

    if (!state.editAssetImages || state.editAssetImages.length === 0) {
      gallery.innerHTML = '';
      if (watermark) watermark.classList.remove('hidden');
      if (imageBox) imageBox.classList.remove('has-photos');
      if (countHint) countHint.textContent = '';
      const imgHidden = document.getElementById('editAssetImageUrl');
      if (imgHidden) imgHidden.value = '';
      return;
    }

    if (watermark) watermark.classList.add('hidden');
    if (imageBox) imageBox.classList.add('has-photos');
    if (countHint) {
      countHint.textContent = `${state.editAssetImages.length} รูป`;
    }
    const imgHidden = document.getElementById('editAssetImageUrl');
    if (imgHidden) imgHidden.value = state.editAssetImages[0] || '';

    gallery.innerHTML = state.editAssetImages.map((url, idx) => `
      <div class="demo-photo-thumb-card" title="รูปที่ ${idx + 1}${idx === 0 ? ' (รูปหลัก)' : ''}">
        <img src="${escapeHtml(url)}" alt="รูปที่ ${idx + 1}" />
        <button type="button" class="btn-remove-photo" data-remove-edit-photo="${idx}" title="ลบรูปภาพ">✕</button>
        ${idx === 0 ? '<span class="primary-photo-badge">หลัก</span>' : ''}
      </div>
    `).join('') + `
      <div class="demo-photo-thumb-card demo-photo-add-more" title="คลิกเพื่อเพิ่มรูปภาพอีก">
        <span class="add-more-icon">➕</span>
        <span class="add-more-text">เพิ่มรูป</span>
      </div>
    `;
  }

  async function handleUploadEditAssetPhotos(files) {
    if (!files || !files.length) return;
    showToast(`⏳ กำลังย่อขนาดและอัปโหลดรูปภาพ (${files.length} รูป)...`);
    let uploadedCount = 0;
    for (const file of files) {
      try {
        const url = await uploadImageFile(file);
        state.editAssetImages = state.editAssetImages || [];
        state.editAssetImages.push(url);
        uploadedCount++;
      } catch (err) {
        console.error('Upload edit photo error:', err);
      }
    }
    renderEditAssetPhotosGallery();
    if (uploadedCount > 0) {
      showToast(`📷 อัปโหลดรูปภาพสำเร็จ ${uploadedCount} รูป (กดบันทึกการแก้ไขเพื่อยืนยัน)`);
    } else {
      showToast('⚠️ อัปโหลดรูปภาพไม่สำเร็จ');
    }
  }

  // Click entire dropzone box to trigger photo upload in Asset Detail modal
  const editImageBoxEl = document.getElementById('editAssetImageBox');
  if (editImageBoxEl) {
    editImageBoxEl.addEventListener('click', e => {
      if (e.target.closest('.btn-remove-photo')) return;
      if (e.target === document.getElementById('editAssetPhotoInput')) return;
      document.getElementById('editAssetPhotoInput')?.click();
    });

    editImageBoxEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        document.getElementById('editAssetPhotoInput')?.click();
      }
    });

    ['dragenter', 'dragover'].forEach(name => {
      editImageBoxEl.addEventListener(name, e => {
        e.preventDefault();
        e.stopPropagation();
        editImageBoxEl.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      editImageBoxEl.addEventListener(name, e => {
        e.preventDefault();
        e.stopPropagation();
        editImageBoxEl.classList.remove('drag-over');
      });
    });
    editImageBoxEl.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      const files = Array.from(dt?.files || []).filter(f => f.type && f.type.startsWith('image/'));
      if (files.length) {
        handleUploadEditAssetPhotos(files);
      }
    });
  }

  document.getElementById('editAssetPhotoInput')?.addEventListener('change', async e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await handleUploadEditAssetPhotos(files);
    e.target.value = '';
  });

  // Remove photo from edit asset gallery
  document.getElementById('editAssetPhotosGallery')?.addEventListener('click', e => {
    const rmBtn = e.target.closest('[data-remove-edit-photo]');
    if (!rmBtn) return;
    e.stopPropagation();
    const idx = Number(rmBtn.getAttribute('data-remove-edit-photo'));
    if (idx >= 0 && state.editAssetImages && idx < state.editAssetImages.length) {
      state.editAssetImages.splice(idx, 1);
      renderEditAssetPhotosGallery();
      showToast('ลบรูปภาพแล้ว (กดบันทึกการแก้ไขเพื่อยืนยัน)');
    }
  });

  // --------------------------------------------------------------------------
  // INLINE EDIT CONTROLLERS FOR ASSET DETAIL MODAL
  // --------------------------------------------------------------------------
  // Read-only photo preview click (supports multi-image gallery slider)
  document.getElementById('detailPhotosReadOnlyGallery')?.addEventListener('click', e => {
    const thumb = e.target.closest('[data-preview-img]');
    if (thumb) {
      const url = thumb.getAttribute('data-preview-img');
      const asset = state.currentDetailAsset;
      const images = Array.isArray(asset?.images) && asset.images.length > 0
        ? asset.images
        : (asset?.image_url ? [asset.image_url] : (url ? [url] : []));
      const idx = images.indexOf(url);
      const items = images.map((u, i) => ({
        url: u,
        name: `${asset?.brand || ''} ${asset?.model || 'สินทรัพย์'} (${i + 1}/${images.length})`,
        type: 'image/jpeg'
      }));
      if (items.length > 0) {
        openFilePreview(items, Math.max(0, idx));
      }
    }
  });

  // Section 1: Photos Inline Edit
  document.getElementById('btnEditPhotos')?.addEventListener('click', () => {
    document.getElementById('detailPhotosViewMode')?.classList.add('hidden');
    document.getElementById('detailPhotosEditMode')?.classList.remove('hidden');
    document.getElementById('detailSectionPhotos')?.classList.add('is-editing');
    const asset = state.currentDetailAsset;
    if (asset) {
      state.editAssetImages = Array.isArray(asset.images) && asset.images.length > 0
        ? [...asset.images]
        : (asset.image_url ? [asset.image_url] : []);
      renderEditAssetPhotosGallery();
    }
  });

  document.getElementById('btnCancelEditPhotos')?.addEventListener('click', () => {
    document.getElementById('detailPhotosEditMode')?.classList.add('hidden');
    document.getElementById('detailPhotosViewMode')?.classList.remove('hidden');
    document.getElementById('detailSectionPhotos')?.classList.remove('is-editing');
    const asset = state.currentDetailAsset;
    if (asset) {
      state.editAssetImages = Array.isArray(asset.images) && asset.images.length > 0
        ? [...asset.images]
        : (asset.image_url ? [asset.image_url] : []);
      renderDetailPhotosReadOnly(asset);
    }
  });

  document.getElementById('btnSaveEditPhotos')?.addEventListener('click', async () => {
    const tagId = state.currentDetailTagId;
    if (!tagId) return;
    const btn = document.getElementById('btnSaveEditPhotos');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳';
    }
    try {
      const images = state.editAssetImages || [];
      const imageUrl = images[0] || '';
      await patchStockAsset(tagId, { images, image_url: imageUrl });
      if (state.currentDetailAsset) {
        state.currentDetailAsset.images = [...images];
        state.currentDetailAsset.image_url = imageUrl;
        renderDetailPhotosReadOnly(state.currentDetailAsset);
      }
      document.getElementById('detailPhotosEditMode')?.classList.add('hidden');
      document.getElementById('detailPhotosViewMode')?.classList.remove('hidden');
      document.getElementById('detailSectionPhotos')?.classList.remove('is-editing');
      showToast('✅ บันทึกรูปภาพเรียบร้อย');
    } catch (err) {
      showToast('⚠️ ' + (err.message || 'บันทึกรูปภาพไม่สำเร็จ'));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✓';
      }
    }
  });

  // Section 2: Source Inline Edit (List only, no typing)
  document.getElementById('btnEditSource')?.addEventListener('click', () => {
    document.getElementById('detailSourceViewMode')?.classList.add('hidden');
    document.getElementById('detailSourceEditMode')?.classList.remove('hidden');
    document.getElementById('detailSectionSource')?.classList.add('is-editing');
    renderEditAssetSourceList();
  });

  document.getElementById('btnCancelEditSource')?.addEventListener('click', () => {
    document.getElementById('detailSourceEditMode')?.classList.add('hidden');
    document.getElementById('detailSourceViewMode')?.classList.remove('hidden');
    document.getElementById('detailSectionSource')?.classList.remove('is-editing');
  });

  document.getElementById('editAssetSourceList')?.addEventListener('click', async (e) => {
    const opt = e.target.closest('[data-source-option]');
    if (!opt) return;
    const newSource = opt.getAttribute('data-source-option');
    const tagId = state.currentDetailTagId;
    if (!tagId || !newSource) return;

    // Visual selection feedback
    document.querySelectorAll('#editAssetSourceList .source-select-option').forEach(el => {
      el.classList.remove('is-selected');
      const chk = el.querySelector('.source-option-check');
      if (chk) chk.textContent = '';
    });
    opt.classList.add('is-selected');
    const checkEl = opt.querySelector('.source-option-check');
    if (checkEl) checkEl.textContent = '✓';

    try {
      await patchStockAsset(tagId, { source: newSource });
      if (state.currentDetailAsset) {
        state.currentDetailAsset.source = newSource;
        renderDetailSourceReadOnly(state.currentDetailAsset);
        const sourcePill = document.getElementById('assetDetailSourcePill');
        if (sourcePill) {
          sourcePill.textContent = newSource;
          const sourceClass = getSourceClass(newSource);
          sourcePill.className = `asset-source-pill ${sourceClass}`;
        }
      }
      document.getElementById('detailSourceEditMode')?.classList.add('hidden');
      document.getElementById('detailSourceViewMode')?.classList.remove('hidden');
      document.getElementById('detailSectionSource')?.classList.remove('is-editing');
      showToast(`✅ ย้ายเข้าคลัง "${newSource}" เรียบร้อย`);
    } catch (err) {
      showToast('⚠️ ' + (err.message || 'บันทึกไม่สำเร็จ'));
    }
  });

  // Section 2: Location Inline Edit
  document.getElementById('btnEditLocation')?.addEventListener('click', () => {
    document.getElementById('detailLocationViewMode')?.classList.add('hidden');
    document.getElementById('detailLocationEditMode')?.classList.remove('hidden');
    document.getElementById('detailSectionLocation')?.classList.add('is-editing');
    const inp = document.getElementById('editAssetLocationInput');
    if (inp && state.currentDetailAsset) {
      inp.value = state.currentDetailAsset.location || '';
      syncClearableInputBtn(inp);
      inp.focus();
    }
  });

  document.getElementById('btnCancelEditLocation')?.addEventListener('click', () => {
    document.getElementById('detailLocationEditMode')?.classList.add('hidden');
    document.getElementById('detailLocationViewMode')?.classList.remove('hidden');
    document.getElementById('detailSectionLocation')?.classList.remove('is-editing');
    document.getElementById('editAssetLocationDropdown')?.classList.add('hidden');
  });

  document.getElementById('btnSaveEditLocation')?.addEventListener('click', async () => {
    const tagId = state.currentDetailTagId;
    if (!tagId) return;
    const inp = document.getElementById('editAssetLocationInput');
    const val = inp?.value.trim() || '';
    const btn = document.getElementById('btnSaveEditLocation');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳';
    }
    try {
      await patchStockAsset(tagId, { location: val });
      if (state.currentDetailAsset) {
        state.currentDetailAsset.location = val;
        renderDetailLocationReadOnly(state.currentDetailAsset);
      }
      document.getElementById('detailLocationEditMode')?.classList.add('hidden');
      document.getElementById('detailLocationViewMode')?.classList.remove('hidden');
      document.getElementById('detailSectionLocation')?.classList.remove('is-editing');
      document.getElementById('editAssetLocationDropdown')?.classList.add('hidden');
      showToast('✅ อัปเดตที่เก็บประจำเรียบร้อย');
    } catch (err) {
      showToast('⚠️ ' + (err.message || 'บันทึกไม่สำเร็จ'));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✓';
      }
    }
  });

  document.getElementById('btnToggleEditLocationDd')?.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    const dd = document.getElementById('editAssetLocationDropdown');
    const isVisible = dd && !dd.classList.contains('hidden');
    if (isVisible) {
      dd.classList.add('hidden');
    } else {
      const inp = document.getElementById('editAssetLocationInput');
      inp?.focus();
      inp?.select?.();
      renderEditAssetLocationDropdown('', true);
    }
  });

  document.getElementById('editAssetLocationInput')?.addEventListener('click', () => {
    const inp = document.getElementById('editAssetLocationInput');
    inp?.select?.();
    renderEditAssetLocationDropdown('', true);
  });

  document.getElementById('editAssetLocationInput')?.addEventListener('focus', () => {
    const inp = document.getElementById('editAssetLocationInput');
    inp?.select?.();
    renderEditAssetLocationDropdown('', true);
  });

  document.getElementById('editAssetLocationInput')?.addEventListener('input', e => {
    renderEditAssetLocationDropdown(e.target.value, true);
    syncClearableInputBtn(e.target);
  });

  document.getElementById('editAssetLocationDropdown')?.addEventListener('click', e => {
    if (e.target.closest('#btnCloseEditAssetLocationDd')) {
      document.getElementById('editAssetLocationDropdown')?.classList.add('hidden');
      return;
    }
    const item = e.target.closest('[data-select-edit-location]');
    if (item) {
      const val = item.getAttribute('data-select-edit-location');
      const inp = document.getElementById('editAssetLocationInput');
      if (inp) {
        inp.value = val;
        syncClearableInputBtn(inp);
      }
      document.getElementById('editAssetLocationDropdown')?.classList.add('hidden');
    }
  });

  // Section 3: Accessories Inline Edit
  document.getElementById('btnEditAccessories')?.addEventListener('click', () => {
    document.getElementById('detailAccessoriesViewMode')?.classList.add('hidden');
    document.getElementById('detailAccessoriesEditMode')?.classList.remove('hidden');
    document.getElementById('detailSectionAccessories')?.classList.add('is-editing');
    const asset = state.currentDetailAsset;
    if (asset) {
      state.editAssetAccessories = [...(asset.accessories || [])];
      renderEditAssetAccChips();
    }
  });

  document.getElementById('btnCancelEditAccessories')?.addEventListener('click', () => {
    document.getElementById('detailAccessoriesEditMode')?.classList.add('hidden');
    document.getElementById('detailAccessoriesViewMode')?.classList.remove('hidden');
    document.getElementById('detailSectionAccessories')?.classList.remove('is-editing');
    closeModalAccDropdown('edit');
  });

  document.getElementById('btnSaveEditAccessories')?.addEventListener('click', async () => {
    const tagId = state.currentDetailTagId;
    if (!tagId) return;
    const btn = document.getElementById('btnSaveEditAccessories');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳';
    }
    try {
      const accList = state.editAssetAccessories || [];
      await patchStockAsset(tagId, { accessories: accList });
      if (state.currentDetailAsset) {
        state.currentDetailAsset.accessories = [...accList];
        renderDetailAccessoriesReadOnly(state.currentDetailAsset);
      }
      document.getElementById('detailAccessoriesEditMode')?.classList.add('hidden');
      document.getElementById('detailAccessoriesViewMode')?.classList.remove('hidden');
      document.getElementById('detailSectionAccessories')?.classList.remove('is-editing');
      closeModalAccDropdown('edit');
      showToast('✅ อัปเดตอุปกรณ์เสริมเรียบร้อย');
    } catch (err) {
      showToast('⚠️ ' + (err.message || 'บันทึกไม่สำเร็จ'));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✓';
      }
    }
  });

  // Section 4: Note Inline Edit
  document.getElementById('btnEditNote')?.addEventListener('click', () => {
    document.getElementById('detailNoteViewMode')?.classList.add('hidden');
    document.getElementById('detailNoteEditMode')?.classList.remove('hidden');
    document.getElementById('detailSectionNote')?.classList.add('is-editing');
    const inp = document.getElementById('editAssetNoteInput');
    if (inp && state.currentDetailAsset) {
      inp.value = state.currentDetailAsset.free_note || '';
      inp.focus();
    }
  });

  document.getElementById('btnCancelEditNote')?.addEventListener('click', () => {
    document.getElementById('detailNoteEditMode')?.classList.add('hidden');
    document.getElementById('detailNoteViewMode')?.classList.remove('hidden');
    document.getElementById('detailSectionNote')?.classList.remove('is-editing');
  });

  document.getElementById('btnSaveEditNote')?.addEventListener('click', async () => {
    const tagId = state.currentDetailTagId;
    if (!tagId) return;
    const inp = document.getElementById('editAssetNoteInput');
    const val = inp?.value.trim() || '';
    const btn = document.getElementById('btnSaveEditNote');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳';
    }
    try {
      await patchStockAsset(tagId, { free_note: val });
      if (state.currentDetailAsset) {
        state.currentDetailAsset.free_note = val;
        renderDetailNoteReadOnly(state.currentDetailAsset);
      }
      document.getElementById('detailNoteEditMode')?.classList.add('hidden');
      document.getElementById('detailNoteViewMode')?.classList.remove('hidden');
      document.getElementById('detailSectionNote')?.classList.remove('is-editing');
      showToast('✅ อัปเดตหมายเหตุเรียบร้อย');
    } catch (err) {
      showToast('⚠️ ' + (err.message || 'บันทึกไม่สำเร็จ'));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = '✓';
      }
    }
  });

  // Tab switching listeners in Asset Detail modal
  document.getElementById('btnTabAssetInfo')?.addEventListener('click', () => {
    switchAssetDetailTab('info');
  });
  document.getElementById('btnTabAssetHistory')?.addEventListener('click', () => {
    switchAssetDetailTab('history');
  });
  document.getElementById('btnTabAssetAuditLogs')?.addEventListener('click', () => {
    switchAssetDetailTab('logs');
  });
  document.getElementById('btnJumpToAssetHistory')?.addEventListener('click', () => {
    switchAssetDetailTab('history');
  });

  // Search filter in Asset Audit Logs
  document.getElementById('auditLogSearchInput')?.addEventListener('input', (e) => {
    const q = (e.target.value || '').trim().toLowerCase();
    if (!q) {
      renderAssetAuditLogs(state.currentAssetAuditLogs);
      return;
    }
    const filtered = state.currentAssetAuditLogs.filter(it => {
      const title = (it.action_title || '').toLowerCase();
      const details = (it.details || '').toLowerCase();
      const actor = (it.actor_name || '').toLowerCase();
      const date = (it.created_at || '').toLowerCase();
      const loan = (it.metadata?.loanId || '').toLowerCase();
      return title.includes(q) || details.includes(q) || actor.includes(q) || date.includes(q) || loan.includes(q);
    });
    renderAssetAuditLogs(filtered);
  });

  // Library Card Pagination listeners
  document.getElementById('btnLibPrevPage')?.addEventListener('click', () => {
    if (state.assetHistoryPage > 1) {
      state.assetHistoryPage--;
      renderLibraryCardPage();
    }
  });

  document.getElementById('btnLibNextPage')?.addEventListener('click', () => {
    const totalPages = Math.max(1, Math.ceil(state.currentAssetHistory.length / state.assetHistoryPageSize));
    if (state.assetHistoryPage < totalPages) {
      state.assetHistoryPage++;
      renderLibraryCardPage();
    }
  });

  document.getElementById('libPagePillsWrap')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-lib-page]');
    if (btn) {
      const p = Number(btn.getAttribute('data-lib-page'));
      if (p && p !== state.assetHistoryPage) {
        state.assetHistoryPage = p;
        renderLibraryCardPage();
      }
    }
  });

  document.getElementById('btnBackAssetDetailModal')?.addEventListener('click', (e) => {
    e.preventDefault();
    const dlg = document.getElementById('assetDetailModalDialog');
    if (dlg) smoothCloseDialog(dlg, e.currentTarget);
  });
  document.getElementById('btnCloseAssetDetailModal')?.addEventListener('click', (e) => {
    e.preventDefault();
    const dlg = document.getElementById('assetDetailModalDialog');
    if (dlg) smoothCloseDialog(dlg, e.currentTarget);
  });
  document.getElementById('btnCancelAssetDetail')?.addEventListener('click', (e) => {
    e.preventDefault();
    const dlg = document.getElementById('assetDetailModalDialog');
    if (dlg) smoothCloseDialog(dlg, e.currentTarget);
  });
  document.getElementById('assetDetailModalDialog')?.addEventListener('close', () => {
    closeModalAccDropdown('edit');
  });

  // When closing printDialog, if opened from asset detail modal, return smoothly back to previous tab
  document.getElementById('printDialog')?.addEventListener('close', () => {
    if (state.returnToAssetDetailTagId) {
      const tagId = state.returnToAssetDetailTagId;
      const tabTarget = state.returnToAssetDetailTab || 'info';
      state.returnToAssetDetailTagId = null;
      state.returnToAssetDetailTab = null;
      openAssetDetailModal(tagId);
      switchAssetDetailTab(tabTarget);
    }
  });

  // --------------------------------------------------------------------------
  // ADD DEMO MODAL CONTROLLER
  // --------------------------------------------------------------------------
  state.addDemoAccessories = [];

  function renderAddDemoAccChips() {
    const wrap = document.getElementById('addDemoAccTagsWrap');
    if (!wrap) return;
    const chipsHtml = (state.addDemoAccessories || []).map((acc, idx) => `
      <span class="asset-chip-tag">
        <span class="chip-text">${escapeHtml(acc)}</span>
        <button type="button" class="chip-remove-btn" data-rm-add-demo-acc="${idx}" title="ลบ">×</button>
      </span>
    `).join('');

    wrap.innerHTML = `
      ${chipsHtml}
      <div class="tag-input-with-arrow">
        <input type="text" id="addDemoNewAccInput" class="tag-add-inline" placeholder="+ พิมพ์อุปกรณ์แล้วกด Enter..." autocomplete="off" />
        <button type="button" class="btn-tag-dropdown-arrow" id="btnToggleAddDemoAcc" title="เลือกจากรายการ">▾</button>
      </div>
    `;
  }

  async function openAddDemoModal() {
    window.openAddDemoModal = openAddDemoModal;
    const dialog = document.getElementById('addDemoModalDialog');
    if (!dialog) return;

    // Reset alert and field errors
    clearAddDemoFieldErrors();

    // Auto-fetch next ACT tag ID from server
    try {
      const res = await fetch('/api/assets/next-tag');
      if (res.ok) {
        const data = await res.json();
        const tagInput = document.getElementById('addDemoTagId');
        if (tagInput) tagInput.value = data.nextTagId || '';
      }
    } catch (e) {
      // ignore
    }

    const srcEl = document.getElementById('addDemoSource');
    if (srcEl) {
      srcEl.value = '1. Demo';
      srcEl.setAttribute('data-source-val', 'Demo');
    }
    const brandEl = document.getElementById('addDemoBrand');
    if (brandEl) brandEl.value = '';
    const modelEl = document.getElementById('addDemoModel');
    if (modelEl) modelEl.value = '';
    const snEl = document.getElementById('addDemoSerialNo');
    if (snEl) snEl.value = '';
    const catEl = document.getElementById('addDemoCategory');
    if (catEl) catEl.value = 'Mobile Computer';
    const locEl = document.getElementById('addDemoLocation');
    if (locEl) locEl.value = 'Main Stock (ตู้โชว์/คลังกลาง)';
    const noteEl = document.getElementById('addDemoNote');
    if (noteEl) noteEl.value = '';

    // Multi-photo state for Add Demo
    state.addDemoImages = [];
    renderAddDemoPhotosGallery();

    // Pre-populate sensible default accessories
    state.addDemoAccessories = ['Power Adapter', 'Power Cord', 'USB Cable'];
    renderAddDemoAccChips();

    // Sync clear buttons for all inputs & textareas in Add Demo form
    document.querySelectorAll('#addDemoForm .input-clearable-wrap input, #addDemoForm .input-clearable-wrap textarea').forEach(syncClearableInputBtn);

    dialog.showModal();
    setTimeout(() => {
      document.getElementById('addDemoModel')?.focus();
    }, 120);
  }

  // --------------------------------------------------------------------------
  // ADD DEMO MULTI-PHOTO GALLERY & AUTO CLIENT-SIDE RESIZING
  // --------------------------------------------------------------------------
  function renderAddDemoPhotosGallery() {
    window.renderAddDemoPhotosGallery = renderAddDemoPhotosGallery;
    const gallery = document.getElementById('addDemoPhotosGallery');
    const watermark = document.getElementById('addDemoWatermark');
    const countHint = document.getElementById('addDemoPhotoCountHint');
    const imageBox = document.getElementById('addDemoImageBox');
    if (!gallery) return;

    if (!state.addDemoImages || state.addDemoImages.length === 0) {
      gallery.innerHTML = '';
      if (watermark) watermark.classList.remove('hidden');
      if (imageBox) imageBox.classList.remove('has-photos');
      if (countHint) countHint.textContent = '';
      return;
    }

    if (watermark) watermark.classList.add('hidden');
    if (imageBox) imageBox.classList.add('has-photos');
    if (countHint) {
      countHint.textContent = `${state.addDemoImages.length} รูป`;
    }

    gallery.innerHTML = state.addDemoImages.map((url, idx) => `
      <div class="demo-photo-thumb-card" title="รูปที่ ${idx + 1}${idx === 0 ? ' (รูปหลัก)' : ''}">
        <img src="${escapeHtml(url)}" alt="รูปที่ ${idx + 1}" />
        <button type="button" class="btn-remove-photo" data-remove-demo-photo="${idx}" title="ลบรูปภาพ">✕</button>
        ${idx === 0 ? '<span class="primary-photo-badge">หลัก</span>' : ''}
      </div>
    `).join('') + `
      <div class="demo-photo-thumb-card demo-photo-add-more" title="คลิกเพื่อเพิ่มรูปภาพอีก">
        <span class="add-more-icon">➕</span>
        <span class="add-more-text">เพิ่มรูป</span>
      </div>
    `;
  }

  // Handle upload files helper
  async function handleUploadDemoPhotos(files) {
    if (!files || !files.length) return;
    showToast(`⏳ กำลังย่อขนาดและอัปโหลดรูปภาพ (${files.length} รูป)...`);
    let uploadedCount = 0;
    for (const file of files) {
      try {
        const url = await uploadImageFile(file);
        state.addDemoImages = state.addDemoImages || [];
        state.addDemoImages.push(url);
        uploadedCount++;
      } catch (err) {
        console.error('Upload photo error:', err);
      }
    }
    renderAddDemoPhotosGallery();
    if (uploadedCount > 0) {
      showToast(`📷 อัปโหลดและย่อขนาดรูปภาพสำเร็จ ${uploadedCount} รูป`);
    } else {
      showToast('⚠️ อัปโหลดรูปภาพไม่สำเร็จ');
    }
  }

  // Click entire dropzone box to trigger photo upload
  const demoImageBoxEl = document.getElementById('addDemoImageBox');
  if (demoImageBoxEl) {
    demoImageBoxEl.addEventListener('click', e => {
      // Don't open file chooser if user clicked delete photo button
      if (e.target.closest('.btn-remove-photo')) {
        return;
      }
      // Avoid recursive click if event was on input itself
      if (e.target === document.getElementById('addDemoPhotoInput')) {
        return;
      }
      document.getElementById('addDemoPhotoInput')?.click();
    });

    demoImageBoxEl.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        document.getElementById('addDemoPhotoInput')?.click();
      }
    });

    // Drag and drop support
    ['dragenter', 'dragover'].forEach(name => {
      demoImageBoxEl.addEventListener(name, e => {
        e.preventDefault();
        e.stopPropagation();
        demoImageBoxEl.classList.add('drag-over');
      });
    });
    ['dragleave', 'drop'].forEach(name => {
      demoImageBoxEl.addEventListener(name, e => {
        e.preventDefault();
        e.stopPropagation();
        demoImageBoxEl.classList.remove('drag-over');
      });
    });
    demoImageBoxEl.addEventListener('drop', e => {
      const dt = e.dataTransfer;
      const files = Array.from(dt?.files || []).filter(f => f.type && f.type.startsWith('image/'));
      if (files.length) {
        handleUploadDemoPhotos(files);
      }
    });
  }

  // Multi-photo upload button & file change
  document.getElementById('btnUploadAddDemoPhoto')?.addEventListener('click', e => {
    e.stopPropagation();
    document.getElementById('addDemoPhotoInput')?.click();
  });

  document.getElementById('addDemoPhotoInput')?.addEventListener('change', async e => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    await handleUploadDemoPhotos(files);
    e.target.value = '';
  });

  // Remove photo from gallery
  document.getElementById('addDemoPhotosGallery')?.addEventListener('click', e => {
    const rmBtn = e.target.closest('[data-remove-demo-photo]');
    if (!rmBtn) return;
    e.stopPropagation();
    const idx = Number(rmBtn.getAttribute('data-remove-demo-photo'));
    if (idx >= 0 && state.addDemoImages && idx < state.addDemoImages.length) {
      state.addDemoImages.splice(idx, 1);
      renderAddDemoPhotosGallery();
    }
  });

  // --------------------------------------------------------------------------
  // ADD DEMO INTERACTIVE DROPDOWNS (MODEL, BRAND, LOCATION) MATCHING LOAN FORM
  // --------------------------------------------------------------------------
  function positionAddDemoDropdown(dropdown, targetInput) {
    if (!dropdown || !targetInput) return;
    const inputRect = targetInput.getBoundingClientRect();
    const isMobile = window.innerWidth <= 640;
    const dialog = dropdown.closest('dialog');

    if (dialog) {
      const dialogRect = dialog.getBoundingClientRect();
      const card = dialog.querySelector('.modal-card') || dialog;
      const cardRect = card.getBoundingClientRect();

      const dropdownWidth = isMobile
        ? Math.min(window.innerWidth - 24, Math.floor(cardRect.width - 24))
        : Math.min(Math.max(340, inputRect.width), Math.floor(cardRect.width - 24));

      dropdown.style.width = `${dropdownWidth}px`;

      if (isMobile) {
        const leftInCard = Math.max(10, Math.floor((cardRect.width - dropdownWidth) / 2));
        dropdown.style.left = `${(cardRect.left - dialogRect.left) + leftInCard}px`;
      } else {
        const relLeft = inputRect.left - dialogRect.left;
        const relRight = inputRect.right - dialogRect.left;
        const cardRelRight = cardRect.right - dialogRect.left;

        let targetLeft = relLeft;
        // If left-aligned dropdown would spill out past the card's right edge, right-align it to the input
        if (relLeft + dropdownWidth > cardRelRight - 12) {
          targetLeft = Math.max(cardRect.left - dialogRect.left + 12, relRight - dropdownWidth);
        }
        dropdown.style.left = `${targetLeft}px`;
      }

      const relTop = inputRect.bottom - dialogRect.top + 6;
      const spaceBelow = window.innerHeight - inputRect.bottom - 20;
      const spaceAbove = inputRect.top - 20;

      if (spaceBelow < 180 && spaceAbove > spaceBelow) {
        const maxHeight = Math.max(150, Math.min(320, Math.floor(spaceAbove)));
        dropdown.style.maxHeight = `${maxHeight}px`;
        dropdown.style.bottom = `${dialogRect.bottom - inputRect.top + 6}px`;
        dropdown.style.top = 'auto';
      } else {
        const maxHeight = Math.max(180, Math.min(320, Math.floor(spaceBelow)));
        dropdown.style.maxHeight = `${maxHeight}px`;
        dropdown.style.top = `${relTop}px`;
        dropdown.style.bottom = 'auto';
      }
    } else {
      const dropdownWidth = isMobile ? Math.min(window.innerWidth - 20, 420) : Math.max(340, inputRect.width);
      dropdown.style.width = `${dropdownWidth}px`;

      if (isMobile) {
        dropdown.style.left = `${Math.max(10, Math.floor((window.innerWidth - dropdownWidth) / 2))}px`;
      } else {
        dropdown.style.left = `${Math.max(10, Math.min(inputRect.left, window.innerWidth - dropdownWidth - 16))}px`;
      }

      const spaceBelow = window.innerHeight - inputRect.bottom - 20;
      const spaceAbove = inputRect.top - 20;

      if (spaceBelow < 180 && spaceAbove > spaceBelow) {
        const maxHeight = Math.max(160, Math.floor(spaceAbove));
        dropdown.style.maxHeight = `${maxHeight}px`;
        dropdown.style.bottom = `${window.innerHeight - inputRect.top + 6}px`;
        dropdown.style.top = 'auto';
      } else {
        const maxHeight = Math.max(180, Math.floor(spaceBelow));
        dropdown.style.maxHeight = `${maxHeight}px`;
        dropdown.style.top = `${inputRect.bottom + 6}px`;
        dropdown.style.bottom = 'auto';
      }
    }

    dropdown.classList.remove('hidden');
  }

  function closeAddDemoFieldDropdowns() {
    stopDropdownAutoScroll();
    ['addDemoSourceDropdown', 'addDemoModelDropdown', 'addDemoBrandDropdown', 'addDemoCategoryDropdown', 'addDemoLocationDropdown'].forEach(id => {
      document.getElementById(id)?.classList.add('hidden');
    });
  }

  // Source Dropdown
  function renderAddDemoSourceDropdown(query = '', forceOpen = false) {
    window.renderAddDemoSourceDropdown = renderAddDemoSourceDropdown;
    const dropdown = document.getElementById('addDemoSourceDropdown');
    const targetInput = document.getElementById('addDemoSource');
    if (!dropdown || !targetInput) return;

    const q = (query || '').trim().toLowerCase();
    if (!forceOpen && !q) {
      dropdown.classList.add('hidden');
      return;
    }

    const standardSources = [
      { value: 'Demo', display: '1. Demo', icon: '🏷️', sub: 'คลังเครื่องตัวอย่าง' },
      { value: 'Supplier', display: '2. Supplier', icon: '🏭', sub: 'เครื่องส่งคืน / ยืมจากผู้ผลิต' },
      { value: 'คลังขาย', display: '3. คลังขาย', icon: '💼', sub: 'คลังสินค้าสำหรับจำหน่าย' },
      { value: 'ทดแทนระหว่างซ่อม', display: '4. ทดแทนระหว่างซ่อม', icon: '🔧', sub: 'เครื่องสำรองระหว่างซ่อม' }
    ];

    const srcMap = new Map();
    standardSources.forEach(s => srcMap.set(s.value.toLowerCase(), s));

    (state.assets || []).forEach(a => {
      const s = (a.source || '').trim();
      if (s && !srcMap.has(s.toLowerCase())) {
        srcMap.set(s.toLowerCase(), {
          value: s,
          display: s,
          icon: '📦',
          sub: 'คลังสินค้า'
        });
      }
    });

    const allSources = Array.from(srcMap.values());
    const filtered = q
      ? allSources.filter(s => s.display.toLowerCase().includes(q) || s.value.toLowerCase().includes(q) || s.sub.toLowerCase().includes(q))
      : allSources;

    const headerHtml = `
      <div class="dropdown-header-bar">
        <span class="dropdown-header-title">📦 เลือกคลังจัดเก็บ (${filtered.length})</span>
        <button type="button" class="btn-close-dropdown" id="btnCloseAddDemoSourceDd" title="ปิด (✕)">✕</button>
      </div>
    `;

    let itemsHtml = '';
    for (const s of filtered) {
      const srcCount = (state.assets || []).filter(a => (a.source || '').trim().toLowerCase() === s.value.toLowerCase()).length;
      itemsHtml += `
        <div class="model-dropdown-item" data-select-demo-source-val="${escapeHtml(s.value)}" data-select-demo-source-name="${escapeHtml(s.display)}">
          <div class="model-item-main">
            <span class="model-item-name">${s.icon} ${escapeHtml(s.display)}</span>
            <span class="model-item-sub">${escapeHtml(s.sub)}</span>
          </div>
          <span class="model-count-box count-full"><span class="count-num">${srcCount} เครื่อง</span></span>
        </div>
      `;
    }

    dropdown.innerHTML = `
      ${headerHtml}
      <div class="dropdown-scroll-arrow top-arrow hidden" title="เลื่อนขึ้น">▲</div>
      <div class="dropdown-scroll-list">
        ${itemsHtml}
      </div>
      <div class="dropdown-scroll-arrow bottom-arrow" title="เลื่อนลง">▼</div>
    `;
    setupDropdownScrollArrows(dropdown);

    positionAddDemoDropdown(dropdown, targetInput);
  }

  // Model Dropdown
  function renderAddDemoModelDropdown(query = '', forceOpen = false) {
    window.renderAddDemoModelDropdown = renderAddDemoModelDropdown;
    const dropdown = document.getElementById('addDemoModelDropdown');
    const targetInput = document.getElementById('addDemoModel');
    if (!dropdown || !targetInput) return;

    const q = (query || '').trim().toLowerCase();
    const brandInpVal = (document.getElementById('addDemoBrand')?.value || '').trim();
    const brandLower = brandInpVal.toLowerCase();

    // If both brand and model query are empty, keep dropdown hidden unless forceOpen
    if (!forceOpen && !brandLower && !q) {
      dropdown.classList.add('hidden');
      return;
    }

    const catalogs = state.catalogs || [];

    // Filter catalogs by selected brand if brand is present
    let brandCatalogs = catalogs;
    if (brandLower) {
      const exactMatches = catalogs.filter(c => (c.brand || '').trim().toLowerCase() === brandLower);
      brandCatalogs = exactMatches.length > 0
        ? exactMatches
        : catalogs.filter(c => (c.brand || '').toLowerCase().includes(brandLower));
    }

    // Filter within brandCatalogs by the typed model query
    const filtered = q
      ? brandCatalogs.filter(c => `${c.brand} ${c.model} ${c.category || ''}`.toLowerCase().includes(q))
      : brandCatalogs;

    const titleSuffix = brandInpVal ? ` - ${escapeHtml(brandInpVal)}` : '';
    const headerHtml = `
      <div class="dropdown-header-bar">
        <span class="dropdown-header-title">🏷️ เลือกรุ่นสินค้า${titleSuffix} (${filtered.length})</span>
        <button type="button" class="btn-close-dropdown" id="btnCloseAddDemoModelDd" title="ปิด (✕)">✕</button>
      </div>
    `;

    let itemsHtml = '';
    if (q && !brandCatalogs.some(c => c.model.toLowerCase() === q)) {
      itemsHtml += `
        <div class="model-dropdown-item" data-select-demo-custom-model="${escapeHtml(query.trim())}" style="background:#f0fdf4;">
          <div class="model-item-main">
            <span class="model-item-name" style="color:#15803d;">➕ ใช้รุ่นใหม่: "${escapeHtml(query.trim())}"</span>
            <span class="model-item-sub">บันทึกเป็นชื่อรุ่นตามที่พิมพ์</span>
          </div>
          <span class="model-item-badge badge-avail">+ เลือก</span>
        </div>
      `;
    }

    if (filtered.length === 0 && !itemsHtml) {
      const notFoundMsg = brandInpVal
        ? `ไม่พบรุ่นสินค้าสำหรับแบรนด์ "${escapeHtml(brandInpVal)}"${q ? ` ที่ตรงกับ "${escapeHtml(query)}"` : ''}`
        : `ไม่พบรุ่นสินค้าที่ตรงกับ "${escapeHtml(query)}"`;
      dropdown.innerHTML = `
        ${headerHtml}
        <div class="model-dropdown-empty">${notFoundMsg}</div>
      `;
    } else {
      const byBrand = new Map();
      for (const c of filtered) {
        const b = c.brand || 'แบรนด์อื่นๆ';
        if (!byBrand.has(b)) byBrand.set(b, []);
        byBrand.get(b).push(c);
      }

      for (const [brandName, items] of byBrand.entries()) {
        itemsHtml += `<div class="model-dropdown-group-title">${escapeHtml(brandName)}</div>`;
        for (const it of items) {
          const demoAssets = (state.assets || []).filter(a => {
            const aSource = String(a.source || 'Demo').trim().toLowerCase();
            return aSource === 'demo' && isAssetMatchingModel(a, it.brand, it.model);
          });
          const totalCount = demoAssets.length;
          const availCount = demoAssets.filter(a => a.status === 'Available').length;

          let badgeHtml = '';
          if (totalCount === 0) {
            badgeHtml = `<span class="model-count-box count-zero" title="ยังไม่มีในคลัง Demo"><span class="count-num">0</span></span>`;
          } else {
            badgeHtml = `<span class="model-count-box count-full" title="มีในคลัง Demo ${totalCount} เครื่อง (ว่าง ${availCount})"><span class="count-num">${totalCount} เครื่อง</span></span>`;
          }

          const modelDisplay = it.model.toLowerCase().startsWith((it.brand || '').toLowerCase().trim())
            ? it.model
            : `${it.brand ? it.brand + ' ' : ''}${it.model}`;

          itemsHtml += `
            <div
              class="model-dropdown-item"
              data-select-demo-brand="${escapeHtml(it.brand)}"
              data-select-demo-model="${escapeHtml(it.model)}"
              data-select-demo-cat="${escapeHtml(it.category || 'Mobile Computer')}"
            >
              <div class="model-item-main">
                <span class="model-item-name">${escapeHtml(modelDisplay)}</span>
                <span class="model-item-sub">${escapeHtml(it.category || 'Mobile Computer')}</span>
              </div>
              ${badgeHtml}
            </div>
          `;
        }
      }

      dropdown.innerHTML = `
        ${headerHtml}
        <div class="dropdown-scroll-arrow top-arrow hidden" title="เลื่อนขึ้น">▲</div>
        <div class="dropdown-scroll-list">
          ${itemsHtml}
        </div>
        <div class="dropdown-scroll-arrow bottom-arrow" title="เลื่อนลง">▼</div>
      `;
      setupDropdownScrollArrows(dropdown);
    }

    positionAddDemoDropdown(dropdown, targetInput);
  }

  // Brand Dropdown
  function renderAddDemoBrandDropdown(query = '', forceOpen = false) {
    window.renderAddDemoBrandDropdown = renderAddDemoBrandDropdown;
    const dropdown = document.getElementById('addDemoBrandDropdown');
    const targetInput = document.getElementById('addDemoBrand');
    if (!dropdown || !targetInput) return;

    const q = (query || '').trim().toLowerCase();
    if (!forceOpen && !q) {
      dropdown.classList.add('hidden');
      return;
    }

    const brandsSet = new Set();
    (state.catalogs || []).forEach(c => c.brand && brandsSet.add(c.brand.trim()));
    (state.assets || []).forEach(a => a.brand && brandsSet.add(a.brand.trim()));
    ['Honeywell', 'Zebra', 'TSC', 'Point Mobile', 'Bixolon', 'Newland', 'Datalogic', 'Sunmi', 'Urovo'].forEach(b => brandsSet.add(b));

    const allBrands = Array.from(brandsSet).sort((a, b) => a.localeCompare(b));
    const filtered = q ? allBrands.filter(b => b.toLowerCase().includes(q)) : allBrands;

    const headerHtml = `
      <div class="dropdown-header-bar">
        <span class="dropdown-header-title">🏷️ เลือกยี่ห้อ (Brand) (${filtered.length})</span>
        <button type="button" class="btn-close-dropdown" id="btnCloseAddDemoBrandDd" title="ปิด (✕)">✕</button>
      </div>
    `;

    let itemsHtml = '';
    if (q && !allBrands.some(b => b.toLowerCase() === q)) {
      itemsHtml += `
        <div class="model-dropdown-item" data-select-demo-brand-val="${escapeHtml(query.trim())}" style="background:#f0fdf4;">
          <div class="model-item-main">
            <span class="model-item-name" style="color:#15803d;">➕ ใช้ยี่ห้อใหม่: "${escapeHtml(query.trim())}"</span>
            <span class="model-item-sub">บันทึกเป็นชื่อยี่ห้อตามที่พิมพ์</span>
          </div>
          <span class="model-item-badge badge-avail">+ เลือก</span>
        </div>
      `;
    }

    for (const b of filtered) {
      const brandAssetsCount = (state.assets || []).filter(a => (a.brand || '').trim().toLowerCase() === b.toLowerCase()).length;
      itemsHtml += `
        <div class="model-dropdown-item" data-select-demo-brand-val="${escapeHtml(b)}">
          <div class="model-item-main">
            <span class="model-item-name">${escapeHtml(b)}</span>
            <span class="model-item-sub">แบรนด์สินค้า</span>
          </div>
          <span class="model-count-box count-full"><span class="count-num">${brandAssetsCount} เครื่อง</span></span>
        </div>
      `;
    }

    dropdown.innerHTML = `
      ${headerHtml}
      <div class="dropdown-scroll-arrow top-arrow hidden" title="เลื่อนขึ้น">▲</div>
      <div class="dropdown-scroll-list">
        ${itemsHtml}
      </div>
      <div class="dropdown-scroll-arrow bottom-arrow" title="เลื่อนลง">▼</div>
    `;
    setupDropdownScrollArrows(dropdown);

    positionAddDemoDropdown(dropdown, targetInput);
  }

  // Location Dropdown
  function renderAddDemoLocationDropdown(query = '') {
    window.renderAddDemoLocationDropdown = renderAddDemoLocationDropdown;
    const dropdown = document.getElementById('addDemoLocationDropdown');
    const targetInput = document.getElementById('addDemoLocation');
    if (!dropdown || !targetInput) return;

    const q = (query || '').trim().toLowerCase();

    const locsSet = new Set(state.locations || []);
    (state.assets || []).forEach(a => a.location && locsSet.add(a.location.trim()));
    if (locsSet.size === 0) {
      locsSet.add('Main Stock (ตู้โชว์/คลังกลาง)');
    }
    const allLocs = Array.from(locsSet).filter(Boolean);
    const filtered = q ? allLocs.filter(l => l.toLowerCase().includes(q)) : allLocs;

    const headerHtml = `
      <div class="dropdown-header-bar">
        <span class="dropdown-header-title">📍 เลือกที่เก็บประจำ (${filtered.length})</span>
        <button type="button" class="btn-close-dropdown" id="btnCloseAddDemoLocDd" title="ปิด (✕)">✕</button>
      </div>
    `;

    let itemsHtml = '';
    if (q && !allLocs.some(l => l.toLowerCase() === q)) {
      itemsHtml += `
        <div class="model-dropdown-item" data-select-demo-loc-val="${escapeHtml(query.trim())}" style="background:#f0fdf4;">
          <div class="model-item-main">
            <span class="model-item-name" style="color:#15803d;">➕ ใช้ที่เก็บใหม่: "${escapeHtml(query.trim())}"</span>
            <span class="model-item-sub">บันทึกเป็นชื่อที่เก็บตามที่พิมพ์</span>
          </div>
          <span class="model-item-badge badge-avail">+ เลือก</span>
        </div>
      `;
    }

    for (const loc of filtered) {
      const locCount = (state.assets || []).filter(a => (a.location || '').trim().toLowerCase() === loc.toLowerCase()).length;
      itemsHtml += `
        <div class="model-dropdown-item" data-select-demo-loc-val="${escapeHtml(loc)}">
          <div class="model-item-main">
            <span class="model-item-name">${escapeHtml(loc)}</span>
            <span class="model-item-sub">ที่เก็บประจำ</span>
          </div>
          <span class="model-count-box count-full"><span class="count-num">${locCount} เครื่อง</span></span>
        </div>
      `;
    }

    dropdown.innerHTML = `
      ${headerHtml}
      <div class="dropdown-scroll-arrow top-arrow hidden" title="เลื่อนขึ้น">▲</div>
      <div class="dropdown-scroll-list">
        ${itemsHtml}
      </div>
      <div class="dropdown-scroll-arrow bottom-arrow" title="เลื่อนลง">▼</div>
    `;
    setupDropdownScrollArrows(dropdown);

    positionAddDemoDropdown(dropdown, targetInput);
  }

  // Category Dropdown
  function renderAddDemoCategoryDropdown(query = '') {
    window.renderAddDemoCategoryDropdown = renderAddDemoCategoryDropdown;
    const dropdown = document.getElementById('addDemoCategoryDropdown');
    const targetInput = document.getElementById('addDemoCategory');
    if (!dropdown || !targetInput) return;

    const q = (query || '').trim().toLowerCase();

    const defaultCategories = [
      { name: 'Mobile Computer', icon: '📱', desc: 'คอมพิวเตอร์พกพา / Handheld Terminal' },
      { name: 'Barcode Printer', icon: '🖨️', desc: 'เครื่องพิมพ์บาร์โค้ด / สติกเกอร์' },
      { name: 'Barcode Scanner', icon: '📷', desc: 'เครื่องสแกนบาร์โค้ด / 2D Imager' },
      { name: 'RFID Reader', icon: '📡', desc: 'เครื่องอ่าน RFID / Fixed & Mobile' },
      { name: 'Tablet', icon: '📟', desc: 'แท็บเล็ตอุตสาหกรรม (Rugged Tablet)' },
      { name: 'อื่นๆ', icon: '📦', desc: 'อุปกรณ์อื่นๆ / Other Accessories' }
    ];

    const catMap = new Map();
    defaultCategories.forEach(c => catMap.set(c.name.toLowerCase(), c));

    (state.catalogs || []).forEach(c => {
      if (c.category && !catMap.has(c.category.trim().toLowerCase())) {
        catMap.set(c.category.trim().toLowerCase(), {
          name: c.category.trim(),
          icon: '📦',
          desc: 'หมวดหมู่อุปกรณ์'
        });
      }
    });

    (state.assets || []).forEach(a => {
      if (a.category && !catMap.has(a.category.trim().toLowerCase())) {
        catMap.set(a.category.trim().toLowerCase(), {
          name: a.category.trim(),
          icon: '📦',
          desc: 'หมวดหมู่อุปกรณ์'
        });
      }
    });

    const allCategories = Array.from(catMap.values());
    const filtered = q
      ? allCategories.filter(c => c.name.toLowerCase().includes(q) || c.desc.toLowerCase().includes(q))
      : allCategories;

    const headerHtml = `
      <div class="dropdown-header-bar">
        <span class="dropdown-header-title">🗂️ เลือกหมวดหมู่สินค้า (${filtered.length})</span>
        <button type="button" class="btn-close-dropdown" id="btnCloseAddDemoCatDd" title="ปิด (✕)">✕</button>
      </div>
    `;

    let itemsHtml = '';
    if (q && !allCategories.some(c => c.name.toLowerCase() === q)) {
      itemsHtml += `
        <div class="model-dropdown-item" data-select-demo-cat-val="${escapeHtml(query.trim())}" style="background:#f0fdf4;">
          <div class="model-item-main">
            <span class="model-item-name" style="color:#15803d;">➕ ใช้หมวดหมู่ใหม่: "${escapeHtml(query.trim())}"</span>
            <span class="model-item-sub">บันทึกเป็นชื่อหมวดหมู่ตามที่พิมพ์</span>
          </div>
          <span class="model-item-badge badge-avail">+ เลือก</span>
        </div>
      `;
    }

    for (const cat of filtered) {
      const catCount = (state.assets || []).filter(a => (a.category || '').trim().toLowerCase() === cat.name.toLowerCase()).length;
      itemsHtml += `
        <div class="model-dropdown-item" data-select-demo-cat-val="${escapeHtml(cat.name)}">
          <div class="model-item-main">
            <span class="model-item-name">${cat.icon} ${escapeHtml(cat.name)}</span>
            <span class="model-item-sub">${escapeHtml(cat.desc)}</span>
          </div>
          <span class="model-count-box count-full"><span class="count-num">${catCount} เครื่อง</span></span>
        </div>
      `;
    }

    dropdown.innerHTML = `
      ${headerHtml}
      <div class="dropdown-scroll-arrow top-arrow hidden" title="เลื่อนขึ้น">▲</div>
      <div class="dropdown-scroll-list">
        ${itemsHtml}
      </div>
      <div class="dropdown-scroll-arrow bottom-arrow" title="เลื่อนลง">▼</div>
    `;
    setupDropdownScrollArrows(dropdown);

    positionAddDemoDropdown(dropdown, targetInput);
  }

  // Expose Add Demo helpers to window
  window.renderAddDemoPhotosGallery = renderAddDemoPhotosGallery;
  window.renderAddDemoSourceDropdown = renderAddDemoSourceDropdown;
  window.renderAddDemoModelDropdown = renderAddDemoModelDropdown;
  window.renderAddDemoBrandDropdown = renderAddDemoBrandDropdown;
  window.renderAddDemoCategoryDropdown = renderAddDemoCategoryDropdown;
  window.renderAddDemoLocationDropdown = renderAddDemoLocationDropdown;
  window.closeAddDemoFieldDropdowns = closeAddDemoFieldDropdowns;

  // Source selection handler
  document.getElementById('addDemoSourceDropdown')?.addEventListener('click', e => {
    if (e.target.closest('#btnCloseAddDemoSourceDd')) {
      document.getElementById('addDemoSourceDropdown')?.classList.add('hidden');
      return;
    }
    const item = e.target.closest('[data-select-demo-source-val]');
    if (item) {
      const val = item.getAttribute('data-select-demo-source-val');
      const name = item.getAttribute('data-select-demo-source-name') || val;
      const srcInp = document.getElementById('addDemoSource');
      if (srcInp) {
        srcInp.value = name;
        srcInp.setAttribute('data-source-val', val);
        syncClearableInputBtn(srcInp);
      }
      document.getElementById('addDemoSourceDropdown')?.classList.add('hidden');

      // Auto-focus on Brand field next
      const brandInp = document.getElementById('addDemoBrand');
      if (brandInp) {
        brandInp.focus();
        brandInp.select?.();
      }
    }
  });

  // Model selection handler
  document.getElementById('addDemoModelDropdown')?.addEventListener('click', e => {
    if (e.target.closest('#btnCloseAddDemoModelDd')) {
      document.getElementById('addDemoModelDropdown')?.classList.add('hidden');
      return;
    }
    const customItem = e.target.closest('[data-select-demo-custom-model]');
    if (customItem) {
      const val = customItem.getAttribute('data-select-demo-custom-model');
      const modelInp = document.getElementById('addDemoModel');
      if (modelInp) modelInp.value = val;
      document.getElementById('addDemoModelDropdown')?.classList.add('hidden');

      // Auto-focus on Serial Number
      const snInp = document.getElementById('addDemoSerialNo');
      if (snInp) {
        snInp.focus();
        snInp.select?.();
      }
      return;
    }
    const item = e.target.closest('[data-select-demo-model]');
    if (item) {
      const model = item.getAttribute('data-select-demo-model');
      const brand = item.getAttribute('data-select-demo-brand');
      const cat = item.getAttribute('data-select-demo-cat');
      const modelInp = document.getElementById('addDemoModel');
      if (modelInp) modelInp.value = model;
      const brandInp = document.getElementById('addDemoBrand');
      if (brandInp) brandInp.value = brand;
      const catInp = document.getElementById('addDemoCategory');
      if (catInp && cat) catInp.value = cat;
      [modelInp, brandInp, catInp].forEach(syncClearableInputBtn);

      const matched = matchCatalogModel(model);
      if (matched && matched.default_accessories && matched.default_accessories.length > 0) {
        if (!state.addDemoAccessories || state.addDemoAccessories.length === 0) {
          state.addDemoAccessories = [...matched.default_accessories];
          renderAddDemoAccChips();
        }
      }

      document.getElementById('addDemoModelDropdown')?.classList.add('hidden');

      // Auto-focus on Serial Number
      const snInp = document.getElementById('addDemoSerialNo');
      if (snInp) {
        snInp.focus();
        snInp.select?.();
      }
    }
  });

  // Brand selection handler
  document.getElementById('addDemoBrandDropdown')?.addEventListener('click', e => {
    if (e.target.closest('#btnCloseAddDemoBrandDd')) {
      document.getElementById('addDemoBrandDropdown')?.classList.add('hidden');
      return;
    }
    const item = e.target.closest('[data-select-demo-brand-val]');
    if (item) {
      const val = item.getAttribute('data-select-demo-brand-val');
      const brandInp = document.getElementById('addDemoBrand');
      if (brandInp) brandInp.value = val;
      syncClearableInputBtn(brandInp);
      document.getElementById('addDemoBrandDropdown')?.classList.add('hidden');

      // Auto-focus on Model input after selecting brand and open filtered model list
      const modelInp = document.getElementById('addDemoModel');
      if (modelInp) {
        modelInp.focus();
        modelInp.select?.();
        renderAddDemoModelDropdown(modelInp.value);
      }
    }
  });

  // Category selection handler
  document.getElementById('addDemoCategoryDropdown')?.addEventListener('click', e => {
    if (e.target.closest('#btnCloseAddDemoCatDd')) {
      document.getElementById('addDemoCategoryDropdown')?.classList.add('hidden');
      return;
    }
    const item = e.target.closest('[data-select-demo-cat-val]');
    if (item) {
      const val = item.getAttribute('data-select-demo-cat-val');
      const catInp = document.getElementById('addDemoCategory');
      if (catInp) catInp.value = val;
      syncClearableInputBtn(catInp);
      document.getElementById('addDemoCategoryDropdown')?.classList.add('hidden');

      // Move focus to Location field next
      const locInp = document.getElementById('addDemoLocation');
      if (locInp) {
        locInp.focus();
        locInp.select?.();
      }
    }
  });

  // Location selection handler
  document.getElementById('addDemoLocationDropdown')?.addEventListener('click', e => {
    if (e.target.closest('#btnCloseAddDemoLocDd')) {
      document.getElementById('addDemoLocationDropdown')?.classList.add('hidden');
      return;
    }
    const item = e.target.closest('[data-select-demo-loc-val]');
    if (item) {
      const val = item.getAttribute('data-select-demo-loc-val');
      const locInp = document.getElementById('addDemoLocation');
      if (locInp) locInp.value = val;
      syncClearableInputBtn(locInp);
      document.getElementById('addDemoLocationDropdown')?.classList.add('hidden');
    }
  });

  // Inputs in Add Demo: Source, Model, Brand, Category, Location focus, click & input listeners
  const addSourceEl = document.getElementById('addDemoSource');
  addSourceEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeAddDemoFieldDropdowns();
      const brandInp = document.getElementById('addDemoBrand');
      if (brandInp) {
        brandInp.focus();
        brandInp.select?.();
      }
    }
  });
  addSourceEl?.addEventListener('focus', () => {
    closeAddDemoFieldDropdowns();
    addSourceEl.select?.();
    renderAddDemoSourceDropdown('', true);
  });
  addSourceEl?.addEventListener('click', () => {
    closeAddDemoFieldDropdowns();
    renderAddDemoSourceDropdown('', true);
  });
  addSourceEl?.addEventListener('input', () => {
    renderAddDemoSourceDropdown(addSourceEl.value, true);
  });

  const addSerialEl = document.getElementById('addDemoSerialNo');
  addSerialEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeAddDemoFieldDropdowns();
      const catInp = document.getElementById('addDemoCategory');
      if (catInp) {
        catInp.focus();
        catInp.select?.();
        renderAddDemoCategoryDropdown(catInp.value);
      }
    }
  });

  const addModelEl = document.getElementById('addDemoModel');
  addModelEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeAddDemoFieldDropdowns();
      const snInp = document.getElementById('addDemoSerialNo');
      if (snInp) {
        snInp.focus();
        snInp.select?.();
      }
    }
  });
  addModelEl?.addEventListener('focus', () => {
    closeAddDemoFieldDropdowns();
    renderAddDemoModelDropdown(addModelEl.value);
  });
  addModelEl?.addEventListener('click', () => {
    closeAddDemoFieldDropdowns();
    renderAddDemoModelDropdown(addModelEl.value);
  });
  addModelEl?.addEventListener('input', () => {
    renderAddDemoModelDropdown(addModelEl.value);
  });

  const addBrandEl = document.getElementById('addDemoBrand');
  addBrandEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeAddDemoFieldDropdowns();
      const modelInp = document.getElementById('addDemoModel');
      if (modelInp) {
        modelInp.focus();
        modelInp.select?.();
        renderAddDemoModelDropdown(modelInp.value);
      }
    }
  });
  addBrandEl?.addEventListener('focus', () => {
    closeAddDemoFieldDropdowns();
    renderAddDemoBrandDropdown(addBrandEl.value);
  });
  addBrandEl?.addEventListener('click', () => {
    closeAddDemoFieldDropdowns();
    renderAddDemoBrandDropdown(addBrandEl.value);
  });
  addBrandEl?.addEventListener('input', () => {
    renderAddDemoBrandDropdown(addBrandEl.value);
  });

  const addCatEl = document.getElementById('addDemoCategory');
  addCatEl?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      closeAddDemoFieldDropdowns();
      const locInp = document.getElementById('addDemoLocation');
      if (locInp) {
        locInp.focus();
        locInp.select?.();
      }
    }
  });
  addCatEl?.addEventListener('focus', () => {
    closeAddDemoFieldDropdowns();
    renderAddDemoCategoryDropdown(addCatEl.value);
  });
  addCatEl?.addEventListener('click', () => {
    closeAddDemoFieldDropdowns();
    renderAddDemoCategoryDropdown(addCatEl.value);
  });
  addCatEl?.addEventListener('input', () => {
    renderAddDemoCategoryDropdown(addCatEl.value);
  });

  const addLocEl = document.getElementById('addDemoLocation');
  addLocEl?.addEventListener('focus', () => {
    closeAddDemoFieldDropdowns();
    addLocEl.select?.();
    renderAddDemoLocationDropdown('');
  });
  addLocEl?.addEventListener('click', () => {
    closeAddDemoFieldDropdowns();
    renderAddDemoLocationDropdown('');
  });
  addLocEl?.addEventListener('input', () => {
    renderAddDemoLocationDropdown(addLocEl.value);
  });

  // Global click outside to dismiss Add Demo dropdowns
  document.addEventListener('click', e => {
    if (!e.target.closest('#addDemoSource') && !e.target.closest('#addDemoSourceDropdown')) {
      document.getElementById('addDemoSourceDropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('#addDemoModel') && !e.target.closest('#addDemoModelDropdown')) {
      document.getElementById('addDemoModelDropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('#addDemoBrand') && !e.target.closest('#addDemoBrandDropdown')) {
      document.getElementById('addDemoBrandDropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('#addDemoCategory') && !e.target.closest('#addDemoCategoryDropdown')) {
      document.getElementById('addDemoCategoryDropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('#addDemoLocation') && !e.target.closest('#addDemoLocationDropdown')) {
      document.getElementById('addDemoLocationDropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('#editAssetSourceInput') && !e.target.closest('#btnToggleEditSourceDd') && !e.target.closest('#editAssetSourceDropdown')) {
      document.getElementById('editAssetSourceDropdown')?.classList.add('hidden');
    }
    if (!e.target.closest('#editAssetLocationInput') && !e.target.closest('#btnToggleEditLocationDd') && !e.target.closest('#editAssetLocationDropdown')) {
      document.getElementById('editAssetLocationDropdown')?.classList.add('hidden');
    }
  });

  // Adding accessories in Add Demo modal
  document.getElementById('addDemoAccTagsWrap')?.addEventListener('keydown', e => {
    if (e.target.id === 'addDemoNewAccInput' && (e.key === 'Enter' || e.key === ',')) {
      e.preventDefault();
      const val = e.target.value.replace(/,/g, '').trim();
      if (!val) return;
      if (!state.addDemoAccessories.includes(val)) {
        state.addDemoAccessories.push(val);
        renderAddDemoAccChips();
        const nextInp = document.getElementById('addDemoNewAccInput');
        if (nextInp) {
          nextInp.focus();
          renderModalAccDropdown('add', '');
        }
      }
    } else if (e.key === 'Escape') {
      closeModalAccDropdown('add');
    }
  });

  // Focus & typing triggers dropdown in Add Demo modal (loan form format)
  document.getElementById('addDemoAccTagsWrap')?.addEventListener('focusin', e => {
    if (e.target.id === 'addDemoNewAccInput') {
      renderModalAccDropdown('add', e.target.value);
    }
  });

  document.getElementById('addDemoAccTagsWrap')?.addEventListener('input', e => {
    if (e.target.id === 'addDemoNewAccInput') {
      renderModalAccDropdown('add', e.target.value);
    }
  });

  // Removing accessories or clicking arrow in Add Demo modal
  document.getElementById('addDemoAccTagsWrap')?.addEventListener('click', e => {
    const arrowBtn = e.target.closest('#btnToggleAddDemoAcc');
    if (arrowBtn) {
      e.preventDefault();
      e.stopPropagation();
      const dd = document.getElementById('addDemoAccessoryDropdown');
      if (dd && !dd.classList.contains('hidden')) {
        closeModalAccDropdown('add');
      } else {
        const inp = document.getElementById('addDemoNewAccInput');
        if (inp) inp.focus();
        renderModalAccDropdown('add', inp ? inp.value : '');
      }
      return;
    }

    const rmBtn = e.target.closest('[data-rm-add-demo-acc]');
    if (rmBtn) {
      const idx = Number(rmBtn.getAttribute('data-rm-add-demo-acc'));
      state.addDemoAccessories.splice(idx, 1);
      renderAddDemoAccChips();
      closeModalAccDropdown('add');
    }
  });

  // Dropdown item selection & close for Add Demo modal
  document.getElementById('addDemoAccessoryDropdown')?.addEventListener('click', e => {
    const closeBtn = e.target.closest('[data-close-modal-acc]');
    if (closeBtn) {
      closeModalAccDropdown('add');
      return;
    }
    const item = e.target.closest('[data-modal-select-acc]');
    if (item) {
      e.preventDefault();
      e.stopPropagation();
      const val = item.getAttribute('data-modal-select-acc');
      if (val && !state.addDemoAccessories.includes(val)) {
        state.addDemoAccessories.push(val);
        renderAddDemoAccChips();
        const inp = document.getElementById('addDemoNewAccInput');
        if (inp) {
          inp.value = '';
          inp.focus();
          renderModalAccDropdown('add', '');
        }
      }
    }
  });

  // Global click to close modal accessory dropdowns when clicking outside
  document.addEventListener('click', e => {
    if (
      !e.target.closest('#editAssetAccWrap') &&
      !e.target.closest('#assetDetailAccessoryDropdown')
    ) {
      closeModalAccDropdown('edit');
    }
    if (
      !e.target.closest('#addDemoAccTagsWrap') &&
      !e.target.closest('#addDemoAccessoryDropdown')
    ) {
      closeModalAccDropdown('add');
    }
  });

  // --------------------------------------------------------------------------
  // UNIVERSAL CLEARABLE INPUT (✕) BUTTONS
  // --------------------------------------------------------------------------
  function syncClearableInputBtn(inp) {
    if (!inp) return;
    const wrap = inp.closest('.input-clearable-wrap');
    if (!wrap) return;
    const btn = wrap.querySelector('.btn-input-clear');
    if (!btn) return;
    if (inp.value && String(inp.value).trim().length > 0) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  }

  // Update clear buttons on typing
  document.addEventListener('input', e => {
    if (e.target.matches('.input-clearable-wrap input, .input-clearable-wrap textarea')) {
      syncClearableInputBtn(e.target);
    }
    if (e.target.id === 'dispatchReturnReceiverName') {
      const subTag = document.getElementById('dispatchReceiverSubTag');
      if (subTag) {
        const defaultUser = (e.target.getAttribute('data-default-user') || '').trim();
        const val = e.target.value.trim();
        if (val && val !== defaultUser) {
          subTag.classList.remove('hidden');
        } else {
          subTag.classList.add('hidden');
        }
      }
    }
  });

  // Handle clicking the ✕ clear button
  document.addEventListener('click', e => {
    const btn = e.target.closest('.btn-input-clear');
    if (!btn) return;
    e.preventDefault();
    e.stopPropagation();
    const targetId = btn.getAttribute('data-clear-target');
    const inp = targetId ? document.getElementById(targetId) : btn.closest('.input-clearable-wrap')?.querySelector('input, textarea');
    if (inp) {
      inp.value = '';
      syncClearableInputBtn(inp);
      inp.focus();
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      closeAddDemoFieldDropdowns();
    }
  });

  // Handle clicking the ▾ dropdown arrow button
  document.addEventListener('click', e => {
    const arrowBtn = e.target.closest('.btn-input-dropdown-arrow');
    if (!arrowBtn) return;
    e.preventDefault();
    e.stopPropagation();
    const trigger = arrowBtn.getAttribute('data-dropdown-trigger');

    if (trigger === 'source') {
      const dd = document.getElementById('addDemoSourceDropdown');
      const isVisible = dd && !dd.classList.contains('hidden');
      closeAddDemoFieldDropdowns();
      if (!isVisible) {
        const inp = document.getElementById('addDemoSource');
        inp?.focus();
        inp?.select?.();
        renderAddDemoSourceDropdown(inp?.value || '', true);
      }
    } else if (trigger === 'brand') {
      const dd = document.getElementById('addDemoBrandDropdown');
      const isVisible = dd && !dd.classList.contains('hidden');
      closeAddDemoFieldDropdowns();
      if (!isVisible) {
        const inp = document.getElementById('addDemoBrand');
        inp?.focus();
        inp?.select?.();
        renderAddDemoBrandDropdown(inp?.value || '', true);
      }
    } else if (trigger === 'model') {
      const dd = document.getElementById('addDemoModelDropdown');
      const isVisible = dd && !dd.classList.contains('hidden');
      closeAddDemoFieldDropdowns();
      if (!isVisible) {
        const inp = document.getElementById('addDemoModel');
        inp?.focus();
        inp?.select?.();
        renderAddDemoModelDropdown(inp?.value || '', true);
      }
    } else if (trigger === 'category') {
      const dd = document.getElementById('addDemoCategoryDropdown');
      const isVisible = dd && !dd.classList.contains('hidden');
      closeAddDemoFieldDropdowns();
      if (!isVisible) {
        const inp = document.getElementById('addDemoCategory');
        inp?.focus();
        inp?.select?.();
        renderAddDemoCategoryDropdown(inp?.value || '');
      }
    } else if (trigger === 'location') {
      const dd = document.getElementById('addDemoLocationDropdown');
      const isVisible = dd && !dd.classList.contains('hidden');
      closeAddDemoFieldDropdowns();
      if (!isVisible) {
        const inp = document.getElementById('addDemoLocation');
        inp?.focus();
        inp?.select?.();
        renderAddDemoLocationDropdown('');
      }
    }
  });

  // Open modal button in stock toolbar
  document.getElementById('btnOpenAddDemoModal')?.addEventListener('click', openAddDemoModal);

  // Close / Cancel modal buttons
  document.getElementById('btnCloseAddDemoModal')?.addEventListener('click', (e) => {
    smoothCloseDialog(document.getElementById('addDemoModalDialog'), e.currentTarget);
  });
  document.getElementById('btnCancelAddDemo')?.addEventListener('click', (e) => {
    smoothCloseDialog(document.getElementById('addDemoModalDialog'), e.currentTarget);
  });
  document.getElementById('addDemoModalDialog')?.addEventListener('close', () => {
    closeModalAccDropdown('add');
  });

  // --------------------------------------------------------------------------
  // ADD DEMO FIELD-LEVEL ERROR HIGHLIGHTING & AUTO-FOCUS
  // --------------------------------------------------------------------------
  function clearAddDemoFieldErrors() {
    const alertEl = document.getElementById('addDemoAlert');
    if (alertEl) {
      alertEl.className = 'alert-banner hidden';
      alertEl.textContent = '';
    }
    document.querySelectorAll('#addDemoForm .is-invalid').forEach(el => el.classList.remove('is-invalid'));
    document.querySelectorAll('#addDemoForm .has-error').forEach(el => el.classList.remove('has-error'));
    document.querySelectorAll('#addDemoForm .field-error-text').forEach(el => el.remove());
  }

  function setAddDemoFieldError(fieldId, errorMsg) {
    clearAddDemoFieldErrors();
    const el = document.getElementById(fieldId);
    if (!el) {
      const alertEl = document.getElementById('addDemoAlert');
      if (alertEl) {
        alertEl.textContent = '⚠️ ' + errorMsg;
        alertEl.className = 'alert-banner';
        try { alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
      } else {
        showToast('⚠️ ' + errorMsg);
      }
      return;
    }

    el.classList.add('is-invalid');
    const wrap = el.closest('.input-clearable-wrap') || el.parentElement;
    if (wrap) wrap.classList.add('has-error');

    const formGroup = el.closest('.form-group') || wrap;
    formGroup.querySelectorAll('.field-error-text').forEach(t => t.remove());

    const errTextEl = document.createElement('div');
    errTextEl.className = 'field-error-text';
    errTextEl.innerHTML = `⚠️ ${escapeHtml(errorMsg)}`;
    formGroup.appendChild(errTextEl);

    // Scroll problematic field smoothly into view inside modal scroll container
    try {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } catch (e) {}

    // Focus cursor directly into the input
    setTimeout(() => {
      el.focus();
      el.select?.();
    }, 60);

    // Auto-remove error as soon as user types or changes value
    const cleanFn = () => {
      el.classList.remove('is-invalid');
      wrap?.classList.remove('has-error');
      errTextEl.remove();
      el.removeEventListener('input', cleanFn);
      el.removeEventListener('change', cleanFn);
    };
    el.addEventListener('input', cleanFn);
    el.addEventListener('change', cleanFn);
  }

  // Clear field errors as user types anywhere in form
  document.getElementById('addDemoForm')?.addEventListener('input', e => {
    const input = e.target;
    if (input && input.classList.contains('is-invalid')) {
      input.classList.remove('is-invalid');
      const wrap = input.closest('.input-clearable-wrap') || input.parentElement;
      wrap?.classList.remove('has-error');
      const formGroup = input.closest('.form-group') || wrap;
      formGroup?.querySelectorAll('.field-error-text').forEach(t => t.remove());
    }
  });

  // Save new Demo Asset
  document.getElementById('btnSaveAddDemo')?.addEventListener('click', async () => {
    clearAddDemoFieldErrors();

    const tagId = document.getElementById('addDemoTagId')?.value.trim();
    const rawSource = document.getElementById('addDemoSource')?.value.trim() || 'Demo';
    const source = document.getElementById('addDemoSource')?.getAttribute('data-source-val') ||
      rawSource.replace(/^[0-9]+\.\s*/, '').trim() || 'Demo';
    const brand = document.getElementById('addDemoBrand')?.value.trim() || '';
    const model = document.getElementById('addDemoModel')?.value.trim() || '';
    const serialNo = document.getElementById('addDemoSerialNo')?.value.trim() || '';
    const category = document.getElementById('addDemoCategory')?.value.trim() || 'Mobile Computer';
    const location = document.getElementById('addDemoLocation')?.value.trim() || 'Main Stock (ตู้โชว์/คลังกลาง)';
    const freeNote = document.getElementById('addDemoNote')?.value.trim() || '';
    const demoImages = state.addDemoImages || [];
    const imageUrl = demoImages[0] || '';

    // Precise field-level validations with auto-focus
    if (!source) {
      return setAddDemoFieldError('addDemoSource', 'กรุณาระบุคลังจัดเก็บ');
    }
    if (!model) {
      return setAddDemoFieldError('addDemoModel', 'กรุณาระบุรุ่นสินค้า (Model)');
    }
    if (!serialNo) {
      return setAddDemoFieldError('addDemoSerialNo', 'กรุณาระบุ Serial Number (S/N)');
    }

    const saveBtn = document.getElementById('btnSaveAddDemo');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = '⏳ กำลังบันทึก...';
    }

    try {
      const res = await fetch('/api/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tag_id: tagId,
          source,
          brand,
          model,
          serial_no: serialNo,
          category,
          location,
          free_note: freeNote,
          image_url: imageUrl,
          images: demoImages,
          accessories: state.addDemoAccessories || []
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = '✓ บันทึกเครื่อง Demo';
        }
        const err = data.error || 'บันทึกเครื่อง Demo ไม่สำเร็จ';
        if (/รุ่นสินค้า|Model/i.test(err)) {
          return setAddDemoFieldError('addDemoModel', err);
        } else if (/Serial Number|S\/N/i.test(err)) {
          return setAddDemoFieldError('addDemoSerialNo', err);
        } else if (/รหัสทรัพย์สิน|Tag/i.test(err)) {
          return setAddDemoFieldError('addDemoTagId', err);
        } else if (/คลัง/i.test(err)) {
          return setAddDemoFieldError('addDemoSource', err);
        } else {
          const alertEl = document.getElementById('addDemoAlert');
          if (alertEl) {
            alertEl.textContent = '⚠️ ' + err;
            alertEl.className = 'alert-banner';
            try { alertEl.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {}
          } else {
            showToast('⚠️ ' + err);
          }
          return;
        }
      }

      applyServerState(data.state || data);
      document.getElementById('addDemoModalDialog')?.close();
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '✓ บันทึกเครื่อง Demo';
      }
      showToast(`✅ เพิ่มเครื่อง Demo ${data.createdTagId || tagId} เรียบร้อยแล้ว`);

      // Switch to stock view if not active
      if (state.viewMode !== 'stock') {
        state.viewMode = 'stock';
        document.querySelectorAll('.view-btn').forEach(b => {
          b.classList.toggle('active', b.getAttribute('data-view') === 'stock');
        });
        updateUrlHash('stock');
        renderActiveView();
      }

      // Smooth scroll and highlight new card
      setTimeout(() => {
        const createdTag = data.createdTagId || tagId;
        const newCard = document.querySelector(`[data-asset-tag="${createdTag}"]`);
        if (newCard) {
          newCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
          newCard.classList.add('card-new-highlight');
          setTimeout(() => newCard.classList.remove('card-new-highlight'), 3000);
        }
      }, 250);
    } catch (err) {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '✓ บันทึกเครื่อง Demo';
      }
      showAlert(err.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์');
    }
  });

  // Print Modal
  document.getElementById('printSizeSelect')?.addEventListener('change', e => {
    state.printSize = e.target.value;
    renderGatePassHtml();
  });

  // Print Size Custom Dropdown Trigger
  document.getElementById('btnPrintSizeTrigger')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('printSizeDropdown');
    if (dropdown && !dropdown.classList.contains('hidden')) {
      closePrintSizeDropdown();
    } else {
      openPrintSizeDropdown();
    }
  });

  // Close print size dropdown on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#btnPrintSizeTrigger') && !e.target.closest('#printSizeDropdown')) {
      closePrintSizeDropdown();
    }
  });
  // Ensure document.title is set to loan number before printing so Chrome defaults "Save as PDF" filename to loan number
  window.addEventListener('beforeprint', () => {
    if (state.activePrintLoanId) {
      document.title = state.activePrintLoanId;
    }
  });

  window.addEventListener('afterprint', () => {
    if (!document.getElementById('printDialog')?.open) {
      document.title = 'activeASSET v2 - Minimal Asset Loan & QC Tracking';
    }
  });

  document.querySelectorAll('#btnTriggerBrowserPrint, #btnTriggerBrowserPrintMobile').forEach(btn => {
    btn.addEventListener('click', () => {
      if (state.activePrintLoanId) {
        document.title = state.activePrintLoanId;
      }
      window.print();
    });
  });

  // Mobile print preview zoom segmented controls (Default: พอดีจอ)
  document.getElementById('btnZoomFit')?.addEventListener('click', () => {
    state.printZoomMode = 'fit';
    updateGatePassPreviewScale();
    const scrollEl = document.querySelector('#printDialog .print-preview-scroll');
    if (scrollEl) scrollEl.scrollLeft = 0;
  });

  document.getElementById('btnZoom100')?.addEventListener('click', () => {
    state.printZoomMode = '100';
    updateGatePassPreviewScale();
  });

  // Double tap or click on mobile preview to toggle zoom
  document.getElementById('printPreviewContainer')?.addEventListener('dblclick', () => {
    if (window.innerWidth <= 768) {
      state.printZoomMode = state.printZoomMode === '100' ? 'fit' : '100';
      updateGatePassPreviewScale();
    }
  });

  window.addEventListener('resize', () => {
    updateGatePassPreviewScale();
  });
}

async function patchStockAsset(tagId, payload) {
  const res = await fetch(`/api/assets/${encodeURIComponent(tagId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.message || data.error || 'บันทึกไม่สำเร็จ');
  }
  applyServerState(data);
  return data;
}

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatShortDate(dateStr) {
  if (!dateStr) return '-';
  const parts = dateStr.slice(0, 10).split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = msg;

  // If a modal dialog is currently open in browser Top Layer, move toast inside it so it stays visible
  const openDialog = document.querySelector('dialog[open]');
  if (openDialog && !openDialog.contains(el)) {
    openDialog.appendChild(el);
  } else if (!openDialog && el.parentElement !== document.body) {
    document.body.appendChild(el);
  }

  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add('hidden'), 3500);
}

// ============================================================================
// Google Workspace Corporate Authentication & User Identity Management
// ============================================================================
function setupAuthSystem() {
  const loginOverlay = document.getElementById('loginOverlay');
  const alertBox = document.getElementById('loginAlertBox');
  const alertMsg = document.getElementById('loginAlertMsg');
  const emailForm = document.getElementById('loginEmailForm');
  const emailInput = document.getElementById('loginEmailInput');
  const pwdInput = document.getElementById('loginPasswordInput');
  const btnGoogle = document.getElementById('btnGoogleWorkspaceLogin');
  const btnUserProfile = document.getElementById('btnUserProfilePill');
  const userDropdown = document.getElementById('userDropdownCard');
  const btnLogout = document.getElementById('btnLogout');
  const btnOpenSettings = document.getElementById('btnOpenSettingsFromUser');
  const allowedDomainsText = document.getElementById('loginAllowedDomainsText');
  const quickUserChips = document.getElementById('loginQuickUserChips');

  // 1. Try restore user from localStorage
  try {
    const saved = localStorage.getItem('activeasset_current_user');
    if (saved) {
      state.currentUser = JSON.parse(saved);
    }
  } catch (_) {}

  function showAlert(msg) {
    if (alertBox && alertMsg) {
      alertMsg.textContent = msg;
      alertBox.classList.remove('hidden');
    }
  }

  function hideAlert() {
    if (alertBox) alertBox.classList.add('hidden');
  }

  function updateUserProfileUI() {
    const user = state.currentUser;
    const navName = document.getElementById('userNavName');
    const navAvatar = document.getElementById('userNavAvatar');
    const ddName = document.getElementById('userDropdownName');
    const ddEmail = document.getElementById('userDropdownEmail');
    const ddRole = document.getElementById('userDropdownRole');
    const ddAvatar = document.getElementById('userDropdownAvatar');

    if (user && user.name) {
      const initial = user.name.trim().charAt(0) || '👤';
      if (navName) navName.textContent = user.name;
      if (navAvatar) {
        if (user.picture) {
          navAvatar.innerHTML = `<img src="${escapeHtml(user.picture)}" alt="${escapeHtml(user.name)}" />`;
        } else {
          navAvatar.textContent = initial;
        }
      }
      if (ddName) ddName.textContent = user.name;
      if (ddEmail) ddEmail.textContent = user.email || '';
      if (ddRole) ddRole.textContent = user.role_name || (user.role === 'admin' ? 'ผู้ดูแลระบบ (Admin)' : 'ผู้ใช้งานทั่วไป (User)');
      if (ddAvatar) {
        if (user.picture) {
          ddAvatar.innerHTML = `<img src="${escapeHtml(user.picture)}" alt="${escapeHtml(user.name)}" />`;
        } else {
          ddAvatar.textContent = initial;
        }
      }
      if (loginOverlay) loginOverlay.classList.add('hidden');
      document.documentElement.classList.remove('is-unauthenticated');
      focusSearchInputIfIdle(150);
      applyPermissionsToUI();
    } else {
      if (navName) navName.textContent = 'เข้าสู่ระบบ';
      if (navAvatar) navAvatar.textContent = '👤';
      if (state.authConfig.require_login) {
        document.documentElement.classList.add('is-unauthenticated');
        if (loginOverlay) loginOverlay.classList.remove('hidden');
      } else {
        document.documentElement.classList.remove('is-unauthenticated');
      }
      applyPermissionsToUI();
    }
  }

  // 2. Fetch Auth Config from Server
  async function loadAuthConfig() {
    try {
      const res = await fetch('/api/auth/config');
      if (res.ok) {
        const cfg = await res.json();
        state.authConfig = cfg;
        if (allowedDomainsText) {
          const doms = (cfg.allowed_domains || 'active5.co.th')
            .split(',')
            .map(d => '@' + d.trim().replace(/^@/, ''))
            .join(', ');
          allowedDomainsText.textContent = doms;
        }

        // Validate domain of currently logged-in user if domain whitelist changed
        if (state.currentUser && state.currentUser.email) {
          const userDomain = state.currentUser.email.split('@')[1]?.toLowerCase();
          const allowed = (cfg.allowed_domains || '')
            .split(',')
            .map(d => d.trim().toLowerCase().replace(/^@/, ''))
            .filter(Boolean);
          if (allowed.length > 0 && !allowed.includes(userDomain)) {
            // Domain mismatch -> force logout
            localStorage.removeItem('activeasset_current_user');
            state.currentUser = null;
            showAlert(`เซสชันหมดอายุ: ไม่อนุญาตให้อีเมลจาก @${userDomain} เข้าใช้งาน (อนุญาตเฉพาะ ${doms})`);
            updateUserProfileUI();
            return;
          }

          // Validate user validity and active status against live database
          try {
            const vRes = await fetch('/api/auth/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email: state.currentUser.email })
            });
            const vData = await vRes.json();
            if (!vRes.ok || !vData.valid) {
              // User was deleted or disabled! Clear cached credentials immediately!
              localStorage.removeItem('activeasset_current_user');
              state.currentUser = null;
              showAlert(vData.error || 'บัญชีผู้ใช้นี้ถูกลบหรือระงับการเข้าใช้งานแล้ว');
              updateUserProfileUI();
              return;
            } else if (vData.user) {
              state.currentUser = vData.user;
              localStorage.setItem('activeasset_current_user', JSON.stringify(vData.user));
              updateUserProfileUI();
            }
          } catch (_) {}
        }

        // Initialize Google One Tap / Sign In with Google if client id is configured
        if (cfg.google_client_id && window.google?.accounts?.id) {
          try {
            window.google.accounts.id.initialize({
              client_id: cfg.google_client_id,
              callback: handleGoogleCredentialResponse,
              auto_select: false,
              cancel_on_tap_outside: true
            });
            const mount = document.getElementById('googleOneTapMount');
            if (mount) {
              window.google.accounts.id.renderButton(mount, {
                theme: 'outline',
                size: 'large',
                width: 380,
                text: 'signin_with',
                shape: 'rectangular',
                logo_alignment: 'left'
              });
            }
          } catch (e) {
            console.warn('Google Identity initialization notice:', e);
          }
        }
      }
    } catch (err) {
      console.error('Failed to load auth config:', err);
    }
    updateUserProfileUI();
  }

  // 3. Handle Google Credential Response
  async function handleGoogleCredentialResponse(response) {
    if (!response || !response.credential) return;
    hideAlert();
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential: response.credential })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'เข้าสู่ระบบด้วย Google Workspace ไม่สำเร็จ');
      }
      state.currentUser = data.user;
      localStorage.setItem('activeasset_current_user', JSON.stringify(data.user));
      updateUserProfileUI();
      applyPermissionsToUI();
      renderActiveView();
      if (data.is_new_user) {
        showToast(data.message || `🎉 ยินดีต้อนรับพนักงานใหม่ ${data.user.name}! ได้รับสิทธิ์ผู้ใช้งาน (User) อัตโนมัติ`);
      } else {
        showToast(`👋 ยินดีต้อนรับ ${data.user.name} (${data.user.role_name || data.user.role || 'User'})`);
      }
    } catch (err) {
      showAlert(err.message);
    }
  }
  window.handleGoogleCredentialResponse = handleGoogleCredentialResponse;

  // 4. Handle Direct Corporate Email Login
  if (emailForm) {
    emailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert();
      let email = (emailInput?.value || '').trim();
      const pwd = (pwdInput?.value || '').trim();
      if (!email) {
        showAlert('กรุณากรอกอีเมลองค์กรของคุณ');
        emailInput?.focus();
        return;
      }

      if (!email.includes('@')) {
        email = email + '@active5.co.th';
      }

      const submitBtn = document.getElementById('btnLoginSubmit');
      try {
        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = '<span>กำลังตรวจสอบ...</span>';
        }
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: pwd })
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
        }
        state.currentUser = data.user;
        localStorage.setItem('activeasset_current_user', JSON.stringify(data.user));
        updateUserProfileUI();
        applyPermissionsToUI();
        renderActiveView();
        if (data.is_new_user) {
          showToast(data.message || `🎉 ยินดีต้อนรับพนักงานใหม่ ${data.user.name}! ได้รับสิทธิ์ผู้ใช้งาน (User) อัตโนมัติ`);
        } else {
          showToast(`👋 ยินดีต้อนรับ ${data.user.name} (${data.user.role_name || data.user.role})`);
        }
      } catch (err) {
        showAlert(err.message);
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = '<span>เข้าสู่ระบบ</span><span class="login-btn-arrow">→</span>';
        }
      }
    });
  }

  // 5. Google Workspace button click
  if (btnGoogle) {
    btnGoogle.addEventListener('click', () => {
      hideAlert();
      if (state.authConfig.google_client_id && window.google?.accounts?.id) {
        window.google.accounts.id.prompt();
      } else {
        // If Google Client ID not yet entered in settings, guide user
        if (emailInput) {
          emailInput.focus();
          showAlert('💡 กรอกอีเมล Google Workspace ของคุณ (เช่น @active5.co.th) เพื่อเข้าใช้งาน หรือไปที่เมนูตั้งค่าเพื่อผูก Google Client ID');
        }
      }
    });
  }

  // 6. Quick Switch for Company Staff
  if (quickUserChips) {
    quickUserChips.addEventListener('click', async (e) => {
      const btn = e.target.closest('.btn-quick-user');
      if (!btn) return;
      hideAlert();
      const email = btn.dataset.email;
      const name = btn.dataset.name;
      const role = btn.dataset.role;
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, name, role })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'เข้าสู่ระบบไม่สำเร็จ');
        state.currentUser = data.user;
        localStorage.setItem('activeasset_current_user', JSON.stringify(data.user));
        updateUserProfileUI();
        applyPermissionsToUI();
        renderActiveView();
        showToast(`👋 เข้าสู่ระบบในฐานะ ${data.user.name} (${data.user.role_name || data.user.role})`);
      } catch (err) {
        showAlert(err.message);
      }
    });
  }

  // 7. Navbar User Profile Pill & Dropdown
  if (btnUserProfile && userDropdown) {
    btnUserProfile.addEventListener('click', (e) => {
      e.stopPropagation();
      if (!state.currentUser && state.authConfig.require_login) {
        if (loginOverlay) loginOverlay.classList.remove('hidden');
        return;
      }
      userDropdown.classList.toggle('hidden');
      btnUserProfile.setAttribute('aria-expanded', !userDropdown.classList.contains('hidden'));
    });

    document.addEventListener('click', (e) => {
      if (!userDropdown.classList.contains('hidden') && !userDropdown.contains(e.target) && !btnUserProfile.contains(e.target)) {
        userDropdown.classList.add('hidden');
        btnUserProfile.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // 8. Open Settings from User Dropdown
  if (btnOpenSettings) {
    btnOpenSettings.addEventListener('click', () => {
      userDropdown?.classList.add('hidden');
      if (typeof window.openCompanySettingsModal === 'function') {
        window.openCompanySettingsModal('roles');
      }
    });
  }

  // 9. Logout
  if (btnLogout) {
    btnLogout.addEventListener('click', () => {
      userDropdown?.classList.add('hidden');
      localStorage.removeItem('activeasset_current_user');
      state.currentUser = null;
      document.documentElement.classList.add('is-unauthenticated');
      updateUserProfileUI();
      applyPermissionsToUI();
      renderActiveView();
      showToast('🔒 ออกจากระบบเรียบร้อยแล้ว');
      if (loginOverlay) loginOverlay.classList.remove('hidden');
    });
  }

  // Initial load
  loadAuthConfig();
}

// ============================================================================
// Real-time Kanban & Data Synchronization Engine (Non-flickering + Notification)
// ============================================================================
let realtimeSyncInitialized = false;

function initRealtimeSync() {
  if (realtimeSyncInitialized) return;
  realtimeSyncInitialized = true;

  let isSyncing = false;

  async function checkSync() {
    if (isSyncing) return;
    // Don't poll if not authenticated
    if (!state.currentUser || !state.currentUser.email) return;
    // Don't poll if tab is hidden in background / screen locked
    if (document.visibilityState === 'hidden') return;

    try {
      isSyncing = true;
      const email = state.currentUser.email;
      const v = state.syncVersion || 0;
      const res = await fetch(`/api/sync/heartbeat?v=${v}&user=${encodeURIComponent(email)}`);
      if (!res.ok) return;
      const data = await res.json();

      // 1. If user was deleted or disabled in database, log out immediately!
      if (data.valid === false) {
        localStorage.removeItem('activeasset_current_user');
        state.currentUser = null;
        document.documentElement.classList.add('is-unauthenticated');
        const loginOverlay = document.getElementById('loginOverlay');
        if (loginOverlay) loginOverlay.classList.remove('hidden');
        const alertBox = document.getElementById('loginAlertBox');
        const alertMsg = document.getElementById('loginAlertMsg');
        if (alertBox && alertMsg) {
          alertMsg.textContent = data.error || 'บัญชีผู้ใช้นี้ถูกลบหรือระงับการเข้าใช้งานแล้ว';
          alertBox.classList.remove('hidden');
        }
        applyPermissionsToUI();
        showToast('🔒 ' + (data.error || 'บัญชีผู้ใช้นี้ถูกลบหรือระงับการใช้งาน'));
        return;
      }

      // 2. If data changed, update state smoothly without flickering
      if (data.changed) {
        state.syncVersion = data.v;
        await syncFreshStateSilently(data.latestLoan);
      }
    } catch (_) {
      // Quiet fail on network interruption
    } finally {
      isSyncing = false;
    }
  }

  // Poll heartbeat every 60 seconds (1 นาที) เฉพาะตอนที่หน้าจอกำลังเปิดอยู่
  setInterval(checkSync, 60000);

  // Sync immediately when tab is restored from background
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      checkSync();
    }
  });
}

async function syncFreshStateSilently(latestLoanInfo) {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) return;
    const freshData = await res.json();

    // Map existing loan IDs
    const prevLoans = state.loans || [];
    const prevLoanIds = new Set(prevLoans.map(l => l.id));
    const incomingLoans = freshData.loans || [];

    // Detect newly added loans
    const brandNewLoans = incomingLoans.filter(l => !prevLoanIds.has(l.id));

    // Save scroll positions of board columns and sub-stacks so there is ZERO jump/flicker
    const board = document.getElementById('kanbanBoard');
    const scrollMap = new Map();
    if (board) {
      board.querySelectorAll('.kanban-col').forEach((col, idx) => {
        scrollMap.set(`col-${idx}`, col.scrollTop);
      });
      board.querySelectorAll('.sub-stack-cards').forEach(stack => {
        const key = stack.closest('.sub-stack')?.querySelector('.sub-stack-header')?.getAttribute('data-toggle-substack');
        if (key) scrollMap.set(key, stack.scrollTop);
      });
    }

    // Apply data
    state.today = freshData.today;
    state.assets = freshData.assets || [];
    state.catalogs = freshData.catalogs || [];
    state.loans = incomingLoans;
    state.accessorySuggestions = freshData.accessorySuggestions || [];
    state.locations = freshData.locations || [];
    if (freshData.companySettings) {
      state.companySettings = { ...state.companySettings, ...freshData.companySettings };
    }
    if (freshData.version) {
      state.syncVersion = freshData.version;
    }

    renderHeaderCounters();

    // Re-render active view smoothly
    if (state.viewMode === 'kanban') {
      renderKanbanBoard();
      // Restore scroll positions seamlessly
      if (board) {
        board.querySelectorAll('.kanban-col').forEach((col, idx) => {
          if (scrollMap.has(`col-${idx}`)) col.scrollTop = scrollMap.get(`col-${idx}`);
        });
        board.querySelectorAll('.sub-stack-cards').forEach(stack => {
          const key = stack.closest('.sub-stack')?.querySelector('.sub-stack-header')?.getAttribute('data-toggle-substack');
          if (key && scrollMap.has(key)) stack.scrollTop = scrollMap.get(key);
        });
      }
    } else if (state.viewMode === 'list') {
      renderListView();
    } else if (state.viewMode === 'returned') {
      renderReturnedView();
    } else if (state.viewMode === 'stock') {
      renderStockView();
    }

    // If new loans were added by other users:
    if (brandNewLoans.length > 0) {
      for (const nl of brandNewLoans) {
        // Highlight new card on board
        const cardEl = document.querySelector(`.loan-card[data-card-loan="${nl.id}"]`);
        if (cardEl) {
          cardEl.classList.add('card-just-arrived');
          setTimeout(() => cardEl.classList.remove('card-just-arrived'), 4500);
        }

        // Show Live Notification Toast
        showLiveLoanNotification(nl);

        // Play gentle audio chime
        playNotificationChime();
      }
    }
  } catch (_) {}
}

function showLiveLoanNotification(loan) {
  let toastContainer = document.getElementById('liveLoanNotificationContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'liveLoanNotificationContainer';
    toastContainer.className = 'live-loan-notification-container';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'live-loan-toast';
  const company = loan.customer_company || loan.customer_name || '-';
  toast.innerHTML = `
    <div class="live-toast-icon">🔔</div>
    <div class="live-toast-body">
      <div class="live-toast-title">มีใบยืมใหม่เข้ามา!</div>
      <div class="live-toast-desc"><strong>${escapeHtml(loan.id)}</strong> · ${escapeHtml(loan.borrower_name)} (${escapeHtml(company)})</div>
    </div>
    <button type="button" class="btn-live-toast-view" data-view-live-loan="${escapeHtml(loan.id)}">เปิดดู</button>
    <button type="button" class="btn-live-toast-close" title="ปิด">✕</button>
  `;

  toast.querySelector('.btn-live-toast-close')?.addEventListener('click', () => {
    toast.classList.add('toast-fadeout');
    setTimeout(() => toast.remove(), 250);
  });

  toast.querySelector('[data-view-live-loan]')?.addEventListener('click', () => {
    toast.remove();
    // Scroll to card or open print pass
    const card = document.querySelector(`.loan-card[data-card-loan="${loan.id}"]`);
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.classList.add('card-highlight');
      setTimeout(() => card.classList.remove('card-highlight'), 3000);
    } else {
      openPrintModal(loan.id);
    }
  });

  toastContainer.appendChild(toast);

  // Auto remove after 7 seconds
  setTimeout(() => {
    if (toast.parentElement) {
      toast.classList.add('toast-fadeout');
      setTimeout(() => toast.remove(), 250);
    }
  }, 7000);
}

function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;
    [
      { freq: 659.25, start: now, duration: 0.18 },
      { freq: 987.77, start: now + 0.12, duration: 0.35 }
    ].forEach(({ freq, start, duration }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.12, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + duration);
    });
  } catch (_) {}
}
