import React from 'react';
import { motion } from 'motion/react';
import { ArrowUpRight } from 'lucide-react';
import { DISCORD_INVITE_URL, DiscordIcon } from './DiscordIcon';

export const DiscordCommunitySection: React.FC = () => {
  return (
    <motion.section
      aria-labelledby="discord-community-heading"
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
      className="relative mx-auto max-w-[1380px] px-6 lg:px-12"
    >
      <div className="relative overflow-hidden border-y border-[#5865F2]/35 bg-gradient-to-br from-[#0B0E1D]/95 via-[#090B14]/96 to-[#050705] px-6 py-14 sm:px-10 sm:py-16 lg:px-16 lg:py-20">
        {/* Ambient Discord blue/violet atmospheric glow */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-20 -top-24 h-80 w-80 rounded-full bg-[#5865F2]/22 blur-[110px]"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-24 left-12 h-72 w-72 rounded-full bg-[#7C5CFF]/16 blur-[110px]"
        />

        {/* Subtle geometric optical corner reticles echoing the 1.F.M.O.T design language */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-4 h-4 w-4 border-l border-t border-[#5865F2]/55"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-4 top-4 h-4 w-4 border-r border-t border-[#7C5CFF]/55"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-4 left-4 h-4 w-4 border-b border-l border-[#5865F2]/55"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute bottom-4 right-4 h-4 w-4 border-b border-r border-[#8BAA43]/50"
        />

        <div className="relative z-10 grid items-center gap-12 lg:grid-cols-12">
          {/* Left Column: Editorial Headline, Description & Primary CTA */}
          <div className="space-y-6 lg:col-span-7">
            <p className="font-mono text-xs tracking-[0.26em] text-[#8E9BFF]">
              SERVIDOR OFICIAL · DISCORD 1.F.M.O.T
            </p>

            <h2
              id="discord-community-heading"
              className="font-display text-4xl font-bold leading-[0.95] tracking-[0.06em] text-[#F1F3EC] sm:text-5xl lg:text-6xl"
            >
              ENTRE PARA NOSSA COMUNIDADE
            </h2>

            {/* Signature accent line bridging Discord blurple/purple with 1.F.M.O.T green */}
            <div className="flex items-center gap-2.5">
              <span className="h-[2px] w-16 bg-[#5865F2]" />
              <span className="h-[2px] w-6 bg-[#7C5CFF]" />
              <span className="h-[2px] w-3 bg-[#8BAA43]" />
            </div>

            <p className="max-w-2xl text-base leading-relaxed text-[#C7CCD8] sm:text-lg">
              Faça parte da nossa comunidade oficial, acompanhe os comunicados, participe das
              atividades e fique por dentro de tudo o que acontece na corporação.
            </p>

            <div className="flex flex-wrap items-center gap-6 pt-2">
              <a
                href={DISCORD_INVITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative inline-flex items-center gap-3 bg-gradient-to-r from-[#5865F2] via-[#6857F5] to-[#4752C4] px-8 py-4 text-xs font-bold tracking-[0.18em] text-[#F1F3EC] shadow-[0_8px_28px_rgba(88,101,242,0.32)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_14px_40px_rgba(124,92,255,0.48)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#8E9BFF] whitespace-nowrap shrink-0"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-0 bg-white/0 transition-colors duration-200 group-hover:bg-white/10"
                />
                <DiscordIcon className="relative h-5 w-5 transition-transform duration-200 group-hover:scale-110" />
                <span className="relative">ENTRAR NO DISCORD</span>
                <ArrowUpRight className="relative h-4 w-4 text-[#D8DCFF] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>

              <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-[#A5AAA2]">
                <span>Comunicados</span>
                <span aria-hidden="true" className="text-[#5865F2]">
                  ·
                </span>
                <span>Atividades</span>
                <span aria-hidden="true" className="text-[#7C5CFF]">
                  ·
                </span>
                <span>Comunidade BRP</span>
              </div>
            </div>
          </div>

          {/* Right Column: Featured Official Discord Icon Stage with Discreet Floating Motion */}
          <div className="flex justify-center lg:col-span-5 lg:justify-end">
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Acessar o servidor oficial da 1.F.M.O.T no Discord"
              className="group relative flex h-56 w-56 items-center justify-center sm:h-64 sm:w-64 lg:h-72 lg:w-72"
            >
              {/* Layered atmospheric rings */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full border border-[#5865F2]/25 transition-transform duration-500 group-hover:scale-105"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-5 rounded-full border border-[#7C5CFF]/30 bg-gradient-to-br from-[#5865F2]/16 via-[#161B38]/75 to-[#050705]/90 shadow-[0_0_60px_rgba(88,101,242,0.22)] transition-all duration-300 group-hover:border-[#8E9BFF]/60 group-hover:shadow-[0_0_80px_rgba(124,92,255,0.36)]"
              />

              {/* Discreet animated official Discord icon */}
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 4.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
                className="relative z-10 flex flex-col items-center gap-3"
              >
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#5865F2] to-[#6F52F5] text-white shadow-[0_12px_36px_rgba(88,101,242,0.5)] transition-transform duration-300 group-hover:scale-105 sm:h-28 sm:w-28">
                  <DiscordIcon className="h-12 w-12 sm:h-14 sm:w-14" />
                </div>
                <span className="font-mono text-[10px] tracking-[0.26em] text-[#A9B2FF] transition-colors group-hover:text-[#F1F3EC]">
                  1.F.M.O.T · DISCORD
                </span>
              </motion.div>
            </a>
          </div>
        </div>
      </div>
    </motion.section>
  );
};
