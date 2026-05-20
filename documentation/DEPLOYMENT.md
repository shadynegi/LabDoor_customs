# Lab Door Customs - Deployment Guide

This guide covers deploying Lab Door Customs to Railway with custom domain and monitoring setup.

## Prerequisites

- Railway account (https://railway.app)
- Custom domain (optional)
- Sentry account for error tracking (optional)

---

## 1. Railway Deployment

### 1.1 Create Railway Project

1. Go to Railway dashboard and create a new project
2. Choose "Deploy from GitHub repo"
3. Connect your GitHub repository

### 1.2 Backend Service Setup

1. Click "New Service" → "GitHub Repo"
2. Select the repository and set the **Root Directory** to `backend`
3. Add the following environment variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=production
FRONTEND_URL=https://your-frontend-domain.com

# Database (from Supabase)
DATABASE_URL=postgresql://postgres:password@db.project.supabase.co:5432/postgres

# PayPal
PAYPAL_CLIENT_ID=your_live_client_id
PAYPAL_SECRET=your_live_secret
PAYPAL_MODE=live
PAYPAL_WEBHOOK_ID=your_webhook_id

# Admin Authentication
ADMIN_USERNAME=your_admin_username
ADMIN_PASSWORD=your_secure_password
JWT_SECRET=your_32_character_or_longer_secret

# Email (Resend)
RESEND_API_KEY=your_resend_api_key
SENDER_EMAIL=noreply@yourdomain.com
COMPANY_NAME=Lab Door Customs
COMPANY_SUPPORT_EMAIL=support@yourdomain.com
```

4. The build command will run automatically from `railway.json`:
   - Build: `npm install && npm run build`
   - Start: `npm start`

### 1.3 Frontend Service Setup

1. Click "New Service" → "GitHub Repo"
2. Select the same repository and set the **Root Directory** to `frontend`
3. Add environment variables:

```env
VITE_API_BASE_URL=https://your-backend-service.railway.app/api
VITE_BACKEND_URL=https://your-backend-service.railway.app
```

4. Build and start commands from `railway.json`:
   - Build: `npm install && npm run build`
   - Start: `npm start` (serves static files)

### 1.4 Verify Deployment

1. Check the deployment logs for any errors
2. Visit your backend health endpoint: `https://your-backend.railway.app/api/health`
3. Visit your frontend URL

---

## 2. Custom Domain Configuration

### 2.1 Add Domain to Railway

1. Go to your frontend service in Railway
2. Click "Settings" → "Domains"
3. Click "Custom Domain" and enter your domain (e.g., `labdoorcustoms.com`)
4. Railway will provide DNS records to configure

### 2.2 Configure DNS Records

Add these records at your domain registrar (e.g., Namecheap, GoDaddy, Cloudflare):

**For apex domain (labdoorcustoms.com):**
```
Type: CNAME
Name: @
Value: [railway-provided-value].up.railway.app
```

Note: Some registrars don't support CNAME on apex domain. In that case:
- Use Railway's provided A record IP, or
- Use a subdomain like www and redirect apex to it

**For www subdomain:**
```
Type: CNAME
Name: www
Value: [railway-provided-value].up.railway.app
```

### 2.3 SSL Certificate

Railway automatically provisions SSL certificates via Let's Encrypt. Allow up to 10 minutes for certificate issuance after DNS propagation.

### 2.4 Backend Domain (Optional)

For a custom API domain (e.g., `api.labdoorcustoms.com`):

1. Add domain to backend service in Railway
2. Configure DNS CNAME record
3. Update frontend environment variables:
   ```
   VITE_API_BASE_URL=https://api.labdoorcustoms.com/api
   VITE_BACKEND_URL=https://api.labdoorcustoms.com
   ```

---

## 3. Monitoring & Error Tracking

### 3.1 Sentry Integration (Error Tracking)

#### Backend Setup

1. Install Sentry:
   ```bash
   cd backend
   npm install @sentry/node
   ```

2. Add to `server.ts` at the top:
   ```typescript
   import * as Sentry from '@sentry/node';

   Sentry.init({
     dsn: process.env.SENTRY_DSN,
     environment: process.env.NODE_ENV || 'development',
     tracesSampleRate: 0.2, // Capture 20% of transactions
   });
   ```

3. Add environment variable to Railway:
   ```
   SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   ```

#### Frontend Setup

1. Install Sentry:
   ```bash
   cd frontend
   npm install @sentry/react
   ```

2. Add to main entry file:
   ```typescript
   import * as Sentry from '@sentry/react';

   Sentry.init({
     dsn: import.meta.env.VITE_SENTRY_DSN,
     environment: import.meta.env.MODE,
     tracesSampleRate: 0.2,
   });
   ```

3. Add environment variable:
   ```
   VITE_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
   ```

### 3.2 Railway Metrics

Railway provides built-in metrics:

1. Go to your service in Railway
2. Click "Metrics" tab
3. View CPU, Memory, and Network usage
4. Set up alerts for resource thresholds

### 3.3 Uptime Monitoring

Set up external uptime monitoring with UptimeRobot (free) or Better Uptime:

1. Create account at https://uptimerobot.com
2. Add new monitor:
   - Type: HTTP(s)
   - URL: `https://your-backend.railway.app/api/health`
   - Monitoring Interval: 5 minutes
3. Configure alerts (email, Slack, etc.)

### 3.4 Health Check Endpoint

The health endpoint at `/api/health` returns:

```json
{
  "status": "OK",
  "message": "All systems operational",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600,
  "environment": "production",
  "services": {
    "database": {
      "status": "connected",
      "latency_ms": 12
    },
    "paypal": {
      "mode": "live",
      "api": "https://api-m.paypal.com"
    }
  },
  "responseTime_ms": 15
}
```

---

## 4. Production Checklist

### Security
- [ ] Change all default passwords
- [ ] Use strong JWT secret (32+ characters)
- [ ] Enable HTTPS (automatic with Railway)
- [ ] Configure CORS for your domain only
- [ ] Set `NODE_ENV=production`

### PayPal
- [ ] Switch from sandbox to live credentials
- [ ] Configure webhook URL with your production domain
- [ ] Update `PAYPAL_MODE=live`
- [ ] Test a real transaction

### Database
- [ ] Run all schema migrations
- [ ] Verify coupons table is created
- [ ] Check RLS policies are active

### Email
- [ ] Verify sender domain in Resend
- [ ] Test order confirmation emails
- [ ] Test shipping notification emails

### Monitoring
- [ ] Set up Sentry error tracking
- [ ] Configure uptime monitoring
- [ ] Set up alert notifications

---

## 5. Troubleshooting

### Common Issues

**Build fails:**
- Check Node.js version compatibility
- Verify all dependencies are in package.json
- Check TypeScript compilation errors

**Database connection fails:**
- Verify DATABASE_URL is correct
- Check Supabase project is active
- Ensure IP is not blocked by Supabase

**CORS errors:**
- Update FRONTEND_URL in backend environment
- Ensure URLs don't have trailing slashes

**PayPal issues:**
- Verify credentials match the mode (sandbox/live)
- Check webhook URL is accessible
- Ensure webhook secret is correct

### Logs

View logs in Railway:
1. Go to your service
2. Click "Deployments" 
3. Click on active deployment
4. View real-time logs

---

## Support

For deployment issues:
- Railway Documentation: https://docs.railway.app
- Supabase Documentation: https://supabase.com/docs
- Sentry Documentation: https://docs.sentry.io
