import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { ServerService } from '@/services/database/server-service';

export const dynamic = 'force-dynamic';
/**
 * Get Default Server
 * Returns the default server information for authenticated users
 * Requires either admin privileges or active subscription
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const serverService = new ServerService();
  const server = await serverService.getDefaultServer();

  return NextResponse.json({
    serverId: server.id,
    landingChannelId: server.channels[0].id,
  });
}, authHelpers.subscriberOnly('get_default_server'));
