import React from 'react';
import { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-xl bg-white border border-[#DCE4EA] shadow-2xs ${className}`}>
      {Icon && (
        <div className="w-14 h-14 rounded-2xl bg-[#EEF6FC] border border-[#D0E5F5] flex items-center justify-center mb-4 text-[#245B84] shadow-inner">
          <Icon className="w-7 h-7" />
        </div>
      )}
      <h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight uppercase font-sans mb-1.5">
        {title}
      </h3>
      <p className="text-xs text-slate-500 max-w-md font-sans mb-5 leading-relaxed">
        {description}
      </p>
      {action && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {action}
        </div>
      )}
    </div>
  );
};
