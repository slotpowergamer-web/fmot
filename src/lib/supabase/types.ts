import {
  HierarchyMemberStatus,
  HierarchyRankId,
  InstitutionalValue,
  ManagedPageKey,
} from '../../types/portal';

export const SUPABASE_MEDIA_BUCKET = 'fmot-media' as const;

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type PortalConfigRow = {
  id: string;
  hero_headline: string;
  hero_subtext: string;
  about_intro: string;
  about_operations_text: string;
  about_differentiator: string;
  about_identity_text: string;
  about_values: InstitutionalValue[];
  updated_by: string | null;
  updated_at: string;
};

export type PortalSlotRow = {
  id: string;
  page: ManagedPageKey;
  label: string;
  title: string;
  description: string | null;
  placeholder_label: string | null;
  image_url: string;
  media_asset_id: string | null;
  is_cover: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type HierarchyNodeRow = {
  id: HierarchyRankId;
  rank_title: string;
  member_name: string;
  position_code: string;
  tier: number;
  parent_id: string | null;
  responsibility: string;
  insignia_url: string | null;
  photo_url: string | null;
  sort_order: number;
  is_demo: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type HierarchyMemberRow = {
  id: string;
  rank_id: HierarchyRankId;
  name: string;
  photo_url: string;
  description: string;
  status: HierarchyMemberStatus;
  sort_order: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RoleSpecialtyRow = {
  id: string;
  name: string;
  category: string;
  icon_name: string;
  image_url: string | null;
  description: string;
  responsibilities: string[];
  requirements: string[];
  sort_order: number;
  is_demo: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type OperationRecordRow = {
  id: string;
  title: string;
  category: string;
  date: string;
  summary: string;
  details: string;
  results: string;
  cover_image_url: string;
  gallery_urls: string[];
  featured: boolean;
  is_demo: boolean;
  sort_order: number;
  updated_by: string | null;
  updated_at: string;
};

export type GalleryItemRow = {
  id: string;
  title: string;
  description: string | null;
  category: string;
  date: string;
  image_url: string;
  is_cover: boolean;
  sort_order: number;
  is_demo: boolean;
  updated_by: string | null;
  updated_at: string;
};

export type MediaAssetRow = {
  id: string;
  file_name: string;
  mime_type: 'image/webp' | 'image/jpeg' | 'image/png';
  storage_path: string;
  public_url: string;
  width: number;
  height: number;
  size_bytes: number;
  page: ManagedPageKey;
  title: string;
  description: string | null;
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AdminUserRow = {
  user_id: string;
  email: string;
  role: 'admin';
  created_at: string;
};

export type Database = {
  public: {
    Tables: {
      portal_config: {
        Row: PortalConfigRow;
        Insert: Partial<PortalConfigRow> & { id: string };
        Update: Partial<PortalConfigRow>;
        Relationships: [];
      };
      portal_slots: {
        Row: PortalSlotRow;
        Insert: Partial<PortalSlotRow> & { id: string; page: ManagedPageKey; label: string; title: string };
        Update: Partial<PortalSlotRow>;
        Relationships: [];
      };
      hierarchy_nodes: {
        Row: HierarchyNodeRow;
        Insert: Partial<HierarchyNodeRow> & { id: HierarchyRankId; rank_title: string; position_code: string; tier: number };
        Update: Partial<HierarchyNodeRow>;
        Relationships: [];
      };
      hierarchy_members: {
        Row: HierarchyMemberRow;
        Insert: Partial<HierarchyMemberRow> & { id: string; rank_id: HierarchyRankId; name: string };
        Update: Partial<HierarchyMemberRow>;
        Relationships: [];
      };
      roles_catalog: {
        Row: RoleSpecialtyRow;
        Insert: Partial<RoleSpecialtyRow> & { id: string; name: string; category: string };
        Update: Partial<RoleSpecialtyRow>;
        Relationships: [];
      };
      operations_records: {
        Row: OperationRecordRow;
        Insert: Partial<OperationRecordRow> & { id: string; title: string; category: string };
        Update: Partial<OperationRecordRow>;
        Relationships: [];
      };
      gallery_items: {
        Row: GalleryItemRow;
        Insert: Partial<GalleryItemRow> & { id: string; title: string; category: string };
        Update: Partial<GalleryItemRow>;
        Relationships: [];
      };
      media_assets: {
        Row: MediaAssetRow;
        Insert: Partial<MediaAssetRow> & {
          id: string;
          file_name: string;
          mime_type: 'image/webp' | 'image/jpeg' | 'image/png';
          storage_path: string;
          public_url: string;
          page: ManagedPageKey;
          title: string;
        };
        Update: Partial<MediaAssetRow>;
        Relationships: [];
      };
      admin_users: {
        Row: AdminUserRow;
        Insert: Partial<AdminUserRow> & { user_id: string; email: string };
        Update: Partial<AdminUserRow>;
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      is_fmot_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
