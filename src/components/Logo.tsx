import React, { useState } from 'react';
import providedLogoUrl from '../assets/images/dayzero_minimal_logo_1792162564407.jpg';

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

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div
        className={`${sizeClasses[size]} rounded-xl overflow-hidden relative shadow-xs ring-1 ring-stone-900/10 dark:ring-stone-100/10 bg-[#1c1917] flex items-center justify-center shrink-0 transition-colors`}
      >
        {!imageError ? (
          <img
            src={providedLogoUrl}
            alt="Day Zero Logo"
            onError={() => setImageError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Pure Vector Mark matching provided 3-ring geometry */
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full p-1"
            fill="none"
          >
            {/* Outer Silver Ring */}
            <circle cx="50" cy="50" r="38" stroke="#b0adaa" strokeWidth="4" />
            {/* Middle Golden Amber Oval */}
            <ellipse cx="50" cy="50" rx="24" ry="34" stroke="#f5b72f" strokeWidth="4.5" />
            {/* Lower Inner Vibrant Green Circle */}
            <circle cx="50" cy="60" r="18" stroke="#68ce3b" strokeWidth="4" />
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
