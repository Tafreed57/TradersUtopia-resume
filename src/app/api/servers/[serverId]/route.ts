import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { ServerService } from '@/services/database/server-service';
import { apiLogger } from '@/lib/enhanced-logger';
import { validateInput, serverUpdateSchema } from '@/lib/validation';
import { ValidationError } from '@/lib/error-handling';
import { revalidatePath } from 'next/cache';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

/**
 * Get Server
 * Retrieve server data with member access validation
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const serverId = new URL(req.url).pathname.split('/').pop();

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  const serverService = new ServerService();

  // Get server with member access validation
  const server = await serverService.findServerWithMemberAccess(
    serverId,
    user.id
  );

  if (!server) {
    return NextResponse.json(
      { error: 'Server not found or access denied' },
      { status: 404 }
    );
  }

  apiLogger.databaseOperation('server_retrieved_via_api', true, {
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
    serverName: server.name,
  });

  return NextResponse.json(server);
}, authHelpers.userOnly('GET_SERVER'));

/**
 * Update Server
 * Admin/Owner-only operation
 */
export const PATCH = withAuth(async (req: NextRequest, { user }) => {
  const { params } = await req.json();
  const serverId =
    params?.serverId || new URL(req.url).pathname.split('/').pop();

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  const serverService = new ServerService();

  // Step 1: Input validation
  const validationResult = await validateInput(serverUpdateSchema)(req);
  if (!validationResult.success) {
    throw new ValidationError('Invalid server update data');
  }

  const { name, imageUrl } = validationResult.data;

  // Step 2: Update server using service layer (includes permission checking)
  const updatedServer = await serverService.updateServer(
    serverId,
    { name, imageUrl },
    user.id
  );

  // Step 3: Revalidate cache
  revalidatePath(`/servers/${serverId}`, 'layout');

  apiLogger.databaseOperation('server_updated_via_api', true, {
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
    updatedFields: Object.keys({ name, imageUrl }).filter(
      key => (key === 'name' && name) || (key === 'imageUrl' && imageUrl)
    ),
  });

  return NextResponse.json(updatedServer);
}, authHelpers.userOnly('UPDATE_SERVER'));

/**
 * Delete Server
 * Owner/Global Admin-only operation
 */
export const DELETE = withAuth(async (req: NextRequest, { user, isAdmin }) => {
  const serverId = new URL(req.url).pathname.split('/').pop();

  if (!serverId) {
    throw new ValidationError('Server ID is required');
  }

  const serverService = new ServerService();

  // Step 1: Delete server using service layer (includes ownership verification)
  const deletedServer = await serverService.deleteServer(serverId, user.id);

  // Step 2: Revalidate cache
  revalidatePath('/(main)', 'layout');

  apiLogger.databaseOperation('server_deleted_via_api', true, {
    serverId: serverId.substring(0, 8) + '***',
    userId: user.id.substring(0, 8) + '***',
    serverName: deletedServer.name,
    isGlobalAdmin: isAdmin,
  });

  return NextResponse.json(deletedServer);
}, authHelpers.userOnly('DELETE_SERVER'));
