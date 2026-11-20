import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Lock, Menu, Pencil, ShieldCheck, X } from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import { PortalTab } from '../types/portal';

interface NavEntry {
  id: PortalTab;
  index: string;
  label: string;
}

const NAV_ENTRIES: NavEntry[] = [
  { id: 'inicio', index: '01', label: 'Início' },
  { id: 'quem_somos', index: '02', label: 'Quem Somos' },
  { id: 'hierarquia', index: '03', label: 'Hierarquia' },
  { id: 'funcoes', index: '04', label: 'Funções' },
  { id: 'operacoes', index: '05', label: 'Operações' },
  { id: 'galeria', index: '06', label: 'Galeria' },
];

export const TopNav: React.FC = () => {
  const { activeTab, setActiveTab, logoUrl, isAdmin, editMode, setEditMode } = usePortal();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const handleNav = (tab: PortalTab) => {
    setActiveTab(tab);
    setMobileOpen(false);
  };

  return (
    <>
      <header
        className={`fixed left-0 right-0 top-0 z-40 transition-all duration-300 ${
          scrolled
            ? 'border-b border-[#263F24]/45 bg-[#050705]/88 backdrop-blur-xl py-3'
            : 'border-b border-transparent bg-gradient-to-b from-[#050705]/85 to-transparent py-5'
        }`}
      >
        <div className="mx-auto flex max-w-[1380px] items-center justify-between gap-8 px-6 lg:px-12">
          {/* Zone 1: Brand Lockup */}
          <button
            type="button"
            onClick={() => handleNav('inicio')}
            className="group flex items-center gap-3 whitespace-nowrap shrink-0"
          >
            <img
              src={logoUrl}
              alt="Emblema oficial 1.F.M.O.T"
              referrerPolicy="no-referrer"
              className="h-10 w-10 object-contain transition-transform duration-200 group-hover:scale-105"
            />
            <span className="font-display text-2xl font-bold tracking-[0.2em] text-[#F1F3EC]">
              1.F.M.O.T
            </span>
          </button>

          {/* Zone 2: Clean Typographic Navigation Links */}
          <nav
            aria-label="Navegação principal 1.F.M.O.T"
            className="hidden items-center gap-7 lg:flex"
          >
            {NAV_ENTRIES.map((item) => {
              const active = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNav(item.id)}
                  className={`relative py-2 text-sm font-medium tracking-wide transition-colors duration-200 whitespace-nowrap shrink-0 ${
                    active ? 'text-[#F1F3EC]' : 'text-[#A5AAA2] hover:text-[#F1F3EC]'
                  }`}
                >
                  {item.label}
                  {active && (
                    <motion.span
                      layoutId="fmot-nav-underline"
                      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
                      className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#8BAA43]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: Single Discreet Admin Control + Mobile Menu Trigger */}
          <div className="flex items-center gap-3 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditMode(!editMode)}
                title="Ativar ou desativar edição direta de imagens nas páginas"
                className={`hidden items-center gap-2 border px-3.5 py-2 text-xs font-semibold transition-colors md:inline-flex whitespace-nowrap shrink-0 ${
                  editMode
                    ? 'border-[#8BAA43] bg-[#263F24]/70 text-[#F1F3EC]'
                    : 'border-[#263F24]/70 bg-[#050705]/60 text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC]'
                }`}
              >
                <Pencil className="h-3.5 w-3.5 text-[#8BAA43]" />
                {editMode ? 'Edição Ativa' : 'Editar Imagens'}
              </button>
            )}

            <button
              type="button"
              onClick={() => handleNav('admin')}
              className={`hidden items-center gap-2 border px-4 py-2 text-xs font-semibold tracking-wider transition-colors sm:inline-flex whitespace-nowrap shrink-0 ${
                activeTab === 'admin'
                  ? 'border-[#8BAA43] bg-[#263F24]/60 text-[#F1F3EC]'
                  : 'border-[#263F24]/70 bg-transparent text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC]'
              }`}
            >
              {isAdmin ? (
                <ShieldCheck className="h-3.5 w-3.5 text-[#8BAA43]" />
              ) : (
                <Lock className="h-3.5 w-3.5 text-[#526B32]" />
              )}
              Painel
            </button>

            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir navegação"
              className="flex h-10 w-10 items-center justify-center border border-[#263F24]/70 bg-[#050705]/80 text-[#F1F3EC] lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Cinematic Fullscreen Mobile Navigation Curtain */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex flex-col justify-between bg-[#050705]/98 p-6 backdrop-blur-xl lg:hidden"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={logoUrl}
                  alt="Emblema 1.F.M.O.T"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 object-contain"
                />
                <span className="font-display text-2xl font-bold tracking-[0.2em] text-[#F1F3EC]">
                  1.F.M.O.T
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Fechar navegação"
                className="flex h-11 w-11 items-center justify-center border border-[#263F24] text-[#F1F3EC]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="my-auto space-y-2 py-8">
              {NAV_ENTRIES.map((item) => {
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNav(item.id)}
                    className="flex w-full items-baseline gap-4 border-b border-[#263F24]/30 py-3.5 text-left"
                  >
                    <span className="font-mono text-xs text-[#526B32] tabular-nums">
                      {item.index}
                    </span>
                    <span
                      className={`font-display text-3xl font-bold tracking-wider ${
                        active ? 'text-[#8BAA43]' : 'text-[#F1F3EC]'
                      }`}
                    >
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="flex items-center justify-between border-t border-[#263F24]/40 pt-4">
              <button
                type="button"
                onClick={() => handleNav('admin')}
                className="inline-flex items-center gap-2 text-xs font-semibold tracking-wider text-[#8BAA43]"
              >
                <Lock className="h-3.5 w-3.5" />
                Painel Administrativo
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setEditMode(!editMode);
                    setMobileOpen(false);
                  }}
                  className="text-xs font-semibold text-[#F1F3EC]"
                >
                  {editMode ? 'Desativar Edição' : 'Editar Imagens'}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
