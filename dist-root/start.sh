#!/bin/sh
set -e
cd /app/dist
exec sh start.sh "$@"
