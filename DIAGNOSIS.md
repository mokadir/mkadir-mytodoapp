# 🔍 Diagnosis: UI Not Visible - Root Cause Found

## Problem Summary
The application pods are constantly restarting due to failed health checks, preventing the UI from loading properly.

## Root Cause
**Rate Limiter is blocking Kubernetes health check probes!**

### Evidence from kubectl outputs:

1. **Pod Status**: 
   - Status: Running with 2 restarts
   - Readiness probe failed: `HTTP probe failed with statuscode: 429`
   - Container killed 2 times due to failed liveness probe

2. **429 Error Code**: HTTP 429 = "Too Many Requests" (rate limit exceeded)

3. **Current Configuration**:
   - Readiness probe: checks `/api/health` every 5 seconds
   - Liveness probe: checks `/api/health` every 15 seconds
   - Rate limit: 100 requests per 15 minutes (900,000ms)
   - Combined probes: ~16 requests/minute = 240 requests/15 minutes

4. **What's Happening**:
   ```
   Time 0s  → Health check #1 ✓
   Time 5s  → Health check #2 ✓
   ...
   Time ~6m → Health check #100 ✓
   Time ~6m → Health check #101 ✗ (429 Too Many Requests)
   Time ~6m → Readiness probe fails (pod marked not ready)
   Time ~7m → Liveness probe fails (pod restarted)
   ```

## The Issue in Code

In `server/src/index.ts` (lines 62-71):
```typescript
// Rate limiter applied to ALL /api/* routes
const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxGeneral,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests, please try again later" },
});

app.use("/api", generalLimiter);  // ⚠️ This blocks /api/health too!
```

## Solution
**Exclude the health check endpoint from rate limiting** by moving the rate limiter application after the health route is registered.

### Changes Needed:
1. Move health check route registration BEFORE the rate limiter
2. Apply rate limiter to specific routes instead of all `/api/*` routes
3. This ensures Kubernetes probes can check health without being rate-limited

## Files to Modify:
- `server/src/index.ts` - Reorder middleware and route registration
