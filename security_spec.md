# Security Specification — 1.F.M.O.T Institutional Portal

## 1. Data Invariants
1. **Default-Deny Baseline**: Every unmapped Firestore path rejects reads and writes by default (`match /{document=**}`).
2. **Verified Admin-Only Mutations**: All writes to institutional collections (`portal_config`, `media_assets`, `portal_slots`, `hierarchy_nodes`, `hierarchy_members`, `roles_catalog`, `operations_records`, `gallery_items`) require `request.auth != null`, `request.auth.token.email_verified == true`, and membership in `/admins/{uid}` (or verified bootstrap admin `slotpowergamer@gmail.com`).
3. **Immutable Creation Timestamps**: `createdAt` on `admins`, `media_assets`, and `hierarchy_members` must equal `request.time` on `create` and must equal `existing().createdAt` on `update`.
4. **Strict Rank Membership (`hierarchy_members`)**: Every member document must reference one of the 6 official rank IDs (`rank_coronel`, `rank_capitao`, `rank_sargento`, `rank_cabo`, `rank_soldado`, `rank_recruta`), valid status (`Ativo`, `Em Capacitação`, `Afastado`, `Inativo`), non-empty name (`1..120`), bounded strings, numeric display order (`0..100000`), and exact allowed field whitelist (`hasAll` + `hasOnly`).
5. **PII Isolation**: `/admins/{userId}` contains administrator emails and is strictly restricted to self-get or bootstrap admin; public institutional collections contain zero PII (no emails, phones, or private credentials).
6. **Path ID & Size Hardening**: Every single-document path validates `isValidId()` (`^[a-zA-Z0-9_\-]+$`, `1..128` chars), and every string/list validates strict length caps.

## 2. The "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated member creation**: Anonymous client attempts `create` on `/hierarchy_members/mem_fake`.
2. **Unverified admin email spoof**: Token claims `email: "slotpowergamer@gmail.com"` with `email_verified: false`.
3. **Shadow field injection on `hierarchy_members`**: Authenticated admin sends `isSuperAdmin: true` alongside valid fields.
4. **Invalid rankId poisoning**: Admin attempts `rankId: "rank_general"` (outside the 6 official ranks).
5. **Invalid status poisoning**: Admin attempts `status: "BANIDO"` (outside the 4 allowed statuses).
6. **Oversized member name**: Admin sends a 150-character `name` string exceeding `maxLength: 120`.
7. **Immortal `createdAt` tampering**: Admin attempts to modify `createdAt` during an `update` on `/hierarchy_members/{memberId}`.
8. **Forged `updatedBy` UID**: Admin sets `updatedBy: "another_uid"` instead of `request.auth.uid`.
9. **Client-supplied `updatedAt` timestamp**: Admin submits a backdated client timestamp instead of `serverTimestamp()`.
10. **Document ID poisoning**: Admin attempts to write to `/hierarchy_members/../../admins/evil` or a 200-char ID.
11. **Non-admin privilege escalation**: Signed-in non-admin user attempts `create` on `/admins/{theirUid}`.
12. **PII blanket read on `/admins`**: Non-admin authenticated user attempts `list` on `/admins`.
