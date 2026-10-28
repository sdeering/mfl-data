import React, { useState } from 'react';

/** A club's crest from MFL, or its initials while it loads or when it has none. */
export const ClubLogo: React.FC<{ clubId: number; name: string; logoVersion?: string; className?: string }> = ({
  clubId,
  name,
  logoVersion,
  className = 'w-10 h-10',
}) => {
  const [logo, setLogo] = useState<'loading' | 'shown' | 'missing'>('loading');
  const initials = name.split(/\s+/).map(word => word[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span className={`relative flex-none grid place-items-center ${className}`}>
      {logo !== 'shown' && (
        <span className="grid place-items-center w-full h-full rounded-full border border-line-2 bg-chip font-display text-[11px] font-bold text-fg-3">
          {initials}
        </span>
      )}
      {logo !== 'missing' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`https://d13e14gtps4iwl.cloudfront.net/u/clubs/${clubId}/logo.webp${logoVersion ? `?v=${logoVersion}` : ''}`}
          alt=""
          loading="lazy"
          draggable={false}
          onLoad={() => setLogo('shown')}
          onError={() => setLogo('missing')}
          className={`absolute inset-0 w-full h-full object-contain ${logo === 'shown' ? '' : 'invisible'}`}
        />
      )}
    </span>
  );
};
