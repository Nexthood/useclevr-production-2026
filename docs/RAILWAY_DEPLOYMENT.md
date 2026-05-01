# UseClevr - Railway Deployment Guide

## Quick Start

1. **Connect GitHub repository to Railway**
   - Go to [railway.app](https://railway.app)
   - Create new project → Connect GitHub
   - Select: `Nexthood/useclevr-production-2026`

2. **Configure environment variables**
   - Copy all required variables from `.env.railway.example`
   - Add to Railway project settings

3. **Deploy**
   - Push to the deployment branch configured in Railway
   - Watch deployment status in Railway dashboard

---

## Configuration Files

### `railway.json` (This file)
- **Build**: Uses Nixpacks with Node 22 and pnpm
- **Deploy**:
  - Auto-restart on failure (up to 5 retries)
  - Health checks every 10s
  - Resources: 512Mi memory, 500m CPU

### `.env.railway.example`
Template for all required environment variables (copy to Railway secrets panel)

### `package.json`
Railway commands are driven by pnpm scripts. For the production web-app bundle:
- Build: `pnpm prod:build`
- Start: `pnpm prod:start`

`pnpm prod:build` creates `dist/` as a standalone production app containing `server.js`, `dist/.next/`, and `dist/public/`. Environment files are not copied into `dist`.

---

## Required Environment Variables

### Database (Neon PostgreSQL)
```
DATABASE_URL=postgresql://user:password@host.neon.tech/dbname
DIRECT_URL=postgresql://user:password@host.neon.tech/dbname?sslmode=require
```

### Authentication (NextAuth v5)
```
AUTH_SECRET=<generate: openssl rand -base64 32>
# Optional only for custom domains/proxies:
# AUTH_URL=https://your-app.railway.app
```

### AI Provider
```
GEMINI_API_KEY=<from https://aistudio.google.com/app/apikey>
```

### Proxy Configuration
```
TRUST_PROXY=true
```

---

## Deployment Checklist

- [ ] GitHub repository connected
- [ ] All required secrets added to Railway
- [ ] Database URL verified (test connection)
- [ ] AUTH_SECRET generated (min 32 chars)
- [ ] Gemini API key configured
- [ ] Domain configured (custom or railway.app)
- [ ] SSL certificate auto-configured (Railway handles)
- [ ] Health check endpoint working (`/api/health`)

---

## Monitoring & Troubleshooting

### Logs
```bash
# View Railway logs (in dashboard or CLI)
railway logs
```

### Common Issues

**"Health check failed"**
- Ensure `/api/health` endpoint exists
- Check database connection
- Verify health check timeout (default 30s)

**"Database connection refused"**
- Verify DATABASE_URL is correct
- Check Neon network allowlist includes Railway IP
- Use DIRECT_URL for direct connection

**"AUTH_SECRET is missing"**
- Generate: `openssl rand -base64 32`
- Add to Railway secrets (restart deployment)

**"Out of memory"**
- Current limit: 512Mi
- Increase in railway.json `memoryLimit`
- Monitor with Railway dashboard metrics

---

## Security Best Practices

✅ **Implemented:**
- All secrets stored in Railway vault (not in code)
- HTTPS enforced via Railway
- Reverse proxy security headers (X-Frame-Options, etc)
- Database SSL connection required
- No hardcoded credentials

✅ **Additional Recommendations:**
- Enable Railway VPN/Private Networks if available
- Regularly rotate `AUTH_SECRET` and API keys
- Monitor Railway audit logs for suspicious activity
- Use IP allowlisting if possible

---

## Performance Optimization

### Current Settings
- **Memory**: 512Mi (suitable for small-medium traffic)
- **CPU**: 500m shared runtime
- **Build Cache**: Railway/Nixpacks cache
- **Unoptimized Images**: Enabled (faster builds)

### Scaling Tips
- Monitor CPU/memory in Railway dashboard
- Increase resources if approaching limits
- Consider Railway Pro for better performance
- Enable auto-scaling if available

---

## Backup & Disaster Recovery

### Database Backups
- Neon handles automatic backups (7-day retention)
- Manual backups via Neon dashboard
- Export data regularly for safety

### Rollback Strategy
1. Previous deployment available in Railway
2. Simply click "Redeploy" on previous build
3. No data loss (database separate from app)

---

## Deployment Workflow

```
Local Development
      ↓
  git commit
      ↓
  git push origin main
      ↓
GitHub webhook triggered
      ↓
Railway detects push
      ↓
Nixpacks build starts
      ↓
Tests run (if configured)
      ↓
Deploy to production
      ↓
Health checks run
      ↓
App goes live
```

---

## Next Steps

1. **First Deployment**
   - Follow "Quick Start" above
   - Monitor first deployment in Railway dashboard
   - Test core functionality

2. **Post-Launch**
   - Set up monitoring alerts
   - Configure custom domain
   - Verify database backups

3. **Ongoing**
   - Monitor performance metrics
   - Update dependencies monthly
   - Review security logs
   - Rotate secrets periodically

---

## Support & Resources

- **Railway Docs**: https://docs.railway.app
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **Neon Docs**: https://neon.tech/docs
- **NextAuth v5**: https://authjs.dev

---

## Auto-Generated Info

- **Build Duration**: ~2-3 minutes
- **Startup Time**: ~30 seconds
- **Port**: 8080 (internal)
- **Node Version**: 20 LTS
- **Database**: PostgreSQL 15+ (Neon)
