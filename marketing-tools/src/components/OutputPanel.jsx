import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, Check, Download, RefreshCw } from 'lucide-react';

export default function OutputPanel({ content, isLoading, skillName, onRunAgain }) {
  const [copied, setCopied] = useState(false);

  const timestamp = new Date().toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  const handleCopy = async () => {
    if (!content) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    if (!content) return;
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${skillName?.replace(/\s+/g, '-').toLowerCase() || 'output'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="card p-0 overflow-hidden">
      {/* Header */}
      <div
        className="flex items-center justify-between px-5 py-3"
        style={{ borderBottom: '1px solid rgba(6,182,212,0.12)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-accent" />
          <span className="text-sm font-semibold text-text">{skillName || 'Output'}</span>
        </div>
        <span className="text-xs text-text-muted">{timestamp}</span>
      </div>

      {/* Content area */}
      <div className="px-5 py-4 min-h-[200px]">
        {isLoading ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-4 h-4 rounded-full border-2 border-accent border-t-transparent animate-spin" />
              <span className="text-sm text-accent">Generating recommendations...</span>
            </div>
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-5/6" />
            <div className="skeleton h-4 w-4/6" />
            <div className="skeleton h-4 w-full" />
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-4 w-5/6" />
            <div className="skeleton h-4 w-2/3" />
          </div>
        ) : content ? (
          <div className="markdown-output">
            <ReactMarkdown>{content}</ReactMarkdown>
          </div>
        ) : null}
      </div>

      {/* Bottom action bar */}
      {content && !isLoading && (
        <div
          className="flex items-center gap-2 px-5 py-3"
          style={{ borderTop: '1px solid rgba(6,182,212,0.12)' }}
        >
          <button onClick={handleCopy} className="btn-secondary flex items-center gap-2 text-sm">
            {copied ? (
              <>
                <Check size={14} className="text-emerald" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy size={14} />
                <span>Copy</span>
              </>
            )}
          </button>

          <button onClick={handleDownload} className="btn-secondary flex items-center gap-2 text-sm">
            <Download size={14} />
            <span>Download .md</span>
          </button>

          {onRunAgain && (
            <button onClick={onRunAgain} className="btn-secondary flex items-center gap-2 text-sm ml-auto">
              <RefreshCw size={14} />
              <span>Run Again</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
