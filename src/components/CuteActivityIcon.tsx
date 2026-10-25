import React from 'react';

interface CuteActivityIconProps {
  iconName: string;
  size?: number;
  className?: string;
}

export const CuteActivityIcon: React.FC<CuteActivityIconProps> = ({
  iconName,
  size = 28,
  className = '',
}) => {
  switch (iconName) {
    case 'homework':
    case 'study':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <rect x="8" y="6" width="28" height="36" rx="4" fill="#DBEAFE" stroke="#1E40AF" strokeWidth="3" />
          <path d="M14 15H30M14 23H30M14 31H22" stroke="#1E40AF" strokeWidth="3" strokeLinecap="round" />
          <path d="M31 35L41 25L44 28L34 38L29 39L31 35Z" fill="#FBBF24" stroke="#92400E" strokeWidth="2.5" strokeLinejoin="round" />
        </svg>
      );
    case 'reading':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path d="M6 12C6 10 14 9 24 13C34 9 42 10 42 12V36C42 36 34 34 24 38C14 34 6 36 6 36V12Z" fill="#FEF3C7" stroke="#92400E" strokeWidth="3" strokeLinejoin="round" />
          <path d="M24 13V38" stroke="#92400E" strokeWidth="3" strokeLinecap="round" />
          <circle cx="15" cy="22" r="2" fill="#92400E" />
          <circle cx="33" cy="22" r="2" fill="#92400E" />
          <path d="M21 27C22.5 29 25.5 29 27 27" stroke="#92400E" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'school':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path d="M24 8L42 18V20H6V18L24 8Z" fill="#F87171" stroke="#991B1B" strokeWidth="3" strokeLinejoin="round" />
          <rect x="10" y="20" width="28" height="20" fill="#E0E7FF" stroke="#3730A3" strokeWidth="3" />
          <rect x="20" y="28" width="8" height="12" rx="2" fill="#FBBF24" stroke="#92400E" strokeWidth="2.5" />
          <circle cx="24" cy="15" r="3" fill="#FEF08A" stroke="#991B1B" strokeWidth="2" />
        </svg>
      );
    case 'sports':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <circle cx="24" cy="24" r="17" fill="#F97316" stroke="#7C2D12" strokeWidth="3" />
          <path d="M9 17C16 21 32 21 39 17M9 31C16 27 32 27 39 31M24 7V41" stroke="#7C2D12" strokeWidth="2.8" strokeLinecap="round" />
        </svg>
      );
    case 'swimming':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <circle cx="28" cy="15" r="6" fill="#FDE68A" stroke="#78350F" strokeWidth="2.8" />
          <path d="M12 27C16 21 23 21 29 25L36 20" stroke="#0369A1" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M6 33C10 30 14 36 18 33C22 30 26 36 30 33C34 30 38 36 42 33" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" />
          <path d="M6 40C10 37 14 43 18 40C22 37 26 43 30 40C34 37 38 43 42 40" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" />
        </svg>
      );
    case 'music':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path d="M18 34V12L38 8V30" stroke="#9D174D" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="13" cy="34" r="6" fill="#F472B6" stroke="#9D174D" strokeWidth="3" />
          <circle cx="33" cy="30" r="6" fill="#F472B6" stroke="#9D174D" strokeWidth="3" />
        </svg>
      );
    case 'art':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path d="M24 7C14 7 6 14.5 6 24C6 33.5 14 41 24 41C27.5 41 30 38.5 30 35.5C30 33.5 28.5 32 28.5 30C28.5 28 30.5 26.5 33 26.5H36C39.5 26.5 42 23.5 42 19.5C42 12.5 34 7 24 7Z" fill="#FCE7F3" stroke="#9D174D" strokeWidth="3" />
          <circle cx="16" cy="18" r="3" fill="#EF4444" />
          <circle cx="24" cy="15" r="3" fill="#3B82F6" />
          <circle cx="32" cy="18" r="3" fill="#10B981" />
          <circle cx="15" cy="27" r="3" fill="#F59E0B" />
        </svg>
      );
    case 'meal':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path d="M10 24H38C38 33 32 39 24 39C16 39 10 33 10 24Z" fill="#FDE68A" stroke="#92400E" strokeWidth="3" />
          <path d="M14 24C14 18 19 15 24 15C29 15 34 18 34 24" fill="#FFFFFF" stroke="#92400E" strokeWidth="3" />
          <path d="M18 10C18 12 20 12 20 14M28 10C28 12 30 12 30 14" stroke="#F59E0B" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'chores':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path d="M24 6V24" stroke="#78350F" strokeWidth="3.5" strokeLinecap="round" />
          <path d="M15 24H33L37 40H11L15 24Z" fill="#FBBF24" stroke="#78350F" strokeWidth="3" strokeLinejoin="round" />
          <path d="M19 32V39M24 32V39M29 32V39" stroke="#78350F" strokeWidth="2.5" strokeLinecap="round" />
        </svg>
      );
    case 'bath':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path d="M8 25H40V31C40 36.5 35.5 41 30 41H18C12.5 41 8 36.5 8 31V25Z" fill="#E0F2FE" stroke="#0369A1" strokeWidth="3" />
          <circle cx="16" cy="18" r="4" fill="#BAE6FD" stroke="#0369A1" strokeWidth="2.5" />
          <circle cx="25" cy="15" r="5" fill="#BAE6FD" stroke="#0369A1" strokeWidth="2.5" />
          <circle cx="33" cy="19" r="3.5" fill="#BAE6FD" stroke="#0369A1" strokeWidth="2.5" />
        </svg>
      );
    case 'game':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <rect x="6" y="15" width="36" height="22" rx="11" fill="#EDE9FE" stroke="#5B21B6" strokeWidth="3" />
          <path d="M16 22V30M12 26H20" stroke="#5B21B6" strokeWidth="3" strokeLinecap="round" />
          <circle cx="31" cy="24" r="2.5" fill="#EC4899" />
          <circle cx="35" cy="28" r="2.5" fill="#3B82F6" />
        </svg>
      );
    case 'family':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path d="M24 39C24 39 8 29 8 17.5C8 12.5 12 9 16.5 9C19.5 9 22.5 11 24 13.5C25.5 11 28.5 9 31.5 9C36 9 40 12.5 40 17.5C40 29 24 39 24 39Z" fill="#F43F5E" stroke="#881337" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      );
    case 'sleep':
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path d="M31 10C22.5 10 16 16.8 16 25.2C16 33.6 22.5 40 31 40C34.5 40 37.8 38.8 40 36.8C33.5 36.2 28.5 30.8 28.5 24C28.5 17.2 33.5 11.8 40 11.2C37.8 9.8 34.5 10 31 10Z" fill="#FDE047" stroke="#854D0E" strokeWidth="3" strokeLinejoin="round" />
          <path d="M10 14H16L10 20H16" stroke="#0284C7" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return (
        <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className}>
          <path d="M24 7L29.1 17.4L40.6 19.1L32.3 27.2L34.2 38.7L24 33.3L13.8 38.7L15.7 27.2L7.4 19.1L18.9 17.4L24 7Z" fill="#FDE047" stroke="#A16207" strokeWidth="3" strokeLinejoin="round" />
        </svg>
      );
  }
};
