import re
from pathlib import Path

file_path = Path('apps/api/src/routes/tenant-capabilities.ts')
content = file_path.read_text(encoding='utf-8')

# 1. Remove duplicate comment block before the tiers-by-capability route.
# The first comment block is the correct one; the second is a duplicate.
content = re.sub(
    r"(\/\*\*\n \* GET /api/tenants/capabilities/tiers-by-capability\?capabilityTypeKey=\.\.\.\n.*?Response: \[\{ tier_key, tier_name, tier_description, capability_enabled, features: \[\.\.\.\] \}\]\n \*/\n)\n\/\*\*\n \* GET /api/tenants/capabilities/tiers-by-capability\?capabilityTypeKey=\.\.\.\n.*?Response: \[\{ tier_key, tier_name, tier_description, capability_enabled, features: \[\.\.\.\] \}\]\n \*/\n",
    r"\1",
    content,
    flags=re.DOTALL,
)

# 2. Remove the local buildExpiredCapabilitiesResponse function (now imported from public-tenant-capabilities.ts).
content = re.sub(
    r"\n\/\*\*\n \* Build a complete effective-capabilities response for a tenant that exists.*?\n \*\/\nfunction buildExpiredCapabilitiesResponse\(tenant: \{\n.*?\n\}\n",
    "\n",
    content,
    flags=re.DOTALL,
)

# 3. Add authenticateToken + checkTenantAccess to the private tenant-scoped routes.
private_routes = [
    "/:tenantId/effective-capabilities",
    "/:tenantId/system-status",
    "/:tenantId/next-steps",
    "/:tenantId/growth-tips",
    "/:tenantId/quick-links",
]
for route in private_routes:
    content = content.replace(
        f"router.get('{route}', async (req: Request, res: Response) => {{",
        f"router.get('{route}', authenticateToken, checkTenantAccess, async (req: Request, res: Response) => {{",
    )

# 4. Ensure prisma is imported.
if "import { prisma } from '../prisma';" not in content:
    content = content.replace(
        "import { authenticateToken, checkTenantAccess } from '../middleware/auth';",
        "import { prisma } from '../prisma';\nimport { authenticateToken, checkTenantAccess } from '../middleware/auth';",
    )

file_path.write_text(content, encoding='utf-8')
print(f"Rewrote {file_path}")
