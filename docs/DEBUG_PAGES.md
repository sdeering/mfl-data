# Debug Pages - Keep in Production

## Overview
The following debug pages should be kept available in production for monitoring and troubleshooting:

## Debug Pages

### 1. Cache Verification Test
- **URL**: `/cache-test`
- **Purpose**: Verify that 1-hour caching is working effectively across all services
- **Usage**: 
  - Monitor cache performance
  - Verify API call reduction
  - Troubleshoot caching issues
- **Components**: `CacheVerificationTest.tsx`

### 2. Sync Debug Test
- **URL**: `/sync-debug-test`
- **Purpose**: Debug sync process and investigate database issues
- **Usage**:
  - Test sync process manually
  - Check table counts before/after sync
  - Investigate why tables might be empty
  - Debug database connection issues
- **Components**: `SyncDebugTest.tsx`

## Why Keep in Production

1. **Performance Monitoring**: Cache test helps monitor API performance and caching effectiveness
2. **Troubleshooting**: Sync test helps debug database and sync issues in live environment
3. **User Support**: Can be used to diagnose issues reported by users
4. **System Health**: Provides visibility into system performance and data integrity

## Security Considerations

- These pages are read-only diagnostic tools
- No sensitive data is exposed
- No destructive operations are performed
- Can be accessed by authenticated users only (wallet connection required)

## Maintenance

- Keep these pages updated with any new services or caching mechanisms
- Add new tests as the system evolves
- Monitor usage to ensure they remain useful

