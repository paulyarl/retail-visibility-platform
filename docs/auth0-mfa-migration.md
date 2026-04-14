# Auth0 MFA Migration Guide

## Overview

This guide covers the migration from custom MFA implementation to Auth0-powered MFA while maintaining the custom UI experience.

## Architecture

### Before (Custom MFA)
```
Frontend UI -> Custom API -> Custom Backend -> Database
```

### After (Auth0 MFA)
```
Frontend UI -> Auth0 MFA API -> Auth0 Management API -> Auth0 Backend
```

## Migration Components

### Backend Changes

1. **New Auth0 MFA Service** (`apps/api/src/services/auth0-mfa.service.ts`)
   - Bridges custom UI with Auth0 Management API
   - Handles TOTP, SMS, backup codes
   - Manages factor enrollment and verification

2. **New API Routes** (`apps/api/src/routes/auth0-mfa.ts`)
   - `/api/auth0-mfa/status` - Get MFA status
   - `/api/auth0-mfa/totp/enroll` - Start TOTP enrollment
   - `/api/auth0-mfa/totp/verify` - Verify TOTP setup
   - `/api/auth0-mfa/sms/enroll` - Start SMS enrollment
   - `/api/auth0-mfa/sms/verify` - Verify SMS setup
   - `/api/auth0-mfa/factor/:id` - Delete MFA factor
   - `/api/auth0-mfa/backup-codes/generate` - Generate backup codes

### Frontend Changes

1. **Auth0 MFA Service** (`apps/web/src/services/auth0-mfa.ts`)
   - HTTP client for Auth0 MFA API
   - Type-safe interfaces
   - Error handling

2. **React Hook** (`apps/web/src/hooks/useAuth0MFA.ts`)
   - State management for MFA operations
   - Loading and error states
   - Auto-refresh of MFA status

3. **Custom UI Components**
   - `Auth0MFASettings.tsx` - Main settings page
   - `Auth0TOTPSetupWizard.tsx` - TOTP enrollment flow
   - `Auth0SMSSetupWizard.tsx` - SMS enrollment flow
   - `Auth0BackupCodesDisplay.tsx` - Backup codes management

## Environment Variables Required

Add these to your `.env` files:

```env
# Auth0 Management API
AUTH0_DOMAIN=your-domain.auth0.com
AUTH0_CLIENT_ID=your-management-client-id
AUTH0_CLIENT_SECRET=your-management-client-secret
```

## Auth0 Configuration

### 1. Enable MFA in Auth0 Dashboard
1. Go to Auth0 Dashboard > Security > Multi-factor Auth
2. Enable desired factors (TOTP, SMS, etc.)
3. Configure policies (which users require MFA)

### 2. Create Management API Client
1. Go to Auth0 Dashboard > Applications > Applications
2. Create new Machine-to-Machine application
3. Grant permissions:
   - `read:users` - Read user data
   - `update:users` - Update user data
   - `create:users` - Create users (for factors)
   - `delete:users` - Delete users
   - `read:users_multifactor` - Read MFA factors
   - `update:users_multifactor` - Update MFA factors
   - `delete:users_multifactor` - Delete MFA factors
   - `create:users_multifactor` - Create MFA factors

### 3. Enable MFA Factors
Configure which factors are available:
- TOTP (Authenticator apps)
- SMS
- Email
- Push notifications
- WebAuthn (Biometric)

## Migration Steps

### Phase 1: Parallel Implementation
1. Deploy new Auth0 MFA components alongside existing custom MFA
2. Test Auth0 MFA functionality with test users
3. Verify UI/UX matches existing experience

### Phase 2: Gradual Migration
1. Add feature flag to switch between custom and Auth0 MFA
2. Migrate power users first
3. Monitor for issues and gather feedback

### Phase 3: Full Migration
1. Switch all users to Auth0 MFA
2. Remove custom MFA code
3. Clean up database MFA fields

## Testing

### Unit Tests
```bash
# Test Auth0 MFA service
npm test auth0-mfa.service.ts

# Test React hooks
npm test useAuth0MFA.ts
```

### Integration Tests
```bash
# Test API endpoints
npm test routes/auth0-mfa.ts

# Test UI components
npm test components/security/auth0-mfa/
```

### Manual Testing Checklist
- [ ] TOTP enrollment flow
- [ ] SMS enrollment flow
- [ ] Backup codes generation and display
- [ ] MFA factor deletion
- [ ] Error handling
- [ ] Loading states
- [ ] Mobile responsiveness

## Rollback Plan

If issues arise during migration:

1. **Immediate Rollback**
   - Switch feature flag back to custom MFA
   - Users continue with existing implementation

2. **Data Recovery**
   - Auth0 MFA data is stored in Auth0 (no data loss)
   - Custom MFA data remains in database until cleaned up

3. **User Communication**
   - Notify users of any temporary issues
   - Provide support for migration problems

## Security Considerations

### Auth0 Security Benefits
- Enterprise-grade MFA implementation
- Regular security updates from Auth0
- Compliance with security standards
- Reduced attack surface

### Migration Security
- No downtime during migration
- Gradual rollout reduces risk
- Feature flags allow quick rollback
- Audit trails maintained

## Performance Impact

### Expected Improvements
- Reduced server load (Auth0 handles MFA)
- Faster MFA verification
- Better scalability
- Improved reliability

### Monitoring
- Track API response times
- Monitor error rates
- User success metrics
- System performance

## Troubleshooting

### Common Issues

1. **Auth0 API Rate Limits**
   - Implement exponential backoff
   - Cache responses where appropriate
   - Monitor usage statistics

2. **Factor Enrollment Failures**
   - Check Auth0 configuration
   - Verify user permissions
   - Review API credentials

3. **UI/UX Inconsistencies**
   - Compare with existing custom MFA
   - Test across different devices
   - Gather user feedback

### Debug Tools
- Auth0 Dashboard logs
- Application error tracking
- Network request monitoring
- User session analysis

## Future Enhancements

### Additional MFA Factors
- Biometric authentication
- Hardware security keys
- Location-based authentication
- Behavioral biometrics

### Advanced Features
- Risk-based authentication
- Adaptive MFA policies
- Device fingerprinting
- Anomaly detection

## Support Documentation

### User Guides
- How to set up TOTP
- How to set up SMS MFA
- Backup codes management
- Account recovery process

### Admin Guides
- MFA policy configuration
- User management
- Troubleshooting common issues
- Security best practices

## Conclusion

This migration provides:
- **Enhanced Security**: Auth0's enterprise-grade MFA
- **Better UX**: Maintained custom interface
- **Scalability**: Auth0 handles MFA infrastructure
- **Compliance**: Industry-standard security practices
- **Maintainability**: Reduced custom code complexity

The migration maintains your existing custom UI while leveraging Auth0's robust MFA backend for better security and reliability.
