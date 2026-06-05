import { PrismaClient, user_role, permission_action } from "@prisma/client";
import { generateQuickStart } from "../src/lib/id-generator";

const db = new PrismaClient();

async function seedPermissions() {
  console.log("🌱 Seeding permission matrix...");

  // Define basic permissions for each role
  const permissions = [
    // PLATFORM_ADMIN - Full access to everything
    { role: user_role.PLATFORM_ADMIN, action: permission_action.tenant_create, allowed: true },
    { role: user_role.PLATFORM_ADMIN, action: permission_action.tenant_delete, allowed: true },
    { role: user_role.PLATFORM_ADMIN, action: permission_action.tenant_update, allowed: true },
    { role: user_role.PLATFORM_ADMIN, action: permission_action.tenant_read, allowed: true },
    { role: user_role.PLATFORM_ADMIN, action: permission_action.tenant_manage_users, allowed: true },
    { role: user_role.PLATFORM_ADMIN, action: permission_action.admin_access_dashboard, allowed: true },
    { role: user_role.PLATFORM_ADMIN, action: permission_action.analytics_view, allowed: true },
    { role: user_role.PLATFORM_ADMIN, action: permission_action.admin_manage_settings, allowed: true },

    // PLATFORM_SUPPORT - Support access
    { role: user_role.PLATFORM_SUPPORT, action: permission_action.tenant_create, allowed: false },
    { role: user_role.PLATFORM_SUPPORT, action: permission_action.tenant_delete, allowed: false },
    { role: user_role.PLATFORM_SUPPORT, action: permission_action.tenant_update, allowed: true },
    { role: user_role.PLATFORM_SUPPORT, action: permission_action.tenant_read, allowed: true },
    { role: user_role.PLATFORM_SUPPORT, action: permission_action.tenant_manage_users, allowed: false },
    { role: user_role.PLATFORM_SUPPORT, action: permission_action.admin_access_dashboard, allowed: false },
    { role: user_role.PLATFORM_SUPPORT, action: permission_action.analytics_view, allowed: true },
    { role: user_role.PLATFORM_SUPPORT, action: permission_action.admin_manage_settings, allowed: false },

    // PLATFORM_VIEWER - Read-only platform access
    { role: user_role.PLATFORM_VIEWER, action: permission_action.tenant_create, allowed: false },
    { role: user_role.PLATFORM_VIEWER, action: permission_action.tenant_delete, allowed: false },
    { role: user_role.PLATFORM_VIEWER, action: permission_action.tenant_update, allowed: false },
    { role: user_role.PLATFORM_VIEWER, action: permission_action.tenant_read, allowed: true },
    { role: user_role.PLATFORM_VIEWER, action: permission_action.tenant_manage_users, allowed: false },
    { role: user_role.PLATFORM_VIEWER, action: permission_action.admin_access_dashboard, allowed: false },
    { role: user_role.PLATFORM_VIEWER, action: permission_action.analytics_view, allowed: true },
    { role: user_role.PLATFORM_VIEWER, action: permission_action.admin_manage_settings, allowed: false },

    // TENANT_OWNER - Full tenant access
    { role: user_role.TENANT_OWNER, action: permission_action.tenant_create, allowed: false },
    { role: user_role.TENANT_OWNER, action: permission_action.tenant_delete, allowed: false },
    { role: user_role.TENANT_OWNER, action: permission_action.tenant_update, allowed: false },
    { role: user_role.TENANT_OWNER, action: permission_action.tenant_read, allowed: true },
    { role: user_role.TENANT_OWNER, action: permission_action.tenant_manage_users, allowed: true },
    { role: user_role.TENANT_OWNER, action: permission_action.admin_access_dashboard, allowed: false },
    { role: user_role.TENANT_OWNER, action: permission_action.analytics_view, allowed: true },
    { role: user_role.TENANT_OWNER, action: permission_action.admin_manage_settings, allowed: true },

    // TENANT_ADMIN - Administrative tenant access
    { role: user_role.TENANT_ADMIN, action: permission_action.tenant_create, allowed: false },
    { role: user_role.TENANT_ADMIN, action: permission_action.tenant_delete, allowed: false },
    { role: user_role.TENANT_ADMIN, action: permission_action.tenant_update, allowed: false },
    { role: user_role.TENANT_ADMIN, action: permission_action.tenant_read, allowed: true },
    { role: user_role.TENANT_ADMIN, action: permission_action.tenant_manage_users, allowed: true },
    { role: user_role.TENANT_ADMIN, action: permission_action.admin_access_dashboard, allowed: false },
    { role: user_role.TENANT_ADMIN, action: permission_action.analytics_view, allowed: true },
    { role: user_role.TENANT_ADMIN, action: permission_action.admin_manage_settings, allowed: false },

    // TENANT_MEMBER - Basic member access
    { role: user_role.TENANT_MEMBER, action: permission_action.tenant_create, allowed: false },
    { role: user_role.TENANT_MEMBER, action: permission_action.tenant_delete, allowed: false },
    { role: user_role.TENANT_MEMBER, action: permission_action.tenant_update, allowed: false },
    { role: user_role.TENANT_MEMBER, action: permission_action.tenant_read, allowed: true },
    { role: user_role.TENANT_MEMBER, action: permission_action.tenant_manage_users, allowed: false },
    { role: user_role.TENANT_MEMBER, action: permission_action.admin_access_dashboard, allowed: false },
    { role: user_role.TENANT_MEMBER, action: permission_action.analytics_view, allowed: false },
    { role: user_role.TENANT_MEMBER, action: permission_action.admin_manage_settings, allowed: false },

    // TENANT_VIEWER - Read-only access
    { role: user_role.TENANT_VIEWER, action: permission_action.tenant_create, allowed: false },
    { role: user_role.TENANT_VIEWER, action: permission_action.tenant_delete, allowed: false },
    { role: user_role.TENANT_VIEWER, action: permission_action.tenant_update, allowed: false },
    { role: user_role.TENANT_VIEWER, action: permission_action.tenant_read, allowed: true },
    { role: user_role.TENANT_VIEWER, action: permission_action.tenant_manage_users, allowed: false },
    { role: user_role.TENANT_VIEWER, action: permission_action.admin_access_dashboard, allowed: false },
    { role: user_role.TENANT_VIEWER, action: permission_action.analytics_view, allowed: false },
    { role: user_role.TENANT_VIEWER, action: permission_action.admin_manage_settings, allowed: false },
  ];

  // Create permissions using createMany with skipDuplicates
  await db.permission_matrix_list.createMany({
    data: permissions.map((p, index) => ({
      id: generateQuickStart(`pmid_${index}`),
      role: p.role,
      action: p.action,
      allowed: p.allowed,
      description: `${p.role} ${p.allowed ? 'can' : 'cannot'} ${String(p.action).replace(/_/g, ' ')}`,
      updated_at: new Date(),
    })),
    skipDuplicates: true,
  });

  console.log(`✅ Seeded ${permissions.length} permission entries`);
}

seedPermissions()
  .catch(console.error)
  .finally(() => db.$disconnect());
