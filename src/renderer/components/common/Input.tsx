import React from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

const Input: React.FC<InputProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-void-secondary">{label}</label>
      )}
      <input
        className={`
          w-full rounded border border-void-border bg-void-bg px-3 py-2
          text-sm text-void-text placeholder:text-void-border
          transition-colors focus:border-void-accent focus:outline-none
          ${error ? 'border-void-error' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <span className="text-xs text-void-error">{error}</span>
      )}
    </div>
  );
};

export default Input;

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const Textarea: React.FC<TextareaProps> = ({ label, error, className = '', ...props }) => {
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label className="text-xs font-medium text-void-secondary">{label}</label>
      )}
      <textarea
        className={`
          w-full resize-none rounded border border-void-border bg-void-bg px-3 py-2
          text-sm text-void-text placeholder:text-void-border
          transition-colors focus:border-void-accent focus:outline-none
          ${error ? 'border-void-error' : ''}
          ${className}
        `}
        {...props}
      />
      {error && (
        <span className="text-xs text-void-error">{error}</span>
      )}
    </div>
  );
};
