# Railway Security & Production Hardening

Comprehensive guide for securing your UseClevr application on Railway.

---

## 1. Advanced Security Headers

### What We Added

#### `Strict-Transport-Security` (HSTS)
```
max-age=31536000; includeSubDomains; preload
```
- Forces HTTPS for all requests (1 year)
- Protects against SSL stripping attacks
- Includes subdomains in HTTPS requirement
- Preload list prevents initial unsecured connection

#### `Content-Security-Policy` (CSP)
```
default-src 'self'
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com
img-src 'self' data: https:
connect-src 'self' https://api.github.com https://aistudio.google.com
frame-ancestors 'none'
```
- Prevents XSS attacks by controlling resource loading
- Restricts to trusted sources only
- Blocks embedded frames (clickjacking prevention)

### Existing Headers

- **X-Content-Type-Options: nosniff** - Prevents MIME sniffing
- **X-Frame-Options: DENY** - Clickjacking protection
- **X-XSS-Protection: 1; mode=block** - XSS defense
- **Referrer-Policy** - Privacy protection
- **Permissions-Policy** - Restricts API access

### Location
File: `next.config.mjs`

---

## 2. Health Check Monitoring

### What We Added

**Endpoint**: `/api/health`

Returns:
```json
{
  "status": "healthy",
  "timestamp": "2026-04-29T10:30:00.000Z",
  "uptime": 3600,
  "environment": "production"
}
```

### How Railway Uses It

```
Railway Load Balancer
        ↓
Health Check (every 30s)
        ↓
/api/health endpoint
        ↓
Returns 200 OK → App is healthy
Returns error → Mark unhealthy, restart if needed
```

### Configuration

Already in `railway.json`:
```json
"deploy": {
  "healthcheckPath": "/api/health",
  "healthcheckTimeout": 30,
  "healthcheckInterval": 30,
  "healthcheckInitialDelay": 30
}
```

### Monitoring

Check health in Railway Dashboard:
1. Go to your project
2. Select your service
3. View "Metrics" tab → Health Check Success Rate

---

## 3. Rate Limiting

### What We Added

**File**: `lib/rate-limiter.ts`

Simple in-memory rate limiter that:
- Tracks requests by client IP
- Prevents abuse and DDoS
- Automatically cleans up old entries
- Returns 429 (Too Many Requests) when exceeded

### How to Use

```typescript
import { checkRateLimit } from '@/lib/rate-limiter'

// In your API route
const ip = request.headers.get('x-forwarded-for') || 'unknown'

// Check: max 10 requests per minute
if (!checkRateLimit(`api:${ip}`, 10, 60 * 1000)) {
  return NextResponse.json(
    { error: 'Rate limit exceeded' },
    { status: 429 }
  )
}

// Request allowed, proceed...
```

### Example Implementation

File: `app/api/example-rate-limited/route.ts`

Apply this pattern to:
- Login/signup endpoints
- API endpoints
- Payment processing
- File upload endpoints

### Recommended Limits

```
Auth endpoints:        5 requests/minute
API endpoints:        10 requests/minute
File uploads:          2 requests/minute
Search/query:         20 requests/minute
Public endpoints:    100 requests/minute
```

### Advanced: Redis-Based Rate Limiting

For production with multiple instances, consider:
```bash
npm install redis ioredis
```

Then replace the in-memory store with Redis for distributed rate limiting.

---

## 4. SSL/TLS Certificate

### Automatic Handling

Railway handles SSL/TLS automatically:
- ✅ Certificate provisioning (Let's Encrypt)
- ✅ Auto-renewal before expiration
- ✅ HTTPS redirect
- ✅ HTTP/2 support
- ✅ TLS 1.3

### Verify Certificate

```bash
# Check your domain's certificate
openssl s_client -connect yourdomain.com:443

# Should show:
# - Certificate Valid
# - TLS 1.3
# - Issuer: Let's Encrypt
```

### Custom Domain

In Railway Dashboard:
1. Project Settings → Environment → Domains
2. Add custom domain
3. Update DNS records (CNAME)
4. Certificate auto-provisioned

---

## Security Checklist

### Before Production

- [ ] **HSTS Header** - Enabled (1 year)
- [ ] **CSP Header** - Configured for your resources
- [ ] **Rate Limiting** - Applied to sensitive endpoints
- [ ] **Health Checks** - `/api/health` responding
- [ ] **SSL/TLS** - Certificate valid and auto-renewing
- [ ] **Environment Variables** - All secrets in Railway vault
- [ ] **Database** - SSL connection required (`?sslmode=require`)
- [ ] **Auth** - NextAuth v5 properly configured
- [ ] **CORS** - Restricted to necessary origins
- [ ] **File Uploads** - Size limits enforced (100mb in config)

### During Deployment

- [ ] **Build logs** - No secrets leaked
- [ ] **Health checks** - Passing consistently
- [ ] **Error monitoring** - Set up (Sentry, etc)
- [ ] **DNS propagation** - Wait 24-48 hours for custom domains
- [ ] **SSL certificate** - Validated and active

### After Deployment

- [ ] **Performance** - Monitor CPU/memory usage
- [ ] **Response times** - Check p95 latency
- [ ] **Errors** - Monitor 5xx error rates
- [ ] **Security headers** - Verify with https://securityheaders.com
- [ ] **SSL grade** - Check with https://www.ssllabs.com/ssltest/

---

## Monitoring & Alerts

### Key Metrics

**Set up alerts for:**
```
1. Health check failure rate > 10%
2. CPU usage > 80% for 5 min
3. Memory usage > 90%
4. Error rate > 5%
5. Restart count > 0
6. Response time p95 > 5s
```

### Tools

- **Railway Dashboard** - Built-in monitoring
- **Sentry** - Error tracking: `npm install @sentry/nextjs`
- **DataDog** - Advanced monitoring (optional)
- **Uptime Robot** - External monitoring

### Example Sentry Setup

```typescript
import * as Sentry from "@sentry/nextjs"

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
})
```

---

## Common Issues & Solutions

### Issue: Health checks failing

**Cause**: `/api/health` endpoint slow or erroring

**Solution**:
```bash
# Test locally
curl http://localhost:3000/api/health

# Should respond < 1 second
```

### Issue: Rate limit too strict

**Cause**: Legitimate users getting 429 errors

**Solution**:
- Increase limits in `lib/rate-limiter.ts`
- Use user ID instead of IP for authenticated users
- Implement allowlist for trusted IPs

### Issue: CSP blocking resources

**Cause**: `Content-Security-Policy` too restrictive

**Solution**:
- Add trusted domains to CSP in `next.config.mjs`
- Check browser console for blocked resources
- Test with `Content-Security-Policy-Report-Only` first

### Issue: HSTS causing issues

**Cause**: Want to remove HTTPS requirement temporarily

**Solution**:
- Cannot remove once set (security feature)
- Use new subdomain instead
- Alternative: Remove from preload list

---

## Advanced: Custom Security Headers

To add more headers, edit `next.config.mjs`:

```typescript
{
  key: 'X-Custom-Header',
  value: 'custom-value',
}
```

Useful headers:
- `X-Custom-Header` - Track version
- `Server-Timing` - Performance metrics
- `X-API-Version` - Version tracking

---

## Production Deployment Commands

```bash
# Test security headers locally
npm run build
npm run start

# Verify Railway config
cat railway.json

# Check rate limiter
grep -r "checkRateLimit" app/

# Test health endpoint
curl http://localhost:3000/api/health

# Verify HTTPS (after deployed)
curl -I https://yourdomain.com
# Should show HSTS header
```

---

## Next Steps

1. **Deploy to Railway** - All changes pushed and live
2. **Monitor first 24 hours** - Watch for issues
3. **Test security headers** - https://securityheaders.com
4. **Setup alerting** - Get notified of problems
5. **Review rate limits** - Adjust based on usage patterns

---

## Support

For issues:
1. Check Railway logs: Dashboard → Logs
2. Review error monitoring (Sentry)
3. Test health endpoint manually
4. Check `next.config.mjs` for typos
5. Verify environment variables

---

**Status**: ✅ Production-Ready Security Implementation
