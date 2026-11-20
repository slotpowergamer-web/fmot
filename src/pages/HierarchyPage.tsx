import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Pencil, Plus, X } from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { RankInsignia } from '../components/RankInsignia';
import { usePortal } from '../context/PortalContext';
import { HierarchyMember, HierarchyNode } from '../types/portal';

const RANK_LEVEL_LABELS: Record<number, string> = {
  1: 'COMANDO SUPREMO',
  2: 'COMANDO DE OPERAÇÕES ESPECIAIS',
  3: 'COMANDO DE OPERAÇÕES BÁSICAS',
  4: 'COMANDO DE UNIDADES STIVES',
  5: 'EFETIVO OPERACIONAL',
  6: 'FORMAÇÃO E CAPACITAÇÃO',
};

const STATUS_TEXT_COLOR: Record<string, string> = {
  Ativo: 'text-[#8BAA43]',
  'Em Capacitação': 'text-[#FFC928]',
  Afastado: 'text-[#A5AAA2]',
};

interface LightboxState {
  member: HierarchyMember;
  rank: HierarchyNode;
}

export const HierarchyPage: React.FC = () => {
  const {
    hierarchy,
    membersByRank,
    isAdmin,
    setActiveTab,
    openQuickImageEditor,
    updateHierarchyMember,
    resolveMediaUrl,
  } = usePortal();

  const [lightbox, setLightbox] = useState<LightboxState | null>(null);

  // Publicly visible members per rank (excludes 'Inativo', strictly preserves order, no count cap)
  const publicMembersByRank = useMemo(() => {
    const map: Record<string, HierarchyMember[]> = {};
    hierarchy.forEach((rank) => {
      map[rank.id] = (membersByRank[rank.id] || []).filter((m) => m.status !== 'Inativo');
    });
    return map;
  }, [hierarchy, membersByRank]);

  const colonel = hierarchy[0];
  const colonelMembers = colonel ? publicMembersByRank[colonel.id] || [] : [];
  const lowerRanks = hierarchy.slice(1);

  const handleQuickMemberPhotoEdit = (member: HierarchyMember, rank: HierarchyNode) => {
    openQuickImageEditor({
      title: `Fotografia — ${member.name} (${rank.rankTitle})`,
      page: 'hierarquia',
      currentUrl: member.photoUrl || '',
      onPublish: async (imageUrl) => {
        await updateHierarchyMember(member.id, {
          rankId: member.rankId,
          name: member.name,
          photoUrl: imageUrl,
          description: member.description || '',
          status: member.status || 'Ativo',
          order: member.order,
        });
      },
      onRemove: async () => {
        await updateHierarchyMember(member.id, {
          rankId: member.rankId,
          name: member.name,
          photoUrl: '',
          description: member.description || '',
          status: member.status || 'Ativo',
          order: member.order,
        });
      },
    });
  };

  const scrollToRank = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const renderMemberEditorialCard = (
    member: HierarchyMember,
    rank: HierarchyNode,
    index: number,
    options?: {
      isColonel?: boolean;
      extraOffsetClass?: string;
    }
  ) => {
    const hasPhoto = Boolean(resolveMediaUrl(member.photoUrl));
    const isColonel = Boolean(options?.isColonel);
    const statusColor = STATUS_TEXT_COLOR[member.status] || 'text-[#8BAA43]';

    return (
      <motion.article
        key={member.id}
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.15 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className={`group flex flex-col ${options?.extraOffsetClass || ''}`}
      >
        {/* Portrait Frame */}
        <div
          onClick={() => {
            if (hasPhoto) setLightbox({ member, rank });
          }}
          className={`relative aspect-[4/5] w-full overflow-hidden border ${
            isColonel ? 'border-[#8BAA43]/40' : 'border-[#263F24]/55'
          } bg-[#080C09] ${hasPhoto ? 'cursor-zoom-in' : ''}`}
        >
          <MediaImage
            src={member.photoUrl}
            alt={`${rank.rankTitle} — ${member.name}`}
            placeholderLabel={`FOTOGRAFIA — ${rank.rankTitle}`}
            placeholderSubtext="ADICIONE SUA IMAGEM"
            containerClassName="h-full w-full"
            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
            onQuickEdit={() => handleQuickMemberPhotoEdit(member, rank)}
            quickEditLabel={`Alterar Foto — ${member.name}`}
          />

          {/* Measured contrast scrim at bottom */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-[#050705]/90 via-[#050705]/35 to-transparent"
          />

          {/* Subtle rank index stamp at bottom of frame */}
          <div className="pointer-events-none absolute bottom-3.5 left-4 right-4 flex items-center justify-between">
            <span
              className={`font-mono text-[11px] tracking-[0.22em] tabular-nums ${
                isColonel ? 'text-[#FFC928]' : 'text-[#8BAA43]'
              }`}
            >
              {rank.positionCode} · #{String(index + 1).padStart(2, '0')}
            </span>
            <span
              className={`h-[1.5px] w-8 transition-all duration-300 group-hover:w-12 ${
                isColonel ? 'bg-[#FFC928]' : 'bg-[#8BAA43]/80'
              }`}
            />
          </div>
        </div>

        {/* Unboxed Editorial Typography Below Portrait */}
        <div className="mt-4 space-y-1.5 border-t border-[#263F24]/45 pt-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono">
            <span className="tracking-[0.2em] text-[#A5AAA2]">{rank.rankTitle}</span>
            <span className={`tracking-[0.14em] ${statusColor}`}>
              {member.status.toUpperCase()}
            </span>
          </div>

          <h3 className="font-display text-2xl font-bold leading-tight tracking-[0.06em] text-[#F1F3EC] sm:text-[26px]">
            {member.name}
          </h3>

          {member.description && (
            <p className="pt-1 text-sm leading-relaxed text-[#A5AAA2]">{member.description}</p>
          )}
        </div>
      </motion.article>
    );
  };

  return (
    <div className="space-y-16 pb-20">
      {/* ==================== EDITORIAL HEADER ==================== */}
      <header className="mx-auto max-w-[1380px] px-6 pt-10 lg:px-12 lg:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6 border-b border-[#263F24]/50 pb-10">
          <div>
            <p className="font-mono text-xs tracking-[0.26em] text-[#8BAA43]">
              03 · ESTRUTURA DE COMANDO
            </p>
            <h1 className="mt-3 font-display text-6xl font-bold leading-[0.9] tracking-[0.06em] text-[#F1F3EC] sm:text-7xl lg:text-8xl">
              HIERARQUIA
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#A5AAA2]">
              Cadeia de comando vertical oficial da 1.F.M.O.T, organizada rigorosamente do comando
              geral até a capacitação inicial.
            </p>
          </div>

          {isAdmin && (
            <button
              type="button"
              onClick={() => setActiveTab('admin')}
              className="inline-flex items-center gap-2 border border-[#526B32] bg-[#263F24]/30 px-5 py-2.5 text-xs font-semibold tracking-wider text-[#F1F3EC] transition-colors hover:border-[#8BAA43] whitespace-nowrap shrink-0"
            >
              <Pencil className="h-3.5 w-3.5 text-[#8BAA43]" />
              GERENCIAR HIERARQUIA
            </button>
          )}
        </div>

        {/* Fast-Jump Vertical Rank Index with Live Member Counts */}
        <div className="mt-6 flex flex-wrap items-center gap-x-7 gap-y-2.5 text-xs">
          {hierarchy.map((rank) => {
            const count = (publicMembersByRank[rank.id] || []).length;
            return (
              <button
                key={rank.id}
                type="button"
                onClick={() => scrollToRank(rank.id)}
                className="group inline-flex items-center gap-2 py-1 text-[#A5AAA2] transition-colors hover:text-[#8BAA43] whitespace-nowrap shrink-0"
              >
                <span className="font-mono text-[11px] text-[#526B32] group-hover:text-[#8BAA43] tabular-nums">
                  {rank.positionCode}
                </span>
                <span className="font-display text-sm font-bold tracking-[0.14em]">
                  {rank.rankTitle}
                </span>
                {count > 0 && (
                  <span className="font-mono text-[11px] text-[#8BAA43]/85 tabular-nums">
                    · {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* ==================== APEX STAGE: 01 · CORONEL ==================== */}
      {colonel && (
        <section
          id={colonel.id}
          className="relative mx-auto max-w-[1380px] scroll-mt-24 px-6 lg:px-12"
        >
          {/* Ambient golden-emerald authority glow */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-12 left-1/2 h-80 w-[640px] -translate-x-1/2 rounded-full bg-[#263F24]/30 blur-[120px]"
          />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="relative border-y border-[#8BAA43]/35 bg-gradient-to-br from-[#0D160E]/90 via-[#070B08]/95 to-[#050705] p-6 sm:p-10 lg:p-14"
          >
            {/* Case A: 0 or 1 Coronel -> Monumental Asymmetric Split Stage */}
            {colonelMembers.length <= 1 ? (
              <div className="grid items-center gap-10 lg:grid-cols-12">
                {/* Portrait Column */}
                <div className="lg:col-span-5">
                  {colonelMembers[0] ? (
                    (() => {
                      const lead = colonelMembers[0];
                      const hasPhoto = Boolean(resolveMediaUrl(lead.photoUrl));
                      return (
                        <div
                          onClick={() => {
                            if (hasPhoto) setLightbox({ member: lead, rank: colonel });
                          }}
                          className={`relative aspect-[4/5] w-full overflow-hidden border border-[#8BAA43]/35 ${
                            hasPhoto ? 'cursor-zoom-in' : ''
                          }`}
                        >
                          <MediaImage
                            src={lead.photoUrl}
                            alt={`CORONEL — ${lead.name}`}
                            placeholderLabel="FOTOGRAFIA DO CORONEL"
                            placeholderSubtext="ADICIONE SUA IMAGEM"
                            containerClassName="h-full w-full"
                            className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
                            onQuickEdit={() => handleQuickMemberPhotoEdit(lead, colonel)}
                            quickEditLabel={`Alterar Foto — ${lead.name}`}
                          />
                          <div
                            aria-hidden="true"
                            className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050705]/80 via-transparent to-transparent"
                          />
                          <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center justify-between">
                            <span className="font-mono text-xs tracking-[0.22em] text-[#FFC928]">
                              POSIÇÃO {colonel.positionCode}
                            </span>
                            <span className="h-[2px] w-10 bg-[#FFC928]" />
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="relative aspect-[4/5] w-full">
                      <MediaImage
                        src=""
                        alt={`Fotografia oficial — ${colonel.rankTitle}`}
                        placeholderLabel="FOTOGRAFIA DO CORONEL"
                        placeholderSubtext="ADICIONE SUA IMAGEM"
                        containerClassName="h-full w-full"
                        className="h-full w-full object-cover"
                      />
                      <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-center justify-between">
                        <span className="font-mono text-xs tracking-[0.22em] text-[#FFC928]">
                          POSIÇÃO {colonel.positionCode}
                        </span>
                        <span className="h-[2px] w-10 bg-[#FFC928]" />
                      </div>
                    </div>
                  )}
                </div>

                {/* Command Dossier Column */}
                <div className="space-y-6 lg:col-span-7 lg:pl-6">
                  <div className="flex items-center gap-4">
                    <RankInsignia
                      tier={1}
                      customUrl={colonel.insigniaUrl}
                      rankTitle={colonel.rankTitle}
                      size="lg"
                    />
                    <div>
                      <p className="font-mono text-xs tracking-[0.24em] text-[#FFC928]">
                        01 · {RANK_LEVEL_LABELS[1]}
                      </p>
                      <h2 className="font-display text-5xl font-bold leading-none tracking-[0.12em] text-[#F1F3EC] sm:text-6xl">
                        {colonel.rankTitle}
                      </h2>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="h-[2px] w-16 bg-[#8BAA43]" />
                    <span className="h-[2px] w-4 bg-[#D62828]" />
                    <span className="h-[2px] w-3 bg-[#FFC928]" />
                  </div>

                  {colonelMembers[0] && (
                    <div className="space-y-2 pt-1">
                      <div className="flex flex-wrap items-center gap-3 font-mono text-[11px] tracking-[0.2em]">
                        <span className="text-[#A5AAA2]">COMANDO DESIGNADO</span>
                        <span aria-hidden="true" className="text-[#526B32]">
                          ·
                        </span>
                        <span
                          className={
                            STATUS_TEXT_COLOR[colonelMembers[0].status] || 'text-[#8BAA43]'
                          }
                        >
                          {colonelMembers[0].status.toUpperCase()}
                        </span>
                      </div>
                      <p className="font-display text-3xl font-bold tracking-wider text-[#F1F3EC] sm:text-4xl">
                        {colonelMembers[0].name}
                      </p>
                      {colonelMembers[0].description && (
                        <p className="max-w-2xl text-sm leading-relaxed text-[#A5AAA2]">
                          {colonelMembers[0].description}
                        </p>
                      )}
                    </div>
                  )}

                  <div className="pt-2">
                    <p className="font-mono text-[11px] tracking-[0.2em] text-[#526B32]">
                      ATRIBUIÇÕES DO CARGO
                    </p>
                    <p className="mt-3 max-w-2xl text-lg leading-relaxed text-[#F1F3EC]/90">
                      {colonel.responsibility}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              /* Case B: Multiple Coronels -> Elevated Apex Command Header + Harmonious Multi-Member Showcase */
              <div className="space-y-12">
                <div className="grid items-end gap-8 border-b border-[#263F24]/60 pb-8 lg:grid-cols-12">
                  <div className="flex items-center gap-4 lg:col-span-6">
                    <RankInsignia
                      tier={1}
                      customUrl={colonel.insigniaUrl}
                      rankTitle={colonel.rankTitle}
                      size="lg"
                    />
                    <div>
                      <p className="font-mono text-xs tracking-[0.24em] text-[#FFC928]">
                        01 · {RANK_LEVEL_LABELS[1]} ·{' '}
                        <span className="tabular-nums">{colonelMembers.length}</span> INTEGRANTES
                      </p>
                      <h2 className="mt-1 font-display text-5xl font-bold leading-none tracking-[0.12em] text-[#F1F3EC] sm:text-6xl">
                        {colonel.rankTitle}
                      </h2>
                      <div className="mt-3 flex items-center gap-2">
                        <span className="h-[2px] w-14 bg-[#8BAA43]" />
                        <span className="h-[2px] w-4 bg-[#D62828]" />
                        <span className="h-[2px] w-3 bg-[#FFC928]" />
                      </div>
                    </div>
                  </div>
                  <div className="lg:col-span-6">
                    <p className="max-w-2xl text-base leading-relaxed text-[#F1F3EC]/85">
                      {colonel.responsibility}
                    </p>
                  </div>
                </div>

                <div
                  className={
                    colonelMembers.length === 2
                      ? 'mx-auto grid max-w-4xl gap-10 md:grid-cols-2 lg:gap-14'
                      : 'grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3'
                  }
                >
                  {colonelMembers.map((member, idx) =>
                    renderMemberEditorialCard(member, colonel, idx, {
                      isColonel: true,
                      extraOffsetClass:
                        colonelMembers.length === 2 && idx === 1 ? 'md:mt-10' : undefined,
                    })
                  )}
                </div>
              </div>
            )}
          </motion.div>
        </section>
      )}

      {/* ==================== VERTICAL COMMAND TIERS (02..06) ==================== */}
      <div className="mx-auto max-w-[1380px] space-y-6 px-6 lg:px-12">
        {lowerRanks.map((rank, tierIndex) => {
          const members = publicMembersByRank[rank.id] || [];
          const reverseHeader = tierIndex % 2 === 1;

          return (
            <section key={rank.id} id={rank.id} className="scroll-mt-24">
              {/* Architectural Vertical Hierarchy Connector between Ranks */}
              <div aria-hidden="true" className="flex flex-col items-center py-6">
                <div className="h-12 w-px bg-gradient-to-b from-[#8BAA43]/75 via-[#526B32]/60 to-[#263F24]/25" />
                <div className="flex h-9 w-9 items-center justify-center border border-[#8BAA43]/65 bg-[#050705] font-mono text-xs font-bold text-[#8BAA43] tabular-nums">
                  {rank.positionCode}
                </div>
                <div className="h-6 w-px bg-gradient-to-b from-[#526B32]/60 to-transparent" />
              </div>

              {/* Rank Tier Band */}
              <div className="border-t border-[#263F24]/50 pt-10 pb-8">
                {/* Asymmetric Rank Tier Header */}
                <div className="grid items-end gap-8 lg:grid-cols-12">
                  <div
                    className={`flex items-center gap-4 lg:col-span-6 ${
                      reverseHeader ? 'lg:order-2 lg:justify-end lg:text-right' : ''
                    }`}
                  >
                    <div
                      className={`flex items-center gap-4 ${
                        reverseHeader ? 'lg:flex-row-reverse' : ''
                      }`}
                    >
                      <RankInsignia
                        tier={rank.tier}
                        customUrl={rank.insigniaUrl}
                        rankTitle={rank.rankTitle}
                        size="md"
                      />
                      <div>
                        <p className="font-mono text-[11px] tracking-[0.22em] text-[#8BAA43] tabular-nums">
                          {rank.positionCode} · {RANK_LEVEL_LABELS[rank.tier] || 'HIERARQUIA'}
                          {members.length > 0 && (
                            <span className="text-[#A5AAA2]">
                              {' '}
                              · {members.length}{' '}
                              {members.length === 1 ? 'INTEGRANTE' : 'INTEGRANTES'}
                            </span>
                          )}
                        </p>
                        <h2 className="mt-1 font-display text-4xl font-bold leading-none tracking-[0.12em] text-[#F1F3EC] sm:text-5xl">
                          {rank.rankTitle}
                        </h2>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`space-y-3 lg:col-span-6 ${
                      reverseHeader ? 'lg:order-1' : 'lg:pl-6'
                    }`}
                  >
                    <p className="max-w-xl text-base leading-relaxed text-[#A5AAA2]">
                      {rank.responsibility}
                    </p>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => setActiveTab('admin')}
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.16em] text-[#8BAA43] transition-colors hover:text-[#F1F3EC]"
                      >
                        <Plus className="h-3.5 w-3.5" />
                        GERENCIAR INTEGRANTES DE {rank.rankTitle}
                      </button>
                    )}
                  </div>
                </div>

                {/* Dynamic Multi-Member Editorial Presentation (0, 1, 2, 3, or unlimited members) */}
                <div className="mt-10">
                  {members.length === 0 ? (
                    /* 0 Members: Dignified asymmetric reserved frame */
                    <div className="grid items-center gap-8 lg:grid-cols-12">
                      <div
                        className={`lg:col-span-4 ${
                          reverseHeader ? 'lg:order-2 lg:col-start-9' : ''
                        }`}
                      >
                        <div className="aspect-[4/5] w-full max-w-[320px]">
                          <MediaImage
                            src=""
                            alt={`Espaço reservado — ${rank.rankTitle}`}
                            placeholderLabel={`REGISTRO — ${rank.rankTitle}`}
                            placeholderSubtext="ADICIONE INTEGRANTES NO PAINEL"
                            containerClassName="h-full w-full"
                            className="h-full w-full object-cover"
                            compact
                          />
                        </div>
                      </div>
                      <div
                        className={`lg:col-span-7 ${
                          reverseHeader ? 'lg:order-1 lg:text-right' : 'lg:col-start-6'
                        }`}
                      >
                        <div
                          className={`h-px w-16 bg-[#263F24] ${reverseHeader ? 'lg:ml-auto' : ''}`}
                        />
                        <p className="mt-4 font-mono text-xs tracking-[0.2em] text-[#A5AAA2]/70">
                          EFETIVO EM ATUALIZAÇÃO · PATENTE {rank.rankTitle}
                        </p>
                      </div>
                    </div>
                  ) : members.length === 1 ? (
                    /* 1 Member: Asymmetric Editorial Portrait Spotlight */
                    (() => {
                      const sole = members[0];
                      const hasPhoto = Boolean(resolveMediaUrl(sole.photoUrl));
                      const statusColor = STATUS_TEXT_COLOR[sole.status] || 'text-[#8BAA43]';
                      return (
                        <motion.article
                          initial={{ opacity: 0, y: 20 }}
                          whileInView={{ opacity: 1, y: 0 }}
                          viewport={{ once: true, amount: 0.2 }}
                          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                          className="grid items-center gap-8 lg:grid-cols-12 lg:gap-12"
                        >
                          <div
                            className={`lg:col-span-4 ${
                              reverseHeader ? 'lg:order-2 lg:col-start-9' : ''
                            }`}
                          >
                            <div
                              onClick={() => {
                                if (hasPhoto) setLightbox({ member: sole, rank });
                              }}
                              className={`relative aspect-[4/5] w-full overflow-hidden border border-[#263F24]/60 ${
                                hasPhoto ? 'cursor-zoom-in' : ''
                              }`}
                            >
                              <MediaImage
                                src={sole.photoUrl}
                                alt={`${rank.rankTitle} — ${sole.name}`}
                                placeholderLabel={`FOTOGRAFIA — ${rank.rankTitle}`}
                                placeholderSubtext="ADICIONE SUA IMAGEM"
                                containerClassName="h-full w-full"
                                className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.03]"
                                onQuickEdit={() => handleQuickMemberPhotoEdit(sole, rank)}
                                quickEditLabel={`Alterar Foto — ${sole.name}`}
                              />
                              <div
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#050705]/85 to-transparent"
                              />
                            </div>
                          </div>

                          <div
                            className={`space-y-4 lg:col-span-6 ${
                              reverseHeader
                                ? 'lg:order-1 lg:col-start-2 lg:text-right'
                                : 'lg:col-start-6'
                            }`}
                          >
                            <div
                              className={`flex flex-wrap items-center gap-2.5 font-mono text-xs tracking-[0.2em] ${
                                reverseHeader ? 'lg:justify-end' : ''
                              }`}
                            >
                              <span className="text-[#A5AAA2]">{rank.rankTitle}</span>
                              <span aria-hidden="true" className="text-[#526B32]">
                                ·
                              </span>
                              <span className={statusColor}>{sole.status.toUpperCase()}</span>
                            </div>

                            <h3 className="font-display text-4xl font-bold leading-tight tracking-[0.06em] text-[#F1F3EC] sm:text-5xl">
                              {sole.name}
                            </h3>

                            <div
                              className={`h-px w-20 bg-[#526B32]/80 ${
                                reverseHeader ? 'lg:ml-auto' : ''
                              }`}
                            />

                            {sole.description && (
                              <p
                                className={`max-w-xl text-base leading-relaxed text-[#A5AAA2] ${
                                  reverseHeader ? 'lg:ml-auto' : ''
                                }`}
                              >
                                {sole.description}
                              </p>
                            )}
                          </div>
                        </motion.article>
                      );
                    })()
                  ) : members.length === 2 ? (
                    /* 2 Members: Bespoke Asymmetric Diptych with Subtle Editorial Offset */
                    <div className="mx-auto grid max-w-4xl gap-10 md:grid-cols-2 lg:gap-16">
                      {members.map((member, idx) =>
                        renderMemberEditorialCard(member, rank, idx, {
                          extraOffsetClass: idx === 1 ? 'md:mt-10' : undefined,
                        })
                      )}
                    </div>
                  ) : members.length === 3 ? (
                    /* 3 Members: Editorial Triptych with Subtle Architectural Stagger */
                    <div className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-10">
                      {members.map((member, idx) =>
                        renderMemberEditorialCard(member, rank, idx, {
                          extraOffsetClass: idx === 1 ? 'lg:mt-8' : undefined,
                        })
                      )}
                    </div>
                  ) : (
                    /* 4+ Members (Unlimited Scalability): Clean Breathable 4-Column Architectural Wall */
                    <div className="grid gap-x-7 gap-y-12 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                      {members.map((member, idx) => renderMemberEditorialCard(member, rank, idx))}
                    </div>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      {/* ==================== PORTRAIT LIGHTBOX ==================== */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#050705]/95 p-4 backdrop-blur-md"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Fechar visualização"
            className="absolute right-6 top-6 flex h-11 w-11 items-center justify-center border border-[#263F24] bg-[#0B100C] text-[#F1F3EC] hover:border-[#8BAA43]"
          >
            <X className="h-5 w-5" />
          </button>

          <div
            className="max-w-3xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={resolveMediaUrl(lightbox.member.photoUrl)}
              alt={`${lightbox.rank.rankTitle} — ${lightbox.member.name}`}
              referrerPolicy="no-referrer"
              className="mx-auto max-h-[72vh] w-auto border border-[#263F24]/60 object-contain"
            />
            <div className="mt-5 space-y-1.5">
              <div className="flex items-center justify-center gap-3 font-mono text-xs tracking-[0.22em]">
                <span className="text-[#8BAA43]">{lightbox.rank.rankTitle}</span>
                <span aria-hidden="true" className="text-[#526B32]">
                  ·
                </span>
                <span
                  className={STATUS_TEXT_COLOR[lightbox.member.status] || 'text-[#8BAA43]'}
                >
                  {lightbox.member.status.toUpperCase()}
                </span>
              </div>
              <p className="font-display text-3xl font-bold tracking-[0.1em] text-[#F1F3EC]">
                {lightbox.member.name}
              </p>
              {lightbox.member.description && (
                <p className="mx-auto max-w-xl text-sm leading-relaxed text-[#A5AAA2]">
                  {lightbox.member.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
