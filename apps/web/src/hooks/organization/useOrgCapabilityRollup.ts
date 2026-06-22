"use client";

import { useQuery } from "@tanstack/react-query";
import { orgCapabilityService } from "@/services/OrgCapabilityService";

export function useOrgCapabilityRollup(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["org-capability-rollup", organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error("organizationId required");
      return orgCapabilityService.getCapabilityRollup(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
