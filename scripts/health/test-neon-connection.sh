#!/bin/bash
set -e

# Load environment from .env.local
set -o allexport
source .env.local 2>/dev/null || true
set +o allexport

if [ -z "$NEON_DATABASE_URL" ]; then
  echo "Error: NEON_DATABASE_URL not set in .env.local"
  exit 1
fi

echo "Testing Neon connection..."
echo "URL: ${NEON_DATABASE_URL:0:50}..."

# Use timeout to prevent hanging
timeout 15 psql "$NEON_DATABASE_URL" -c "SELECT version();" || {
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
