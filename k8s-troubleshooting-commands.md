# Kubernetes Troubleshooting Commands for Todo App

Run these commands in order and provide the outputs:

## 1. Check Pod Status
```bash
kubectl get pods
```

## 2. Get Detailed Pod Information
```bash
kubectl get pods -o wide
```

## 3. Describe the Pod (replace <POD_NAME> with actual pod name from step 1)
```bash
kubectl describe pod <POD_NAME>
```

## 4. Check Container Logs (replace <POD_NAME>)
```bash
kubectl logs <POD_NAME>
```

## 5. Check Previous Container Logs (if pod restarted)
```bash
kubectl logs <POD_NAME> --previous
```

## 6. Check All Container Logs (if multiple containers)
```bash
kubectl logs <POD_NAME> --all-containers=true
```

## 7. Check Services
```bash
kubectl get services
```

## 8. Describe the Service
```bash
kubectl describe service todo-app-service
```

## 9. Check Endpoints
```bash
kubectl get endpoints
```

## 10. Check ConfigMaps and Secrets
```bash
kubectl get configmaps
kubectl get secrets
```

## 11. Check Persistent Volume Claims
```bash
kubectl get pvc
kubectl describe pvc todo-app-pvc
```

## 12. Check Recent Events
```bash
kubectl get events --sort-by='.lastTimestamp' | tail -20
```

## 13. Check Ingress (if applicable)
```bash
kubectl get ingress
```

## 14. Test Pod Connectivity (exec into the pod)
```bash
kubectl exec -it <POD_NAME> -- sh
```

Once inside the pod, run:
```bash
# Check if app is running
curl localhost:3000

# Check if client files exist
ls -la /app/client

# Check environment variables
env | grep -i db

# Check processes
ps aux
```

## 15. Port Forward to Test Locally
```bash
kubectl port-forward <POD_NAME> 3000:3000
```

Then open browser to `http://localhost:3000`

---

## Priority Commands to Run First:
1. `kubectl get pods`
2. `kubectl logs <POD_NAME>`
3. `kubectl describe pod <POD_NAME>`
4. `kubectl get services`
5. `kubectl port-forward <POD_NAME> 3000:3000`

**Please run these priority commands first and share the outputs!**
