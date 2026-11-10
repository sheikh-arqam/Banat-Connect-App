export interface Settings {
  /** True = camera stays OFF when joining a live class (privacy default). */
  cameraOffByDefault: boolean
  /** True = mic stays muted when joining a live class (privacy default). */
  micMutedOnJoin: boolean
  /** True = first names are shown. False = names are hidden and only the role is shown. */
  showFirstNames: boolean
  /** True = seen ticks (✓✓) are shown and updated. False = no ticks at all. */
  readReceipts: boolean
  /** True = the in-app announcements summary is shown on the Dashboard. */
  inAppNotifications: boolean
}

export const DEFAULT_SETTINGS: Settings = {
  cameraOffByDefault: true,
  micMutedOnJoin: true,
  showFirstNames: true,
  readReceipts: true,
  inAppNotifications: true,
}

const KEY = 'female-classes-settings-v1'

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    /* fall through to defaults */
  }
  return { ...DEFAULT_SETTINGS }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* settings are a small object; ignore a storage failure rather than breaking the app */
  }
}

export function resetSettings() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}
