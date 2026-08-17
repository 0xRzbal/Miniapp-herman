import React from 'react';
import { ICONS } from '../config';

export type IconName = keyof typeof ICONS;

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: React.CSSProperties;
}

export default function Icon({ name, size = 20, color = 'currentColor', style }: IconProps) {
  const path = ICONS[name];
  if (!path) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} style={{ flexShrink: 0, ...style }}>
      <path d={path} />
    </svg>
  );
}
