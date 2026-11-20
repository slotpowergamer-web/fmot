import {
  collection,
  doc,
  getDoc,
  getDocFromCache,
  getDocs,
  getDocsFromCache,
} from 'firebase/firestore';
import { db as firebaseDb, isQuotaExceededError } from '../../firebase';
import {
  GalleryItem,
  HierarchyMember,
  HierarchyNode,
  HierarchyRankId,
  ManagedPageKey,
  MediaAsset,
  OperationRecord,
  PortalConfig,
  PortalSlot,
  RoleSpecialty,
} from '../../types/portal';
import { dataUrlToBlob } from '../../utils/imageOptimizer';
import { getCachedMediaAssets, getCachedSnapshot } from '../../utils/localMediaCache';
import { getSupabaseBrowserClient, requireSupabaseBrowserClient } from './client';
import {
  upsertSupabaseGalleryItem,
  upsertSupabaseHierarchyMember,
  upsertSupabaseHierarchyNode,
  upsertSupabaseMediaAsset,
  upsertSupabaseOperation,
  upsertSupabasePortalConfig,
  upsertSupabasePortalSlot,
  upsertSupabaseRole,
} from './repository';
import { SUPABASE_MEDIA_BUCKET } from './types';

export type DiscoverySourceKind = 'firestore_server' | 'firestore_cache' | 'local_cache';

export interface DiscoveredMediaAsset {
  asset: MediaAsset;
  source: DiscoverySourceKind;
  alreadyInSupabase: boolean;
  existingPublicUrl?: string;
}

export interface DiscoveredMetadataBundle {
  config: PortalConfig | null;
  slots: PortalSlot[];
  hierarchyNodes: HierarchyNode[];
  hierarchyMembers: HierarchyMember[];
  roles: RoleSpecialty[];
  operations: OperationRecord[];
  gallery: GalleryItem[];
  source: DiscoverySourceKind | 'none';
}

export interface MigrationInventory {
  checkedAt: string;
  firestoreServerStatus: 'online' | 'quota_exceeded' | 'error';
  firestoreErrorMessage: string | null;
  supabaseReachable: boolean;
  supabaseExistingMediaCount: number;
  totalDiscoveredImages: number;
  alreadyMigratedCount: number;
  pendingImagesCount: number;
  bySource: Record<DiscoverySourceKind, number>;
  byPage: Record<string, number>;
  metadataCounts: {
    config: number;
    slots: number;
    hierarchyNodes: number;
    hierarchyMembers: number;
    roles: number;
    operations: number;
    gallery: number;
    totalRecords: number;
  };
  metadataSource: DiscoverySourceKind | 'none';
  canTransferNow: boolean;
  discoveredAssets: DiscoveredMediaAsset[];
  discoveredMetadata: DiscoveredMetadataBundle;
}

export interface MigrationProgress {
  phase: 'inspecting' | 'uploading' | 'verifying' | 'syncing_metadata' | 'paused' | 'completed';
  currentBatch: number;
  totalBatches: number;
  processedImages: number;
  totalPendingImages: number;
  migratedImages: number;
  alreadyMigratedImages: number;
  failedImages: number;
  syncedMetadataRecords: number;
  currentItemTitle: string;
  statusText: string;
}

export interface MigrationCheckpoint {
  updatedAt: string;
  confirmedIds: string[];
  failedIds: string[];
  lastBatchCompleted: number;
  totalPendingAtStart: number;
}

export interface MigrationReport {
  totalSourceImages: number;
  migratedImages: number;
  verifiedUploads: number;
  alreadyMigratedImages: number;
  failedImages: number;
  remainingPendingImages: number;
  syncedMetadataRecords: number;
  firebaseReadable: boolean;
  firestoreServerStatus: 'online' | 'quota_exceeded' | 'error';
  firestoreErrorMessage: string | null;
  pausedByUser: boolean;
  errors: string[];
  migratedAssets: MediaAsset[];
}

export interface RunMigrationOptions {
  batchSize?: number;
  signal?: AbortSignal;
  inventory?: MigrationInventory;
  onProgress?: (progress: MigrationProgress) => void;
}

const CHECKPOINT_STORAGE_KEY = 'fmot_supabase_migration_checkpoint_v1';

export function readMigrationCheckpoint(): MigrationCheckpoint | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CHECKPOINT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MigrationCheckpoint;
    if (!parsed || !Array.isArray(parsed.confirmedIds)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveMigrationCheckpoint(checkpoint: MigrationCheckpoint): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(checkpoint));
  } catch {
    // Ignore storage quota issues
  }
}

export function clearMigrationCheckpoint(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CHECKPOINT_STORAGE_KEY);
  } catch {
    // Ignore storage errors
  }
}

function extensionForMime(mimeType: string): string {
  switch (mimeType.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    default:
      return 'webp';
  }
}

function normalizeMimeType(raw?: string): 'image/webp' | 'image/jpeg' | 'image/png' {
  const clean = (raw || '').toLowerCase();
  if (clean === 'image/png') return 'image/png';
  if (clean === 'image/jpeg' || clean === 'image/jpg') return 'image/jpeg';
  return 'image/webp';
}

function normalizePageKey(raw?: string): ManagedPageKey {
  const valid: ManagedPageKey[] = [
    'identidade',
    'inicio',
    'quem_somos',
    'hierarquia',
    'funcoes',
    'operacoes',
    'galeria',
  ];
  return valid.includes(raw as ManagedPageKey) ? (raw as ManagedPageKey) : 'galeria';
}

function sanitizePathPart(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 64);
}

/**
 * Deterministic storage path per asset ID so retries/resumes NEVER create duplicate files
 * in the `fmot-media` bucket while preserving the original category (page) and filename.
 */
function buildDeterministicStoragePath(asset: MediaAsset, mimeType: string): string {
  const pageDir = sanitizePathPart(asset.page || 'geral') || 'geral';
  const cleanId = sanitizePathPart(asset.id) || `img_${Date.now()}`;
  const rawBase = (asset.fileName || '').replace(/\.[^.]+$/, '');
  const cleanBase = sanitizePathPart(rawBase);
  const ext = extensionForMime(mimeType);
  const filePart = cleanBase && cleanBase !== cleanId ? `${cleanId}_${cleanBase.slice(0, 40)}` : cleanId;
  return `migrated/${pageDir}/${filePart}.${ext}`;
}

/**
 * Confirms an uploaded image is actually reachable in the public `fmot-media` bucket
 * before recording it as migrated in PostgreSQL `media_assets`.
 */
async function verifyUploadedPublicImage(publicUrl: string): Promise<void> {
  const cacheBustUrl = `${publicUrl}${publicUrl.includes('?') ? '&' : '?'}verify=${Date.now()}`;
  const headRes = await fetch(cacheBustUrl, { method: 'HEAD', cache: 'no-store' });
  if (headRes.ok) {
    const contentType = (headRes.headers.get('content-type') || '').toLowerCase();
    if (!contentType || contentType.startsWith('image/')) {
      return;
    }
  }

  // Fallback range GET in case a proxy/CDN rejects HEAD
  const getRes = await fetch(cacheBustUrl, {
    method: 'GET',
    headers: { Range: 'bytes=0-15' },
    cache: 'no-store',
  });
  if (!getRes.ok && getRes.status !== 206) {
    throw new Error(`Falha na confirmação de leitura no bucket fmot-media (HTTP ${getRes.status}).`);
  }
  const ct = (getRes.headers.get('content-type') || '').toLowerCase();
  if (ct && !ct.startsWith('image/') && !ct.includes('octet-stream')) {
    throw new Error(`Objeto verificado no Storage retornou tipo inválido (${ct}).`);
  }
}

async function readMetadataFromSource(
  mode: 'server' | 'firestore_cache'
): Promise<DiscoveredMetadataBundle> {
  const fetchCollection = async <T>(name: string): Promise<Array<T & { id: string }>> => {
    const ref = collection(firebaseDb, name);
    const snap = mode === 'server' ? await getDocs(ref) : await getDocsFromCache(ref);
    return snap.docs.map((d) => ({ ...(d.data() as T), id: d.id }));
  };

  let config: PortalConfig | null = null;
  try {
    const cfgRef = doc(firebaseDb, 'portal_config', 'main');
    const cfgSnap = mode === 'server' ? await getDoc(cfgRef) : await getDocFromCache(cfgRef);
    if (cfgSnap.exists()) {
      config = cfgSnap.data() as PortalConfig;
    }
  } catch {
    config = null;
  }

  const [slots, hierarchyNodes, hierarchyMembers, roles, operations, gallery] = await Promise.all([
    fetchCollection<PortalSlot>('portal_slots').catch(() => []),
    fetchCollection<HierarchyNode>('hierarchy_nodes').catch(() => []),
    fetchCollection<HierarchyMember>('hierarchy_members').catch(() => []),
    fetchCollection<RoleSpecialty>('roles_catalog').catch(() => []),
    fetchCollection<OperationRecord>('operations_records').catch(() => []),
    fetchCollection<GalleryItem>('gallery_items').catch(() => []),
  ]);

  const total =
    (config ? 1 : 0) +
    slots.length +
    hierarchyNodes.length +
    hierarchyMembers.length +
    roles.length +
    operations.length +
    gallery.length;

  return {
    config,
    slots,
    hierarchyNodes,
    hierarchyMembers,
    roles,
    operations,
    gallery,
    source: total > 0 ? (mode === 'server' ? 'firestore_server' : 'firestore_cache') : 'none',
  };
}

async function readMetadataFromLocalSnapshots(): Promise<DiscoveredMetadataBundle> {
  const [config, slotsObj, nodesObj, members, roles, operations, gallery] = await Promise.all([
    getCachedSnapshot<PortalConfig>('portal_config'),
    getCachedSnapshot<Record<string, PortalSlot>>('portal_slots'),
    getCachedSnapshot<Record<string, HierarchyNode>>('hierarchy_nodes'),
    getCachedSnapshot<HierarchyMember[]>('hierarchy_members'),
    getCachedSnapshot<RoleSpecialty[]>('roles_catalog'),
    getCachedSnapshot<OperationRecord[]>('operations_records'),
    getCachedSnapshot<GalleryItem[]>('gallery_items'),
  ]);

  const slots = slotsObj ? Object.values(slotsObj) : [];
  const hierarchyNodes = nodesObj ? Object.values(nodesObj) : [];
  const hierarchyMembers = Array.isArray(members) ? members : [];
  const rolesList = Array.isArray(roles) ? roles : [];
  const opsList = Array.isArray(operations) ? operations : [];
  const galleryList = Array.isArray(gallery) ? gallery : [];

  const total =
    (config ? 1 : 0) +
    slots.length +
    hierarchyNodes.length +
    hierarchyMembers.length +
    rolesList.length +
    opsList.length +
    galleryList.length;

  return {
    config: config ?? null,
    slots,
    hierarchyNodes,
    hierarchyMembers,
    roles: rolesList,
    operations: opsList,
    gallery: galleryList,
    source: total > 0 ? 'local_cache' : 'none',
  };
}

/**
 * 100% READ-ONLY pre-flight inspection.
 * Discovers how many original Firebase images and page references are accessible right now
 * (via Firestore Server, Firestore SDK persistent cache, and browser IndexedDB cache)
 * and compares them against Supabase `media_assets` without modifying or migrating anything.
 */
export async function inspectFirebaseMigrationSources(): Promise<MigrationInventory> {
  const supabase = getSupabaseBrowserClient();
  let supabaseReachable = false;
  const existingUrlById = new Map<string, string>();

  if (supabase) {
    try {
      const { data: existingRows, error } = await supabase
        .from('media_assets')
        .select('id, public_url');
      if (!error && Array.isArray(existingRows)) {
        supabaseReachable = true;
        existingRows.forEach((row) => {
          if (row.id && row.public_url) {
            existingUrlById.set(row.id, row.public_url);
          }
        });
      }
    } catch {
      supabaseReachable = false;
    }
  }

  const discoveredMap = new Map<string, { asset: MediaAsset; source: DiscoverySourceKind }>();

  // Source 1: Browser IndexedDB recovery cache (zero Firestore reads)
  const localAssets = await getCachedMediaAssets();
  localAssets.forEach((asset) => {
    if (asset.id && asset.dataUrl && asset.dataUrl.startsWith('data:image/')) {
      discoveredMap.set(asset.id, { asset, source: 'local_cache' });
    }
  });

  // Source 2: Firestore SDK persistentLocalCache (zero Firestore server reads)
  try {
    const cacheSnap = await getDocsFromCache(collection(firebaseDb, 'media_assets'));
    cacheSnap.docs.forEach((d) => {
      const data = d.data() as MediaAsset;
      if (data?.dataUrl && data.dataUrl.startsWith('data:image/')) {
        discoveredMap.set(d.id, { asset: { ...data, id: d.id }, source: 'firestore_cache' });
      }
    });
  } catch {
    // Cache may be empty on a fresh browser
  }

  // Source 3: Live Firestore Server (explicitly surfaces quota errors without hiding them)
  let firestoreServerStatus: 'online' | 'quota_exceeded' | 'error' = 'online';
  let firestoreErrorMessage: string | null = null;
  try {
    const serverSnap = await getDocs(collection(firebaseDb, 'media_assets'));
    serverSnap.docs.forEach((d) => {
      const data = d.data() as MediaAsset;
      if (data?.dataUrl && data.dataUrl.startsWith('data:image/')) {
        discoveredMap.set(d.id, { asset: { ...data, id: d.id }, source: 'firestore_server' });
      }
    });
  } catch (err) {
    firestoreErrorMessage = err instanceof Error ? err.message : String(err);
    firestoreServerStatus = isQuotaExceededError(err) ? 'quota_exceeded' : 'error';
  }

  // Metadata bundle discovery (Server -> Firestore SDK Cache -> Local IndexedDB Snapshots)
  let discoveredMetadata: DiscoveredMetadataBundle = {
    config: null,
    slots: [],
    hierarchyNodes: [],
    hierarchyMembers: [],
    roles: [],
    operations: [],
    gallery: [],
    source: 'none',
  };

  if (firestoreServerStatus === 'online') {
    discoveredMetadata = await readMetadataFromSource('server');
  }
  if (discoveredMetadata.source === 'none') {
    discoveredMetadata = await readMetadataFromSource('firestore_cache');
  }
  if (discoveredMetadata.source === 'none') {
    discoveredMetadata = await readMetadataFromLocalSnapshots();
  }

  const bySource: Record<DiscoverySourceKind, number> = {
    firestore_server: 0,
    firestore_cache: 0,
    local_cache: 0,
  };
  const byPage: Record<string, number> = {};
  const discoveredAssets: DiscoveredMediaAsset[] = [];

  discoveredMap.forEach(({ asset, source }) => {
    const existingPublicUrl = existingUrlById.get(asset.id);
    const alreadyInSupabase = Boolean(existingPublicUrl);
    bySource[source] += 1;
    const pageKey = normalizePageKey(asset.page);
    byPage[pageKey] = (byPage[pageKey] || 0) + 1;
    discoveredAssets.push({
      asset: { ...asset, page: pageKey },
      source,
      alreadyInSupabase,
      existingPublicUrl,
    });
  });

  // Sort deterministically by page + id so batched resume order is stable
  discoveredAssets.sort((a, b) =>
    `${a.asset.page}_${a.asset.id}`.localeCompare(`${b.asset.page}_${b.asset.id}`)
  );

  const alreadyMigratedCount = discoveredAssets.filter((item) => item.alreadyInSupabase).length;
  const pendingImagesCount = discoveredAssets.length - alreadyMigratedCount;

  const metadataCounts = {
    config: discoveredMetadata.config ? 1 : 0,
    slots: discoveredMetadata.slots.length,
    hierarchyNodes: discoveredMetadata.hierarchyNodes.length,
    hierarchyMembers: discoveredMetadata.hierarchyMembers.length,
    roles: discoveredMetadata.roles.length,
    operations: discoveredMetadata.operations.length,
    gallery: discoveredMetadata.gallery.length,
    totalRecords:
      (discoveredMetadata.config ? 1 : 0) +
      discoveredMetadata.slots.length +
      discoveredMetadata.hierarchyNodes.length +
      discoveredMetadata.hierarchyMembers.length +
      discoveredMetadata.roles.length +
      discoveredMetadata.operations.length +
      discoveredMetadata.gallery.length,
  };

  const canTransferNow =
    supabaseReachable && (pendingImagesCount > 0 || metadataCounts.totalRecords > 0);

  return {
    checkedAt: new Date().toISOString(),
    firestoreServerStatus,
    firestoreErrorMessage,
    supabaseReachable,
    supabaseExistingMediaCount: existingUrlById.size,
    totalDiscoveredImages: discoveredAssets.length,
    alreadyMigratedCount,
    pendingImagesCount,
    bySource,
    byPage,
    metadataCounts,
    metadataSource: discoveredMetadata.source,
    canTransferNow,
    discoveredAssets,
    discoveredMetadata,
  };
}

/**
 * Lossless, batched, resumable, upload-verified migration from Firebase Firestore
 * (and/or local caches when Firestore quota is exhausted) into Supabase Storage (`fmot-media`)
 * + Supabase PostgreSQL tables.
 * NEVER modifies or deletes any record in Firebase.
 * NEVER marks an image as migrated until both Storage upload AND public read verification succeed.
 */
export async function migrateFirebaseMediaToSupabase(
  options: RunMigrationOptions = {}
): Promise<MigrationReport> {
  const supabase = requireSupabaseBrowserClient();
  const batchSize = Math.max(1, Math.min(20, Number(options.batchSize) || 4));
  const { signal, onProgress } = options;

  onProgress?.({
    phase: 'inspecting',
    currentBatch: 0,
    totalBatches: 0,
    processedImages: 0,
    totalPendingImages: 0,
    migratedImages: 0,
    alreadyMigratedImages: 0,
    failedImages: 0,
    syncedMetadataRecords: 0,
    currentItemTitle: '',
    statusText: 'Inspecionando imagens originais no Firebase e comparando com o Supabase...',
  });

  const inventory = options.inventory ?? (await inspectFirebaseMigrationSources());
  if (!inventory.supabaseReachable) {
    throw new Error(
      'Não foi possível acessar a tabela media_assets no Supabase. Verifique a conexão e as permissões RLS.'
    );
  }

  // Build authoritative map of already-confirmed URLs in Supabase (prevents duplicates)
  const existingUrlById = new Map<string, string>();
  const { data: currentRows, error: currentRowsErr } = await supabase
    .from('media_assets')
    .select('id, public_url');
  if (currentRowsErr) {
    throw new Error(`Falha ao consultar media_assets no Supabase: ${currentRowsErr.message}`);
  }
  (currentRows || []).forEach((row) => {
    if (row.id && row.public_url) {
      existingUrlById.set(row.id, row.public_url);
    }
  });

  const pendingItems = inventory.discoveredAssets.filter(
    (entry) => !existingUrlById.has(entry.asset.id)
  );
  const alreadyMigratedImages = inventory.discoveredAssets.length - pendingItems.length;
  const totalBatches = Math.ceil(pendingItems.length / batchSize);

  const report: MigrationReport = {
    totalSourceImages: inventory.totalDiscoveredImages,
    migratedImages: 0,
    verifiedUploads: 0,
    alreadyMigratedImages,
    failedImages: 0,
    remainingPendingImages: pendingItems.length,
    syncedMetadataRecords: 0,
    firebaseReadable: inventory.firestoreServerStatus === 'online',
    firestoreServerStatus: inventory.firestoreServerStatus,
    firestoreErrorMessage: inventory.firestoreErrorMessage,
    pausedByUser: false,
    errors: [],
    migratedAssets: [],
  };

  if (inventory.firestoreErrorMessage) {
    report.errors.push(`Firestore servidor indisponível no momento: ${inventory.firestoreErrorMessage}`);
  }

  const confirmedIds = new Set<string>(Array.from(existingUrlById.keys()));
  const failedIds = new Set<string>();
  let processedImages = 0;

  // Batched upload + upload verification + Postgres metadata upsert
  for (let batchIndex = 0; batchIndex < totalBatches; batchIndex += 1) {
    if (signal?.aborted) {
      report.pausedByUser = true;
      break;
    }

    const batchNumber = batchIndex + 1;
    const slice = pendingItems.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize);

    for (const entry of slice) {
      if (signal?.aborted) {
        report.pausedByUser = true;
        break;
      }

      const { asset } = entry;
      const itemLabel = asset.title || asset.fileName || asset.id;

      // Double-check deduplication before upload
      if (existingUrlById.has(asset.id)) {
        report.alreadyMigratedImages += 1;
        processedImages += 1;
        continue;
      }

      onProgress?.({
        phase: 'uploading',
        currentBatch: batchNumber,
        totalBatches,
        processedImages,
        totalPendingImages: pendingItems.length,
        migratedImages: report.migratedImages,
        alreadyMigratedImages: report.alreadyMigratedImages,
        failedImages: report.failedImages,
        syncedMetadataRecords: report.syncedMetadataRecords,
        currentItemTitle: itemLabel,
        statusText: `Lote ${batchNumber}/${totalBatches} — Enviando "${itemLabel}" para o bucket fmot-media...`,
      });

      try {
        const mimeType = normalizeMimeType(asset.mimeType);
        const blob = dataUrlToBlob(asset.dataUrl, mimeType);
        if (blob.size <= 0) {
          throw new Error('Arquivo de imagem vazio ou corrompido na origem.');
        }

        const storagePath = buildDeterministicStoragePath(asset, mimeType);

        // 1. Upload original binary to `fmot-media`
        const { error: uploadErr } = await supabase.storage
          .from(SUPABASE_MEDIA_BUCKET)
          .upload(storagePath, blob, {
            contentType: mimeType,
            cacheControl: '31536000',
            upsert: true,
          });

        if (uploadErr) {
          throw new Error(`Upload rejeitado pelo Supabase Storage: ${uploadErr.message}`);
        }

        const { data: pub } = supabase.storage
          .from(SUPABASE_MEDIA_BUCKET)
          .getPublicUrl(storagePath);

        // 2. Confirm file actually exists and is readable in `fmot-media` before registering metadata
        onProgress?.({
          phase: 'verifying',
          currentBatch: batchNumber,
          totalBatches,
          processedImages,
          totalPendingImages: pendingItems.length,
          migratedImages: report.migratedImages,
          alreadyMigratedImages: report.alreadyMigratedImages,
          failedImages: report.failedImages,
          syncedMetadataRecords: report.syncedMetadataRecords,
          currentItemTitle: itemLabel,
          statusText: `Lote ${batchNumber}/${totalBatches} — Confirmando integridade de "${itemLabel}" no bucket fmot-media...`,
        });

        await verifyUploadedPublicImage(pub.publicUrl);
        report.verifiedUploads += 1;

        // 3. Register metadata in `public.media_assets` ONLY after verified upload
        const ext = extensionForMime(mimeType);
        const saved = await upsertSupabaseMediaAsset({
          id: asset.id,
          fileName: asset.fileName || `${sanitizePathPart(asset.id)}.${ext}`,
          mimeType,
          storagePath,
          publicUrl: pub.publicUrl,
          width: Number(asset.width) || 0,
          height: Number(asset.height) || 0,
          sizeBytes: blob.size,
          page: normalizePageKey(asset.page),
          title: asset.title || asset.fileName || asset.id,
          description: asset.description || '',
        });

        existingUrlById.set(asset.id, pub.publicUrl);
        confirmedIds.add(asset.id);
        failedIds.delete(asset.id);
        report.migratedAssets.push(saved);
        report.migratedImages += 1;
      } catch (err) {
        report.failedImages += 1;
        failedIds.add(asset.id);
        report.errors.push(
          `Falha na imagem "${itemLabel}" (${asset.id}): ${err instanceof Error ? err.message : String(err)}`
        );
      } finally {
        processedImages += 1;
      }
    }

    // Persist checkpoint at the end of every batch for safe resume
    saveMigrationCheckpoint({
      updatedAt: new Date().toISOString(),
      confirmedIds: Array.from(confirmedIds),
      failedIds: Array.from(failedIds),
      lastBatchCompleted: batchNumber,
      totalPendingAtStart: pendingItems.length,
    });
  }

  report.remainingPendingImages = Math.max(
    0,
    pendingItems.length - report.migratedImages
  );

  // Sync page/section metadata preserving all categories, names, and confirmed Supabase URLs
  // (Only rewrites `media://<id>` to Supabase public URL when `<id>` is CONFIRMED in `media_assets`)
  const rewriteConfirmedRef = (ref?: string): string => {
    if (!ref) return '';
    if (ref.startsWith('media://')) {
      const id = ref.slice('media://'.length);
      return existingUrlById.get(id) || ref;
    }
    return ref;
  };

  const meta = inventory.discoveredMetadata;
  if (!report.pausedByUser && meta.source !== 'none') {
    onProgress?.({
      phase: 'syncing_metadata',
      currentBatch: totalBatches,
      totalBatches,
      processedImages,
      totalPendingImages: pendingItems.length,
      migratedImages: report.migratedImages,
      alreadyMigratedImages: report.alreadyMigratedImages,
      failedImages: report.failedImages,
      syncedMetadataRecords: report.syncedMetadataRecords,
      currentItemTitle: 'Vínculos das páginas',
      statusText:
        'Sincronizando referências das páginas (Início, Quem Somos, Hierarquia, Funções, Operações e Galeria)...',
    });

    try {
      if (meta.config) {
        await upsertSupabasePortalConfig(meta.config);
        report.syncedMetadataRecords += 1;
      }

      for (const slot of meta.slots) {
        await upsertSupabasePortalSlot({
          ...slot,
          imageUrl: rewriteConfirmedRef(slot.imageUrl),
        });
        report.syncedMetadataRecords += 1;
      }

      for (const node of meta.hierarchyNodes) {
        await upsertSupabaseHierarchyNode({
          ...node,
          id: node.id as HierarchyRankId,
          photoUrl: rewriteConfirmedRef(node.photoUrl),
          insigniaUrl: rewriteConfirmedRef(node.insigniaUrl),
        });
        report.syncedMetadataRecords += 1;
      }

      for (const member of meta.hierarchyMembers) {
        await upsertSupabaseHierarchyMember({
          id: member.id,
          rankId: member.rankId,
          name: member.name,
          photoUrl: rewriteConfirmedRef(member.photoUrl),
          description: member.description || '',
          status: member.status || 'Ativo',
          order: typeof member.order === 'number' ? member.order : 0,
        });
        report.syncedMetadataRecords += 1;
      }

      for (const role of meta.roles) {
        await upsertSupabaseRole({
          ...role,
          imageUrl: rewriteConfirmedRef(role.imageUrl),
        });
        report.syncedMetadataRecords += 1;
      }

      for (const op of meta.operations) {
        await upsertSupabaseOperation({
          ...op,
          coverImageUrl: rewriteConfirmedRef(op.coverImageUrl),
          galleryUrls: (op.galleryUrls || []).map(rewriteConfirmedRef).filter(Boolean),
        });
        report.syncedMetadataRecords += 1;
      }

      for (const item of meta.gallery) {
        await upsertSupabaseGalleryItem({
          ...item,
          imageUrl: rewriteConfirmedRef(item.imageUrl),
        });
        report.syncedMetadataRecords += 1;
      }
    } catch (err) {
      report.errors.push(
        `Erro ao sincronizar registros das seções: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  if (report.remainingPendingImages === 0 && report.failedImages === 0 && !report.pausedByUser) {
    clearMigrationCheckpoint();
  }

  onProgress?.({
    phase: report.pausedByUser ? 'paused' : 'completed',
    currentBatch: totalBatches,
    totalBatches,
    processedImages,
    totalPendingImages: pendingItems.length,
    migratedImages: report.migratedImages,
    alreadyMigratedImages: report.alreadyMigratedImages,
    failedImages: report.failedImages,
    syncedMetadataRecords: report.syncedMetadataRecords,
    currentItemTitle: '',
    statusText: report.pausedByUser
      ? 'Transferência pausada com segurança. Você pode retomar de onde parou sem duplicar arquivos.'
      : 'Transferência concluída.',
  });

  return report;
}
