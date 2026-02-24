import React from 'react';
import logo from './src/assets/FinesVicLogo.jpg';

export const AppIcon = () => (
  <img
    src={logo}
    alt="Fines Victoria"
    style={{
      width: 22,
      height: 22,
      objectFit: 'contain',
      borderRadius: 6,
      background: '#fff8df',
      padding: 1,
      display: 'block',
    }}
  />
);
