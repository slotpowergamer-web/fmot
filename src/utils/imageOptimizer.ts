export interface OptimizedImageResult {
  fileName: string;
  mimeType: 'image/webp' | 'image/jpeg' | 'image/png';
  dataUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalSizeBytes: number;
}

const ALLOWED_INPUT_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_INPUT_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB input cap (matches fmot-media bucket limit)
const TARGET_MAX_BINARY_BYTES = 2.5 * 1024 * 1024; // Crisp high-res web delivery for Supabase Storage

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function dataUrlToBlob(dataUrl: string, fallbackMime = 'image/webp'): Blob {
  const commaIndex = dataUrl.indexOf(',');
  if (commaIndex === -1) {
    throw new Error('Formato dataUrl inválido para conversão binária.');
  }
  const header = dataUrl.slice(0, commaIndex);
  const base64 = dataUrl.slice(commaIndex + 1);
  const mimeMatch = header.match(/data:([^;]+);base64/i);
  const mimeType = mimeMatch?.[1] || fallbackMime;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

/**
 * Computes a deterministic SHA-256 hex digest of an image Blob to prevent duplicate uploads
 * of identical files in Supabase Storage (`fmot-media`).
 */
export async function computeBlobSha256Hex(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }
  // Fallback deterministic FNV-1a 64-bit-like hex if subtle crypto is unavailable
  const bytes = new Uint8Array(buffer);
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < bytes.length; i += 1) {
    h1 = Math.imul(h1 ^ bytes[i], 0x01000193);
    h2 = Math.imul(h2 ^ bytes[i], 0x85ebca6b);
  }
  return `${(h1 >>> 0).toString(16).padStart(8, '0')}${(h2 >>> 0).toString(16).padStart(8, '0')}`;
}

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_INPUT_TYPES.includes(file.type)) {
    return 'Formato inválido. Utilize apenas imagens JPG, PNG ou WebP.';
  }
  if (file.size <= 0) {
    return 'O arquivo selecionado está vazio.';
  }
  if (file.size > MAX_INPUT_SIZE_BYTES) {
    return 'Arquivo excede o limite de 15 MB. Selecione uma imagem menor.';
  }
  return null;
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Não foi possível decodificar a imagem selecionada.'));
      img.src = String(reader.result);
    };
    reader.onerror = () => reject(new Error('Falha ao ler o arquivo selecionado.'));
    reader.readAsDataURL(file);
  });
}

export async function optimizeImageFile(
  file: File,
  options?: { maxDimension?: number; preserveTransparency?: boolean }
): Promise<OptimizedImageResult> {
  const validationError = validateImageFile(file);
  if (validationError) {
    throw new Error(validationError);
  }

  const img = await loadImageElement(file);
  const preserveTransparency =
    options?.preserveTransparency ?? (file.type === 'image/png' || file.type === 'image/webp');
  let maxDimension = options?.maxDimension ?? (preserveTransparency ? 1400 : 1920);

  const width = img.naturalWidth;
  const height = img.naturalHeight;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Contexto gráfico indisponível para otimização da imagem.');
  }

  const encode = (
    targetW: number,
    targetH: number,
    mime: 'image/webp' | 'image/jpeg' | 'image/png',
    quality: number
  ) => {
    canvas.width = targetW;
    canvas.height = targetH;
    ctx.clearRect(0, 0, targetW, targetH);
    ctx.drawImage(img, 0, 0, targetW, targetH);
    return canvas.toDataURL(mime, quality);
  };

  const scaleToMax = (origW: number, origH: number, maxDim: number) => {
    if (origW <= maxDim && origH <= maxDim) {
      return { w: origW, h: origH };
    }
    const ratio = origW / origH;
    if (origW >= origH) {
      return { w: maxDim, h: Math.max(1, Math.round(maxDim / ratio)) };
    }
    return { w: Math.max(1, Math.round(maxDim * ratio)), h: maxDim };
  };

  // Prefer WebP (supports alpha & superior compression); fallback to PNG or JPEG if needed
  let selectedMime: 'image/webp' | 'image/jpeg' | 'image/png' = 'image/webp';
  const probe = encode(2, 2, 'image/webp', 0.85);
  if (!probe.startsWith('data:image/webp')) {
    selectedMime = preserveTransparency ? 'image/png' : 'image/jpeg';
  }

  let dims = scaleToMax(width, height, maxDimension);
  let quality = 0.88;
  let dataUrl = encode(dims.w, dims.h, selectedMime, quality);

  const estimateBytes = (url: string) => {
    const base64Body = url.split(',')[1] || '';
    return Math.round((base64Body.length * 3) / 4);
  };

  // Keep output lightweight for fast CDN delivery while preserving high photographic fidelity
  let attempts = 0;
  while (estimateBytes(dataUrl) > TARGET_MAX_BINARY_BYTES && attempts < 6) {
    attempts += 1;
    if (quality > 0.68 && selectedMime !== 'image/png') {
      quality = Math.max(0.65, quality - 0.08);
    } else {
      maxDimension = Math.max(800, Math.round(maxDimension * 0.82));
      dims = scaleToMax(width, height, maxDimension);
    }
    dataUrl = encode(dims.w, dims.h, selectedMime, quality);
  }

  const sizeBytes = estimateBytes(dataUrl);
  if (sizeBytes > MAX_INPUT_SIZE_BYTES) {
    throw new Error('A imagem otimizada excede o limite de 15 MB permitido pelo bucket fmot-media.');
  }

  return {
    fileName: file.name.slice(0, 180),
    mimeType: selectedMime,
    dataUrl,
    width: dims.w,
    height: dims.h,
    sizeBytes,
    originalSizeBytes: file.size,
  };
}
