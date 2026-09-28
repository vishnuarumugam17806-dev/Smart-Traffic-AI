import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  icon: Icon,
  actions,
  children,
  className = ''
}) => {
  const actionItems = actions || children;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 sm:pb-4 border-b border-[#DCE4EA] ${className}`}>
      <div className="space-y-0.5">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="w-5 h-5 text-[#245B84] shrink-0" />}
          <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight font-sans uppercase">
            {title}
          </h1>
          {badge && (
            <div className="shrink-0">
              {badge}
            </div>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-slate-500 font-sans">
            {subtitle}
          </p>
        )}
      </div>

      {actionItems && (
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {actionItems}
        </div>
      )}
    </div>
  );
};
