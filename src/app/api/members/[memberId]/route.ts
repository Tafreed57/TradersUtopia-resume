import { prisma } from "@/lib/prismadb";
import { getCurrentProfile } from "@/lib/query";
import { MemberRole } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { v4 as uuidv4 } from "uuid";
import { rateLimitServer, trackSuspiciousActivity } from "@/lib/rate-limit";
import { validateInput, memberRoleSchema, cuidSchema } from "@/lib/validation";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { memberId: string } },
) {
  try {
    // ✅ SECURITY: Rate limiting for member operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, "MEMBER_UPDATE_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Validate member ID parameter
    try {
      cuidSchema.parse(params.memberId);
    } catch (error) {
      trackSuspiciousActivity(req, "INVALID_MEMBER_ID_FORMAT");
      return NextResponse.json(
        { error: "Invalid member ID format" },
        { status: 400 },
      );
    }

    const profile = await getCurrentProfile();
    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get("serverId");

    // ✅ SECURITY: Validate server ID from query params
    if (!serverId) {
      trackSuspiciousActivity(req, "MISSING_SERVER_ID_MEMBER_UPDATE");
      return NextResponse.json(
        { error: "Server ID is required" },
        { status: 400 },
      );
    }

    try {
      cuidSchema.parse(serverId);
    } catch (error) {
      trackSuspiciousActivity(req, "INVALID_SERVER_ID_FORMAT_MEMBER");
      return NextResponse.json(
        { error: "Invalid server ID format" },
        { status: 400 },
      );
    }

    // ✅ SECURITY: Input validation for member role update
    const validationResult = await validateInput(memberRoleSchema)(req);
    if (!validationResult.success) {
      trackSuspiciousActivity(req, "INVALID_MEMBER_ROLE_INPUT");
      return validationResult.error;
    }

    const { role } = validationResult.data;
    if (!profile) {
      trackSuspiciousActivity(req, "UNAUTHENTICATED_MEMBER_UPDATE");
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (!params.memberId) {
      trackSuspiciousActivity(req, "MISSING_MEMBER_ID");
      return new NextResponse("Member not found", { status: 404 });
    }

    const server = await prisma.server.update({
      where: {
        id: serverId,
        profileId: profile.id,
      },
      data: {
        members: {
          update: {
            where: {
              id: params.memberId,
              profileId: {
                // To prevent the current login user to change their own role
                not: profile.id,
              },
            },
            data: {
              role,
            },
          },
        },
      },
      include: {
        members: {
          include: {
            profile: true,
          },
          orderBy: {
            role: "asc",
          },
        },
      },
    });

    // ✅ SECURITY: Log successful member role update
    console.log(
      `👥 [MEMBER] Role updated successfully by user: ${profile.email} (${profile.id})`,
    );
    console.log(
      `📝 [MEMBER] Member ID: ${params.memberId}, New role: ${role}, Server: ${serverId}`,
    );
    console.log(
      `📍 [MEMBER] IP: ${req.headers.get("x-forwarded-for") || "unknown"}`,
    );

    return NextResponse.json(server);
  } catch (error: any) {
    console.error("❌ [MEMBER] Member role update error:", error);
    trackSuspiciousActivity(req, "MEMBER_UPDATE_ERROR");

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        error: "Member update failed",
        message: "Unable to update member role. Please try again later.",
      },
      { status: 500 },
    );
  }
}
export async function DELETE(
  req: NextRequest,
  { params }: { params: { memberId: string } },
) {
  try {
    // ✅ SECURITY: Rate limiting for member operations
    const rateLimitResult = await rateLimitServer()(req);
    if (!rateLimitResult.success) {
      trackSuspiciousActivity(req, "MEMBER_DELETE_RATE_LIMIT_EXCEEDED");
      return rateLimitResult.error;
    }

    // ✅ SECURITY: Validate member ID parameter
    try {
      cuidSchema.parse(params.memberId);
    } catch (error) {
      trackSuspiciousActivity(req, "INVALID_MEMBER_ID_FORMAT_DELETE");
      return NextResponse.json(
        { error: "Invalid member ID format" },
        { status: 400 },
      );
    }

    const profile = await getCurrentProfile();
    const { searchParams } = new URL(req.url);
    const serverId = searchParams.get("serverId");

    // ✅ SECURITY: Validate server ID from query params
    if (!serverId) {
      trackSuspiciousActivity(req, "MISSING_SERVER_ID_MEMBER_DELETE");
      return NextResponse.json(
        { error: "Server ID is required" },
        { status: 400 },
      );
    }

    try {
      cuidSchema.parse(serverId);
    } catch (error) {
      trackSuspiciousActivity(req, "INVALID_SERVER_ID_FORMAT_MEMBER_DELETE");
      return NextResponse.json(
        { error: "Invalid server ID format" },
        { status: 400 },
      );
    }

    if (!profile) {
      trackSuspiciousActivity(req, "UNAUTHENTICATED_MEMBER_DELETE");
      return new NextResponse("Unauthorized", { status: 401 });
    }
    if (!params.memberId) {
      trackSuspiciousActivity(req, "MISSING_MEMBER_ID_DELETE");
      return new NextResponse("Member not found", { status: 404 });
    }

    const server = await prisma.server.update({
      where: {
        id: serverId,
        profileId: profile.id,
      },
      data: {
        members: {
          deleteMany: {
            id: params.memberId,
            profileId: {
              // admin's can't kick themselves
              not: profile.id,
            },
          },
        },
      },
      include: {
        members: {
          include: {
            profile: true,
          },
          orderBy: {
            role: "asc",
          },
        },
      },
    });

    // ✅ SECURITY: Log successful member deletion
    console.log(
      `🥾 [MEMBER] Member kicked successfully by user: ${profile.email} (${profile.id})`,
    );
    console.log(
      `📝 [MEMBER] Kicked member ID: ${params.memberId}, Server: ${serverId}`,
    );
    console.log(
      `📍 [MEMBER] IP: ${req.headers.get("x-forwarded-for") || "unknown"}`,
    );

    return NextResponse.json(server);
  } catch (error: any) {
    console.error("❌ [MEMBER] Member deletion error:", error);
    trackSuspiciousActivity(req, "MEMBER_DELETE_ERROR");

    // ✅ SECURITY: Generic error response - no internal details exposed
    return NextResponse.json(
      {
        error: "Member removal failed",
        message: "Unable to remove member. Please try again later.",
      },
      { status: 500 },
    );
  }
}
