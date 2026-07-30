import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  highlight?: boolean;
}

const Card: React.FC<CardProps> = ({ children, className = '', onClick, highlight = false }) => {
  return (
    <div
      className={`
        rounded border border-void-border bg-void-surface p-4
        ${highlight ? 'border-void-accent/50 ring-1 ring-void-accent/20' : ''}
        ${onClick ? 'cursor-pointer transition-colors hover:border-void-border/60 hover:bg-void-border/10' : ''}
        ${className}
      `}
      onClick={onClick}
    >
      {children}
    </div>
  );
};

export default Card;
