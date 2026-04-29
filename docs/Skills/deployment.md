# Deployment Skill

## Description
Handles deployment to Railway with Docker, focusing on configuration and troubleshooting.

## Capabilities
- Railway deployment setup
- Docker configuration
- Environment variables
- Health checks
- Troubleshooting deployment

## Files
- `Dockerfile` - Multi-stage Docker build
- `railway.json` - Railway configuration
- `.env.railway.example` - Environment template

## Railway Configuration

### Key Settings
- Port: 8080
- Health check: /api/health
- Memory: 1Gi
- CPU: 1000m

## Environment Variables Required
- DATABASE_URL
- DIRECT_URL
- AUTH_SECRET
- NEXTAUTH_URL
- NEXT_PUBLIC_APP_URL
- GEMINI_API_KEY

## Troubleshooting

### Build Failures
- Check Dockerfile syntax
- Verify Node.js version compatibility
- Review package dependencies

### Runtime Issues
- Check health endpoint: /api/health
- Review Railway logs: `railway logs`
- Verify environment variables

### Website Not Loading
1. Check health endpoint response
2. Review deployment logs
3. Verify DATABASE_URL
4. Check security headers

## Commands
```bash
railway deploy        # Deploy
railway logs        # View logs
railway status     # Check status
railway open      # Open in browser
```