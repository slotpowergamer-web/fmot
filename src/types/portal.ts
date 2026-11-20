export type PortalTab =
  | 'inicio'
  | 'quem_somos'
  | 'hierarquia'
  | 'funcoes'
  | 'operacoes'
  | 'galeria'
  | 'admin';

export type ManagedPageKey =
  | 'identidade'
  | 'inicio'
  | 'quem_somos'
  | 'hierarquia'
  | 'funcoes'
  | 'operacoes'
  | 'galeria';

export interface InstitutionalValue {
  id: string;
  title: string;
  description: string;
}

export interface PortalConfig {
  heroHeadline: string;
  heroSubtext: string;
  aboutIntro: string;
  aboutOperationsText: string;
  aboutDifferentiator: string;
  aboutIdentityText: string;
  aboutValues: InstitutionalValue[];
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface MediaAsset {
  id: string;
  fileName: string;
  mimeType: 'image/webp' | 'image/jpeg' | 'image/png';
  dataUrl: string;
  storagePath?: string;
  publicUrl?: string;
  source?: 'supabase' | 'firebase';
  width: number;
  height: number;
  sizeBytes: number;
  page: ManagedPageKey;
  title: string;
  description?: string;
  uploadedBy: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface PortalSlot {
  id: string;
  page: ManagedPageKey;
  label: string;
  title: string;
  description?: string;
  placeholderLabel?: string;
  imageUrl: string;
  mediaAssetId?: string;
  isCover?: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

export type HierarchyRankId =
  | 'rank_coronel'
  | 'rank_capitao'
  | 'rank_sargento'
  | 'rank_cabo'
  | 'rank_soldado'
  | 'rank_recruta';

export type HierarchyMemberStatus = 'Ativo' | 'Em Capacitação' | 'Afastado' | 'Inativo';

export interface HierarchyNode {
  id: HierarchyRankId;
  rankTitle: string;
  memberName: string;
  positionCode: string;
  tier: 1 | 2 | 3 | 4 | 5 | 6;
  parentId?: string;
  responsibility: string;
  insigniaUrl?: string;
  photoUrl?: string;
  order: number;
  isDemo: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface HierarchyMember {
  id: string;
  rankId: HierarchyRankId;
  name: string;
  photoUrl: string;
  description: string;
  status: HierarchyMemberStatus;
  order: number;
  createdAt?: unknown;
  updatedAt?: unknown;
  updatedBy?: string;
  /** True only for non-migrated legacy single-member preview records before an admin logs in */
  isLegacyMigratedPreview?: boolean;
}

export interface RoleSpecialty {
  id: string;
  name: string;
  category: string;
  iconName: string;
  imageUrl?: string;
  description: string;
  responsibilities: string[];
  requirements: string[];
  order: number;
  isDemo: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface OperationRecord {
  id: string;
  title: string;
  category: string;
  date: string;
  summary: string;
  details: string;
  results: string;
  coverImageUrl: string;
  galleryUrls?: string[];
  featured: boolean;
  isDemo: boolean;
  order: number;
  updatedBy?: string;
  updatedAt?: unknown;
}

export interface GalleryItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  date: string;
  imageUrl: string;
  isCover: boolean;
  order: number;
  isDemo: boolean;
  updatedBy?: string;
  updatedAt?: unknown;
}
