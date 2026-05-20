# Deployment Guide - Lab Door Customs

Complete guide for deploying the Lab Door Customs application to production.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [Backend Deployment](#backend-deployment)
4. [Frontend Deployment](#frontend-deployment)
5. [PayPal Configuration](#paypal-configuration)
6. [Post-Deployment](#post-deployment)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Accounts

- [ ] **Supabase** - Database hosting (free tier available)
- [ ] **Vercel/Railway** - Backend hosting (recommended)
- [ ] **Vercel/Netlify** - Frontend hosting (recommended)
- [ ] **PayPal Business** - Payment processing (live account)
- [ ] **Domain** - Custom domain (optional)

### Local Setup Complete

Ensure you have:
- [ ] Tested application locally
- [ ] All features working
- [ ] PayPal sandbox payments successful
- [ ] All environment variables documented

## Database Setup

### 1. Supabase Production Database

```bash
# 1. Create new Supabase project for production
# Project name: gaultier-shoe-store-prod
# Choose production-appropriate region
```

### 2. Run Database Migrations

1. Go to Supabase SQL Editor
2. Run `backend/src/database/schema.sql`
3. **DO NOT** run `seed.sql` in production
4. Verify all tables created:
   - products
   - orders
   - contact_messages

### 3. Configure Row Level Security

```sql
-- Verify RLS is enabled
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Should show TRUE for all tables
```

### 4. Get Production Credentials

In Supabase Dashboard → Settings → API:
- Copy **Project URL**
- Copy **service_role** key (secret)
- Save these for backend deployment

## Backend Deployment

### Option 1: Vercel (Recommended)

#### Setup

```bash
cd backend
npm install -g vercel
vercel login
```

#### Create vercel.json

```json
{
  "version": 2,
  "builds": [
    {
      "src": "dist/server.js",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "dist/server.js"
    }
  ]
}
```

#### Deploy

```bash
# Build first
npm run build

# Deploy
vercel --prod
```

#### Set Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

```env
NODE_ENV=production
PORT=5000
FRONTEND_URL=https://your-frontend-domain.vercel.app

SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_KEY=your_production_service_role_key

PAYPAL_CLIENT_ID=your_live_paypal_client_id
PAYPAL_SECRET=your_live_paypal_secret
PAYPAL_MODE=live
```

### Option 2: Railway

#### Deploy

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Initialize
railway init

# Deploy
railway up
```

#### Environment Variables

Add same variables as Vercel through Railway dashboard.

### Option 3: Heroku

```bash
# Login
heroku login

# Create app
heroku create gaultier-shoe-store-api

# Set environment variables
heroku config:set NODE_ENV=production
heroku config:set SUPABASE_URL=your_url
# ... set all other variables

# Deploy
git push heroku main
```

## Frontend Deployment

### Option 1: Vercel (Recommended)

#### Setup

```bash
cd frontend
vercel login
```

#### Update Environment Variables

Create `.env.production`:

```env
VITE_API_BASE_URL=https://your-backend.vercel.app/api
VITE_BACKEND_URL=https://your-backend.vercel.app
```

#### Deploy

```bash
# Build
npm run build

# Deploy
vercel --prod
```

#### Configure Vercel Settings

In `vercel.json`:

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

### Option 2: Netlify

#### netlify.toml

Create `netlify.toml`:

```toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

#### Deploy

```bash
# Install Netlify CLI
npm install -g netlify-cli

# Login
netlify login

# Deploy
netlify deploy --prod
```

#### Environment Variables

Add in Netlify Dashboard → Site Settings → Environment Variables:
- `VITE_API_BASE_URL`
- `VITE_BACKEND_URL`

### Option 3: Cloudflare Pages

```bash
# Build locally
npm run build

# Deploy via dashboard
# Upload dist/ folder
```

## PayPal Configuration

### 1. Get Live Credentials

1. Go to [PayPal Developer Dashboard](https://developer.paypal.com/)
2. Switch to **Live** mode
3. Create new app or use existing
4. Copy **Live** Client ID and Secret

### 2. Configure Webhooks (Optional)

1. In PayPal Dashboard → Webhooks
2. Add webhook URL: `https://your-backend.com/api/paypal/webhook`
3. Select events:
   - Payment capture completed
   - Payment capture denied
   - Payment capture refunded

### 3. Test Live Payments

⚠️ **Important:** Test with small amounts first!

1. Use real PayPal account
2. Make test purchase ($1)
3. Verify order created in database
4. Check email notifications
5. Refund test payment

## Post-Deployment

### 1. Update CORS

In `backend/src/server.ts`, verify CORS:

```typescript
app.use(cors({
  origin: [
    'https://your-production-domain.com',
    'https://www.your-production-domain.com'
  ],
  credentials: true,
}));
```

### 2. SSL/HTTPS

Ensure both frontend and backend use HTTPS:
- Vercel/Netlify provide automatic HTTPS
- Custom domains need SSL certificates

### 3. Custom Domain (Optional)

#### Frontend
1. Add domain in Vercel/Netlify dashboard
2. Update DNS records:
   ```
   A     @      76.76.21.21
   CNAME www    your-app.vercel.app
   ```

#### Backend
1. Add domain in hosting dashboard
2. Update `FRONTEND_URL` in backend env

### 4. Environment Variables Checklist

**Backend:**
- [ ] `NODE_ENV=production`
- [ ] `FRONTEND_URL` (production URL)
- [ ] `SUPABASE_URL` (production)
- [ ] `SUPABASE_KEY` (production)
- [ ] `PAYPAL_CLIENT_ID` (live)
- [ ] `PAYPAL_SECRET` (live)
- [ ] `PAYPAL_MODE=live`

**Frontend:**
- [ ] `VITE_API_BASE_URL` (production)
- [ ] `VITE_BACKEND_URL` (production)

### 5. Database Backup

Setup automated backups in Supabase:
1. Go to Database → Backups
2. Enable Point-in-Time Recovery
3. Configure backup schedule

## Monitoring

### 1. Error Tracking

Add Sentry (recommended):

```bash
npm install @sentry/node
```

```typescript
// backend/src/server.ts
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
});
```

### 2. Uptime Monitoring

Use:
- **UptimeRobot** (free)
- **Pingdom**
- **Better Uptime**

Monitor:
- Frontend: `https://your-domain.com`
- Backend: `https://your-api.com/api/health`

### 3. Analytics

Add Google Analytics or Plausible:

```html
<!-- In index.html -->
<script async src="https://www.googletagmanager.com/gtag/js?id=GA_MEASUREMENT_ID"></script>
```

### 4. Logging

Check logs regularly:
- Vercel: Dashboard → Logs
- Railway: Dashboard → Logs
- Supabase: Dashboard → Logs

## Security Checklist

- [ ] All environment variables set correctly
- [ ] No secrets in code repository
- [ ] HTTPS enabled on all domains
- [ ] CORS configured for production domains only
- [ ] Row Level Security enabled on database
- [ ] Rate limiting implemented (optional)
- [ ] PayPal webhooks validated (optional)
- [ ] Database backups enabled
- [ ] Error tracking setup
- [ ] Security headers configured

### Security Headers (Optional)

Add in `server.ts`:

```typescript
import helmet from 'helmet';
app.use(helmet());
```

## Performance Optimization

### Frontend

1. **Image Optimization**
   - Compress images
   - Use WebP format
   - Lazy loading

2. **Code Splitting**
   - Already handled by Vite
   - Check bundle size: `npm run build`

3. **CDN**
   - Vercel/Netlify provide automatic CDN
   - Assets served from edge locations

### Backend

1. **Database Indexing**
   - Already created in schema.sql
   - Monitor slow queries in Supabase

2. **Caching**
   - Add Redis for session caching (future)
   - Cache product data (future)

3. **Rate Limiting**
   ```bash
   npm install express-rate-limit
   ```

## Troubleshooting

### Issue: CORS Errors

**Solution:**
1. Check `FRONTEND_URL` in backend env
2. Verify CORS configuration
3. Ensure both URLs use HTTPS

### Issue: PayPal Payments Fail

**Solution:**
1. Verify `PAYPAL_MODE=live`
2. Check live credentials
3. Review PayPal dashboard errors
4. Ensure webhook URL is accessible

### Issue: Database Connection Fails

**Solution:**
1. Check `SUPABASE_URL` and `SUPABASE_KEY`
2. Verify RLS policies
3. Check Supabase dashboard for errors
4. Ensure service_role key is used

### Issue: 404 on Frontend Routes

**Solution:**
1. Configure redirects (vercel.json/netlify.toml)
2. Ensure SPA routing is enabled
3. Check deployment settings

### Issue: Environment Variables Not Working

**Solution:**
1. Rebuild after changing variables
2. Check variable names (especially VITE_ prefix)
3. Verify in hosting dashboard
4. Clear cache and redeploy

## Rollback Plan

If deployment fails:

1. **Frontend:** Vercel/Netlify keep previous deployments
   - Dashboard → Deployments → Rollback

2. **Backend:** Railway/Vercel keep previous deployments
   - Dashboard → Deployments → Rollback

3. **Database:** Use Supabase backup
   - Dashboard → Database → Backups → Restore

## Maintenance

### Regular Tasks

**Weekly:**
- [ ] Check error logs
- [ ] Review failed payments
- [ ] Monitor uptime status

**Monthly:**
- [ ] Review analytics
- [ ] Update dependencies
- [ ] Check database performance
- [ ] Review and respond to contact forms

**Quarterly:**
- [ ] Security audit
- [ ] Performance optimization
- [ ] Backup verification
- [ ] Update documentation

## Cost Estimates

### Free Tier (Development)

- **Supabase:** Free (500MB database, 50,000 requests/month)
- **Vercel:** Free (100GB bandwidth/month)
- **Netlify:** Free (100GB bandwidth/month)

**Total: $0/month**

### Production (Estimated)

- **Supabase Pro:** $25/month (8GB database, 5M requests)
- **Vercel Pro:** $20/month (1TB bandwidth)
- **Domain:** $10-15/year
- **PayPal:** 2.9% + $0.30 per transaction

**Total: ~$45-50/month + transaction fees**

## Support

For deployment issues:
- **Vercel:** [Vercel Support](https://vercel.com/support)
- **Supabase:** [Supabase Discord](https://discord.supabase.com/)
- **PayPal:** [PayPal Developer Support](https://www.paypal.com/us/smarthelp/contact-us)

## Success Criteria

Deployment is successful when:
- [ ] Frontend loads on production URL
- [ ] Backend API responds to health check
- [ ] Products load from database
- [ ] Cart functionality works
- [ ] Checkout form validates
- [ ] PayPal live payment completes
- [ ] Order saved to database
- [ ] Success page displays
- [ ] Contact form submits
- [ ] No console errors
- [ ] Mobile responsive
- [ ] HTTPS enabled
- [ ] Domain configured (if using)

## Next Steps After Deployment

1. Announce launch on social media
2. Set up customer support email
3. Create marketing materials
4. Set up email notifications
5. Add Google Analytics
6. Create backup/disaster recovery plan
7. Document admin procedures
8. Train support team

---

**Congratulations on your deployment! 🎉**

For questions: support@gaultiershoes.com

Last Updated: December 2024

