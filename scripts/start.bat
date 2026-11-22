@echo off
cd /d "%~dp0.."
docker build -t pmapp . || exit /b 1
docker rm -f pmapp >nul 2>&1
docker run --rm -u 0 -v pmapp-data:/data --entrypoint chown pmapp -R app /data
docker run -d --name pmapp -p 127.0.0.1:8001:8000 -v pmapp-data:/data --env-file .env pmapp
echo Running at http://localhost:8001
