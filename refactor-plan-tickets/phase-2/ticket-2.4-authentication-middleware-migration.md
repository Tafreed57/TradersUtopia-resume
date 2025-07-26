# Ticket 2.4: Authentication Middleware Migration
**Priority:** HIGH | **Effort:** 3 days | **Risk:** Low

## Description
Migrate 15+ API routes to use the authentication middleware created in Phase 1, eliminating 300+ lines of duplicate security boilerplate while ensuring all security events are properly logged.

## Target Routes for Migration
```typescript
// Before: Every route has duplicate auth code
export async function POST(req: Request) {
  const csrfValid = await strictCSRFValidation(req);
  if (!csrfValid) {
    trackSuspiciousActivity(req, 'MESSAGE_CREATE_CSRF_FAILED');
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const rateLimitResult = await rateLimitGeneral()(req);
  if (!rateLimitResult.success) {
    trackSuspiciousActivity(req, 'MESSAGE_CREATE_RATE_LIMITED');
    return rateLimitResult.error;
  }

  const user = await currentUser();
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const profile = await db.profile.findFirst({
    where: { OR: [{ userId: user.id }] }
  });

  if (!profile?.isAdmin) {
    return NextResponse.json({ error: 'Admin required' }, { status: 403 });
  }

  // Actual logic here...
}

// After: Clean, focused handler
export const POST = withAuth(async (req, { user, userId, profile }) => {
  // Actual logic here - auth is guaranteed
  const { content, channelId } = await req.json();
  // ... business logic
}, { 
  action: 'MESSAGE_CREATE',
  requireAdmin: true 
});
```

## Migration Strategy
1. **High-Traffic Routes First:** Start with most used endpoints
2. **Batch Migration:** Migrate related routes together
3. **Testing:** Validate each migration maintains exact behavior
4. **Rollback Plan:** Keep original handlers as backup

## Routes to Migrate

### Batch 1: Message & Channel Routes
- `src/app/api/messages/route.ts` (admin required)
- `src/app/api/messages/[messageId]/route.ts` (admin required)
- `src/app/api/channels/route.ts` (user required)
- `src/app/api/channels/[channelId]/route.ts` (user required)
- `src/app/api/channels/reorder/route.ts` (admin required)

### Batch 2: Server Management Routes
- `src/app/api/servers/route.ts` (user required)
- `src/app/api/servers/[serverId]/route.ts` (user required)
- `src/app/api/servers/[serverId]/invite-code/route.ts` (admin required)
- `src/app/api/servers/[serverId]/leave/route.ts` (user required)

### Batch 3: Subscription Routes
- `src/app/api/subscription/cancel/route.ts` (user required)
- `src/app/api/subscription/toggle-autorenew/route.ts` (user required)
- `src/app/api/subscription/activate/route.ts` (user required)

### Batch 4: Admin Routes
- `src/app/api/admin/users/route.ts` (admin required)
- `src/app/api/admin/grant-access/route.ts` (admin required)
- `src/app/api/admin/revoke-access/route.ts` (admin required)

## Migration Example
```typescript
// Before migration - src/app/api/messages/route.ts
export async function POST(req: Request) {
  try {
    // ✅ SECURITY: CSRF and Rate limiting
    const csrfValid = await strictCSRFValidation(req);
    if (!csrfValid) {
      trackSuspiciousActivity(req, 'MESSAGE_CREATE_CSRF_FAILED');
      return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
    }

    const rateLimitResult = await rateLimitGeneral()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, 'MESSAGE_CREATE_RATE_LIMITED');
      return rateLimitResult.error;
    }

    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // ✅ SECURITY: Admin check
    const profile = await db.profile.findFirst({
      where: { OR: [{ userId: user.id }] }
    });

    if (!profile?.isAdmin) {
      trackSuspiciousActivity(req, 'MESSAGE_CREATE_ADMIN_REQUIRED');
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Actual business logic
    const { content, channelId } = await req.json();
    
    const channel = await db.channel.findFirst({
      where: {
        id: channelId,
        server: {
          members: {
            some: {
              profileId: profile.id,
            },
          },
        },
      },
    });

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    }

    const member = await db.member.findFirst({
      where: {
        profileId: profile.id,
        serverId: channel.serverId,
      },
    });

    if (!member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    const message = await db.message.create({
      data: {
        content,
        channelId,
        memberId: member.id,
      },
      include: {
        member: {
          include: {
            profile: true,
          },
        },
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error('❌ [MESSAGE_CREATE] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}

// After migration - using service layer and middleware
export const POST = withAuth(async (req, { userId }) => {
  const { content, channelId } = await req.json();
  
  // Use services instead of direct Prisma
  const channelService = new ChannelService();
  const profileService = new ProfileService();
  
  const profile = await profileService.findByUserIdOrEmail(userId);
  if (!profile) {
    throw new NotFoundError('Profile');
  }

  const channel = await channelService.findChannelWithMemberAccess(channelId, profile.id);
  if (!channel) {
    throw new NotFoundError('Channel');
  }

  const member = channel.server.members[0]; // Already filtered by access check

  const messageService = new MessageService();
  const message = await messageService.createMessage({
    content,
    channelId,
    memberId: member.id,
  });

  return NextResponse.json(message);
}, { 
  action: 'MESSAGE_CREATE',
  requireAdmin: true 
});
```

## Acceptance Criteria
- [ ] Migrate 15 API routes to use withAuth middleware
- [ ] Eliminate 300+ lines of duplicate authentication code
- [ ] Maintain exact same API behavior and error responses
- [ ] Add comprehensive tests for auth middleware edge cases
- [ ] Create migration guide for remaining routes

### Documentation Requirements
- [ ] Create middleware migration guide showing before/after patterns
- [ ] Document authentication security improvements in `docs/security/middleware-migration.md`
- [ ] Update API documentation with new authentication patterns

### Testing Requirements
- [ ] **Regression Tests**: Ensure all migrated endpoints work identically
- [ ] **Authentication Flow Tests**: Test all authentication scenarios
- [ ] **Security Tests**: Verify all security measures are properly applied
- [ ] **Performance Tests**: Confirm middleware doesn't degrade response times
- [ ] **API Compatibility Tests**: Ensure client code continues to work unchanged

## Testing Checklist
- [ ] Verify CSRF protection still works
- [ ] Confirm rate limiting is enforced
- [ ] Test admin-only routes properly reject non-admin users
- [ ] Validate suspicious activity tracking continues to work
- [ ] Ensure error responses match original format
- [ ] Test auth context provides correct user information

## Dependencies
- Ticket 1.3 (Authentication Middleware Implementation)
- Ticket 2.2 (Profile Service for user lookups)
- Ticket 1.1 (Logger Consolidation) 