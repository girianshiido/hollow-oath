interface InstallPrompt extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{outcome: 'accepted' | 'dismissed'}>;
}
export type InstallResult = 'guide' | 'accepted' | 'dismissed' | 'failed' | 'busy' | 'installed';
let deferred: InstallPrompt | undefined;
let prompting = false;
let installed = false;
const standalone = matchMedia('(display-mode: standalone)');
const fullscreen = matchMedia('(display-mode: fullscreen)');
const isInstalled = () => installed || standalone.matches || fullscreen.matches ||
  Boolean((navigator as Navigator & {standalone?: boolean}).standalone);
const webEdition = () => location.protocol !== 'file:';

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  deferred = event as InstallPrompt;
  renderInstall();
});
window.addEventListener('appinstalled', () => {
  installed = true;
  deferred = undefined;
  renderInstall();
});
standalone.addEventListener('change', renderInstall);
fullscreen.addEventListener('change', renderInstall);

export function renderInstall(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('button[data-action="install"]')) {
    button.hidden = !webEdition() || isInstalled() || (button.hasAttribute('data-install-prompt-only') && !deferred);
    button.disabled = prompting;
    const label = button.querySelector('span');
    if (label) label.textContent = prompting ? 'Opening…' : button.hasAttribute('data-install-prompt-only') ? 'Install now' : 'Install game';
  }
}

export async function requestInstall(): Promise<InstallResult> {
  if (isInstalled()) return 'installed';
  if (prompting) return 'busy';
  const candidate = deferred;
  if (!candidate || !webEdition()) return 'guide';
  deferred = undefined;
  prompting = true;
  renderInstall();
  try {
    // Invoke synchronously from the button click, before any await loses user activation.
    await candidate.prompt();
    const choice = await candidate.userChoice;
    return choice.outcome;
  } catch {
    return 'failed';
  } finally {
    prompting = false;
    renderInstall();
  }
}

export function installInstructions(): {heading: string; steps: string[]; note: string} {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (ios) return {
    heading: 'Install on iPhone or iPad',
    steps: ['Open this page in Safari.', 'Tap Share (the square with an upward arrow).', 'Choose Add to Home Screen. If shown, enable Open as Web App.', 'Tap Add, then launch Hollow Oath from its new Home Screen icon.'],
    note: 'If Add to Home Screen is missing, scroll down the Share menu and check Edit Actions. Installation uses Safari’s menu.'
  };
  if (/Android/i.test(navigator.userAgent)) return {
    heading: 'Install on Android',
    steps: ['Open this page in Chrome. If it is inside another app, choose Open in Chrome first.', 'Open Chrome’s ⋮ menu.', 'Choose Install and create shortcut, then Install. Some versions call this Add to Home screen or Install app.', 'Launch Hollow Oath from the new icon.'],
    note: 'If the installation dialog is not offered yet, stay on this page for a moment and try again. The browser controls when installation is available.'
  };
  return {
    heading: 'Install Hollow Oath',
    steps: ['Open this page in Chrome or Edge.', 'Use the install icon in the address bar, or choose Install from the browser menu.', 'On Android, use Chrome’s ⋮ menu → Install and create shortcut → Install (or Add to Home screen on older versions).', 'On iPhone or iPad, use Safari → Share → Add to Home Screen.'],
    note: 'The app opens in its own window. Offline play becomes available after the first download finishes.'
  };
}
