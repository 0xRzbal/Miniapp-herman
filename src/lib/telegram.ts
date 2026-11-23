/** Thin wrappers for Telegram Mini App UX primitives (haptics + back button).
 *  Everything degrades silently when running outside Telegram. */

type Haptic = 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'warning';

const tg = () => (window as any).Telegram?.WebApp;

export function haptic(type: Haptic = 'light') {
  try {
    const hf = tg()?.HapticFeedback;
    if (!hf) return;
    if (type === 'success' || type === 'error' || type === 'warning') hf.notificationOccurred(type);
    else hf.impactOccurred(type);
  } catch {}
}

/** Show the native back arrow and run `onBack` for it.
 *  Returns a cleanup that hides the button again. */
export function bindBackButton(onBack: () => void): () => void {
  try {
    const bb = tg()?.BackButton;
    if (!bb) return () => {};
    const handler = () => onBack();
    bb.onClick(handler);
    bb.show();
    return () => {
      try { bb.offClick(handler); bb.hide(); } catch {}
    };
  } catch {
    return () => {};
  }
}
