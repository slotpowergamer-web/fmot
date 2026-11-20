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
  googleProvider,
  handleFirestoreError,
  OperationType,
} from '../firebase';
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
import { OptimizedImageResult } from '../utils/imageOptimizer';

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

  resolveMediaUrl: (urlOrRef?: string) => string;

  uploadMediaAsset: (
    optimized: OptimizedImageResult,
    meta: { page: ManagedPageKey; title: string; description?: string }
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

export const PortalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activeTab, setActiveTabState] = useState<PortalTab>('inicio');
  const [selectedOperationId, setSelectedOperationId] = useState<string | null>(null);

  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

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
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

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

  // Auth Listener & Admin Verification
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setAuthError(null);
      if (!currentUser) {
        setIsAdmin(false);
        setEditMode(false);
        setAuthReady(true);
        return;
      }

      const isBootstrap =
        Boolean(currentUser.emailVerified) &&
        currentUser.email?.toLowerCase() === BOOTSTRAP_ADMIN_EMAIL.toLowerCase();

      if (isBootstrap) {
        setIsAdmin(true);
        setAuthReady(true);
        return;
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
        setIsAdmin(Boolean(currentUser.emailVerified) && adminSnap.exists());
      } catch {
        setIsAdmin(false);
      } finally {
        setAuthReady(true);
      }
    });
    return () => unsubscribe();
  }, []);

  // Public institutional listeners
  useEffect(() => {
    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (loadedCount >= 3) setLoadingData(false);
    };

    const unsubConfig = onSnapshot(
      doc(db, 'portal_config', 'main'),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as Partial<PortalConfig>;
          setConfig({
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
          });
        } else {
          setConfig(DEFAULT_PORTAL_CONFIG);
        }
        markLoaded();
      },
      (err) => {
        console.error('Erro ao ler portal_config:', err);
        markLoaded();
      }
    );

    const unsubSlots = onSnapshot(
      collection(db, 'portal_slots'),
      (snap) => {
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
        markLoaded();
      },
      (err) => {
        console.error('Erro ao ler portal_slots:', err);
        markLoaded();
      }
    );

    const unsubMedia = onSnapshot(
      collection(db, 'media_assets'),
      (snap) => {
        const items = snap.docs.map((d) => ({ ...(d.data() as MediaAsset), id: d.id }));
        setMediaAssets(items);
        markLoaded();
      },
      (err) => {
        console.error('Erro ao ler media_assets:', err);
        markLoaded();
      }
    );

    const unsubHierarchy = onSnapshot(
      collection(db, 'hierarchy_nodes'),
      (snap) => {
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
      },
      (err) => console.error('Erro ao ler hierarchy_nodes:', err)
    );

    const unsubHierarchyMembers = onSnapshot(
      collection(db, 'hierarchy_members'),
      (snap) => {
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
        setMembersLoaded(true);
      },
      (err) => {
        console.error('Erro ao ler hierarchy_members:', err);
        setMembersLoaded(true);
      }
    );

    const unsubRoles = onSnapshot(
      collection(db, 'roles_catalog'),
      (snap) => {
        if (snap.empty) {
          setDbRoles(null);
        } else {
          const items = snap.docs
            .map((d) => {
              const raw = d.data() as RoleSpecialty;
              return { ...raw, id: d.id, imageUrl: sanitizeMediaRef(raw.imageUrl) };
            })
            .sort((a, b) => a.order - b.order);
          setDbRoles(items);
        }
      },
      (err) => console.error('Erro ao ler roles_catalog:', err)
    );

    const unsubOps = onSnapshot(
      collection(db, 'operations_records'),
      (snap) => {
        if (snap.empty) {
          setDbOperations(null);
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
        }
      },
      (err) => console.error('Erro ao ler operations_records:', err)
    );

    const unsubGallery = onSnapshot(
      collection(db, 'gallery_items'),
      (snap) => {
        if (snap.empty) {
          setDbGallery(null);
        } else {
          const items = snap.docs
            .map((d) => {
              const raw = d.data() as GalleryItem;
              return { ...raw, id: d.id, imageUrl: sanitizeMediaRef(raw.imageUrl) };
            })
            .sort((a, b) => a.order - b.order);
          setDbGallery(items);
        }
      },
      (err) => console.error('Erro ao ler gallery_items:', err)
    );

    return () => {
      unsubConfig();
      unsubSlots();
      unsubMedia();
      unsubHierarchy();
      unsubHierarchyMembers();
      unsubRoles();
      unsubOps();
      unsubGallery();
    };
  }, []);

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
        return mediaMap[assetId]?.dataUrl || '';
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

  const signOutAdmin = useCallback(async () => {
    await signOut(auth);
    setEditMode(false);
    showToast('Sessão administrativa encerrada.', 'success');
  }, [showToast]);

  const requireAdminUid = (): string => {
    if (!auth.currentUser || !isAdmin) {
      throw new Error('Operação restrita a administradores autenticados.');
    }
    return auth.currentUser.uid;
  };

  const ensureCollectionSeeded = async <T extends { id: string }>(
    collectionName: string,
    dbItems: T[] | null,
    defaults: T[],
    uid: string
  ) => {
    if (dbItems !== null) return;
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
    ) => {
      const uid = requireAdminUid();
      const assetId = sanitizeId(`img_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
      const path = `media_assets/${assetId}`;
      try {
        await setDoc(doc(db, 'media_assets', assetId), {
          fileName: optimized.fileName.slice(0, 180),
          mimeType: optimized.mimeType,
          dataUrl: optimized.dataUrl,
          width: optimized.width,
          height: optimized.height,
          sizeBytes: optimized.sizeBytes,
          page: meta.page,
          title: meta.title.trim().slice(0, 140) || optimized.fileName.slice(0, 140),
          description: (meta.description || '').trim().slice(0, 500),
          uploadedBy: uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        return { assetId, refUrl: `media://${assetId}` };
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    },
    [isAdmin]
  );

  const deleteMediaAsset = useCallback(
    async (assetId: string) => {
      requireAdminUid();
      const path = `media_assets/${assetId}`;
      try {
        await deleteDoc(doc(db, 'media_assets', assetId));
        showToast('Imagem removida do repositório persistente.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isAdmin, showToast]
  );

  const savePortalSlot = useCallback(
    async (slot: PortalSlot) => {
      const uid = requireAdminUid();
      const slotId = sanitizeId(slot.id);
      const path = `portal_slots/${slotId}`;
      try {
        await setDoc(doc(db, 'portal_slots', slotId), {
          page: slot.page,
          label: slot.label.trim().slice(0, 120),
          title: slot.title.trim().slice(0, 160),
          description: (slot.description || '').trim().slice(0, 600),
          imageUrl: slot.imageUrl.trim().slice(0, 2000),
          mediaAssetId: (slot.mediaAssetId || '').slice(0, 128),
          isCover: Boolean(slot.isCover),
          updatedBy: uid,
          updatedAt: serverTimestamp(),
        });
        showToast('Imagem publicada e salva permanentemente.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
      }
    },
    [isAdmin, showToast]
  );

  const resetPortalSlot = useCallback(
    async (slotId: string) => {
      requireAdminUid();
      const cleanId = sanitizeId(slotId);
      const path = `portal_slots/${cleanId}`;
      try {
        await deleteDoc(doc(db, 'portal_slots', cleanId));
        showToast('Espaço restaurado ao estado padrão.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isAdmin, showToast]
  );

  const savePortalConfig = useCallback(
    async (nextConfig: PortalConfig) => {
      const uid = requireAdminUid();
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
    [isAdmin, showToast]
  );

  // Each of the 6 ranks saves independently to its own document ID (rank_coronel..rank_recruta)
  const saveHierarchyNode = useCallback(
    async (node: HierarchyNode) => {
      const uid = requireAdminUid();
      const nodeId = sanitizeId(node.id);
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
    [isAdmin, showToast]
  );

  const deleteHierarchyNode = useCallback(
    async (nodeId: string) => {
      requireAdminUid();
      const path = `hierarchy_nodes/${nodeId}`;
      try {
        await deleteDoc(doc(db, 'hierarchy_nodes', nodeId));
        showToast('Personalização da patente restaurada ao padrão oficial.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isAdmin, showToast]
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
      const path = `hierarchy_members/${memberId}`;
      try {
        await setDoc(doc(db, 'hierarchy_members', memberId), {
          rankId: input.rankId,
          name: cleanName,
          photoUrl: (input.photoUrl || '').trim().slice(0, 2000),
          description: (input.description || '').trim().slice(0, 800),
          status: input.status || 'Ativo',
          order: Math.min(100000, maxOrder + 1),
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
    [isAdmin, membersByRank, showToast]
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
    [dbMembers, isAdmin, membersByRank, showToast]
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
      const path = `hierarchy_members/${cleanId}`;

      try {
        await updateDoc(doc(db, 'hierarchy_members', cleanId), {
          rankId: targetRankId,
          order: Math.min(100000, maxOrder + 1),
          updatedAt: serverTimestamp(),
          updatedBy: uid,
        });
        showToast(`"${member.name}" transferido para a patente ${targetRankTitle}.`, 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    },
    [hierarchyMembers, isAdmin, membersByRank, showToast]
  );

  const reorderRankMembers = useCallback(
    async (_rankId: HierarchyRankId, orderedMembers: HierarchyMember[]) => {
      const uid = requireAdminUid();
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
    [isAdmin, showToast]
  );

  const deleteHierarchyMember = useCallback(
    async (memberId: string) => {
      requireAdminUid();
      const cleanId = sanitizeId(memberId);
      const path = `hierarchy_members/${cleanId}`;
      try {
        await deleteDoc(doc(db, 'hierarchy_members', cleanId));
        showToast('Integrante excluído permanentemente da hierarquia.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [isAdmin, showToast]
  );

  const saveRoleSpecialty = useCallback(
    async (role: RoleSpecialty) => {
      const uid = requireAdminUid();
      await ensureCollectionSeeded('roles_catalog', dbRoles, DEFAULT_ROLES, uid);
      const roleId = sanitizeId(role.id || `role_${Date.now()}`);
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
    [dbRoles, isAdmin, showToast]
  );

  const deleteRoleSpecialty = useCallback(
    async (roleId: string) => {
      const uid = requireAdminUid();
      await ensureCollectionSeeded('roles_catalog', dbRoles, DEFAULT_ROLES, uid);
      const path = `roles_catalog/${roleId}`;
      try {
        await deleteDoc(doc(db, 'roles_catalog', roleId));
        showToast('Função operacional removida.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [dbRoles, isAdmin, showToast]
  );

  const saveOperationRecord = useCallback(
    async (op: OperationRecord) => {
      const uid = requireAdminUid();
      await ensureCollectionSeeded('operations_records', dbOperations, DEFAULT_OPERATIONS, uid);
      const opId = sanitizeId(op.id || `op_${Date.now()}`);
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
    [dbOperations, isAdmin, showToast]
  );

  const deleteOperationRecord = useCallback(
    async (opId: string) => {
      const uid = requireAdminUid();
      await ensureCollectionSeeded('operations_records', dbOperations, DEFAULT_OPERATIONS, uid);
      const path = `operations_records/${opId}`;
      try {
        await deleteDoc(doc(db, 'operations_records', opId));
        showToast('Registro de operação removido.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [dbOperations, isAdmin, showToast]
  );

  const saveGalleryItem = useCallback(
    async (item: GalleryItem) => {
      const uid = requireAdminUid();
      await ensureCollectionSeeded('gallery_items', dbGallery, DEFAULT_GALLERY_ITEMS, uid);
      const itemId = sanitizeId(
        item.id || `gal_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      );
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
    [dbGallery, isAdmin, showToast]
  );

  const deleteGalleryItem = useCallback(
    async (itemId: string) => {
      const uid = requireAdminUid();
      await ensureCollectionSeeded('gallery_items', dbGallery, DEFAULT_GALLERY_ITEMS, uid);
      const path = `gallery_items/${itemId}`;
      try {
        await deleteDoc(doc(db, 'gallery_items', itemId));
        showToast('Item removido da galeria.', 'success');
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, path);
      }
    },
    [dbGallery, isAdmin, showToast]
  );

  const reorderGalleryItems = useCallback(
    async (orderedItems: GalleryItem[]) => {
      const uid = requireAdminUid();
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
    [dbGallery, isAdmin, showToast]
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
    resolveMediaUrl,
    uploadMediaAsset,
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
