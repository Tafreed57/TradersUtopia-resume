-- TRADERSUTOPIA Database Export Script
-- This script exports all data from the current database for migration to another database
-- Execute these queries in order to maintain referential integrity

-- =============================================================================
-- 1. EXPORT PROFILES TABLE
-- =============================================================================
COPY (
    SELECT 
        id,
        "userId",
        name,
        email,
        "imageUrl",
        "createdAt",
        "updatedAt",
        "stripeCustomerId",
        "stripeSessionId",
        "subscriptionEnd",
        "subscriptionStart",
        "subscriptionStatus"::text,
        "stripeProductId",
        "backupCodes",
        "twoFactorEnabled",
        "twoFactorSecret",
        "isAdmin",
        "emailNotifications"::text,
        "pushNotifications"::text,
        "pushSubscriptions"::text
    FROM "Profile"
    ORDER BY "createdAt"
) TO '/tmp/profiles_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- =============================================================================
-- 2. EXPORT NOTIFICATIONS TABLE
-- =============================================================================
COPY (
    SELECT 
        id,
        "userId",
        type::text,
        title,
        message,
        read,
        "actionUrl",
        "createdAt",
        "updatedAt"
    FROM "Notification"
    ORDER BY "createdAt"
) TO '/tmp/notifications_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- =============================================================================
-- 3. EXPORT SERVERS TABLE
-- =============================================================================
COPY (
    SELECT 
        id,
        name,
        "imageUrl",
        "inviteCode",
        "profileId",
        "createdAt",
        "updatedAt"
    FROM "Server"
    ORDER BY "createdAt"
) TO '/tmp/servers_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- =============================================================================
-- 4. EXPORT MEMBERS TABLE
-- =============================================================================
COPY (
    SELECT 
        id,
        role::text,
        "profileId",
        "serverId",
        "createdAt",
        "updatedAt"
    FROM "Member"
    ORDER BY "createdAt"
) TO '/tmp/members_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- =============================================================================
-- 5. EXPORT CHANNELS TABLE
-- =============================================================================
COPY (
    SELECT 
        id,
        name,
        type::text,
        "profileId",
        "serverId",
        "createdAt",
        "updatedAt"
    FROM "Channel"
    ORDER BY "createdAt"
) TO '/tmp/channels_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- =============================================================================
-- 6. EXPORT CONVERSATIONS TABLE
-- =============================================================================
COPY (
    SELECT 
        id,
        "memberOneId",
        "memberTwoId",
        "createdAt",
        "updatedAt"
    FROM "Conversation"
    ORDER BY "createdAt"
) TO '/tmp/conversations_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- =============================================================================
-- 7. EXPORT MESSAGES TABLE
-- =============================================================================
COPY (
    SELECT 
        id,
        content,
        "fileUrl",
        deleted,
        "memberId",
        "channelId",
        "createdAt",
        "updatedAt"
    FROM "Message"
    ORDER BY "createdAt"
) TO '/tmp/messages_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- =============================================================================
-- 8. EXPORT DIRECT MESSAGES TABLE
-- =============================================================================
COPY (
    SELECT 
        id,
        content,
        "fileUrl",
        deleted,
        "memberId",
        "conversationId",
        "createdAt",
        "updatedAt"
    FROM "DirectMessage"
    ORDER BY "createdAt"
) TO '/tmp/direct_messages_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');

-- =============================================================================
-- ALTERNATIVE: SINGLE SQL INSERT EXPORT
-- =============================================================================

-- Export Profiles as INSERT statements
SELECT 
    'INSERT INTO "Profile" (id, "userId", name, email, "imageUrl", "createdAt", "updatedAt", "stripeCustomerId", "stripeSessionId", "subscriptionEnd", "subscriptionStart", "subscriptionStatus", "stripeProductId", "backupCodes", "twoFactorEnabled", "twoFactorSecret", "isAdmin", "emailNotifications", "pushNotifications", "pushSubscriptions") VALUES ' ||
    '(' ||
    '''' || id || ''',' ||
    '''' || "userId" || ''',' ||
    '''' || replace(name, '''', '''''') || ''',' ||
    '''' || replace(email, '''', '''''') || ''',' ||
    COALESCE('''' || replace("imageUrl", '''', '''''') || '''', 'NULL') || ',' ||
    '''' || "createdAt"::text || ''',' ||
    '''' || "updatedAt"::text || ''',' ||
    COALESCE('''' || "stripeCustomerId" || '''', 'NULL') || ',' ||
    COALESCE('''' || "stripeSessionId" || '''', 'NULL') || ',' ||
    COALESCE('''' || "subscriptionEnd"::text || '''', 'NULL') || ',' ||
    COALESCE('''' || "subscriptionStart"::text || '''', 'NULL') || ',' ||
    '''' || "subscriptionStatus"::text || '''::' || '"SubscriptionStatus",' ||
    COALESCE('''' || "stripeProductId" || '''', 'NULL') || ',' ||
    COALESCE('ARRAY[' || array_to_string(array(select '''' || unnest("backupCodes") || ''''), ',') || ']', 'ARRAY[]::text[]') || ',' ||
    "twoFactorEnabled"::text || ',' ||
    COALESCE('''' || "twoFactorSecret" || '''', 'NULL') || ',' ||
    "isAdmin"::text || ',' ||
    COALESCE('''' || replace("emailNotifications"::text, '''', '''''') || '''::jsonb', 'NULL') || ',' ||
    COALESCE('''' || replace("pushNotifications"::text, '''', '''''') || '''::jsonb', 'NULL') || ',' ||
    COALESCE('ARRAY[' || array_to_string(array(select '''' || replace(unnest("pushSubscriptions")::text, '''', '''''') || '''::jsonb'), ',') || ']', 'ARRAY[]::jsonb[]') ||
    ');' as insert_statement
FROM "Profile"
ORDER BY "createdAt";

-- Export Servers as INSERT statements
SELECT 
    'INSERT INTO "Server" (id, name, "imageUrl", "inviteCode", "profileId", "createdAt", "updatedAt") VALUES ' ||
    '(' ||
    '''' || id || ''',' ||
    '''' || replace(name, '''', '''''') || ''',' ||
    COALESCE('''' || replace("imageUrl", '''', '''''') || '''', 'NULL') || ',' ||
    '''' || "inviteCode" || ''',' ||
    '''' || "profileId" || ''',' ||
    '''' || "createdAt"::text || ''',' ||
    '''' || "updatedAt"::text || '''' ||
    ');' as insert_statement
FROM "Server"
ORDER BY "createdAt";

-- Export Members as INSERT statements
SELECT 
    'INSERT INTO "Member" (id, role, "profileId", "serverId", "createdAt", "updatedAt") VALUES ' ||
    '(' ||
    '''' || id || ''',' ||
    '''' || role::text || '''::' || '"MemberRole",' ||
    '''' || "profileId" || ''',' ||
    '''' || "serverId" || ''',' ||
    '''' || "createdAt"::text || ''',' ||
    '''' || "updatedAt"::text || '''' ||
    ');' as insert_statement
FROM "Member"
ORDER BY "createdAt";

-- Export Channels as INSERT statements
SELECT 
    'INSERT INTO "Channel" (id, name, type, "profileId", "serverId", "createdAt", "updatedAt") VALUES ' ||
    '(' ||
    '''' || id || ''',' ||
    '''' || replace(name, '''', '''''') || ''',' ||
    '''' || type::text || '''::' || '"ChannelType",' ||
    '''' || "profileId" || ''',' ||
    '''' || "serverId" || ''',' ||
    '''' || "createdAt"::text || ''',' ||
    '''' || "updatedAt"::text || '''' ||
    ');' as insert_statement
FROM "Channel"
ORDER BY "createdAt";

-- Export Conversations as INSERT statements
SELECT 
    'INSERT INTO "Conversation" (id, "memberOneId", "memberTwoId", "createdAt", "updatedAt") VALUES ' ||
    '(' ||
    '''' || id || ''',' ||
    '''' || "memberOneId" || ''',' ||
    '''' || "memberTwoId" || ''',' ||
    '''' || "createdAt"::text || ''',' ||
    '''' || "updatedAt"::text || '''' ||
    ');' as insert_statement
FROM "Conversation"
ORDER BY "createdAt";

-- Export Messages as INSERT statements
SELECT 
    'INSERT INTO "Message" (id, content, "fileUrl", deleted, "memberId", "channelId", "createdAt", "updatedAt") VALUES ' ||
    '(' ||
    '''' || id || ''',' ||
    '''' || replace(content, '''', '''''') || ''',' ||
    COALESCE('''' || replace("fileUrl", '''', '''''') || '''', 'NULL') || ',' ||
    deleted::text || ',' ||
    '''' || "memberId" || ''',' ||
    '''' || "channelId" || ''',' ||
    '''' || "createdAt"::text || ''',' ||
    '''' || "updatedAt"::text || '''' ||
    ');' as insert_statement
FROM "Message"
ORDER BY "createdAt";

-- Export DirectMessages as INSERT statements
SELECT 
    'INSERT INTO "DirectMessage" (id, content, "fileUrl", deleted, "memberId", "conversationId", "createdAt", "updatedAt") VALUES ' ||
    '(' ||
    '''' || id || ''',' ||
    '''' || replace(content, '''', '''''') || ''',' ||
    COALESCE('''' || replace("fileUrl", '''', '''''') || '''', 'NULL') || ',' ||
    deleted::text || ',' ||
    '''' || "memberId" || ''',' ||
    '''' || "conversationId" || ''',' ||
    '''' || "createdAt"::text || ''',' ||
    '''' || "updatedAt"::text || '''' ||
    ');' as insert_statement
FROM "DirectMessage"
ORDER BY "createdAt";

-- Export Notifications as INSERT statements
SELECT 
    'INSERT INTO "Notification" (id, "userId", type, title, message, read, "actionUrl", "createdAt", "updatedAt") VALUES ' ||
    '(' ||
    '''' || id || ''',' ||
    '''' || "userId" || ''',' ||
    '''' || type::text || '''::' || '"NotificationType",' ||
    '''' || replace(title, '''', '''''') || ''',' ||
    '''' || replace(message, '''', '''''') || ''',' ||
    read::text || ',' ||
    COALESCE('''' || replace("actionUrl", '''', '''''') || '''', 'NULL') || ',' ||
    '''' || "createdAt"::text || ''',' ||
    '''' || "updatedAt"::text || '''' ||
    ');' as insert_statement
FROM "Notification"
ORDER BY "createdAt"; 