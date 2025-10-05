'use client';

import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="py-6">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center text-sm text-gray-600 dark:text-gray-400">
          <p>
            MFLData.com is completely free to use app developed by the MFL community. It is not affiliated with MFL. Built by{' '}
            <a 
              href="https://x.com/dogesports69" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer"
            >
              @dogesports69
            </a>
            {' '}& open sourced{' '}
            <a 
              href="https://github.com/sdeering/mfl-player-search" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline cursor-pointer"
            >
              Github
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
