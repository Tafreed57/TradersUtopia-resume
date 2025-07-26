# Ticket 1.2: Database Schema Migration Planning
**Priority:** HIGH | **Effort:** 2 days | **Risk:** Medium

## Description
Plan and prepare the database schema migration from current Profile-based system to improved User + Subscription model with role-based access control.

## Acceptance Criteria
- [ ] Create comprehensive migration script for Profile → User + Subscription
- [ ] Map all existing fields to new schema structure  
- [ ] Create rollback procedures
- [ ] Test migration on staging database copy
- [ ] Validate data integrity after migration

### Documentation Requirements
- [ ] Create detailed ER diagrams for current vs. new schema in `docs/database/migration-plan.md`
- [ ] Document migration steps with visual flow diagrams
- [ ] Create rollback procedure documentation with step-by-step instructions

### Testing Requirements
- [ ] **Migration Tests**: Validate schema changes work correctly
- [ ] **Data Integrity Tests**: Ensure no data loss during migration
- [ ] **Rollback Tests**: Verify rollback procedures work as documented
- [ ] **Performance Tests**: Compare query performance before/after migration

## Implementation Details
```sql
-- Migration steps:
-- 1. Create new tables (User, Subscription, Role, etc.)
-- 2. Migrate Profile data to User (userId field change from clerkId)
-- 3. Extract subscription data to dedicated Subscription model
-- 4. Create default roles (premium, free) for each server
-- 5. Migrate Member data with role assignments
-- 6. Drop old models (Profile, Conversation, DirectMessage)

-- Key mapping changes:
-- Profile.userId → User.userId (field rename)
-- Profile subscription fields → Subscription model (data extraction)
-- Member.profileId → Member.userId (relationship update)
```

## Files Affected
- `prisma/schema.prisma` - New schema definition
- `prisma/migrations/` - Migration files
- New migration script in `scripts/migrate-database.ts`

## Dependencies
None - this is foundational

## Notes
- Backup production data before migration
- Test extensively in staging environment
- Migration must be atomic and reversible 