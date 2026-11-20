import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, ChevronRight, Maximize2, Pencil, X } from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { usePortal } from '../context/PortalContext';
import { GalleryItem } from '../types/portal';

export const GalleryPage: React.FC = () => {
  const {
    gallery,
    isAdmin,
    setActiveTab,
    openQuickImageEditor,
    saveGalleryItem,
    resolveMediaUrl,
  } = usePortal();

  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const categories = useMemo(() => {
    const unique = Array.from(new Set(gallery.map((g) => g.category)));
    return ['Todas', ...unique];
  }, [gallery]);

  const filteredItems = useMemo(() => {
    if (selectedCategory === 'Todas') return gallery;
    return gallery.filter((g) => g.category === selectedCategory);
  }, [gallery, selectedCategory]);

  const populatedItems = useMemo(
    () => filteredItems.filter((item) => Boolean(resolveMediaUrl(item.imageUrl))),
    [filteredItems, resolveMediaUrl]
  );

  useEffect(() => {
    if (lightboxIndex === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIndex(null);
      if (e.key === 'ArrowRight' && populatedItems.length > 0) {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev + 1) % populatedItems.length
        );
      }
      if (e.key === 'ArrowLeft' && populatedItems.length > 0) {
        setLightboxIndex((prev) =>
          prev === null ? null : (prev - 1 + populatedItems.length) % populatedItems.length
        );
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIndex, populatedItems.length]);

  const handleQuickReplace = (item: GalleryItem) => {
    openQuickImageEditor({
      title: `Galeria — ${item.title}`,
      page: 'galeria',
      currentUrl: item.imageUrl,
      onPublish: async (imageUrl) => {
        await saveGalleryItem({ ...item, imageUrl, isDemo: false });
      },
      onRemove: async () => {
        await saveGalleryItem({ ...item, imageUrl: '' });
      },
    });
  };

  const openLightboxFor = (item: GalleryItem) => {
    const idx = populatedItems.findIndex((p) => p.id === item.id);
    if (idx >= 0) setLightboxIndex(idx);
  };

  const activeLightboxItem =
    lightboxIndex !== null ? populatedItems[lightboxIndex] : null;

  // Dynamic asymmetric editorial span rhythm so the gallery never feels like uniform square cards
  const getEditorialLayout = (idx: number) => {
    const pattern = idx % 4;
    if (pattern === 0) return { span: 'lg:col-span-8', aspect: 'aspect-[16/10]' };
    if (pattern === 1) return { span: 'lg:col-span-4', aspect: 'aspect-[4/5]' };
    if (pattern === 2) return { span: 'lg:col-span-5', aspect: 'aspect-[4/5]' };
    return { span: 'lg:col-span-7', aspect: 'aspect-[16/10]' };
  };

  return (
    <div className="space-y-14 pb-16">
      <header className="mx-auto max-w-[1380px] px-6 pt-10 lg:px-12 lg:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[#263F24]/50 pb-10">
          <div>
            <p className="font-mono text-xs tracking-[0.26em] text-[#8BAA43]">
              06 · EXPOSIÇÃO VISUAL
            </p>
            <h1 className="mt-3 font-display text-6xl font-bold leading-[0.9] tracking-[0.06em] text-[#F1F3EC] sm:text-7xl lg:text-8xl">
              GALERIA
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#A5AAA2]">
              Acervo fotográfico oficial da 1.F.M.O.T. Todas as fotografias são adicionadas e
              organizadas manualmente pela corporação.
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className="inline-flex items-center gap-2 border border-[#526B32] bg-[#263F24]/30 px-5 py-2.5 text-xs font-semibold tracking-wider text-[#F1F3EC] hover:border-[#8BAA43] whitespace-nowrap shrink-0"
            >
              <Pencil className="h-3.5 w-3.5 text-[#8BAA43]" />
              Gerenciar Galeria
            </button>
          )}
        </div>

        {/* Typographic Category Bar */}
        <div className="mt-6 flex flex-wrap items-center gap-6">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => {
                setSelectedCategory(cat);
                setLightboxIndex(null);
              }}
              className={`border-b-2 pb-2 text-xs font-semibold tracking-[0.16em] transition-colors whitespace-nowrap shrink-0 ${
                selectedCategory === cat
                  ? 'border-[#8BAA43] text-[#F1F3EC]'
                  : 'border-transparent text-[#A5AAA2] hover:text-[#F1F3EC]'
              }`}
            >
              {cat.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      {/* Asymmetric Exhibition Wall */}
      <section className="mx-auto max-w-[1380px] px-6 lg:px-12">
        <div className="grid items-end gap-x-8 gap-y-14 lg:grid-cols-12">
          {filteredItems.map((item, idx) => {
            const layout = getEditorialLayout(idx);
            const hasPhoto = Boolean(resolveMediaUrl(item.imageUrl));

            return (
              <motion.figure
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.15 }}
                transition={{ duration: 0.5 }}
                onClick={() => {
                  if (hasPhoto) openLightboxFor(item);
                }}
                className={`group ${layout.span} ${hasPhoto ? 'cursor-pointer' : ''}`}
              >
                <div className={`relative w-full overflow-hidden ${layout.aspect}`}>
                  <MediaImage
                    src={item.imageUrl}
                    alt={item.title}
                    placeholderLabel={item.isCover ? 'FOTOGRAFIA DE CAPA' : 'REGISTRO DA CORPORAÇÃO'}
                    placeholderSubtext="ADICIONE SUA IMAGEM"
                    containerClassName="h-full w-full"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                    onQuickEdit={() => handleQuickReplace(item)}
                    quickEditLabel="Substituir Fotografia"
                  />

                  {hasPhoto && (
                    <div className="pointer-events-none absolute right-4 top-4 flex h-10 w-10 items-center justify-center bg-[#050705]/75 text-[#F1F3EC] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                      <Maximize2 className="h-4 w-4 text-[#8BAA43]" />
                    </div>
                  )}
                </div>

                <figcaption className="mt-4 flex items-baseline justify-between gap-4 border-t border-[#263F24]/40 pt-3">
                  <div className="min-w-0">
                    <h2 className="font-display text-xl font-bold text-[#F1F3EC] transition-colors group-hover:text-[#8BAA43]">
                      {item.title}
                    </h2>
                    {item.description && (
                      <p className="mt-1 text-xs text-[#A5AAA2]">{item.description}</p>
                    )}
                  </div>
                  <div className="shrink-0 text-right font-mono text-[11px] text-[#526B32]">
                    <span className="text-[#8BAA43]">{item.category}</span>
                    {item.date && <span className="ml-2 tabular-nums">{item.date}</span>}
                  </div>
                </figcaption>
              </motion.figure>
            );
          })}
        </div>
      </section>

      {/* Fullscreen Exhibition Lightbox */}
      {activeLightboxItem && lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#050705]/96 p-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxIndex(null)}
        >
          <div className="mb-4 flex w-full max-w-6xl items-center justify-between text-xs text-[#A5AAA2]">
            <span className="font-mono tracking-widest tabular-nums">
              {String(lightboxIndex + 1).padStart(2, '0')} /{' '}
              {String(populatedItems.length).padStart(2, '0')} ·{' '}
              {activeLightboxItem.category.toUpperCase()}
            </span>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              aria-label="Fechar ampliação"
              className="flex h-10 w-10 items-center justify-center border border-[#263F24] bg-[#0B100C] text-[#F1F3EC] hover:border-[#8BAA43]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div
            className="relative flex w-full max-w-6xl items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            {populatedItems.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex(
                    (lightboxIndex - 1 + populatedItems.length) % populatedItems.length
                  )
                }
                aria-label="Fotografia anterior"
                className="absolute left-2 z-10 flex h-12 w-12 items-center justify-center border border-[#263F24] bg-[#0B100C]/90 text-[#F1F3EC] hover:border-[#8BAA43]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
            )}

            <img
              src={resolveMediaUrl(activeLightboxItem.imageUrl)}
              alt={activeLightboxItem.title}
              referrerPolicy="no-referrer"
              className="max-h-[75vh] w-auto max-w-full object-contain"
            />

            {populatedItems.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((lightboxIndex + 1) % populatedItems.length)
                }
                aria-label="Próxima fotografia"
                className="absolute right-2 z-10 flex h-12 w-12 items-center justify-center border border-[#263F24] bg-[#0B100C]/90 text-[#F1F3EC] hover:border-[#8BAA43]"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          <div
            className="mt-5 w-full max-w-6xl border-t border-[#263F24]/50 pt-4 text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-2xl font-bold text-[#F1F3EC]">
              {activeLightboxItem.title}
            </h2>
            {activeLightboxItem.description && (
              <p className="mt-1 text-sm text-[#A5AAA2]">{activeLightboxItem.description}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
