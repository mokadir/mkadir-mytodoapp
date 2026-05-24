# ✅ Solution: Fix Rate Limiting Issue

## What Was Fixed

The health check endpoint was being blocked by the rate limiter, causing Kubernetes probes to fail after ~100 requests (about 6 minutes). This caused pods to restart continuously, preventing the UI from loading.

**Change Made**: Moved the health check route registration BEFORE the rate limiter middleware, so health checks are exempt from rate limiting.

## File Modified
- `server/src/index.ts` - Health check route now registered before rate limiter

## Deployment Steps

### 1. Build New Docker Image
```bash
docker build -t mokadir/todoapp:11 .
```

### 2. Push to Docker Hub
```bash
docker push mokadir/todoapp:11
```

### 3. Update Kubernetes Deployment
Update the image tag in `k8s/deployment.yaml` from `mokadir/todoapp:10` to `mokadir/todoapp:11`, or run this command:

```bash
kubectl set image deployment/todoapp-deployment todoapp-container=mokadir/todoapp:11 -n ns-mytodoapp
```

### 4. Monitor Deployment
```bash
# Watch pod status
kubectl get pods -n ns-mytodoapp -w

# Check logs
kubectl logs -f deployment/todoapp-deployment -n ns-mytodoapp

# Verify health checks are passing
kubectl describe pod <POD_NAME> -n ns-mytodoapp | grep -A 10 "Events:"
```

### 5. Verify Fix
After deployment, you should see:
- ✅ No more 429 errors in pod events
- ✅ No more restarts due to failed probes
- ✅ Pod status stays "Running" with "1/1 Ready"
- ✅ UI loads successfully

### 6. Access the Application
Once the pod is stable:
```bash
# Get the NodePort service
kubectl get service todoapp-service -n ns-mytodoapp

# Access via:
http://<NODE_IP>:30023
```

## Expected Results

**Before Fix:**
```
NAME                                  READY   STATUS    RESTARTS
todoapp-deployment-6f886d7746-m5tkj   1/1     Running   2 (2m55s ago)
Events:
  Warning  Unhealthy  Readiness probe failed: HTTP probe failed with statuscode: 429
  Normal   Killing    Container todoapp-container failed liveness probe, will be restarted
```

**After Fix:**
```
NAME                                  READY   STATUS    RESTARTS
todoapp-deployment-xxxxxxxx-xxxxx     1/1     Running   0
Events:
  Normal   Pulled    Container image "mokadir/todoapp:11" already present on machine
  Normal   Created   Created container todoapp-container
  Normal   Started   Started container todoapp-container
```

## What This Fix Does

1. **Health Check Exempt**: The `/api/health` endpoint is now registered before the rate limiter, so Kubernetes probes can check it unlimited times
2. **Other Routes Protected**: All other API routes remain protected by rate limiting
3. **Stable Pods**: Pods won't restart due to rate limit 429 errors
4. **UI Loads**: With stable pods, the UI will load and display correctly

## Alternative: Quick Rollout Without Rebuild

If you want to test immediately without rebuilding, you can temporarily increase rate limits in the deployment:

```yaml
env:
  - name: RATE_LIMIT_MAX_GENERAL
    value: "1000"  # Increase from 100 to 1000
```

But the proper fix (moving health check before rate limiter) is the recommended solution!
