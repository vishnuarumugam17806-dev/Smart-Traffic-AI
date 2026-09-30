import React from 'react';

export type VigitraLogoVariant =
  | 'full'
  | 'sidebar'
  | 'sidebar-collapsed'
  | 'compact'
  | 'header'
  | 'auth'
  | 'mobile';

export interface VigitraLogoProps {
  variant?: VigitraLogoVariant;
  className?: string;
  imgClassName?: string;
  alt?: string;
  onClick?: () => void;
  title?: string;
}

const OFFICIAL_FULL_LOGO = '/assets/vigitra-ai-logo.png';
const OFFICIAL_MARK_ICON = '/assets/vigitra-ai-icon.png';
const DEFAULT_ALT = 'VIGITRA AI — Smarter Roads, Safer Tomorrow';

export const VigitraLogo: React.FC<VigitraLogoProps> = ({
  variant = 'full',
  className = '',
  imgClassName = '',
  alt = DEFAULT_ALT,
  onClick,
  title
}) => {
  // 1. Sidebar Collapsed / Compact Icon Variant
  if (variant === 'sidebar-collapsed' || variant === 'compact') {
    return (
      <div
        onClick={onClick}
        title={title || 'VIGITRA AI'}
        className={`flex items-center justify-center p-1 rounded-xl bg-[#040B1E] border border-blue-900/40 shadow-sm transition-all hover:border-cyan-500/50 ${
          onClick ? 'cursor-pointer' : ''
        } ${className}`}
      >
        <img
          src={OFFICIAL_MARK_ICON}
          alt={alt}
          className={`w-9 h-9 object-contain rounded-lg shrink-0 ${imgClassName}`}
          loading="eager"
        />
      </div>
    );
  }

  // 2. Desktop Sidebar Variant (Recommended 180px - 220px)
  if (variant === 'sidebar') {
    return (
      <div
        onClick={onClick}
        title={title || 'VIGITRA AI — Smarter Roads, Safer Tomorrow'}
        className={`flex flex-col items-center justify-center w-full max-w-[210px] mx-auto p-2 rounded-xl bg-[#040B1E] border border-blue-900/40 shadow-md transition-all hover:border-cyan-500/40 ${
          onClick ? 'cursor-pointer' : ''
        } ${className}`}
      >
        <img
          src={OFFICIAL_FULL_LOGO}
          alt={alt}
          className={`w-full max-w-[195px] h-auto object-contain rounded select-none ${imgClassName}`}
          loading="eager"
        />
      </div>
    );
  }

  // 3. Top Header Variant (Recommended 140px - 180px)
  if (variant === 'header') {
    return (
      <div
        onClick={onClick}
        title={title || 'VIGITRA AI'}
        className={`flex items-center px-2 py-1 rounded-lg bg-[#040B1E] border border-blue-900/40 shadow-xs max-w-[170px] ${
          onClick ? 'cursor-pointer' : ''
        } ${className}`}
      >
        <img
          src={OFFICIAL_FULL_LOGO}
          alt={alt}
          className={`w-auto h-8 max-w-[160px] object-contain select-none ${imgClassName}`}
          loading="eager"
        />
      </div>
    );
  }

  // 4. Mobile Header / Drawer Variant (Recommended 120px - 150px)
  if (variant === 'mobile') {
    return (
      <div
        onClick={onClick}
        title={title || 'VIGITRA AI'}
        className={`flex items-center px-1.5 py-0.5 rounded-lg bg-[#040B1E] border border-blue-900/40 shadow-xs max-w-[140px] ${
          onClick ? 'cursor-pointer' : ''
        } ${className}`}
      >
        <img
          src={OFFICIAL_FULL_LOGO}
          alt={alt}
          className={`w-auto h-7 max-w-[130px] object-contain select-none ${imgClassName}`}
          loading="eager"
        />
      </div>
    );
  }

  // 5. Authentication / Login Page Variant (Recommended 220px - 300px)
  if (variant === 'auth') {
    return (
      <div
        onClick={onClick}
        title={title || 'VIGITRA AI — Smarter Roads, Safer Tomorrow'}
        className={`flex flex-col items-center justify-center w-full max-w-[260px] mx-auto p-3.5 rounded-2xl bg-[#040B1E] border border-blue-900/50 shadow-xl transition-all ${
          onClick ? 'cursor-pointer' : ''
        } ${className}`}
      >
        <img
          src={OFFICIAL_FULL_LOGO}
          alt={alt}
          className={`w-full max-w-[240px] h-auto object-contain select-none ${imgClassName}`}
          loading="eager"
        />
      </div>
    );
  }

  // 6. Generic / Full Variant
  return (
    <div
      onClick={onClick}
      title={title || 'VIGITRA AI'}
      className={`inline-flex items-center justify-center max-w-full ${
        onClick ? 'cursor-pointer' : ''
      } ${className}`}
    >
      <img
        src={OFFICIAL_FULL_LOGO}
        alt={alt}
        className={`w-auto h-auto max-w-full object-contain ${imgClassName}`}
        loading="eager"
      />
    </div>
  );
};
