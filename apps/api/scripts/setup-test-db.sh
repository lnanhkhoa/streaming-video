#!/bin/bash
# Setup test database for integration tests

set -e

echo "🧪 Setting up test database..."

# Database connection details
DB_HOST="localhost"
DB_PORT="5445"
DB_USER="postgres"
DB_PASSWORD="password"
DB_NAME="streaming_video_test"

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER > /dev/null 2>&1; then
  echo "❌ PostgreSQL is not running on $DB_HOST:$DB_PORT"
  echo "Please start PostgreSQL with: docker-compose -f docker-compose.dev.yml up -d postgres"
  exit 1
fi

echo "✅ PostgreSQL is running"

# Drop test database if it exists
echo "🗑️  Dropping existing test database (if exists)..."
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "DROP DATABASE IF EXISTS $DB_NAME;" 2>/dev/null || true

# Create test database
echo "📦 Creating test database: $DB_NAME"
PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME;"

# Run migrations on test database
echo "🔄 Running migrations on test database..."
cd ../../packages/database
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME" bunx prisma migrate deploy

echo "✅ Test database setup complete!"
echo ""
echo "Test database: postgresql://$DB_USER:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_NAME"
echo ""
echo "You can now run tests with: bun test"
