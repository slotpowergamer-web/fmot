import React, { useRef, useState } from 'react';
import { Check, ExternalLink, Image as ImageIcon, Loader2, Trash2, Upload, X } from 'lucide-react';
import { usePortal } from '../context/PortalContext';
import { formatFileSize, optimizeImageFile, OptimizedImageResult } from '../utils/imageOptimizer';

export const QuickImageModal: React.FC = () => {
  const {
    quickImageTarget,
    closeQuickImageEditor,
    uploadMediaAsset,
    resolveMediaUrl,
    showToast,
    supabaseReadyForWrites,
  } = usePortal();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [optimized, setOptimized] = useState<OptimizedImageResult | null>(null);
  const [externalUrl, setExternalUrl] = useState('');
  const [title, setTitle] = useState('');
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!quickImageTarget) return null;

  const currentResolved = resolveMediaUrl(quickImageTarget.currentUrl);
  const previewSrc = optimized?.dataUrl || externalUrl.trim() || currentResolved;

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setProcessing(true);
    try {
      const result = await optimizeImageFile(file, {
        preserveTransparency: quickImageTarget.preserveTransparency,
        maxDimension: quickImageTarget.preserveTransparency ? 1200 : 1920,
      });
      setOptimized(result);
      setExternalUrl('');
      if (!title) {
        setTitle(quickImageTarget.title);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao processar imagem.');
    } finally {
      setProcessing(false);
    }
  };

  const handlePublish = async () => {
    setError(null);
    setSaving(true);
    try {
      if (optimized) {
        const uploaded = await uploadMediaAsset(optimized, {
          page: quickImageTarget.page,
          title: title.trim() || quickImageTarget.title,
        });
        await quickImageTarget.onPublish(uploaded.refUrl, uploaded.assetId);
      } else if (externalUrl.trim()) {
        if (!/^https?:\/\/.+/.test(externalUrl.trim())) {
          throw new Error('Informe uma URL válida iniciada com https:// ou http://.');
        }
        await quickImageTarget.onPublish(externalUrl.trim());
      } else {
        throw new Error('Selecione uma imagem do computador ou informe uma URL válida.');
      }
      setOptimized(null);
      setExternalUrl('');
      setTitle('');
      closeQuickImageEditor();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao publicar imagem.';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!quickImageTarget.onRemove) return;
    setSaving(true);
    try {
      await quickImageTarget.onRemove();
      setOptimized(null);
      setExternalUrl('');
      closeQuickImageEditor();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao remover imagem.');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setOptimized(null);
    setExternalUrl('');
    setTitle('');
    setError(null);
    closeQuickImageEditor();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#050705]/85 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-image-modal-title"
    >
      <div className="w-full max-w-2xl border border-[#263F24] bg-[#0B100C] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#263F24]/60 px-6 py-4">
          <div>
            <p className="text-xs font-mono text-[#8BAA43]">Gerenciamento Direto de Imagem</p>
            <h2
              id="quick-image-modal-title"
              className="font-display text-xl font-bold text-[#F1F3EC]"
            >
              {quickImageTarget.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar editor de imagem"
            className="flex h-10 w-10 items-center justify-center border border-[#263F24]/60 text-[#A5AAA2] transition-colors hover:border-[#8BAA43] hover:text-[#F1F3EC]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-6">
          {/* Preview area */}
          <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden border border-[#263F24]/60 bg-[#050705]">
            {previewSrc ? (
              <img
                src={previewSrc}
                alt="Pré-visualização da imagem"
                referrerPolicy="no-referrer"
                className={`max-h-full max-w-full ${
                  quickImageTarget.preserveTransparency ? 'object-contain p-4' : 'h-full w-full object-cover'
                }`}
              />
            ) : (
              <div className="flex flex-col items-center gap-2 text-[#A5AAA2]">
                <ImageIcon className="h-8 w-8 text-[#526B32]" />
                <span className="text-xs">Nenhuma imagem selecionada</span>
              </div>
            )}
          </div>

          {/* Optimization summary */}
          {optimized && (
            <div className="flex flex-wrap items-center justify-between gap-2 border border-[#526B32]/50 bg-[#263F24]/20 px-4 py-2.5 text-xs text-[#F1F3EC]">
              <span className="font-medium text-[#8BAA43]">
                Pronta para publicação · {optimized.width}×{optimized.height}px
              </span>
              <span className="font-mono text-[#A5AAA2] tabular-nums">
                Original: {formatFileSize(optimized.originalSizeBytes)} → Otimizada:{' '}
                {formatFileSize(optimized.sizeBytes)}
              </span>
            </div>
          )}

          {/* Upload picker */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void handleFileChange(e.target.files?.[0])}
                className="hidden"
              />
              <button
                type="button"
                disabled={processing || saving}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 border border-[#526B32] bg-[#263F24]/40 px-4 py-3 text-sm font-semibold text-[#F1F3EC] transition-colors hover:border-[#8BAA43] hover:bg-[#263F24]/70 disabled:opacity-50"
              >
                {processing ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[#8BAA43]" />
                ) : (
                  <Upload className="h-4 w-4 text-[#8BAA43]" />
                )}
                {processing ? 'Otimizando imagem...' : 'Selecionar do Computador'}
              </button>
              <p className="mt-1.5 text-xs text-[#A5AAA2]">
                JPG, PNG ou WebP até 15 MB. Otimização automática preservando qualidade.
              </p>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#A5AAA2] mb-1.5">
                Ou informe uma URL persistente (HTTPS)
              </label>
              <div className="relative">
                <input
                  type="url"
                  value={externalUrl}
                  onChange={(e) => {
                    setExternalUrl(e.target.value);
                    setOptimized(null);
                  }}
                  placeholder="https://..."
                  className="w-full border border-[#263F24] bg-[#050705] px-3 py-2.5 pr-9 text-sm text-[#F1F3EC] placeholder-[#A5AAA2]/50 focus:border-[#8BAA43] focus:outline-none"
                />
                <ExternalLink className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#526B32]" />
              </div>
            </div>
          </div>

          {!supabaseReadyForWrites && (
            <div className="border border-[#8BAA43]/60 bg-[#263F24]/25 px-4 py-2.5 text-xs text-[#F1F3EC]">
              Conecte sua sessão administrativa do Supabase no topo do Painel Administrativo para
              habilitar envios diretos ao bucket <span className="font-mono">fmot-media</span>.
            </div>
          )}

          {error && (
            <div className="border border-[#D62828]/60 bg-[#D62828]/10 px-4 py-2.5 text-xs text-[#F1F3EC]">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#263F24]/60 pt-4">
            <div>
              {quickImageTarget.onRemove && (
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void handleRemove()}
                  className="inline-flex items-center gap-2 border border-[#D62828]/50 px-4 py-2 text-xs font-semibold text-[#F1F3EC] transition-colors hover:bg-[#D62828]/20 disabled:opacity-50 whitespace-nowrap shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5 text-[#D62828]" />
                  Restaurar / Remover
                </button>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleClose}
                className="border border-[#263F24] px-4 py-2 text-xs font-semibold text-[#A5AAA2] transition-colors hover:border-[#526B32] hover:text-[#F1F3EC] whitespace-nowrap shrink-0"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving || processing || (!optimized && !externalUrl.trim())}
                onClick={() => void handlePublish()}
                className="inline-flex items-center gap-2 bg-[#526B32] px-5 py-2 text-xs font-semibold text-[#F1F3EC] transition-colors hover:bg-[#8BAA43] hover:text-[#050705] disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                {saving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Check className="h-3.5 w-3.5" />
                )}
                {saving ? 'Publicando...' : 'Salvar e Publicar'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
