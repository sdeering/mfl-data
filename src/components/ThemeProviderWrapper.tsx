'use client';

import React from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';

interface ThemeProviderWrapperProps {
  children: React.ReactNode;
}

const ThemeProviderWrapper: React.FC<ThemeProviderWrapperProps> = ({ children }) => {
  return <ThemeProvider>{children}</ThemeProvider>;
};

export default ThemeProviderWrapper;
