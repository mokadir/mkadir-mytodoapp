# 🎯 Complete Fix: Two Issues Resolved

## Issues Found and Fixed

### Issue #1: Rate Limiter Blocking Health Checks ✅
**Problem**: Kubernetes health probes were hitting rate limit (429 errors) after 6 minutes, causing pod restarts.

**Fix**: Moved health check route registration BEFORE rate limiter middleware in `server/src/index.ts`

### Issue #2: CSP Header Forcing HTTPS on HTTP Deployment ✅
**Problem**: Browser was trying to load assets over HTTPS due to `upgrade-insecure-requests` CSP directive, but the NodePort service only serves HTTP. This caused `ERR_SSL_PROTOCOL_ERROR`.

**Evidence from Browser Console**:
```
GET https://192.168.2.236:30023/assets/index-BYS8GvA-.js net::ERR_SSL_PROTOCOL_ERROR
GET https://192.168.2.236:30023/assets/index-CoSy3jm0.css net::ERR_SSL_PROTOCOL_ERROR
```

**Fix**: Disabled `upgradeInsecureRequests` CSP directive for HTTP-only K8s deployments

---

## Files Modified

### `server/src/index.ts`
1. **Health check exempt from rate limiting** (line 65-67)
2. **CSP directive fixed** (line 31) - Added `upgradeInsecureRequests: null`

---

## Deploy the Complete Fix

### 1. Build New Docker Image
```bash
docker build -t mokadir/todoapp:12 .
```

### 2. Push to Docker Hub
```bash
docker push mokadir/todoapp:12
```

### 3. Update Kubernetes Deployment
```bash
kubectl set image deployment/todoapp-deployment todoapp-container=mokadir/todoapp:12 -n ns-mytodoapp
```

### 4. Monitor the Deployment
```bash
# Watch pod rollout
kubectl get pods -n ns-mytodoapp -w

# Check logs
kubectl logs -f deployment/todoapp-deployment -n ns-mytodoapp
```

### 5. Verify Everything Works
```bash
# Check pod is stable (no restarts)
kubectl get pods -n ns-mytodoapp

# Test the UI loads
curl http://192.168.2.236:30023/

# Test assets load (should return 200)
curl -I http://192.168.2.236:30023/assets/index-BYS8GvA-.js
```

### 6. Open in Browser
Navigate to: **http://192.168.2.236:30023/**

You should now see:
- ✅ HTML loads
- ✅ JavaScript assets load over HTTP (not HTTPS)
- ✅ CSS assets load over HTTP (not HTTPS)
- ✅ UI renders completely with all elements visible
- ✅ No more pod restarts
- ✅ No browser console errors

---

## Expected Results

**Before Fix**:
- Pod restarts every ~6 minutes due to 429 errors
- HTML loads but assets fail with `ERR_SSL_PROTOCOL_ERROR`
- Blank page in browser

**After Fix**:
- Pod stays running (0 restarts)
- All assets load successfully over HTTP
- Full UI visible and functional

---

## Technical Details

### Why `upgrade-insecure-requests` Caused Issues

The `upgrade-insecure-requests` CSP directive tells browsers to automatically upgrade all HTTP requests to HTTPS. This is great for production HTTPS deployments, but causes problems when:

1. You're using a Kubernetes NodePort service (HTTP only)
2. You haven't configured TLS/HTTPS ingress
3. You're accessing via IP address on HTTP

When the browser tried to load:
- `http://192.168.2.236:30023/assets/index-BYS8GvA-.js`

It was automatically upgraded to:
- `https://192.168.2.236:30023/assets/index-BYS8GvA-.js`

But since your service doesn't serve HTTPS, the connection failed with `ERR_SSL_PROTOCOL_ERROR`.

### Solution Options

**Option 1** (Applied): Disable `upgradeInsecureRequests` in CSP
- Simple and works for HTTP-only deployments
- Assets load over HTTP without issues

**Option 2**: Configure HTTPS Ingress (for production)
- Set up an Ingress controller with TLS certificates
- Enable `upgrade-insecure-requests` for better security
- Recommended for production environments

---

## For Production Deployments

If you want to use HTTPS in production:

1. Set up an Ingress controller (nginx, traefik, etc.)
2. Get a TLS certificate (Let's Encrypt, cert-manager)
3. Re-enable `upgradeInsecureRequests` in the CSP configuration
4. Update CORS_ORIGIN environment variable to use HTTPS URL

This fix is perfect for development/testing with HTTP NodePort services!
