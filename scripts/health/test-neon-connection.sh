#!/bin/bash
set -e

# Load environment from .env.local
set -o allexport
source .env.local 2>/dev/null || true
set +o allexport

DB_URL="${NEON_DATABASE_URL:-${DIRECT_URL:-${DATABASE_URL:-}}}"

if [ -z "$DB_URL" ]; then
  echo "Error: set NEON_DATABASE_URL, DIRECT_URL, or DATABASE_URL in .env.local"
  exit 1
fi

echo "Testing Neon connection..."
echo "URL: ${DB_URL:0:50}..."

# Use timeout to prevent hanging
timeout 15 psql "$DB_URL" -c "SELECT version();" || {
  code=$?
  if [ $code -eq 124 ]; then
    echo ""
    echo "Connection timed out after 15 seconds."
    echo "This may indicate network connectivity issues or firewall blocking."
  else
    echo ""
    echo "Connection failed with code $code"
  fi
  exit $code
}
