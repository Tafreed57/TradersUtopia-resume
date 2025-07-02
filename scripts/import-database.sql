-- TRADERSUTOPIA Database Import Script
-- This script creates the database schema and imports data into the target database
-- Execute this script on the target database AFTER running the export script

-- =============================================================================
-- 1. CREATE ENUMS (must be created before tables)
-- =============================================================================

CREATE TYPE "SubscriptionStatus" AS ENUM ('FREE', 'ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ChannelType" AS ENUM ('TEXT', 'AUDIO', 'VIDEO');
CREATE TYPE "MemberRole" AS ENUM ('MODERATOR', 'GUEST', 'ADMIN');
CREATE TYPE "NotificationType" AS ENUM ('MESSAGE', 'MENTION', 'SERVER_UPDATE', 'FRIEND_REQUEST', 'SYSTEM', 'PAYMENT', 'SECURITY');

-- =============================================================================
-- 2. CREATE TABLES (in dependency order)
-- =============================================================================

-- Create Profile table first (no dependencies)
CREATE TABLE "Profile" (
    id TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    "stripeCustomerId" TEXT,
    "stripeSessionId" TEXT,
    "subscriptionEnd" TIMESTAMP WITHOUT TIME ZONE,
    "subscriptionStart" TIMESTAMP WITHOUT TIME ZONE,
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'FREE'::"SubscriptionStatus",
    "stripeProductId" TEXT,
    "backupCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "twoFactorSecret" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "emailNotifications" JSONB DEFAULT '{"system": true, "payment": true, "mentions": true, "messages": true, "security": true, "serverUpdates": false}'::jsonb,
    "pushNotifications" JSONB DEFAULT '{"system": true, "payment": true, "mentions": true, "messages": true, "security": true, "serverUpdates": false}'::jsonb,
    "pushSubscriptions" JSONB[] DEFAULT ARRAY[]::jsonb[]
);

-- Create Notification table
CREATE TABLE "Notification" (
    id TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    type "NotificationType" NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL
);

-- Create Server table (depends on Profile)
CREATE TABLE "Server" (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    "imageUrl" TEXT,
    "inviteCode" TEXT NOT NULL UNIQUE,
    "profileId" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    FOREIGN KEY ("profileId") REFERENCES "Profile"(id) ON DELETE CASCADE
);

-- Create Member table (depends on Profile and Server)
CREATE TABLE "Member" (
    id TEXT NOT NULL PRIMARY KEY,
    role "MemberRole" NOT NULL DEFAULT 'GUEST'::"MemberRole",
    "profileId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    FOREIGN KEY ("profileId") REFERENCES "Profile"(id) ON DELETE CASCADE,
    FOREIGN KEY ("serverId") REFERENCES "Server"(id) ON DELETE CASCADE
);

-- Create Channel table (depends on Profile and Server)
CREATE TABLE "Channel" (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    type "ChannelType" NOT NULL DEFAULT 'TEXT'::"ChannelType",
    "profileId" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    FOREIGN KEY ("profileId") REFERENCES "Profile"(id) ON DELETE CASCADE,
    FOREIGN KEY ("serverId") REFERENCES "Server"(id) ON DELETE CASCADE
);

-- Create Conversation table (depends on Member)
CREATE TABLE "Conversation" (
    id TEXT NOT NULL PRIMARY KEY,
    "memberOneId" TEXT NOT NULL,
    "memberTwoId" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    FOREIGN KEY ("memberOneId") REFERENCES "Member"(id) ON DELETE CASCADE,
    FOREIGN KEY ("memberTwoId") REFERENCES "Member"(id) ON DELETE CASCADE,
    UNIQUE ("memberOneId", "memberTwoId")
);

-- Create Message table (depends on Member and Channel)
CREATE TABLE "Message" (
    id TEXT NOT NULL PRIMARY KEY,
    content TEXT NOT NULL,
    "fileUrl" TEXT,
    deleted BOOLEAN NOT NULL DEFAULT false,
    "memberId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    FOREIGN KEY ("memberId") REFERENCES "Member"(id) ON DELETE CASCADE,
    FOREIGN KEY ("channelId") REFERENCES "Channel"(id) ON DELETE CASCADE
);

-- Create DirectMessage table (depends on Member and Conversation)
CREATE TABLE "DirectMessage" (
    id TEXT NOT NULL PRIMARY KEY,
    content TEXT NOT NULL,
    "fileUrl" TEXT,
    deleted BOOLEAN NOT NULL DEFAULT false,
    "memberId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    FOREIGN KEY ("memberId") REFERENCES "Member"(id) ON DELETE CASCADE,
    FOREIGN KEY ("conversationId") REFERENCES "Conversation"(id) ON DELETE CASCADE
);

-- =============================================================================
-- 3. CREATE INDEXES (for performance)
-- =============================================================================

-- Profile indexes
CREATE UNIQUE INDEX "Profile_userId_key" ON "Profile" USING btree ("userId");

-- Notification indexes
CREATE INDEX "Notification_userId_idx" ON "Notification" USING btree ("userId");
CREATE INDEX "Notification_read_idx" ON "Notification" USING btree (read);

-- Server indexes
CREATE INDEX "Server_profileId_idx" ON "Server" USING btree ("profileId");

-- Member indexes
CREATE INDEX "Member_profileId_idx" ON "Member" USING btree ("profileId");
CREATE INDEX "Member_serverId_idx" ON "Member" USING btree ("serverId");

-- Channel indexes
CREATE INDEX "Channel_profileId_idx" ON "Channel" USING btree ("profileId");
CREATE INDEX "Channel_serverId_idx" ON "Channel" USING btree ("serverId");

-- Conversation indexes
CREATE INDEX "Conversation_memberTwoId_idx" ON "Conversation" USING btree ("memberTwoId");

-- Message indexes
CREATE INDEX "Message_channelId_idx" ON "Message" USING btree ("channelId");
CREATE INDEX "Message_memberId_idx" ON "Message" USING btree ("memberId");

-- DirectMessage indexes
CREATE INDEX "DirectMessage_conversationId_idx" ON "DirectMessage" USING btree ("conversationId");
CREATE INDEX "DirectMessage_memberId_idx" ON "DirectMessage" USING btree ("memberId");

-- =============================================================================
-- 4. IMPORT DATA FROM CSV FILES (if using CSV export method)
-- =============================================================================

-- Import Profiles (first, no dependencies)
COPY "Profile" FROM '/tmp/profiles_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- Import Notifications
COPY "Notification" FROM '/tmp/notifications_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- Import Servers (depends on Profile)
COPY "Server" FROM '/tmp/servers_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- Import Members (depends on Profile and Server)
COPY "Member" FROM '/tmp/members_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- Import Channels (depends on Profile and Server)
COPY "Channel" FROM '/tmp/channels_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- Import Conversations (depends on Member)
COPY "Conversation" FROM '/tmp/conversations_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- Import Messages (depends on Member and Channel)
COPY "Message" FROM '/tmp/messages_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- Import DirectMessages (depends on Member and Conversation)
COPY "DirectMessage" FROM '/tmp/direct_messages_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- =============================================================================
-- 5. UPDATE SEQUENCES (if needed for auto-increment columns)
-- =============================================================================

-- Note: Since we're using TEXT IDs (cuid), no sequence updates needed
-- If you were using SERIAL/BIGSERIAL columns, you would need:
-- SELECT setval('table_id_seq', (SELECT MAX(id) FROM table));

-- =============================================================================
-- 6. VERIFY DATA INTEGRITY
-- =============================================================================

-- Check record counts
SELECT 'Profile' as table_name, COUNT(*) as record_count FROM "Profile"
UNION ALL
SELECT 'Notification', COUNT(*) FROM "Notification"
UNION ALL
SELECT 'Server', COUNT(*) FROM "Server"
UNION ALL
SELECT 'Member', COUNT(*) FROM "Member"
UNION ALL
SELECT 'Channel', COUNT(*) FROM "Channel"
UNION ALL
SELECT 'Conversation', COUNT(*) FROM "Conversation"
UNION ALL
SELECT 'Message', COUNT(*) FROM "Message"
UNION ALL
SELECT 'DirectMessage', COUNT(*) FROM "DirectMessage";

-- Check foreign key integrity
SELECT 
    'Orphaned Servers' as issue,
    COUNT(*) as count
FROM "Server" s 
LEFT JOIN "Profile" p ON s."profileId" = p.id 
WHERE p.id IS NULL

UNION ALL

SELECT 
    'Orphaned Members (Profile)',
    COUNT(*)
FROM "Member" m 
LEFT JOIN "Profile" p ON m."profileId" = p.id 
WHERE p.id IS NULL

UNION ALL

SELECT 
    'Orphaned Members (Server)',
    COUNT(*)
FROM "Member" m 
LEFT JOIN "Server" s ON m."serverId" = s.id 
WHERE s.id IS NULL

UNION ALL

SELECT 
    'Orphaned Channels (Profile)',
    COUNT(*)
FROM "Channel" c 
LEFT JOIN "Profile" p ON c."profileId" = p.id 
WHERE p.id IS NULL

UNION ALL

SELECT 
    'Orphaned Channels (Server)',
    COUNT(*)
FROM "Channel" c 
LEFT JOIN "Server" s ON c."serverId" = s.id 
WHERE s.id IS NULL;

-- =============================================================================
-- 7. POST-IMPORT CLEANUP (Optional)
-- =============================================================================

-- Vacuum and analyze tables for optimal performance
VACUUM ANALYZE "Profile";
VACUUM ANALYZE "Notification";
VACUUM ANALYZE "Server";
VACUUM ANALYZE "Member";
VACUUM ANALYZE "Channel";
VACUUM ANALYZE "Conversation";
VACUUM ANALYZE "Message";
VACUUM ANALYZE "DirectMessage"; 