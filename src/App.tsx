import React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { AlertCircle, CheckCircle2, Pencil } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ParticleBackground } from './components/ParticleBackground';
import { PortalFooter } from './components/PortalFooter';
import { QuickImageModal } from './components/QuickImageModal';
import { TopNav } from './components/TopNav';
import { PortalProvider, usePortal } from './context/PortalContext';
import { AboutPage } from './pages/AboutPage';
import { AdminPage } from './pages/AdminPage';
import { GalleryPage } from './pages/GalleryPage';
import { HierarchyPage } from './pages/HierarchyPage';
import { HomePage } from './pages/HomePage';
import { OperationsPage } from './pages/OperationsPage';
import { RolesPage } from './pages/RolesPage';

const PortalShell: React.FC = () => {
  const { activeTab, isAdmin, editMode, setEditMode, toastMessage } = usePortal();

  const renderActivePage = () => {
    switch (activeTab) {
      case 'inicio':
        return <HomePage />;
      case 'quem_somos':
        return <AboutPage />;
      case 'hierarquia':
        return <HierarchyPage />;
      case 'funcoes':
        return <RolesPage />;
      case 'operacoes':
        return <OperationsPage />;
      case 'galeria':
        return <GalleryPage />;
      case 'admin':
        return <AdminPage />;
      default:
        return <HomePage />;
    }
  };

  return (
    <div className="relative min-h-screen bg-[#050705] text-[#F1F3EC]">
      {/* Continuous animated tactical green particle network visible across all tabs */}
      <ParticleBackground />

      {/* Floating transparent editorial top navigation transforming on scroll */}
      <TopNav />

      {/* Main Content Stage */}
      <div className="relative z-10 flex min-h-screen flex-col pt-20">
        {isAdmin && editMode && activeTab !== 'admin' && (
          <div className="border-b border-[#8BAA43]/50 bg-[#263F24]/85 px-6 py-2.5 text-xs text-[#F1F3EC] backdrop-blur-md">
            <div className="mx-auto flex max-w-[1380px] flex-wrap items-center justify-between gap-2 lg:px-6">
              <span className="flex items-center gap-2 font-medium">
                <Pencil className="h-3.5 w-3.5 text-[#8BAA43]" />
                Modo Edição Visual ativo: clique diretamente sobre qualquer espaço fotográfico para
                enviar ou substituir uma fotografia do computador.
              </span>
              <button
                type="button"
                onClick={() => setEditMode(false)}
                className="border border-[#8BAA43] bg-[#050705]/70 px-3 py-1 text-xs font-semibold text-[#F1F3EC] hover:bg-[#050705]"
              >
                Encerrar Modo Edição
              </button>
            </div>
          </div>
        )}

        <main className="flex-1">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            >
              {renderActivePage()}
            </motion.div>
          </AnimatePresence>
        </main>

        <PortalFooter />
      </div>

      {/* Persistent Upload & Optimization Modal */}
      <QuickImageModal />

      {/* Subtle Toast Confirmation */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 right-6 z-50 flex max-w-md items-center gap-3 border px-5 py-3.5 text-xs font-semibold shadow-2xl ${
            toastMessage.type === 'error'
              ? 'border-[#D62828] bg-[#0B100C] text-[#F1F3EC]'
              : 'border-[#8BAA43] bg-[#0B100C] text-[#F1F3EC]'
          }`}
        >
          {toastMessage.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0 text-[#D62828]" />
          ) : (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#8BAA43]" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <PortalProvider>
        <PortalShell />
      </PortalProvider>
    </ErrorBoundary>
  );
}
