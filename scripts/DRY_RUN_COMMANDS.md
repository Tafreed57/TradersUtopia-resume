# TRADERSUTOPIA Database Migration - Dry Run Commands

Quick reference for safe database migration testing.

## 🛡️ Why Use Dry Run?

- **Zero Risk**: Test everything without touching your databases
- **Early Detection**: Find issues before they become problems  
- **Confidence**: Know exactly what will happen before you do it
- **Planning**: Get accurate estimates for time and resources

## 📋 Command Reference

### 1. Export Dry Run (Source Database)

```bash
# Test what would be exported from your current database
cd scripts
node export-to-new-db.js --dry-run

# Alternative syntax
node export-to-new-db.js -d
```

**What it does:**
- ✅ Tests source database connection
- ✅ Validates all table data
- ✅ Shows export statistics (records, size, time)
- ✅ Generates sample SQL (without saving files)
- ✅ Reports data integrity issues
- ❌ **Does NOT create any files**

### 2. Import Dry Run (Target Database)

```bash
# Test target database readiness for import
TARGET_DATABASE_URL="postgresql://user:pass@host:port/db" node dry-run-import.js

# Or with environment variable
export TARGET_DATABASE_URL="postgresql://user:pass@host:port/db"
node dry-run-import.js
```

**What it does:**
- ✅ Tests target database connection and compatibility
- ✅ Checks PostgreSQL version and encoding
- ✅ Validates schema exists (enums, tables, indexes)
- ✅ Checks for existing data (warns about conflicts)
- ✅ Validates export files are ready
- ✅ Runs test transactions (with rollback)
- ✅ Estimates import time and disk space
- ❌ **Does NOT modify target database**

## 🚦 Workflow

```bash
# STEP 1: Install dependencies (one time)
pnpm install pg @types/pg

# STEP 2: Test source export
node export-to-new-db.js --dry-run

# STEP 3: Test target import  
TARGET_DATABASE_URL="..." node dry-run-import.js

# STEP 4: Only if both pass, run actual migration
node export-to-new-db.js  # Real export
# ... then import to target
```

## 📊 Sample Output

### Export Dry Run Success
```
[DRY RUN] Starting database dry run...
[DRY RUN] ✅ Database connection successful
[DRY RUN] ✅ Database query test successful (found 150 profiles)
[DRY RUN] Processing Profile table...
[DRY RUN] Would export 150 records from Profile (estimated 45.2 KB)
[DRY RUN] Sample SQL for Profile: INSERT INTO "Profile" (id, "userId", name...

================================================================================
DRY RUN SUMMARY
================================================================================

📊 DATABASE STATISTICS:
   Total Tables: 8
   Total Records: 1,247
   Estimated Size: 2.35 MB

📋 TABLE BREAKDOWN:
   Profile         :      150 records, 20 columns, 45.20 KB
   Server          :       23 records, 7 columns, 8.45 KB
   Member          :      245 records, 6 columns, 15.30 KB
   ...

✅ DRY RUN COMPLETED SUCCESSFULLY!
   No files were created or modified.
   Run without --dry-run to perform actual export.
```

### Import Dry Run Success
```
[DRY RUN] Starting import dry run validation...
[DRY RUN] ✅ Target database connection successful
[DRY RUN] ✅ Database version: PostgreSQL 15.4
[DRY RUN] ✅ Database encoding: UTF8
[DRY RUN] ✅ Enum SubscriptionStatus exists
[DRY RUN] ✅ Table Profile exists
[DRY RUN] ✅ Found profile_inserts.sql
[DRY RUN]    📊 150 INSERT statements, 45.20 KB
[DRY RUN] ✅ Sample INSERT test successful

================================================================================
IMPORT DRY RUN SUMMARY
================================================================================

📊 TARGET DATABASE:
   Connection: ✅ Success
   Version: PostgreSQL 15.4
   Encoding: UTF8

🏗️  SCHEMA STATUS:
   Enums Ready: 4/4
   Tables Ready: 8/8

📁 EXPORT FILES:
   Files Found: 9/9
   Total Records: 1,247
   Estimated Import Time: 1.25 seconds

📋 RECOMMENDATIONS:
   ✅ Target database is ready for import!
   ✅ All export files are valid and ready.
   
🚀 TO PROCEED WITH ACTUAL IMPORT:
   1. Run: psql $TARGET_DATABASE_URL -f scripts/import-database.sql
   2. Then: psql $TARGET_DATABASE_URL -f exports/complete_database_export.sql
```

## ⚠️ Common Issues & Solutions

### Export Dry Run Issues

**❌ Database connection failed**
```bash
# Check your DATABASE_URL environment variable
echo $DATABASE_URL
# Ensure your database is running and accessible
```

**❌ Missing ID in Profile at row 5**
```bash
# Data integrity issue - investigate your source data
# May indicate database corruption
```

### Import Dry Run Issues

**❌ Required file missing: profile_inserts.sql**
```bash
# Run export first
node export-to-new-db.js
```

**❌ Enum SubscriptionStatus does not exist**
```bash
# Run schema creation first
psql $TARGET_DATABASE_URL -f scripts/import-database.sql
```

**⚠️ Table Profile already has 50 records**
```bash
# Target database not empty - may cause conflicts
# Consider using a fresh database or backing up existing data
```

## 🎯 Best Practices

1. **Always dry run first** - Never skip this step
2. **Check both sides** - Test both export and import
3. **Read the warnings** - Yellow flags often become red ones
4. **Fresh target database** - Avoid importing into databases with existing data
5. **Backup first** - Always backup your target database before import
6. **Test the app** - After migration, test your application thoroughly

## 🔧 Troubleshooting

If dry runs fail:

1. **Fix source issues** before attempting export
2. **Resolve target connectivity** before attempting import  
3. **Install missing dependencies**: `pnpm install pg @types/pg`
4. **Check PostgreSQL versions** - ensure compatibility
5. **Verify permissions** - ensure database user has required privileges

Remember: **Dry runs are free, production mistakes are expensive!** 🛡️ 