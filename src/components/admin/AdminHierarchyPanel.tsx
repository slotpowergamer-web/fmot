import React, { useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Plus,
  Search,
  Settings2,
  Trash2,
  Upload,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { MediaImage } from '../MediaImage';
import { RankInsignia } from '../RankInsignia';
import { usePortal } from '../../context/PortalContext';
import {
  HierarchyMember,
  HierarchyMemberStatus,
  HierarchyNode,
  HierarchyRankId,
} from '../../types/portal';
import {
  formatFileSize,
  OptimizedImageResult,
  optimizeImageFile,
} from '../../utils/imageOptimizer';

interface AdminHierarchyPanelProps {
  onPreviewUrl: (url: string, title: string) => void;
}

const MEMBER_STATUS_OPTIONS: {
  value: HierarchyMemberStatus;
  label: string;
  helper: string;
  accentClass: string;
}[] = [
  {
    value: 'Ativo',
    label: 'Ativo',
    helper: 'Exibido normalmente na página pública de Hierarquia.',
    accentClass: 'text-[#8BAA43]',
  },
  {
    value: 'Em Capacitação',
    label: 'Em Capacitação',
    helper: 'Exibido na página pública com indicação de capacitação.',
    accentClass: 'text-[#FFC928]',
  },
  {
    value: 'Afastado',
    label: 'Afastado',
    helper: 'Exibido na página pública com status de afastamento temporário.',
    accentClass: 'text-[#A5AAA2]',
  },
  {
    value: 'Inativo',
    label: 'Inativo (Oculto no site público)',
    helper: 'Mantido salvo no painel administrativo sem aparecer na página pública.',
    accentClass: 'text-[#D62828]',
  },
];

function formatCreatedDate(ts: unknown): string {
  if (!ts) return 'Recente';
  if (typeof ts === 'object' && ts !== null && 'toDate' in ts) {
    try {
      const date = (ts as { toDate: () => Date }).toDate();
      return date.toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    } catch {
      return 'Recente';
    }
  }
  return 'Recente';
}

interface MemberFormState {
  mode: 'create' | 'edit';
  memberId?: string;
  name: string;
  rankId: HierarchyRankId;
  status: HierarchyMemberStatus;
  description: string;
  photoUrl: string;
}

export const AdminHierarchyPanel: React.FC<AdminHierarchyPanelProps> = ({ onPreviewUrl }) => {
  const {
    hierarchy,
    hierarchyMembers,
    membersByRank,
    saveHierarchyNode,
    addHierarchyMember,
    updateHierarchyMember,
    transferHierarchyMember,
    reorderRankMembers,
    deleteHierarchyMember,
    openQuickImageEditor,
    uploadMediaAsset,
    mediaAssets,
    resolveMediaUrl,
    showToast,
  } = usePortal();

  const [searchQuery, setSearchQuery] = useState('');
  const [formState, setFormState] = useState<MemberFormState | null>(null);
  const [pendingUpload, setPendingUpload] = useState<OptimizedImageResult | null>(null);
  const [processingPhoto, setProcessingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [savingForm, setSavingForm] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<HierarchyMember | null>(null);
  const [deletingMember, setDeletingMember] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  // Collapsible per-rank official settings (insignia + attributions)
  const [expandedRankConfigId, setExpandedRankConfigId] = useState<string | null>(null);
  const [rankRespDrafts, setRankRespDrafts] = useState<Record<string, string>>({});
  const [savingRankConfigId, setSavingRankConfigId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredMembersByRank = useMemo(() => {
    const result: Record<HierarchyRankId, HierarchyMember[]> = {
      rank_coronel: [],
      rank_capitao: [],
      rank_sargento: [],
      rank_cabo: [],
      rank_soldado: [],
      rank_recruta: [],
    };
    hierarchy.forEach((rank) => {
      const list = membersByRank[rank.id] || [];
      result[rank.id] = normalizedQuery
        ? list.filter(
            (m) =>
              m.name.toLowerCase().includes(normalizedQuery) ||
              (m.description || '').toLowerCase().includes(normalizedQuery) ||
              m.status.toLowerCase().includes(normalizedQuery)
          )
        : list;
    });
    return result;
  }, [hierarchy, membersByRank, normalizedQuery]);

  const openCreateModal = (rankId: HierarchyRankId) => {
    setFormState({
      mode: 'create',
      name: '',
      rankId,
      status: 'Ativo',
      description: '',
      photoUrl: '',
    });
    setPendingUpload(null);
    setPhotoError(null);
    setShowLibraryPicker(false);
  };

  const openEditModal = (member: HierarchyMember) => {
    setFormState({
      mode: 'edit',
      memberId: member.id,
      name: member.name,
      rankId: member.rankId,
      status: member.status || 'Ativo',
      description: member.description || '',
      photoUrl: member.photoUrl || '',
    });
    setPendingUpload(null);
    setPhotoError(null);
    setShowLibraryPicker(false);
  };

  const closeFormModal = () => {
    if (savingForm) return;
    setFormState(null);
    setPendingUpload(null);
    setPhotoError(null);
    setShowLibraryPicker(false);
  };

  const handlePhotoFileChange = async (file: File | null) => {
    if (!file) return;
    setPhotoError(null);
    setProcessingPhoto(true);
    try {
      const optimized = await optimizeImageFile(file, {
        maxDimension: 1200,
        preserveTransparency: false,
      });
      setPendingUpload(optimized);
      setShowLibraryPicker(false);
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Erro ao processar fotografia.');
    } finally {
      setProcessingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmitMemberForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState) return;
    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      showToast('Informe o nome do integrante.', 'error');
      return;
    }

    setSavingForm(true);
    try {
      let finalPhotoUrl = formState.photoUrl;
      if (pendingUpload) {
        const rankObj = hierarchy.find((r) => r.id === formState.rankId);
        const uploaded = await uploadMediaAsset(pendingUpload, {
          page: 'hierarquia',
          title: `${rankObj?.rankTitle || 'Hierarquia'} — ${trimmedName}`,
          description: formState.description.trim().slice(0, 500),
        });
        finalPhotoUrl = uploaded.refUrl;
      }

      if (formState.mode === 'create') {
        await addHierarchyMember({
          rankId: formState.rankId,
          name: trimmedName,
          photoUrl: finalPhotoUrl,
          description: formState.description.trim(),
          status: formState.status,
        });
      } else if (formState.memberId) {
        await updateHierarchyMember(formState.memberId, {
          rankId: formState.rankId,
          name: trimmedName,
          photoUrl: finalPhotoUrl,
          description: formState.description.trim(),
          status: formState.status,
        });
      }

      setFormState(null);
      setPendingUpload(null);
      setPhotoError(null);
      setShowLibraryPicker(false);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : 'Não foi possível salvar o integrante.',
        'error'
      );
    } finally {
      setSavingForm(false);
    }
  };

  const handleMoveMember = async (
    rankId: HierarchyRankId,
    index: number,
    direction: -1 | 1
  ) => {
    const list = membersByRank[rankId] || [];
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const nextList = [...list];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(targetIdx, 0, moved);
    setBusyMemberId(moved.id);
    try {
      await reorderRankMembers(rankId, nextList);
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleTransferMember = async (
    member: HierarchyMember,
    targetRankId: HierarchyRankId
  ) => {
    if (member.rankId === targetRankId) return;
    setBusyMemberId(member.id);
    try {
      await transferHierarchyMember(member.id, targetRankId);
    } finally {
      setBusyMemberId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeletingMember(true);
    try {
      await deleteHierarchyMember(deleteTarget.id);
      setDeleteTarget(null);
    } finally {
      setDeletingMember(false);
    }
  };

  const toggleRankConfig = (rank: HierarchyNode) => {
    if (expandedRankConfigId === rank.id) {
      setExpandedRankConfigId(null);
    } else {
      setRankRespDrafts((prev) => ({
        ...prev,
        [rank.id]: prev[rank.id] ?? rank.responsibility,
      }));
      setExpandedRankConfigId(rank.id);
    }
  };

  const handleSaveRankConfig = async (rank: HierarchyNode) => {
    const nextResp = (rankRespDrafts[rank.id] ?? rank.responsibility).trim();
    if (!nextResp) {
      showToast('A descrição das atribuições da patente não pode ficar vazia.', 'error');
      return;
    }
    setSavingRankConfigId(rank.id);
    try {
      await saveHierarchyNode({
        ...rank,
        responsibility: nextResp,
        isDemo: false,
      });
      setExpandedRankConfigId(null);
    } finally {
      setSavingRankConfigId(null);
    }
  };

  const scrollToAdminRank = (rankId: string) => {
    const el = document.getElementById(`admin-${rankId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const previewPhotoInModal = pendingUpload
    ? pendingUpload.dataUrl
    : formState?.photoUrl
      ? resolveMediaUrl(formState.photoUrl)
      : '';

  const activePublicCount = hierarchyMembers.filter((m) => m.status !== 'Inativo').length;

  return (
    <div className="space-y-8">
      {/* Header & Summary */}
      <div className="flex flex-col justify-between gap-6 border-b border-[#263F24]/50 pb-6 lg:flex-row lg:items-end">
        <div>
          <p className="font-mono text-xs tracking-[0.22em] text-[#8BAA43]">
            GERENCIAR HIERARQUIA · MÚLTIPLOS INTEGRANTES POR PATENTE
          </p>
          <h2 className="mt-1 font-display text-3xl font-bold text-[#F1F3EC]">
            Efetivo Dinâmico da 1.F.M.O.T
          </h2>
          <p className="mt-2 max-w-3xl text-xs leading-relaxed text-[#A5AAA2]">
            Cadastre quantos integrantes forem necessários em cada uma das 6 patentes oficiais, com
            fotografia individual, descrição, status, reordenação e transferência direta entre
            patentes.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-6 text-xs">
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[#A5AAA2]">TOTAL CADASTRADO</p>
            <p className="mt-0.5 font-display text-2xl font-bold text-[#F1F3EC] tabular-nums">
              {hierarchyMembers.length}{' '}
              <span className="text-xs font-normal text-[#A5AAA2]">
                {hierarchyMembers.length === 1 ? 'integrante' : 'integrantes'}
              </span>
            </p>
          </div>
          <div className="h-8 w-px bg-[#263F24]/60" />
          <div>
            <p className="font-mono text-[10px] tracking-[0.2em] text-[#A5AAA2]">EXIBIDOS NO PORTAL</p>
            <p className="mt-0.5 font-display text-2xl font-bold text-[#8BAA43] tabular-nums">
              {activePublicCount}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Jump Strip + Search */}
      <div className="flex flex-col justify-between gap-4 border-b border-[#263F24]/40 pb-5 lg:flex-row lg:items-center">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
          {hierarchy.map((rank) => {
            const count = (membersByRank[rank.id] || []).length;
            return (
              <button
                key={rank.id}
                type="button"
                onClick={() => scrollToAdminRank(rank.id)}
                className="group inline-flex items-center gap-1.5 py-1 text-[#A5AAA2] transition-colors hover:text-[#8BAA43] whitespace-nowrap shrink-0"
              >
                <span className="font-mono text-[11px] text-[#526B32] group-hover:text-[#8BAA43] tabular-nums">
                  {rank.positionCode}
                </span>
                <span className="font-display text-sm font-bold tracking-[0.12em]">
                  {rank.rankTitle}
                </span>
                <span className="font-mono text-[11px] text-[#8BAA43] tabular-nums">
                  ({count})
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#A5AAA2]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar integrante por nome..."
            className="w-full border border-[#263F24] bg-[#050705] py-2 pl-9 pr-8 text-xs text-[#F1F3EC] placeholder-[#A5AAA2]/50 focus:border-[#8BAA43] focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="Limpar busca"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A5AAA2] hover:text-[#F1F3EC]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* 6 Official Ranks Vertical Roster */}
      <div className="space-y-10">
        {hierarchy.map((rank) => {
          const allRankMembers = membersByRank[rank.id] || [];
          const visibleMembers = filteredMembersByRank[rank.id] || [];
          const isConfigOpen = expandedRankConfigId === rank.id;
          const isSavingConfig = savingRankConfigId === rank.id;

          return (
            <section
              key={rank.id}
              id={`admin-${rank.id}`}
              className="border border-[#263F24]/60 bg-[#050705]/70"
            >
              {/* Rank Header Bar */}
              <div className="flex flex-col justify-between gap-4 border-b border-[#263F24]/50 bg-[#0B100C]/90 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                <div className="flex items-center gap-4">
                  <RankInsignia
                    tier={rank.tier}
                    customUrl={rank.insigniaUrl}
                    rankTitle={rank.rankTitle}
                    size="sm"
                  />
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-mono tracking-[0.2em] text-[#8BAA43] tabular-nums">
                        PATENTE {rank.positionCode}
                      </span>
                      <span aria-hidden="true" className="text-[#526B32]">
                        ·
                      </span>
                      <span className="font-mono text-[#A5AAA2] tabular-nums">
                        {allRankMembers.length}{' '}
                        {allRankMembers.length === 1 ? 'integrante' : 'integrantes'}
                      </span>
                    </div>
                    <h3 className="mt-0.5 font-display text-2xl font-bold tracking-[0.12em] text-[#F1F3EC]">
                      {rank.rankTitle}
                    </h3>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => toggleRankConfig(rank)}
                    className="inline-flex items-center gap-1.5 border border-[#263F24] px-3 py-2 text-xs text-[#A5AAA2] transition-colors hover:border-[#8BAA43] hover:text-[#F1F3EC] whitespace-nowrap shrink-0"
                  >
                    <Settings2 className="h-3.5 w-3.5 text-[#8BAA43]" />
                    Patente
                    {isConfigOpen ? (
                      <ChevronUp className="h-3.5 w-3.5" />
                    ) : (
                      <ChevronDown className="h-3.5 w-3.5" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => openCreateModal(rank.id)}
                    className="inline-flex items-center gap-2 bg-[#526B32] px-4 py-2 text-xs font-bold tracking-[0.1em] text-[#F1F3EC] transition-colors hover:bg-[#8BAA43] hover:text-[#050705] whitespace-nowrap shrink-0"
                  >
                    <Plus className="h-4 w-4" />
                    ADICIONAR INTEGRANTE
                  </button>
                </div>
              </div>

              {/* Optional Collapsible Rank Settings (Insignia & Attribution Text) */}
              {isConfigOpen && (
                <div className="space-y-4 border-b border-[#263F24]/50 bg-[#080D09] px-5 py-5 sm:px-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-mono text-[11px] tracking-[0.18em] text-[#8BAA43]">
                      CONFIGURAÇÕES DA PATENTE {rank.rankTitle}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        openQuickImageEditor({
                          title: `Insígnia Personalizada — ${rank.rankTitle}`,
                          page: 'hierarquia',
                          currentUrl: rank.insigniaUrl || '',
                          preserveTransparency: true,
                          onPublish: async (imageUrl) => {
                            await saveHierarchyNode({ ...rank, insigniaUrl: imageUrl });
                          },
                          onRemove: async () => {
                            await saveHierarchyNode({ ...rank, insigniaUrl: '' });
                          },
                        })
                      }
                      className="inline-flex items-center gap-1.5 border border-[#263F24] px-3 py-1.5 text-xs text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC]"
                    >
                      <ImageIcon className="h-3.5 w-3.5 text-[#8BAA43]" />
                      Alterar Insígnia da Patente
                    </button>
                  </div>

                  <div>
                    <label
                      htmlFor={`rank-resp-${rank.id}`}
                      className="block text-xs text-[#A5AAA2]"
                    >
                      Descrição Oficial das Atribuições ({rank.rankTitle})
                    </label>
                    <textarea
                      id={`rank-resp-${rank.id}`}
                      rows={3}
                      maxLength={1000}
                      value={rankRespDrafts[rank.id] ?? rank.responsibility}
                      onChange={(e) =>
                        setRankRespDrafts((prev) => ({
                          ...prev,
                          [rank.id]: e.target.value,
                        }))
                      }
                      className="mt-1.5 w-full border border-[#263F24] bg-[#050705] px-3.5 py-2.5 text-xs leading-relaxed text-[#F1F3EC] focus:border-[#8BAA43] focus:outline-none"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isSavingConfig}
                      onClick={() => void handleSaveRankConfig(rank)}
                      className="inline-flex items-center gap-2 bg-[#263F24] px-4 py-2 text-xs font-semibold text-[#F1F3EC] hover:bg-[#526B32] disabled:opacity-50"
                    >
                      {isSavingConfig ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Check className="h-3.5 w-3.5 text-[#8BAA43]" />
                      )}
                      Salvar Descrição da Patente
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpandedRankConfigId(null)}
                      className="border border-[#263F24] px-3.5 py-2 text-xs text-[#A5AAA2] hover:text-[#F1F3EC]"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              )}

              {/* Members List inside this Rank */}
              <div className="px-5 py-4 sm:px-6">
                {visibleMembers.length === 0 ? (
                  <div className="flex flex-col items-start justify-between gap-4 py-6 sm:flex-row sm:items-center">
                    <div className="flex items-center gap-3 text-[#A5AAA2]">
                      <Users className="h-4 w-4 text-[#526B32]" />
                      <p className="text-xs">
                        {normalizedQuery
                          ? `Nenhum integrante encontrado em ${rank.rankTitle} para "${searchQuery}".`
                          : `Nenhum integrante cadastrado na patente ${rank.rankTitle} até o momento.`}
                      </p>
                    </div>
                    {!normalizedQuery && (
                      <button
                        type="button"
                        onClick={() => openCreateModal(rank.id)}
                        className="inline-flex items-center gap-1.5 border border-[#526B32] px-3.5 py-2 text-xs font-semibold text-[#8BAA43] transition-colors hover:bg-[#263F24]/40 hover:text-[#F1F3EC] whitespace-nowrap shrink-0"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                        Cadastrar Primeiro Integrante
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="divide-y divide-[#263F24]/45">
                    {visibleMembers.map((member) => {
                      const fullIndex = allRankMembers.findIndex((m) => m.id === member.id);
                      const resolvedPhoto = resolveMediaUrl(member.photoUrl);
                      const isBusy = busyMemberId === member.id;
                      const statusMeta =
                        MEMBER_STATUS_OPTIONS.find((s) => s.value === member.status) ||
                        MEMBER_STATUS_OPTIONS[0];

                      return (
                        <div
                          key={member.id}
                          className="flex flex-col gap-4 py-4 lg:flex-row lg:items-center"
                        >
                          {/* Reorder Controls + Portrait Thumbnail */}
                          <div className="flex items-center gap-3 shrink-0">
                            {!normalizedQuery && (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  disabled={fullIndex <= 0 || isBusy}
                                  onClick={() => void handleMoveMember(rank.id, fullIndex, -1)}
                                  aria-label={`Mover ${member.name} para cima`}
                                  className="flex h-7 w-7 items-center justify-center border border-[#263F24] text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC] disabled:opacity-25"
                                >
                                  <ArrowUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={fullIndex >= allRankMembers.length - 1 || isBusy}
                                  onClick={() => void handleMoveMember(rank.id, fullIndex, 1)}
                                  aria-label={`Mover ${member.name} para baixo`}
                                  className="flex h-7 w-7 items-center justify-center border border-[#263F24] text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC] disabled:opacity-25"
                                >
                                  <ArrowDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}

                            <div
                              onClick={() => {
                                if (resolvedPhoto) {
                                  onPreviewUrl(resolvedPhoto, `${rank.rankTitle} — ${member.name}`);
                                }
                              }}
                              className={`h-20 w-16 shrink-0 border border-[#263F24]/70 bg-[#0B100C] ${
                                resolvedPhoto ? 'cursor-zoom-in' : ''
                              }`}
                            >
                              <MediaImage
                                src={member.photoUrl}
                                alt={member.name}
                                placeholderLabel="FOTO"
                                containerClassName="h-full w-full"
                                className="h-full w-full object-cover"
                                compact
                              />
                            </div>
                          </div>

                          {/* Member Identity Info */}
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                              <span className="text-[#526B32] tabular-nums">
                                #{String(fullIndex + 1).padStart(2, '0')}
                              </span>
                              <span aria-hidden="true" className="text-[#263F24]">
                                ·
                              </span>
                              <span className={statusMeta.accentClass}>{member.status}</span>
                              <span aria-hidden="true" className="text-[#263F24]">
                                ·
                              </span>
                              <span className="text-[#A5AAA2]/75 tabular-nums">
                                Cadastro: {formatCreatedDate(member.createdAt)}
                              </span>
                            </div>

                            <h4 className="font-display text-xl font-bold tracking-wide text-[#F1F3EC]">
                              {member.name}
                            </h4>

                            {member.description && (
                              <p className="line-clamp-2 max-w-2xl text-xs leading-relaxed text-[#A5AAA2]">
                                {member.description}
                              </p>
                            )}
                          </div>

                          {/* Individual Actions + Direct Transfer Selector */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Direct Rank Transfer Dropdown */}
                            <div className="inline-flex items-center border border-[#263F24] bg-[#0B100C] px-2">
                              <ArrowRightLeft className="h-3.5 w-3.5 text-[#8BAA43] shrink-0" />
                              <select
                                aria-label={`Transferir ${member.name} de patente`}
                                disabled={isBusy}
                                value={member.rankId}
                                onChange={(e) =>
                                  void handleTransferMember(
                                    member,
                                    e.target.value as HierarchyRankId
                                  )
                                }
                                className="bg-transparent py-1.5 pl-1.5 pr-2 text-xs text-[#F1F3EC] focus:outline-none"
                              >
                                {hierarchy.map((optRank) => (
                                  <option
                                    key={optRank.id}
                                    value={optRank.id}
                                    className="bg-[#050705] text-[#F1F3EC]"
                                  >
                                    {optRank.id === member.rankId
                                      ? `Patente: ${optRank.rankTitle}`
                                      : `Transferir → ${optRank.rankTitle}`}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Individual Photo Quick Swap */}
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() =>
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
                                })
                              }
                              className="inline-flex items-center gap-1.5 bg-[#263F24] px-3 py-1.5 text-xs font-semibold text-[#F1F3EC] transition-colors hover:bg-[#526B32] whitespace-nowrap shrink-0"
                            >
                              <Upload className="h-3.5 w-3.5 text-[#8BAA43]" />
                              {resolvedPhoto ? 'Alterar Foto' : 'Enviar Foto'}
                            </button>

                            {resolvedPhoto && (
                              <button
                                type="button"
                                onClick={() =>
                                  onPreviewUrl(resolvedPhoto, `${rank.rankTitle} — ${member.name}`)
                                }
                                aria-label={`Visualizar foto de ${member.name}`}
                                className="inline-flex items-center justify-center border border-[#263F24] px-2.5 py-1.5 text-xs text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC]"
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </button>
                            )}

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => openEditModal(member)}
                              className="inline-flex items-center gap-1 border border-[#263F24] px-3 py-1.5 text-xs text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC] whitespace-nowrap shrink-0"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Editar
                            </button>

                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => setDeleteTarget(member)}
                              aria-label={`Excluir ${member.name}`}
                              className="inline-flex items-center gap-1 border border-[#D62828]/45 px-2.5 py-1.5 text-xs text-[#D62828] hover:bg-[#D62828]/15 whitespace-nowrap shrink-0"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Excluir
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* ==================== MODAL: CADASTRAR / EDITAR INTEGRANTE ==================== */}
      {formState && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#050705]/90 p-4 backdrop-blur-md"
          onClick={closeFormModal}
        >
          <div
            className="max-h-[92vh] w-full max-w-3xl overflow-y-auto border border-[#526B32]/80 bg-[#0B100C] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-[#263F24]/60 px-6 py-4">
              <div>
                <p className="font-mono text-[11px] tracking-[0.22em] text-[#8BAA43]">
                  {formState.mode === 'create'
                    ? 'NOVO CADASTRO NA HIERARQUIA'
                    : 'EDIÇÃO INDIVIDUAL DE INTEGRANTE'}
                </p>
                <h3 className="mt-0.5 font-display text-2xl font-bold text-[#F1F3EC]">
                  {formState.mode === 'create'
                    ? 'Adicionar Integrante'
                    : `Editar — ${formState.name || 'Integrante'}`}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeFormModal}
                aria-label="Fechar formulário"
                className="flex h-9 w-9 items-center justify-center border border-[#263F24] text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={(e) => void handleSubmitMemberForm(e)} className="space-y-6 p-6">
              <div className="grid gap-6 md:grid-cols-12">
                {/* Left Column: Live Photo Preview + Upload Controls */}
                <div className="space-y-3 md:col-span-5">
                  <p className="font-mono text-[11px] tracking-[0.18em] text-[#A5AAA2]">
                    FOTOGRAFIA INDIVIDUAL
                  </p>

                  <div className="relative aspect-[4/5] w-full overflow-hidden border border-[#263F24]/80 bg-[#050705]">
                    {processingPhoto ? (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-[#8BAA43]">
                        <Loader2 className="h-6 w-6 animate-spin" />
                        <span className="font-mono text-xs">Processando imagem...</span>
                      </div>
                    ) : previewPhotoInModal ? (
                      <img
                        src={previewPhotoInModal}
                        alt="Pré-visualização do integrante"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center px-4 text-center">
                        <Upload className="h-6 w-6 text-[#526B32]" />
                        <p className="mt-2 font-display text-sm font-bold tracking-[0.14em] text-[#A5AAA2]">
                          PRÉ-VISUALIZAÇÃO
                        </p>
                        <p className="mt-1 font-mono text-[10px] text-[#A5AAA2]/60">
                          ENVIE A FOTO DO COMPUTADOR
                        </p>
                      </div>
                    )}
                  </div>

                  {pendingUpload && (
                    <p className="font-mono text-[11px] text-[#8BAA43] tabular-nums">
                      Pronta para salvar · {pendingUpload.width}×{pendingUpload.height}px ·{' '}
                      {formatFileSize(pendingUpload.sizeBytes)}
                    </p>
                  )}

                  {photoError && <p className="text-xs text-[#D62828]">{photoError}</p>}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => void handlePhotoFileChange(e.target.files?.[0] || null)}
                    className="hidden"
                  />

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={processingPhoto}
                      onClick={() => fileInputRef.current?.click()}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 bg-[#526B32] px-3 py-2 text-xs font-semibold text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705]"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      {previewPhotoInModal ? 'Trocar Fotografia' : 'Selecionar do Computador'}
                    </button>

                    {previewPhotoInModal && (
                      <button
                        type="button"
                        onClick={() => {
                          setPendingUpload(null);
                          setFormState((prev) => (prev ? { ...prev, photoUrl: '' } : prev));
                        }}
                        className="inline-flex items-center gap-1 border border-[#D62828]/45 px-3 py-2 text-xs text-[#D62828] hover:bg-[#D62828]/15"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {mediaAssets.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowLibraryPicker((prev) => !prev)}
                      className="w-full border border-[#263F24] py-1.5 text-center text-[11px] text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC]"
                    >
                      {showLibraryPicker
                        ? 'Ocultar acervo de imagens'
                        : `Ou escolher do acervo (${mediaAssets.length})`}
                    </button>
                  )}

                  {showLibraryPicker && mediaAssets.length > 0 && (
                    <div className="grid max-h-36 grid-cols-3 gap-2 overflow-y-auto border border-[#263F24] bg-[#050705] p-2">
                      {mediaAssets.map((asset) => (
                        <button
                          key={asset.id}
                          type="button"
                          onClick={() => {
                            setPendingUpload(null);
                            setFormState((prev) =>
                              prev ? { ...prev, photoUrl: `media://${asset.id}` } : prev
                            );
                            setShowLibraryPicker(false);
                          }}
                          className="aspect-square overflow-hidden border border-[#263F24] hover:border-[#8BAA43]"
                        >
                          <img
                            src={asset.dataUrl}
                            alt={asset.title}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Right Column: Member Data Fields */}
                <div className="space-y-4 md:col-span-7">
                  <div>
                    <label
                      htmlFor="member-form-name"
                      className="block text-xs font-medium text-[#A5AAA2]"
                    >
                      Nome do Integrante *
                    </label>
                    <input
                      id="member-form-name"
                      type="text"
                      required
                      maxLength={120}
                      value={formState.name}
                      onChange={(e) =>
                        setFormState({ ...formState, name: e.target.value })
                      }
                      placeholder="Ex.: Nome ou codinome oficial no BRP"
                      className="mt-1.5 w-full border border-[#263F24] bg-[#050705] px-4 py-2.5 text-sm text-[#F1F3EC] placeholder-[#A5AAA2]/40 focus:border-[#8BAA43] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="member-form-rank"
                      className="block text-xs font-medium text-[#A5AAA2]"
                    >
                      Patente *
                    </label>
                    <select
                      id="member-form-rank"
                      value={formState.rankId}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          rankId: e.target.value as HierarchyRankId,
                        })
                      }
                      className="mt-1.5 w-full border border-[#263F24] bg-[#050705] px-4 py-2.5 text-sm text-[#F1F3EC] focus:border-[#8BAA43] focus:outline-none"
                    >
                      {hierarchy.map((rankOpt) => (
                        <option key={rankOpt.id} value={rankOpt.id}>
                          {rankOpt.positionCode} · {rankOpt.rankTitle}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="member-form-status"
                      className="block text-xs font-medium text-[#A5AAA2]"
                    >
                      Status do Cadastro *
                    </label>
                    <select
                      id="member-form-status"
                      value={formState.status}
                      onChange={(e) =>
                        setFormState({
                          ...formState,
                          status: e.target.value as HierarchyMemberStatus,
                        })
                      }
                      className="mt-1.5 w-full border border-[#263F24] bg-[#050705] px-4 py-2.5 text-sm text-[#F1F3EC] focus:border-[#8BAA43] focus:outline-none"
                    >
                      {MEMBER_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-[#A5AAA2]/75">
                      {
                        MEMBER_STATUS_OPTIONS.find((s) => s.value === formState.status)
                          ?.helper
                      }
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="member-form-desc"
                      className="block text-xs font-medium text-[#A5AAA2]"
                    >
                      Descrição ou Observação Individual (opcional)
                    </label>
                    <textarea
                      id="member-form-desc"
                      rows={4}
                      maxLength={800}
                      value={formState.description}
                      onChange={(e) =>
                        setFormState({ ...formState, description: e.target.value })
                      }
                      placeholder="Ex.: Especialidade, unidade sob comando ou observação institucional..."
                      className="mt-1.5 w-full border border-[#263F24] bg-[#050705] px-4 py-2.5 text-sm leading-relaxed text-[#F1F3EC] placeholder-[#A5AAA2]/40 focus:border-[#8BAA43] focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="flex flex-wrap items-center justify-end gap-3 border-t border-[#263F24]/50 pt-5">
                <button
                  type="button"
                  disabled={savingForm}
                  onClick={closeFormModal}
                  className="border border-[#263F24] px-5 py-2.5 text-xs font-medium text-[#A5AAA2] hover:text-[#F1F3EC]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingForm || processingPhoto}
                  className="inline-flex items-center gap-2 bg-[#526B32] px-6 py-2.5 text-xs font-bold tracking-wider text-[#F1F3EC] transition-colors hover:bg-[#8BAA43] hover:text-[#050705] disabled:opacity-50"
                >
                  {savingForm ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {savingForm
                    ? 'Salvando...'
                    : formState.mode === 'create'
                      ? 'Cadastrar Integrante'
                      : 'Salvar Alterações'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================== MODAL: CONFIRMAÇÃO DE EXCLUSÃO ==================== */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#050705]/90 p-4 backdrop-blur-md"
          onClick={() => {
            if (!deletingMember) setDeleteTarget(null);
          }}
        >
          <div
            className="w-full max-w-md border border-[#D62828]/60 bg-[#0B100C] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#D62828]/50 bg-[#D62828]/15 text-[#D62828]">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <p className="font-mono text-[11px] tracking-[0.2em] text-[#D62828]">
                  CONFIRMAR EXCLUSÃO
                </p>
                <h3 className="mt-1 font-display text-2xl font-bold text-[#F1F3EC]">
                  Excluir Integrante?
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-[#A5AAA2]">
                  Você está prestes a remover permanentemente{' '}
                  <strong className="text-[#F1F3EC]">{deleteTarget.name}</strong> da patente{' '}
                  <strong className="text-[#8BAA43]">
                    {hierarchy.find((r) => r.id === deleteTarget.rankId)?.rankTitle}
                  </strong>
                  . Os demais integrantes não serão afetados.
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-[#263F24]/50 pt-4">
              <button
                type="button"
                disabled={deletingMember}
                onClick={() => setDeleteTarget(null)}
                className="border border-[#263F24] px-4 py-2 text-xs text-[#A5AAA2] hover:text-[#F1F3EC]"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={deletingMember}
                onClick={() => void handleConfirmDelete()}
                className="inline-flex items-center gap-2 bg-[#D62828] px-5 py-2 text-xs font-bold tracking-wider text-[#F1F3EC] hover:bg-[#D62828]/85 disabled:opacity-50"
              >
                {deletingMember ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                {deletingMember ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
