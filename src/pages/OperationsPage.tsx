import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowUpRight, Pencil, Search, X } from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { usePortal } from '../context/PortalContext';
import { OperationRecord } from '../types/portal';

export const OperationsPage: React.FC = () => {
  const {
    operations,
    selectedOperationId,
    setSelectedOperationId,
    isAdmin,
    setActiveTab,
    openQuickImageEditor,
    saveOperationRecord,
    resolveMediaUrl,
  } = usePortal();

  const [categoryFilter, setCategoryFilter] = useState<string>('Todas');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const categories = useMemo(
    () => ['Todas', ...Array.from(new Set(operations.map((o) => o.category)))],
    [operations]
  );

  const filteredOperations = useMemo(() => {
    return operations.filter((op) => {
      const matchCat = categoryFilter === 'Todas' || op.category === categoryFilter;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q ||
        op.title.toLowerCase().includes(q) ||
        op.summary.toLowerCase().includes(q) ||
        op.category.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [operations, categoryFilter, searchQuery]);

  const activeOperation: OperationRecord | undefined = useMemo(
    () => operations.find((op) => op.id === selectedOperationId),
    [operations, selectedOperationId]
  );

  const handleQuickCoverEdit = (op: OperationRecord) => {
    openQuickImageEditor({
      title: `Fotografia — ${op.title}`,
      page: 'operacoes',
      currentUrl: op.coverImageUrl,
      onPublish: async (imageUrl) => {
        await saveOperationRecord({ ...op, coverImageUrl: imageUrl, isDemo: false });
      },
      onRemove: async () => {
        await saveOperationRecord({ ...op, coverImageUrl: '' });
      },
    });
  };

  // ==================== INDIVIDUAL EDITORIAL MONOGRAPH VIEW ====================
  if (activeOperation) {
    return (
      <article className="space-y-14 pb-16">
        <div className="mx-auto max-w-[1380px] px-6 pt-10 lg:px-12 lg:pt-14">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#263F24]/50 pb-6">
            <button
              type="button"
              onClick={() => setSelectedOperationId(null)}
              className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-[#A5AAA2] transition-colors hover:text-[#8BAA43] whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-4 w-4 text-[#8BAA43]" />
              VOLTAR PARA TRABALHOS E OPERAÇÕES
            </button>

            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className="inline-flex items-center gap-2 border border-[#526B32] px-4 py-2 text-xs font-semibold text-[#F1F3EC] hover:border-[#8BAA43] whitespace-nowrap shrink-0"
              >
                <Pencil className="h-3.5 w-3.5 text-[#8BAA43]" />
                Editar Registro
              </button>
            )}
          </div>

          <header className="mt-10 max-w-4xl">
            <div className="flex flex-wrap items-center gap-3 font-mono text-xs tracking-[0.2em] text-[#A5AAA2]">
              <span className="text-[#8BAA43]">{activeOperation.category.toUpperCase()}</span>
              {activeOperation.date && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">{activeOperation.date}</span>
                </>
              )}
              {activeOperation.isDemo && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#FFC928]">ESPAÇO RESERVADO</span>
                </>
              )}
            </div>
            <h1 className="mt-4 font-display text-4xl font-bold leading-tight text-[#F1F3EC] sm:text-6xl">
              {activeOperation.title}
            </h1>
            <p className="mt-5 text-lg leading-relaxed text-[#A5AAA2]">
              {activeOperation.summary}
            </p>
          </header>
        </div>

        {/* Full-Width Panoramic Cover */}
        <div className="mx-auto max-w-[1440px] px-0 sm:px-6 lg:px-12">
          <div className="aspect-[16/9] w-full sm:aspect-[21/9]">
            <MediaImage
              src={activeOperation.coverImageUrl}
              alt={activeOperation.title}
              placeholderLabel="REGISTRO DA CORPORAÇÃO"
              placeholderSubtext="ADICIONE SUA IMAGEM PELO PAINEL ADMINISTRATIVO"
              containerClassName="h-full w-full"
              className="h-full w-full object-cover"
              onQuickEdit={() => handleQuickCoverEdit(activeOperation)}
              quickEditLabel="Alterar Fotografia de Capa"
            />
          </div>
        </div>

        {/* Editorial Body */}
        <div className="mx-auto max-w-[1380px] px-6 lg:px-12">
          <div className="grid gap-12 border-t border-[#263F24]/50 pt-12 lg:grid-cols-12">
            <div className="lg:col-span-8">
              <p className="font-mono text-xs tracking-[0.22em] text-[#8BAA43]">
                REGISTRO INSTITUCIONAL
              </p>
              <p className="mt-5 max-w-prose whitespace-pre-line text-base leading-relaxed text-[#F1F3EC]/90">
                {activeOperation.details}
              </p>
            </div>

            {activeOperation.results && (
              <aside className="border-t border-[#263F24]/45 pt-6 lg:col-span-4 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
                <p className="font-mono text-xs tracking-[0.22em] text-[#8BAA43]">
                  SÍNTESE OPERACIONAL
                </p>
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-[#A5AAA2]">
                  {activeOperation.results}
                </p>
              </aside>
            )}
          </div>

          {activeOperation.galleryUrls && activeOperation.galleryUrls.length > 0 && (
            <section className="mt-16 space-y-6 border-t border-[#263F24]/50 pt-12">
              <h2 className="font-display text-3xl font-bold text-[#F1F3EC]">
                Registros Fotográficos Complementares
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {activeOperation.galleryUrls.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxUrl(resolveMediaUrl(url))}
                    className="group aspect-[4/3] overflow-hidden text-left"
                  >
                    <MediaImage
                      src={url}
                      alt={`${activeOperation.title} — Registro ${idx + 1}`}
                      containerClassName="h-full w-full"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                  </button>
                ))}
              </div>
            </section>
          )}
        </div>

        {lightboxUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#050705]/95 p-4 backdrop-blur-md"
            onClick={() => setLightboxUrl(null)}
          >
            <button
              type="button"
              onClick={() => setLightboxUrl(null)}
              aria-label="Fechar ampliação"
              className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center border border-[#263F24] bg-[#0B100C] text-[#F1F3EC] hover:border-[#8BAA43]"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={lightboxUrl}
              alt="Registro operacional ampliado"
              referrerPolicy="no-referrer"
              className="max-h-[85vh] max-w-[92vw] object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </article>
    );
  }

  // ==================== EDITORIAL ALTERNATING INDEX VIEW ====================
  return (
    <div className="space-y-16 pb-16">
      <header className="mx-auto max-w-[1380px] px-6 pt-10 lg:px-12 lg:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[#263F24]/50 pb-10">
          <div>
            <p className="font-mono text-xs tracking-[0.26em] text-[#8BAA43]">
              05 · REGISTROS E ATUAÇÃO
            </p>
            <h1 className="mt-3 font-display text-6xl font-bold leading-[0.9] tracking-[0.06em] text-[#F1F3EC] sm:text-7xl lg:text-8xl">
              TRABALHOS E OPERAÇÕES
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#A5AAA2]">
              Publicação editorial das operações diárias, semanais e ações especiais conduzidas
              pela 1.F.M.O.T no BRP.
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className="inline-flex items-center gap-2 border border-[#526B32] bg-[#263F24]/30 px-5 py-2.5 text-xs font-semibold tracking-wider text-[#F1F3EC] hover:border-[#8BAA43] whitespace-nowrap shrink-0"
            >
              <Pencil className="h-3.5 w-3.5 text-[#8BAA43]" />
              Gerenciar Operações
            </button>
          )}
        </div>

        {/* Clean Filter & Search Line */}
        <div className="mt-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex flex-wrap items-center gap-6">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`border-b-2 pb-2 text-xs font-semibold tracking-[0.16em] transition-colors whitespace-nowrap shrink-0 ${
                  categoryFilter === cat
                    ? 'border-[#8BAA43] text-[#F1F3EC]'
                    : 'border-transparent text-[#A5AAA2] hover:text-[#F1F3EC]'
                }`}
              >
                {cat.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-0 top-2.5 h-4 w-4 text-[#526B32]" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar registros..."
              className="w-full border-b border-[#263F24] bg-transparent py-2 pl-7 pr-2 text-xs text-[#F1F3EC] placeholder-[#A5AAA2]/50 focus:border-[#8BAA43] focus:outline-none"
            />
          </div>
        </div>
      </header>

      {/* Alternating Asymmetric Editorial Spreads (Zero Boxed Card Grid) */}
      <section className="mx-auto max-w-[1380px] space-y-24 px-6 lg:px-12">
        {filteredOperations.length === 0 ? (
          <div className="border-t border-[#263F24]/50 py-16 text-center">
            <p className="font-display text-2xl font-bold text-[#F1F3EC]">
              Nenhum registro encontrado para este filtro.
            </p>
            <button
              type="button"
              onClick={() => {
                setCategoryFilter('Todas');
                setSearchQuery('');
              }}
              className="mt-4 border-b border-[#8BAA43] pb-1 text-xs font-semibold text-[#8BAA43]"
            >
              Limpar filtros
            </button>
          </div>
        ) : (
          filteredOperations.map((op, index) => {
            const mediaFirst = index % 2 === 0;
            return (
              <motion.article
                key={op.id}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.55 }}
                className="group grid items-center gap-10 border-t border-[#263F24]/45 pt-14 lg:grid-cols-12"
              >
                <div
                  onClick={() => setSelectedOperationId(op.id)}
                  className={`cursor-pointer lg:col-span-7 ${
                    mediaFirst ? 'lg:order-1' : 'lg:order-2'
                  }`}
                >
                  <div className="aspect-[16/10] w-full overflow-hidden">
                    <MediaImage
                      src={op.coverImageUrl}
                      alt={op.title}
                      placeholderLabel="REGISTRO DA CORPORAÇÃO"
                      placeholderSubtext="ADICIONE SUA IMAGEM"
                      containerClassName="h-full w-full"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                      onQuickEdit={() => handleQuickCoverEdit(op)}
                      quickEditLabel="Alterar Capa"
                    />
                  </div>
                </div>

                <div
                  className={`space-y-5 lg:col-span-5 ${
                    mediaFirst ? 'lg:order-2 lg:pl-6' : 'lg:order-1 lg:pr-6'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2.5 font-mono text-xs tracking-[0.18em] text-[#A5AAA2]">
                    <span className="text-[#526B32] tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <span className="text-[#8BAA43]">{op.category.toUpperCase()}</span>
                    {op.date && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">{op.date}</span>
                      </>
                    )}
                    {op.isDemo && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#FFC928]">ESPAÇO RESERVADO</span>
                      </>
                    )}
                  </div>

                  <h2
                    onClick={() => setSelectedOperationId(op.id)}
                    className="cursor-pointer font-display text-3xl font-bold leading-tight text-[#F1F3EC] transition-colors group-hover:text-[#8BAA43] sm:text-4xl"
                  >
                    {op.title}
                  </h2>

                  <p className="text-sm leading-relaxed text-[#A5AAA2]">{op.summary}</p>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setSelectedOperationId(op.id)}
                      className="inline-flex items-center gap-2 border-b border-[#526B32] pb-1.5 text-xs font-semibold tracking-[0.18em] text-[#F1F3EC] transition-colors group-hover:border-[#8BAA43] group-hover:text-[#8BAA43]"
                    >
                      LER REGISTRO COMPLETO
                      <ArrowUpRight className="h-4 w-4 text-[#8BAA43]" />
                    </button>
                  </div>
                </div>
              </motion.article>
            );
          })
        )}
      </section>
    </div>
  );
};
