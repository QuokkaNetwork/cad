import React from 'react';
import logo from './src/assets/vicroads-logo.png';

export const AppIcon = () => (
  <img
    src={logo}
    alt="VicRoads"
    style={{
      width: 22,
      height: 22,
      objectFit: 'contain',
      borderRadius: 4,
      background: '#ffffff',
      padding: 1,
      display: 'block',
    }}
  />
);
