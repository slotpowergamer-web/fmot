import {
  GalleryItem,
  HierarchyMember,
  HierarchyNode,
  OperationRecord,
  PortalSlot,
  PortalTab,
  RoleSpecialty,
} from '../types/portal';

export function extractMediaId(url?: string): string | null {
  if (!url || !url.startsWith('media://')) return null;
  const id = url.slice('media://'.length).trim();
  return id.length > 0 ? id : null;
}

export interface TabMediaSources {
  activeTab: PortalTab;
  selectedOperationId: string | null;
  customSlots: Record<string, PortalSlot>;
  dbHierarchyMap: Record<string, HierarchyNode>;
  dbMembers: HierarchyMember[];
  dbRoles: RoleSpecialty[] | null;
  dbOperations: OperationRecord[] | null;
  dbGallery: GalleryItem[] | null;
}

/**
 * Returns ONLY the media://<assetId> IDs required to render the currently active tab,
 * plus the global official logo shown in TopNav and PortalFooter.
 */
export function collectMediaIdsForTab(sources: TabMediaSources): string[] {
  const ids = new Set<string>();
  const addRef = (ref?: string) => {
    const id = extractMediaId(ref);
    if (id) ids.add(id);
  };

  // Global logo is displayed on every page (TopNav + PortalFooter)
  addRef(sources.customSlots['logo_official']?.imageUrl);

  switch (sources.activeTab) {
    case 'inicio': {
      Object.values(sources.customSlots).forEach((slot) => {
        if (slot.page === 'inicio' || slot.page === 'identidade') {
          addRef(slot.imageUrl);
        }
      });
      break;
    }
    case 'quem_somos': {
      Object.values(sources.customSlots).forEach((slot) => {
        if (slot.page === 'quem_somos') {
          addRef(slot.imageUrl);
        }
      });
      break;
    }
    case 'hierarquia': {
      Object.values(sources.dbHierarchyMap).forEach((node) => {
        addRef(node.photoUrl);
        addRef(node.insigniaUrl);
      });
      sources.dbMembers.forEach((member) => addRef(member.photoUrl));
      break;
    }
    case 'funcoes': {
      (sources.dbRoles || []).forEach((role) => addRef(role.imageUrl));
      break;
    }
    case 'operacoes': {
      (sources.dbOperations || []).forEach((op) => {
        addRef(op.coverImageUrl);
        if (!sources.selectedOperationId || op.id === sources.selectedOperationId) {
          (op.galleryUrls || []).forEach(addRef);
        }
      });
      break;
    }
    case 'galeria': {
      (sources.dbGallery || []).forEach((item) => addRef(item.imageUrl));
      break;
    }
    case 'admin': {
      Object.values(sources.customSlots).forEach((slot) => addRef(slot.imageUrl));
      Object.values(sources.dbHierarchyMap).forEach((node) => {
        addRef(node.photoUrl);
        addRef(node.insigniaUrl);
      });
      sources.dbMembers.forEach((member) => addRef(member.photoUrl));
      (sources.dbRoles || []).forEach((role) => addRef(role.imageUrl));
      (sources.dbOperations || []).forEach((op) => {
        addRef(op.coverImageUrl);
        (op.galleryUrls || []).forEach(addRef);
      });
      (sources.dbGallery || []).forEach((item) => addRef(item.imageUrl));
      break;
    }
  }

  return Array.from(ids);
}

/**
 * Executes async tasks with bounded concurrency so page images load fast
 * without issuing unbounded parallel reads.
 */
export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<boolean | void>
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  let stopped = false;

  const runner = async () => {
    while (!stopped) {
      const currentIndex = index;
      index += 1;
      if (currentIndex >= items.length) return;
      const shouldStop = await worker(items[currentIndex]);
      if (shouldStop === true) {
        stopped = true;
        return;
      }
    }
  };

  const workers = Array.from({ length: Math.min(Math.max(1, concurrency), items.length) }, () =>
    runner()
  );
  await Promise.all(workers);
}
