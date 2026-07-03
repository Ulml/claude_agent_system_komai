/**
 * ProjectModal — creates a project from a name + goal description.
 * On save, the orchestrator decomposes the goal into an end-to-end agent
 * flow (see core/orchestrator.ts) and the app navigates to the FLUX view.
 */
import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';

const ProjectModal: React.FC = () => {
  const { theme, t, isProjectModalOpen, setIsProjectModalOpen, createProject } = useApp();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isProjectModalOpen) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setIsProjectModalOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isProjectModalOpen, setIsProjectModalOpen]);

  if (!isProjectModalOpen) return null;

  const submit = () => {
    if (!title.trim() || !description.trim()) return;
    createProject(title.trim(), description.trim());
    setTitle('');
    setDescription('');
    setIsProjectModalOpen(false);
  };

  const inputClass = `w-full rounded-xl px-3 py-2.5 text-sm bg-transparent border ${theme.glassBorder} ${theme.primaryText} placeholder:opacity-50 outline-none`;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={() => setIsProjectModalOpen(false)}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={t.newProject}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-[2rem] p-6 space-y-4 backdrop-blur-2xl border ${theme.glassBorder} animate-fade-up`}
        style={{ backgroundColor: theme.isDark ? 'rgba(2,6,23,0.85)' : 'rgba(255,255,255,0.85)' }}
      >
        <div className="flex items-center justify-between">
          <h2 className={`text-lg font-bold tracking-tight ${theme.primaryText}`}>{t.newProject}</h2>
          <button
            onClick={() => setIsProjectModalOpen(false)}
            aria-label={t.cancel}
            className={`p-2 rounded-full ${theme.glassHover} ${theme.primaryText}`}
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <label className="block space-y-1">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${theme.mutedText}`}>{t.projectName}</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </label>

        <label className="block space-y-1">
          <span className={`text-[11px] font-bold uppercase tracking-wider ${theme.mutedText}`}>
            {t.projectDescription}
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className={`${inputClass} resize-none`}
          />
        </label>

        <div className="flex justify-end gap-2">
          <button
            onClick={() => setIsProjectModalOpen(false)}
            className={`px-4 min-h-[44px] rounded-full text-sm font-semibold ${theme.secondaryText} ${theme.glassHover}`}
          >
            {t.cancel}
          </button>
          <button
            onClick={submit}
            disabled={!title.trim() || !description.trim()}
            className={`px-5 min-h-[44px] rounded-full text-sm font-semibold ${theme.userBubble} disabled:opacity-40`}
          >
            {t.save}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectModal;
