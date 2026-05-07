/**
 * New Relic APM Configuration
 * Application Performance Monitoring for production environment
 */

// Only load New Relic in production to avoid development overhead
if (process.env.NODE_ENV === 'production' && process.env.NEW_RELIC_LICENSE_KEY) {
  require('newrelic');
}

// New Relic configuration
if (process.env.NEW_RELIC_LICENSE_KEY) {
  process.env.NEW_RELIC_APP_NAME = process.env.NEW_RELIC_APP_NAME || 'VisibleShelf API';
  process.env.NEW_RELIC_LOG_LEVEL = process.env.NEW_RELIC_LOG_LEVEL || 'info';

  // Additional New Relic configuration for better monitoring
  process.env.NEW_RELIC_ATTRIBUTES_ENABLED = 'true';
  process.env.NEW_RELIC_ERROR_COLLECTOR_ENABLED = 'true';
  process.env.NEW_RELIC_TRANSACTION_TRACER_ENABLED = 'true';
  process.env.NEW_RELIC_DISTRIBUTED_TRACING_ENABLED = 'true';

  // Database monitoring
  process.env.NEW_RELIC_DATASTORE_TRACER_DATABASE_NAME_REPLACEMENT = '[HIDDEN]';
  process.env.NEW_RELIC_DATASTORE_TRACER_INSTANCE_DATABASE_NAME_REPLACEMENT = '[HIDDEN]';

  // Custom attributes for better observability
  process.env.NEW_RELIC_ATTRIBUTES_INCLUDE = [
    'request.method',
    'request.url',
    'response.status',
    'request.headers.user-agent',
    'request.headers.x-tenant-id',
    'request.headers.x-forwarded-for'
  ].join(',');

  console.log('🔍 New Relic APM enabled for production monitoring');
} else if (process.env.NODE_ENV === 'production') {
  console.log('⚠️  New Relic license key not found - APM monitoring disabled');
}
