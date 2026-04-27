// Modales UI compartidos: confirm + prompt + toast.
// Reemplazos de confirm()/prompt() nativos que algunos sandboxes (browser-use,
// iframes restringidos) bloquean.
//
// Los DOM elements están en index.html: #confirm-dialog, #prompt-dialog.
// initModals() registra los listeners de botones + Escape.

type ConfirmCb = { onYes: (() => void) | undefined; onNo: (() => void) | undefined } | null;
type PromptCb = {
  onAccept: ((val: string) => void) | undefined;
  onCancel: (() => void) | undefined;
} | null;

let _confirmCb: ConfirmCb = null;
let _promptCb: PromptCb = null;
let _toastTimer: number | null = null;

// ── showConfirm ──────────────────────────────────────────────────
export function showConfirm(message: string, onYes?: () => void, onNo?: () => void): void {
  document.getElementById('confirm-msg')!.textContent = message;
  document.getElementById('confirm-dialog')!.classList.add('open');
  _confirmCb = { onYes, onNo };
}

function hideConfirm(): void {
  document.getElementById('confirm-dialog')!.classList.remove('open');
  _confirmCb = null;
}

// ── showPrompt ───────────────────────────────────────────────────
export function showPrompt(
  message: string,
  defaultValue: string,
  onAccept?: (val: string) => void,
  onCancel?: () => void,
): void {
  document.getElementById('prompt-msg')!.textContent = message;
  const input = document.getElementById('prompt-input') as HTMLInputElement;
  input.value = defaultValue || '';
  document.getElementById('prompt-dialog')!.classList.add('open');
  _promptCb = { onAccept, onCancel };
  setTimeout(() => {
    input.focus();
    input.select();
  }, 50);
}

function hidePrompt(): void {
  document.getElementById('prompt-dialog')!.classList.remove('open');
  _promptCb = null;
}

// ── showToast (efímero, no bloqueante) ───────────────────────────
export function showToast(message: string, durationMs?: number): void {
  let toast = document.getElementById('cs-toast') as HTMLDivElement | null;
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'cs-toast';
    toast.style.cssText =
      'position:fixed; bottom:80px; left:50%; transform:translateX(-50%); ' +
      'background:rgba(40,30,20,0.95); color:#f5e8c8; padding:10px 18px; ' +
      'border-radius:100px; font-size:13px; z-index:10002; box-shadow:0 8px 24px rgba(0,0,0,0.5); ' +
      'backdrop-filter:blur(8px); pointer-events:none; opacity:0; transition:opacity 0.2s; ' +
      'max-width:80vw; text-align:center;';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  requestAnimationFrame(() => {
    toast!.style.opacity = '1';
  });
  if (_toastTimer !== null) clearTimeout(_toastTimer);
  _toastTimer = window.setTimeout(() => {
    toast!.style.opacity = '0';
  }, durationMs ?? 3500);
}

// ── Init ─────────────────────────────────────────────────────────
// Registra listeners de botones de los diálogos + Escape global.
// Llamar una sola vez en boot.
export function initModals(): void {
  // Confirm
  document.getElementById('confirm-yes')!.addEventListener('click', () => {
    const cb = _confirmCb;
    hideConfirm();
    if (cb && typeof cb.onYes === 'function') cb.onYes();
  });
  document.getElementById('confirm-no')!.addEventListener('click', () => {
    const cb = _confirmCb;
    hideConfirm();
    if (cb && typeof cb.onNo === 'function') cb.onNo();
  });

  // Prompt
  document.getElementById('prompt-yes')!.addEventListener('click', () => {
    const cb = _promptCb;
    const val = (document.getElementById('prompt-input') as HTMLInputElement).value;
    hidePrompt();
    if (cb && typeof cb.onAccept === 'function') cb.onAccept(val);
  });
  document.getElementById('prompt-no')!.addEventListener('click', () => {
    const cb = _promptCb;
    hidePrompt();
    if (cb && typeof cb.onCancel === 'function') cb.onCancel();
  });
  document.getElementById('prompt-input')!.addEventListener('keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Enter') {
      ke.preventDefault();
      (document.getElementById('prompt-yes') as HTMLButtonElement).click();
    } else if (ke.key === 'Escape') {
      ke.preventDefault();
      (document.getElementById('prompt-no') as HTMLButtonElement).click();
    }
    ke.stopPropagation();
  });

  // Escape global cierra confirm + prompt si están abiertos
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (document.getElementById('confirm-dialog')!.classList.contains('open')) {
      const cb = _confirmCb;
      hideConfirm();
      if (cb && typeof cb.onNo === 'function') cb.onNo();
    }
    if (document.getElementById('prompt-dialog')!.classList.contains('open')) {
      const cb = _promptCb;
      hidePrompt();
      if (cb && typeof cb.onCancel === 'function') cb.onCancel();
    }
  });
}
