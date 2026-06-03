const STORAGE_KEY = 'gss-theme';
const LEGACY_STORAGE_KEY = 'theme';
const root = document.documentElement;
const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');

type Theme = 'light' | 'dark';

declare global {
  interface Window {
    __gssThemeSystemListenerBound?: boolean;
    __gssThemeStorageListenerBound?: boolean;
    __gssThemeObserverBound?: boolean;
    __gssThemeToggleInitialized?: boolean;
  }
}

const ICONS = {
  dark: `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <path fill="currentColor" d="M21.75 15.5A9.75 9.75 0 0 1 8.5 2.25a7.75 7.75 0 1 0 13.25 13.25Z"/>
    </svg>
    `,
  light: `
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
        <circle cx="12" cy="12" r="4.25" fill="none" stroke="currentColor" stroke-width="1.8"/>
        <path d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6M18.7 18.7l-1.6-1.6M6.9 6.9L5.3 5.3" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>
    </svg>
    `,
};

function getMetaThemeColor() {
  return document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
}

function getStoredTheme(): Theme | null {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;

    const legacySaved = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (legacySaved === 'light' || legacySaved === 'dark') return legacySaved;
  } catch (_) {
    return null;
  }

  return null;
}

function getPreferredTheme(): Theme {
  const stored = getStoredTheme();
  if (stored) return stored;
  return themeMedia.matches ? 'dark' : 'light';
}

function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(STORAGE_KEY, theme);
    localStorage.setItem(LEGACY_STORAGE_KEY, theme);
  } catch (_) {
    // ignore storage failures
  }
}

function setMetaTheme(theme: Theme) {
  const metaThemeColor = getMetaThemeColor();
  if (!metaThemeColor) return;
  metaThemeColor.setAttribute('content', theme === 'dark' ? '#0b1120' : '#1d4ed8');
}

function syncButtons(theme: Theme) {
  const buttons = document.querySelectorAll<HTMLElement>('[data-theme-toggle], #theme-toggle');

  buttons.forEach((button) => {
    button.setAttribute(
      'aria-label',
      theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode',
    );
    button.setAttribute('title', theme === 'dark' ? 'Light mode' : 'Dark mode');
    button.setAttribute('aria-pressed', theme === 'dark' ? 'true' : 'false');

    const iconHost = button.querySelector('.theme-toggle__icon');
    if (iconHost) {
      iconHost.innerHTML = ICONS[theme];
      return;
    }

    const legacyUse = button.querySelector('#theme-icon use, svg use');
    if (legacyUse) {
      const iconId = theme === 'dark' ? '#icon-sun' : '#icon-moon-stars';
      legacyUse.setAttribute('href', iconId);
      legacyUse.setAttribute('xlink:href', iconId);
    }
  });
}

function applyTheme(theme: string) {
  const normalizedTheme = theme === 'dark' ? 'dark' : 'light';
  root.setAttribute('data-theme', normalizedTheme);
  setMetaTheme(normalizedTheme);
  syncButtons(normalizedTheme);
}

function toggleTheme() {
  const currentTheme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const nextTheme = currentTheme === 'dark' ? 'light' : 'dark';

  persistTheme(nextTheme);
  applyTheme(nextTheme);
}

function bindButtons(scope: ParentNode = document) {
  const buttons = scope.querySelectorAll<HTMLElement>('[data-theme-toggle], #theme-toggle');

  buttons.forEach((button) => {
    if (button.dataset.themeToggleBound === 'true') return;
    button.dataset.themeToggleBound = 'true';
    button.addEventListener('click', toggleTheme);
  });
}

function bindSystemThemeListener() {
  if (window.__gssThemeSystemListenerBound) return;
  window.__gssThemeSystemListenerBound = true;

  const onChange = (event: MediaQueryListEvent) => {
    if (getStoredTheme()) return;
    applyTheme(event.matches ? 'dark' : 'light');
  };

  if (typeof themeMedia.addEventListener === 'function') {
    themeMedia.addEventListener('change', onChange);
    return;
  }

  if (typeof themeMedia.addListener === 'function') {
    themeMedia.addListener(onChange);
  }
}

function bindStorageSync() {
  if (window.__gssThemeStorageListenerBound) return;
  window.__gssThemeStorageListenerBound = true;

  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY && event.key !== LEGACY_STORAGE_KEY) return;
    applyTheme(getPreferredTheme());
  });
}

function observeFutureButtons() {
  if (window.__gssThemeObserverBound) return;
  if (typeof MutationObserver !== 'function') return;

  const target = document.body || document.documentElement;
  if (!target) return;

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        if (!(node instanceof Element)) continue;

        if (node.matches?.('[data-theme-toggle], #theme-toggle')) {
          bindButtons(node.parentNode || document);
          continue;
        }

        if (node.querySelector?.('[data-theme-toggle], #theme-toggle')) {
          bindButtons(node);
        }
      }
    }
  });

  window.__gssThemeObserverBound = true;
  observer.observe(target, {
    childList: true,
    subtree: true,
  });
}

export function initThemeToggle() {
  if (window.__gssThemeToggleInitialized) {
    applyTheme(getPreferredTheme());
    bindButtons();
    return;
  }

  window.__gssThemeToggleInitialized = true;
  applyTheme(getPreferredTheme());
  bindButtons();
  bindSystemThemeListener();
  bindStorageSync();
  observeFutureButtons();
}
