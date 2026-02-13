# OnlyOffice Configuration Changes - Migration Guide

## Summary of Changes

This document describes the fix for the OnlyOffice EBUSY error and JWT authentication issues.

## Problem

The OnlyOffice DocumentServer container was experiencing three related issues:

1. **EBUSY File Locking Error**:
   ```
   Error: EBUSY: resource busy or locked, rename 
   '/etc/onlyoffice/documentserver/.local.json-json-131-1771001693953.tmp' 
   -> '/etc/onlyoffice/documentserver/local.json'
   ```

2. **JWT Authentication Failures**:
   - 403 Forbidden errors during PPTX/PDF conversion
   - OnlyOffice conversion API returning error -4

3. **403 Forbidden on File Download**:
   - Conversion succeeds but downloading the converted file returns 403
   - OnlyOffice returns: `"fileUrl": "http://fw-webinar-onlyoffice/cache/files/..."`
   - Backend trying to download from port 80 (nginx) which blocks `/cache/files` access

## Root Causes

### EBUSY Error
The `docker-compose.yml` was mounting `onlyoffice-local.json` as a **read-only file** (`:ro`) to `/etc/onlyoffice/documentserver/local.json`. OnlyOffice DocumentServer needs **write access** to this file to:
- Update JWT configuration at runtime
- Merge user configuration with default settings
- Store runtime state information

When OnlyOffice tried to update the file, it would create a temporary file and attempt to rename it to `local.json`, which failed because the mount was read-only.

### 403 Error on Download
OnlyOffice returns URLs pointing to nginx (port 80): `http://fw-webinar-onlyoffice/cache/files/...`
- **Port 80** → nginx with access restrictions for `/cache/files`
- **Port 8000** → internal docservice without nginx restrictions

The backend was trying to download from port 80, which was blocked by nginx security rules.

## Solution

Two main changes were implemented:

### 1. Configuration Method: File-Based → Environment Variable-Based

#### Before (Read-Only File Mount)
```yaml
onlyoffice:
  environment:
    - DS_ALLOW_PRIVATE_IP_ADDRESS=true
  volumes:
    - ./onlyoffice-local.json:/etc/onlyoffice/documentserver/local.json:ro
```

#### After (Environment Variables Only)
```yaml
onlyoffice:
  environment:
    - JWT_ENABLED=false
    - JWT_SECRET=${ONLYOFFICE_JWT_SECRET:-}
    - DS_ALLOW_PRIVATE_IP_ADDRESS=true
    - DS_ALLOW_META_IP_ADDRESS=true
  volumes:
    - onlyoffice-data:/var/www/onlyoffice/Data
    - onlyoffice-logs:/var/log/onlyoffice
```

### 2. Backend Download: Port 80 → Port 8000

#### Before (Blocked by nginx)
```javascript
const downloadUrl = response.data.fileUrl;
// Returns: http://fw-webinar-onlyoffice/cache/files/... (port 80)
// Result: 403 Forbidden from nginx
```

#### After (Direct docservice access)
```javascript
const downloadUrl = response.data.fileUrl
  .replace('http://fw-webinar-onlyoffice/', 'http://fw-webinar-onlyoffice:8000/')
  .replace('http://webinar-onlyoffice/', 'http://webinar-onlyoffice:8000/')
  .replace('http://onlyoffice/', 'http://onlyoffice:8000/');
// Result: Success - bypasses nginx restrictions
```

## Migration Steps

### For Existing Installations

1. **Pull the latest changes**:
   ```bash
   git pull origin main
   ```

2. **Stop all containers**:
   ```bash
   docker-compose down
   ```

3. **Start containers with new configuration**:
   ```bash
   docker-compose up -d
   ```

4. **Wait for OnlyOffice to initialize** (2-3 minutes):
   ```bash
   docker-compose logs -f onlyoffice
   ```
   
   Watch for successful startup messages. You should NOT see any EBUSY errors.

5. **Retrieve the JWT secret** (after OnlyOffice has started):
   ```bash
   ./get-onlyoffice-jwt-secret.sh
   ```
   
   This will output something like:
   ```
   ✅ JWT Secret found in local.json:
      w8KvKFsZrC1xqkN2pHxYqLmRvTgBnMzA
   ```

6. **Add the JWT secret to your `.env` file**:
   ```bash
   echo "ONLYOFFICE_JWT_SECRET=w8KvKFsZrC1xqkN2pHxYqLmRvTgBnMzA" >> .env
   ```
   
   Or manually edit `.env` and add the line.

7. **Restart the backend** to apply the JWT secret:
   ```bash
   docker-compose restart backend
   ```

8. **Test PPTX upload**:
   - Go to admin panel
   - Upload a PPTX file
   - Verify conversion works without errors

### For New Installations

New installations will work automatically:

1. **Copy environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Start containers**:
   ```bash
   docker-compose up -d
   ```

3. **Configure JWT secret** (after OnlyOffice starts):
   ```bash
   ./get-onlyoffice-jwt-secret.sh
   # Copy the secret to .env
   docker-compose restart backend
   ```

## Testing

A test script is provided to verify the configuration:

```bash
./test-onlyoffice-config.sh
```

This script will:
- Start the containers
- Check for EBUSY errors
- Verify OnlyOffice is running
- Check environment variables
- Validate JWT configuration

## What Changed

### Files Modified
- `docker-compose.yml`: Removed read-only config file mount, added environment variables
- `README.md`: Updated troubleshooting section
- `ADMINISTRATOR_GUIDE.md`: Updated OnlyOffice configuration instructions

### Files Added
- `test-onlyoffice-config.sh`: Test script for configuration validation
- `onlyoffice-local.json.README.md`: Documentation about the config file
- `ONLYOFFICE_MIGRATION.md`: This file

### Files Unchanged (But No Longer Used)
- `onlyoffice-local.json`: Kept for reference, but not mounted anymore

## Environment Variables

The following environment variables control OnlyOffice behavior:

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `JWT_ENABLED` | Enable JWT for editing API | `false` | No |
| `JWT_SECRET` | JWT secret for conversion API | (generated) | Yes* |
| `DS_ALLOW_PRIVATE_IP_ADDRESS` | Allow private IPs (RFC 1918) | `true` | Yes |
| `DS_ALLOW_META_IP_ADDRESS` | Allow metadata IPs (169.254.x.x) | `true` | Yes |

\* JWT_SECRET is technically optional - OnlyOffice will generate one if not provided. However, you MUST retrieve the generated secret and configure it in the backend for PPTX/PDF conversion to work.

## Troubleshooting

### Issue: EBUSY errors still appear

**Solution**: Make sure you've removed the old config file mount from docker-compose.yml:
```bash
grep "onlyoffice-local.json" docker-compose.yml
```
This should return no results.

### Issue: JWT authentication fails (403 errors)

**Symptom**: PPTX conversion fails with error -4 or 403 Forbidden

**Solution**:
1. Retrieve JWT secret: `./get-onlyoffice-jwt-secret.sh`
2. Add to `.env`: `ONLYOFFICE_JWT_SECRET=<secret>`
3. Restart backend: `docker-compose restart backend`

### Issue: Cannot access Docker internal networks (error -4)

**Symptom**: OnlyOffice cannot download files from backend

**Solution**:
Verify environment variables are set:
```bash
docker exec webinar-onlyoffice printenv | grep ALLOW
```
Should show:
```
DS_ALLOW_PRIVATE_IP_ADDRESS=true
DS_ALLOW_META_IP_ADDRESS=true
```

### Issue: OnlyOffice keeps restarting

**Check logs**:
```bash
docker-compose logs onlyoffice
```

Common causes:
- Not enough memory (OnlyOffice needs ~2GB RAM)
- Port conflicts
- Volume permission issues

## Benefits of New Approach

1. **No File Locking Issues**: OnlyOffice can write to its config files freely
2. **Simpler Configuration**: All config via environment variables
3. **Better Docker Practices**: Using environment variables is the standard Docker approach
4. **Easier Debugging**: Configuration is visible in `docker-compose ps` and logs
5. **Immutable Infrastructure**: No need to maintain config files in version control

## Additional Resources

- OnlyOffice DocumentServer Docker: https://github.com/ONLYOFFICE/Docker-DocumentServer
- OnlyOffice API Documentation: https://api.onlyoffice.com/
- JWT Configuration: https://api.onlyoffice.com/editors/signature/

## Support

If you encounter issues after migration:
1. Check the logs: `docker-compose logs onlyoffice`
2. Run the test script: `./test-onlyoffice-config.sh`
3. Review this migration guide
4. Check the updated ADMINISTRATOR_GUIDE.md for detailed troubleshooting
