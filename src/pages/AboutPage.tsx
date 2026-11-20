import React from 'react';
import { motion } from 'motion/react';
import { Pencil } from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { usePortal } from '../context/PortalContext';

export const AboutPage: React.FC = () => {
  const {
    config,
    logoUrl,
    slotsMap,
    isAdmin,
    setActiveTab,
    openQuickImageEditor,
    savePortalSlot,
    resetPortalSlot,
  } = usePortal();

  const openSlotEdit = (slotId: string) => {
    const slot = slotsMap[slotId];
    if (!slot) return;
    openQuickImageEditor({
      title: slot.label,
      page: slot.page,
      currentUrl: slot.imageUrl,
      onPublish: async (imageUrl, assetId) => {
        await savePortalSlot({ ...slot, imageUrl, mediaAssetId: assetId || '' });
      },
      onRemove: async () => {
        await resetPortalSlot(slotId);
      },
    });
  };

  const teamPanoramic = slotsMap['about_team_panoramic'];
  const dailyOps = slotsMap['about_daily_ops'];
  const weeklyOps = slotsMap['about_weekly_ops'];

  return (
    <div className="space-y-24 pb-12 lg:space-y-32">
      {/* 1. EDITORIAL OPENING */}
      <section className="mx-auto max-w-[1380px] px-6 pt-10 lg:px-12 lg:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[#263F24]/50 pb-10">
          <div>
            <p className="font-mono text-xs tracking-[0.26em] text-[#8BAA43]">
              02 · IDENTIDADE NO BRP
            </p>
            <h1 className="mt-3 font-display text-6xl font-bold leading-[0.9] tracking-[0.06em] text-[#F1F3EC] sm:text-7xl lg:text-8xl">
              QUEM SOMOS
            </h1>
          </div>

          <div className="flex items-center gap-5">
            <img
              src={logoUrl}
              alt="Emblema oficial 1.F.M.O.T"
              referrerPolicy="no-referrer"
              className="h-16 w-16 object-contain"
            />
            <div>
              <span className="font-display text-3xl font-bold tracking-[0.16em] text-[#F1F3EC]">
                1.F.M.O.T
              </span>
              <p className="font-mono text-[11px] tracking-[0.2em] text-[#8BAA43]">
                EQUIPE DE ELITE · BRP
              </p>
            </div>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setActiveTab('admin')}
                className="ml-4 inline-flex items-center gap-2 border border-[#526B32] px-4 py-2 text-xs font-semibold text-[#F1F3EC] hover:border-[#8BAA43] whitespace-nowrap shrink-0"
              >
                <Pencil className="h-3.5 w-3.5 text-[#8BAA43]" />
                Editar
              </button>
            )}
          </div>
        </div>

        {/* Institutional Presentation — Asymmetric Editorial Lead */}
        <div className="mt-12 grid gap-10 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <p className="font-display text-3xl font-bold leading-snug text-[#F1F3EC] sm:text-4xl">
              Uma corporação com identidade própria dentro do BRP.
            </p>
          </div>
          <div className="lg:col-span-7">
            <p className="whitespace-pre-line text-lg leading-relaxed text-[#A5AAA2]">
              {config.aboutIntro}
            </p>
          </div>
        </div>
      </section>

      {/* 2. PANORAMIC TEAM PHOTOGRAPHY STAGE */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.2 }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-[1440px] px-0 sm:px-6 lg:px-12"
      >
        <div className="aspect-[16/9] w-full sm:aspect-[21/9]">
          <MediaImage
            src={teamPanoramic?.imageUrl}
            alt={teamPanoramic?.title || 'Fotografia panorâmica da equipe 1.F.M.O.T'}
            placeholderLabel="FOTOGRAFIA PANORÂMICA DA EQUIPE"
            placeholderSubtext="ADICIONE SUA IMAGEM"
            containerClassName="h-full w-full"
            className="h-full w-full object-cover"
            onQuickEdit={() => openSlotEdit('about_team_panoramic')}
            quickEditLabel="Alterar Fotografia da Equipe"
          />
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2 px-6 sm:px-0 text-xs text-[#A5AAA2]">
          <span className="font-mono tracking-widest text-[#8BAA43]">
            EFETIVO OFICIAL · 1.F.M.O.T
          </span>
          <span>{teamPanoramic?.title || 'Fotografia panorâmica da equipe'}</span>
        </div>
      </motion.section>

      {/* 3. HIGH-IMPACT DIFFERENTIATOR MANIFESTO */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.55 }}
        className="relative overflow-hidden border-y border-[#263F24]/50 bg-[#080D09]/90 py-20 lg:py-28"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-1/2 h-64 w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#263F24]/30 blur-[100px]"
        />
        <div className="relative z-10 mx-auto max-w-5xl px-6 text-center lg:px-12">
          <p className="font-mono text-xs tracking-[0.28em] text-[#8BAA43]">
            NOSSO DIFERENCIAL
          </p>
          <h2 className="mt-5 font-display text-4xl font-bold leading-tight tracking-wide text-[#F1F3EC] sm:text-5xl lg:text-6xl">
            {config.aboutDifferentiator}
          </h2>
          <div className="mx-auto mt-8 flex items-center justify-center gap-2">
            <span className="h-[2px] w-16 bg-[#8BAA43]" />
            <span className="h-[2px] w-4 bg-[#D62828]" />
            <span className="h-[2px] w-2 bg-[#FFC928]" />
          </div>
        </div>
      </motion.section>

      {/* 4. OPERAÇÕES DIÁRIAS E SEMANAIS — Asymmetric Editorial Visual Spread */}
      <section className="mx-auto max-w-[1380px] px-6 lg:px-12">
        <div className="grid items-start gap-12 lg:grid-cols-12">
          {/* Left column: Daily Operations Wide Frame + Narrative */}
          <div className="space-y-8 lg:col-span-7">
            <div>
              <p className="font-mono text-xs tracking-[0.24em] text-[#8BAA43]">
                ROTINA OPERACIONAL
              </p>
              <h2 className="mt-2 font-display text-4xl font-bold text-[#F1F3EC] sm:text-5xl">
                Operações Diárias e Semanais
              </h2>
            </div>

            <div className="aspect-[16/10] w-full">
              <MediaImage
                src={dailyOps?.imageUrl}
                alt={dailyOps?.title || 'Operações Diárias 1.F.M.O.T'}
                placeholderLabel="REGISTRO DE OPERAÇÕES DIÁRIAS"
                placeholderSubtext="FOTOGRAFIA INSTITUCIONAL"
                containerClassName="h-full w-full"
                className="h-full w-full object-cover"
                onQuickEdit={() => openSlotEdit('about_daily_ops')}
                quickEditLabel="Alterar Foto de Operações Diárias"
              />
            </div>

            <div className="grid gap-8 border-t border-[#263F24]/50 pt-6 sm:grid-cols-2">
              <div>
                <span className="font-mono text-xs text-[#8BAA43]">FREQUÊNCIA DIÁRIA</span>
                <h3 className="mt-2 font-display text-2xl font-bold text-[#F1F3EC]">
                  Operações Diárias
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#A5AAA2]">
                  Atuação constante em campo voltada à prontidão, organização e consolidação prática
                  do padrão da 1.F.M.O.T.
                </p>
              </div>
              <div>
                <span className="font-mono text-xs text-[#8BAA43]">FREQUÊNCIA SEMANAL</span>
                <h3 className="mt-2 font-display text-2xl font-bold text-[#F1F3EC]">
                  Operações Semanais
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-[#A5AAA2]">
                  Ações coordenadas e ciclos de capacitação voltados ao aprimoramento individual e
                  coletivo do efetivo.
                </p>
              </div>
            </div>
          </div>

          {/* Right column: Offset Editorial Copy + Vertical Activity Stage */}
          <div className="space-y-8 lg:col-span-5 lg:pt-20">
            <p className="whitespace-pre-line text-base leading-relaxed text-[#F1F3EC]/90">
              {config.aboutOperationsText}
            </p>

            <div className="aspect-[4/5] w-full">
              <MediaImage
                src={weeklyOps?.imageUrl}
                alt={weeklyOps?.title || 'Operações Semanais 1.F.M.O.T'}
                placeholderLabel="REGISTRO DE OPERAÇÕES SEMANAIS"
                placeholderSubtext="REGISTRO DA CORPORAÇÃO"
                containerClassName="h-full w-full"
                className="h-full w-full object-cover"
                onQuickEdit={() => openSlotEdit('about_weekly_ops')}
                quickEditLabel="Alterar Foto de Operações Semanais"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 5. IDENTIDADE E VALORES — Open Ruled Architectural Columns (Zero Boxed Cards) */}
      <section className="mx-auto max-w-[1380px] px-6 lg:px-12">
        <div className="grid gap-12 border-t border-[#263F24]/50 pt-16 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p className="font-mono text-xs tracking-[0.24em] text-[#8BAA43]">
              ESSÊNCIA DA CORPORAÇÃO
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold text-[#F1F3EC]">
              Identidade e Valores
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-[#A5AAA2]">
              {config.aboutIdentityText}
            </p>
          </div>

          <div className="grid gap-x-10 gap-y-10 sm:grid-cols-2 lg:col-span-8">
            {config.aboutValues.map((val, idx) => (
              <div key={val.id} className="border-t border-[#263F24]/45 pt-5">
                <span className="font-mono text-xs text-[#526B32] tabular-nums">
                  {String(idx + 1).padStart(2, '0')}
                </span>
                <h3 className="mt-3 font-display text-2xl font-bold text-[#F1F3EC]">{val.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#A5AAA2]">{val.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};
