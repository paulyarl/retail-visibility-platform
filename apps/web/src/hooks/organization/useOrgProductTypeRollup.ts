"use client";

import { useQuery } from "@tanstack/react-query";
import { orgCapabilityService } from "@/services/OrgCapabilityService";

export function useOrgProductTypeRollup(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["org-product-type-rollup", organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error("organizationId required");
      return orgCapabilityService.getProductTypeRollup(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
