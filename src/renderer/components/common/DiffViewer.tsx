import React from 'react';
import type { EditProposal } from '../../../shared/types';
import Button from './Button';

interface DiffViewerProps {
  proposal: EditProposal;
  onApply: () => void;
  onReject: () => void;
  isApplying?: boolean;
}

const DiffViewer: React.FC<DiffViewerProps> = ({ proposal, onApply, onReject, isApplying = false }) => {
  // Simple unified diff display
  const diffLines = proposal.diff.split('\n');

  return (
    <div className="my-2 rounded border border-void-border bg-void-bg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-void-border bg-void-surface px-3 py-2">
        <span className="text-xs text-void-secondary truncate flex-1">
          Edit: {proposal.filePath.split(/[\\/]/).pop()}
        </span>
        <div className="flex gap-2 ml-3">
          <Button variant="ghost" size="sm" onClick={onReject} disabled={isApplying}>
            Reject
          </Button>
          <Button variant="primary" size="sm" onClick={onApply} isLoading={isApplying}>
            Apply
          </Button>
        </div>
      </div>

      {/* Side-by-side diff */}
      <div className="flex max-h-64 overflow-y-auto">
        {/* Original (Left) */}
        <div className="flex-1 border-r border-void-border">
          <div className="px-3 py-1 text-2xs uppercase tracking-wider text-void-secondary border-b border-void-border bg-void-surface">
            Original
          </div>
          <pre className="p-3 text-xs font-mono text-void-text whitespace-pre-wrap">
            {proposal.originalContent || '(empty file)'}
          </pre>
        </div>
        {/* Proposed (Right) */}
        <div className="flex-1">
          <div className="px-3 py-1 text-2xs uppercase tracking-wider text-void-accent border-b border-void-border bg-void-surface">
            Proposed
          </div>
          <pre className="p-3 text-xs font-mono text-void-text whitespace-pre-wrap">
            {proposal.newContent}
          </pre>
        </div>
      </div>

      {/* Unified diff view (collapsible) */}
      <details className="border-t border-void-border">
        <summary className="px-3 py-1.5 text-2xs text-void-secondary cursor-pointer hover:text-void-text bg-void-surface">
          Show unified diff
        </summary>
        <pre className="p-3 text-xs font-mono max-h-48 overflow-y-auto text-void-text whitespace-pre-wrap">
          {diffLines.map((line, i) => {
            let colorClass = 'text-void-secondary';
            if (line.startsWith('+')) colorClass = 'text-void-success';
            else if (line.startsWith('-')) colorClass = 'text-void-error';
            else if (line.startsWith('@@')) colorClass = 'text-void-accent';
            return (
              <div key={i} className={colorClass}>
                {line}
              </div>
            );
          })}
        </pre>
      </details>
    </div>
  );
};

export default DiffViewer;
