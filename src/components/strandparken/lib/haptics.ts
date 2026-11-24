// A light haptic tap, best effort (roadmap Q10). Android Chrome has `navigator.vibrate`. iOS Safari has no vibration
// API, but since iOS 18 toggling an `<input type="checkbox" switch>` through its `<label>` plays the system haptic.
// Neither is guaranteed; the visual lift is the real feedback, so every failure is silent.

let label: HTMLLabelElement | null = null;

function switchLabel(): HTMLLabelElement | null {
  if (label?.isConnected) return label;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.tabIndex = -1;
  input.id = 'sp-haptic-switch';
  input.setAttribute('aria-hidden', 'true');
  label = document.createElement('label');
  label.htmlFor = input.id;
  label.setAttribute('aria-hidden', 'true');
  // Fixed and off-screen, so toggling never scrolls the page; tabIndex -1 keeps it out of the focus order.
  for (const el of [input, label]) {
    el.style.position = 'fixed';
    el.style.left = '-100px';
    el.style.top = '0';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
  }
  label.append(input);
  document.body.append(label);
  return label;
}

const isIos = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function tapHaptic(): void {
  try {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate(10);
      return;
    }
    if (!isIos()) return;
    const active = document.activeElement;
    switchLabel()?.click();
    // Keep focus where it was, in case the browser moved it to the switch.
    if (active instanceof HTMLElement && document.activeElement !== active) active.focus({ preventScroll: true });
  } catch {
    // No haptics on this device.
  }
}
