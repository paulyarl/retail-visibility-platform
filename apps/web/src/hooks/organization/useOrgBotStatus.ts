"use client";

import { useQuery } from "@tanstack/react-query";
import { orgCapabilityService } from "@/services/OrgCapabilityService";

export function useOrgBotStatus(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["org-bot-status", organizationId],
    queryFn: () => {
      if (!organizationId) throw new Error("organizationId required");
      return orgCapabilityService.getBotStatus(organizationId);
    },
    enabled: !!organizationId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
