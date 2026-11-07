/** Keep the game at its intended scale while preserving menu scrolling and taps. */
export function installGameGestures(): void {
  const cancelZoom = (event: Event) => event.preventDefault();
  for (const type of ['gesturestart', 'gesturechange', 'gestureend', 'dblclick']) {
    document.addEventListener(type, cancelZoom, {passive: false});
  }
  for (const type of ['touchstart', 'touchmove'] as const) {
    document.addEventListener(type, event => {
      if (event.touches.length > 1) event.preventDefault();
    }, {passive: false});
  }
  document.addEventListener('wheel', event => {
    if (event.ctrlKey) event.preventDefault();
  }, {passive: false});
  document.addEventListener('selectstart', event => {
    const target = event.target;
    if (!(target instanceof Element) || !target.closest('input, textarea')) event.preventDefault();
  });
}
