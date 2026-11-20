import React from 'react';
import { usePortal } from '../context/PortalContext';

interface RankInsigniaProps {
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  customUrl?: string;
  rankTitle: string;
  size?: 'sm' | 'md' | 'lg';
}

export const RankInsignia: React.FC<RankInsigniaProps> = ({
  tier,
  customUrl,
  rankTitle,
  size = 'md',
}) => {
  const { resolveMediaUrl } = usePortal();
  const resolved = resolveMediaUrl(customUrl);

  const dims =
    size === 'lg' ? 'h-14 w-14' : size === 'sm' ? 'h-9 w-9' : 'h-11 w-11';

  if (resolved) {
    return (
      <img
        src={resolved}
        alt={`Insígnia ${rankTitle}`}
        referrerPolicy="no-referrer"
        className={`${dims} object-contain`}
      />
    );
  }

  // Bespoke metallic military rank insignia SVGs matching each of the 6 official ranks
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-label={`Insígnia ${rankTitle}`}
      className={`${dims} shrink-0`}
    >
      {/* Subtle tactical shield outline */}
      <path
        d="M32 5L54 13V31C54 45 44.5 54.5 32 59C19.5 54.5 10 45 10 31V13L32 5Z"
        stroke={tier === 1 ? '#FFC928' : '#8BAA43'}
        strokeOpacity={tier === 1 ? '0.85' : '0.65'}
        strokeWidth="1.5"
        fill="rgba(11, 16, 12, 0.9)"
      />

      {tier === 1 && (
        /* CORONEL: Three tactical stars + laurel arc */
        <>
          <polygon points="32,16 34.4,21.5 40.2,22 35.8,25.8 37.1,31.5 32,28.5 26.9,31.5 28.2,25.8 23.8,22 29.6,21.5" fill="#FFC928" />
          <polygon points="21,31 22.8,35 27,35.4 23.8,38.1 24.7,42.2 21,40 17.3,42.2 18.2,38.1 15,35.4 19.2,35" fill="#8BAA43" />
          <polygon points="43,31 44.8,35 49,35.4 45.8,38.1 46.7,42.2 43,40 39.3,42.2 40.2,38.1 37,35.4 41.2,35" fill="#8BAA43" />
          <path d="M20 47H44" stroke="#D62828" strokeWidth="2" />
        </>
      )}

      {tier === 2 && (
        /* CAPITÃO: Three commanding vertical officer bars + apex chevron */
        <>
          <path d="M18 24L32 15L46 24" stroke="#8BAA43" strokeWidth="2.4" />
          <rect x="21" y="29" width="4.5" height="17" fill="#F1F3EC" />
          <rect x="29.75" y="29" width="4.5" height="17" fill="#8BAA43" />
          <rect x="38.5" y="29" width="4.5" height="17" fill="#F1F3EC" />
        </>
      )}

      {tier === 3 && (
        /* SARGENTO: Three stacked military chevrons */
        <>
          <path d="M18 28L32 18L46 28" stroke="#8BAA43" strokeWidth="2.8" />
          <path d="M18 36L32 26L46 36" stroke="#8BAA43" strokeWidth="2.8" />
          <path d="M18 44L32 34L46 44" stroke="#F1F3EC" strokeWidth="2.8" />
        </>
      )}

      {tier === 4 && (
        /* CABO: Two military chevrons */
        <>
          <path d="M19 32L32 22L45 32" stroke="#8BAA43" strokeWidth="3" />
          <path d="M19 42L32 32L45 42" stroke="#F1F3EC" strokeWidth="3" />
        </>
      )}

      {tier === 5 && (
        /* SOLDADO: Single decisive chevron */
        <path d="M19 38L32 26L45 38" stroke="#8BAA43" strokeWidth="3.2" />
      )}

      {tier === 6 && (
        /* RECRUTA: Single horizontal bar + center diamond */
        <>
          <path d="M20 35H44" stroke="#A5AAA2" strokeWidth="2.5" />
          <polygon points="32,23 37,28 32,33 27,28" stroke="#8BAA43" strokeWidth="2" />
        </>
      )}
    </svg>
  );
};
