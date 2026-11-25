export type ThemeMode = 'dark' | 'light';

export const applyTheme = (theme: ThemeMode) => {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'light') {
    root.classList.add('light');
    root.classList.remove('dark');
    root.setAttribute('data-theme', 'light');
    document.body.classList.add('light');
  } else {
    root.classList.add('dark');
    root.classList.remove('light');
    root.setAttribute('data-theme', 'dark');
    document.body.classList.remove('light');
  }
  try {
    localStorage.setItem('cinetrack_theme', theme);
    window.dispatchEvent(new CustomEvent('cinetrack_theme_changed', { detail: { theme } }));
  } catch {}
};

export const getInitialTheme = (): ThemeMode => {
  if (typeof window === 'undefined') return 'dark';
  try {
    const saved = localStorage.getItem('cinetrack_theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return 'dark';
};
