import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mountLLMSettings } from '../../src/ui/settings-llm';
import { createSessionCostTracker } from '../../src/llm/cost-tracker';
import { LLM_STORAGE_KEYS } from '../../src/llm/storage-keys';

class FakeStyle {
  private props = new Map<string, string>();

  get cssText(): string {
    return Array.from(this.props, ([key, value]) => `${key}:${value}`).join(';');
  }

  set cssText(value: string) {
    this.props.clear();
    for (const part of value.split(';')) {
      const [rawKey, ...rawValue] = part.split(':');
      const key = rawKey?.trim();
      const propValue = rawValue.join(':').trim();
      if (key && propValue) this.props.set(key, propValue);
    }
  }

  get display(): string {
    return this.props.get('display') ?? '';
  }

  set display(value: string) {
    this.props.set('display', value);
  }

  get visibility(): string {
    return this.props.get('visibility') ?? '';
  }

  setProperty(key: string, value: string): void {
    this.props.set(key, value);
  }
}

class FakeElement {
  id = '';
  type = '';
  value = '';
  checked = false;
  tabIndex = 0;
  textContent: string | null = null;
  readonly children: FakeElement[] = [];
  readonly style = new FakeStyle();
  private readonly attrs = new Map<string, string>();
  private readonly listeners = new Map<string, Array<() => void>>();
  parentElement: FakeElement | null = null;

  get firstElementChild(): FakeElement | null {
    return this.children[0] ?? null;
  }

  setAttribute(key: string, value: string): void {
    this.attrs.set(key, value);
  }

  append(...children: FakeElement[]): void {
    for (const child of children) this.appendChild(child);
  }

  appendChild(child: FakeElement): FakeElement {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  addEventListener(event: string, cb: () => void): void {
    this.listeners.set(event, [...(this.listeners.get(event) ?? []), cb]);
  }

  click(): void {
    for (const cb of this.listeners.get('click') ?? []) cb();
  }

  focus(): void {
    fakeDocument.activeElement = this as unknown as HTMLElement;
  }

  querySelectorAll(selector: string): FakeElement[] {
    const all = this.flatten();
    if (selector === 'button') return all.filter((el) => el.tagName === 'button');
    return [];
  }

  querySelector(selector: string): FakeElement | null {
    if (selector.startsWith('#')) {
      const id = selector.slice(1);
      return this.flatten().find((el) => el.id === id) ?? null;
    }
    return this.querySelectorAll(selector)[0] ?? null;
  }

  get tagName(): string {
    return this.attrs.get('tagName') ?? '';
  }

  get innerText(): string {
    return this.collectText();
  }

  set innerHTML(value: string) {
    this.children.splice(0);
    this.textContent = value;
  }

  get innerHTML(): string {
    return this.collectText();
  }

  private flatten(): FakeElement[] {
    return [this, ...this.children.flatMap((child) => child.flatten())];
  }

  private collectText(): string {
    return `${this.textContent ?? ''}${this.children.map((child) => child.collectText()).join('')}`;
  }
}

const fakeDocument = {
  activeElement: null as HTMLElement | null,
  body: new FakeElement(),
  contains: (el: unknown) => fakeDocument.body.querySelectorAll('*').includes(el as FakeElement),
  createElement: (tagName: string) => {
    const el = new FakeElement();
    el.setAttribute('tagName', tagName);
    return el;
  },
  querySelector: (selector: string) => fakeDocument.body.querySelector(selector),
  querySelectorAll: (selector: string) => fakeDocument.body.querySelectorAll(selector),
};

function installLocalStorage(): void {
  const store = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      clear: () => store.clear(),
      getItem: (key: string) => store.get(key) ?? null,
      removeItem: (key: string) => {
        store.delete(key);
      },
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
    },
  });
}

function installDom(): void {
  fakeDocument.body = new FakeElement();
  Object.defineProperty(globalThis, 'HTMLElement', {
    configurable: true,
    value: FakeElement,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: fakeDocument,
  });
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      addEventListener: vi.fn(),
      confirm: vi.fn(),
      getComputedStyle: (el: FakeElement) => el.style,
      removeEventListener: vi.fn(),
      setTimeout: (cb: () => void) => {
        cb();
        return 0;
      },
    },
  });
}

beforeEach(() => {
  installLocalStorage();
  installDom();
  localStorage.clear();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('mountLLMSettings', () => {
  it('open() agrega modal al DOM', () => {
    const tracker = createSessionCostTracker();
    const ui = mountLLMSettings({ tracker });
    ui.open();
    expect(document.body.children.length).toBeGreaterThan(0);
    ui.close();
  });

  it('close() oculta modal y marca controller como cerrado', () => {
    const tracker = createSessionCostTracker();
    const ui = mountLLMSettings({ tracker });
    ui.open();
    expect(ui.isOpen()).toBe(true);
    ui.close();
    expect(ui.isOpen()).toBe(false);
    expect(document.body.firstElementChild).toBeInstanceOf(HTMLElement);
    expect((document.body.firstElementChild as HTMLElement).style.display).toBe('none');
  });

  it('Save guarda API key en localStorage', () => {
    const tracker = createSessionCostTracker();
    const ui = mountLLMSettings({ tracker });
    ui.open();

    const input = document.querySelector<HTMLInputElement>('#llm-settings-api-key');
    const save = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === 'Save',
    );
    expect(input).not.toBeNull();
    expect(save).not.toBeUndefined();

    input!.value = 'sk-ant-api01-XXX';
    save!.click();

    expect(localStorage.getItem(LLM_STORAGE_KEYS.apiKey)).toBe('sk-ant-api01-XXX');
    ui.close();
  });

  it('Clear borra API key de localStorage', () => {
    localStorage.setItem(LLM_STORAGE_KEYS.apiKey, 'sk-ant-api01-XXX');
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const tracker = createSessionCostTracker();
    const ui = mountLLMSettings({ tracker });
    ui.open();

    const clear = Array.from(document.querySelectorAll<HTMLButtonElement>('button')).find(
      (button) => button.textContent === 'Clear',
    );
    expect(clear).not.toBeUndefined();

    clear!.click();

    expect(localStorage.getItem(LLM_STORAGE_KEYS.apiKey)).toBeNull();
    ui.close();
  });

  it('tracker.onChange triggers UI update', () => {
    const tracker = createSessionCostTracker();
    const ui = mountLLMSettings({ tracker });
    ui.open();

    tracker.trackCall({ inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheCreationTokens: 0 }, 'haiku-4-5');

    expect(document.body.innerText).toContain('$0.000350');
    ui.close();
  });
});

describe('SessionCostTracker.onChange', () => {
  it('callback invoked en trackCall', () => {
    const tracker = createSessionCostTracker();
    const cb = vi.fn();
    tracker.onChange(cb);
    tracker.trackCall({ inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheCreationTokens: 0 }, 'haiku-4-5');
    expect(cb).toHaveBeenCalled();
  });

  it('unsubscribe stops callback', () => {
    const tracker = createSessionCostTracker();
    const cb = vi.fn();
    const unsubscribe = tracker.onChange(cb);
    unsubscribe();
    tracker.trackCall({ inputTokens: 100, outputTokens: 50, cacheReadTokens: 0, cacheCreationTokens: 0 }, 'haiku-4-5');
    expect(cb).not.toHaveBeenCalled();
  });
});
