import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'white' | 'gray';
  text?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  color = 'primary', 
  text,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8'
  };

  const colorClasses = {
    primary: 'border-[#39ff14]',
    white: 'border-white',
    gray: 'border-gray-400'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg'
  };

  return (
    <div className={`flex items-center justify-center gap-3 ${className}`}>
      <div className="relative">
        <div 
          className={`${sizeClasses[size]} border-2 ${colorClasses[color]} border-t-transparent rounded-full animate-spin`}
        />
        <div 
          className={`absolute inset-0 ${sizeClasses[size]} border-2 ${colorClasses[color]}/30 rounded-full animate-pulse`}
        />
      </div>
      {text && (
        <span className={`${textSizeClasses[size]} ${color === 'white' ? 'text-white' : color === 'gray' ? 'text-gray-400' : 'text-[#39ff14]'} font-medium`}>
          {text}
        </span>
      )}
    </div>
  );
};

export default LoadingSpinner;