import postgres from 'postgres';

// Handle missing environment variable gracefully during build
let sql: any;

if (!process.env.SOURCEMESSAGES_DATABASE_URL) {
  console.warn(
    'SOURCEMESSAGES_DATABASE_URL is not set - source messages feature will be disabled'
  );

  // Create a mock sql function that throws at runtime, not build time
  const mockSql = () => {
    throw new Error(
      'Source messages database not configured - SOURCEMESSAGES_DATABASE_URL is missing'
    );
  };

  // Add properties that postgres sql object would have
  Object.assign(mockSql, {
    begin: () =>
      Promise.reject(new Error('Source messages database not configured')),
    end: () => Promise.resolve(),
  });

  sql = mockSql;
} else {
  sql = postgres(process.env.SOURCEMESSAGES_DATABASE_URL, {
    max: 1,
  });
}

export default sql;
