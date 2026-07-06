/**
 * UI primitives — SINGLE SOURCE OF TRUTH for the glassmorphic look.
 *
 * Every container, micro-label, status pill and code block in the app is
 * built from these four primitives, so the aesthetic (translucency, borders,
 * typography scale) is defined exactly once and follows the active theme.
 */
import React from 'react';
import { useApp } from '@/contexts/AppContext';
import type { TaskStatus } from '@/core/types';

/** Translucent, blurred, theme-aware container — the base building block. */
export const Panel: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className = '',
  children,
  ...rest
}) => {
  const { theme } = useApp();
  return (
    <div
      className={`backdrop-blur-xl ${theme.glassBg} border ${theme.glassBorder} shadow-[0_8px_32px_rgba(0,0,0,0.05)] rounded-3xl ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
};

/** Micro system label: uppercase, tracked, used for section titles. */
export const MicroLabel: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className = '',
}) => {
  const { theme } = useApp();
  return (
    <p className={`text-[11px] font-bold uppercase tracking-wider ${theme.mutedText} ${className}`}>
      {children}
    </p>
  );
};

/** Colored status pill for tasks and agents, with a clear human label. */
export const StatusPill: React.FC<{ status: TaskStatus | 'idle' | 'waiting' | 'working' }> = ({
  status,
}) => {
  const { t } = useApp();
  // Human-readable label (no cryptic "IDLE" — shows "Disponible", etc.).
  const label = (t[`status_${status}`] as string) ?? status;
  // Colors chosen for WCAG AA contrast; the palette flips with theme.isDark
  // because theming is state-driven (not the Tailwind `dark` class).
  const { theme } = useApp();
  const light: Record<string, string> = {
    pending: 'bg-slate-500/15 text-slate-700',
    running: 'bg-blue-600/15 text-blue-800',
    working: 'bg-blue-600/15 text-blue-800',
    done: 'bg-emerald-600/15 text-emerald-800',
    idle: 'bg-slate-500/15 text-slate-700',
    waiting: 'bg-amber-600/15 text-amber-800',
    failed: 'bg-rose-600/15 text-rose-800',
  };
  const dark: Record<string, string> = {
    pending: 'bg-slate-400/20 text-slate-200',
    running: 'bg-blue-400/20 text-blue-200',
    working: 'bg-blue-400/20 text-blue-200',
    done: 'bg-emerald-400/20 text-emerald-200',
    idle: 'bg-slate-400/20 text-slate-200',
    waiting: 'bg-amber-400/20 text-amber-200',
    failed: 'bg-rose-400/20 text-rose-200',
  };
  const styles = theme.isDark ? dark : light;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${styles[status]}`}
    >
      {(status === 'running' || status === 'working') && (
        <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-current animate-pulse-dot" />
      )}
      {label}
    </span>
  );
};

/** Monospace code/log block (JetBrains Mono), horizontally scrollable. */
export const CodeBlock: React.FC<{ children: React.ReactNode; label?: string }> = ({
  children,
  label,
}) => {
  const { theme } = useApp();
  return (
    <div className="space-y-1">
      {label && <MicroLabel>{label}</MicroLabel>}
      <pre
        className={`font-mono text-xs leading-relaxed p-4 rounded-2xl overflow-x-auto custom-scrollbar ${
          theme.isDark ? 'bg-black/30 text-slate-200' : 'bg-slate-900/90 text-slate-100'
        }`}
      >
        {children}
      </pre>
    </div>
  );
};
