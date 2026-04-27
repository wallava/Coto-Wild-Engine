import { LLM_STORAGE_KEYS } from '../llm/storage-keys';
import {
  getLLMClient,
  isLLMEnabled,
  setApiKey,
  clearApiKey,
  loadKillSwitchFromStorage,
  loadSessionCapFromStorage,
  sanitizeError,
} from '../llm/factory';
import type { SessionCostTracker } from '../llm/types';

export type SettingsLLMOptions = {
  tracker: SessionCostTracker;
};

type SettingsLLMController = {
  open(): void;
  close(): void;
  isOpen(): boolean;
};

type CostChangeUnsubscribe = () => void;

type CostAwareTracker = SessionCostTracker & {
  onChange(cb: (cost: number) => void): CostChangeUnsubscribe;
};

type FocusableElement =
  | HTMLAnchorElement
  | HTMLButtonElement
  | HTMLInputElement
  | HTMLSelectElement
  | HTMLTextAreaElement
  | HTMLElement;

type TestModel = Parameters<SessionCostTracker['canAffordEstimatedCall']>[0];

const TEST_MODEL: TestModel = 'haiku-4-5';
const DEFAULT_SESSION_CAP_USD = 0.50;
const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function setStyles(el: HTMLElement, styles: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(styles)) {
    if (value !== undefined) {
      el.style.setProperty(key, value);
    }
  }
}

function makeButton(text: string): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = text;
  setStyles(button, {
    border: '1px solid #555',
    background: '#222',
    color: '#f2f2f2',
    padding: '7px 10px',
    borderRadius: '4px',
    cursor: 'pointer',
    font: '12px system-ui, sans-serif',
  });
  return button;
}

function makeLabel(text: string, htmlFor: string): HTMLLabelElement {
  const label = document.createElement('label');
  label.htmlFor = htmlFor;
  label.textContent = text;
  setStyles(label, {
    display: 'block',
    marginBottom: '6px',
    color: '#ddd',
    font: '12px system-ui, sans-serif',
  });
  return label;
}

function formatCostUSD(cost: number): string {
  return `$${cost.toFixed(6)}`;
}

function parseSessionCap(raw: string | null): number {
  if (raw === null) return DEFAULT_SESSION_CAP_USD;
  const value = Number.parseFloat(raw);
  if (!Number.isFinite(value) || value < 0) return DEFAULT_SESSION_CAP_USD;
  return value;
}

function getFocusableElements(root: HTMLElement): FocusableElement[] {
  return Array.from(root.querySelectorAll<FocusableElement>(FOCUSABLE_SELECTOR)).filter((el) => {
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  });
}

function updateMessage(el: HTMLElement, text: string, color: string): void {
  el.textContent = text;
  el.style.color = color;
}

export function mountLLMSettings(opts: SettingsLLMOptions): SettingsLLMController {
  const tracker = opts.tracker as CostAwareTracker;
  let openState = false;
  let previousFocus: HTMLElement | null = null;
  let unsubscribeCost: CostChangeUnsubscribe | null = null;

  const backdrop = document.createElement('div');
  backdrop.setAttribute('role', 'presentation');
  backdrop.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,0.72);z-index:10000;display:none;' +
    'align-items:center;justify-content:center;padding:18px;box-sizing:border-box;';

  const modal = document.createElement('div');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'llm-settings-title');
  modal.tabIndex = -1;
  modal.style.cssText =
    'position:relative;width:min(520px,calc(100vw - 36px));max-height:calc(100vh - 36px);' +
    'overflow:auto;background:#151515;color:#eee;border:1px solid #444;border-radius:6px;' +
    'box-shadow:0 18px 60px rgba(0,0,0,0.65);padding:20px;box-sizing:border-box;';

  const closeButton = makeButton('X');
  closeButton.setAttribute('aria-label', 'Cerrar settings LLM');
  setStyles(closeButton, {
    position: 'absolute',
    top: '10px',
    right: '10px',
    width: '30px',
    height: '30px',
    padding: '0',
  });

  const title = document.createElement('h2');
  title.id = 'llm-settings-title';
  title.textContent = 'LLM Settings';
  title.style.cssText = 'margin:0 42px 16px 0;font:600 18px system-ui,sans-serif;color:#fff;';

  const keyRow = document.createElement('div');
  keyRow.style.cssText = 'margin-bottom:14px;';

  const apiKeyId = 'llm-settings-api-key';
  const apiKeyLabel = makeLabel('API Key', apiKeyId);
  const apiKeyWrap = document.createElement('div');
  apiKeyWrap.style.cssText = 'display:flex;gap:8px;align-items:center;';

  const apiKeyInput = document.createElement('input');
  apiKeyInput.id = apiKeyId;
  apiKeyInput.type = 'password';
  apiKeyInput.autocomplete = 'off';
  apiKeyInput.spellcheck = false;
  apiKeyInput.style.cssText =
    'flex:1;min-width:0;background:#0d0d0d;color:#eee;border:1px solid #555;border-radius:4px;' +
    'padding:8px 9px;font:13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;';

  const toggleKeyButton = makeButton('ojo');
  toggleKeyButton.setAttribute('aria-label', 'Mostrar API key');
  toggleKeyButton.style.minWidth = '48px';

  apiKeyWrap.append(apiKeyInput, toggleKeyButton);
  keyRow.append(apiKeyLabel, apiKeyWrap);

  const buttonRow = document.createElement('div');
  buttonRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:12px 0 12px;';

  const saveButton = makeButton('Save');
  const clearButton = makeButton('Clear');
  const testButton = makeButton('Test connection');
  buttonRow.append(saveButton, clearButton, testButton);

  const message = document.createElement('div');
  message.setAttribute('aria-live', 'polite');
  message.style.cssText = 'min-height:18px;margin:0 0 14px;font:12px system-ui,sans-serif;color:#ccc;';

  const costRow = document.createElement('div');
  costRow.style.cssText =
    'display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0;' +
    'padding:9px 0;border-top:1px solid #333;border-bottom:1px solid #333;';

  const costLabel = document.createElement('span');
  costLabel.textContent = 'Costo de sesión';
  costLabel.style.cssText = 'font:12px system-ui,sans-serif;color:#ddd;';

  const costValue = document.createElement('span');
  costValue.style.cssText = 'font:13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#8fd694;';
  costRow.append(costLabel, costValue);

  const killSwitchRow = document.createElement('div');
  killSwitchRow.style.cssText = 'display:flex;align-items:center;gap:8px;margin:14px 0;';

  const killSwitchInput = document.createElement('input');
  killSwitchInput.id = 'llm-settings-killswitch';
  killSwitchInput.type = 'checkbox';

  const killSwitchLabel = makeLabel(
    'Deshabilitar LLM (usar respuestas enlatadas)',
    killSwitchInput.id,
  );
  killSwitchLabel.style.marginBottom = '0';
  killSwitchRow.append(killSwitchInput, killSwitchLabel);

  const capRow = document.createElement('div');
  capRow.style.cssText = 'margin-top:14px;';

  const capInput = document.createElement('input');
  capInput.id = 'llm-settings-session-cap';
  capInput.type = 'number';
  capInput.min = '0';
  capInput.step = '0.01';
  capInput.style.cssText =
    'width:140px;background:#0d0d0d;color:#eee;border:1px solid #555;border-radius:4px;' +
    'padding:8px 9px;font:13px ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;';

  const capLabel = makeLabel('Cap de sesión (USD)', capInput.id);
  capRow.append(capLabel, capInput);

  modal.append(
    closeButton,
    title,
    keyRow,
    buttonRow,
    message,
    costRow,
    killSwitchRow,
    capRow,
  );
  backdrop.appendChild(modal);
  document.body.appendChild(backdrop);

  function updateCostDisplay(cost: number): void {
    costValue.textContent = formatCostUSD(cost);
  }

  function syncStoredSettings(): void {
    const killSwitchRaw = localStorage.getItem(LLM_STORAGE_KEYS.killswitch);
    killSwitchInput.checked = killSwitchRaw === 'on';
    void loadKillSwitchFromStorage();
    void isLLMEnabled();

    const cap = parseSessionCap(localStorage.getItem(LLM_STORAGE_KEYS.sessionCap));
    capInput.value = cap.toFixed(2);
    tracker.setCap(cap);
    void loadSessionCapFromStorage();
    updateCostDisplay(tracker.getSessionCost());
  }

  function handleKeydown(event: KeyboardEvent): void {
    if (!openState) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }

    if (event.key !== 'Tab') return;

    const focusable = getFocusableElements(modal);
    if (focusable.length === 0) {
      event.preventDefault();
      modal.focus();
      return;
    }

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function confirmClearApiKey(): boolean {
    try {
      return window.confirm('Borrar API key?');
    } catch (err: unknown) {
      const sanitized = sanitizeError(err);
      updateMessage(message, `Confirm bloqueado: ${sanitized.message}`, '#ff6b6b');
      return false;
    }
  }

  function saveApiKey(): void {
    const value = apiKeyInput.value.trim();
    if (value.length === 0) {
      updateMessage(message, 'API key vacía', '#ff6b6b');
      return;
    }

    try {
      setApiKey(value);
      localStorage.setItem(LLM_STORAGE_KEYS.apiKey, value);
      updateMessage(message, 'API key guardada', '#8fd694');
    } catch (err: unknown) {
      const sanitized = sanitizeError(err);
      updateMessage(message, `No se pudo guardar API key: ${sanitized.message}`, '#ff6b6b');
    }
  }

  function clearStoredApiKey(): void {
    if (!confirmClearApiKey()) return;

    try {
      clearApiKey();
      localStorage.removeItem(LLM_STORAGE_KEYS.apiKey);
      apiKeyInput.value = '';
      updateMessage(message, 'API key borrada', '#8fd694');
    } catch (err: unknown) {
      const sanitized = sanitizeError(err);
      updateMessage(message, `No se pudo borrar API key: ${sanitized.message}`, '#ff6b6b');
    }
  }

  async function testConnection(): Promise<void> {
    try {
      if (tracker.canAffordEstimatedCall(TEST_MODEL, 50, 5) === false) {
        updateMessage(message, 'Cap excedido, no se ejecuta test', '#ff6b6b');
        return;
      }

      const client = getLLMClient();
      if (client === null) {
        updateMessage(message, 'No hay API key configurada', '#ff6b6b');
        return;
      }

      await client.complete({
        model: TEST_MODEL,
        system: [],
        messages: [{ role: 'user', content: 'ok' }],
        maxTokens: 5,
      });
      updateMessage(message, 'Conexión OK', '#8fd694');
    } catch (err: unknown) {
      const sanitized = sanitizeError(err);
      updateMessage(message, `Conexión falló: ${sanitized.message}`, '#ff6b6b');
    }
  }

  function persistKillSwitch(): void {
    localStorage.setItem(LLM_STORAGE_KEYS.killswitch, killSwitchInput.checked ? 'on' : 'off');
  }

  function persistSessionCap(): void {
    const value = Number.parseFloat(capInput.value);
    const cap = Number.isFinite(value) && value >= 0 ? value : DEFAULT_SESSION_CAP_USD;
    capInput.value = cap.toFixed(2);
    tracker.setCap(cap);
    localStorage.setItem(LLM_STORAGE_KEYS.sessionCap, String(cap));
  }

  function open(): void {
    if (openState) return;
    openState = true;
    previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    syncStoredSettings();
    unsubscribeCost = tracker.onChange((cost: number) => {
      updateCostDisplay(cost);
    });
    backdrop.style.display = 'flex';
    window.addEventListener('keydown', handleKeydown, true);
    window.setTimeout(() => {
      apiKeyInput.focus();
    }, 0);
  }

  function close(): void {
    if (!openState) return;
    openState = false;
    backdrop.style.display = 'none';
    window.removeEventListener('keydown', handleKeydown, true);
    if (unsubscribeCost !== null) {
      unsubscribeCost();
      unsubscribeCost = null;
    }
    if (previousFocus !== null && document.contains(previousFocus)) {
      previousFocus.focus();
    }
    previousFocus = null;
  }

  closeButton.addEventListener('click', close);
  toggleKeyButton.addEventListener('click', () => {
    const showing = apiKeyInput.type === 'text';
    apiKeyInput.type = showing ? 'password' : 'text';
    toggleKeyButton.textContent = showing ? 'ojo' : 'ocultar';
    toggleKeyButton.setAttribute('aria-label', showing ? 'Mostrar API key' : 'Ocultar API key');
  });
  saveButton.addEventListener('click', saveApiKey);
  clearButton.addEventListener('click', clearStoredApiKey);
  testButton.addEventListener('click', () => {
    void testConnection();
  });
  killSwitchInput.addEventListener('change', persistKillSwitch);
  capInput.addEventListener('blur', persistSessionCap);
  capInput.addEventListener('keydown', (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      persistSessionCap();
    }
  });

  return {
    open,
    close,
    isOpen(): boolean {
      return openState;
    },
  };
}
