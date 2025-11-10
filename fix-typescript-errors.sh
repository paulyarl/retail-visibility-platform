#!/bin/bash
# Fix TypeScript errors - Prisma field naming (snake_case to camelCase)

echo "Fixing TypeScript errors..."

# Fix in all Square files
find apps/api/src/square -type f -name "*.ts" -exec sed -i 's/\.merchant_id/.merchantId/g' {} \;
find apps/api/src/square -type f -name "*.ts" -exec sed -i 's/\.access_token/.accessToken/g' {} \;
find apps/api/src/square -type f -name "*.ts" -exec sed -i 's/\.refresh_token/.refreshToken/g' {} \;
find apps/api/src/square -type f -name "*.ts" -exec sed -i 's/\.token_expires_at/.tokenExpiresAt/g' {} \;
find apps/api/src/square -type f -name "*.ts" -exec sed -i 's/\.location_id/.locationId/g' {} \;
find apps/api/src/square -type f -name "*.ts" -exec sed -i 's/\.last_sync_at/.lastSyncAt/g' {} \;
find apps/api/src/square -type f -name "*.ts" -exec sed -i 's/\.last_error/.lastError/g' {} \;
find apps/api/src/square -type f -name "*.ts" -exec sed -i 's/\.created_at/.createdAt/g' {} \;
find apps/api/src/square -type f -name "*.ts" -exec sed -i 's/\.updated_at/.updatedAt/g' {} \;

# Fix in Square services
find apps/api/src/services/square -type f -name "*.ts" -exec sed -i 's/\.merchant_id/.merchantId/g' {} \;
find apps/api/src/services/square -type f -name "*.ts" -exec sed -i 's/\.access_token/.accessToken/g' {} \;
find apps/api/src/services/square -type f -name "*.ts" -exec sed -i 's/\.refresh_token/.refreshToken/g' {} \;
find apps/api/src/services/square -type f -name "*.ts" -exec sed -i 's/\.token_expires_at/.tokenExpiresAt/g' {} \;

echo "Done!"
