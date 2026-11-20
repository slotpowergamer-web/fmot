import type { ManagedPageKey } from '../../types/portal';
import { requireSupabaseBrowserClient } from './client';
import { SUPABASE_MEDIA_BUCKET } from './types';

const ALLOWED_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_UPLOAD_SIZE_BYTES = 15 * 1024 * 1024; // 15 MB

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
}

/**
 * Uploads an image Blob/File to the Supabase Storage bucket `fmot-media`
 * under a sanitized path `<page>/<timestamp>_<rand>_<name>.<ext>`.
 */
export async function uploadImageToSupabaseStorage(
  fileOrBlob: Blob,
  options: {
    page: ManagedPageKey;
    fileName: string;
    mimeType?: string;
    bucket?: string;
  }
): Promise<SupabaseUploadedMedia> {
  const mimeType = (options.mimeType || fileOrBlob.type || '').toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error('Formato de imagem não suportado. Utilize JPG, PNG ou WebP.');
  }
  if (fileOrBlob.size <= 0 || fileOrBlob.size > MAX_UPLOAD_SIZE_BYTES) {
    throw new Error('O tamanho da imagem deve ser de até 15 MB.');
  }

  const supabase = requireSupabaseBrowserClient();
  const bucket = options.bucket || SUPABASE_MEDIA_BUCKET;
  const pageDir = sanitizeSegment(options.page) || 'geral';
  const baseName = sanitizeSegment(options.fileName.replace(/\.[^.]+$/, '')) || 'imagem';
  const ext = extensionForMime(mimeType);
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `${pageDir}/${uniqueSuffix}_${baseName}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(storagePath, fileOrBlob, {
      contentType: mimeType,
      cacheControl: '31536000',
      upsert: false,
    });

  if (uploadError) {
    throw new Error(`Falha ao enviar imagem ao Supabase Storage: ${uploadError.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);

  return {
    storagePath,
    publicUrl: data.publicUrl,
    sizeBytes: fileOrBlob.size,
    mimeType: mimeType as 'image/webp' | 'image/jpeg' | 'image/png',
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
