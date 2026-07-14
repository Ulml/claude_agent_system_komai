/**
 * Minimal, dependency-free Markdown renderer for agent READMEs.
 * Supports headings, bold, inline code, lists and fenced code blocks —
 * exactly what the agent documentation format uses. Content is rendered as
 * React elements (never innerHTML), so it is XSS-safe by construction.
 */
import React from 'react';
import { useApp } from '@/contexts/AppContext';

/** Renders **bold**, `code` and [label](url) links inside one line of text. */
function renderInline(text: string, keyPrefix: string): React.ReactNode[] {
  return text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|`[^`]+`)/g).map((part, i) => {
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) {
      const href = link[2];
      // Only allow safe web schemes (XSS-safe: no javascript: URLs).
      const safe = /^https?:\/\//i.test(href) ? href : '#';
      return (
        <a
          key={`${keyPrefix}-${i}`}
          href={safe}
          target="_blank"
          rel="noopener noreferrer"
          className="underline decoration-dotted underline-offset-2 text-sky-500 hover:text-sky-400 break-words"
        >
          {link[1]}
        </a>
      );
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={`${keyPrefix}-${i}`}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={`${keyPrefix}-${i}`} className="font-mono text-[0.85em] px-1 py-0.5 rounded bg-slate-500/15">
          {part.slice(1, -1)}
        </code>
      );
    }
    return <React.Fragment key={`${keyPrefix}-${i}`}>{part}</React.Fragment>;
  });
}

export const Markdown: React.FC<{ source: string }> = ({ source }) => {
  const { theme } = useApp();
  const blocks: React.ReactNode[] = [];
  const lines = source.split('\n');
  let listBuffer: string[] = [];
  let codeBuffer: string[] | null = null;

  const flushList = (key: string) => {
    if (listBuffer.length === 0) return;
    blocks.push(
      <ul key={key} className={`list-disc pl-5 space-y-1 text-sm leading-relaxed ${theme.secondaryText}`}>
        {listBuffer.map((item, i) => (
          <li key={i}>{renderInline(item, `${key}-${i}`)}</li>
        ))}
      </ul>
    );
    listBuffer = [];
  };

  lines.forEach((line, idx) => {
    const key = `b${idx}`;
    if (codeBuffer !== null) {
      if (line.startsWith('```')) {
        blocks.push(
          <pre
            key={key}
            className={`font-mono text-xs p-4 rounded-2xl overflow-x-auto custom-scrollbar ${
              theme.isDark ? 'bg-black/30 text-slate-200' : 'bg-slate-900/90 text-slate-100'
            }`}
          >
            {codeBuffer.join('\n')}
          </pre>
        );
        codeBuffer = null;
      } else {
        codeBuffer.push(line);
      }
      return;
    }
    if (line.startsWith('```')) {
      flushList(key);
      codeBuffer = [];
      return;
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      listBuffer.push(line.slice(2));
      return;
    }
    flushList(key);
    if (line.startsWith('## ')) {
      blocks.push(
        <h3 key={key} className={`text-sm font-bold uppercase tracking-wide pt-2 ${theme.primaryText}`}>
          {renderInline(line.slice(3), key)}
        </h3>
      );
    } else if (line.startsWith('# ')) {
      blocks.push(
        <h2 key={key} className={`text-lg font-bold tracking-tight ${theme.primaryText}`}>
          {renderInline(line.slice(2), key)}
        </h2>
      );
    } else if (line.trim() !== '') {
      blocks.push(
        <p key={key} className={`text-sm leading-relaxed ${theme.secondaryText}`}>
          {renderInline(line, key)}
        </p>
      );
    }
  });
  flushList('tail');

  return <div className="space-y-3">{blocks}</div>;
};
