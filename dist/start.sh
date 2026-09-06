#!/bin/sh
set -e
export USECLEVR_SERVER_TARGET=railway
exec node -r ./scripts/runtime/load-env.cjs ./scripts/runtime/start-dist.cjs "$@"
