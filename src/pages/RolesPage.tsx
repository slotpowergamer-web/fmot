import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Activity,
  BookOpen,
  Compass,
  Crosshair,
  Pencil,
  Radar,
  Shield,
  Wrench,
} from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { usePortal } from '../context/PortalContext';
import { RoleSpecialty } from '../types/portal';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Crosshair,
  Radar,
  Wrench,
  Activity,
  BookOpen,
  Compass,
};

export const RolesPage: React.FC = () => {
  const { roles, isAdmin, setActiveTab, openQuickImageEditor, saveRoleSpecialty } = usePortal();
  const [selectedCategory, setSelectedCategory] = useState<string>('Todas');
  const [activeRoleId, setActiveRoleId] = useState<string>(roles[0]?.id || '');

  const categories = useMemo(() => {
    const unique = Array.from(new Set(roles.map((r) => r.category)));
    return ['Todas', ...unique];
  }, [roles]);

  const filteredRoles = useMemo(() => {
    if (selectedCategory === 'Todas') return roles;
    return roles.filter((r) => r.category === selectedCategory);
  }, [roles, selectedCategory]);

  const activeRole: RoleSpecialty | undefined = useMemo(() => {
    return filteredRoles.find((r) => r.id === activeRoleId) || filteredRoles[0];
  }, [filteredRoles, activeRoleId]);

  const handleQuickImage = (role: RoleSpecialty) => {
    openQuickImageEditor({
      title: `Fotografia da Função — ${role.name}`,
      page: 'funcoes',
      currentUrl: role.imageUrl || '',
      onPublish: async (imageUrl) => {
        await saveRoleSpecialty({ ...role, imageUrl });
      },
      onRemove: async () => {
        await saveRoleSpecialty({ ...role, imageUrl: '' });
      },
    });
  };

  const ActiveIcon = activeRole ? ICON_MAP[activeRole.iconName] || Shield : Shield;

  return (
    <div className="space-y-14 pb-16">
      {/* Header */}
      <header className="mx-auto max-w-[1380px] px-6 pt-10 lg:px-12 lg:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[#263F24]/50 pb-10">
          <div>
            <p className="font-mono text-xs tracking-[0.26em] text-[#8BAA43]">
              04 · FRENTES DE ATUAÇÃO
            </p>
            <h1 className="mt-3 font-display text-6xl font-bold leading-[0.9] tracking-[0.06em] text-[#F1F3EC] sm:text-7xl lg:text-8xl">
              FUNÇÕES
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#A5AAA2]">
              Áreas operacionais e especialidades que sustentam o comando, as operações especiais,
              a ordem e a capacitação contínua da 1.F.M.O.T.
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className="inline-flex items-center gap-2 border border-[#526B32] bg-[#263F24]/30 px-5 py-2.5 text-xs font-semibold tracking-wider text-[#F1F3EC] hover:border-[#8BAA43] whitespace-nowrap shrink-0"
            >
              <Pencil className="h-3.5 w-3.5 text-[#8BAA43]" />
              Gerenciar Funções
            </button>
          )}
        </div>

        {/* Clean Typographic Category Selector */}
        <div className="mt-6 flex flex-wrap items-center gap-6">
          {categories.map((cat) => {
            const isSelected = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`border-b-2 pb-2 text-xs font-semibold tracking-[0.16em] transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'border-[#8BAA43] text-[#F1F3EC]'
                    : 'border-transparent text-[#A5AAA2] hover:text-[#F1F3EC]'
                }`}
              >
                {cat.toUpperCase()}
              </button>
            );
          })}
        </div>
      </header>

      {/* Asymmetric Split Editorial Stage (Interactive Index Left + Feature Showcase Right) */}
      <section className="mx-auto max-w-[1380px] px-6 lg:px-12">
        <div className="grid items-start gap-12 lg:grid-cols-12">
          {/* Left Interactive Specialty Roster */}
          <div className="border-t border-[#263F24]/50 lg:col-span-5">
            {filteredRoles.map((role, idx) => {
              const isSelected = activeRole?.id === role.id;
              const IconComp = ICON_MAP[role.iconName] || Shield;

              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setActiveRoleId(role.id)}
                  className={`group flex w-full items-start gap-4 border-b border-[#263F24]/45 px-3 py-6 text-left transition-all duration-200 ${
                    isSelected
                      ? 'bg-[#263F24]/25 text-[#F1F3EC]'
                      : 'text-[#A5AAA2] hover:bg-[#263F24]/10 hover:text-[#F1F3EC]'
                  }`}
                >
                  <span
                    className={`mt-1 font-mono text-xs tabular-nums ${
                      isSelected ? 'text-[#8BAA43]' : 'text-[#526B32]'
                    }`}
                  >
                    {String(idx + 1).padStart(2, '0')}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-[10px] tracking-[0.2em] text-[#8BAA43]/80">
                      {role.category.toUpperCase()}
                    </p>
                    <h2
                      className={`mt-1 font-display text-2xl font-bold leading-tight transition-transform duration-200 ${
                        isSelected
                          ? 'translate-x-1 text-[#F1F3EC]'
                          : 'text-[#F1F3EC]/80 group-hover:translate-x-1 group-hover:text-[#F1F3EC]'
                      }`}
                    >
                      {role.name}
                    </h2>
                  </div>

                  <IconComp
                    className={`mt-1 h-5 w-5 shrink-0 transition-colors ${
                      isSelected ? 'text-[#8BAA43]' : 'text-[#526B32] group-hover:text-[#8BAA43]'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          {/* Right Sticky Editorial Spotlight */}
          <div className="lg:sticky lg:top-28 lg:col-span-7">
            <AnimatePresence mode="wait">
              {activeRole && (
                <motion.article
                  key={activeRole.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                  className="space-y-8"
                >
                  <div className="aspect-[16/10] w-full">
                    <MediaImage
                      src={activeRole.imageUrl}
                      alt={activeRole.name}
                      placeholderLabel={`REGISTRO — ${activeRole.name.toUpperCase()}`}
                      placeholderSubtext="ADICIONE SUA IMAGEM"
                      containerClassName="h-full w-full"
                      className="h-full w-full object-cover"
                      onQuickEdit={() => handleQuickImage(activeRole)}
                      quickEditLabel="Alterar Fotografia da Função"
                    />
                  </div>

                  <div className="space-y-5">
                    <div className="flex items-center gap-3">
                      <ActiveIcon className="h-5 w-5 text-[#8BAA43]" />
                      <span className="font-mono text-xs tracking-[0.22em] text-[#8BAA43]">
                        {activeRole.category.toUpperCase()}
                      </span>
                    </div>

                    <h2 className="font-display text-4xl font-bold leading-tight text-[#F1F3EC]">
                      {activeRole.name}
                    </h2>

                    <p className="max-w-2xl text-base leading-relaxed text-[#A5AAA2]">
                      {activeRole.description}
                    </p>
                  </div>

                  <div className="grid gap-10 border-t border-[#263F24]/50 pt-7 sm:grid-cols-2">
                    <div>
                      <h3 className="font-mono text-xs tracking-[0.2em] text-[#8BAA43]">
                        ATRIBUIÇÕES PRINCIPAIS
                      </h3>
                      <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#F1F3EC]/90">
                        {activeRole.responsibilities.map((item, i) => (
                          <li key={i} className="flex items-start gap-3">
                            <span className="mt-2 h-1 w-3 shrink-0 bg-[#8BAA43]" />
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    {activeRole.requirements.length > 0 && (
                      <div>
                        <h3 className="font-mono text-xs tracking-[0.2em] text-[#A5AAA2]">
                          DIRETRIZES E PADRÃO
                        </h3>
                        <ul className="mt-4 space-y-3 text-sm leading-relaxed text-[#A5AAA2]">
                          {activeRole.requirements.map((item, i) => (
                            <li key={i} className="flex items-start gap-3">
                              <span className="mt-2 h-1 w-3 shrink-0 bg-[#526B32]" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </motion.article>
              )}
            </AnimatePresence>
          </div>
        </div>
      </section>
    </div>
  );
};
