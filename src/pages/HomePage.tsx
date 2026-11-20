import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { MediaImage } from '../components/MediaImage';
import { DiscordCommunitySection } from '../components/DiscordCommunitySection';
import { usePortal } from '../context/PortalContext';
import { PortalTab } from '../types/portal';

const CHAPTERS: {
  id: PortalTab;
  index: string;
  title: string;
  subtitle: string;
}[] = [
  {
    id: 'quem_somos',
    index: '02',
    title: 'Quem Somos',
    subtitle: 'Identidade no BRP, operações diárias e semanais e o que nos diferencia.',
  },
  {
    id: 'hierarquia',
    index: '03',
    title: 'Hierarquia',
    subtitle: 'Estrutura de comando vertical: Coronel, Capitão, Sargento, Cabo, Soldado e Recruta.',
  },
  {
    id: 'funcoes',
    index: '04',
    title: 'Funções',
    subtitle: 'Frentes de comando, operações especiais, fiscalização, capacitação e tropa.',
  },
  {
    id: 'operacoes',
    index: '05',
    title: 'Trabalhos e Operações',
    subtitle: 'Acervo editorial das operações e atividades conduzidas pela corporação.',
  },
  {
    id: 'galeria',
    index: '06',
    title: 'Galeria',
    subtitle: 'Exposição visual de registros oficiais e momentos da 1.F.M.O.T.',
  },
];

export const HomePage: React.FC = () => {
  const {
    config,
    logoUrl,
    slotsMap,
    setActiveTab,
    openQuickImageEditor,
    savePortalSlot,
    resetPortalSlot,
  } = usePortal();

  const heroSlot = slotsMap['home_hero'];
  const bannerSlot = slotsMap['home_banner'];
  const logoSlot = slotsMap['logo_official'];

  const openSlotEdit = (slotId: string, preserveTransparency = false) => {
    const slot = slotsMap[slotId];
    if (!slot) return;
    openQuickImageEditor({
      title: slot.label,
      page: slot.page,
      currentUrl: slot.imageUrl,
      preserveTransparency,
      onPublish: async (imageUrl, assetId) => {
        await savePortalSlot({ ...slot, imageUrl, mediaAssetId: assetId || '' });
      },
      onRemove: async () => {
        await resetPortalSlot(slotId);
      },
    });
  };

  return (
    <div className="space-y-28 pb-10 lg:space-y-36">
      {/* 1. CINEMATOGRAPHIC OPENING STAGE — Full-width, Asymmetric, Unboxed */}
      <section className="relative pt-10 sm:pt-14 lg:pt-20">
        {/* Ambient green light spill */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -top-24 right-0 h-[420px] w-[420px] rounded-full bg-[#263F24]/30 blur-[120px]"
        />

        <div className="mx-auto max-w-[1380px] px-6 lg:px-12">
          <div className="grid items-center gap-12 lg:grid-cols-12">
            {/* Giant Monumental Brand Typography */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="lg:col-span-8"
            >
              <p className="font-mono text-xs tracking-[0.28em] text-[#8BAA43]">
                PORTAL INSTITUCIONAL · BRP
              </p>

              <h1 className="mt-4 font-display text-7xl font-bold leading-[0.86] tracking-[0.06em] text-[#F1F3EC] sm:text-8xl lg:text-[7.5rem]">
                1.F.M.O.T
              </h1>

              {/* Signature micro-bar echoing the emblem's green / red / yellow */}
              <div className="mt-6 flex items-center gap-2.5">
                <span className="h-[2px] w-20 bg-[#8BAA43]" />
                <span className="h-[2px] w-4 bg-[#D62828]" />
                <span className="h-[2px] w-2.5 bg-[#FFC928]" />
              </div>

              <p className="mt-8 max-w-2xl font-display text-2xl font-semibold leading-snug tracking-wide text-[#F1F3EC] sm:text-3xl">
                {config.heroHeadline}
              </p>

              <p className="mt-5 max-w-xl text-base leading-relaxed text-[#A5AAA2]">
                {config.heroSubtext}
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-6">
                <button
                  type="button"
                  onClick={() => setActiveTab('quem_somos')}
                  className="group inline-flex items-center gap-3 bg-[#263F24] px-7 py-3.5 text-xs font-semibold tracking-[0.18em] text-[#F1F3EC] transition-all duration-200 hover:bg-[#526B32] whitespace-nowrap shrink-0"
                >
                  CONHECER A CORPORAÇÃO
                  <ArrowUpRight className="h-4 w-4 text-[#8BAA43] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('hierarquia')}
                  className="group inline-flex items-center gap-2 border-b border-[#526B32] pb-1.5 text-xs font-semibold tracking-[0.18em] text-[#A5AAA2] transition-colors hover:border-[#8BAA43] hover:text-[#F1F3EC] whitespace-nowrap shrink-0"
                >
                  ESTRUTURA DE COMANDO
                  <ArrowUpRight className="h-3.5 w-3.5 text-[#8BAA43]" />
                </button>
              </div>
            </motion.div>

            {/* Floating Official Emblem Showcase (Unboxed, Preserving Exact Proportions & Transparency) */}
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.65, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
              className="flex justify-center lg:col-span-4 lg:justify-end"
            >
              <div className="relative">
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-4 rounded-full bg-[#526B32]/25 blur-3xl"
                />
                <MediaImage
                  src={logoUrl}
                  alt="Emblema oficial da corporação 1.F.M.O.T"
                  objectFit="contain"
                  containerClassName="relative h-60 w-60 sm:h-72 sm:w-72 lg:h-80 lg:w-80 bg-transparent"
                  className="h-full w-full drop-shadow-[0_20px_50px_rgba(38,63,36,0.55)]"
                  onQuickEdit={logoSlot ? () => openSlotEdit('logo_official', true) : undefined}
                  quickEditLabel="Alterar Logo Oficial"
                />
              </div>
            </motion.div>
          </div>
        </div>

        {/* Panoramic Institutional Photography Stage with Overlapping Editorial Caption */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
          className="relative mx-auto mt-16 max-w-[1440px] px-0 sm:px-6 lg:mt-20 lg:px-12"
        >
          <div className="relative aspect-[16/9] w-full sm:aspect-[21/9]">
            <MediaImage
              src={heroSlot?.imageUrl}
              alt={heroSlot?.title || 'Fotografia panorâmica 1.F.M.O.T'}
              placeholderLabel="FOTOGRAFIA INSTITUCIONAL PANORÂMICA"
              placeholderSubtext="ADICIONE SUA IMAGEM PELO PAINEL ADMINISTRATIVO"
              containerClassName="h-full w-full"
              className="h-full w-full object-cover"
              onQuickEdit={() => openSlotEdit('home_hero')}
              quickEditLabel="Alterar Fotografia Panorâmica"
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#050705] via-transparent to-[#050705]/30"
            />
          </div>

          {/* Overlapping Editorial Strip breaking container boundary */}
          <div className="relative z-10 mx-6 -mt-10 max-w-xl bg-[#050705]/95 px-7 py-6 backdrop-blur-md sm:mx-10 lg:-mt-14 lg:ml-14">
            <p className="font-mono text-[11px] tracking-[0.22em] text-[#8BAA43]">
              PRESENÇA OPERACIONAL
            </p>
            <p className="mt-2 text-sm leading-relaxed text-[#F1F3EC]/90">
              Operações diárias e semanais voltadas à disciplina, organização e evolução constante
              do efetivo dentro do BRP.
            </p>
          </div>
        </motion.div>
      </section>

      {/* 2. MONUMENTAL DIFFERENTIATOR BAND */}
      <motion.section
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative border-y border-[#263F24]/45 bg-gradient-to-r from-[#050705] via-[#0B140C]/85 to-[#050705] py-20 lg:py-28"
      >
        <div className="mx-auto max-w-[1220px] px-6 text-center lg:px-12">
          <p className="font-mono text-xs tracking-[0.28em] text-[#8BAA43]">
            IDENTIDADE NO BRP
          </p>
          <blockquote className="mx-auto mt-6 max-w-4xl font-display text-3xl font-bold leading-tight tracking-wide text-[#F1F3EC] sm:text-5xl lg:text-6xl">
            “{config.aboutDifferentiator}”
          </blockquote>
        </div>
      </motion.section>

      {/* 3. ASYMMETRIC ARCHITECTURAL PORTAL DIRECTORY (Ruled Editorial Rows, Zero Boxed Cards) */}
      <section className="mx-auto max-w-[1380px] px-6 lg:px-12">
        <div className="mb-12 grid items-end gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="font-mono text-xs tracking-[0.24em] text-[#8BAA43]">
              NAVEGAÇÃO INSTITUCIONAL
            </p>
            <h2 className="mt-2 font-display text-4xl font-bold tracking-wide text-[#F1F3EC] sm:text-5xl">
              Explore a Estrutura da 1.F.M.O.T
            </h2>
          </div>
          <p className="text-sm leading-relaxed text-[#A5AAA2] lg:col-span-5 lg:text-right">
            Cada área do portal apresenta nossa organização, cadeia de comando e registros oficiais.
          </p>
        </div>

        <div className="border-t border-[#263F24]/50">
          {CHAPTERS.map((chapter, i) => (
            <motion.button
              key={chapter.id}
              type="button"
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              onClick={() => setActiveTab(chapter.id)}
              className="group grid w-full grid-cols-12 items-center gap-4 border-b border-[#263F24]/45 py-7 text-left transition-colors duration-200 hover:bg-[#263F24]/15 px-2 sm:px-4"
            >
              <span className="col-span-2 font-mono text-xs text-[#526B32] transition-colors group-hover:text-[#8BAA43] tabular-nums sm:col-span-1">
                {chapter.index}
              </span>
              <span className="col-span-8 font-display text-2xl font-bold tracking-wide text-[#F1F3EC] transition-all duration-200 group-hover:translate-x-2 group-hover:text-[#8BAA43] sm:col-span-4 sm:text-3xl">
                {chapter.title}
              </span>
              <span className="col-span-12 text-sm text-[#A5AAA2] sm:col-span-6 sm:pl-4">
                {chapter.subtitle}
              </span>
              <span className="col-span-2 hidden justify-end sm:col-span-1 sm:flex">
                <ArrowUpRight className="h-5 w-5 text-[#526B32] transition-all duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#8BAA43]" />
              </span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* 4. ASYMMETRIC VISUAL HIGHLIGHT BAND */}
      <section className="mx-auto max-w-[1380px] px-6 lg:px-12">
        <div className="grid items-center gap-10 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <div className="aspect-[16/9] w-full">
              <MediaImage
                src={bannerSlot?.imageUrl}
                alt={bannerSlot?.title || 'Registro institucional da 1.F.M.O.T'}
                placeholderLabel="REGISTRO DA CORPORAÇÃO"
                placeholderSubtext="ADICIONE SUA IMAGEM"
                containerClassName="h-full w-full"
                className="h-full w-full object-cover"
                onQuickEdit={() => openSlotEdit('home_banner')}
                quickEditLabel="Alterar Registro em Destaque"
              />
            </div>
          </div>

          <div className="space-y-6 lg:col-span-4 lg:-ml-16 relative z-10 bg-[#050705]/92 p-7 sm:p-9 backdrop-blur-md">
            <p className="font-mono text-xs tracking-[0.24em] text-[#8BAA43]">
              COMANDO E DISCIPLINA
            </p>
            <h2 className="font-display text-3xl font-bold leading-tight text-[#F1F3EC]">
              Seis Patentes. Uma Única Direção.
            </h2>
            <p className="text-sm leading-relaxed text-[#A5AAA2]">
              Do Coronel ao Recruta, cada patente da 1.F.M.O.T cumpre responsabilidades claras,
              garantindo ordem, capacitação contínua e excelência em cada operação.
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('hierarquia')}
              className="group inline-flex items-center gap-2 border-b border-[#8BAA43] pb-1.5 text-xs font-semibold tracking-[0.18em] text-[#F1F3EC] transition-colors hover:text-[#8BAA43]"
            >
              VISUALIZAR HIERARQUIA COMPLETA
              <ArrowUpRight className="h-4 w-4 text-[#8BAA43]" />
            </button>
          </div>
        </div>
      </section>

      {/* 5. OFFICIAL DISCORD COMMUNITY SECTION */}
      <DiscordCommunitySection />
    </div>
  );
};
