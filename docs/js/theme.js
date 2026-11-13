// Per-technique colour themes and icons. Card gradients keep white text at WCAG AA (≥4.5:1) at both ends.
export const THEME = {
  cyclic_sigh: { from: '#0F766E', to: '#1E40AF', accent: '#5EEAD4', aurora: ['#14B8A6', '#3B82F6', '#22D3EE', '#2DD4BF'], icon: 'sigh' },
  box: { from: '#6D28D9', to: '#1E3A8A', accent: '#C4B5FD', aurora: ['#8B5CF6', '#3B82F6', '#A855F7', '#6366F1'], icon: 'box' },
  extended_exhale: { from: '#BE123C', to: '#9A3412', accent: '#FDBA74', aurora: ['#F43F5E', '#F97316', '#FB7185', '#F59E0B'], icon: 'exhale' },
  resonance: { from: '#0E7490', to: '#047857', accent: '#67E8F9', aurora: ['#06B6D4', '#10B981', '#22D3EE', '#34D399'], icon: 'wave' },
  478: { from: '#4338CA', to: '#312E81', accent: '#A5B4FC', aurora: ['#6366F1', '#8B5CF6', '#3730A3', '#A78BFA'], icon: 'moon' },
  sigh_reset: { from: '#0369A1', to: '#6D28D9', accent: '#7DD3FC', aurora: ['#0EA5E9', '#8B5CF6', '#38BDF8', '#A78BFA'], icon: 'spark' },
  cyclic_hyper: { from: '#C2410C', to: '#B91C1C', accent: '#FDBA74', aurora: ['#F97316', '#EF4444', '#F59E0B', '#FB7185'], icon: 'bolt' },
};
const PATHS = {
  sigh: '<path d="M2 17c2 0 3-7 5.5-7S9 13 10.5 13 12 8 14 8s3 9 8 9"/>',
  box: '<rect x="5" y="5" width="14" height="14" rx="1.5"/><circle cx="5" cy="12" r="1.8" class="dot"/>',
  exhale: '<path d="M3 7c2.5 0 3 10 6 10s5-5 12-5"/><path d="M3 7v0"/>',
  wave: '<path d="M2 12c2.5-6.5 5-6.5 7.5 0s5 6.5 7.5 0 3.5-4 5-4"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>',
  spark: '<path d="M12 3v5M12 16v5M3 12h5M16 12h5M6 6l2.8 2.8M15.2 15.2 18 18M6 18l2.8-2.8M15.2 8.8 18 6"/>',
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
};
export const icon = (name) => `<svg class="ticon" viewBox="0 0 24 24" aria-hidden="true">${PATHS[name] || ''}</svg>`;
export const themeOf = (id) => THEME[id] || THEME.cyclic_sigh;
