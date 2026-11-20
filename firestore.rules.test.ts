/**
 * Security Rules Specification Verification Matrix — 1.F.M.O.T Portal
 * Verifies the "Dirty Dozen" payloads against Firestore Rules invariants.
 */

export interface DirtyDozenCase {
  id: number;
  name: string;
  collection: string;
  operation: 'create' | 'update' | 'delete' | 'get' | 'list';
  expected: 'PERMISSION_DENIED';
  payload?: Record<string, unknown>;
  reason: string;
}

export const DIRTY_DOZEN_PAYLOADS: DirtyDozenCase[] = [
  {
    id: 1,
    name: 'Unauthenticated hierarchy member create',
    collection: 'hierarchy_members/mem_anon_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      rankId: 'rank_coronel',
      name: 'Invasor',
      photoUrl: '',
      description: '',
      status: 'Ativo',
      order: 1,
    },
    reason: 'Requires verified admin authentication.',
  },
  {
    id: 2,
    name: 'Unverified bootstrap admin email spoof',
    collection: 'hierarchy_members/mem_spoof_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'isBootstrapAdmin requires request.auth.token.email_verified == true.',
  },
  {
    id: 3,
    name: 'Shadow field injection on hierarchy_members',
    collection: 'hierarchy_members/mem_shadow_1',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      rankId: 'rank_capitao',
      name: 'Operador',
      photoUrl: '',
      description: '',
      status: 'Ativo',
      order: 1,
      isSuperAdmin: true,
    },
    reason: 'Blocked by data.keys().hasOnly(...) in isValidHierarchyMember.',
  },
  {
    id: 4,
    name: 'Invalid rankId outside 6 official ranks',
    collection: 'hierarchy_members/mem_bad_rank',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      rankId: 'rank_general',
      name: 'Operador',
      photoUrl: '',
      description: '',
      status: 'Ativo',
      order: 1,
    },
    reason: 'Blocked by isValidRankId allowlist.',
  },
  {
    id: 5,
    name: 'Invalid status enum poisoning',
    collection: 'hierarchy_members/mem_bad_status',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      rankId: 'rank_sargento',
      name: 'Operador',
      photoUrl: '',
      description: '',
      status: 'INVALID_STATUS',
      order: 1,
    },
    reason: 'Blocked by status enum check in isValidHierarchyMember.',
  },
  {
    id: 6,
    name: 'Oversized member name (>120 chars)',
    collection: 'hierarchy_members/mem_long_name',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      rankId: 'rank_cabo',
      name: 'A'.repeat(150),
      photoUrl: '',
      description: '',
      status: 'Ativo',
      order: 1,
    },
    reason: 'Blocked by isValidString(data.name, 1, 120).',
  },
  {
    id: 7,
    name: 'Immortal createdAt tampering on update',
    collection: 'hierarchy_members/mem_existing_1',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    reason: 'Blocked by incoming().createdAt == existing().createdAt.',
  },
  {
    id: 8,
    name: 'Forged updatedBy UID',
    collection: 'hierarchy_members/mem_forged_uid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    payload: {
      rankId: 'rank_soldado',
      name: 'Operador',
      photoUrl: '',
      description: '',
      status: 'Ativo',
      order: 1,
      updatedBy: 'forged_uid_123',
    },
    reason: 'Blocked by data.updatedBy == request.auth.uid.',
  },
  {
    id: 9,
    name: 'Client-forged updatedAt timestamp',
    collection: 'hierarchy_members/mem_bad_time',
    operation: 'update',
    expected: 'PERMISSION_DENIED',
    reason: 'Blocked by data.updatedAt == request.time.',
  },
  {
    id: 10,
    name: 'Document ID poisoning (>128 chars or invalid chars)',
    collection: 'hierarchy_members/' + 'x'.repeat(200),
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'Blocked by isValidId(memberId).',
  },
  {
    id: 11,
    name: 'Non-admin self-escalation on /admins',
    collection: 'admins/attacker_uid',
    operation: 'create',
    expected: 'PERMISSION_DENIED',
    reason: 'Blocked by isBootstrapAdmin() requirement on /admins.',
  },
  {
    id: 12,
    name: 'Non-admin PII list scraping on /admins',
    collection: 'admins',
    operation: 'list',
    expected: 'PERMISSION_DENIED',
    reason: 'Blocked by allow list: if isBootstrapAdmin().',
  },
];
