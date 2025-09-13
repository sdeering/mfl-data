"use client";

import React, { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';

interface WalletConnectProps {
  className?: string;
  variant?: 'default' | 'minimal';
  size?: 'sm' | 'md' | 'lg';
}

const WalletConnect: React.FC<WalletConnectProps> = ({ 
  className = '', 
  variant = 'default',
  size = 'md' 
}) => {
  const { isConnected, account, connectWallet, disconnectWallet, isLoading, error } = useWallet();
  const [showDropdown, setShowDropdown] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return 'px-3 py-1.5 text-sm';
      case 'lg':
        return 'px-6 py-3 text-lg';
      default:
        return 'px-4 py-2 text-base';
    }
  };

  const getVariantClasses = () => {
    if (variant === 'minimal') {
      return isConnected 
        ? 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400'
        : 'text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400';
    }
    
    return isConnected
      ? 'bg-green-600 hover:bg-green-700 text-white'
      : 'bg-blue-600 hover:bg-blue-700 text-white';
  };

  const handleConnect = async () => {
      try {
        await connectWallet();
      } catch (error) {
        console.error('Dapper wallet connection failed:', error);
      }
  };

  const handleDisconnect = () => {
    disconnectWallet();
    setShowDropdown(false);
  };

  if (isConnected && account) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className={`${getSizeClasses()} ${getVariantClasses()} rounded-lg transition-all duration-200 cursor-pointer flex items-center space-x-2 hover:scale-105 hover:shadow-lg ${className}`}
        >
          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM2.273 8.625A4.483 4.483 0 0 1 5.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 6H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z"></path>
          </svg>
          <span className="hidden sm:inline">{formatAddress(account)}</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showDropdown && (
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <p className="text-sm text-gray-600 dark:text-gray-400">Connected as</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white break-all">{account}</p>
            </div>
            <div className="p-1">
              <button
                onClick={handleDisconnect}
                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
              >
                Disconnect
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isLoading}
      className={`${getSizeClasses()} ${getVariantClasses()} rounded-lg transition-all duration-200 cursor-pointer flex items-center space-x-2 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      {isLoading ? (
        <>
          <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="hidden sm:inline">Connecting...</span>
        </>
      ) : (
        <>
          <svg className="w-4 h-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M2.273 5.625A4.483 4.483 0 0 1 5.25 4.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 3H5.25a3 3 0 0 0-2.977 2.625ZM2.273 8.625A4.483 4.483 0 0 1 5.25 7.5h13.5c1.141 0 2.183.425 2.977 1.125A3 3 0 0 0 18.75 6H5.25a3 3 0 0 0-2.977 2.625ZM5.25 9a3 3 0 0 0-3 3v6a3 3 0 0 0 3 3h13.5a3 3 0 0 0 3-3v-6a3 3 0 0 0-3-3H15a.75.75 0 0 0-.75.75 2.25 2.25 0 0 1-4.5 0A.75.75 0 0 0 9 9H5.25Z"></path>
          </svg>
          <span className="hidden sm:inline">Connect Wallet</span>
        </>
      )}
    </button>
  );
};

export default WalletConnect;
