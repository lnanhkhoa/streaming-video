#!/bin/bash
# Run integration tests with Docker test database

set -e

# Get the directory of this script
DIR="$(cd "$(dirname "$0")" && pwd)"

# Add coreutils to PATH for timeout command (macOS)
export PATH="/opt/homebrew/opt/coreutils/libexec/gnubin:$PATH"

# Load environment variables from .env.test
source "$DIR/setenv.sh"

# Cleanup function to stop and remove the test database container
cleanup() {
  echo "🧹 Cleaning up test database..."
  docker-compose -f ../../docker-compose.test.yml down
}

# Set trap to ensure cleanup runs on exit (success or failure)
trap cleanup EXIT

echo "🐳 Starting Docker test database..."
# Start Docker container in detached mode
docker-compose -f ../../docker-compose.test.yml up -d

echo "⏳ Waiting for database to be ready..."
# Wait for the database to be ready
# Extract host and port from DATABASE_URL
DB_HOST="localhost"
DB_PORT="5433"

"$DIR/wait-for-it.sh" "$DB_HOST:$DB_PORT" --timeout=60 --strict -- echo "✅ Database is ready!"

echo "🔄 Running Prisma migrations..."
# Run Prisma migrations on test database
cd ../../packages/database
bunx prisma migrate deploy
cd ../../apps/api

echo "🧪 Running integration tests..."
# Run tests with or without UI based on flag
if [ "$1" = "--ui" ]; then
  bunx vitest --ui
else
  bunx vitest run
fi

# Cleanup will be handled by the EXIT trap
