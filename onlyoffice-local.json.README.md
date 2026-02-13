# OnlyOffice Configuration File

## Note: This file is NOT currently used

As of the latest version, this `onlyoffice-local.json` file is **not mounted** into the OnlyOffice container.

### Why?

OnlyOffice DocumentServer needs write access to its configuration files (`local.json`) to update runtime settings, especially JWT configuration. Mounting a read-only configuration file causes:
- **EBUSY errors** when OnlyOffice tries to write configuration updates
- Container crashes and restarts
- JWT configuration failures

### Current Configuration Method

OnlyOffice is now configured entirely through **environment variables** in `docker-compose.yml`:

```yaml
environment:
  - JWT_ENABLED=false
  - JWT_SECRET=${ONLYOFFICE_JWT_SECRET:-}
  - DS_ALLOW_PRIVATE_IP_ADDRESS=true
  - DS_ALLOW_META_IP_ADDRESS=true
```

These environment variables provide all necessary configuration for:
- JWT authentication
- Private IP address access (required for Docker internal networks)
- Metadata IP address access
- Request filtering

### If You Need Advanced Configuration

If you need to apply advanced OnlyOffice configuration that cannot be set via environment variables:

1. **Option A**: Use a writable volume mount (not recommended)
   ```yaml
   volumes:
     - ./onlyoffice-config:/etc/onlyoffice/documentserver
   ```
   This allows OnlyOffice to write to the config directory, but you lose control over the config files.

2. **Option B**: Create a custom Docker image
   - Create a Dockerfile that extends `onlyoffice/documentserver:latest`
   - Copy your custom configuration during build
   - Use the custom image in docker-compose.yml

3. **Option C**: Use an init container or entrypoint script
   - Copy configuration files during container initialization
   - Let OnlyOffice modify them afterward

### What This File Contains (for reference)

The `onlyoffice-local.json` file contains:
- JWT token configuration (enable/disable for different endpoints)
- Default JWT secrets for internal use
- Request filtering settings (allowPrivateIPAddress, allowMetaIPAddress)
- PostgreSQL configuration (not used in our setup)
- RabbitMQ configuration
- WOPI configuration (not used in our setup)

### Security Note

The JWT secrets in this file (`JnbnECP6Hn0BUyplKf3Ua8lUempADJA8`) are default values meant for testing/development. In production, OnlyOffice will generate its own secure random secret on first start, which should be retrieved using `./get-onlyoffice-jwt-secret.sh` and configured via the `ONLYOFFICE_JWT_SECRET` environment variable.

## Reference

This file is kept in the repository for reference purposes and for users who may need to create custom OnlyOffice configurations in the future.
