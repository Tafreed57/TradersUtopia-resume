import { NextRequest, NextResponse } from 'next/server';
import { withAuth, authHelpers } from '@/middleware/auth-middleware';
import { ServerService } from '@/services/database/server-service';

export const dynamic = 'force-dynamic';

/**
 * Get Servers
 * Returns either default server info or all user servers based on query param
 * Requires either admin privileges or active subscription
 */
export const GET = withAuth(async (req: NextRequest, { user }) => {
  const serverService = new ServerService();
  const url = new URL(req.url);
  const getAllServers = url.searchParams.get('all') === 'true';

  if (getAllServers) {
    // Return all servers user has access to
    const servers = await serverService.listServersForUser(user.id);
    return NextResponse.json(servers);
  } else {
    // Return default server information
    const server = await serverService.getDefaultServer();
    console.log('server', server);
    return NextResponse.json({
      serverId: server.id,
      landingChannelId: server.channels[0].id,
    });
  }
}, authHelpers.subscriberOnly('get_servers'));
