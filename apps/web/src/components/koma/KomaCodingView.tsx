/**
 * KomaCodingView — the ONE agent with a specific architecture.
 *
 * KOMAÏ Coding is the GitHub-connected coding IDE of the OS (see
 * docs/TRD.md §KOMAÏ). This view condenses the KOMA-Coding-Base prototype:
 * a workspace file tree, a live code editor and a real rendered preview of
 * the workspace's index.html — borderless design, JetBrains Mono for code.
 * Coding prompts are sent through the meta-chat dock by addressing
 * « KOMAÏ Coding » as the recipient.
 */
import React, { useMemo, useState } from 'react';
import { FileCode, Monitor, PencilLine } from 'lucide-react';
import { useApp } from '@/contexts/AppContext';
import { Panel, MicroLabel } from '@/components/ui/Glass';
import type { RepoFile } from '@/core/types';

/** Default workspace so the IDE is alive on first load. */
const initialFiles: RepoFile[] = [
  {
    path: 'index.html',
    status: 'original',
    content: `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Workspace KOMAÏ</title>
<style>
  body { font-family: system-ui, sans-serif; display: grid; place-items: center; min-height: 100vh; margin: 0;
         background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%); color: #333; }
  .card { background: rgba(255,255,255,.85); backdrop-filter: blur(10px); border-radius: 24px; padding: 2.5rem;
          box-shadow: 0 10px 30px rgba(0,0,0,.08); text-align: center; max-width: 420px; }
</style>
</head>
<body>
  <div class="card">
    <h1>Workspace KOMAÏ Coding</h1>
    <p>Modifiez ce fichier dans l'éditeur pour rafraîchir l'aperçu en direct.</p>
  </div>
</body>
</html>`,
  },
  {
    path: 'AGENTS.md',
    status: 'original',
    content: `# Règles de développement KOMAÏ
- Icônes lucide-react uniquement, minimalistes.
- Borderless UI : séparation par contrastes, jamais par cadres.
- Flux applicatif vertical descendant.
- Toute application produite suit l'arborescence agentique SOTA (agent/core.py, agent/tools.py…).`,
  },
];

const KomaCodingView: React.FC = () => {
  const { theme, t } = useApp();
  const [files, setFiles] = useState<RepoFile[]>(initialFiles);
  const [selectedPath, setSelectedPath] = useState('index.html');

  const selected = files.find((f) => f.path === selectedPath);
  // The preview iframe always renders the workspace's index.html, sandboxed
  // (no scripts, no same-origin) so edited code cannot touch the host app.
  const previewSrc = useMemo(
    () => files.find((f) => f.path === 'index.html')?.content ?? '',
    [files]
  );

  const updateContent = (content: string) => {
    setFiles((prev) =>
      prev.map((f) => (f.path === selectedPath ? { ...f, content, status: 'modified' } : f))
    );
  };

  return (
    <section aria-label={t.komai} className="w-full max-w-6xl mx-auto px-4 py-6 animate-fade-up">
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* File tree */}
        <Panel className="p-4 lg:col-span-1">
          <MicroLabel className="mb-2">{t.files}</MicroLabel>
          <nav aria-label={t.files}>
            <ul className="space-y-1">
              {files.map((f) => (
                <li key={f.path}>
                  <button
                    onClick={() => setSelectedPath(f.path)}
                    aria-pressed={f.path === selectedPath}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-xl text-left text-xs font-mono transition-colors ${
                      f.path === selectedPath ? theme.iconBg : theme.glassHover
                    } ${theme.primaryText}`}
                  >
                    <FileCode size={13} aria-hidden className={theme.mutedText} />
                    <span className="truncate">{f.path}</span>
                    {f.status === 'modified' && (
                      <span aria-label="modified" className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </Panel>

        {/* Editor */}
        <div className="lg:col-span-2 space-y-1">
          <MicroLabel className="flex items-center gap-1.5">
            <PencilLine size={12} aria-hidden /> {t.editor} — {selectedPath}
          </MicroLabel>
          <textarea
            value={selected?.content ?? ''}
            onChange={(e) => updateContent(e.target.value)}
            aria-label={`${t.editor}: ${selectedPath}`}
            spellCheck={false}
            className={`w-full h-[52vh] resize-none rounded-2xl p-4 font-mono text-xs leading-relaxed outline-none custom-scrollbar ${
              theme.isDark ? 'bg-black/30 text-slate-200' : 'bg-slate-900/90 text-slate-100'
            }`}
          />
        </div>

        {/* Live preview */}
        <div className="lg:col-span-2 space-y-1">
          <MicroLabel className="flex items-center gap-1.5">
            <Monitor size={12} aria-hidden /> {t.preview}
          </MicroLabel>
          <iframe
            title={t.preview}
            sandbox=""
            srcDoc={previewSrc}
            className="w-full h-[52vh] rounded-2xl bg-white shadow-[0_8px_32px_rgba(0,0,0,0.08)]"
          />
        </div>
      </div>
    </section>
  );
};

export default KomaCodingView;
