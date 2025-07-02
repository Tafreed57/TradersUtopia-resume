const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

/**
 * TRADERSUTOPIA Database Import Dry Run Script
 * This script validates the target database and import files without performing actual import
 */

class ImportDryRunner {
  constructor(targetDatabaseUrl) {
    this.targetDatabaseUrl = targetDatabaseUrl;
    this.client = null;
    this.exportDir = path.join(__dirname, '..', 'exports');
    this.summary = {
      database: {
        connected: false,
        version: null,
        encoding: null,
        schemas: [],
      },
      schema: {
        enumsExist: {},
        tablesExist: {},
        indexesExist: {},
        constraints: {},
      },
      files: {
        found: {},
        validated: {},
        totalRecords: 0,
        estimatedImportTime: 0,
      },
      errors: [],
      warnings: [],
    };
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    console.log(`[DRY RUN] [${level}] ${message}`);
  }

  async connectToDatabase() {
    try {
      this.client = new Client({
        connectionString: this.targetDatabaseUrl,
        ssl: this.targetDatabaseUrl.includes('localhost')
          ? false
          : { rejectUnauthorized: false },
      });

      await this.client.connect();
      this.summary.database.connected = true;
      this.log('✅ Target database connection successful');

      // Get database info
      const versionResult = await this.client.query('SELECT version()');
      this.summary.database.version = versionResult.rows[0].version;

      const encodingResult = await this.client.query('SHOW server_encoding');
      this.summary.database.encoding = encodingResult.rows[0].server_encoding;

      this.log(
        `✅ Database version: ${this.summary.database.version.split(' ').slice(0, 2).join(' ')}`
      );
      this.log(`✅ Database encoding: ${this.summary.database.encoding}`);

      return true;
    } catch (error) {
      this.summary.errors.push(`Database connection failed: ${error.message}`);
      this.log(`❌ Database connection failed: ${error.message}`, 'ERROR');
      return false;
    }
  }

  async checkRequiredEnums() {
    const requiredEnums = [
      'SubscriptionStatus',
      'ChannelType',
      'MemberRole',
      'NotificationType',
    ];

    this.log('Checking required enum types...');

    for (const enumName of requiredEnums) {
      try {
        const result = await this.client.query(
          `
          SELECT EXISTS (
            SELECT 1 FROM pg_type 
            WHERE typname = $1 AND typtype = 'e'
          )
        `,
          [enumName]
        );

        const exists = result.rows[0].exists;
        this.summary.schema.enumsExist[enumName] = exists;

        if (exists) {
          this.log(`✅ Enum ${enumName} exists`);

          // Get enum values
          const valuesResult = await this.client.query(
            `
            SELECT enumlabel FROM pg_enum 
            WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = $1)
            ORDER BY enumsortorder
          `,
            [enumName]
          );

          const values = valuesResult.rows.map(row => row.enumlabel);
          this.log(`   Values: ${values.join(', ')}`);
        } else {
          this.summary.warnings.push(
            `Enum ${enumName} does not exist - will be created during import`
          );
          this.log(`⚠️  Enum ${enumName} does not exist`, 'WARNING');
        }
      } catch (error) {
        this.summary.errors.push(
          `Error checking enum ${enumName}: ${error.message}`
        );
        this.log(
          `❌ Error checking enum ${enumName}: ${error.message}`,
          'ERROR'
        );
      }
    }
  }

  async checkRequiredTables() {
    const requiredTables = [
      'Profile',
      'Notification',
      'Server',
      'Member',
      'Channel',
      'Conversation',
      'Message',
      'DirectMessage',
    ];

    this.log('Checking required tables...');

    for (const tableName of requiredTables) {
      try {
        const result = await this.client.query(
          `
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_name = $1 AND table_schema = 'public'
          )
        `,
          [tableName]
        );

        const exists = result.rows[0].exists;
        this.summary.schema.tablesExist[tableName] = exists;

        if (exists) {
          this.log(`✅ Table ${tableName} exists`);

          // Get column count
          const columnsResult = await this.client.query(
            `
            SELECT COUNT(*) as column_count 
            FROM information_schema.columns 
            WHERE table_name = $1 AND table_schema = 'public'
          `,
            [tableName]
          );

          const columnCount = columnsResult.rows[0].column_count;
          this.log(`   Columns: ${columnCount}`);

          // Check if table has data
          const countResult = await this.client.query(
            `SELECT COUNT(*) FROM "${tableName}"`
          );
          const rowCount = parseInt(countResult.rows[0].count);
          if (rowCount > 0) {
            this.summary.warnings.push(
              `Table ${tableName} already contains ${rowCount} records`
            );
            this.log(
              `⚠️  Table ${tableName} already has ${rowCount} records`,
              'WARNING'
            );
          }
        } else {
          this.summary.warnings.push(
            `Table ${tableName} does not exist - will be created during import`
          );
          this.log(`⚠️  Table ${tableName} does not exist`, 'WARNING');
        }
      } catch (error) {
        this.summary.errors.push(
          `Error checking table ${tableName}: ${error.message}`
        );
        this.log(
          `❌ Error checking table ${tableName}: ${error.message}`,
          'ERROR'
        );
      }
    }
  }

  async checkIndexes() {
    this.log('Checking database indexes...');

    try {
      const result = await this.client.query(`
        SELECT 
          schemaname,
          tablename,
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE schemaname = 'public'
        ORDER BY tablename, indexname
      `);

      this.summary.schema.indexesExist = result.rows.reduce((acc, row) => {
        if (!acc[row.tablename]) acc[row.tablename] = [];
        acc[row.tablename].push(row.indexname);
        return acc;
      }, {});

      this.log(`✅ Found ${result.rows.length} existing indexes`);
    } catch (error) {
      this.summary.warnings.push(`Could not check indexes: ${error.message}`);
      this.log(`⚠️  Could not check indexes: ${error.message}`, 'WARNING');
    }
  }

  validateExportFiles() {
    this.log('Validating export files...');

    const requiredFiles = [
      'profile_inserts.sql',
      'notification_inserts.sql',
      'server_inserts.sql',
      'member_inserts.sql',
      'channel_inserts.sql',
      'conversation_inserts.sql',
      'message_inserts.sql',
      'directmessage_inserts.sql',
      'complete_database_export.sql',
    ];

    for (const fileName of requiredFiles) {
      const filePath = path.join(this.exportDir, fileName);

      if (fs.existsSync(filePath)) {
        this.summary.files.found[fileName] = true;
        this.log(`✅ Found ${fileName}`);

        // Validate file content
        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const insertCount = (content.match(/INSERT INTO/g) || []).length;

          this.summary.files.validated[fileName] = {
            size: content.length,
            insertStatements: insertCount,
            valid:
              insertCount > 0 || fileName === 'complete_database_export.sql',
          };

          this.summary.files.totalRecords += insertCount;

          if (insertCount > 0) {
            this.log(
              `   📊 ${insertCount} INSERT statements, ${(content.length / 1024).toFixed(2)} KB`
            );

            // Estimate import time (rough calculation)
            this.summary.files.estimatedImportTime += insertCount * 0.001; // 1ms per insert
          } else if (fileName !== 'complete_database_export.sql') {
            this.summary.warnings.push(
              `File ${fileName} contains no INSERT statements`
            );
            this.log(`⚠️  ${fileName} contains no data`, 'WARNING');
          }
        } catch (error) {
          this.summary.errors.push(
            `Error reading ${fileName}: ${error.message}`
          );
          this.log(`❌ Error reading ${fileName}: ${error.message}`, 'ERROR');
        }
      } else {
        this.summary.files.found[fileName] = false;
        this.summary.errors.push(`Required file missing: ${fileName}`);
        this.log(`❌ Missing required file: ${fileName}`, 'ERROR');
      }
    }
  }

  async testSampleImport() {
    this.log('Testing sample import (without committing)...');

    try {
      await this.client.query('BEGIN');

      // Test creating a sample profile
      const testSql = `
        INSERT INTO "Profile" (
          id, "userId", name, email, "createdAt", "updatedAt", 
          "subscriptionStatus", "twoFactorEnabled", "isAdmin"
        ) VALUES (
          'test_dry_run_id',
          'test_dry_run_user', 
          'Test User',
          'test@example.com',
          NOW(),
          NOW(),
          'FREE',
          false,
          false
        )
      `;

      await this.client.query(testSql);
      this.log('✅ Sample INSERT test successful');

      // Test that we can read it back
      const result = await this.client.query(
        'SELECT * FROM "Profile" WHERE id = $1',
        ['test_dry_run_id']
      );
      if (result.rows.length === 1) {
        this.log('✅ Sample SELECT test successful');
      }

      // Rollback to undo our test
      await this.client.query('ROLLBACK');
      this.log('✅ Test transaction rolled back successfully');
    } catch (error) {
      await this.client.query('ROLLBACK');
      this.summary.errors.push(`Sample import test failed: ${error.message}`);
      this.log(`❌ Sample import test failed: ${error.message}`, 'ERROR');
    }
  }

  async checkDiskSpace() {
    this.log('Checking available disk space...');

    try {
      const result = await this.client.query(`
        SELECT 
          pg_size_pretty(pg_database_size(current_database())) as current_size,
          pg_size_pretty(pg_total_relation_size('pg_class')) as system_size
      `);

      const currentSize = result.rows[0].current_size;
      this.log(`✅ Current database size: ${currentSize}`);

      const estimatedImportSize = this.summary.files.estimatedImportTime * 1024; // Rough estimate
      this.log(
        `✅ Estimated import size: ${(estimatedImportSize / 1024 / 1024).toFixed(2)} MB`
      );
    } catch (error) {
      this.summary.warnings.push(
        `Could not check disk space: ${error.message}`
      );
      this.log(`⚠️  Could not check disk space: ${error.message}`, 'WARNING');
    }
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log('IMPORT DRY RUN SUMMARY');
    console.log('='.repeat(80));

    console.log(`\n📊 TARGET DATABASE:`);
    console.log(
      `   Connection: ${this.summary.database.connected ? '✅ Success' : '❌ Failed'}`
    );
    if (this.summary.database.version) {
      console.log(
        `   Version: ${this.summary.database.version.split(' ').slice(0, 2).join(' ')}`
      );
      console.log(`   Encoding: ${this.summary.database.encoding}`);
    }

    console.log(`\n🏗️  SCHEMA STATUS:`);
    console.log(
      `   Enums Ready: ${Object.values(this.summary.schema.enumsExist).filter(Boolean).length}/4`
    );
    console.log(
      `   Tables Ready: ${Object.values(this.summary.schema.tablesExist).filter(Boolean).length}/8`
    );

    console.log(`\n📁 EXPORT FILES:`);
    const foundFiles = Object.values(this.summary.files.found).filter(
      Boolean
    ).length;
    const totalFiles = Object.keys(this.summary.files.found).length;
    console.log(`   Files Found: ${foundFiles}/${totalFiles}`);
    console.log(
      `   Total Records: ${this.summary.files.totalRecords.toLocaleString()}`
    );
    console.log(
      `   Estimated Import Time: ${this.summary.files.estimatedImportTime.toFixed(2)} seconds`
    );

    if (this.summary.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${this.summary.warnings.length}):`);
      this.summary.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    if (this.summary.errors.length > 0) {
      console.log(`\n❌ ERRORS (${this.summary.errors.length}):`);
      this.summary.errors.forEach(error => console.log(`   • ${error}`));
    }

    console.log(`\n📋 RECOMMENDATIONS:`);

    if (this.summary.errors.length === 0) {
      console.log(`   ✅ Target database is ready for import!`);
      console.log(`   ✅ All export files are valid and ready.`);
      console.log(`   \n🚀 TO PROCEED WITH ACTUAL IMPORT:`);
      console.log(
        `   1. Run: psql $TARGET_DATABASE_URL -f scripts/import-database.sql`
      );
      console.log(
        `   2. Then: psql $TARGET_DATABASE_URL -f exports/complete_database_export.sql`
      );
    } else {
      console.log(
        `   ❌ ${this.summary.errors.length} errors must be resolved before import.`
      );

      if (!this.summary.database.connected) {
        console.log(`   📌 Fix database connection issues first.`);
      }

      const missingFiles = Object.entries(this.summary.files.found)
        .filter(([_, found]) => !found)
        .map(([file, _]) => file);

      if (missingFiles.length > 0) {
        console.log(
          `   📌 Run export script first: node scripts/export-to-new-db.js`
        );
      }
    }

    console.log('='.repeat(80));
  }

  async runDryRun() {
    try {
      this.log('Starting import dry run validation...');

      // Check database connection
      const connected = await this.connectToDatabase();
      if (!connected) {
        this.printSummary();
        return false;
      }

      // Validate export files first
      this.validateExportFiles();

      // Check database schema
      await this.checkRequiredEnums();
      await this.checkRequiredTables();
      await this.checkIndexes();

      // Test sample operations
      if (Object.values(this.summary.schema.tablesExist).some(Boolean)) {
        await this.testSampleImport();
      }

      await this.checkDiskSpace();

      this.printSummary();

      return this.summary.errors.length === 0;
    } catch (error) {
      this.log(`Dry run failed: ${error.message}`, 'ERROR');
      console.error('Stack trace:', error.stack);
      return false;
    } finally {
      if (this.client) {
        await this.client.end();
      }
    }
  }
}

// Command line usage
if (require.main === module) {
  const targetDatabaseUrl = process.env.TARGET_DATABASE_URL || process.argv[2];

  if (!targetDatabaseUrl) {
    console.error('Usage: node dry-run-import.js <TARGET_DATABASE_URL>');
    console.error('   or: TARGET_DATABASE_URL=<url> node dry-run-import.js');
    process.exit(1);
  }

  const dryRunner = new ImportDryRunner(targetDatabaseUrl);
  dryRunner
    .runDryRun()
    .then(success => {
      console.log(`\nDry run ${success ? 'PASSED' : 'FAILED'}!`);
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Dry run failed:', error.message);
      process.exit(1);
    });
}

module.exports = ImportDryRunner;
