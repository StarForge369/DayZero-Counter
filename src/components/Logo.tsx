import React, { useState } from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  showText?: boolean;
}

export const Logo: React.FC<LogoProps> = ({
  size = 'md',
  className = '',
  showText = false,
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-14 h-14',
    xl: 'w-24 h-24',
  };

  const imageSrc = '/src/assets/images/dayzero_minimal_logo_1792162564407.jpg';

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-xl overflow-hidden relative shadow-xs ring-1 ring-stone-900/10 dark:ring-stone-100/10 bg-stone-950 dark:bg-stone-100 text-white dark:text-stone-950 flex items-center justify-center shrink-0 transition-colors`}
      >
        {!imageError ? (
          <img
            src={imageSrc}
            alt="Day Zero Minimal Logo"
            referrerPolicy="no-referrer"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Pure Minimalist SVG Mark */
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full p-1.5"
            fill="none"
            stroke="currentColor"
          >
            <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="6" />
            <line x1="50" y1="10" x2="50" y2="24" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
            <ellipse cx="50" cy="52" rx="16" ry="22" stroke="currentColor" strokeWidth="6" />
          </svg>
        )}
      </div>

      {showText && (
        <div className="flex flex-col leading-none">
          <span className="text-base font-bold tracking-tight text-stone-900 dark:text-stone-100 font-sans">
            Day Zero
          </span>
          <span className="text-[10px] font-mono tracking-widest text-stone-400 dark:text-stone-500 uppercase mt-0.5">
            Days Counter
          </span>
        </div>
      )}
    </div>
  );
};
