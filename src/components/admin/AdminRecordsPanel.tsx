import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  Eye,
  Loader2,
  Plus,
  Star,
  Trash2,
  Upload,
} from 'lucide-react';
import { MediaImage } from '../MediaImage';
import { AdminHierarchyPanel } from './AdminHierarchyPanel';
import { usePortal } from '../../context/PortalContext';
import { GalleryItem, OperationRecord, RoleSpecialty } from '../../types/portal';
import { optimizeImageFile } from '../../utils/imageOptimizer';

export type AdminRecordSection = 'hierarquia' | 'funcoes' | 'operacoes' | 'galeria';

interface AdminRecordsPanelProps {
  section: AdminRecordSection;
  onPreviewUrl: (url: string, title: string) => void;
}

export const AdminRecordsPanel: React.FC<AdminRecordsPanelProps> = ({
  section,
  onPreviewUrl,
}) => {
  const {
    roles,
    saveRoleSpecialty,
    deleteRoleSpecialty,
    operations,
    saveOperationRecord,
    deleteOperationRecord,
    gallery,
    saveGalleryItem,
    deleteGalleryItem,
    reorderGalleryItems,
    openQuickImageEditor,
    uploadMediaAsset,
    resolveMediaUrl,
    showToast,
  } = usePortal();

  const [editingRole, setEditingRole] = useState<RoleSpecialty | null>(null);
  const [editingOp, setEditingOp] = useState<OperationRecord | null>(null);
  const [editingGallery, setEditingGallery] = useState<GalleryItem | null>(null);

  const [batchCategory, setBatchCategory] = useState('Institucional');
  const [customCategoryInput, setCustomCategoryInput] = useState('');
  const [batchUploading, setBatchUploading] = useState(false);
  const [savingItem, setSavingItem] = useState(false);

  const batchInputRef = useRef<HTMLInputElement | null>(null);

  // Batch upload multiple photographs to Gallery at once
  const handleBatchGalleryUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const categoryName = customCategoryInput.trim() || batchCategory;
    setBatchUploading(true);
    let successCount = 0;

    try {
      const baseOrder = gallery.length;
      const dateStr = new Date().toISOString().slice(0, 7);

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const optimized = await optimizeImageFile(file, {
          maxDimension: 1400,
          preserveTransparency: false,
        });
        const cleanTitle = file.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
        const uploaded = await uploadMediaAsset(optimized, {
          page: 'galeria',
          title: cleanTitle || `Registro ${baseOrder + i + 1}`,
        });

        await saveGalleryItem({
          id: `gal_${Date.now()}_${i}`,
          title: cleanTitle || `Registro Fotográfico ${baseOrder + i + 1}`,
          description: '',
          category: categoryName,
          date: dateStr,
          imageUrl: uploaded.refUrl,
          isCover: false,
          order: baseOrder + i + 1,
          isDemo: false,
        });
        successCount += 1;
      }

      if (successCount > 0) {
        showToast(
          `${successCount} ${successCount === 1 ? 'imagem publicada' : 'imagens publicadas'} na galeria.`,
          'success'
        );
      }
      setCustomCategoryInput('');
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Erro durante o envio em lote.', 'error');
    } finally {
      setBatchUploading(false);
      if (batchInputRef.current) batchInputRef.current.value = '';
    }
  };

  const moveGalleryItem = async (index: number, direction: -1 | 1) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= gallery.length) return;
    const nextList = [...gallery];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(targetIdx, 0, moved);
    await reorderGalleryItems(nextList);
  };

  const setGalleryCover = async (target: GalleryItem) => {
    const updated = gallery.map((item) => ({
      ...item,
      isCover: item.id === target.id,
    }));
    await reorderGalleryItems(updated);
  };

  // ==================== GERENCIAR HIERARQUIA (MÚLTIPLOS INTEGRANTES POR PATENTE) ====================
  if (section === 'hierarquia') {
    return <AdminHierarchyPanel onPreviewUrl={onPreviewUrl} />;
  }

  // ==================== FUNÇÕES ====================
  if (section === 'funcoes') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#263F24]/50 pb-5">
          <div>
            <h2 className="font-display text-3xl font-bold text-[#F1F3EC]">
              Gerenciar Funções e Especialidades
            </h2>
            <p className="text-xs text-[#A5AAA2]">
              Adicione fotografias reais, edite atribuições ou cadastre novas funções da 1.F.M.O.T.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditingRole({
                id: `func_${Date.now()}`,
                name: '',
                category: 'Especialidades',
                iconName: 'Shield',
                imageUrl: '',
                description: '',
                responsibilities: [''],
                requirements: [''],
                order: roles.length + 1,
                isDemo: false,
              })
            }
            className="inline-flex items-center gap-2 bg-[#526B32] px-4 py-2 text-xs font-semibold text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705] whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nova Função
          </button>
        </div>

        {editingRole && (
          <div className="space-y-4 border border-[#8BAA43]/60 bg-[#050705] p-6">
            <h3 className="font-display text-xl font-bold text-[#8BAA43]">Editar Função</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-xs text-[#A5AAA2]">Nome *</label>
                <input
                  type="text"
                  value={editingRole.name}
                  onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                  className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A5AAA2]">Categoria *</label>
                <input
                  type="text"
                  value={editingRole.category}
                  onChange={(e) => setEditingRole({ ...editingRole, category: e.target.value })}
                  className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A5AAA2]">Ícone</label>
                <select
                  value={editingRole.iconName}
                  onChange={(e) => setEditingRole({ ...editingRole, iconName: e.target.value })}
                  className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC]"
                >
                  <option value="Shield">Escudo (Comando)</option>
                  <option value="Crosshair">Alvo (Operações Especiais)</option>
                  <option value="Radar">Radar (Fiscalização / Investigação)</option>
                  <option value="Wrench">Ferramenta (Engenharia)</option>
                  <option value="BookOpen">Manual (Capacitação)</option>
                  <option value="Compass">Bússola (Tropa / Stives)</option>
                  <option value="Activity">Atividade (Suporte)</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#A5AAA2]">Descrição *</label>
              <textarea
                rows={2}
                value={editingRole.description}
                onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC]"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-[#A5AAA2]">
                  Atribuições (uma por linha, máx. 8)
                </label>
                <textarea
                  rows={4}
                  value={editingRole.responsibilities.join('\n')}
                  onChange={(e) =>
                    setEditingRole({
                      ...editingRole,
                      responsibilities: e.target.value.split('\n'),
                    })
                  }
                  className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-xs text-[#F1F3EC]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A5AAA2]">
                  Diretrizes (uma por linha, máx. 8)
                </label>
                <textarea
                  rows={4}
                  value={editingRole.requirements.join('\n')}
                  onChange={(e) =>
                    setEditingRole({
                      ...editingRole,
                      requirements: e.target.value.split('\n'),
                    })
                  }
                  className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-xs text-[#F1F3EC]"
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={savingItem}
                onClick={async () => {
                  if (!editingRole.name.trim() || !editingRole.description.trim()) {
                    showToast('Informe o nome e a descrição da função.', 'error');
                    return;
                  }
                  setSavingItem(true);
                  try {
                    await saveRoleSpecialty(editingRole);
                    setEditingRole(null);
                  } finally {
                    setSavingItem(false);
                  }
                }}
                className="inline-flex items-center gap-2 bg-[#526B32] px-5 py-2 text-xs font-semibold text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705]"
              >
                <Check className="h-3.5 w-3.5" />
                Salvar Função
              </button>
              <button
                type="button"
                onClick={() => setEditingRole(null)}
                className="border border-[#263F24] px-4 py-2 text-xs text-[#A5AAA2]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-[#263F24]/45">
          {roles.map((role) => {
            const resolved = resolveMediaUrl(role.imageUrl);
            return (
              <div key={role.id} className="flex flex-col gap-5 py-6 sm:flex-row sm:items-center">
                <div className="aspect-[16/10] w-full shrink-0 sm:w-44">
                  <MediaImage
                    src={role.imageUrl}
                    alt={role.name}
                    placeholderLabel="IMAGEM DA FUNÇÃO"
                    containerClassName="h-full w-full"
                    className="h-full w-full object-cover"
                    compact
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] text-[#8BAA43]">{role.category}</p>
                  <h3 className="font-display text-xl font-bold text-[#F1F3EC]">{role.name}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-[#A5AAA2]">{role.description}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openQuickImageEditor({
                        title: `Fotografia — ${role.name}`,
                        page: 'funcoes',
                        currentUrl: role.imageUrl || '',
                        onPublish: async (imageUrl) => {
                          await saveRoleSpecialty({ ...role, imageUrl });
                        },
                        onRemove: async () => {
                          await saveRoleSpecialty({ ...role, imageUrl: '' });
                        },
                      })
                    }
                    className="inline-flex items-center gap-1.5 bg-[#526B32] px-3 py-1.5 text-xs font-semibold text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705]"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {resolved ? 'Alterar Imagem' : 'Enviar Imagem'}
                  </button>
                  {resolved && (
                    <button
                      type="button"
                      onClick={() => onPreviewUrl(resolved, role.name)}
                      className="inline-flex items-center gap-1 border border-[#263F24] px-2.5 py-1.5 text-xs text-[#A5AAA2] hover:text-[#F1F3EC]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingRole(role)}
                    className="border border-[#263F24] px-3 py-1.5 text-xs text-[#A5AAA2] hover:text-[#F1F3EC]"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteRoleSpecialty(role.id)}
                    className="inline-flex items-center gap-1 border border-[#D62828]/40 px-2.5 py-1.5 text-xs text-[#D62828] hover:bg-[#D62828]/15"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==================== TRABALHOS E OPERAÇÕES ====================
  if (section === 'operacoes') {
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#263F24]/50 pb-5">
          <div>
            <h2 className="font-display text-3xl font-bold text-[#F1F3EC]">
              Gerenciar Trabalhos e Operações
            </h2>
            <p className="text-xs text-[#A5AAA2]">
              Publique registros reais das operações diárias, semanais e especiais com fotografias
              de capa e galeria complementar.
            </p>
          </div>
          <button
            type="button"
            onClick={() =>
              setEditingOp({
                id: `op_${Date.now()}`,
                title: '',
                category: 'Operação Diária',
                date: new Date().toISOString().slice(0, 7),
                summary: '',
                details: '',
                results: '',
                coverImageUrl: '',
                galleryUrls: [],
                featured: true,
                isDemo: false,
                order: operations.length + 1,
              })
            }
            className="inline-flex items-center gap-2 bg-[#526B32] px-4 py-2 text-xs font-semibold text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705] whitespace-nowrap shrink-0"
          >
            <Plus className="h-4 w-4" />
            Nova Operação
          </button>
        </div>

        {editingOp && (
          <div className="space-y-4 border border-[#8BAA43]/60 bg-[#050705] p-6">
            <h3 className="font-display text-xl font-bold text-[#8BAA43]">
              Editar Registro Operacional
            </h3>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="block text-xs text-[#A5AAA2]">Título *</label>
                <input
                  type="text"
                  value={editingOp.title}
                  onChange={(e) => setEditingOp({ ...editingOp, title: e.target.value })}
                  className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC]"
                />
              </div>
              <div>
                <label className="block text-xs text-[#A5AAA2]">Data (opcional)</label>
                <input
                  type="text"
                  value={editingOp.date}
                  onChange={(e) => setEditingOp({ ...editingOp, date: e.target.value })}
                  placeholder="Ex: 2026-11"
                  className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC] tabular-nums"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-[#A5AAA2]">Categoria *</label>
                <input
                  type="text"
                  value={editingOp.category}
                  onChange={(e) => setEditingOp({ ...editingOp, category: e.target.value })}
                  className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC]"
                />
              </div>
              <div className="flex flex-wrap items-end gap-5 pb-2">
                <label className="flex items-center gap-2 text-xs text-[#F1F3EC]">
                  <input
                    type="checkbox"
                    checked={editingOp.isDemo}
                    onChange={(e) => setEditingOp({ ...editingOp, isDemo: e.target.checked })}
                    className="accent-[#8BAA43]"
                  />
                  Marcar como espaço reservado
                </label>
              </div>
            </div>

            <div>
              <label className="block text-xs text-[#A5AAA2]">Resumo *</label>
              <textarea
                rows={2}
                value={editingOp.summary}
                onChange={(e) => setEditingOp({ ...editingOp, summary: e.target.value })}
                className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#A5AAA2]">Descrição Completa *</label>
              <textarea
                rows={4}
                value={editingOp.details}
                onChange={(e) => setEditingOp({ ...editingOp, details: e.target.value })}
                className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC]"
              />
            </div>

            <div>
              <label className="block text-xs text-[#A5AAA2]">Síntese / Resultados (opcional)</label>
              <textarea
                rows={2}
                value={editingOp.results}
                onChange={(e) => setEditingOp({ ...editingOp, results: e.target.value })}
                className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC]"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={savingItem}
                onClick={async () => {
                  if (
                    !editingOp.title.trim() ||
                    !editingOp.summary.trim() ||
                    !editingOp.details.trim()
                  ) {
                    showToast('Preencha título, resumo e descrição completa.', 'error');
                    return;
                  }
                  setSavingItem(true);
                  try {
                    await saveOperationRecord(editingOp);
                    setEditingOp(null);
                  } finally {
                    setSavingItem(false);
                  }
                }}
                className="inline-flex items-center gap-2 bg-[#526B32] px-5 py-2 text-xs font-semibold text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705]"
              >
                <Check className="h-3.5 w-3.5" />
                Publicar Registro
              </button>
              <button
                type="button"
                onClick={() => setEditingOp(null)}
                className="border border-[#263F24] px-4 py-2 text-xs text-[#A5AAA2]"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        <div className="divide-y divide-[#263F24]/45">
          {operations.map((op) => {
            const resolved = resolveMediaUrl(op.coverImageUrl);
            return (
              <div key={op.id} className="flex flex-col gap-5 py-6 sm:flex-row sm:items-center">
                <div className="aspect-[16/10] w-full shrink-0 sm:w-48">
                  <MediaImage
                    src={op.coverImageUrl}
                    alt={op.title}
                    placeholderLabel="CAPA DA OPERAÇÃO"
                    containerClassName="h-full w-full"
                    className="h-full w-full object-cover"
                    compact
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-[11px] text-[#8BAA43]">
                    {op.category}
                    {op.date ? ` · ${op.date}` : ''}
                  </p>
                  <h3 className="mt-1 font-display text-xl font-bold text-[#F1F3EC]">{op.title}</h3>
                  <p className="mt-1 line-clamp-2 text-xs text-[#A5AAA2]">{op.summary}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      openQuickImageEditor({
                        title: `Capa — ${op.title}`,
                        page: 'operacoes',
                        currentUrl: op.coverImageUrl,
                        onPublish: async (imageUrl) => {
                          await saveOperationRecord({ ...op, coverImageUrl: imageUrl, isDemo: false });
                        },
                        onRemove: async () => {
                          await saveOperationRecord({ ...op, coverImageUrl: '' });
                        },
                      })
                    }
                    className="inline-flex items-center gap-1.5 bg-[#526B32] px-3 py-1.5 text-xs font-semibold text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705]"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {resolved ? 'Alterar Capa' : 'Enviar Capa'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      openQuickImageEditor({
                        title: `Foto Adicional — ${op.title}`,
                        page: 'operacoes',
                        currentUrl: '',
                        onPublish: async (imageUrl) => {
                          const nextGallery = [...(op.galleryUrls || []), imageUrl].slice(0, 6);
                          await saveOperationRecord({ ...op, galleryUrls: nextGallery, isDemo: false });
                        },
                      })
                    }
                    className="inline-flex items-center gap-1 border border-[#263F24] px-3 py-1.5 text-xs text-[#A5AAA2] hover:text-[#F1F3EC]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Extra ({op.galleryUrls?.length || 0}/6)
                  </button>
                  {resolved && (
                    <button
                      type="button"
                      onClick={() => onPreviewUrl(resolved, op.title)}
                      className="inline-flex items-center gap-1 border border-[#263F24] px-2.5 py-1.5 text-xs text-[#A5AAA2] hover:text-[#F1F3EC]"
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setEditingOp(op)}
                    className="border border-[#263F24] px-3 py-1.5 text-xs text-[#A5AAA2] hover:text-[#F1F3EC]"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void deleteOperationRecord(op.id)}
                    className="inline-flex items-center gap-1 border border-[#D62828]/40 px-2.5 py-1.5 text-xs text-[#D62828] hover:bg-[#D62828]/15"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ==================== GALERIA ====================
  const existingCats = Array.from(
    new Set(['Institucional', 'Operações', 'Capacitação', 'Equipe', ...gallery.map((g) => g.category)])
  );

  return (
    <div className="space-y-6">
      <div className="border-b border-[#263F24]/50 pb-5">
        <h2 className="font-display text-3xl font-bold text-[#F1F3EC]">
          Gerenciar Galeria Fotográfica
        </h2>
        <p className="text-xs text-[#A5AAA2]">
          Envie várias fotografias do computador de uma vez, crie categorias, defina a foto de capa
          e organize a ordem de exibição.
        </p>
      </div>

      {/* Batch Upload Bar */}
      <div className="border border-[#526B32]/60 bg-[#263F24]/15 p-6">
        <p className="font-mono text-xs tracking-wider text-[#8BAA43]">UPLOAD MÚLTIPLO PERSISTENTE</p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-xs text-[#A5AAA2]">Categoria</label>
            <select
              value={batchCategory}
              onChange={(e) => setBatchCategory(e.target.value)}
              className="mt-1 w-full border border-[#263F24] bg-[#050705] px-3 py-2.5 text-sm text-[#F1F3EC]"
            >
              {existingCats.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#A5AAA2]">Nova Categoria (opcional)</label>
            <input
              type="text"
              value={customCategoryInput}
              onChange={(e) => setCustomCategoryInput(e.target.value)}
              placeholder="Ex: Operação Noturna"
              className="mt-1 w-full border border-[#263F24] bg-[#050705] px-3 py-2.5 text-sm text-[#F1F3EC]"
            />
          </div>
          <div className="flex items-end">
            <input
              ref={batchInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              onChange={(e) => void handleBatchGalleryUpload(e.target.files)}
              className="hidden"
            />
            <button
              type="button"
              disabled={batchUploading}
              onClick={() => batchInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 bg-[#526B32] px-4 py-2.5 text-xs font-semibold text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705] disabled:opacity-50"
            >
              {batchUploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
              {batchUploading ? 'Otimizando e enviando...' : 'Adicionar Várias Imagens'}
            </button>
          </div>
        </div>
      </div>

      {editingGallery && (
        <div className="space-y-4 border border-[#8BAA43]/60 bg-[#050705] p-6">
          <h3 className="font-display text-lg font-bold text-[#8BAA43]">
            Editar Detalhes da Fotografia
          </h3>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-xs text-[#A5AAA2]">Título *</label>
              <input
                type="text"
                value={editingGallery.title}
                onChange={(e) => setEditingGallery({ ...editingGallery, title: e.target.value })}
                className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#A5AAA2]">Categoria *</label>
              <input
                type="text"
                value={editingGallery.category}
                onChange={(e) => setEditingGallery({ ...editingGallery, category: e.target.value })}
                className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#A5AAA2]">Data (opcional)</label>
              <input
                type="text"
                value={editingGallery.date}
                onChange={(e) => setEditingGallery({ ...editingGallery, date: e.target.value })}
                className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC] tabular-nums"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[#A5AAA2]">Descrição</label>
            <textarea
              rows={2}
              value={editingGallery.description || ''}
              onChange={(e) =>
                setEditingGallery({ ...editingGallery, description: e.target.value })
              }
              className="mt-1 w-full border border-[#263F24] bg-[#0B100C] px-3 py-2 text-sm text-[#F1F3EC]"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={async () => {
                await saveGalleryItem({ ...editingGallery, isDemo: false });
                setEditingGallery(null);
              }}
              className="inline-flex items-center gap-2 bg-[#526B32] px-5 py-2 text-xs font-semibold text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705]"
            >
              <Check className="h-3.5 w-3.5" />
              Salvar Alterações
            </button>
            <button
              type="button"
              onClick={() => setEditingGallery(null)}
              className="border border-[#263F24] px-4 py-2 text-xs text-[#A5AAA2]"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="divide-y divide-[#263F24]/45">
        {gallery.map((item, idx) => {
          const resolved = resolveMediaUrl(item.imageUrl);
          return (
            <div key={item.id} className="flex flex-col gap-4 py-4 sm:flex-row sm:items-center">
              <div className="flex items-center gap-3">
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => void moveGalleryItem(idx, -1)}
                    aria-label="Mover para cima"
                    className="flex h-7 w-7 items-center justify-center border border-[#263F24] text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC] disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === gallery.length - 1}
                    onClick={() => void moveGalleryItem(idx, 1)}
                    aria-label="Mover para baixo"
                    className="flex h-7 w-7 items-center justify-center border border-[#263F24] text-[#A5AAA2] hover:border-[#8BAA43] hover:text-[#F1F3EC] disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="h-20 w-28 shrink-0">
                  <MediaImage
                    src={item.imageUrl}
                    alt={item.title}
                    placeholderLabel="GALERIA"
                    containerClassName="h-full w-full"
                    className="h-full w-full object-cover"
                    compact
                  />
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-[#A5AAA2]">
                  <span className="text-[#526B32] tabular-nums">
                    #{String(idx + 1).padStart(2, '0')}
                  </span>
                  <span className="text-[#8BAA43]">{item.category}</span>
                  {item.isCover && <span className="text-[#FFC928]">· CAPA</span>}
                </div>
                <h3 className="mt-1 truncate font-display text-lg font-bold text-[#F1F3EC]">
                  {item.title}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
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
                    })
                  }
                  className="inline-flex items-center gap-1.5 bg-[#526B32] px-3 py-1.5 text-xs font-semibold text-[#F1F3EC] hover:bg-[#8BAA43] hover:text-[#050705]"
                >
                  <Upload className="h-3.5 w-3.5" />
                  {resolved ? 'Alterar' : 'Enviar'}
                </button>
                {resolved && (
                  <button
                    type="button"
                    onClick={() => onPreviewUrl(resolved, item.title)}
                    className="inline-flex items-center gap-1 border border-[#263F24] px-2.5 py-1.5 text-xs text-[#A5AAA2] hover:text-[#F1F3EC]"
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void setGalleryCover(item)}
                  className={`inline-flex items-center gap-1 border px-2.5 py-1.5 text-xs ${
                    item.isCover
                      ? 'border-[#FFC928]/70 text-[#FFC928]'
                      : 'border-[#263F24] text-[#A5AAA2] hover:text-[#F1F3EC]'
                  }`}
                >
                  <Star className="h-3.5 w-3.5" />
                  Capa
                </button>
                <button
                  type="button"
                  onClick={() => setEditingGallery(item)}
                  className="border border-[#263F24] px-2.5 py-1.5 text-xs text-[#A5AAA2] hover:text-[#F1F3EC]"
                >
                  Editar
                </button>
                <button
                  type="button"
                  onClick={() => void deleteGalleryItem(item.id)}
                  className="inline-flex items-center gap-1 border border-[#D62828]/40 px-2.5 py-1.5 text-xs text-[#D62828] hover:bg-[#D62828]/15"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
