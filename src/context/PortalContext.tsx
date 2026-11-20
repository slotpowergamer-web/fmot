import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { onAuthStateChanged, signInWithPopup, signOut, User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import {
  auth,
  BOOTSTRAP_ADMIN_EMAIL,
  db,
  FIRESTORE_QUOTA_UPGRADE_URL,
  googleProvider,
  handleFirestoreError,
  isQuotaExceededError,
  OperationType,
} from '../firebase';
import {
  deleteCachedMediaAsset,
  deleteCachedSnapshot,
  getCachedMediaAsset,
  getCachedMediaAssets,
  getCachedSnapshot,
  putCachedMediaAsset,
  putCachedMediaAssets,
  putCachedSnapshot,
} from '../utils/localMediaCache';
import { collectMediaIdsForTab, runWithConcurrency } from '../utils/mediaSelection';
import {
  DEFAULT_GALLERY_ITEMS,
  DEFAULT_HIERARCHY_NODES,
  DEFAULT_OPERATIONS,
  DEFAULT_PORTAL_CONFIG,
  DEFAULT_PORTAL_SLOTS,
  DEFAULT_ROLES,
  OFFICIAL_EMBLEM_URL,
} from '../data/defaultPortalData';
import {
  GalleryItem,
  HierarchyMember,
  HierarchyMemberStatus,
  HierarchyNode,
  HierarchyRankId,
  ManagedPageKey,
  MediaAsset,
  OperationRecord,
  PortalConfig,
  PortalSlot,
  PortalTab,
  RoleSpecialty,
} from '../types/portal';
import { dataUrlToBlob, OptimizedImageResult } from '../utils/imageOptimizer';
import {
  buildDeduplicatedStoragePath,
  checkSupabaseHealth,
  deleteImageFromSupabaseStorage,
  deleteSupabaseGalleryItem,
  deleteSupabaseHierarchyMember,
  deleteSupabaseHierarchyNode,
  deleteSupabaseMediaAssetRow,
  deleteSupabaseOperation,
  deleteSupabasePortalSlot,
  deleteSupabaseRole,
  fetchSupabaseMediaAssets,
  fetchSupabasePortalSnapshot,
  findSupabaseMediaAssetByStoragePath,
  getSupabaseBrowserClient,
  inspectFirebaseMigrationSources,
  isSupabaseConfigured,
  migrateFirebaseMediaToSupabase,
  MigrationInventory,
  MigrationReport,
  RunMigrationOptions,
  SupabaseHealthStatus,
  updateSupabaseReferencesUrl,
  uploadImageToSupabaseStorage,
  upsertSupabaseGalleryItem,
  upsertSupabaseHierarchyMember,
  upsertSupabaseHierarchyNode,
  upsertSupabaseMediaAsset,
  upsertSupabaseOperation,
  upsertSupabasePortalConfig,
  upsertSupabasePortalSlot,
  upsertSupabaseRole,
  verifySupabaseAdminSession,
  verifySupabasePublicImageUrl,
} from '../lib/supabase';

export interface QuickImageTarget {
  title: string;
  page: ManagedPageKey;
  currentUrl: string;
  preserveTransparency?: boolean;
  onPublish: (imageUrl: string, assetId?: string) => Promise<void>;
  onRemove?: () => Promise<void>;
}

interface PortalContextValue {
  activeTab: PortalTab;
  setActiveTab: (tab: PortalTab) => void;
  selectedOperationId: string | null;
  setSelectedOperationId: (id: string | null) => void;

  user: User | null;
  authReady: boolean;
  isAdmin: boolean;
  authError: string | null;
  signInAdmin: () => Promise<void>;
  signOutAdmin: () => Promise<void>;

  editMode: boolean;
  setEditMode: (val: boolean) => void;
  quickImageTarget: QuickImageTarget | null;
  openQuickImageEditor: (target: QuickImageTarget) => void;
  closeQuickImageEditor: () => void;

  config: PortalConfig;
  slots: PortalSlot[];
  slotsMap: Record<string, PortalSlot>;
  logoUrl: string;
  mediaAssets: MediaAsset[];
  hierarchy: HierarchyNode[];
  hierarchyMembers: HierarchyMember[];
  membersByRank: Record<HierarchyRankId, HierarchyMember[]>;
  roles: RoleSpecialty[];
  operations: OperationRecord[];
  gallery: GalleryItem[];
  loadingData: boolean;
  loadingMediaLibrary: boolean;
  quotaExceeded: boolean;
  quotaUpgradeUrl: string;
  loadFullMediaLibrary: (force?: boolean) => Promise<void>;

  supabaseHealth: SupabaseHealthStatus | null;
  supabaseAdminEmail: string | null;
  supabaseReadyForWrites: boolean;
  supabasePrimaryActive: boolean;
  refreshSupabaseHealth: () => Promise<SupabaseHealthStatus>;
  signInSupabaseAdmin: (email: string, password: string) => Promise<void>;
  signOutSupabaseAdmin: () => Promise<void>;
  inspectFirebaseMigration: () => Promise<MigrationInventory>;
  runFirebaseToSupabaseMigration: (options?: RunMigrationOptions) => Promise<MigrationReport>;

  resolveMediaUrl: (urlOrRef?: string) => string;

  uploadMediaAsset: (
    optimized: OptimizedImageResult,
    meta: { page: ManagedPageKey; title: string; description?: string }
  ) => Promise<{ assetId: string; refUrl: string; deduplicated?: boolean }>;
  replaceMediaAsset: (
    assetId: string,
    optimized: OptimizedImageResult,
    meta?: { title?: string; description?: string }
  ) => Promise<{ assetId: string; refUrl: string }>;
  deleteMediaAsset: (assetId: string) => Promise<void>;
  savePortalSlot: (slot: PortalSlot) => Promise<void>;
  resetPortalSlot: (slotId: string) => Promise<void>;
  savePortalConfig: (nextConfig: PortalConfig) => Promise<void>;

  saveHierarchyNode: (node: HierarchyNode) => Promise<void>;
  deleteHierarchyNode: (nodeId: string) => Promise<void>;

  addHierarchyMember: (input: {
    rankId: HierarchyRankId;
    name: string;
    photoUrl: string;
    description: string;
    status: HierarchyMemberStatus;
  }) => Promise<string>;
  updateHierarchyMember: (
    memberId: string,
    patch: {
      rankId: HierarchyRankId;
      name: string;
      photoUrl: string;
      description: string;
      status: HierarchyMemberStatus;
      order?: number;
    }
  ) => Promise<void>;
  transferHierarchyMember: (memberId: string, targetRankId: HierarchyRankId) => Promise<void>;
  reorderRankMembers: (rankId: HierarchyRankId, orderedMembers: HierarchyMember[]) => Promise<void>;
  deleteHierarchyMember: (memberId: string) => Promise<void>;

  saveRoleSpecialty: (role: RoleSpecialty) => Promise<void>;
  deleteRoleSpecialty: (roleId: string) => Promise<void>;

  saveOperationRecord: (op: OperationRecord) => Promise<void>;
  deleteOperationRecord: (opId: string) => Promise<void>;

  saveGalleryItem: (item: GalleryItem) => Promise<void>;
  deleteGalleryItem: (itemId: string) => Promise<void>;
  reorderGalleryItems: (orderedItems: GalleryItem[]) => Promise<void>;

  toastMessage: { type: 'success' | 'error'; text: string } | null;
  showToast: (text: string, type?: 'success' | 'error') => void;
}

const PortalContext = createContext<PortalContextValue | undefined>(undefined);

function sanitizeId(raw: string): string {
  const cleaned = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 96);
  return cleaned.length > 0 ? cleaned : `id_${Date.now()}`;
}

// Ignore any stale AI-generated image paths if an earlier session stored them
function sanitizeMediaRef(url?: string): string {
  if (!url) return '';
  if (url.startsWith('/src/assets/images/')) return '';
  return url;
}

const QUOTA_RECOVERY_COOLDOWN_MS = 5 * 60 * 1000;

export const PortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTabState] = useState<PortalTab>('inicio');
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [firebaseIsAdmin, setFirebaseIsAdmin] = useState(false);
  const [supabaseAdminUserId, setSupabaseAdminUserId] = useState<string | null>(null);
  const [supabaseAdminEmail, setSupabaseAdminEmail] = useState<string | null>(null);
  const [supabaseHealth, setSupabaseHealth] = useState<SupabaseHealthStatus | null>(null);
  const [supabaseSchemaReady, setSupabaseSchemaReady] = useState(false);
  const [supabaseChecked, setSupabaseChecked] = useState(() => !isSupabaseConfigured());
  const [supabasePrimaryActive, setSupabasePrimaryActive] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const isAdmin = firebaseIsAdmin || Boolean(supabaseAdminUserId);
  const supabaseReadyForWrites = Boolean(
    supabaseSchemaReady && supabaseHealth?.storageBucketReady && supabaseAdminUserId
  );

  const [editMode, setEditMode] = useState(false);
  const [quickImageTarget, setQuickImageTarget] = useState<QuickImageTarget | null>(null);

  const [config, setConfig] = useState<PortalConfig>(DEFAULT_PORTAL_CONFIG);
  const [customSlots, setCustomSlots] = useState<Record<string, PortalSlot>>({});
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [dbHierarchyMap, setDbHierarchyMap] = useState<Record<string, HierarchyNode>>({});
  const [dbMembers, setDbMembers] = useState<HierarchyMember[]>([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [dbRoles, setDbRoles] = useState<RoleSpecialty[] | null>(null);
  const [dbOperations, setDbOperations] = useState<OperationRecord[] | null>(null);
  const [dbGallery, setDbGallery] = useState<GalleryItem[] | null>(null);
  const migratedRanksRef = useRef<Set<string>>(new Set());

  const [loadingData, setLoadingData] = useState(true);
  const [cacheHydrated, setCacheHydrated] = useState(false);
  const [loadingMediaLibrary, setLoadingMediaLibrary] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);
  const [listenerEpoch, setListenerEpoch] = useState(0);
  const isMountedRef = useRef(true);
  const serverLoadedKeysRef = useRef<Set<string>>(new Set());
  const supabasePrimaryKeysRef = useRef<Set<string>>(new Set());
  const fetchedMediaIdsRef = useRef<Set<string>>(new Set());
  const inflightMediaIdsRef = useRef<Set<string>>(new Set());
  const fullLibraryLoadedRef = useRef(false);
  const listenerFailedRef = useRef(false);
  const lastQuotaErrorAtRef = useRef(0);
  const recoveryInFlightRef = useRef(false);

  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const mergeMediaAssets = useCallback((incoming: MediaAsset[]) => {
    if (!incoming.length) return;
    setMediaAssets((prev) => {
      const map = new Map<string, MediaAsset>();
      prev.forEach((asset) => map.set(asset.id, asset));
      incoming.forEach((asset) => {
        if (!asset?.id) return;
        const existing = map.get(asset.id);
        // Always prefer Supabase Storage CDN asset over legacy Firebase base64 copy when IDs match
        if (existing?.source === 'supabase' && asset.source !== 'supabase') {
          return;
        }
        map.set(asset.id, asset);
      });
      return Array.from(map.values());
    });
  }, []);

  const showToast = useCallback((text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ type, text });
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timer = window.setTimeout(() => setToastMessage(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toastMessage]);

  const setActiveTab = useCallback((tab: PortalTab) => {
    setActiveTabState(tab);
    if (tab !== 'operacoes') {
      setSelectedOperationId(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Firebase Auth Listener & Admin Verification (preserved intact)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthError(null);
      if (!currentUser) {
        setFirebaseIsAdmin(false);
        setAuthReady(true);
        return;
      }

      const isBootstrap =
        Boolean(currentUser.emailVerified) &&
        currentUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

      if (isBootstrap) {
        setFirebaseIsAdmin(true);
        setAuthReady(true);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
        setFirebaseIsAdmin(Boolean(currentUser.emailVerified) && adminSnap.exists());
      } catch {
        setFirebaseIsAdmin(false);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Supabase Auth Session + Live Health & Primary Data Loader
  const refreshSupabaseHealth = useCallback(async (): Promise<SupabaseHealthStatus> => {
    const status = await checkSupabaseHealth();
    if (isMountedRef.current) {
      setSupabaseHealth(status);
      setSupabaseSchemaReady(status.schemaReady);
    }
    return status;
  }, []);

  const hydrateFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      setSupabaseChecked(true);
      return;
    }
    try {
      const snapshot = await fetchSupabasePortalSnapshot();
      if (!snapshot || !isMountedRef.current) return;

      setSupabaseSchemaReady(snapshot.schemaReady);
      if (!snapshot.schemaReady) return;

      // Supabase is live and readable: never let browser cache resurrect deleted Supabase media
      serverLoadedKeysRef.current.add('media_assets');

      let hasPrimarySupabaseData = false;

      if (snapshot.mediaAssets.length > 0) {
        hasPrimarySupabaseData = true;
        supabasePrimaryKeysRef.current.add('media_assets');
        snapshot.mediaAssets.forEach((asset) => fetchedMediaIdsRef.current.add(asset.id));
        void putCachedMediaAssets(snapshot.mediaAssets);
      }
      if (snapshot.config) {
        hasPrimarySupabaseData = true;
        supabasePrimaryKeysRef.current.add('portal_config');
        serverLoadedKeysRef.current.add('portal_config');
        setConfig(snapshot.config);
        void putCachedSnapshot('portal_config', snapshot.config);
      }
      if (Object.keys(snapshot.slots).length > 0) {
        hasPrimarySupabaseData = true;
        supabasePrimaryKeysRef.current.add('portal_slots');
        serverLoadedKeysRef.current.add('portal_slots');
        setCustomSlots(snapshot.slots);
        void putCachedSnapshot('portal_slots', snapshot.slots);
      }
      if (Object.keys(snapshot.hierarchyNodes).length > 0) {
        hasPrimarySupabaseData = true;
        supabasePrimaryKeysRef.current.add('hierarchy_nodes');
        serverLoadedKeysRef.current.add('hierarchy_nodes');
        setDbHierarchyMap(snapshot.hierarchyNodes);
        void putCachedSnapshot('hierarchy_nodes', snapshot.hierarchyNodes);
      }
      if (snapshot.hierarchyMembers.length > 0) {
        hasPrimarySupabaseData = true;
        supabasePrimaryKeysRef.current.add('hierarchy_members');
        serverLoadedKeysRef.current.add('hierarchy_members');
        setDbMembers(snapshot.hierarchyMembers);
        setMembersLoaded(true);
        void putCachedSnapshot('hierarchy_members', snapshot.hierarchyMembers);
      }
      if (snapshot.roles && snapshot.roles.length > 0) {
        hasPrimarySupabaseData = true;
        supabasePrimaryKeysRef.current.add('roles_catalog');
        serverLoadedKeysRef.current.add('roles_catalog');
        setDbRoles(snapshot.roles);
        void putCachedSnapshot('roles_catalog', snapshot.roles);
      }
      if (snapshot.operations && snapshot.operations.length > 0) {
        hasPrimarySupabaseData = true;
        supabasePrimaryKeysRef.current.add('operations_records');
        serverLoadedKeysRef.current.add('operations_records');
        setDbOperations(snapshot.operations);
        void putCachedSnapshot('operations_records', snapshot.operations);
      }
      if (snapshot.gallery && snapshot.gallery.length > 0) {
        hasPrimarySupabaseData = true;
        supabasePrimaryKeysRef.current.add('gallery_items');
        serverLoadedKeysRef.current.add('gallery_items');
        setDbGallery(snapshot.gallery);
        void putCachedSnapshot('gallery_items', snapshot.gallery);
      }

      // Always reconcile Supabase media assets against live PostgreSQL (even when 0 rows remain)
      const liveSupabaseIds = new Set(snapshot.mediaAssets.map((item) => item.id));
      setMediaAssets((prev) => {
        const removedSupabaseIds = prev
          .filter((item) => item.source === 'supabase' && !liveSupabaseIds.has(item.id))
          .map((item) => item.id);
        removedSupabaseIds.forEach((removedId) => {
          fetchedMediaIdsRef.current.delete(removedId);
          void deleteCachedMediaAsset(removedId);
        });

        const legacyBackupOnly = prev.filter(
          (item) => item.source !== 'supabase' && !liveSupabaseIds.has(item.id)
        );
        return [...snapshot.mediaAssets, ...legacyBackupOnly];
      });

      if (hasPrimarySupabaseData) {
        // Authoritative reconciliation: reflect exact live Supabase state (including deletions)
        serverLoadedKeysRef.current.add('portal_slots');
        serverLoadedKeysRef.current.add('hierarchy_nodes');
        serverLoadedKeysRef.current.add('hierarchy_members');
        serverLoadedKeysRef.current.add('roles_catalog');
        serverLoadedKeysRef.current.add('operations_records');
        serverLoadedKeysRef.current.add('gallery_items');

        setCustomSlots(snapshot.slots);
        setDbHierarchyMap(snapshot.hierarchyNodes);
        setDbMembers(snapshot.hierarchyMembers);
        setDbRoles(snapshot.roles);
        setDbOperations(snapshot.operations);
        setDbGallery(snapshot.gallery);

        if (Object.keys(snapshot.slots).length === 0) void deleteCachedSnapshot('portal_slots');
        if (Object.keys(snapshot.hierarchyNodes).length === 0) {
          void deleteCachedSnapshot('hierarchy_nodes');
        }
        if (snapshot.hierarchyMembers.length === 0) void deleteCachedSnapshot('hierarchy_members');
        if (!snapshot.roles) void deleteCachedSnapshot('roles_catalog');
        if (!snapshot.operations) void deleteCachedSnapshot('operations_records');
        if (!snapshot.gallery) void deleteCachedSnapshot('gallery_items');

        setSupabasePrimaryActive(true);
        setMembersLoaded(true);
        setLoadingData(false);
      }
    } catch (err) {
      console.error('Erro ao ler dados do Supabase:', err);
    } finally {
      if (isMountedRef.current) {
        setSupabaseChecked(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    let active = true;
    const syncSupabaseUser = async (
      sbUser: { id: string; email?: string | null; email_confirmed_at?: string | null } | null
    ) => {
      if (!active || !isMountedRef.current) return;
      if (!sbUser?.id || !sbUser.email || !sbUser.email_confirmed_at) {
        setSupabaseAdminUserId(null);
        setSupabaseAdminEmail(null);
        return;
      }

      const verifiedAdmin = await verifySupabaseAdminSession(supabase, sbUser);
      if (!active || !isMountedRef.current) return;

      if (verifiedAdmin) {
        setSupabaseAdminUserId(sbUser.id);
        setSupabaseAdminEmail(sbUser.email);
      } else {
        setSupabaseAdminUserId(null);
        setSupabaseAdminEmail(null);
      }
    };

    void supabase.auth.getUser().then(({ data }) => {
      void syncSupabaseUser(data.user ?? null);
    });

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, session) => {
      void syncSupabaseUser(session?.user ?? null);
    });

    void hydrateFromSupabase();
    void refreshSupabaseHealth();

    return () => {
      active = false;
      authSub.subscription.unsubscribe();
    };
  }, [hydrateFromSupabase, refreshSupabaseHealth]);

  // Hydrate previously loaded images and metadata from IndexedDB so images load instantly
  // without re-reading multi-megabyte media_assets documents from Firestore on every page reload.
  useEffect(() => {
    let cancelled = false;

    const hydrateFromCache = async () => {
      try {
        const [
          cachedMedia,
          cachedConfig,
          cachedSlots,
          cachedHierarchy,
          cachedMembers,
          cachedRoles,
          cachedOps,
          cachedGallery,
        ] = await Promise.all([
          getCachedMediaAssets(),
          getCachedSnapshot<PortalConfig>('portal_config'),
          getCachedSnapshot<Record<string, PortalSlot>>('portal_slots'),
          getCachedSnapshot<Record<string, HierarchyNode>>('hierarchy_nodes'),
          getCachedSnapshot<HierarchyMember[]>('hierarchy_members'),
          getCachedSnapshot<RoleSpecialty[]>('roles_catalog'),
          getCachedSnapshot<OperationRecord[]>('operations_records'),
          getCachedSnapshot<GalleryItem[]>('gallery_items'),
        ]);

        if (cancelled || !isMountedRef.current) return;

        if (cachedMedia.length > 0) {
          const safeCachedMedia = serverLoadedKeysRef.current.has('media_assets')
            ? cachedMedia.filter((asset) => asset.source !== 'supabase')
            : cachedMedia;
          if (safeCachedMedia.length > 0) {
            safeCachedMedia.forEach((asset) => fetchedMediaIdsRef.current.add(asset.id));
            mergeMediaAssets(safeCachedMedia);
          }
        }
        if (cachedConfig && !serverLoadedKeysRef.current.has('portal_config')) {
          setConfig(cachedConfig);
        }
        if (
          cachedSlots &&
          Object.keys(cachedSlots).length > 0 &&
          !serverLoadedKeysRef.current.has('portal_slots')
        ) {
          setCustomSlots(cachedSlots);
        }
        if (
          cachedHierarchy &&
          Object.keys(cachedHierarchy).length > 0 &&
          !serverLoadedKeysRef.current.has('hierarchy_nodes')
        ) {
          setDbHierarchyMap(cachedHierarchy);
        }
        if (
          cachedMembers &&
          cachedMembers.length > 0 &&
          !serverLoadedKeysRef.current.has('hierarchy_members')
        ) {
          setDbMembers(cachedMembers);
        }
        if (
          cachedRoles &&
          cachedRoles.length > 0 &&
          !serverLoadedKeysRef.current.has('roles_catalog')
        ) {
          setDbRoles(cachedRoles);
        }
        if (
          cachedOps &&
          cachedOps.length > 0 &&
          !serverLoadedKeysRef.current.has('operations_records')
        ) {
          setDbOperations(cachedOps);
        }
        if (
          cachedGallery &&
          cachedGallery.length > 0 &&
          !serverLoadedKeysRef.current.has('gallery_items')
        ) {
          setDbGallery(cachedGallery);
        }
      } finally {
        if (!cancelled && isMountedRef.current) {
          setCacheHydrated(true);
        }
      }
    };

    void hydrateFromCache();
    return () => {
      cancelled = true;
    };
  }, [mergeMediaAssets]);

  // Public institutional listeners (Firebase backup fallback ONLY until Supabase holds primary data)
  useEffect(() => {
    if (!supabaseChecked) return;
    if (supabasePrimaryActive) {
      setLoadingData(false);
      return;
    }

    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 2) setLoadingData(false);
    };

    const handleListenerError = (label: string, err: unknown) => {
      listenerFailedRef.current = true;
      if (isQuotaExceededError(err)) {
        lastQuotaErrorAtRef.current = Date.now();
        setQuotaExceeded(true);
      }
      console.error(`Erro ao ler ${label}:`, err);
    };

    const unsubConfig = onSnapshot(
      doc(db, 'portal_config', 'main'),
      (snap) => {
        if (!snap.metadata.fromCache) {
          serverLoadedKeysRef.current.add('portal_config');
          setQuotaExceeded(false);
        }
        if (snap.exists()) {
          const data = snap.data() as Partial<PortalConfig>;
          const nextConfig: PortalConfig = {
            heroHeadline: data.heroHeadline || DEFAULT_PORTAL_CONFIG.heroHeadline,
            heroSubtext: data.heroSubtext || DEFAULT_PORTAL_CONFIG.heroSubtext,
            aboutIntro: data.aboutIntro || DEFAULT_PORTAL_CONFIG.aboutIntro,
            aboutOperationsText:
              data.aboutOperationsText || DEFAULT_PORTAL_CONFIG.aboutOperationsText,
            aboutDifferentiator:
              data.aboutDifferentiator || DEFAULT_PORTAL_CONFIG.aboutDifferentiator,
            aboutIdentityText: data.aboutIdentityText || DEFAULT_PORTAL_CONFIG.aboutIdentityText,
            aboutValues:
              Array.isArray(data.aboutValues) && data.aboutValues.length > 0
                ? data.aboutValues
                : DEFAULT_PORTAL_CONFIG.aboutValues,
            updatedAt: data.updatedAt,
            updatedBy: data.updatedBy,
          };
          setConfig(nextConfig);
          void putCachedSnapshot('portal_config', nextConfig);
        } else if (!snap.metadata.fromCache) {
          setConfig(DEFAULT_PORTAL_CONFIG);
          void deleteCachedSnapshot('portal_config');
        }
        markLoaded();
      },
      (err) => {
        handleListenerError('portal_config', err);
        markLoaded();
      }
    );

    const unsubSlots = onSnapshot(
      collection(db, 'portal_slots'),
      (snap) => {
        if (!snap.metadata.fromCache) {
          serverLoadedKeysRef.current.add('portal_slots');
          setQuotaExceeded(false);
        }
        if (!snap.empty || !snap.metadata.fromCache) {
          const next: Record<string, PortalSlot> = {};
          snap.docs.forEach((d) => {
            const raw = d.data() as PortalSlot;
            next[d.id] = {
              ...raw,
              id: d.id,
              imageUrl: sanitizeMediaRef(raw.imageUrl),
            };
          });
          setCustomSlots(next);
          if (Object.keys(next).length > 0) {
            void putCachedSnapshot('portal_slots', next);
          } else {
            void deleteCachedSnapshot('portal_slots');
          }
        }
        markLoaded();
      },
      (err) => {
        handleListenerError('portal_slots', err);
        markLoaded();
      }
    );

    const unsubHierarchy = onSnapshot(
      collection(db, 'hierarchy_nodes'),
      (snap) => {
        if (!snap.metadata.fromCache) {
          serverLoadedKeysRef.current.add('hierarchy_nodes');
        }
        if (!snap.empty || !snap.metadata.fromCache) {
          const next: Record<string, HierarchyNode> = {};
          snap.docs.forEach((d) => {
            const raw = d.data() as HierarchyNode;
            next[d.id] = {
              ...raw,
              id: d.id as HierarchyRankId,
              photoUrl: sanitizeMediaRef(raw.photoUrl),
              insigniaUrl: sanitizeMediaRef(raw.insigniaUrl),
            };
          });
          setDbHierarchyMap(next);
          if (Object.keys(next).length > 0) {
            void putCachedSnapshot('hierarchy_nodes', next);
          } else {
            void deleteCachedSnapshot('hierarchy_nodes');
          }
        }
      },
      (err) => handleListenerError('hierarchy_nodes', err)
    );

    const unsubHierarchyMembers = onSnapshot(
      collection(db, 'hierarchy_members'),
      (snap) => {
        if (!snap.metadata.fromCache) {
          serverLoadedKeysRef.current.add('hierarchy_members');
        }
        if (!snap.empty || !snap.metadata.fromCache) {
          const items: HierarchyMember[] = snap.docs.map((d) => {
            const raw = d.data() as HierarchyMember;
            return {
              ...raw,
              id: d.id,
              photoUrl: sanitizeMediaRef(raw.photoUrl),
              description: raw.description || '',
              status: raw.status || 'Ativo',
              order: typeof raw.order === 'number' ? raw.order : 0,
            };
          });
          setDbMembers(items);
          if (items.length > 0) {
            void putCachedSnapshot('hierarchy_members', items);
          } else {
            void deleteCachedSnapshot('hierarchy_members');
          }
        }
        setMembersLoaded(true);
      },
      (err) => {
        handleListenerError('hierarchy_members', err);
        setMembersLoaded(true);
      }
    );

    const unsubRoles = onSnapshot(
      collection(db, 'roles_catalog'),
      (snap) => {
        if (!snap.metadata.fromCache) {
          serverLoadedKeysRef.current.add('roles_catalog');
        }
        if (snap.empty) {
          if (!snap.metadata.fromCache) {
            setDbRoles(null);
            void deleteCachedSnapshot('roles_catalog');
          }
        } else {
          const items = snap.docs
            .map((d) => {
              const raw = d.data() as RoleSpecialty;
              return { ...raw, id: d.id, imageUrl: sanitizeMediaRef(raw.imageUrl) };
            })
            .sort((a, b) => a.order - b.order);
          setDbRoles(items);
          void putCachedSnapshot('roles_catalog', items);
        }
      },
      (err) => handleListenerError('roles_catalog', err)
    );

    const unsubOps = onSnapshot(
      collection(db, 'operations_records'),
      (snap) => {
        if (!snap.metadata.fromCache) {
          serverLoadedKeysRef.current.add('operations_records');
        }
        if (snap.empty) {
          if (!snap.metadata.fromCache) {
            setDbOperations(null);
            void deleteCachedSnapshot('operations_records');
          }
        } else {
          const items = snap.docs
            .map((d) => {
              const raw = d.data() as OperationRecord;
              return {
                ...raw,
                id: d.id,
                coverImageUrl: sanitizeMediaRef(raw.coverImageUrl),
                galleryUrls: (raw.galleryUrls || []).map(sanitizeMediaRef).filter(Boolean),
              };
            })
            .sort((a, b) => a.order - b.order || b.date.localeCompare(a.date));
          setDbOperations(items);
          void putCachedSnapshot('operations_records', items);
        }
      },
      (err) => handleListenerError('operations_records', err)
    );

    const unsubGallery = onSnapshot(
      collection(db, 'gallery_items'),
      (snap) => {
        if (!snap.metadata.fromCache) {
          serverLoadedKeysRef.current.add('gallery_items');
        }
        if (snap.empty) {
          if (!snap.metadata.fromCache) {
            setDbGallery(null);
            void deleteCachedSnapshot('gallery_items');
          }
        } else {
          const items = snap.docs
            .map((d) => {
              const raw = d.data() as GalleryItem;
              return { ...raw, id: d.id, imageUrl: sanitizeMediaRef(raw.imageUrl) };
            })
            .sort((a, b) => a.order - b.order);
          setDbGallery(items);
          void putCachedSnapshot('gallery_items', items);
        }
      },
      (err) => handleListenerError('gallery_items', err)
    );

    return () => {
      unsubConfig();
      unsubSlots();
      unsubHierarchy();
      unsubHierarchyMembers();
      unsubRoles();
      unsubOps();
      unsubGallery();
    };
  }, [listenerEpoch, supabaseChecked, supabasePrimaryActive]);

  // Automatic recovery when network returns or when Firestore recovers after quota cooldown
  useEffect(() => {
    const attemptRecovery = async () => {
      if (recoveryInFlightRef.current || !isMountedRef.current) return;
      if (!listenerFailedRef.current && !quotaExceeded) return;

      if (quotaExceeded) {
        const elapsed = Date.now() - lastQuotaErrorAtRef.current;
        if (elapsed < QUOTA_RECOVERY_COOLDOWN_MS) return;

        recoveryInFlightRef.current = true;
        try {
          await getDocFromServer(doc(db, 'portal_config', 'main'));
          if (!isMountedRef.current) return;
          listenerFailedRef.current = false;
          setQuotaExceeded(false);
          setListenerEpoch((prev) => prev + 1);
        } catch (err) {
          if (isQuotaExceededError(err)) {
            lastQuotaErrorAtRef.current = Date.now();
          }
        } finally {
          recoveryInFlightRef.current = false;
        }
        return;
      }

      // Transient network error recovery: re-attach terminated listeners immediately on reconnect
      listenerFailedRef.current = false;
      setListenerEpoch((prev) => prev + 1);
    };

    const handleOnline = () => {
      void attemptRecovery();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void attemptRecovery();
      }
    };

    window.addEventListener('online', handleOnline);
    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      window.removeEventListener('online', handleOnline);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [quotaExceeded]);

  // Collect ONLY the media://<assetId> references needed for the currently visible tab (+ global logo)
  const referencedMediaIds = useMemo(
    () =>
      collectMediaIdsForTab({
        activeTab,
        selectedOperationId,
        customSlots,
        dbHierarchyMap,
        dbMembers,
        dbRoles,
        dbOperations,
        dbGallery,
      }),
    [
      activeTab,
      selectedOperationId,
      customSlots,
      dbHierarchyMap,
      dbMembers,
      dbRoles,
      dbOperations,
      dbGallery,
    ]
  );

  // Fetch only uncached referenced media_assets for the current tab once per ID and store permanently in IndexedDB.
  // Never cancels an in-flight state update merely because referencedMediaIds expanded on another collection snapshot.
  useEffect(() => {
    if (!cacheHydrated || quotaExceeded || referencedMediaIds.length === 0) return;

    const missingIds = referencedMediaIds.filter(
      (id) => !fetchedMediaIdsRef.current.has(id) && !inflightMediaIdsRef.current.has(id)
    );
    if (missingIds.length === 0) return;

    missingIds.forEach((id) => inflightMediaIdsRef.current.add(id));

    const fetchMissingMedia = async () => {
      await runWithConcurrency(missingIds, 4, async (id) => {
        if (!isMountedRef.current) {
          inflightMediaIdsRef.current.delete(id);
          return true;
        }
        try {
          const cached = await getCachedMediaAsset(id);
          if (cached?.dataUrl) {
            fetchedMediaIdsRef.current.add(id);
            if (isMountedRef.current) mergeMediaAssets([cached]);
            return false;
          }

          // Primary source: Supabase `media_assets`
          const supabase = getSupabaseBrowserClient();
          if (supabase && supabaseSchemaReady) {
            const { data: sbRow } = await supabase
              .from('media_assets')
              .select('*')
              .eq('id', id)
              .maybeSingle();
            if (sbRow && sbRow.public_url) {
              const sbAsset: MediaAsset = {
                id: sbRow.id,
                fileName: sbRow.file_name,
                mimeType: sbRow.mime_type,
                dataUrl: sbRow.public_url,
                storagePath: sbRow.storage_path,
                publicUrl: sbRow.public_url,
                source: 'supabase',
                width: sbRow.width,
                height: sbRow.height,
                sizeBytes: sbRow.size_bytes,
                page: sbRow.page,
                title: sbRow.title,
                description: sbRow.description || '',
                uploadedBy: sbRow.uploaded_by || '',
                createdAt: sbRow.created_at,
                updatedAt: sbRow.updated_at,
              };
              fetchedMediaIdsRef.current.add(id);
              if (isMountedRef.current) mergeMediaAssets([sbAsset]);
              void putCachedMediaAsset(sbAsset);
              return false;
            }
          }

          if (supabasePrimaryActive) {
            return false;
          }

          const snap = await getDoc(doc(db, 'media_assets', id));
          if (snap.exists()) {
            const asset: MediaAsset = { ...(snap.data() as MediaAsset), id: snap.id };
            fetchedMediaIdsRef.current.add(id);
            if (isMountedRef.current) mergeMediaAssets([asset]);
            void putCachedMediaAsset(asset);
          } else if (!snap.metadata.fromCache) {
            // Confirmed absent on server; avoid repeated reads for a deleted asset
            fetchedMediaIdsRef.current.add(id);
          }
          return false;
        } catch (err) {
          if (isQuotaExceededError(err)) {
            lastQuotaErrorAtRef.current = Date.now();
            listenerFailedRef.current = true;
            if (isMountedRef.current) setQuotaExceeded(true);
            return true;
          }
          // Transient error: do NOT add to fetchedMediaIdsRef so recovery/navigation can retry automatically
          listenerFailedRef.current = true;
          console.error(`Erro ao carregar imagem ${id}:`, err);
          return false;
        } finally {
          inflightMediaIdsRef.current.delete(id);
        }
      });
    };

    void fetchMissingMedia();
  }, [
    cacheHydrated,
    quotaExceeded,
    listenerEpoch,
    referencedMediaIds,
    supabaseSchemaReady,
    supabasePrimaryActive,
    mergeMediaAssets,
  ]);

  // Admin-only lazy loader for the complete media_assets library (Acervo / library picker)
  const loadFullMediaLibrary = useCallback(
    async (force = false) => {
      if (!isAdmin || loadingMediaLibrary) return;
      if (!force && fullLibraryLoadedRef.current) return;

      setLoadingMediaLibrary(true);
      try {
        if (supabaseSchemaReady) {
          const sbItems = await fetchSupabaseMediaAssets();
          const liveIds = new Set(sbItems.map((item) => item.id));
          sbItems.forEach((asset) => fetchedMediaIdsRef.current.add(asset.id));
          if (isMountedRef.current) {
            setMediaAssets((prev) => {
              const legacyBackupOnly = prev.filter(
                (item) => item.source !== 'supabase' && !liveIds.has(item.id)
              );
              return [...sbItems, ...legacyBackupOnly];
            });
          }
          if (sbItems.length > 0) {
            void putCachedMediaAssets(sbItems);
          }
        }

        if (!supabasePrimaryActive && !quotaExceeded) {
          const snap = await getDocs(collection(db, 'media_assets'));
          const items = snap.docs.map((d) => ({ ...(d.data() as MediaAsset), id: d.id }));
          items.forEach((asset) => fetchedMediaIdsRef.current.add(asset.id));
          if (isMountedRef.current) mergeMediaAssets(items);
          void putCachedMediaAssets(items);
        }
        fullLibraryLoadedRef.current = true;
      } catch (err) {
        if (isQuotaExceededError(err)) {
          lastQuotaErrorAtRef.current = Date.now();
          listenerFailedRef.current = true;
          setQuotaExceeded(true);
        }
        console.error('Erro ao carregar acervo completo de mídia:', err);
      } finally {
        if (isMountedRef.current) setLoadingMediaLibrary(false);
      }
    },
    [isAdmin, loadingMediaLibrary, quotaExceeded, supabaseSchemaReady, mergeMediaAssets]
  );

  const mediaMap = useMemo(() => {
    const map: Record<string, MediaAsset> = {};
    mediaAssets.forEach((asset) => {
      map[asset.id] = asset;
    });
    return map;
  }, [mediaAssets]);

  const resolveMediaUrl = useCallback(
    (urlOrRef?: string): string => {
      if (!urlOrRef) return '';
      if (urlOrRef.startsWith('/src/assets/images/')) return '';
      if (urlOrRef.startsWith('media://')) {
        const assetId = urlOrRef.slice('media://'.length);
        const asset = mediaMap[assetId];
        return asset?.publicUrl || asset?.dataUrl || '';
      }
      return urlOrRef;
    },
    [mediaMap]
  );

  const slots = useMemo(() => {
    return DEFAULT_PORTAL_SLOTS.map((defaultSlot) =>
      customSlots[defaultSlot.id] ? { ...defaultSlot, ...customSlots[defaultSlot.id] } : defaultSlot
    );
  }, [customSlots]);

  const slotsMap = useMemo(() => {
    const map: Record<string, PortalSlot> = {};
    slots.forEach((s) => {
      map[s.id] = s;
    });
    return map;
  }, [slots]);

  const logoUrl = useMemo(() => {
    const raw = slotsMap['logo_official']?.imageUrl || OFFICIAL_EMBLEM_URL;
    return resolveMediaUrl(raw) || OFFICIAL_EMBLEM_URL;
  }, [slotsMap, resolveMediaUrl]);

  // Always preserve exact 6 official ranks in strict hierarchical order (1..6)
  const hierarchy = useMemo(() => {
    return DEFAULT_HIERARCHY_NODES.map((officialRank) => {
      const saved = dbHierarchyMap[officialRank.id];
      return saved
        ? {
            ...officialRank,
            ...saved,
            id: officialRank.id,
            tier: officialRank.tier,
            positionCode: officialRank.positionCode,
          }
        : officialRank;
    });
  }, [dbHierarchyMap]);

  // Backward-compatible automatic migration: if an admin previously registered a single member/photo
  // on hierarchy_nodes/{rankId}, atomically migrate it into hierarchy_members without losing any data.
  useEffect(() => {
    if (!isAdmin || !auth.currentUser || !membersLoaded) return;
    const uid = auth.currentUser.uid;
    const candidates = DEFAULT_HIERARCHY_NODES.filter((officialRank) => {
      if (migratedRanksRef.current.has(officialRank.id)) return false;
      const saved = dbHierarchyMap[officialRank.id];
      if (!saved) return false;
      const hasLegacyData = Boolean(
        (saved.memberName && saved.memberName.trim().length > 0) ||
          (saved.photoUrl && saved.photoUrl.trim().length > 0)
      );
      return hasLegacyData;
    });

    if (candidates.length === 0) return;

    candidates.forEach((rank) => migratedRanksRef.current.add(rank.id));

    const runMigration = async () => {
      try {
        const batch = writeBatch(db);
        const existingMemberIds = new Set(dbMembers.map((m) => m.id));

        candidates.forEach((officialRank) => {
          const saved = dbHierarchyMap[officialRank.id];
          if (!saved) return;
          const migratedId = sanitizeId(`migrated_${officialRank.id}`);
          if (!existingMemberIds.has(migratedId)) {
            const rankCount = dbMembers.filter((m) => m.rankId === officialRank.id).length;
            batch.set(doc(db, 'hierarchy_members', migratedId), {
              rankId: officialRank.id,
              name: (saved.memberName || '').trim().slice(0, 120) || officialRank.rankTitle,
              photoUrl: (saved.photoUrl || '').trim().slice(0, 2000),
              description: '',
              status: 'Ativo' as HierarchyMemberStatus,
              order: rankCount + 1,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
              updatedBy: uid,
            });
          }

          // Clear legacy single-member fields on the rank definition node so migration stays idempotent
          batch.set(doc(db, 'hierarchy_nodes', officialRank.id), {
            rankTitle: saved.rankTitle || officialRank.rankTitle,
            memberName: '',
            positionCode: officialRank.positionCode,
            tier: officialRank.tier,
            parentId: officialRank.parentId || '',
            responsibility: saved.responsibility || officialRank.responsibility,
            insigniaUrl: saved.insigniaUrl || '',
            photoUrl: '',
            order: officialRank.order,
            isDemo: false,
            updatedBy: uid,
            updatedAt: serverTimestamp(),
          });
        });

        await batch.commit();
      } catch (err) {
        console.error('Erro na migração compatível de integrantes da hierarquia:', err);
      }
    };

    void runMigration();
  }, [isAdmin, membersLoaded, dbHierarchyMap, dbMembers]);

  // Merge real dynamic members with any not-yet-migrated legacy single-member preview (for public visitors prior to admin login)
  const hierarchyMembers = useMemo(() => {
    const combined: HierarchyMember[] = [...dbMembers];
    const existingIds = new Set(combined.map((m) => m.id));

    DEFAULT_HIERARCHY_NODES.forEach((officialRank) => {
      const saved = dbHierarchyMap[officialRank.id];
      if (!saved) return;
      const migratedId = `migrated_${officialRank.id}`;
      const hasLegacyData = Boolean(
        (saved.memberName && saved.memberName.trim().length > 0) ||
          (saved.photoUrl && saved.photoUrl.trim().length > 0)
      );
      if (hasLegacyData && !existingIds.has(migratedId)) {
        combined.push({
          id: migratedId,
          rankId: officialRank.id,
          name: (saved.memberName || '').trim() || officialRank.rankTitle,
          photoUrl: saved.photoUrl || '',
          description: '',
          status: 'Ativo',
          order: 0,
          createdAt: saved.updatedAt,
          updatedAt: saved.updatedAt,
          isLegacyMigratedPreview: true,
        });
      }
    });

    const getMillis = (ts: unknown): number => {
      if (!ts) return 0;
      if (typeof ts === 'object' && ts !== null && 'toMillis' in ts) {
        return Number((ts as { toMillis: () => number }).toMillis()) || 0;
      }
      return 0;
    };

    return combined.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return getMillis(a.createdAt) - getMillis(b.createdAt);
    });
  }, [dbMembers, dbHierarchyMap]);

  const membersByRank = useMemo(() => {
    const grouped: Record<HierarchyRankId, HierarchyMember[]> = {
      rank_coronel: [],
      rank_capitao: [],
      rank_sargento: [],
      rank_cabo: [],
      rank_soldado: [],
      rank_recruta: [],
    };
    hierarchyMembers.forEach((member) => {
      if (grouped[member.rankId]) {
        grouped[member.rankId].push(member);
      }
    });
    return grouped;
  }, [hierarchyMembers]);

  const roles = dbRoles ?? DEFAULT_ROLES;
  const operations = dbOperations ?? DEFAULT_OPERATIONS;
  const gallery = dbGallery ?? DEFAULT_GALLERY_ITEMS;

  const signInAdmin = useCallback(async () => {
    setAuthError(null);
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const signedEmail = result.user.email?.toLowerCase();
      const isBootstrap =
        Boolean(result.user.emailVerified) && signedEmail === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();
      let hasAdminDoc = false;
      if (!isBootstrap) {
        try {
          const snap = await getDoc(doc(db, 'admins', result.user.uid));
          hasAdminDoc = snap.exists();
        } catch {
          hasAdminDoc = false;
        }
      }
      if (!isBootstrap && !hasAdminDoc) {
        setAuthError(
          `A conta ${result.user.email || ''} não possui autorização administrativa para a 1.F.M.O.T.`
        );
      } else {
        showToast('Acesso administrativo autenticado.', 'success');
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Falha na autenticação com Google.';
      setAuthError(message);
    }
  }, [showToast]);

  const signInSupabaseAdmin = useCallback(
    async (email: string, password: string) => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        throw new Error('Supabase não está configurado neste ambiente.');
      }
      const cleanEmail = email.trim();
      if (!cleanEmail || !password) {
        throw new Error('Informe e-mail e senha da conta administrativa no Supabase.');
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });
      if (error || !data.user) {
        throw new Error(error?.message || 'Falha ao autenticar no Supabase.');
      }
      if (!data.user.email_confirmed_at) {
        await supabase.auth.signOut();
        setSupabaseAdminUserId(null);
        setSupabaseAdminEmail(null);
        throw new Error('Confirme o e-mail da conta no Supabase antes de continuar.');
      }
      const verifiedAdmin = await verifySupabaseAdminSession(supabase, data.user);
      if (!verifiedAdmin) {
        await supabase.auth.signOut();
        setSupabaseAdminUserId(null);
        setSupabaseAdminEmail(null);
        throw new Error(
          `A conta ${data.user.email || cleanEmail} não possui permissão administrativa na 1.F.M.O.T.`
        );
      }
      setSupabaseAdminUserId(data.user.id);
      setSupabaseAdminEmail(data.user.email || cleanEmail);
      await refreshSupabaseHealth();
      await hydrateFromSupabase();
      showToast('Sessão administrativa do Supabase conectada.', 'success');
    },
    [hydrateFromSupabase, refreshSupabaseHealth, showToast]
  );

  const signOutSupabaseAdmin = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSupabaseAdminUserId(null);
    setSupabaseAdminEmail(null);
    await refreshSupabaseHealth();
    showToast('Sessão do Supabase encerrada.', 'success');
  }, [refreshSupabaseHealth, showToast]);

  const inspectFirebaseMigration = useCallback(async (): Promise<MigrationInventory> => {
    if (!isAdmin) {
      throw new Error('Operação restrita a administradores autenticados.');
    }
    return inspectFirebaseMigrationSources();
  }, [isAdmin]);

  const runFirebaseToSupabaseMigration = useCallback(
    async (options?: RunMigrationOptions): Promise<MigrationReport> => {
      if (!isAdmin) {
        throw new Error('Operação restrita a administradores autenticados.');
      }
      const report = await migrateFirebaseMediaToSupabase(options);
      if (report.migratedAssets.length > 0) {
        report.migratedAssets.forEach((asset) => fetchedMediaIdsRef.current.add(asset.id));
        mergeMediaAssets(report.migratedAssets);
        void putCachedMediaAssets(report.migratedAssets);
      }
      await hydrateFromSupabase();
      await refreshSupabaseHealth();
      return report;
    },
    [hydrateFromSupabase, isAdmin, mergeMediaAssets, refreshSupabaseHealth]
  );

  const signOutAdmin = useCallback(async () => {
    await signOut(auth);
    const supabase = getSupabaseBrowserClient();
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSupabaseAdminUserId(null);
    setSupabaseAdminEmail(null);
    setEditMode(false);
    showToast('Sessão administrativa encerrada.', 'success');
  }, [showToast]);

  const requireAdminUid = (): string => {
    if (!isAdmin) {
      throw new Error('Operação restrita a administradores autenticados.');
    }
    const uid = supabaseAdminUserId || auth.currentUser?.uid;
    if (!uid) {
      throw new Error('Operação restrita a administradores autenticados.');
    }
    return uid;
  };

  const assertSupabaseWriteReady = (): void => {
    requireAdminUid();
    if (!supabaseSchemaReady) {
      throw new Error(
        'As tabelas do Supabase ainda não estão disponíveis para gravação. Verifique a conexão no painel.'
      );
    }
    if (!supabaseAdminUserId) {
      throw new Error(
        'Conecte sua sessão administrativa do Supabase (e-mail e senha) no topo do painel para enviar, substituir ou excluir imagens diretamente no bucket fmot-media.'
      );
    }
  };

  const ensureCollectionSeeded = async <T extends { id: string }>(
    collectionName: string,
    dbItems: T[] | null,
    defaults: T[],
    uid: string
  ) => {
    if (dbItems !== null) return;
    // Never seed defaults unless the server explicitly confirmed this collection is empty
    if (!serverLoadedKeysRef.current.has(collectionName)) return;
    const batch = writeBatch(db);
    defaults.forEach((item) => {
      const { id, ...rest } = item;
      const cleanId = sanitizeId(id);
      batch.set(doc(db, collectionName, cleanId), {
        ...rest,
        updatedBy: uid,
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  };

  const uploadMediaAsset = useCallback(
    async (
      optimized: OptimizedImageResult,
      meta: { page: ManagedPageKey; title: string; description?: string }
    ): Promise<{ assetId: string; refUrl: string; deduplicated?: boolean }> => {
      requireAdminUid();
      const assetId = sanitizeId(`img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      const cleanTitle = meta.title.trim().slice(0, 140) || optimized.fileName.slice(0, 140);
      const cleanDescription = (meta.description || '').trim().slice(0, 500);
      const cleanFileName = optimized.fileName.slice(0, 180);

      // Mandatory primary path when Supabase is configured: NEVER write new images to Firebase Firestore
      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        const blob = dataUrlToBlob(optimized.dataUrl, optimized.mimeType);

        // 1. Deduplication check via deterministic SHA-256 storage path
        const { storagePath: expectedPath } = await buildDeduplicatedStoragePath(blob, {
          page: meta.page,
          fileName: cleanFileName,
          mimeType: optimized.mimeType,
        });

        const existingAsset = await findSupabaseMediaAssetByStoragePath(expectedPath);
        if (existingAsset?.publicUrl) {
          try {
            await verifySupabasePublicImageUrl(existingAsset.publicUrl);
            fetchedMediaIdsRef.current.add(existingAsset.id);
            mergeMediaAssets([existingAsset]);
            setSupabasePrimaryActive(true);
            return {
              assetId: existingAsset.id,
              refUrl: existingAsset.publicUrl,
              deduplicated: true,
            };
          } catch {
            // File missing in Storage — proceed to fresh upload below
          }
        }

        // 2. Real upload to bucket `fmot-media` + public HTTP verification
        const uploaded = await uploadImageToSupabaseStorage(blob, {
          page: meta.page,
          fileName: cleanFileName,
          mimeType: optimized.mimeType,
        });

        // 3. Persist metadata & public URL in PostgreSQL `public.media_assets` (rollback Storage on DB error)
        try {
          const savedAsset = await upsertSupabaseMediaAsset({
            id: existingAsset?.id || assetId,
            fileName: cleanFileName,
            mimeType: uploaded.mimeType,
            storagePath: uploaded.storagePath,
            publicUrl: uploaded.publicUrl,
            width: optimized.width,
            height: optimized.height,
            sizeBytes: uploaded.sizeBytes,
            page: meta.page,
            title: cleanTitle,
            description: cleanDescription,
          });
          fetchedMediaIdsRef.current.add(savedAsset.id);
          mergeMediaAssets([savedAsset]);
          setSupabasePrimaryActive(true);
          void putCachedMediaAsset(savedAsset);
          return { assetId: savedAsset.id, refUrl: savedAsset.publicUrl || uploaded.publicUrl };
        } catch (dbErr) {
          try {
            await deleteImageFromSupabaseStorage(uploaded.storagePath);
          } catch {
            // Ignore rollback cleanup failure
          }
          throw dbErr;
        }
      }

      throw new Error('Supabase não está configurado neste ambiente para envio de imagens.');
    },
    [isAdmin, mergeMediaAssets, supabaseAdminUserId, supabaseSchemaReady]
  );

  const replaceMediaAsset = useCallback(
    async (
      assetId: string,
      optimized: OptimizedImageResult,
      meta?: { title?: string; description?: string }
    ): Promise<{ assetId: string; refUrl: string }> => {
      assertSupabaseWriteReady();
      const target = mediaAssets.find((item) => item.id === assetId);
      if (!target) {
        throw new Error('Imagem não encontrada no acervo do Supabase.');
      }
      if (target.source !== 'supabase' && !target.storagePath) {
        throw new Error(
          'Esta imagem pertence ao backup original do Firebase. Envie uma nova imagem no Supabase para preservar o backup intacto.'
        );
      }

      const oldStoragePath = target.storagePath || '';
      const oldPublicUrl = target.publicUrl || target.dataUrl || '';
      const cleanFileName = optimized.fileName.slice(0, 180);
      const cleanTitle = (meta?.title ?? target.title).trim().slice(0, 140) || cleanFileName;
      const cleanDescription = (meta?.description ?? target.description ?? '').trim().slice(0, 500);

      const blob = dataUrlToBlob(optimized.dataUrl, optimized.mimeType);
      const uploaded = await uploadImageToSupabaseStorage(blob, {
        page: target.page,
        fileName: cleanFileName,
        mimeType: optimized.mimeType,
      });

      const savedAsset = await upsertSupabaseMediaAsset({
        id: assetId,
        fileName: cleanFileName,
        mimeType: uploaded.mimeType,
        storagePath: uploaded.storagePath,
        publicUrl: uploaded.publicUrl,
        width: optimized.width,
        height: optimized.height,
        sizeBytes: uploaded.sizeBytes,
        page: target.page,
        title: cleanTitle,
        description: cleanDescription,
      });

      // Update any slots / hierarchy / roles / operations / gallery referencing the replaced URL
      if (oldPublicUrl && oldPublicUrl !== uploaded.publicUrl) {
        await updateSupabaseReferencesUrl(oldPublicUrl, uploaded.publicUrl, assetId);
      }

      // Remove previous object from `fmot-media` if path changed and no other row uses it
      if (oldStoragePath && oldStoragePath !== uploaded.storagePath) {
        const stillReferenced = mediaAssets.some(
          (item) => item.id !== assetId && item.storagePath === oldStoragePath
        );
        if (!stillReferenced) {
          try {
            await deleteImageFromSupabaseStorage(oldStoragePath);
          } catch {
            // Non-fatal cleanup error
          }
        }
      }

      fetchedMediaIdsRef.current.add(savedAsset.id);
      mergeMediaAssets([savedAsset]);
      void putCachedMediaAsset(savedAsset);
      await hydrateFromSupabase();
      showToast('Imagem substituída no Supabase Storage (fmot-media) e atualizada no site.', 'success');
      return { assetId: savedAsset.id, refUrl: uploaded.publicUrl };
    },
    [
      hydrateFromSupabase,
      isAdmin,
      mediaAssets,
      mergeMediaAssets,
      showToast,
      supabaseAdminUserId,
      supabaseSchemaReady,
    ]
  );

  const deleteMediaAsset = useCallback(
    async (assetId: string) => {
      assertSupabaseWriteReady();
      const target = mediaAssets.find((item) => item.id === assetId);

      if (target && target.source !== 'supabase' && !target.storagePath) {
        throw new Error(
          'Esta imagem pertence ao backup preservado do Firebase e não pode ser apagada por aqui.'
        );
      }

      if (target?.storagePath) {
        const sharedByAnotherRow = mediaAssets.some(
          (item) => item.id !== assetId && item.storagePath === target.storagePath
        );
        if (!sharedByAnotherRow) {
          await deleteImageFromSupabaseStorage(target.storagePath);
        }
      }

      await deleteSupabaseMediaAssetRow(assetId);
      fetchedMediaIdsRef.current.delete(assetId);
      setMediaAssets((prev) => prev.filter((item) => item.id !== assetId));
      void deleteCachedMediaAsset(assetId);
      showToast('Imagem excluída permanentemente do Supabase Storage (fmot-media).', 'success');
    },
    [isAdmin, mediaAssets, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const savePortalSlot = useCallback(
    async (slot: PortalSlot) => {
      const uid = requireAdminUid();
      const slotId = sanitizeId(slot.id);
      const normalizedSlot: PortalSlot = {
        ...slot,
        id: slotId,
        label: slot.label.trim().slice(0, 120),
        title: slot.title.trim().slice(0, 160),
        description: (slot.description || '').trim().slice(0, 600),
        imageUrl: slot.imageUrl.trim().slice(0, 2000),
        mediaAssetId: (slot.mediaAssetId || '').slice(0, 128),
        isCover: Boolean(slot.isCover),
      };

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        await upsertSupabasePortalSlot(normalizedSlot);
        setSupabasePrimaryActive(true);
        setCustomSlots((prev) => {
          const next = { ...prev, [slotId]: normalizedSlot };
          void putCachedSnapshot('portal_slots', next);
          return next;
        });
        showToast('Imagem publicada e salva permanentemente no Supabase.', 'success');
        return;
      }

      const path = `portal_slots/${slotId}`;
      try {
        await setDoc(doc(db, 'portal_slots', slotId), {
          page: normalizedSlot.page,
          label: normalizedSlot.label,
          title: normalizedSlot.title,
          description: normalizedSlot.description || '',
          imageUrl: normalizedSlot.imageUrl,
          mediaAssetId: normalizedSlot.mediaAssetId || '',
          isCover: Boolean(normalizedSlot.isCover),
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        });
        showToast('Imagem publicada e salva permanentemente.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const resetPortalSlot = useCallback(
    async (slotId: string) => {
      requireAdminUid();
      const cleanId = sanitizeId(slotId);

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        await deleteSupabasePortalSlot(cleanId);
        setCustomSlots((prev) => {
          const next = { ...prev };
          delete next[cleanId];
          if (Object.keys(next).length > 0) {
            void putCachedSnapshot('portal_slots', next);
          } else {
            void deleteCachedSnapshot('portal_slots');
          }
          return next;
        });
        showToast('Espaço restaurado ao estado padrão no Supabase.', 'success');
        return;
      }

      const path = `portal_slots/${cleanId}`;
      try {
        await deleteDoc(doc(db, 'portal_slots', cleanId));
        showToast('Espaço restaurado ao estado padrão.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const savePortalConfig = useCallback(
    async (nextConfig: PortalConfig) => {
      const uid = requireAdminUid();

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        await upsertSupabasePortalConfig(nextConfig);
        setSupabasePrimaryActive(true);
        setConfig(nextConfig);
        void putCachedSnapshot('portal_config', nextConfig);
        showToast('Conteúdo institucional publicado com sucesso no Supabase.', 'success');
        return;
      }

      const path = 'portal_config/main';
      try {
        await setDoc(doc(db, 'portal_config', 'main'), {
          heroHeadline: nextConfig.heroHeadline.trim().slice(0, 240),
          heroSubtext: nextConfig.heroSubtext.trim().slice(0, 1200),
          aboutIntro: nextConfig.aboutIntro.trim().slice(0, 3000),
          aboutOperationsText: nextConfig.aboutOperationsText.trim().slice(0, 2000),
          aboutDifferentiator: nextConfig.aboutDifferentiator.trim().slice(0, 600),
          aboutIdentityText: nextConfig.aboutIdentityText.trim().slice(0, 2000),
          aboutValues: nextConfig.aboutValues.slice(0, 8),
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        });
        showToast('Conteúdo institucional publicado com sucesso.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  // Each of the 6 ranks saves independently to its own document ID (rank_coronel..rank_recruta)
  const saveHierarchyNode = useCallback(
    async (node: HierarchyNode) => {
      const uid = requireAdminUid();
      const nodeId = sanitizeId(node.id) as HierarchyRankId;

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        await upsertSupabaseHierarchyNode({ ...node, id: nodeId });
        setSupabasePrimaryActive(true);
        setDbHierarchyMap((prev) => {
          const next = { ...prev, [nodeId]: { ...node, id: nodeId } };
          void putCachedSnapshot('hierarchy_nodes', next);
          return next;
        });
        showToast(`Alterações da patente ${node.rankTitle} salvas permanentemente no Supabase.`, 'success');
        return;
      }

      const path = `hierarchy_nodes/${nodeId}`;
      try {
        await setDoc(doc(db, 'hierarchy_nodes', nodeId), {
          rankTitle: node.rankTitle.trim().slice(0, 120),
          memberName: (node.memberName || '').trim().slice(0, 120),
          positionCode: node.positionCode.trim().slice(0, 60),
          tier: Math.min(6, Math.max(1, Number(node.tier) || 1)),
          parentId: (node.parentId || '').slice(0, 128),
          responsibility: node.responsibility.trim().slice(0, 1000),
          insigniaUrl: (node.insigniaUrl || '').slice(0, 2000),
          photoUrl: (node.photoUrl || '').slice(0, 2000),
          order: Math.max(0, Math.min(1000, Number(node.order) || 1)),
          isDemo: Boolean(node.isDemo),
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        });
        showToast(`Alterações da patente ${node.rankTitle} salvas permanentemente.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const deleteHierarchyNode = useCallback(
    async (nodeId: string) => {
      requireAdminUid();

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        await deleteSupabaseHierarchyNode(nodeId as HierarchyRankId);
        setSupabasePrimaryActive(true);
        setDbHierarchyMap((prev) => {
          const next = { ...prev };
          delete next[nodeId];
          if (Object.keys(next).length > 0) {
            void putCachedSnapshot('hierarchy_nodes', next);
          } else {
            void deleteCachedSnapshot('hierarchy_nodes');
          }
          return next;
        });
        showToast('Personalização da patente restaurada ao padrão oficial.', 'success');
        return;
      }

      const path = `hierarchy_nodes/${nodeId}`;
      try {
        await deleteDoc(doc(db, 'hierarchy_nodes', nodeId));
        showToast('Personalização da patente restaurada ao padrão oficial.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const addHierarchyMember = useCallback(
    async (input: {
      rankId: HierarchyRankId;
      name: string;
      photoUrl: string;
      description: string;
      status: HierarchyMemberStatus;
    }): Promise<string> => {
      const uid = requireAdminUid();
      const cleanName = input.name.trim().slice(0, 120);
      if (!cleanName) {
        throw new Error('Informe o nome do integrante.');
      }
      const memberId = sanitizeId(`mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      const existingInRank = membersByRank[input.rankId] || [];
      const maxOrder = existingInRank.reduce((acc, m) => Math.max(acc, m.order || 0), 0);
      const nextOrder = Math.min(100000, maxOrder + 1);

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        const newMember: HierarchyMember = {
          id: memberId,
          rankId: input.rankId,
          name: cleanName,
          photoUrl: (input.photoUrl || '').trim().slice(0, 2000),
          description: (input.description || '').trim().slice(0, 800),
          status: input.status || 'Ativo',
          order: nextOrder,
        };
        await upsertSupabaseHierarchyMember(newMember);
        setSupabasePrimaryActive(true);
        setDbMembers((prev) => {
          const next = [...prev, newMember];
          void putCachedSnapshot('hierarchy_members', next);
          return next;
        });
        showToast(`Integrante "${cleanName}" adicionado com sucesso no Supabase.`, 'success');
        return memberId;
      }

      const path = `hierarchy_members/${memberId}`;
      try {
        await setDoc(doc(db, 'hierarchy_members', memberId), {
          rankId: input.rankId,
          name: cleanName,
          photoUrl: (input.photoUrl || '').trim().slice(0, 2000),
          description: (input.description || '').trim().slice(0, 800),
          status: input.status || 'Ativo',
          order: nextOrder,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        });
        showToast(`Integrante "${cleanName}" adicionado com sucesso.`, 'success');
        return memberId;
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [isAdmin, membersByRank, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const updateHierarchyMember = useCallback(
    async (
      memberId: string,
      patch: {
        rankId: HierarchyRankId;
        name: string;
        photoUrl: string;
        description: string;
        status: HierarchyMemberStatus;
        order?: number;
      }
    ) => {
      const uid = requireAdminUid();
      const cleanId = sanitizeId(memberId);
      const cleanName = patch.name.trim().slice(0, 120);
      if (!cleanName) {
        throw new Error('Informe o nome do integrante.');
      }
      const existingMember = dbMembers.find((m) => m.id === cleanId);
      const rankChanged = existingMember && existingMember.rankId !== patch.rankId;
      let nextOrder =
        typeof patch.order === 'number'
          ? patch.order
          : existingMember
            ? existingMember.order
            : 1;

      if (rankChanged) {
        const targetList = membersByRank[patch.rankId] || [];
        const maxOrder = targetList.reduce((acc, m) => Math.max(acc, m.order || 0), 0);
        nextOrder = Math.min(100000, maxOrder + 1);
      }

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        const updated: HierarchyMember = {
          id: cleanId,
          rankId: patch.rankId,
          name: cleanName,
          photoUrl: (patch.photoUrl || '').trim().slice(0, 2000),
          description: (patch.description || '').trim().slice(0, 800),
          status: patch.status || 'Ativo',
          order: Math.max(0, Math.min(100000, Number(nextOrder) || 0)),
        };
        await upsertSupabaseHierarchyMember(updated);
        setSupabasePrimaryActive(true);
        setDbMembers((prev) => {
          const exists = prev.some((m) => m.id === cleanId);
          const next = exists ? prev.map((m) => (m.id === cleanId ? updated : m)) : [...prev, updated];
          void putCachedSnapshot('hierarchy_members', next);
          return next;
        });
        showToast(
          rankChanged
            ? `Integrante "${cleanName}" atualizado e transferido de patente no Supabase.`
            : `Cadastro de "${cleanName}" salvo permanentemente no Supabase.`,
          'success'
        );
        return;
      }

      const path = `hierarchy_members/${cleanId}`;
      try {
        if (existingMember) {
          await updateDoc(doc(db, 'hierarchy_members', cleanId), {
            rankId: patch.rankId,
            name: cleanName,
            photoUrl: (patch.photoUrl || '').trim().slice(0, 2000),
            description: (patch.description || '').trim().slice(0, 800),
            status: patch.status || 'Ativo',
            order: Math.max(0, Math.min(100000, Number(nextOrder) || 0)),
            updatedAt: serverTimestamp(),
            updatedBy: uid,
          });
        } else {
          await setDoc(doc(db, 'hierarchy_members', cleanId), {
            rankId: patch.rankId,
            name: cleanName,
            photoUrl: (patch.photoUrl || '').trim().slice(0, 2000),
            description: (patch.description || '').trim().slice(0, 800),
            status: patch.status || 'Ativo',
            order: Math.max(0, Math.min(100000, Number(nextOrder) || 1)),
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            updatedBy: uid,
          });
        }
        showToast(
          rankChanged
            ? `Integrante "${cleanName}" atualizado e transferido de patente.`
            : `Cadastro de "${cleanName}" salvo permanentemente.`,
          'success'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [dbMembers, isAdmin, membersByRank, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const transferHierarchyMember = useCallback(
    async (memberId: string, targetRankId: HierarchyRankId) => {
      const uid = requireAdminUid();
      const cleanId = sanitizeId(memberId);
      const member = hierarchyMembers.find((m) => m.id === cleanId);
      if (!member || member.rankId === targetRankId) return;

      const targetList = membersByRank[targetRankId] || [];
      const maxOrder = targetList.reduce((acc, m) => Math.max(acc, m.order || 0), 0);
      const targetRankTitle =
        DEFAULT_HIERARCHY_NODES.find((r) => r.id === targetRankId)?.rankTitle || targetRankId;
      const nextOrder = Math.min(100000, maxOrder + 1);

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        const updated: HierarchyMember = {
          ...member,
          rankId: targetRankId,
          order: nextOrder,
        };
        await upsertSupabaseHierarchyMember(updated);
        setSupabasePrimaryActive(true);
        setDbMembers((prev) => {
          const next = prev.map((m) => (m.id === cleanId ? updated : m));
          void putCachedSnapshot('hierarchy_members', next);
          return next;
        });
        showToast(`"${member.name}" transferido para a patente ${targetRankTitle}.`, 'success');
        return;
      }

      const path = `hierarchy_members/${cleanId}`;
      try {
        await updateDoc(doc(db, 'hierarchy_members', cleanId), {
          rankId: targetRankId,
          order: nextOrder,
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        });
        showToast(`"${member.name}" transferido para a patente ${targetRankTitle}.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [hierarchyMembers, isAdmin, membersByRank, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const reorderRankMembers = useCallback(
    async (_rankId: HierarchyRankId, orderedMembers: HierarchyMember[]) => {
      const uid = requireAdminUid();

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        await Promise.all(
          orderedMembers.map((member, idx) =>
            upsertSupabaseHierarchyMember({
              ...member,
              id: sanitizeId(member.id),
              order: idx + 1,
            })
          )
        );
        setSupabasePrimaryActive(true);
        const orderById = new Map<string, number>();
        orderedMembers.forEach((m, idx) => orderById.set(sanitizeId(m.id), idx + 1));
        setDbMembers((prev) => {
          const next = prev.map((m) =>
            orderById.has(m.id) ? { ...m, order: orderById.get(m.id)! } : m
          );
          void putCachedSnapshot('hierarchy_members', next);
          return next;
        });
        showToast('Ordem dos integrantes atualizada no Supabase.', 'success');
        return;
      }

      try {
        const batch = writeBatch(db);
        orderedMembers.forEach((member, idx) => {
          batch.update(doc(db, 'hierarchy_members', sanitizeId(member.id)), {
            order: idx + 1,
            updatedAt: serverTimestamp(),
            updatedBy: uid,
          });
        });
        await batch.commit();
        showToast('Ordem dos integrantes atualizada.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, 'hierarchy_members');
      }
    },
    [isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const deleteHierarchyMember = useCallback(
    async (memberId: string) => {
      requireAdminUid();
      const cleanId = sanitizeId(memberId);

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        await deleteSupabaseHierarchyMember(cleanId);
        setSupabasePrimaryActive(true);
        setDbMembers((prev) => {
          const next = prev.filter((m) => m.id !== cleanId);
          if (next.length > 0) {
            void putCachedSnapshot('hierarchy_members', next);
          } else {
            void deleteCachedSnapshot('hierarchy_members');
          }
          return next;
        });
        showToast('Integrante excluído permanentemente da hierarquia no Supabase.', 'success');
        return;
      }

      const path = `hierarchy_members/${cleanId}`;
      try {
        await deleteDoc(doc(db, 'hierarchy_members', cleanId));
        showToast('Integrante excluído permanentemente da hierarquia.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const saveRoleSpecialty = useCallback(
    async (role: RoleSpecialty) => {
      const uid = requireAdminUid();
      const roleId = sanitizeId(role.id || `role_${Date.now()}`);

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        const currentList = dbRoles ?? DEFAULT_ROLES;
        if (dbRoles === null) {
          await Promise.all(DEFAULT_ROLES.map((item) => upsertSupabaseRole(item)));
        }
        const savedRole: RoleSpecialty = { ...role, id: roleId };
        await upsertSupabaseRole(savedRole);
        setSupabasePrimaryActive(true);
        const nextList = [
          ...currentList.filter((r) => r.id !== roleId),
          savedRole,
        ].sort((a, b) => a.order - b.order);
        setDbRoles(nextList);
        void putCachedSnapshot('roles_catalog', nextList);
        showToast('Função operacional salva com sucesso no Supabase.', 'success');
        return;
      }

      await ensureCollectionSeeded('roles_catalog', dbRoles, DEFAULT_ROLES, uid);
      const path = `roles_catalog/${roleId}`;
      try {
        await setDoc(doc(db, 'roles_catalog', roleId), {
          name: role.name.trim().slice(0, 120),
          category: role.category.trim().slice(0, 80),
          iconName: (role.iconName || 'Shield').slice(0, 60),
          imageUrl: (role.imageUrl || '').slice(0, 2000),
          description: role.description.trim().slice(0, 1000),
          responsibilities: role.responsibilities
            .map((r) => r.trim().slice(0, 300))
            .filter(Boolean)
            .slice(0, 8),
          requirements: role.requirements
            .map((r) => r.trim().slice(0, 300))
            .filter(Boolean)
            .slice(0, 8),
          order: Math.max(0, Math.min(1000, Number(role.order) || 0)),
          isDemo: Boolean(role.isDemo),
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        });
        showToast('Função operacional salva com sucesso.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [dbRoles, isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const deleteRoleSpecialty = useCallback(
    async (roleId: string) => {
      const uid = requireAdminUid();

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        if (dbRoles === null) {
          await Promise.all(
            DEFAULT_ROLES.filter((r) => r.id !== roleId).map((item) => upsertSupabaseRole(item))
          );
        }
        await deleteSupabaseRole(roleId);
        setSupabasePrimaryActive(true);
        const nextList = (dbRoles ?? DEFAULT_ROLES).filter((r) => r.id !== roleId);
        setDbRoles(nextList);
        void putCachedSnapshot('roles_catalog', nextList);
        showToast('Função operacional removida no Supabase.', 'success');
        return;
      }

      await ensureCollectionSeeded('roles_catalog', dbRoles, DEFAULT_ROLES, uid);
      const path = `roles_catalog/${roleId}`;
      try {
        await deleteDoc(doc(db, 'roles_catalog', roleId));
        showToast('Função operacional removida.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [dbRoles, isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const saveOperationRecord = useCallback(
    async (op: OperationRecord) => {
      const uid = requireAdminUid();
      const opId = sanitizeId(op.id || `op_${Date.now()}`);

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        const currentList = dbOperations ?? DEFAULT_OPERATIONS;
        if (dbOperations === null) {
          await Promise.all(DEFAULT_OPERATIONS.map((item) => upsertSupabaseOperation(item)));
        }
        const savedOp: OperationRecord = { ...op, id: opId };
        await upsertSupabaseOperation(savedOp);
        setSupabasePrimaryActive(true);
        const nextList = [
          ...currentList.filter((o) => o.id !== opId),
          savedOp,
        ].sort((a, b) => a.order - b.order || b.date.localeCompare(a.date));
        setDbOperations(nextList);
        void putCachedSnapshot('operations_records', nextList);
        showToast('Registro de operação salvo com sucesso no Supabase.', 'success');
        return;
      }

      await ensureCollectionSeeded('operations_records', dbOperations, DEFAULT_OPERATIONS, uid);
      const path = `operations_records/${opId}`;
      try {
        await setDoc(doc(db, 'operations_records', opId), {
          title: op.title.trim().slice(0, 160),
          category: op.category.trim().slice(0, 80),
          date: (op.date || '').trim().slice(0, 40),
          summary: op.summary.trim().slice(0, 600),
          details: op.details.trim().slice(0, 4000),
          results: (op.results || '').trim().slice(0, 1200),
          coverImageUrl: (op.coverImageUrl || '').trim().slice(0, 2000),
          galleryUrls: (op.galleryUrls || [])
            .map((u) => u.trim().slice(0, 300))
            .filter(Boolean)
            .slice(0, 6),
          featured: Boolean(op.featured),
          isDemo: Boolean(op.isDemo),
          order: Math.max(0, Math.min(1000, Number(op.order) || 0)),
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        });
        showToast('Registro de operação salvo com sucesso.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [dbOperations, isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const deleteOperationRecord = useCallback(
    async (opId: string) => {
      const uid = requireAdminUid();

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        if (dbOperations === null) {
          await Promise.all(
            DEFAULT_OPERATIONS.filter((o) => o.id !== opId).map((item) =>
              upsertSupabaseOperation(item)
            )
          );
        }
        await deleteSupabaseOperation(opId);
        setSupabasePrimaryActive(true);
        const nextList = (dbOperations ?? DEFAULT_OPERATIONS).filter((o) => o.id !== opId);
        setDbOperations(nextList);
        void putCachedSnapshot('operations_records', nextList);
        showToast('Registro de operação removido no Supabase.', 'success');
        return;
      }

      await ensureCollectionSeeded('operations_records', dbOperations, DEFAULT_OPERATIONS, uid);
      const path = `operations_records/${opId}`;
      try {
        await deleteDoc(doc(db, 'operations_records', opId));
        showToast('Registro de operação removido.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [dbOperations, isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const saveGalleryItem = useCallback(
    async (item: GalleryItem) => {
      const uid = requireAdminUid();
      const itemId = sanitizeId(
        item.id || `gal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      );

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        const currentList = dbGallery ?? DEFAULT_GALLERY_ITEMS;
        if (dbGallery === null) {
          await Promise.all(DEFAULT_GALLERY_ITEMS.map((g) => upsertSupabaseGalleryItem(g)));
        }
        const savedItem: GalleryItem = { ...item, id: itemId };
        await upsertSupabaseGalleryItem(savedItem);
        setSupabasePrimaryActive(true);
        const nextList = [
          ...currentList.filter((g) => g.id !== itemId),
          savedItem,
        ].sort((a, b) => a.order - b.order);
        setDbGallery(nextList);
        void putCachedSnapshot('gallery_items', nextList);
        showToast('Fotografia salva na galeria no Supabase.', 'success');
        return;
      }

      await ensureCollectionSeeded('gallery_items', dbGallery, DEFAULT_GALLERY_ITEMS, uid);
      const path = `gallery_items/${itemId}`;
      try {
        await setDoc(doc(db, 'gallery_items', itemId), {
          title: item.title.trim().slice(0, 140),
          description: (item.description || '').trim().slice(0, 500),
          category: item.category.trim().slice(0, 80),
          date: (item.date || '').trim().slice(0, 40),
          imageUrl: (item.imageUrl || '').trim().slice(0, 2000),
          isCover: Boolean(item.isCover),
          order: Math.max(0, Math.min(1000, Number(item.order) || 0)),
          isDemo: Boolean(item.isDemo),
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        });
        showToast('Fotografia salva na galeria.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [dbGallery, isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const deleteGalleryItem = useCallback(
    async (itemId: string) => {
      const uid = requireAdminUid();

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        if (dbGallery === null) {
          await Promise.all(
            DEFAULT_GALLERY_ITEMS.filter((g) => g.id !== itemId).map((g) =>
              upsertSupabaseGalleryItem(g)
            )
          );
        }
        await deleteSupabaseGalleryItem(itemId);
        setSupabasePrimaryActive(true);
        const nextList = (dbGallery ?? DEFAULT_GALLERY_ITEMS).filter((g) => g.id !== itemId);
        setDbGallery(nextList);
        void putCachedSnapshot('gallery_items', nextList);
        showToast('Item removido da galeria no Supabase.', 'success');
        return;
      }

      await ensureCollectionSeeded('gallery_items', dbGallery, DEFAULT_GALLERY_ITEMS, uid);
      const path = `gallery_items/${itemId}`;
      try {
        await deleteDoc(doc(db, 'gallery_items', itemId));
        showToast('Item removido da galeria.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [dbGallery, isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const reorderGalleryItems = useCallback(
    async (orderedItems: GalleryItem[]) => {
      const uid = requireAdminUid();

      if (isSupabaseConfigured()) {
        assertSupabaseWriteReady();
        const updated = orderedItems.map((item, idx) => ({
          ...item,
          id: sanitizeId(item.id),
          order: idx + 1,
        }));
        await Promise.all(updated.map((item) => upsertSupabaseGalleryItem(item)));
        setSupabasePrimaryActive(true);
        setDbGallery(updated);
        void putCachedSnapshot('gallery_items', updated);
        showToast('Ordem de exibição da galeria atualizada no Supabase.', 'success');
        return;
      }

      await ensureCollectionSeeded('gallery_items', dbGallery, DEFAULT_GALLERY_ITEMS, uid);
      try {
        const batch = writeBatch(db);
        orderedItems.forEach((item, index) => {
          batch.set(doc(db, 'gallery_items', sanitizeId(item.id)), {
            title: item.title.trim().slice(0, 140),
            description: (item.description || '').trim().slice(0, 500),
            category: item.category.trim().slice(0, 80),
            date: (item.date || '').trim().slice(0, 40),
            imageUrl: (item.imageUrl || '').trim().slice(0, 2000),
            isCover: Boolean(item.isCover),
            order: index + 1,
            isDemo: Boolean(item.isDemo),
            updatedBy: uid,
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
        showToast('Ordem de exibição da galeria atualizada.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, 'gallery_items');
      }
    },
    [dbGallery, isAdmin, showToast, supabaseAdminUserId, supabaseSchemaReady]
  );

  const openQuickImageEditor = useCallback((target: QuickImageTarget) => {
    setQuickImageTarget(target);
  }, []);

  const closeQuickImageEditor = useCallback(() => {
    setQuickImageTarget(null);
  }, []);

  const value: PortalContextValue = {
    activeTab,
    setActiveTab,
    selectedOperationId,
    setSelectedOperationId,
    user,
    authReady,
    isAdmin,
    authError,
    signInAdmin,
    signOutAdmin,
    editMode,
    setEditMode,
    quickImageTarget,
    openQuickImageEditor,
    closeQuickImageEditor,
    config,
    slots,
    slotsMap,
    logoUrl,
    mediaAssets,
    hierarchy,
    hierarchyMembers,
    membersByRank,
    roles,
    operations,
    gallery,
    loadingData,
    loadingMediaLibrary,
    quotaExceeded,
    quotaUpgradeUrl: FIRESTORE_QUOTA_UPGRADE_URL,
    loadFullMediaLibrary,
    supabaseHealth,
    supabaseAdminEmail,
    supabaseReadyForWrites,
    supabasePrimaryActive,
    refreshSupabaseHealth,
    signInSupabaseAdmin,
    signOutSupabaseAdmin,
    inspectFirebaseMigration,
    runFirebaseToSupabaseMigration,
    resolveMediaUrl,
    uploadMediaAsset,
    replaceMediaAsset,
    deleteMediaAsset,
    savePortalSlot,
    resetPortalSlot,
    savePortalConfig,
    saveHierarchyNode,
    deleteHierarchyNode,
    addHierarchyMember,
    updateHierarchyMember,
    transferHierarchyMember,
    reorderRankMembers,
    deleteHierarchyMember,
    saveRoleSpecialty,
    deleteRoleSpecialty,
    saveOperationRecord,
    deleteOperationRecord,
    saveGalleryItem,
    deleteGalleryItem,
    reorderGalleryItems,
    toastMessage,
    showToast,
  };

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
};

export function usePortal(): PortalContextValue {
  const ctx = useContext(PortalContext);
  if (!ctx) {
    throw new Error('usePortal deve ser utilizado dentro de PortalProvider.');
  }
  return ctx;
}
