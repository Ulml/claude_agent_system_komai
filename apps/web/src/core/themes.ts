/**
 * SINGLE SOURCE OF TRUTH — the 7 glassmorphic themes of Template_LM.
 * Inherited from the TemplateLM_1 prototype design system (see docs/DESIGN.md).
 * Components must NEVER hardcode colors: they read the active theme from
 * AppContext, which always points at one of these presets.
 */
import type { ThemeColor } from './types';

/** Class groups shared by all light themes (defined once, spread everywhere). */
const light = {
  isDark: false,
  primaryText: 'text-slate-900',
  secondaryText: 'text-slate-700',
  mutedText: 'text-slate-600',
  glassBg: 'bg-white/50',
  glassBorder: 'border-white/60',
  glassHover: 'hover:bg-white/60',
  iconBg: 'bg-white/50',
};

/** Class groups shared by all dark themes. */
const dark = {
  isDark: true,
  primaryText: 'text-slate-50',
  secondaryText: 'text-slate-300',
  mutedText: 'text-slate-400',
  glassBg: 'bg-slate-950/40',
  glassBorder: 'border-white/10',
  glassHover: 'hover:bg-white/10',
  iconBg: 'bg-white/10',
};

export const themes: ThemeColor[] = [
  {
    name: 'white',
    hex: '#ffffff',
    gradient:
      'radial-gradient(at 0% 0%, #e2e8f0 0, transparent 50%), radial-gradient(at 50% 100%, #f1f5f9 0, transparent 50%)',
    userBubble: 'bg-slate-800 text-white',
    accentBtn: 'bg-slate-800/10 text-slate-800 hover:bg-slate-800/20',
    ...light,
  },
  {
    name: 'cream',
    hex: '#fef3c7',
    gradient:
      'radial-gradient(at 0% 0%, #fde68a 0, transparent 50%), radial-gradient(at 100% 100%, #fff7ed 0, transparent 50%)',
    userBubble: 'bg-amber-700 text-white',
    accentBtn: 'bg-amber-700/10 text-amber-800 hover:bg-amber-700/20',
    ...light,
  },
  {
    name: 'rose',
    hex: '#fce7f3',
    gradient:
      'radial-gradient(at 0% 0%, #fbcfe8 0, transparent 50%), radial-gradient(at 100% 0%, #f9a8d4 0, transparent 50%)',
    userBubble: 'bg-rose-700 text-white',
    accentBtn: 'bg-rose-700/15 text-rose-800 hover:bg-rose-700/25',
    ...light,
  },
  {
    name: 'mint',
    hex: '#dcfce7',
    gradient:
      'radial-gradient(at 0% 0%, #86efac 0, transparent 50%), radial-gradient(at 50% 100%, #bbf7d0 0, transparent 50%)',
    userBubble: 'bg-emerald-700 text-white',
    accentBtn: 'bg-emerald-700/15 text-emerald-800 hover:bg-emerald-700/25',
    ...light,
  },
  {
    name: 'blue',
    hex: '#3b82f6',
    gradient:
      'radial-gradient(at 0% 0%, #93c5fd 0, transparent 50%), radial-gradient(at 100% 100%, #60a5fa 0, transparent 50%)',
    userBubble: 'bg-blue-900 text-white',
    accentBtn: 'bg-blue-900/10 text-blue-900 hover:bg-blue-900/20',
    ...light,
  },
  {
    name: 'midnight',
    hex: '#172554',
    gradient:
      'radial-gradient(at 0% 0%, #1e3a8a 0, transparent 50%), radial-gradient(at 50% 100%, #172554 0, transparent 50%), radial-gradient(at 100% 0%, #0f172a 0, transparent 50%)',
    userBubble: 'bg-indigo-600 text-white',
    accentBtn: 'bg-indigo-500/15 text-indigo-300 hover:bg-indigo-500/25',
    ...dark,
  },
  {
    name: 'black',
    hex: '#000000',
    gradient:
      'radial-gradient(at 50% 0%, #334155 0, transparent 50%), radial-gradient(at 100% 100%, #0f172a 0, transparent 50%)',
    userBubble: 'bg-slate-700 text-white',
    accentBtn: 'bg-slate-700/40 text-slate-300 hover:bg-slate-700/50',
    ...dark,
  },
];

export const defaultTheme = themes[0];
