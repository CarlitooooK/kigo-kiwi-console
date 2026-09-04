// Optional Kigo mini-app bridge.
//
// The host authorization mini-app works 100% standalone against Supabase.
// The bridge is used ONLY for polish when the page runs embedded inside the
// Kigo app (via KigoWebViewScreen): close the mini-app after a decision and
// show a native toast. Everything degrades gracefully in a plain browser.
//
// We import the SDK lazily so the app still loads if the package is absent,
// and we never depend on auth/payments — only navigation/ui niceties.

let kigoRef = null
let triedLoad = false

async function loadKigo() {
  if (triedLoad) return kigoRef
  triedLoad = true
  try {
    const mod = await import('@kigo-dev/marketplace-sdk')
    kigoRef = mod.kigo ?? null
    if (kigoRef?.init) {
      await kigoRef.init({ enableLogging: false })
    }
  } catch {
    // Not running inside Kigo (or SDK not installed) — stay in standalone mode.
    kigoRef = null
  }
  return kigoRef
}

/** True only when the SDK loaded and the native bridge is present. */
export async function isInsideKigo() {
  const k = await loadKigo()
  return !!k
}

/** Native toast when embedded; silent no-op standalone. */
export async function bridgeToast(message, type = 'info') {
  const k = await loadKigo()
  try {
    await k?.ui?.toast?.({ message, type })
  } catch {
    /* ignore */
  }
}

/**
 * Kigo user id of whoever opened the mini-app (the collaborator/host), via the
 * bridge session. Returns null in standalone mode (plain browser) — callers
 * must treat null as "cannot verify identity" and degrade gracefully.
 *
 * This is the second half of host verification: the visit stores the intended
 * host id; this returns the viewer's id; the page compares them.
 */
export async function bridgeAuthUserId() {
  const k = await loadKigo()
  try {
    const session = await k?.auth?.init?.()
    return session?.userId ?? session?.legacyUserId ?? null
  } catch {
    return null
  }
}

/** Closes the mini-app and returns to Kigo. No-op standalone. */
export async function bridgeClose(reason) {
  const k = await loadKigo()
  try {
    await k?.navigation?.close?.(reason ? { reason } : undefined)
  } catch {
    /* ignore */
  }
}
