#!/bin/sh
set -e
cd "$(dirname "$0")/.."
docker build -t pmapp .
docker rm -f pmapp >/dev/null 2>&1
# The app runs as a non-root user; make sure it owns the data volume.
docker run --rm -u 0 -v pmapp-data:/data --entrypoint chown pmapp -R app /data
docker run -d --name pmapp -p 127.0.0.1:8001:8000 -v pmapp-data:/data --env-file .env pmapp
echo "Running at http://localhost:8001"
