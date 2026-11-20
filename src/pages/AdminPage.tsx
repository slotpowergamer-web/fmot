import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Database,
  ExternalLink,
  Eye,
  Image as ImageIcon,
  Loader2,
  Lock,
  LogOut,
  Pencil,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { AdminRecordsPanel, AdminRecordSection } from '../components/admin/AdminRecordsPanel';
import { AdminSupabaseMigrationPanel } from '../components/admin/AdminSupabaseMigrationPanel';
import { MediaImage } from '../components/MediaImage';
import { usePortal } from '../context/PortalContext';
import { ManagedPageKey, PortalConfig, PortalSlot } from '../types/portal';
import { formatFileSize, optimizeImageFile } from '../utils/imageOptimizer';

type AdminTab = 'hierarquia' | 'imagens_paginas' | Exclude<AdminRecordSection, 'hierarquia'> | 'textos_config' | 'acervo_midia';

const PAGE_LABELS: Record<ManagedPageKey, string> = {
  identidade: 'Identidade e Logo Oficial',
  inicio: 'Início',
  quem_somos: 'Quem Somos',
  hierarquia: 'Hierarquia',
  funcoes: 'Funções',
  operacoes: 'Trabalhos e Operações',
  galeria: 'Galeria',
};

export const AdminPage: React.FC = () => {
  const {
    user,
    authReady,
    isAdmin,
    authError,
    signInAdmin,
    signOutAdmin,
    editMode,
    setEditMode,
    slots,
    savePortalSlot,
    resetPortalSlot,
    config,
    savePortalConfig,
    mediaAssets,
    hierarchyMembers,
    uploadMediaAsset,
    replaceMediaAsset,
    deleteMediaAsset,
    openQuickImageEditor,
    resolveMediaUrl,
    loadingMediaLibrary,
    loadFullMediaLibrary,
    quotaExceeded,
    quotaUpgradeUrl,
    supabaseAdminEmail,
    supabaseReadyForWrites,
    signInSupabaseAdmin,
    showToast,
  } = usePortal();

  const [adminTab, setAdminTab] = useState<AdminTab>('hierarquia');
  const [pageFilter, setPageFilter] = useState<string>('todas');
  const [slotEdits, setSlotEdits] = useState<Record<string, { title: string; description: string }>>(
    {}
  );
  const [draftConfig, setDraftConfig] = useState<PortalConfig>(config);
  const [savingConfig, setSavingConfig] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; title: string } | null>(null);

  // Direct Supabase Admin login state (used on Login Gate and inline session banner)
  const [sbEmail, setSbEmail] = useState('slotpowergamer@gmail.com');
  const [sbPassword, setSbPassword] = useState('');
  const [sbSigningIn, setSbSigningIn] = useState(false);
  const [sbLoginError, setSbLoginError] = useState<string | null>(null);

  // Acervo direct upload / replace / delete state
  const [acervoUploadPage, setAcervoUploadPage] = useState<ManagedPageKey>('galeria');
  const [uploadingAcervo, setUploadingAcervo] = useState(false);
  const [replacingAssetId, setReplacingAssetId] = useState<string | null>(null);
  const [deletingAssetId, setDeletingAssetId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const acervoUploadInputRef = useRef<HTMLInputElement | null>(null);
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const pendingReplaceTargetRef = useRef<string | null>(null);

  useEffect(() => {
    setDraftConfig(config);
  }, [config]);

  useEffect(() => {
    if (isAdmin && (adminTab === 'acervo_midia' || adminTab === 'hierarquia')) {
      void loadFullMediaLibrary();
    }
  }, [isAdmin, adminTab, loadFullMediaLibrary]);

  const handleSupabaseLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSbSigningIn(true);
    setSbLoginError(null);
    try {
      await signInSupabaseAdmin(sbEmail, sbPassword);
      setSbPassword('');
    } catch (err) {
      setSbLoginError(
        err instanceof Error ? err.message : 'Falha ao autenticar conta administrativa no Supabase.'
      );
    } finally {
      setSbSigningIn(false);
    }
  };

  const handleAcervoDirectUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadingAcervo(true);
    try {
      const optimized = await optimizeImageFile(file, {
        preserveTransparency: acervoUploadPage === 'identidade',
        maxDimension: acervoUploadPage === 'identidade' ? 1200 : 1920,
      });
      await uploadMediaAsset(optimized, {
        page: acervoUploadPage,
        title: file.name.replace(/\.[^.]+$/, ''),
      });
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao enviar imagem para o Supabase.', 'error');
    } finally {
      setUploadingAcervo(false);
      if (acervoUploadInputRef.current) acervoUploadInputRef.current.value = '';
    }
  };

  const handleAcervoReplaceFile = async (file: File | undefined) => {
    const targetId = pendingReplaceTargetRef.current;
    if (!file || !targetId) return;
    const existing = mediaAssets.find((item) => item.id === targetId);
    setReplacingAssetId(targetId);
    try {
      const optimized = await optimizeImageFile(file, {
        preserveTransparency: existing?.page === 'identidade',
        maxDimension: existing?.page === 'identidade' ? 1200 : 1920,
      });
      await replaceMediaAsset(targetId, optimized);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao substituir imagem no Supabase.', 'error');
    } finally {
      setReplacingAssetId(null);
      pendingReplaceTargetRef.current = null;
      if (replaceInputRef.current) replaceInputRef.current.value = '';
    }
  };

  const handleAcervoDelete = async (assetId: string) => {
    setDeletingAssetId(assetId);
    try {
      await deleteMediaAsset(assetId);
      setConfirmDeleteId(null);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro ao excluir imagem do Supabase.', 'error');
    } finally {
      setDeletingAssetId(null);
    }
  };

  const handleSlotMetaSave = async (slot: PortalSlot) => {
    const edited = slotEdits[slot.id];
    await savePortalSlot({
      ...slot,
      title: edited?.title ?? slot.title,
      description: edited?.description ?? slot.description,
    });
  };

  if (!authReady) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[#8BAA43]" />
      </div>
    );
  }

  // Protected Login Gate
  const activeAdminEmail = supabaseAdminEmail || user?.email || '';
  if (!isAdmin || !activeAdminEmail) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24">
        <div className="border border-[#263F24]/70 bg-[#0B100C]/95 p-8 sm:p-10">
          <div className="flex items-center gap-3 text-[#8BAA43]">
            <Lock className="h-5 w-5" />
            <p className="font-mono text-xs tracking-[0.22em]">ÁREA ADMINISTRATIVA · 1.F.M.O.T</p>
          </div>
          <h1 className="mt-4 font-display text-4xl font-bold text-[#F1F3EC]">
            Gerenciamento de Imagens e Hierarquia
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-[#A5AAA2]">
            Acesso exclusivo para administradores autorizados da 1.F.M.O.T. Entre com sua conta
            administrativa do Supabase para enviar, substituir e gerenciar fotografias diretamente
            no bucket <span className="font-mono text-[#F1F3EC]">fmot-media</span>.
          </p>

          {user && !isAdmin && (
            <div className="mt-6 flex items-start gap-3 border border-[#D62828]/60 bg-[#D62828]/10 p-4 text-xs text-[#F1F3EC]">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#D62828]" />
              <div>
                <p className="font-semibold">Conta sem permissão administrativa</p>
                <p className="mt-1 text-[#A5AAA2]">
                  A conta {user.email} não tem autorização para alterar conteúdos da 1.F.M.O.T.
                </p>
              </div>
            </div>
          )}

          {(sbLoginError || authError) && (
            <div className="mt-5 border border-[#D62828]/60 bg-[#D62828]/10 p-3.5 text-xs text-[#F1F3EC]">
              {sbLoginError || authError}
            </div>
          )}

          {/* Primary Login: Supabase Admin (E-mail + Senha) */}
          <form onSubmit={(e) => void handleSupabaseLoginSubmit(e)} className="mt-7 space-y-3.5">
            <p className="font-mono text-[11px] tracking-[0.18em] text-[#8BAA43]">
              ACESSO PRINCIPAL · SUPABASE STORAGE (fmot-media)
            </p>
            <div>
              <label className="block text-xs text-[#A5AAA2]">E-mail administrativo</label>
              <input
                type="email"
                required
                value={sbEmail}
                onChange={(e) => setSbEmail(e.target.value)}
                placeholder="slotpowergamer@gmail.com"
                className="mt-1 w-full border border-[#263F24] bg-[#050705] px-3.5 py-2.5 text-sm text-[#F1F3EC] focus:border-[#8BAA43] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-[#A5AAA2]">Senha no Supabase Auth</label>
              <input
                type="password"
                required
                value={sbPassword}
                onChange={(e) => setSbPassword(e.target.value)}
                placeholder="Digite sua senha de administrador"
                className="mt-1 w-full border border-[#263F24] bg-[#050705] px-3.5 py-2.5 text-sm text-[#F1F3EC] focus:border-[#8BAA43] focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={sbSigningIn}
              className="inline-flex w-full items-center justify-center gap-2.5 bg-[#526B32] px-6 py-3 text-xs font-semibold tracking-wider text-[#F1F3EC] transition-colors hover:bg-[#8BAA43] hover:text-[#050705] disabled:opacity-50"
            >
              {sbSigningIn ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              {sbSigningIn ? 'AUTENTICANDO NO SUPABASE...' : 'ENTRAR NO PAINEL COM SUPABASE'}
            </button>
          </form>

          {/* Secondary Login: Google Account (for Firebase backup inspection) */}
          <div className="mt-6 border-t border-[#263F24]/50 pt-5">
            <p className="mb-3 text-[11px] text-[#A5AAA2]">
              Ou acesse via conta Google autorizada (necessária apenas para inspecionar o backup do
              Firebase):
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void signInAdmin()}
                className="inline-flex items-center gap-2.5 border border-[#263F24] bg-[#050705] px-5 py-2.5 text-xs font-semibold tracking-wider text-[#F1F3EC] transition-colors hover:border-[#8BAA43] whitespace-nowrap shrink-0"
              >
                <Lock className="h-3.5 w-3.5 text-[#8BAA43]" />
                ENTRAR COM CONTA GOOGLE AUTORIZADA
              </button>

              {user && (
                <button
                  type="button"
                  onClick={() => void signOutAdmin()}
                  className="inline-flex items-center gap-2 border border-[#263F24] px-4 py-2.5 text-xs text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC]"
                >
                  <LogOut className="h-4 w-4" />
                  Trocar Conta
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const slotPageOptions: ('todas' | ManagedPageKey)[] = [
    'todas',
    'identidade',
    'inicio',
    'quem_somos',
  ];

  const visibleSlots =
    pageFilter === 'todas' ? slots : slots.filter((s) => s.page === pageFilter);

  return (
    <div className="mx-auto max-w-[1380px] space-y-10 px-6 pb-16 pt-10 lg:px-12 lg:pt-16">
      {/* Header */}
      <header className="flex flex-col justify-between gap-6 border-b border-[#263F24]/55 pb-8 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-xs tracking-[0.24em] text-[#8BAA43]">
            CENTRAL ADMINISTRATIVA · 1.F.M.O.T
          </p>
          <h1 className="mt-2 font-display text-5xl font-bold text-[#F1F3EC]">
            Painel de Mídia e Conteúdo
          </h1>
          <p className="mt-2 text-xs text-[#A5AAA2]">
            Autenticado como <span className="text-[#F1F3EC]">{activeAdminEmail}</span> ·{' '}
            {supabaseReadyForWrites
              ? 'Armazenamento ativo no Supabase Storage (Firebase preservado para recuperação).'
              : 'Armazenamento persistente em banco de dados.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setEditMode(!editMode)}
            className={`inline-flex items-center gap-2 border px-4 py-2.5 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              editMode
                ? 'border-[#8BAA43] bg-[#263F24] text-[#F1F3EC]'
                : 'border-[#526B32] bg-[#0B100C] text-[#F1F3EC] hover:border-[#8BAA43]'
            }`}
          >
            <Pencil className="h-3.5 w-3.5 text-[#8BAA43]" />
            {editMode ? 'Edição Direta nas Páginas: ATIVA' : 'Ativar Edição Direta nas Páginas'}
          </button>

          <button
            type="button"
            onClick={() => void signOutAdmin()}
            className="inline-flex items-center gap-2 border border-[#263F24] px-4 py-2.5 text-xs font-semibold text-[#A5AAA2] hover:border-[#D62828] hover:text-[#F1F3EC] whitespace-nowrap shrink-0"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sair
          </button>
        </div>
      </header>

      {/* Inline Supabase Session Connector when admin entered via Google without Supabase Auth */}
      {!supabaseAdminEmail && (
        <form
          onSubmit={(e) => void handleSupabaseLoginSubmit(e)}
          className="space-y-3 border border-[#8BAA43]/60 bg-[#0B100C] p-5"
        >
          <div className="flex items-start gap-3">
            <Database className="mt-0.5 h-4 w-4 shrink-0 text-[#8BAA43]" />
            <div className="text-xs">
              <p className="font-semibold text-[#F1F3EC]">
                Conecte sua sessão Supabase para liberar uploads diretos no bucket fmot-media
              </p>
              <p className="mt-0.5 text-[#A5AAA2]">
                Todas as novas imagens e edições são salvas diretamente no Supabase Storage e
                PostgreSQL, sem depender do Firebase.
              </p>
            </div>
          </div>
          {sbLoginError && (
            <div className="border border-[#D62828]/60 bg-[#D62828]/10 px-3 py-2 text-xs text-[#F1F3EC]">
              {sbLoginError}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="email"
              required
              value={sbEmail}
              onChange={(e) => setSbEmail(e.target.value)}
              placeholder="E-mail admin no Supabase"
              className="border border-[#263F24] bg-[#050705] px-3 py-2 text-xs text-[#F1F3EC]"
            />
            <input
              type="password"
              required
              value={sbPassword}
              onChange={(e) => setSbPassword(e.target.value)}
              placeholder="Senha da conta no Supabase Auth"
              className="border border-[#263F24] bg-[#050705] px-3 py-2 text-xs text-[#F1F3EC]"
            />
            <button
              type="submit"
              disabled={sbSigningIn}
              className="inline-flex items-center justify-center gap-2 bg-[#526B32] px-4 py-2 text-xs font-semibold text-[#F1F3EC] transition-colors hover:bg-[#8BAA43] hover:text-[#050705] disabled:opacity-50"
            >
              {sbSigningIn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />}
              Conectar Sessão Supabase
            </button>
          </div>
        </form>
      )}

      {/* Admin-Only Firestore Quota Notice (shown only when Supabase does not hold primary data yet) */}
      {quotaExceeded && !supabaseReadyForWrites && (
        <div className="flex flex-col justify-between gap-4 border border-[#8BAA43]/60 bg-[#0B100C] p-5 sm:flex-row sm:items-center">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-[#8BAA43]" />
            <div className="space-y-1 text-xs">
              <p className="font-semibold text-[#F1F3EC]">
                Limite diário gratuito de leituras do Firestore atingido (backup legado)
              </p>
              <p className="leading-relaxed text-[#A5AAA2]">
                As novas fotografias enviadas pelo painel administrativo são gravadas diretamente no
                Supabase Storage (<span className="font-mono text-[#F1F3EC]">fmot-media</span>) e
                não dependem do Firebase. Os registros antigos do Firebase permanecem preservados
                como backup.
              </p>
            </div>
          </div>
          <a
            href={quotaUpgradeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex shrink-0 items-center gap-2 border border-[#8BAA43] bg-[#263F24]/60 px-4 py-2.5 text-xs font-semibold text-[#F1F3EC] transition-colors hover:bg-[#8BAA43] hover:text-[#050705] whitespace-nowrap"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Abrir Firebase Console
          </a>
        </div>
      )}

      {/* Admin Section Navigation */}
      <nav
        aria-label="Áreas administrativas"
        className="flex flex-wrap items-center gap-6 border-b border-[#263F24]/45"
      >
        {(
          [
            {
              id: 'hierarquia',
              label:
                hierarchyMembers.length > 0
                  ? `Gerenciar Hierarquia (${hierarchyMembers.length})`
                  : 'Gerenciar Hierarquia',
            },
            { id: 'imagens_paginas', label: 'Imagens por Página' },
            { id: 'funcoes', label: 'Funções' },
            { id: 'operacoes', label: 'Trabalhos e Operações' },
            { id: 'galeria', label: 'Galeria' },
            { id: 'textos_config', label: 'Textos Institucionais' },
            { id: 'acervo_midia', label: `Acervo (${mediaAssets.length})` },
          ] as { id: AdminTab; label: string }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setAdminTab(tab.id)}
            className={`border-b-2 pb-3 text-xs font-semibold tracking-[0.14em] transition-colors whitespace-nowrap shrink-0 ${
              adminTab === tab.id
                ? 'border-[#8BAA43] text-[#F1F3EC]'
                : 'border-transparent text-[#A5AAA2] hover:text-[#F1F3EC]'
            }`}
          >
            {tab.label.toUpperCase()}
          </button>
        ))}
      </nav>

      {/* DELEGATED SECTIONS: GERENCIAR HIERARQUIA, FUNÇÕES, OPERAÇÕES, GALERIA */}
      {(adminTab === 'hierarquia' ||
        adminTab === 'funcoes' ||
        adminTab === 'operacoes' ||
        adminTab === 'galeria') && (
        <AdminRecordsPanel
          section={adminTab}
          onPreviewUrl={(url, title) => setPreviewImage({ url, title })}
        />
      )}

      {/* IMAGENS POR PÁGINA (Logo, Início, Quem Somos) */}
      {adminTab === 'imagens_paginas' && (
        <div className="space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#263F24]/45 pb-5">
            <div>
              <h2 className="font-display text-3xl font-bold text-[#F1F3EC]">
                Logo, Abertura e Fotografias das Páginas
              </h2>
              <p className="text-xs text-[#A5AAA2]">
                Envie, substitua ou remova individualmente a logo, a imagem panorâmica da página
                inicial e as fotografias da aba Quem Somos.
              </p>
            </div>

            <div className="flex flex-wrap gap-4">
              {slotPageOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => setPageFilter(opt)}
                  className={`border-b pb-1 text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
                    pageFilter === opt
                      ? 'border-[#8BAA43] text-[#F1F3EC]'
                      : 'border-transparent text-[#A5AAA2] hover:text-[#F1F3EC]'
                  }`}
                >
                  {opt === 'todas' ? 'Todas' : PAGE_LABELS[opt]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-2">
            {visibleSlots.map((slot) => {
              const isLogo = slot.id === 'logo_official';
              const resolved = resolveMediaUrl(slot.imageUrl);
              const currentTitle = slotEdits[slot.id]?.title ?? slot.title;
              const currentDesc = slotEdits[slot.id]?.description ?? slot.description ?? '';

              return (
                <div key={slot.id} className="space-y-4 border-b border-[#263F24]/45 pb-8">
                  <div className="aspect-[16/9] w-full border border-[#263F24]/50 bg-[#050705]">
                    <MediaImage
                      src={slot.imageUrl}
                      alt={slot.title}
                      placeholderLabel={slot.placeholderLabel || 'FOTOGRAFIA INSTITUCIONAL'}
                      objectFit={isLogo ? 'contain' : 'cover'}
                      containerClassName="h-full w-full"
                      className={
                        isLogo ? 'h-full w-full p-6 object-contain' : 'h-full w-full object-cover'
                      }
                      compact
                    />
                  </div>

                  <div>
                    <p className="font-mono text-[11px] text-[#8BAA43]">{PAGE_LABELS[slot.page]}</p>
                    <h3 className="font-display text-xl font-bold text-[#F1F3EC]">{slot.label}</h3>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <label className="block text-[11px] text-[#A5AAA2]">Título</label>
                      <input
                        type="text"
                        value={currentTitle}
                        onChange={(e) =>
                          setSlotEdits((prev) => ({
                            ...prev,
                            [slot.id]: { title: e.target.value, description: currentDesc },
                          }))
                        }
                        className="mt-1 w-full border border-[#263F24] bg-[#050705] px-3 py-2 text-xs text-[#F1F3EC]"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-[#A5AAA2]">Legenda / Descrição</label>
                      <input
                        type="text"
                        value={currentDesc}
                        onChange={(e) =>
                          setSlotEdits((prev) => ({
                            ...prev,
                            [slot.id]: { title: currentTitle, description: e.target.value },
                          }))
                        }
                        className="mt-1 w-full border border-[#263F24] bg-[#050705] px-3 py-2 text-xs text-[#F1F3EC]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        openQuickImageEditor({
                          title: slot.label,
                          page: slot.page,
                          currentUrl: slot.imageUrl,
                          preserveTransparency: isLogo,
                          onPublish: async (imageUrl, assetId) => {
                            await savePortalSlot({
                              ...slot,
                              title: currentTitle,
                              description: currentDesc,
                              imageUrl,
                              mediaAssetId: assetId || '',
                            });
                          },
                          onRemove: async () => {
                            await resetPortalSlot(slot.id);
                          },
                        })
                      }
                      className="inline-flex items-center gap-1.5 bg-[#526B32] px-3.5 py-2 text-xs font-semibold text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705]"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {resolved ? 'Alterar imagem' : 'Enviar imagem'}
                    </button>

                    {resolved && (
                      <button
                        type="button"
                        onClick={() => setPreviewImage({ url: resolved, title: slot.label })}
                        className="inline-flex items-center gap-1.5 border border-[#263F24] px-3 py-2 text-xs text-[#A5AAA2] hover:text-[#F1F3EC]"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        Visualizar
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleSlotMetaSave(slot)}
                      className="inline-flex items-center gap-1.5 border border-[#526B32] px-3 py-2 text-xs font-semibold text-[#8BAA43] hover:bg-[#263F24]/30"
                    >
                      <Check className="h-3.5 w-3.5" />
                      Salvar
                    </button>

                    {resolved && (
                      <button
                        type="button"
                        onClick={() => void resetPortalSlot(slot.id)}
                        className="ml-auto inline-flex items-center gap-1 border border-[#D62828]/40 px-2.5 py-2 text-xs text-[#D62828] hover:bg-[#D62828]/15"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {isLogo ? 'Restaurar Oficial' : 'Remover'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TEXTOS INSTITUCIONAIS */}
      {adminTab === 'textos_config' && (
        <div className="max-w-4xl space-y-6">
          <div className="border-b border-[#263F24]/45 pb-4">
            <h2 className="font-display text-3xl font-bold text-[#F1F3EC]">
              Textos Institucionais — Início e Quem Somos
            </h2>
            <p className="text-xs text-[#A5AAA2]">
              Edite livremente os textos oficiais da 1.F.M.O.T no BRP.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-[#A5AAA2]">Frase Principal (Início)</label>
              <input
                type="text"
                maxLength={240}
                value={draftConfig.heroHeadline}
                onChange={(e) => setDraftConfig({ ...draftConfig, heroHeadline: e.target.value })}
                className="mt-1 w-full border border-[#263F24] bg-[#050705] px-4 py-2.5 text-sm text-[#F1F3EC]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#A5AAA2]">Texto de Abertura (Início)</label>
              <textarea
                rows={3}
                maxLength={1200}
                value={draftConfig.heroSubtext}
                onChange={(e) => setDraftConfig({ ...draftConfig, heroSubtext: e.target.value })}
                className="mt-1 w-full border border-[#263F24] bg-[#050705] px-4 py-2.5 text-sm text-[#F1F3EC]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#A5AAA2]">
                Apresentação Institucional (Quem Somos)
              </label>
              <textarea
                rows={4}
                maxLength={3000}
                value={draftConfig.aboutIntro}
                onChange={(e) => setDraftConfig({ ...draftConfig, aboutIntro: e.target.value })}
                className="mt-1 w-full border border-[#263F24] bg-[#050705] px-4 py-2.5 text-sm text-[#F1F3EC]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#A5AAA2]">
                Destaque de Diferencial no BRP
              </label>
              <input
                type="text"
                maxLength={600}
                value={draftConfig.aboutDifferentiator}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, aboutDifferentiator: e.target.value })
                }
                className="mt-1 w-full border border-[#263F24] bg-[#050705] px-4 py-2.5 text-sm text-[#F1F3EC]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#A5AAA2]">
                Texto de Operações Diárias e Semanais (Quem Somos)
              </label>
              <textarea
                rows={4}
                maxLength={2000}
                value={draftConfig.aboutOperationsText}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, aboutOperationsText: e.target.value })
                }
                className="mt-1 w-full border border-[#263F24] bg-[#050705] px-4 py-2.5 text-sm text-[#F1F3EC]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#A5AAA2]">Identidade e Cultura</label>
              <textarea
                rows={3}
                maxLength={2000}
                value={draftConfig.aboutIdentityText}
                onChange={(e) =>
                  setDraftConfig({ ...draftConfig, aboutIdentityText: e.target.value })
                }
                className="mt-1 w-full border border-[#263F24] bg-[#050705] px-4 py-2.5 text-sm text-[#F1F3EC]"
              />
            </div>
          </div>

          <button
            type="button"
            disabled={savingConfig}
            onClick={async () => {
              setSavingConfig(true);
              try {
                await savePortalConfig(draftConfig);
              } finally {
                setSavingConfig(false);
              }
            }}
            className="inline-flex items-center gap-2 bg-[#526B32] px-6 py-3 text-xs font-semibold tracking-wider text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705] disabled:opacity-50"
          >
            {savingConfig ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Check className="h-4 w-4" />
            )}
            SALVAR E PUBLICAR TEXTOS
          </button>
        </div>
      )}

      {/* ACERVO PERSISTENTE */}
      {adminTab === 'acervo_midia' && (
        <div className="space-y-6">
          <AdminSupabaseMigrationPanel />

          <input
            ref={acervoUploadInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void handleAcervoDirectUpload(e.target.files?.[0])}
            className="hidden"
          />
          <input
            ref={replaceInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={(e) => void handleAcervoReplaceFile(e.target.files?.[0])}
            className="hidden"
          />

          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[#263F24]/45 pb-4">
            <div>
              <h2 className="font-display text-3xl font-bold text-[#F1F3EC]">
                Acervo Persistente de Fotografias ({mediaAssets.length})
              </h2>
              <p className="text-xs text-[#A5AAA2]">
                Envie, substitua ou exclua fotografias individualmente no bucket{' '}
                <span className="font-mono text-[#F1F3EC]">fmot-media</span> (Supabase Storage).
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={acervoUploadPage}
                onChange={(e) => setAcervoUploadPage(e.target.value as ManagedPageKey)}
                disabled={uploadingAcervo}
                aria-label="Seção de destino da imagem"
                className="border border-[#263F24] bg-[#050705] px-3 py-2 text-xs text-[#F1F3EC]"
              >
                {(Object.keys(PAGE_LABELS) as ManagedPageKey[]).map((key) => (
                  <option key={key} value={key}>
                    {PAGE_LABELS[key]}
                  </option>
                ))}
              </select>

              <button
                type="button"
                disabled={uploadingAcervo || !supabaseReadyForWrites}
                onClick={() => acervoUploadInputRef.current?.click()}
                className="inline-flex items-center gap-2 bg-[#526B32] px-4 py-2 text-xs font-semibold text-[#F1F3EC] transition-colors hover:bg-[#8BAA43] hover:text-[#050705] disabled:cursor-not-allowed disabled:opacity-45 whitespace-nowrap"
              >
                {uploadingAcervo ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Upload className="h-3.5 w-3.5" />
                )}
                {uploadingAcervo ? 'ENVIANDO PARA fmot-media...' : '+ ENVIAR IMAGEM AO SUPABASE'}
              </button>
            </div>
          </div>

          {loadingMediaLibrary && mediaAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-[#263F24]/50 bg-[#050705] py-16 text-center">
              <Loader2 className="h-7 w-7 animate-spin text-[#8BAA43]" />
              <p className="mt-3 text-sm font-semibold text-[#F1F3EC]">
                Carregando acervo de fotografias...
              </p>
            </div>
          ) : mediaAssets.length === 0 ? (
            <div className="flex flex-col items-center justify-center border border-[#263F24]/50 bg-[#050705] py-16 text-center">
              <ImageIcon className="h-8 w-8 text-[#526B32]" />
              <p className="mt-3 text-sm font-semibold text-[#F1F3EC]">
                Nenhuma fotografia registrada no bucket fmot-media ainda.
              </p>
              <p className="mt-1 text-xs text-[#A5AAA2]">
                Use o botão acima ou qualquer aba do painel administrativo para enviar suas
                fotografias diretamente ao Supabase Storage.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {mediaAssets.map((asset) => {
                const displayUrl = asset.publicUrl || asset.dataUrl;
                const isSupabaseAsset = asset.source === 'supabase' || Boolean(asset.storagePath);
                const isBusy = replacingAssetId === asset.id || deletingAssetId === asset.id;

                return (
                  <div key={asset.id} className="space-y-3 border-b border-[#263F24]/45 pb-5">
                    <div className="relative aspect-[4/3] bg-[#050705]">
                      <img
                        src={displayUrl}
                        alt={asset.title}
                        loading="lazy"
                        decoding="async"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                      <span
                        className={`absolute left-2 top-2 px-2 py-0.5 font-mono text-[10px] ${
                          isSupabaseAsset
                            ? 'bg-[#0B100C]/90 text-[#8BAA43] border border-[#526B32]/70'
                            : 'bg-[#0B100C]/90 text-[#A5AAA2] border border-[#263F24]'
                        }`}
                      >
                        {isSupabaseAsset ? 'Supabase · fmot-media' : 'Backup Firebase'}
                      </span>
                    </div>

                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[10px] text-[#8BAA43]">
                          {PAGE_LABELS[asset.page]} · {asset.width}×{asset.height}px
                        </p>
                        <h3 className="truncate font-display text-base font-bold text-[#F1F3EC]">
                          {asset.title}
                        </h3>
                        <p className="font-mono text-[10px] text-[#A5AAA2] tabular-nums">
                          {formatFileSize(asset.sizeBytes)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          title="Visualizar em tamanho real"
                          onClick={() => setPreviewImage({ url: displayUrl, title: asset.title })}
                          className="flex h-8 w-8 items-center justify-center border border-[#263F24] text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC]"
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </button>

                        {isSupabaseAsset && (
                          <button
                            type="button"
                            disabled={isBusy || !supabaseReadyForWrites}
                            title="Substituir imagem no Supabase Storage"
                            onClick={() => {
                              pendingReplaceTargetRef.current = asset.id;
                              replaceInputRef.current?.click();
                            }}
                            className="flex h-8 w-8 items-center justify-center border border-[#526B32] text-[#8BAA43] hover:bg-[#263F24]/50 disabled:opacity-40"
                          >
                            {replacingAssetId === asset.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <RefreshCw className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}

                        {isSupabaseAsset ? (
                          confirmDeleteId === asset.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleAcervoDelete(asset.id)}
                                className="border border-[#D62828] bg-[#D62828]/20 px-2 py-1 text-[10px] font-semibold text-[#F1F3EC] hover:bg-[#D62828]"
                              >
                                {deletingAssetId === asset.id ? '...' : 'Confirmar'}
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="border border-[#263F24] px-1.5 py-1 text-[10px] text-[#A5AAA2] hover:text-[#F1F3EC]"
                              >
                                Não
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy || !supabaseReadyForWrites}
                              title="Excluir imagem do Supabase Storage"
                              onClick={() => setConfirmDeleteId(asset.id)}
                              className="flex h-8 w-8 items-center justify-center border border-[#D62828]/40 text-[#D62828] hover:bg-[#D62828]/15 disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )
                        ) : (
                          <button
                            type="button"
                            disabled
                            title="Imagem preservada no backup do Firebase (somente leitura)"
                            className="flex h-8 w-8 cursor-not-allowed items-center justify-center border border-[#263F24]/50 text-[#A5AAA2]/40"
                          >
                            <Lock className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Fullscreen Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#050705]/95 p-4 backdrop-blur-md"
          onClick={() => setPreviewImage(null)}
        >
          <div
            className="w-full max-w-4xl border border-[#263F24] bg-[#0B100C]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[#263F24]/50 px-5 py-3.5">
              <p className="font-display text-lg font-bold text-[#F1F3EC]">{previewImage.title}</p>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                aria-label="Fechar visualização"
                className="flex h-9 w-9 items-center justify-center border border-[#263F24] text-[#A5AAA2] hover:text-[#F1F3EC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex max-h-[76vh] items-center justify-center bg-[#050705] p-4">
              <img
                src={previewImage.url}
                alt={previewImage.title}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] max-w-full object-contain"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
