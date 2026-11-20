import React, { useEffect, useState } from 'react';
import { Camera, Pencil, Plus } from 'lucide-react';
import { usePortal } from '../context/PortalContext';

interface MediaImageProps {
  src?: string;
  alt: string;
  className?: string;
  containerClassName?: string;
  placeholderLabel?: string;
  placeholderSubtext?: string;
  objectFit?: 'cover' | 'contain';
  onQuickEdit?: () => void;
  quickEditLabel?: string;
  compact?: boolean;
}

export const MediaImage: React.FC<MediaImageProps> = ({
  src,
  alt,
  className = '',
  containerClassName = '',
  placeholderLabel = 'FOTOGRAFIA INSTITUCIONAL',
  placeholderSubtext = 'ADICIONE SUA IMAGEM',
  objectFit = 'cover',
  onQuickEdit,
  quickEditLabel = 'Alterar fotografia',
  compact = false,
}) => {
  const { resolveMediaUrl, isAdmin, editMode } = usePortal();
  const [hasError, setHasError] = useState(false);

  const resolvedSrc = resolveMediaUrl(src);

  useEffect(() => {
    setHasError(false);
  }, [resolvedSrc]);

  const hasValidImage = Boolean(resolvedSrc) && !hasError;
  const canEditOnClick = Boolean(onQuickEdit) && ((isAdmin && editMode) || (isAdmin && !hasValidImage));

  return (
    <div
      className={`relative overflow-hidden ${containerClassName} ${
        canEditOnClick ? 'group/edit cursor-pointer' : ''
      } ${isAdmin && editMode && onQuickEdit ? 'ring-1 ring-[#8BAA43]/60' : ''}`}
      onClick={
        canEditOnClick
          ? (e) => {
              e.stopPropagation();
              onQuickEdit?.();
            }
          : undefined
      }
    >
      {hasValidImage ? (
        <img
          src={resolvedSrc}
          alt={alt}
          referrerPolicy="no-referrer"
          loading="lazy"
          onError={() => setHasError(true)}
          className={`${objectFit === 'contain' ? 'object-contain' : 'object-cover'} ${className}`}
        />
      ) : (
        /* Bespoke Architectural Reserved Photography Stage — Zero AI-Generated Imagery */
        <div
          className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-[#070B08] text-center"
          style={{
            backgroundImage:
              'radial-gradient(ellipse at 50% 35%, rgba(38, 63, 36, 0.34) 0%, rgba(11, 16, 12, 0.85) 55%, rgba(5, 7, 5, 1) 100%)',
          }}
        >
          {/* Subtle diagonal architectural grain */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-[0.14]"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(139,170,67,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(139,170,67,0.22) 1px, transparent 1px)',
              backgroundSize: compact ? '28px 28px' : '48px 48px',
            }}
          />

          {/* Discreet optical corner brackets */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-4 top-4 h-4 w-4 border-l border-t border-[#526B32]/65"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute right-4 top-4 h-4 w-4 border-r border-t border-[#526B32]/65"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-4 left-4 h-4 w-4 border-b border-l border-[#526B32]/65"
          />
          <span
            aria-hidden="true"
            className="pointer-events-none absolute bottom-4 right-4 h-4 w-4 border-b border-r border-[#526B32]/65"
          />

          <div className={`relative z-10 flex flex-col items-center ${compact ? 'px-3 py-4' : 'px-8 py-10'}`}>
            <div
              className={`flex items-center justify-center rounded-full border border-[#526B32]/45 bg-[#050705]/70 ${
                compact ? 'h-9 w-9' : 'h-12 w-12'
              }`}
            >
              {isAdmin && onQuickEdit ? (
                <Plus className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-[#8BAA43]`} />
              ) : (
                <Camera className={`${compact ? 'h-4 w-4' : 'h-5 w-5'} text-[#526B32]`} />
              )}
            </div>

            <p
              className={`mt-3 font-display font-semibold tracking-[0.22em] text-[#F1F3EC]/85 ${
                compact ? 'text-[11px]' : 'text-xs sm:text-sm'
              }`}
            >
              {placeholderLabel}
            </p>

            {!compact && (
              <p className="mt-1.5 font-mono text-[10px] tracking-[0.2em] text-[#8BAA43]/80">
                {isAdmin && onQuickEdit ? 'CLIQUE PARA ENVIAR DO COMPUTADOR' : placeholderSubtext}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Direct Visual Edit Mode Overlay */}
      {isAdmin && editMode && onQuickEdit && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onQuickEdit();
          }}
          className="absolute inset-0 z-20 flex items-center justify-center bg-[#050705]/75 opacity-0 transition-opacity duration-200 group-hover/edit:opacity-100 focus-visible:opacity-100"
        >
          <span className="inline-flex items-center gap-2 border border-[#8BAA43] bg-[#0B100C]/95 px-4 py-2 text-xs font-semibold text-[#F1F3EC] whitespace-nowrap shrink-0">
            <Pencil className="h-3.5 w-3.5 text-[#8BAA43]" />
            {quickEditLabel}
          </span>
        </button>
      )}
    </div>
  );
};
