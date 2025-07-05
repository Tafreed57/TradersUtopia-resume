import postgres from 'postgres';

if (!process.env.SOURCEMESSAGES_DATABASE_URL) {
  throw new Error('SOURCEMESSAGES_DATABASE_URL is not set');
}

const sql = postgres(process.env.SOURCEMESSAGES_DATABASE_URL, {
  max: 1,
});

export default sql;
