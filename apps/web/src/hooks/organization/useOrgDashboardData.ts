"use client";

import { useState, useEffect } from "react";
import { useAccessControl, AccessPresets } from "@/lib/auth/useAccessControl";
import { useOrganizationData } from "@/hooks/useApiQueries";
import { organizationsService } from "@/services/OrganizationsSingletonService";
import type { OrganizationData, BillingCounters } from "@/components/organization/types";
import { clientLogger } from '@/lib/client-logger';

export function useOrgDashboardData(tenantId?: string | null, urlOrgId?: string | null) {
  const {
    hasAccess,
    loading: accessLoading,
    tenantRole,
    isPlatformAdmin,
    organizationData: orgDataFromHook,
  } = useAccessControl(
    tenantId ?? null,
    AccessPresets.ORGANIZATION_MEMBER,
    true
  );

  const [organizationId, setOrganizationId] = useState<string>("");
  const [availableOrganizations, setAvailableOrganizations] = useState<any[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(false);

  const { data: orgData, isLoading: orgLoading, error: orgError } =
    useOrganizationData(organizationId);

  useEffect(() => {
    if (orgDataFromHook) {
      setOrganizationId(orgDataFromHook.id);
    } else if (urlOrgId) {
      setOrganizationId(urlOrgId);
    }
  }, [orgDataFromHook, urlOrgId]);

  useEffect(() => {
    const fetchAvailableOrganizations = async () => {
      if (!orgDataFromHook && !urlOrgId && tenantRole) {
        setLoadingOrganizations(true);
        try {
          let organizations: any[] = [];
          if (isPlatformAdmin) {
            organizations = await organizationsService.getOrganizations(1, 100);
          }
          setAvailableOrganizations(organizations);
        } catch (error) {
          clientLogger.error("Failed to fetch organizations:", { detail: error });
        } finally {
          setLoadingOrganizations(false);
        }
      }
    };
    fetchAvailableOrganizations();
  }, [orgDataFromHook, urlOrgId, tenantRole, isPlatformAdmin]);

  const billingCounters: BillingCounters | null = orgData || null;
  const loading = accessLoading || orgLoading;
  const error = orgError ? (orgError as Error).message || "Failed to load organization data" : null;

  const allowedRoles = ["PLATFORM_ADMIN", "OWNER", "TENANT_OWNER"];
  const userCanAccess = allowedRoles.includes(tenantRole || "") || hasAccess;

  const hasOrgContext = !!(orgDataFromHook || urlOrgId || organizationId);

  return {
    organizationId,
    orgData,
    billingCounters,
    userRole: tenantRole,
    tenantRole,
    userCanAccess,
    isPlatformAdmin,
    hasOrgContext,
    availableOrganizations,
    loadingOrganizations,
    loading,
    error,
  };
}
