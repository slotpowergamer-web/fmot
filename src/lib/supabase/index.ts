export {
  getSupabaseBrowserClient,
  isSupabaseConfigured,
  requireSupabaseBrowserClient,
} from './client';
export {
  checkSupabaseHealth,
  verifySupabaseAdminSession,
  type SupabaseHealthStatus,
} from './health';
export {
  clearMigrationCheckpoint,
  inspectFirebaseMigrationSources,
  migrateFirebaseMediaToSupabase,
  readMigrationCheckpoint,
  type DiscoveredMediaAsset,
  type DiscoverySourceKind,
  type MigrationCheckpoint,
  type MigrationInventory,
  type MigrationProgress,
  type MigrationReport,
  type RunMigrationOptions,
} from './migration';
export {
  deleteSupabaseGalleryItem,
  deleteSupabaseHierarchyMember,
  deleteSupabaseHierarchyNode,
  deleteSupabaseMediaAssetRow,
  deleteSupabasePortalSlot,
  deleteSupabaseRole,
  deleteSupabaseOperation,
  fetchSupabaseMediaAssets,
  fetchSupabasePortalSnapshot,
  findSupabaseMediaAssetByStoragePath,
  mapMediaAssetRow,
  updateSupabaseReferencesUrl,
  upsertSupabaseGalleryItem,
  upsertSupabaseHierarchyMember,
  upsertSupabaseHierarchyNode,
  upsertSupabaseMediaAsset,
  upsertSupabaseOperation,
  upsertSupabasePortalConfig,
  upsertSupabasePortalSlot,
  upsertSupabaseRole,
  type SupabasePortalSnapshot,
} from './repository';
export {
  buildDeduplicatedStoragePath,
  deleteImageFromSupabaseStorage,
  getSupabaseStoragePublicUrl,
  uploadImageToSupabaseStorage,
  verifySupabasePublicImageUrl,
  type SupabaseUploadedMedia,
} from './storage';
export { SUPABASE_MEDIA_BUCKET, type Database } from './types';
