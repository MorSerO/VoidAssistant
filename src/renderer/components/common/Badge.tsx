import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'accent';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-void-border/30 text-void-secondary',
  success: 'bg-void-success/15 text-void-success',
  warning: 'bg-void-warning/15 text-void-warning',
  error: 'bg-void-error/15 text-void-error',
  accent: 'bg-void-accent/15 text-void-accent',
};

const Badge: React.FC<BadgeProps> = ({ children, variant = 'default', className = '' }) => {
  return (
    <span
      className={`
        inline-flex items-center rounded px-2 py-0.5 text-2xs font-medium
        ${variantClasses[variant]}
        ${className}
      `}
    >
      {children}
    </span>
  );
};

export default Badge;
