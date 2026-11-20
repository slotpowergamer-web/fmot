import type { ManagedPageKey } from '../../types/portal';
import { computeBlobSha256Hex } from '../../utils/imageOptimizer';
import { requireSupabaseBrowserClient } from './client';
import { SUPABASE_MEDIA_BUCKET } from './types';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB (matches fmot-media bucket limit)

function sanitizeSegment(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

function extensionForMime(mimeType: string): string {
  switch (mimeType) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
      return 'jpg';
    case 'image/webp':
    default:
      return 'webp';
  }
}

export interface SupabaseUploadedMedia {
  storagePath: string;
  publicUrl: string;
  sizeBytes: number;
  mimeType: 'image/webp' | 'image/jpeg' | 'image/png';
  contentHash: string;
}

/**
 * Builds a deterministic, collision-safe storage path inside `fmot-media`
 * based on the page key and the SHA-256 content hash of the image binary,
 * preventing duplicate files when the exact same image is uploaded more than once.
 */
export async function buildDeduplicatedStoragePath(
  fileOrBlob: Blob,
  options: {
    page: ManagedPageKey;
    fileName: string;
    mimeType?: string;
    prefix?: string;
  }
): Promise<{ storagePath: string; contentHash: string; mimeType: 'image/webp' | 'image/jpeg' | 'image/png' }> {
  const mimeType = (options.mimeType || fileOrBlob.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error('Formato de imagem não suportado. Utilize JPG, PNG ou WebP.');
  }
  if (fileOrBlob.size <= 0 || fileOrBlob.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error('O tamanho da imagem deve ser maior que 0 bytes e de até 15 MB.');
  }

  const contentHash = await computeBlobSha256Hex(fileOrBlob);
  const shortHash = contentHash.slice(0, 16);
  const pageDir = sanitizeSegment(options.page) || 'geral';
  const baseName = sanitizeSegment(options.fileName.replace(/\.[^.]+$/, '')).slice(0, 40) || 'imagem';
  const ext = extensionForMime(mimeType);
  const prefixDir = options.prefix ? `${sanitizeSegment(options.prefix)}/` : '';
  const storagePath = `${prefixDir}${pageDir}/${shortHash}_${baseName}.${ext}`;

  return {
    storagePath,
    contentHash,
    mimeType: mimeType as 'image/webp' | 'image/jpeg' | 'image/png',
  };
}

/**
 * Verifies with a real HTTP request that the uploaded file is genuinely reachable
 * in the public `fmot-media` bucket before marking the upload as confirmed.
 */
export async function verifySupabasePublicImageUrl(publicUrl: string): Promise<void> {
  const probeUrl = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}v=${Date.now()}`;
  const headRes = await fetch(probeUrl, { method: 'HEAD', cache: 'no-store' });
  if (headRes.ok) {
    const contentType = (headRes.headers.get('content-type') || '').toLowerCase();
    if (!contentType || contentType.startsWith('image/')) {
      return;
    }
  }

  // Fallback range GET in case a proxy rejects HEAD
  const rangeRes = await fetch(probeUrl, {
    method: 'GET',
    headers: { Range: 'bytes=0-15' },
    cache: 'no-store',
  });
  if (!rangeRes.ok && rangeRes.status !== 206) {
    throw new Error(
      `Falha ao confirmar a disponibilidade da imagem no bucket fmot-media (HTTP ${rangeRes.status}).`
    );
  }
  const ct = (rangeRes.headers.get('content-type') || '').toLowerCase();
  if (ct && !ct.startsWith('image/') && !ct.includes('octet-stream')) {
    throw new Error(`O arquivo confirmado no bucket fmot-media possui tipo inválido (${ct}).`);
  }
}

/**
 * Uploads an image Blob/File directly to the Supabase Storage bucket `fmot-media`
 * using a SHA-256 deduplicated path and verifies real public availability before returning.
 */
export async function uploadImageToSupabaseStorage(
  fileOrBlob: Blob,
  options: {
    page: ManagedPageKey;
    fileName: string;
    mimeType?: string;
    bucket?: string;
    prefix?: string;
  }
): Promise<SupabaseUploadedMedia> {
  const { storagePath, contentHash, mimeType } = await buildDeduplicatedStoragePath(fileOrBlob, options);
  const supabase = requireSupabaseBrowserClient();
  const bucket = options.bucket || SUPABASE_MEDIA_BUCKET;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileOrBlob, {
      contentType: mimeType,
      cacheControl: '31536000',
      upsert: true,
    });

  if (uploadError) {
    throw new Error(`Falha ao enviar imagem ao Supabase Storage (${bucket}): ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  // Confirm the object is genuinely present and readable in `fmot-media`
  await verifySupabasePublicImageUrl(data.publicUrl);

  return {
    storagePath,
    publicUrl: data.publicUrl,
    sizeBytes: fileOrBlob.size,
    mimeType,
    contentHash,
  };
}

/**
 * Removes an uploaded image from Supabase Storage by its relative storage path.
 */
export async function deleteImageFromSupabaseStorage(
  storagePath: string,
  bucket: string = SUPABASE_MEDIA_BUCKET
): Promise<void> {
  const cleanPath = storagePath.replace(/^\/+/, '');
  if (!cleanPath || cleanPath.includes('..')) {
    throw new Error('Caminho de arquivo inválido para remoção no Storage.');
  }
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.storage.from(bucket).remove([cleanPath]);
  if (error) {
    throw new Error(`Falha ao remover imagem do Supabase Storage: ${error.message}`);
  }
}

/**
 * Resolves the public URL of an object stored in Supabase Storage.
 */
export function getSupabaseStoragePublicUrl(
  storagePath: string,
  bucket: string = SUPABASE_MEDIA_BUCKET
): string {
  const cleanPath = storagePath.replace(/^\/+/, '');
  if (!cleanPath || cleanPath.includes('..')) return '';
  const supabase = requireSupabaseBrowserClient();
  return supabase.storage.from(bucket).getPublicUrl(cleanPath).data.publicUrl;
}
