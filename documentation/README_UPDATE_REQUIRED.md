# README Updates Required

Add these sections to the main README.md files:

## For Root README.md

Add after installation section:

```markdown
## ⚠️ Important: Environment Setup

Both frontend and backend require `.env` files:

### Backend (.env)
```bash
cd backend
cp env.template .env
```

Then edit `backend/.env` with your credentials:
- Supabase URL and Key
- PayPal Client ID and Secret

### Frontend (.env)
```bash
cd frontend
cp env.template .env
```

Edit `frontend/.env` with backend URLs (usually defaults are fine for local development).

**Without these files, the application will not work!**

## 🐛 Known Issues

See `BUGS_AND_FIXES.md` for:
- Current bugs and their fixes
- Missing features
- Planned improvements

## 🔧 Critical Fixes Required

Before running in production, apply fixes from `CRITICAL_FIXES_TODO.md`:
1. Product loading from API
2. Pricing calculations
3. Error handling
4. Loading states

```

## For backend/README.md

Add after Quick Start:

```markdown
## ⚠️ Environment Variables Required

The server will not start without a valid `.env` file.

**Required variables:**
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase service role key
- `PAYPAL_CLIENT_ID` - PayPal application client ID
- `PAYPAL_SECRET` - PayPal application secret

**Optional variables:**
- `PORT` - Server port (default: 5000)
- `FRONTEND_URL` - Frontend URL for CORS (default: http://localhost:5173)
- `PAYPAL_MODE` - sandbox or live (default: sandbox)

## Startup Validation

The server validates environment variables on startup:
- Missing `SUPABASE_URL` → Error
- Missing `SUPABASE_KEY` → Error
- Missing PayPal credentials → Warning (can test other features)

```

## For SETUP_GUIDE.md

Add prominent warning at the top:

```markdown
# ⚠️ CRITICAL: Read This First!

## Prerequisites Checklist

Before starting setup, ensure you have:

- [ ] Node.js 18+ installed
- [ ] npm or yarn installed
- [ ] Supabase account created
- [ ] PayPal developer account created
- [ ] Read `BUGS_AND_FIXES.md` for known issues
- [ ] Applied fixes from `CRITICAL_FIXES_TODO.md` (if applicable)

## Known Issues

This project has some critical issues that need fixing:

1. **Products are hardcoded** - Need to fetch from API
2. **Pricing calculation bug** - Fixed in CRITICAL_FIXES_TODO.md
3. **Missing error handling** - Needs improvement

See `BUGS_AND_FIXES.md` for complete list and `CRITICAL_FIXES_TODO.md` for fixes.

```

## For QUICK_START.md

Add after Step 2:

```markdown
## ⚠️ Common Startup Issues

### "Missing SUPABASE_URL" Error
**Cause:** Backend `.env` file not created or missing variables  
**Fix:** 
```bash
cd backend
cp env.template .env
# Edit .env with your credentials
```

### "Cannot connect to backend"
**Cause:** Backend not running or wrong URL  
**Fix:**
- Start backend: `cd backend && npm run dev`
- Check `VITE_BACKEND_URL` in `frontend/.env`

### "No products showing"
**Cause:** Two possibilities:
1. Products not in database (run seed.sql)
2. Products are hardcoded (needs fix from CRITICAL_FIXES_TODO.md)

### "PayPal payment fails"
**Cause:** Invalid credentials or wrong mode  
**Fix:**
- Verify `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET`
- Ensure `PAYPAL_MODE=sandbox` for testing
- Test connection: http://localhost:5000/api/paypal/test

```

---

**Action Required:** Update these README files with the above content for better user guidance.

