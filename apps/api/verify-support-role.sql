-- Verify SUPPORT role exists in user_tenant_role enum
SELECT enum_range(NULL::user_tenant_role);
