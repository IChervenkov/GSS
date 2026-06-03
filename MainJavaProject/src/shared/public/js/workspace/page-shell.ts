import { initThemeToggle } from '/assets/shared/js/core/theme-toggle.ts';

type WorkspacePageData = Record<string, any>;
type WorkspacePayload = Record<string, any>;
type ToastManager = {
  show(options: { title?: string; message?: string; variant?: string }): void;
};

function getRequiredMarkerHost(label: HTMLElement, control: HTMLElement) {
  const directTextChild = Array.from(label.children || []).find((child) => {
    if (!(child instanceof HTMLElement)) return false;
    if (child.matches('.required-marker')) return false;
    if (child === control || child.contains(control)) return false;
    if (child.matches('.input-icon-field, .lookup-combobox, .segmented-control')) return false;
    return child.textContent.trim();
  });
  return directTextChild || label;
}

function syncRequiredFieldLabels(root: ParentNode = document) {
  const controls = Array.from(root.querySelectorAll?.('input, select, textarea') || []);
  controls.forEach((control) => {
    if (!(control instanceof HTMLElement)) return;
    if (control.getAttribute('type') === 'hidden') return;

    const labels: HTMLElement[] = [];
    if (control.id && typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
      labels.push(...document.querySelectorAll<HTMLElement>(`label[for="${CSS.escape(control.id)}"]`));
    }
    const wrappingLabel = control.closest('label');
    if (wrappingLabel) labels.push(wrappingLabel);

    const isRequired = control.hasAttribute('required');
    if (isRequired) control.setAttribute('aria-required', 'true');
    else control.removeAttribute('aria-required');

    labels.forEach((label) => {
      label.classList.toggle('field-label--required', isRequired);
      const markerHost = getRequiredMarkerHost(label, control);
      const markers = Array.from(label.querySelectorAll<HTMLElement>('.required-marker'));
      let marker = markers.find((item) => item.parentElement === markerHost);
      markers.forEach((item) => {
        if (!isRequired || item !== marker) item.remove();
      });
      if (isRequired && !marker) {
        marker = document.createElement('span');
        marker.className = 'required-marker';
        marker.setAttribute('aria-hidden', 'true');
        marker.textContent = '*';
        markerHost.appendChild(marker);
      }
    });
  });
}

export function createToastManager(root: HTMLElement | null | undefined): ToastManager {
  const removeToast = (toast) => {
    if (!(toast instanceof HTMLElement) || toast.dataset.leaving === 'true') return;
    toast.dataset.leaving = 'true';
    toast.classList.remove('is-visible');
    toast.classList.add('is-leaving');
    window.setTimeout(() => toast.remove(), 180);
  };

  return {
    show({ title, message, variant = 'info' }) {
      if (!root) return;
      const toast = document.createElement('article');
      toast.className = 'toast';
      toast.dataset.variant = variant;
      toast.setAttribute('role', variant === 'danger' ? 'alert' : 'status');
      toast.innerHTML = [
        '<button class="toast__dismiss" type="button" aria-label="Dismiss notification">×</button>',
        '<div class="toast__title"></div>',
        '<div class="toast__text"></div>',
      ].join('');
      toast.querySelector('.toast__title')!.textContent = title || 'Notice';
      toast.querySelector('.toast__text')!.textContent = message || '';
      toast.querySelector('.toast__dismiss')?.addEventListener('click', () => removeToast(toast));
      root.appendChild(toast);
      window.requestAnimationFrame(() => toast.classList.add('is-visible'));
      window.setTimeout(() => removeToast(toast), 4200);
    },
  };
}

const WORKSPACE_NOTIFICATION_ROOM = 'ui:workspace:notifications';
const UPCOMING_TOAST_STORAGE_KEY = 'gss:workspace:shown-upcoming-accommodation-toasts';

function normalizeStatus(value: unknown) {
  return String(value || '')
    .trim()
    .toLowerCase();
}

function isRentStatus(value: unknown) {
  return ['rented', 'long_term'].includes(normalizeStatus(value));
}

function isLateStatus(value: unknown) {
  return normalizeStatus(value) === 'late';
}

function isLaundryOverdueStatus(value: unknown) {
  return normalizeStatus(value) === 'overdue';
}

function isCurrentCampPayload(payload: WorkspacePayload = {}, pageData: WorkspacePageData = {}) {
  const changedCampId = String(payload?.campId || '');
  const currentCampId = String(pageData?.campId || pageData?.currentCampId || '');
  return !changedCampId || !currentCampId || changedCampId === currentCampId;
}

function getCurrentCampId(pageData: WorkspacePageData = {}) {
  const dynamicCampId =
    typeof pageData.currentCampId === 'function'
      ? pageData.currentCampId()
      : pageData.currentCampId;
  return String(
    dynamicCampId || pageData.campId || document.body?.dataset?.currentCampId || '',
  ).trim();
}

function normalizeUpcomingList(value: unknown) {
  return Array.isArray(value)
    ? value
        .filter(Boolean)
        .map((item) => String(item).trim())
        .filter(Boolean)
    : [];
}

function buildUpcomingToastMessage(list: unknown, fallback: string) {
  const items = normalizeUpcomingList(list);
  if (items.length === 0) return fallback;
  const visibleItems = items.slice(0, 3);
  const suffix =
    items.length > visibleItems.length ? ` +${items.length - visibleItems.length} more` : '';
  return `${visibleItems.join('; ')}${suffix}`;
}

function readShownUpcomingToastKeys() {
  try {
    const rawValue = window.sessionStorage?.getItem(UPCOMING_TOAST_STORAGE_KEY);
    const keys = JSON.parse(rawValue || '[]');
    return Array.isArray(keys) ? keys.map((key) => String(key)).filter(Boolean) : [];
  } catch {
    return [];
  }
}

function writeShownUpcomingToastKeys(keys: Iterable<string>) {
  try {
    window.sessionStorage?.setItem(UPCOMING_TOAST_STORAGE_KEY, JSON.stringify([...keys]));
  } catch {
    // Session storage can be unavailable in private browsing or strict browser settings.
  }
}

export function bindUpcomingAccommodationToasts({
  toast,
  pageData = {},
  fetchImpl = window.fetch,
}: { toast?: ToastManager; pageData?: WorkspacePageData; fetchImpl?: typeof window.fetch } = {}) {
  if (!toast || typeof fetchImpl !== 'function') return () => {};

  const shownNotifications = new Set(readShownUpcomingToastKeys());
  let lastNotificationKey = '';
  let isDisposed = false;
  let activeController: AbortController | null = null;

  function showUpcomingToastOnce({ campId, type, list, fallback, title }) {
    const normalizedList = normalizeUpcomingList(list);
    const key = [campId, type, normalizedList.join('|') || 'fallback'].join('::');
    if (shownNotifications.has(key)) return;

    shownNotifications.add(key);
    writeShownUpcomingToastKeys(shownNotifications);
    toast.show({
      title,
      message: buildUpcomingToastMessage(normalizedList, fallback),
      variant: 'warning',
    });
  }

  async function checkUpcomingActions({ force = false } = {}) {
    const campId = getCurrentCampId(pageData);
    if (!campId) return;

    activeController?.abort();
    activeController = new AbortController();

    let body = null;
    try {
      const response = await fetchImpl('/web/accommodation/upcoming-summary', {
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
        signal: activeController.signal,
      });
      if (!response.ok) return;
      body = await response.json();
    } catch (error) {
      if (error?.name !== 'AbortError') return;
      return;
    }

    if (isDisposed) return;

    const accommodationList = normalizeUpcomingList(body?.accommodationList);
    const releaseList = normalizeUpcomingList(body?.releaseList);
    const notificationKey = [campId, accommodationList.join('|'), releaseList.join('|')].join('::');
    if (!force && notificationKey === lastNotificationKey) return;
    lastNotificationKey = notificationKey;

    if (body?.isAccommodation || accommodationList.length > 0) {
      showUpcomingToastOnce({
        campId,
        type: 'accommodation',
        title: 'Upcoming accommodation',
        list: accommodationList,
        fallback: 'There is at least one soldier with an upcoming accommodation.',
      });
    }

    if (body?.isRelease || releaseList.length > 0) {
      showUpcomingToastOnce({
        campId,
        type: 'release',
        title: 'Upcoming release',
        list: releaseList,
        fallback: 'There is at least one soldier with an upcoming release.',
      });
    }
  }

  window.setTimeout(() => void checkUpcomingActions({ force: true }), 250);

  const handleCampChanged = () => {
    lastNotificationKey = '';
    void checkUpcomingActions({ force: true });
  };

  document.addEventListener('gss:camp-context-changed', handleCampChanged);

  return () => {
    isDisposed = true;
    activeController?.abort();
    document.removeEventListener('gss:camp-context-changed', handleCampChanged);
  };
}

export function bindLateBicycleToast({
  socket,
  roomManager,
  toast,
  pageData = {},
}: {
  socket?: any;
  roomManager?: any;
  toast?: ToastManager;
  pageData?: WorkspacePageData;
} = {}) {
  if (!socket || typeof socket.on !== 'function' || !roomManager || !toast) return () => {};

  const shownNotifications = new Set();

  const subscribe = () => {
    void roomManager.subscribe([WORKSPACE_NOTIFICATION_ROOM]);
  };

  const handleLaundryOverdue = (payload: WorkspacePayload = {}) => {
    if (!isCurrentCampPayload(payload, pageData)) return;
    const status = payload?.status || payload?.newStatus || payload?.toStatus;
    if (!isLaundryOverdueStatus(status)) return;

    const identifier = String(payload?.identifier || payload?.bagId || payload?.id || '');
    const bagCode = payload?.bagCode || payload?.code || 'Laundry bag';
    const soldierName = payload?.soldierName || '';
    const key = `laundry:${identifier || bagCode}|${payload?.dateDropOff || payload?.overdueSince || ''}`;
    if (shownNotifications.has(key)) return;
    shownNotifications.add(key);

    toast.show({
      title: 'Laundry bag is overdue',
      message:
        payload?.message || `${bagCode} is overdue${soldierName ? ` for ${soldierName}` : ''}.`,
      variant: 'warning',
    });
  };

  const handleStatusChanged = (payload: WorkspacePayload = {}) => {
    if (!isCurrentCampPayload(payload, pageData)) return;
    const previousStatus = payload?.previousStatus || payload?.oldStatus || payload?.fromStatus;
    const status = payload?.status || payload?.newStatus || payload?.toStatus;
    if (!isRentStatus(previousStatus) || !isLateStatus(status)) return;

    const identifier = String(payload?.identifier || payload?.bicycleId || payload?.id || '');
    const bicycleName = payload?.bicycleName || payload?.name || 'Bicycle';
    const soldierName = payload?.soldierName || '';
    const key = `${identifier || bicycleName}|${payload?.rentedAt || ''}`;
    if (shownNotifications.has(key)) return;
    shownNotifications.add(key);

    toast.show({
      title: 'Bike is late',
      message: `${bicycleName} is now late${soldierName ? ` for ${soldierName}` : ''}.`,
      variant: 'warning',
    });
  };

  subscribe();
  socket.on('connect', subscribe);
  socket.on('bicycle:status:changed', handleStatusChanged);
  socket.on('laundry:overdue', handleLaundryOverdue);

  return () => {
    if (typeof socket.off === 'function') {
      socket.off('connect', subscribe);
      socket.off('bicycle:status:changed', handleStatusChanged);
      socket.off('laundry:overdue', handleLaundryOverdue);
    }
    void roomManager.unsubscribe([WORKSPACE_NOTIFICATION_ROOM]);
  };
}

export function syncTabPanels({
  activeTab,
  tabButtons = [],
  tabPanels = [],
}: {
  activeTab?: string;
  tabButtons?: HTMLElement[];
  tabPanels?: HTMLElement[];
} = {}) {
  tabButtons.forEach((button) => {
    const active = button.dataset.tabTrigger === activeTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', active ? 'true' : 'false');
    button.tabIndex = active ? 0 : -1;
  });

  tabPanels.forEach((panel) => {
    const active = panel.dataset.tabPanel === activeTab;
    panel.hidden = !active;
    panel.classList.toggle('is-active', active);
  });
}

export function initWorkspacePage() {
  initThemeToggle();
  syncRequiredFieldLabels();

  const requiredObserver = new MutationObserver((mutations) => {
    const shouldSync = mutations.some(
      (mutation) => mutation.type === 'attributes' && mutation.attributeName === 'required',
    );
    if (shouldSync) syncRequiredFieldLabels();
  });
  requiredObserver.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ['required'],
  });

  const body = document.body;
  const nav = document.querySelector('[data-workspace-nav]');
  const menuToggle = document.querySelector('[data-workspace-menu-toggle]');
  const desktopMedia = window.matchMedia('(min-width: 1080px)');

  if (!body || !nav || !menuToggle) return;

  const closeNav = () => {
    body.classList.remove('workspace-nav-open');
    menuToggle.setAttribute('aria-expanded', 'false');
  };

  const openNav = () => {
    body.classList.add('workspace-nav-open');
    menuToggle.setAttribute('aria-expanded', 'true');
    document.dispatchEvent(new CustomEvent('workspace:navigation-open'));
  };

  menuToggle.addEventListener('click', () => {
    if (body.classList.contains('workspace-nav-open')) closeNav();
    else openNav();
  });

  nav.addEventListener('click', (event) => {
    if (desktopMedia.matches) return;
    const target = event.target;
    if (target instanceof Element && target.closest('.nav-pill')) closeNav();
  });

  document.addEventListener('click', (event) => {
    if (desktopMedia.matches || !body.classList.contains('workspace-nav-open')) return;
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest('[data-workspace-topbar]')) return;
    closeNav();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeNav();
  });

  const syncForViewport = () => {
    if (desktopMedia.matches) closeNav();
  };

  if (typeof desktopMedia.addEventListener === 'function')
    desktopMedia.addEventListener('change', syncForViewport);
  else if (typeof desktopMedia.addListener === 'function')
    desktopMedia.addListener(syncForViewport);

  syncForViewport();
}
