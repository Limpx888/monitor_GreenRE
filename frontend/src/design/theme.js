import { create } from 'zustand';

/**
 * Theme preference: 'system' | 'light' | 'dark'.
 * The resolved theme is written to <html data-theme>, which tokens.css reads.
 * index.html runs the same logic inline before first paint (no flash).
 */
const STORAGE_KEY = 'gg-theme';
const media = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

function readPref() {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function resolve(pref) {
  if (pref === 'system') return media?.matches ? 'dark' : 'light';
  return pref;
}

function apply(resolved) {
  document.documentElement.dataset.theme = resolved;
}

export const useTheme = create((set, get) => ({
  preference: readPref(),
  resolved: resolve(readPref()),
  setPreference: (preference) => {
    try {
      if (preference === 'system') localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, preference);
    } catch {
      /* storage unavailable (private mode): keep it in memory only */
    }
    const resolved = resolve(preference);
    apply(resolved);
    set({ preference, resolved });
  },
  /** Cycle system -> light -> dark -> system (used by the nav toggle). */
  cycle: () => {
    const order = ['system', 'light', 'dark'];
    const next = order[(order.indexOf(get().preference) + 1) % order.length];
    get().setPreference(next);
  },
}));

// Follow OS changes while the preference is 'system'
media?.addEventListener('change', () => {
  const { preference } = useTheme.getState();
  if (preference !== 'system') return;
  const resolved = resolve('system');
  apply(resolved);
  useTheme.setState({ resolved });
});

apply(useTheme.getState().resolved);
