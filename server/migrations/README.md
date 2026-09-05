# Database Migrations

This directory contains database migration files for the Nzeru za Alimi application.

## Creating a Migration

```bash
npm run migrate:create -- migration_name
```

This will create a new migration file with a timestamp prefix.

## Running Migrations

```bash
npm run migrate
```

This will run all pending migrations in order.

## Migration File Format

Each migration file exports two functions:

```javascript
export async function up(db) {
  // Apply the migration
  await db.query(`
    CREATE TABLE example (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    )
  `);
}

export async function down(db) {
  // Rollback the migration
  await db.query(`DROP TABLE IF EXISTS example`);
}
```

## Migration Tracking

Migrations are tracked in the `schema_migrations` table. Each migration is run exactly once.
