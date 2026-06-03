#!/bin/sh
# Loads .env so railway CLI picks up RAILWAY_API_TOKEN from it.
set -a
. "$(dirname "$0")/../../../.env"
set +a
unset RAILWAY_TOKEN
exec railway "$@"
