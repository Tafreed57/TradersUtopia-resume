const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

/**
 * TRADERSUTOPIA Database Export Script
 * This script exports all data from the current database for migration to another database
 * Supports dry-run mode for safe testing
 */

const prisma = new PrismaClient();

class DatabaseExporter {
  constructor(options = {}) {
    this.dryRun = options.dryRun || false;
    this.exportDir = path.join(__dirname, '..', 'exports');
    this.logFile = path.join(
      this.exportDir,
      this.dryRun ? 'dry-run-log.txt' : 'export-log.txt'
    );
    this.summary = {
      tables: {},
      totalRecords: 0,
      estimatedSize: 0,
      errors: [],
      warnings: [],
    };

    if (!this.dryRun) {
      this.ensureExportDirectory();
    }
  }

  ensureExportDirectory() {
    if (!fs.existsSync(this.exportDir)) {
      fs.mkdirSync(this.exportDir, { recursive: true });
    }
  }

  log(message, level = 'INFO') {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${this.dryRun ? '[DRY RUN] ' : ''}${message}\n`;
    console.log(`${this.dryRun ? '[DRY RUN] ' : ''}${message}`);

    if (!this.dryRun) {
      fs.appendFileSync(this.logFile, logMessage);
    }
  }

  estimateDataSize(data, columns) {
    if (!data || data.length === 0) return 0;

    // Rough estimate: average row size in bytes
    const sampleRow = data[0];
    let rowSize = 0;

    columns.forEach(col => {
      const value = sampleRow[col];
      if (value === null || value === undefined) {
        rowSize += 4; // NULL
      } else if (typeof value === 'string') {
        rowSize += value.length * 2; // UTF-8 estimate
      } else if (typeof value === 'object') {
        rowSize += JSON.stringify(value).length * 2;
      } else {
        rowSize += 8; // Numbers, booleans, dates
      }
    });

    return rowSize * data.length;
  }

  validateData(tableName, data, columns) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    if (!data || data.length === 0) {
      validation.warnings.push(`Table ${tableName} is empty`);
      return validation;
    }

    // Check for required columns
    const sampleRow = data[0];
    const missingColumns = columns.filter(col => !(col in sampleRow));
    if (missingColumns.length > 0) {
      validation.errors.push(
        `Missing columns in ${tableName}: ${missingColumns.join(', ')}`
      );
      validation.isValid = false;
    }

    // Check for data integrity issues
    data.forEach((row, index) => {
      // Check for required ID field
      if (!row.id) {
        validation.errors.push(
          `Missing ID in ${tableName} at row ${index + 1}`
        );
        validation.isValid = false;
      }

      // Check for extremely large text fields (potential data corruption)
      columns.forEach(col => {
        const value = row[col];
        if (typeof value === 'string' && value.length > 1000000) {
          // 1MB
          validation.warnings.push(
            `Very large text field in ${tableName}.${col} at row ${index + 1} (${value.length} chars)`
          );
        }
      });
    });

    return validation;
  }

  async exportTableAsInserts(tableName, data, columns) {
    const validation = this.validateData(tableName, data, columns);

    if (!validation.isValid) {
      this.summary.errors.push(...validation.errors);
      this.log(
        `Validation failed for ${tableName}: ${validation.errors.join(', ')}`,
        'ERROR'
      );
      return;
    }

    if (validation.warnings.length > 0) {
      this.summary.warnings.push(...validation.warnings);
      validation.warnings.forEach(warning => this.log(warning, 'WARNING'));
    }

    if (!data || data.length === 0) {
      this.log(`No data found for table: ${tableName}`, 'WARNING');
      return;
    }

    const estimatedSize = this.estimateDataSize(data, columns);
    this.summary.tables[tableName] = {
      recordCount: data.length,
      estimatedSize: estimatedSize,
      columns: columns.length,
    };
    this.summary.totalRecords += data.length;
    this.summary.estimatedSize += estimatedSize;

    if (this.dryRun) {
      this.log(
        `Would export ${data.length} records from ${tableName} (estimated ${(estimatedSize / 1024).toFixed(2)} KB)`
      );

      // Validate a sample of the data conversion
      const sampleRow = data[0];
      const values = columns.map(col => {
        const value = sampleRow[col];

        if (value === null || value === undefined) {
          return 'NULL';
        }

        if (typeof value === 'boolean') {
          return value.toString();
        }

        if (typeof value === 'number') {
          return value.toString();
        }

        if (Array.isArray(value)) {
          if (value.length === 0) {
            return 'ARRAY[]';
          }
          // Handle text arrays
          if (typeof value[0] === 'string') {
            return `ARRAY[${value.map(v => `'${v.replace(/'/g, "''")}'`).join(',')}]`;
          }
          // Handle JSONB arrays
          return `ARRAY[${value.map(v => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`).join(',')}]`;
        }

        if (typeof value === 'object') {
          return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
        }

        if (value instanceof Date) {
          return `'${value.toISOString()}'`;
        }

        // String values - escape single quotes
        return `'${value.toString().replace(/'/g, "''")}'`;
      });

      // Test SQL generation with sample row
      const sampleSql = `INSERT INTO "${tableName}" (${columns.map(col => `"${col}"`).join(', ')}) VALUES (${values.join(', ')});`;
      this.log(
        `Sample SQL for ${tableName}: ${sampleSql.substring(0, 150)}${sampleSql.length > 150 ? '...' : ''}`
      );
      return;
    }

    // Original export logic for non-dry-run
    const fileName = path.join(
      this.exportDir,
      `${tableName.toLowerCase()}_inserts.sql`
    );
    let sqlContent = `-- ${tableName} INSERT statements\n-- Generated on ${new Date().toISOString()}\n\n`;

    data.forEach(row => {
      const values = columns.map(col => {
        const value = row[col];

        if (value === null || value === undefined) {
          return 'NULL';
        }

        if (typeof value === 'boolean') {
          return value.toString();
        }

        if (typeof value === 'number') {
          return value.toString();
        }

        if (Array.isArray(value)) {
          if (value.length === 0) {
            return 'ARRAY[]';
          }
          // Handle text arrays
          if (typeof value[0] === 'string') {
            return `ARRAY[${value.map(v => `'${v.replace(/'/g, "''")}'`).join(',')}]`;
          }
          // Handle JSONB arrays
          return `ARRAY[${value.map(v => `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`).join(',')}]`;
        }

        if (typeof value === 'object') {
          return `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;
        }

        if (value instanceof Date) {
          return `'${value.toISOString()}'`;
        }

        // String values - escape single quotes
        return `'${value.toString().replace(/'/g, "''")}'`;
      });

      sqlContent += `INSERT INTO "${tableName}" (${columns.map(col => `"${col}"`).join(', ')}) VALUES (${values.join(', ')});\n`;
    });

    fs.writeFileSync(fileName, sqlContent);
    this.log(
      `Exported ${data.length} records from ${tableName} to ${fileName}`
    );
  }

  async exportTableAsCsv(tableName, data, columns) {
    if (!data || data.length === 0) {
      this.log(`No data found for table: ${tableName}`, 'WARNING');
      return;
    }

    if (this.dryRun) {
      this.log(`Would export ${data.length} records from ${tableName} as CSV`);
      return;
    }

    // Original CSV export logic for non-dry-run
    const fileName = path.join(
      this.exportDir,
      `${tableName.toLowerCase()}_export.csv`
    );

    // Create CSV header
    let csvContent = columns.join(',') + '\n';

    // Add data rows
    data.forEach(row => {
      const values = columns.map(col => {
        const value = row[col];

        if (value === null || value === undefined) {
          return '';
        }

        if (typeof value === 'boolean') {
          return value.toString();
        }

        if (typeof value === 'number') {
          return value.toString();
        }

        if (Array.isArray(value)) {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }

        if (typeof value === 'object') {
          return `"${JSON.stringify(value).replace(/"/g, '""')}"`;
        }

        if (value instanceof Date) {
          return value.toISOString();
        }

        // String values - escape quotes for CSV
        const stringValue = value.toString().replace(/"/g, '""');
        return stringValue.includes(',') ||
          stringValue.includes('\n') ||
          stringValue.includes('"')
          ? `"${stringValue}"`
          : stringValue;
      });

      csvContent += values.join(',') + '\n';
    });

    fs.writeFileSync(fileName, csvContent);
    this.log(
      `Exported ${data.length} records from ${tableName} to ${fileName}`
    );
  }

  async testDatabaseConnection() {
    try {
      await prisma.$connect();
      this.log('✅ Database connection successful');

      // Test a simple query
      const profileCount = await prisma.profile.count();
      this.log(
        `✅ Database query test successful (found ${profileCount} profiles)`
      );

      return true;
    } catch (error) {
      this.log(`❌ Database connection failed: ${error.message}`, 'ERROR');
      this.summary.errors.push(`Database connection failed: ${error.message}`);
      return false;
    }
  }

  async exportProfiles() {
    this.log('Processing Profile table...');
    const profiles = await prisma.profile.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const columns = [
      'id',
      'userId',
      'name',
      'email',
      'imageUrl',
      'createdAt',
      'updatedAt',
      'stripeCustomerId',
      'stripeSessionId',
      'subscriptionEnd',
      'subscriptionStart',
      'subscriptionStatus',
      'stripeProductId',
      'backupCodes',
      'twoFactorEnabled',
      'twoFactorSecret',
      'isAdmin',
      'emailNotifications',
      'pushNotifications',
      'pushSubscriptions',
    ];

    await this.exportTableAsInserts('Profile', profiles, columns);
    if (!this.dryRun) {
      await this.exportTableAsCsv('Profile', profiles, columns);
    }
  }

  async exportNotifications() {
    this.log('Processing Notification table...');
    const notifications = await prisma.notification.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const columns = [
      'id',
      'userId',
      'type',
      'title',
      'message',
      'read',
      'actionUrl',
      'createdAt',
      'updatedAt',
    ];

    await this.exportTableAsInserts('Notification', notifications, columns);
    if (!this.dryRun) {
      await this.exportTableAsCsv('Notification', notifications, columns);
    }
  }

  async exportServers() {
    this.log('Processing Server table...');
    const servers = await prisma.server.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const columns = [
      'id',
      'name',
      'imageUrl',
      'inviteCode',
      'profileId',
      'createdAt',
      'updatedAt',
    ];

    await this.exportTableAsInserts('Server', servers, columns);
    if (!this.dryRun) {
      await this.exportTableAsCsv('Server', servers, columns);
    }
  }

  async exportMembers() {
    this.log('Processing Member table...');
    const members = await prisma.member.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const columns = [
      'id',
      'role',
      'profileId',
      'serverId',
      'createdAt',
      'updatedAt',
    ];

    await this.exportTableAsInserts('Member', members, columns);
    if (!this.dryRun) {
      await this.exportTableAsCsv('Member', members, columns);
    }
  }

  async exportChannels() {
    this.log('Processing Channel table...');
    const channels = await prisma.channel.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const columns = [
      'id',
      'name',
      'type',
      'profileId',
      'serverId',
      'createdAt',
      'updatedAt',
    ];

    await this.exportTableAsInserts('Channel', channels, columns);
    if (!this.dryRun) {
      await this.exportTableAsCsv('Channel', channels, columns);
    }
  }

  async exportConversations() {
    this.log('Processing Conversation table...');
    const conversations = await prisma.conversation.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const columns = [
      'id',
      'memberOneId',
      'memberTwoId',
      'createdAt',
      'updatedAt',
    ];

    await this.exportTableAsInserts('Conversation', conversations, columns);
    if (!this.dryRun) {
      await this.exportTableAsCsv('Conversation', conversations, columns);
    }
  }

  async exportMessages() {
    this.log('Processing Message table...');
    const messages = await prisma.message.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const columns = [
      'id',
      'content',
      'fileUrl',
      'deleted',
      'memberId',
      'channelId',
      'createdAt',
      'updatedAt',
    ];

    await this.exportTableAsInserts('Message', messages, columns);
    if (!this.dryRun) {
      await this.exportTableAsCsv('Message', messages, columns);
    }
  }

  async exportDirectMessages() {
    this.log('Processing DirectMessage table...');
    const directMessages = await prisma.directMessage.findMany({
      orderBy: { createdAt: 'asc' },
    });

    const columns = [
      'id',
      'content',
      'fileUrl',
      'deleted',
      'memberId',
      'conversationId',
      'createdAt',
      'updatedAt',
    ];

    await this.exportTableAsInserts('DirectMessage', directMessages, columns);
    if (!this.dryRun) {
      await this.exportTableAsCsv('DirectMessage', directMessages, columns);
    }
  }

  async generateCombinedSqlFile() {
    if (this.dryRun) {
      this.log('Would generate combined SQL file with all table data');
      return;
    }

    this.log('Generating combined SQL file...');
    const combinedFile = path.join(
      this.exportDir,
      'complete_database_export.sql'
    );

    let combinedContent = `-- TRADERSUTOPIA Complete Database Export
-- Generated on ${new Date().toISOString()}
-- Execute these statements in order to maintain referential integrity

-- Disable foreign key checks temporarily (if needed)
-- SET session_replication_role = replica;

`;

    const tables = [
      'Profile',
      'Notification',
      'Server',
      'Member',
      'Channel',
      'Conversation',
      'Message',
      'DirectMessage',
    ];

    for (const table of tables) {
      const insertFile = path.join(
        this.exportDir,
        `${table.toLowerCase()}_inserts.sql`
      );
      if (fs.existsSync(insertFile)) {
        const content = fs.readFileSync(insertFile, 'utf8');
        combinedContent += content + '\n\n';
      }
    }

    combinedContent += `-- Re-enable foreign key checks
-- SET session_replication_role = DEFAULT;

-- Verify record counts
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
`;

    fs.writeFileSync(combinedFile, combinedContent);
    this.log(`Combined SQL file created: ${combinedFile}`);
  }

  printSummary() {
    console.log('\n' + '='.repeat(80));
    console.log(`${this.dryRun ? 'DRY RUN' : 'EXPORT'} SUMMARY`);
    console.log('='.repeat(80));

    console.log(`\n📊 DATABASE STATISTICS:`);
    console.log(`   Total Tables: ${Object.keys(this.summary.tables).length}`);
    console.log(
      `   Total Records: ${this.summary.totalRecords.toLocaleString()}`
    );
    console.log(
      `   Estimated Size: ${(this.summary.estimatedSize / 1024 / 1024).toFixed(2)} MB`
    );

    console.log(`\n📋 TABLE BREAKDOWN:`);
    Object.entries(this.summary.tables).forEach(([table, stats]) => {
      console.log(
        `   ${table.padEnd(15)}: ${stats.recordCount.toString().padStart(8)} records, ${stats.columns} columns, ${(stats.estimatedSize / 1024).toFixed(2)} KB`
      );
    });

    if (this.summary.warnings.length > 0) {
      console.log(`\n⚠️  WARNINGS (${this.summary.warnings.length}):`);
      this.summary.warnings.forEach(warning => console.log(`   • ${warning}`));
    }

    if (this.summary.errors.length > 0) {
      console.log(`\n❌ ERRORS (${this.summary.errors.length}):`);
      this.summary.errors.forEach(error => console.log(`   • ${error}`));
    }

    if (this.dryRun) {
      console.log(`\n✅ DRY RUN COMPLETED SUCCESSFULLY!`);
      console.log(`   No files were created or modified.`);
      console.log(`   Run without --dry-run to perform actual export.`);
    } else {
      console.log(`\n✅ EXPORT COMPLETED!`);
      console.log(`   Files saved to: ${this.exportDir}`);
    }

    console.log('='.repeat(80));
  }

  async exportAll() {
    try {
      this.log(`Starting database ${this.dryRun ? 'dry run' : 'export'}...`);

      // Test database connection first
      const connectionOk = await this.testDatabaseConnection();
      if (!connectionOk) {
        throw new Error('Database connection failed');
      }

      // Export in dependency order
      await this.exportProfiles();
      await this.exportNotifications();
      await this.exportServers();
      await this.exportMembers();
      await this.exportChannels();
      await this.exportConversations();
      await this.exportMessages();
      await this.exportDirectMessages();

      await this.generateCombinedSqlFile();

      this.printSummary();

      if (this.summary.errors.length > 0) {
        throw new Error(
          `Export completed with ${this.summary.errors.length} errors`
        );
      }
    } catch (error) {
      this.log(
        `${this.dryRun ? 'Dry run' : 'Export'} failed with error: ${error.message}`,
        'ERROR'
      );
      console.error('Stack trace:', error.stack);
      throw error;
    } finally {
      await prisma.$disconnect();
    }
  }
}

// Command line argument parsing
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run') || args.includes('-d');

// Run the export if this script is executed directly
if (require.main === module) {
  const exporter = new DatabaseExporter({ dryRun });
  exporter
    .exportAll()
    .then(() => {
      console.log(`${dryRun ? 'Dry run' : 'Export'} completed successfully!`);
      process.exit(0);
    })
    .catch(error => {
      console.error(`${dryRun ? 'Dry run' : 'Export'} failed:`, error.message);
      process.exit(1);
    });
}

module.exports = DatabaseExporter;
