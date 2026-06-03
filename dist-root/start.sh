#!/bin/sh
set -e
cd dist
exec sh start.sh "$@"
