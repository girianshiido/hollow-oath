type UpdateState = 'idle' | 'checking' | 'ready' | 'applying' | 'reload';

const enabled = import.meta.env.PROD && location.protocol !== 'file:' && 'serviceWorker' in navigator;
const worker = enabled ? navigator.serviceWorker : undefined;
const registration = worker?.register('./sw.js', {updateViaCache: 'none'});
let state: UpdateState = 'idle';
let message = '';
let applyTimer = 0;
let controlled = Boolean(worker?.controller);
let activeRegistration: ServiceWorkerRegistration | undefined;

function show(next: UpdateState, text: string): void {
  state = next;
  message = text;
  renderUpdates();
}

export function renderUpdates(): void {
  const button = document.querySelector<HTMLButtonElement>('#update-game');
  if (!button) return;
  button.hidden = !enabled;
  button.disabled = state === 'checking' || state === 'applying';
  const label = state === 'ready' ? 'Install update' : state === 'reload' ? 'Reload updated game' :
    state === 'checking' ? 'Checking…' : state === 'applying' ? 'Installing…' : 'Check for updates';
  button.querySelector('span')!.textContent = label;
  document.querySelector('#update-status')!.textContent = message;
}

registration?.then(async value => {
  activeRegistration = value;
  await worker!.ready;
  setOfflineText('Offline play is ready on this device.');
  if (value.waiting && controlled && state === 'idle') show('ready', 'A new version is ready to install.');
}).catch(() => setOfflineText('Offline download could not complete.'));

let offlineText = location.protocol === 'file:' ? 'This portable edition works offline.' :
  'Offline download is available after the first connected visit.';
function setOfflineText(text: string): void {
  offlineText = text;
  const node = document.querySelector('#offline-state');
  if (node) node.textContent = text;
}
export const offlineStatus = () => offlineText;

worker?.addEventListener('controllerchange', () => {
  if (state === 'applying') {
    clearTimeout(applyTimer);
    location.reload();
  } else if (controlled) {
    show('reload', 'An update was installed in another tab. Reload to use it.');
  }
  controlled = Boolean(worker.controller);
});

function installed(candidate: ServiceWorker): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => finish(new Error('Install timed out')), 60000);
    function finish(error?: Error): void {
      clearTimeout(timer);
      candidate.removeEventListener('statechange', changed);
      if (error) reject(error);
      else resolve();
    }
    function changed(): void {
      if (candidate.state === 'redundant') finish(new Error('Install failed'));
      else if (['installed', 'activating', 'activated'].includes(candidate.state)) finish();
    }
    candidate.addEventListener('statechange', changed);
    changed();
  });
}

export async function updateGame(saveBeforeReload?: () => boolean): Promise<void> {
  if (!registration || state === 'checking' || state === 'applying') return;
  if (state === 'reload' || (state === 'ready' && activeRegistration?.waiting)) {
    if (saveBeforeReload && !saveBeforeReload()) {
      show(state, 'Save unavailable. Export a backup before updating.');
      return;
    }
    if (state === 'reload') {
      location.reload();
      return;
    }
    show('applying', saveBeforeReload ? 'Saved. Switching to the new version…' : 'Switching to the new version…');
    applyTimer = window.setTimeout(() => show('reload', 'Reload to finish switching versions.'), 15000);
    activeRegistration!.waiting!.postMessage({type: 'APPLY_UPDATE'});
    return;
  }

  show('checking', 'Checking for a new version…');
  try {
    const value = await registration;
    const previous = worker!.controller;
    if (!value.waiting && !value.installing) await value.update();
    if (value.installing) await installed(value.installing);
    if (value.waiting) show('ready', 'A new version is ready to install.');
    else if (previous && previous !== worker!.controller) show('reload', 'Reload to use the new version.');
    else show('idle', 'You’re up to date.');
  } catch {
    show('idle', 'Update check failed. Check your connection and try again.');
  }
}
