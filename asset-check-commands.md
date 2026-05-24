# Asset Loading Check Commands

Run these commands to verify the assets are being served:

## 1. Check JavaScript Asset
```bash
curl -I http://192.168.2.236:30023/assets/index-BYS8GvA-.js
```

## 2. Check CSS Asset
```bash
curl -I http://192.168.2.236:30023/assets/index-CoSy3jm0.css
```

## 3. Check if assets directory exists in pod
```bash
kubectl exec -it <POD_NAME> -n ns-mytodoapp -- ls -la /app/client/dist/assets/
```

## 4. Check the full client/dist structure
```bash
kubectl exec -it <POD_NAME> -n ns-mytodoapp -- ls -la /app/client/dist/
```

## 5. Test asset loading with curl
```bash
curl http://192.168.2.236:30023/assets/index-BYS8GvA-.js | head -20
```

## 6. Check browser console errors
Open the page in a browser and:
1. Press F12 to open Developer Tools
2. Go to the "Console" tab
3. Look for any red error messages
4. Also check the "Network" tab to see if any files fail to load (red status codes)

**Please share the outputs of these commands, especially:**
- The HTTP status codes from curl -I commands (should be 200)
- The output of ls commands (to verify files exist)
- Any browser console errors
