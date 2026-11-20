import {
  GalleryItem,
  HierarchyMember,
  HierarchyMemberStatus,
  HierarchyNode,
  HierarchyRankId,
  MediaAsset,
  OperationRecord,
  PortalConfig,
  PortalSlot,
  RoleSpecialty,
} from '../../types/portal';
import { getSupabaseBrowserClient, requireSupabaseBrowserClient } from './client';
import type {
  GalleryItemRow,
  HierarchyMemberRow,
  HierarchyNodeRow,
  MediaAssetRow,
  OperationRecordRow,
  PortalConfigRow,
  PortalSlotRow,
  RoleSpecialtyRow,
} from './types';

function isTableMissingError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === 'PGRST205' ||
    err.code === '42P01' ||
    (err.message || '').includes('Could not find the table')
  );
}

function isTablePermissionDeniedError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  return (
    err.code === '42501' ||
    (err.message || '').toLowerCase().includes('permission denied')
  );
}

export function mapMediaAssetRow(row: MediaAssetRow): MediaAsset {
  return {
    id: row.id,
    fileName: row.file_name,
    mimeType: row.mime_type,
    dataUrl: row.public_url,
    storagePath: row.storage_path,
    publicUrl: row.public_url,
    source: 'supabase',
    width: row.width,
    height: row.height,
    sizeBytes: row.size_bytes,
    page: row.page,
    title: row.title,
    description: row.description || '',
    uploadedBy: row.uploaded_by || '',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPortalConfigRow(row: PortalConfigRow): PortalConfig {
  return {
    heroHeadline: row.hero_headline,
    heroSubtext: row.hero_subtext,
    aboutIntro: row.about_intro,
    aboutOperationsText: row.about_operations_text,
    aboutDifferentiator: row.about_differentiator,
    aboutIdentityText: row.about_identity_text,
    aboutValues: Array.isArray(row.about_values) ? row.about_values : [],
    updatedBy: row.updated_by || undefined,
    updatedAt: row.updated_at,
  };
}

function mapPortalSlotRow(row: PortalSlotRow): PortalSlot {
  return {
    id: row.id,
    page: row.page,
    label: row.label,
    title: row.title,
    description: row.description || '',
    placeholderLabel: row.placeholder_label || undefined,
    imageUrl: row.image_url || '',
    mediaAssetId: row.media_asset_id || '',
    isCover: Boolean(row.is_cover),
    updatedBy: row.updated_by || undefined,
    updatedAt: row.updated_at,
  };
}

function mapHierarchyNodeRow(row: HierarchyNodeRow): HierarchyNode {
  return {
    id: row.id,
    rankTitle: row.rank_title,
    memberName: row.member_name || '',
    positionCode: row.position_code,
    tier: Math.min(6, Math.max(1, Number(row.tier) || 1)) as 1 | 2 | 3 | 4 | 5 | 6,
    parentId: row.parent_id || '',
    responsibility: row.responsibility,
    insigniaUrl: row.insignia_url || '',
    photoUrl: row.photo_url || '',
    order: row.sort_order,
    isDemo: Boolean(row.is_demo),
    updatedBy: row.updated_by || undefined,
    updatedAt: row.updated_at,
  };
}

function mapHierarchyMemberRow(row: HierarchyMemberRow): HierarchyMember {
  return {
    id: row.id,
    rankId: row.rank_id,
    name: row.name,
    photoUrl: row.photo_url || '',
    description: row.description || '',
    status: (row.status || 'Ativo') as HierarchyMemberStatus,
    order: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy: row.updated_by || undefined,
  };
}

function mapRoleRow(row: RoleSpecialtyRow): RoleSpecialty {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    iconName: row.icon_name || 'Shield',
    imageUrl: row.image_url || '',
    description: row.description,
    responsibilities: Array.isArray(row.responsibilities) ? row.responsibilities : [],
    requirements: Array.isArray(row.requirements) ? row.requirements : [],
    order: row.sort_order,
    isDemo: Boolean(row.is_demo),
    updatedBy: row.updated_by || undefined,
    updatedAt: row.updated_at,
  };
}

function mapOperationRow(row: OperationRecordRow): OperationRecord {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    date: row.date || '',
    summary: row.summary,
    details: row.details,
    results: row.results || '',
    coverImageUrl: row.cover_image_url || '',
    galleryUrls: Array.isArray(row.gallery_urls) ? row.gallery_urls : [],
    featured: Boolean(row.featured),
    isDemo: Boolean(row.is_demo),
    order: row.sort_order,
    updatedBy: row.updated_by || undefined,
    updatedAt: row.updated_at,
  };
}

function mapGalleryRow(row: GalleryItemRow): GalleryItem {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    category: row.category,
    date: row.date || '',
    imageUrl: row.image_url || '',
    isCover: Boolean(row.is_cover),
    order: row.sort_order,
    isDemo: Boolean(row.is_demo),
    updatedBy: row.updated_by || undefined,
    updatedAt: row.updated_at,
  };
}

export interface SupabasePortalSnapshot {
  schemaReady: boolean;
  permissionDenied: boolean;
  config: PortalConfig | null;
  slots: Record<string, PortalSlot>;
  hierarchyNodes: Record<string, HierarchyNode>;
  hierarchyMembers: HierarchyMember[];
  roles: RoleSpecialty[] | null;
  operations: OperationRecord[] | null;
  gallery: GalleryItem[] | null;
  mediaAssets: MediaAsset[];
}

/**
 * Fetches all institutional data and media_assets metadata (lightweight URLs, not base64)
 * in a single parallel batch from Supabase. Returns schemaReady: false safely if tables
 * have not yet been created in Supabase.
 */
export async function fetchSupabasePortalSnapshot(): Promise<SupabasePortalSnapshot | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;

  const [
    configRes,
    slotsRes,
    nodesRes,
    membersRes,
    rolesRes,
    opsRes,
    galleryRes,
    mediaRes,
  ] = await Promise.all([
    supabase.from('portal_config').select('*').eq('id', 'main').maybeSingle(),
    supabase.from('portal_slots').select('*'),
    supabase.from('hierarchy_nodes').select('*').order('sort_order', { ascending: true }),
    supabase.from('hierarchy_members').select('*').order('sort_order', { ascending: true }),
    supabase.from('roles_catalog').select('*').order('sort_order', { ascending: true }),
    supabase.from('operations_records').select('*').order('sort_order', { ascending: true }),
    supabase.from('gallery_items').select('*').order('sort_order', { ascending: true }),
    supabase.from('media_assets').select('*').order('created_at', { ascending: false }),
  ]);

  const allErrors = [
    configRes.error,
    slotsRes.error,
    nodesRes.error,
    membersRes.error,
    rolesRes.error,
    opsRes.error,
    galleryRes.error,
    mediaRes.error,
  ];

  const anyMissing = allErrors.some((err) => isTableMissingError(err));
  const anyPermissionDenied = allErrors.some((err) => isTablePermissionDeniedError(err));

  if (anyMissing || anyPermissionDenied) {
    return {
      schemaReady: false,
      permissionDenied: anyPermissionDenied,
      config: null,
      slots: {},
      hierarchyNodes: {},
      hierarchyMembers: [],
      roles: null,
      operations: null,
      gallery: null,
      mediaAssets: [],
    };
  }

  const slotsMap: Record<string, PortalSlot> = {};
  (slotsRes.data || []).forEach((row) => {
    const mapped = mapPortalSlotRow(row);
    slotsMap[mapped.id] = mapped;
  });

  const nodesMap: Record<string, HierarchyNode> = {};
  (nodesRes.data || []).forEach((row) => {
    const mapped = mapHierarchyNodeRow(row);
    nodesMap[mapped.id] = mapped;
  });

  const members = (membersRes.data || []).map(mapHierarchyMemberRow);
  const roles = rolesRes.data && rolesRes.data.length > 0 ? rolesRes.data.map(mapRoleRow) : null;
  const operations =
    opsRes.data && opsRes.data.length > 0 ? opsRes.data.map(mapOperationRow) : null;
  const gallery =
    galleryRes.data && galleryRes.data.length > 0 ? galleryRes.data.map(mapGalleryRow) : null;
  const mediaAssets = (mediaRes.data || []).map(mapMediaAssetRow);

  return {
    schemaReady: true,
    permissionDenied: false,
    config: configRes.data ? mapPortalConfigRow(configRes.data) : null,
    slots: slotsMap,
    hierarchyNodes: nodesMap,
    hierarchyMembers: members,
    roles,
    operations,
    gallery,
    mediaAssets,
  };
}

export async function fetchSupabaseMediaAssets(): Promise<MediaAsset[]> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('media_assets')
    .select('*')
    .order('created_at', { ascending: false });
  if (error || !data) return [];
  return data.map(mapMediaAssetRow);
}

async function getCurrentSupabaseUserId(): Promise<string | null> {
  const supabase = getSupabaseBrowserClient();
  if (!supabase) return null;
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function upsertSupabaseMediaAsset(asset: {
  id: string;
  fileName: string;
  mimeType: 'image/webp' | 'image/jpeg' | 'image/png';
  storagePath: string;
  publicUrl: string;
  width: number;
  height: number;
  sizeBytes: number;
  page: MediaAsset['page'];
  title: string;
  description?: string;
}): Promise<MediaAsset> {
  const supabase = requireSupabaseBrowserClient();
  const userId = await getCurrentSupabaseUserId();
  const { data, error } = await supabase
    .from('media_assets')
    .upsert(
      {
        id: asset.id,
        file_name: asset.fileName.slice(0, 180),
        mime_type: asset.mimeType,
        storage_path: asset.storagePath,
        public_url: asset.publicUrl,
        width: asset.width,
        height: asset.height,
        size_bytes: asset.sizeBytes,
        page: asset.page,
        title: asset.title.slice(0, 140),
        description: (asset.description || '').slice(0, 500),
        uploaded_by: userId,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message || 'Falha ao salvar metadados da imagem no Supabase.');
  }
  return mapMediaAssetRow(data);
}

export async function deleteSupabaseMediaAssetRow(assetId: string): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.from('media_assets').delete().eq('id', assetId);
  if (error) {
    throw new Error(`Falha ao remover registro de mídia no Supabase: ${error.message}`);
  }
}

export async function upsertSupabasePortalConfig(config: PortalConfig): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const userId = await getCurrentSupabaseUserId();
  const { error } = await supabase.from('portal_config').upsert(
    {
      id: 'main',
      hero_headline: config.heroHeadline.trim().slice(0, 240),
      hero_subtext: config.heroSubtext.trim().slice(0, 1200),
      about_intro: config.aboutIntro.trim().slice(0, 3000),
      about_operations_text: config.aboutOperationsText.trim().slice(0, 2000),
      about_differentiator: config.aboutDifferentiator.trim().slice(0, 600),
      about_identity_text: config.aboutIdentityText.trim().slice(0, 2000),
      about_values: config.aboutValues.slice(0, 8),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export async function upsertSupabasePortalSlot(slot: PortalSlot): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const userId = await getCurrentSupabaseUserId();
  const { error } = await supabase.from('portal_slots').upsert(
    {
      id: slot.id,
      page: slot.page,
      label: slot.label.trim().slice(0, 120),
      title: slot.title.trim().slice(0, 160),
      description: (slot.description || '').trim().slice(0, 600),
      placeholder_label: slot.placeholderLabel || null,
      image_url: slot.imageUrl.trim().slice(0, 2000),
      media_asset_id: (slot.mediaAssetId || '').slice(0, 128),
      is_cover: Boolean(slot.isCover),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export async function deleteSupabasePortalSlot(slotId: string): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.from('portal_slots').delete().eq('id', slotId);
  if (error) throw new Error(error.message);
}

export async function upsertSupabaseHierarchyNode(node: HierarchyNode): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const userId = await getCurrentSupabaseUserId();
  const { error } = await supabase.from('hierarchy_nodes').upsert(
    {
      id: node.id,
      rank_title: node.rankTitle.trim().slice(0, 120),
      member_name: (node.memberName || '').trim().slice(0, 120),
      position_code: node.positionCode.trim().slice(0, 60),
      tier: Math.min(6, Math.max(1, Number(node.tier) || 1)),
      parent_id: node.parentId || null,
      responsibility: node.responsibility.trim().slice(0, 1000),
      insignia_url: (node.insigniaUrl || '').slice(0, 2000),
      photo_url: (node.photoUrl || '').slice(0, 2000),
      sort_order: Math.max(0, Math.min(1000, Number(node.order) || 1)),
      is_demo: Boolean(node.isDemo),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseHierarchyNode(nodeId: HierarchyRankId): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.from('hierarchy_nodes').delete().eq('id', nodeId);
  if (error) throw new Error(error.message);
}

export async function upsertSupabaseHierarchyMember(member: {
  id: string;
  rankId: HierarchyRankId;
  name: string;
  photoUrl: string;
  description: string;
  status: HierarchyMemberStatus;
  order: number;
}): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const userId = await getCurrentSupabaseUserId();
  const { error } = await supabase.from('hierarchy_members').upsert(
    {
      id: member.id,
      rank_id: member.rankId,
      name: member.name.trim().slice(0, 120),
      photo_url: (member.photoUrl || '').trim().slice(0, 2000),
      description: (member.description || '').trim().slice(0, 800),
      status: member.status || 'Ativo',
      sort_order: Math.max(0, Math.min(100000, Number(member.order) || 0)),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseHierarchyMember(memberId: string): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.from('hierarchy_members').delete().eq('id', memberId);
  if (error) throw new Error(error.message);
}

export async function upsertSupabaseRole(role: RoleSpecialty): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const userId = await getCurrentSupabaseUserId();
  const { error } = await supabase.from('roles_catalog').upsert(
    {
      id: role.id,
      name: role.name.trim().slice(0, 120),
      category: role.category.trim().slice(0, 80),
      icon_name: (role.iconName || 'Shield').slice(0, 60),
      image_url: (role.imageUrl || '').slice(0, 2000),
      description: role.description.trim().slice(0, 1000),
      responsibilities: role.responsibilities.map((r) => r.trim().slice(0, 300)).filter(Boolean).slice(0, 8),
      requirements: role.requirements.map((r) => r.trim().slice(0, 300)).filter(Boolean).slice(0, 8),
      sort_order: Math.max(0, Math.min(1000, Number(role.order) || 0)),
      is_demo: Boolean(role.isDemo),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseRole(roleId: string): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.from('roles_catalog').delete().eq('id', roleId);
  if (error) throw new Error(error.message);
}

export async function upsertSupabaseOperation(op: OperationRecord): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const userId = await getCurrentSupabaseUserId();
  const { error } = await supabase.from('operations_records').upsert(
    {
      id: op.id,
      title: op.title.trim().slice(0, 160),
      category: op.category.trim().slice(0, 80),
      date: (op.date || '').trim().slice(0, 40),
      summary: op.summary.trim().slice(0, 600),
      details: op.details.trim().slice(0, 4000),
      results: (op.results || '').trim().slice(0, 1200),
      cover_image_url: (op.coverImageUrl || '').trim().slice(0, 2000),
      gallery_urls: (op.galleryUrls || []).map((u) => u.trim().slice(0, 2000)).filter(Boolean).slice(0, 6),
      featured: Boolean(op.featured),
      is_demo: Boolean(op.isDemo),
      sort_order: Math.max(0, Math.min(1000, Number(op.order) || 0)),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseOperation(opId: string): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.from('operations_records').delete().eq('id', opId);
  if (error) throw new Error(error.message);
}

export async function upsertSupabaseGalleryItem(item: GalleryItem): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const userId = await getCurrentSupabaseUserId();
  const { error } = await supabase.from('gallery_items').upsert(
    {
      id: item.id,
      title: item.title.trim().slice(0, 140),
      description: (item.description || '').trim().slice(0, 500),
      category: item.category.trim().slice(0, 80),
      date: (item.date || '').trim().slice(0, 40),
      image_url: (item.imageUrl || '').trim().slice(0, 2000),
      is_cover: Boolean(item.isCover),
      sort_order: Math.max(0, Math.min(1000, Number(item.order) || 0)),
      is_demo: Boolean(item.isDemo),
      updated_by: userId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

export async function deleteSupabaseGalleryItem(itemId: string): Promise<void> {
  const supabase = requireSupabaseBrowserClient();
  const { error } = await supabase.from('gallery_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
}
