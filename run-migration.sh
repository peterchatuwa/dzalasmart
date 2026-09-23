#!/bin/bash
# Run database migration for farmer app tables

cd /opt/nzeru-za-alimi

# Check if we're using SQLite or PostgreSQL
if [ -f "server/database.sqlite" ]; then
  echo "Using SQLite database..."
  sqlite3 server/database.sqlite < add-farmer-app-tables.sql
  echo "✓ Migration completed"
elif command -v psql &> /dev/null; then
  echo "Using PostgreSQL database..."
  # Run with PostgreSQL
  psql $DATABASE_URL < add-farmer-app-tables.sql
  echo "✓ Migration completed"
else
  echo "Database not found"
  exit 1
fi

# Restart the service
systemctl restart nzeru-za-alimi.service
echo "✓ Service restarted"
