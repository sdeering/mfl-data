'use client';

import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-line py-8">
      <div className="max-w-[1520px] mx-auto px-4 sm:px-7">
        <div className="text-center text-sm text-muted">
          <p>
            MFLData.com is completely free to use app developed by the MFL community. It is not affiliated with MFL. Built by{' '}
            <a 
              href="https://x.com/dogesports69" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold text-accent-ink hover:text-accent-hover cursor-pointer"
            >
              @dogesports69
            </a>
            {' '}& open sourced{' '}
            <a 
              href="https://github.com/sdeering/mfl-player-search" 
              target="_blank" 
              rel="noopener noreferrer"
              className="font-semibold text-accent-ink hover:text-accent-hover cursor-pointer"
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
