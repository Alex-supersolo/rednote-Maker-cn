# Deploy Guide

## Server Info (Current)
- Panel: Baota Linux Panel
- Project path: `/www/wwwroot/noteMaker`
- Process name: `rednote-maker`
- App port: `3000`

## First-Time Setup
1. Pull code:
```bash
cd /www/wwwroot
git clone <repo-url> noteMaker
cd /www/wwwroot/noteMaker
```
2. Configure env:
```bash
cat > .env.local <<EOF
DEEPSEEK_API_KEY=YOUR_KEY
PORT=3000
EOF
```
3. Install and build:
```bash
npm install
npm run build
```
4. Start service:
```bash
pm2 start server.js --name rednote-maker
pm2 save
```

## Update Deployment
```bash
cd /www/wwwroot/noteMaker
git pull origin main
npm install
npm run build
pm2 restart rednote-maker
pm2 save
```

## Health Checks
```bash
pm2 status
pm2 logs rednote-maker --lines 100
curl -I http://127.0.0.1:3000
```

## Baota Routing Notes
- If using Node project panel, configure domain mapping/external mapping to project port `3000`.
- If using classic site reverse proxy, target should be `http://127.0.0.1:3000`.

