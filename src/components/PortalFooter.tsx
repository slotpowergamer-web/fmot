import React from 'react';
import { DISCORD_INVITE_URL, DiscordIcon } from './DiscordIcon';
import { usePortal } from '../context/PortalContext';
import { PortalTab } from '../types/portal';

const FOOTER_LINKS: { id: PortalTab; label: string }[] = [
  { id: 'inicio', label: 'Início' },
  { id: 'quem_somos', label: 'Quem Somos' },
  { id: 'hierarquia', label: 'Hierarquia' },
  { id: 'funcoes', label: 'Funções' },
  { id: 'operacoes', label: 'Trabalhos e Operações' },
  { id: 'galeria', label: 'Galeria' },
];

export const PortalFooter: React.FC = () => {
  const { logoUrl, setActiveTab } = usePortal();

  return (
    <footer className="relative z-10 mt-24 border-t border-[#263F24]/45 bg-[#050705]/95">
      <div className="mx-auto max-w-[1380px] px-6 py-14 lg:px-12">
        <div className="flex flex-col justify-between gap-10 md:flex-row md:items-center">
          <button
            type="button"
            onClick={() => setActiveTab('inicio')}
            className="flex items-center gap-4 text-left"
          >
            <img
              src={logoUrl}
              alt="Emblema oficial 1.F.M.O.T"
              referrerPolicy="no-referrer"
              className="h-14 w-14 object-contain"
            />
            <div>
              <div className="font-display text-2xl font-bold tracking-[0.2em] text-[#F1F3EC]">
                1.F.M.O.T
              </div>
              <p className="mt-0.5 font-mono text-[11px] tracking-[0.18em] text-[#8BAA43]">
                PORTAL INSTITUCIONAL · BRP
              </p>
            </div>
          </button>

          <nav aria-label="Links do rodapé" className="flex flex-wrap items-center gap-x-7 gap-y-3">
            {FOOTER_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => setActiveTab(link.id)}
                className="text-xs font-medium tracking-wider text-[#A5AAA2] transition-colors hover:text-[#F1F3EC] whitespace-nowrap shrink-0"
              >
                {link.label}
              </button>
            ))}
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium tracking-wider text-[#A9B2FF] transition-colors hover:text-[#F1F3EC] whitespace-nowrap shrink-0"
            >
              <DiscordIcon className="h-3.5 w-3.5 text-[#5865F2]" />
              <span>Discord</span>
            </a>
          </nav>
        </div>

        <div className="mt-12 flex flex-col items-start justify-between gap-4 border-t border-[#263F24]/35 pt-6 text-xs text-[#A5AAA2] sm:flex-row sm:items-center">
          <p>© {new Date().getFullYear()} 1.F.M.O.T — Portal Institucional Oficial.</p>
          <button
            type="button"
            onClick={() => setActiveTab('admin')}
            className="font-mono text-[11px] tracking-widest text-[#526B32] transition-colors hover:text-[#8BAA43]"
          >
            ADMINISTRAÇÃO DO PORTAL
          </button>
        </div>
      </div>
    </footer>
  );
};
