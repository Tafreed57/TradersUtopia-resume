# TRADERSUTOPIA Database Export Guide

This guide explains how to export your TRADERSUTOPIA database data to another database using the provided SQL scripts and Node.js automation tools.

## Overview

The export process creates both SQL INSERT statements and CSV files for all your database tables, maintaining referential integrity and proper data types.

## Files Included

- `export-database.sql` - Manual SQL queries for database export
- `import-database.sql` - SQL script to create schema and import data on target database
- `export-to-new-db.js` - Automated Node.js export script
- `DATABASE_EXPORT_README.md` - This documentation file

## Method 1: DRY RUN FIRST (Highly Recommended)

### Step 1: Test Export (Dry Run)

Before doing anything, test your export process safely:

```bash
cd scripts

# Dry run - validates source database and shows what would be exported
node export-to-new-db.js --dry-run
```

This will:
- ✅ Test source database connection
- ✅ Validate all data and show statistics
- ✅ Estimate export size and time
- ✅ Show sample SQL without creating files
- ✅ Report any issues before you proceed

### Step 2: Test Import (Dry Run)

Then test your target database before import:

```bash
# Install dependencies if needed
pnpm install pg @types/pg

# Test target database - replace with your target database URL
TARGET_DATABASE_URL="postgresql://user:pass@host:port/db" node dry-run-import.js

# Or set environment variable
export TARGET_DATABASE_URL="postgresql://user:pass@host:port/db"
node dry-run-import.js
```

This will:
- ✅ Test target database connection and compatibility
- ✅ Check if schema exists (enums, tables, indexes)
- ✅ Validate export files are ready for import
- ✅ Estimate import time and space requirements
- ✅ Run sample transactions (with rollback)
- ✅ Give you clear go/no-go decision

## Method 2: Automated Export (After Dry Run)

### Prerequisites

1. Ensure your environment variables are properly configured
2. Your Prisma client should be generated and up-to-date
3. Node.js and npm/pnpm installed
4. **Run dry run first!** (see Method 1)

### Steps

1. **Run the actual export script:**
   ```bash
   cd scripts
   node export-to-new-db.js
   ```

2. **Check the export directory:**
   ```bash
   ls ../exports/
   ```

   You should see:
   - Individual SQL insert files for each table
   - CSV export files for each table
   - `complete_database_export.sql` - Combined SQL file
   - `export-log.txt` - Export operation log

3. **Copy files to your target database server:**
   ```bash
   # Example: Copy to remote server
   scp -r ../exports/ user@target-server:/path/to/import/
   ```

## Method 3: Manual SQL Export

### Using PostgreSQL Command Line

1. **Connect to your source database:**
   ```bash
   psql $DATABASE_URL
   ```

2. **Run the export queries from `export-database.sql`:**
   ```sql
   -- Copy the COPY commands from export-database.sql
   COPY (...) TO '/tmp/profiles_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');
   -- Repeat for all tables
   ```

3. **Alternative: Generate INSERT statements:**
   ```sql
   -- Copy the INSERT generation queries from export-database.sql
   SELECT 'INSERT INTO "Profile" (...) VALUES (...)' as insert_statement FROM "Profile";
   -- Save output to files
   ```

## Setting Up Target Database

### Step 1: Create Database Schema

1. **Connect to your target database:**
   ```bash
   psql $TARGET_DATABASE_URL
   ```

2. **Run the schema creation script:**
   ```bash
   psql $TARGET_DATABASE_URL -f import-database.sql
   ```

### Step 2: Import Data

#### Option A: Using CSV Files
```bash
# Copy CSV files to target server first
psql $TARGET_DATABASE_URL -c "\COPY \"Profile\" FROM 'profiles_export.csv' WITH (FORMAT CSV, HEADER true, NULL '');"
# Repeat for all tables in dependency order
```

#### Option B: Using SQL INSERT Statements
```bash
# Execute the combined SQL file
psql $TARGET_DATABASE_URL -f complete_database_export.sql
```

#### Option C: Using Individual SQL Files
```bash
# Execute files in dependency order
psql $TARGET_DATABASE_URL -f profile_inserts.sql
psql $TARGET_DATABASE_URL -f notification_inserts.sql
psql $TARGET_DATABASE_URL -f server_inserts.sql
psql $TARGET_DATABASE_URL -f member_inserts.sql
psql $TARGET_DATABASE_URL -f channel_inserts.sql
psql $TARGET_DATABASE_URL -f conversation_inserts.sql
psql $TARGET_DATABASE_URL -f message_inserts.sql
psql $TARGET_DATABASE_URL -f directmessage_inserts.sql
```

## Data Export Order (Important!)

The export maintains referential integrity by exporting tables in this order:

1. **Profile** (no dependencies)
2. **Notification** (references userId, but not enforced FK)
3. **Server** (depends on Profile)
4. **Member** (depends on Profile and Server)
5. **Channel** (depends on Profile and Server)
6. **Conversation** (depends on Member)
7. **Message** (depends on Member and Channel)
8. **DirectMessage** (depends on Member and Conversation)

## Data Types Handled

### Special PostgreSQL Types
- **JSONB**: Notification preferences, push subscriptions
- **Arrays**: Backup codes, push subscription arrays
- **Enums**: SubscriptionStatus, ChannelType, MemberRole, NotificationType
- **Timestamps**: All date/time fields
- **Text Arrays**: Backup codes

### Encoding Considerations
- Single quotes in text are properly escaped
- JSON data is preserved with proper escaping
- CSV files handle commas and quotes correctly
- NULL values are handled appropriately

## Verification

After import, run these verification queries on your target database:

```sql
-- Check record counts
SELECT 'Profile' as table_name, COUNT(*) as record_count FROM "Profile"
UNION ALL
SELECT 'Server', COUNT(*) FROM "Server"
UNION ALL
SELECT 'Member', COUNT(*) FROM "Member"
UNION ALL
SELECT 'Channel', COUNT(*) FROM "Channel"
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
WHERE p.id IS NULL;

-- Check data types
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'Profile' 
ORDER BY ordinal_position;
```

## Troubleshooting

### Common Issues

1. **Permission Errors:**
   ```
   ERROR: must be superuser or a member of the pg_read_server_files role
   ```
   - Use the Node.js script instead of COPY TO FILE
   - Or use `\copy` instead of `COPY` in psql

2. **Encoding Issues:**
   ```
   ERROR: invalid byte sequence for encoding "UTF8"
   ```
   - Check source database encoding: `SHOW server_encoding;`
   - Ensure target database uses UTF8 encoding

3. **Foreign Key Violations:**
   ```
   ERROR: insert or update on table violates foreign key constraint
   ```
   - Import tables in the correct dependency order
   - Check that parent records exist before importing children

4. **Enum Type Errors:**
   ```
   ERROR: type "SubscriptionStatus" does not exist
   ```
   - Ensure enums are created before tables
   - Run the schema creation script first

### Performance Tips

1. **Large Datasets:**
   - Disable foreign key checks temporarily during import
   - Use COPY instead of INSERT for better performance
   - Consider batch sizes for very large tables

2. **Memory Usage:**
   - The Node.js script loads entire tables into memory
   - For very large datasets, consider implementing streaming

## Security Considerations

- **Sensitive Data**: The export includes all data including:
  - Two-factor authentication secrets
  - Stripe customer IDs
  - User email addresses
  - Private messages
  
- **Access Control**: Ensure exported files are securely transferred and stored
- **Cleanup**: Delete temporary export files after successful import

## Example Complete Migration

```bash
# PHASE 1: DRY RUN VALIDATION
cd scripts

# 1. Test source database export (dry run)
node export-to-new-db.js --dry-run

# 2. Install pg dependency for import dry run
pnpm install pg @types/pg

# 3. Test target database import readiness
TARGET_DATABASE_URL="postgresql://user:pass@target-host:port/db" node dry-run-import.js

# PHASE 2: ACTUAL MIGRATION (only if dry runs pass)

# 4. Export from source database
node export-to-new-db.js

# 5. Copy files to target server
scp -r ../exports/ user@target-server:/tmp/tradersutopia-export/

# 6. On target server - create schema
psql $TARGET_DATABASE_URL -f /tmp/tradersutopia-export/import-database.sql

# 7. Import data
psql $TARGET_DATABASE_URL -f /tmp/tradersutopia-export/complete_database_export.sql

# 8. Verify import
psql $TARGET_DATABASE_URL -c "SELECT COUNT(*) FROM \"Profile\";"

# 9. Update your application's DATABASE_URL
# 10. Test your application
# 11. Clean up export files
```

## Support

If you encounter issues:

1. Check the `export-log.txt` file for detailed error messages
2. Verify your database connection and permissions
3. Ensure all required dependencies are installed
4. Check PostgreSQL version compatibility

The export scripts are designed to work with PostgreSQL 12+ and should be compatible with most PostgreSQL-compatible databases (like Neon, AWS RDS, etc.). 