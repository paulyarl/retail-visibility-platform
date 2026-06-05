# Disaster Recovery Plan - Phase 1

## Overview
This document outlines the disaster recovery procedures for the VisibleShelf platform. It covers backup restoration, system recovery, and business continuity measures.

## Recovery Objectives

### RTO (Recovery Time Objective)
- **Critical Systems**: 4 hours
- **Database**: 2 hours
- **Application**: 1 hour
- **Supporting Services**: 8 hours

### RPO (Recovery Point Objective)
- **Critical Data**: 1 hour
- **User Data**: 4 hours
- **Analytics Data**: 24 hours

## Backup Strategy

### Automated Backups
- **Full Database**: Daily at 02:00 UTC
- **Schema Backup**: Daily at 02:30 UTC
- **Incremental Data**: Every 4 hours
- **Retention**: 30 days for full backups, 7 days for incremental

### Manual Backup Triggers
- Before major deployments
- Before schema changes
- On-demand via admin interface

## Recovery Procedures

### Scenario 1: Database Corruption/Data Loss

#### Immediate Actions
1. Stop all application instances to prevent further data corruption
2. Assess the scope of data loss
3. Notify stakeholders (internal team, affected customers if necessary)

#### Recovery Steps
1. **Identify Last Good Backup**
   ```bash
   node backup.js list
   ```

2. **Restore Database**
   ```bash
   # Create recovery database
   createdb recovery_db

   # Restore from backup
   pg_restore --no-password --dbname="recovery_db" --format=custom latest_backup.dump
   ```

3. **Validate Data Integrity**
   ```sql
   -- Run data validation queries
   SELECT COUNT(*) FROM tenants;
   SELECT COUNT(*) FROM inventory_items;
   -- Verify referential integrity
   ```

4. **Switch to Recovered Database**
   ```bash
   # Update environment variables
   export DATABASE_URL="postgresql://.../recovery_db"

   # Restart application
   npm run start
   ```

5. **Post-Recovery Validation**
   - Test all critical functionality
   - Verify user access
   - Check data consistency

### Scenario 2: Application Server Failure

#### Immediate Actions
1. Check Railway dashboard for service status
2. Verify if it's an isolated instance or region-wide issue

#### Recovery Steps
1. **Redeploy Application**
   ```bash
   # Railway will auto-restart, or manually trigger deployment
   railway deploy
   ```

2. **Verify Application Health**
   ```bash
   curl https://api.visibleshelf.com/health
   ```

3. **Check Logs for Issues**
   ```bash
   # Check application logs
   railway logs --service api
   ```

### Scenario 3: Complete Infrastructure Failure

#### Immediate Actions
1. Activate backup infrastructure (if available)
2. Notify all stakeholders
3. Begin communication with customers

#### Recovery Steps
1. **Provision New Infrastructure**
   ```bash
   # Use Railway CLI or dashboard
   railway up
   ```

2. **Restore from Latest Backup**
   ```bash
   node backup.js list
   # Select most recent full backup
   pg_restore --no-password --format=custom latest_backup.dump
   ```

3. **Deploy Application**
   ```bash
   npm run build
   npm run start
   ```

4. **DNS Updates** (if domain affected)
   - Update DNS records if necessary
   - Verify SSL certificates

## Communication Plan

### Internal Communication
- **Slack Channel**: #incidents
- **Email Distribution**: dev-team@visibleshelf.com
- **Status Page**: Internal status dashboard

### Customer Communication
- **Status Page**: status.visibleshelf.com
- **Email Templates**: Pre-written incident notifications
- **Social Media**: Twitter/X account updates

## Testing and Validation

### Regular Testing
- **Monthly**: Full disaster recovery simulation
- **Weekly**: Backup integrity verification
- **Daily**: Automated backup success monitoring

### Validation Checklist
- [ ] Database connections working
- [ ] All API endpoints responding
- [ ] User authentication functional
- [ ] Data integrity verified
- [ ] Performance within acceptable ranges
- [ ] Monitoring systems operational

### GDPR Compliance Testing

After database recovery, validate GDPR compliance features are functional. Testing covers both Phase 1 (basic compliance) and Phase 2 (full compliance) features.

#### Phase 1: Basic GDPR Compliance
- **Data Export**: User profiles, tenant relationships, sessions, audit logs
- **Data Deletion**: Cascading deletion of user-related data
- **Audit Logging**: Activity tracking for compliance

#### Phase 2: Full GDPR Compliance
- **Consent Management**: consent_records table for user consent tracking
- **User Preferences**: user_preferences table for settings storage
- **Enhanced Data Export**: Complete user data including consents and preferences
- **Comprehensive Deletion**: All user data types with proper cleanup

#### Data Export Validation (Phase 1 + 2)

#### Data Export Validation
```sql
-- Test GDPR Data Export - Check what data exists for a user
-- Replace 'user-id-here' with an actual user ID from your users table
SELECT
  u.id,
  u.email,
  u.first_name,
  u.last_name,
  u.created_at,
  u.role,
  COUNT(ut.tenant_id) as tenant_count,
  COUNT(al.id) as activity_count
FROM users u
LEFT JOIN user_tenants ut ON u.id = ut.user_id
LEFT JOIN audit_log al ON u.id = al.actor_id
WHERE u.id = 'user-id-here'
GROUP BY u.id, u.email, u.first_name, u.last_name, u.created_at, u.role;
```

#### Audit Trail Validation
```sql
-- Check audit log entries for GDPR actions
SELECT
  id,
  actor_id,
  action,
  entity_type,
  entity_id,
  occurred_at,
  ip,
  user_agent
FROM audit_log
WHERE actor_id = 'user-id-here'
ORDER BY occurred_at DESC
LIMIT 10;
```

#### Data Deletion Preview
```sql
-- Test user data deletion - Preview what would be deleted
-- Replace 'user-id-here' with an actual user ID
SELECT 'Users to delete' as category, COUNT(*) as count FROM users WHERE id = 'user-id-here'
UNION ALL
SELECT 'User tenants to delete', COUNT(*) FROM user_tenants WHERE user_id = 'user-id-here'
UNION ALL
SELECT 'User sessions to delete', COUNT(*) FROM user_sessions_list WHERE user_id = 'user-id-here'
UNION ALL
SELECT 'Consent records to delete', COUNT(*) FROM consent_records WHERE user_id = 'user-id-here'
UNION ALL
SELECT 'User preferences to delete', COUNT(*) FROM user_preferences WHERE user_id = 'user-id-here'
UNION ALL
SELECT 'Audit logs to delete', COUNT(*) FROM audit_log WHERE actor_id = 'user-id-here';
```

## Prevention Measures

### Proactive Monitoring
- Automated alerts for backup failures
- Database health monitoring
- Application performance monitoring
- Infrastructure monitoring

### Capacity Planning
- Monitor resource usage trends
- Plan for scaling events
- Regular capacity reviews

## Roles and Responsibilities

### Incident Commander
- Overall coordination
- Decision making
- Stakeholder communication

### Database Administrator
- Database recovery operations
- Data integrity verification
- Backup system maintenance

### DevOps Engineer
- Infrastructure recovery
- Application deployment
- System monitoring

### Communications Lead
- Internal team updates
- Customer communications
- Status page management

## Contact Information

### Emergency Contacts
- **Primary On-Call**: +1-XXX-XXX-XXXX
- **Secondary On-Call**: +1-XXX-XXX-XXXX
- **Railway Support**: support@railway.app
- **Domain Registrar**: support@namecheap.com

### Key Stakeholders
- **CEO**: ceo@visibleshelf.com
- **CTO**: cto@visibleshelf.com
- **Customer Success**: success@visibleshelf.com

## Document History

- **v1.0**: Initial disaster recovery plan (December 2025)
- **Last Reviewed**: December 2025
- **Next Review**: June 2026

---

## Quick Reference Commands

```bash
# List available backups
node backup.js list

# Create emergency backup
node backup.js full

# Restore specific backup
pg_restore --no-password --dbname="production" --format=custom backup_full_2025-12-24_020000.sql

# Check database health
psql $DATABASE_URL -c "SELECT version();"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM tenants;"

# Health check endpoint
curl https://api.visibleshelf.com/health
```
