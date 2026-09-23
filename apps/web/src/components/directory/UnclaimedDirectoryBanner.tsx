'use client';

import { IconShieldCheck } from '@tabler/icons-react';
import { Alert, Text } from '@mantine/core';

/**
 * UnclaimedDirectoryBanner — provenance disclosure strip for
 * directory presence seeds. Pure disclosure: it explains that the
 * listing is unclaimed and what claiming unlocks, but carries no
 * action — the hero and About-section buttons are the page's claim
 * CTAs.
 *
 * The shelf line is incentive copy only — it never renders the seed's
 * secondary categories. Per the claim gate (multi-category shelf
 * placement spec §3.7), secondaries do not render publicly until the
 * listing is claimed; the promise of multi-shelf placement is the
 * claim incentive itself.
 */
export interface UnclaimedDirectoryBannerProps {
  businessName: string;
}

export default function UnclaimedDirectoryBanner({
  businessName,
}: UnclaimedDirectoryBannerProps) {
  return (
    <Alert
      color="blue"
      variant="light"
      icon={<IconShieldCheck size={20} />}
      radius="md"
      className="mb-4"
    >
      <Text size="sm" c="blue.9">
        <strong>{businessName}</strong> is listed from public information. This is not a claimed profile.
        Claim it free — verify your details, appear on every matching category shelf,
        and showcase 5 top sellers.
      </Text>
    </Alert>
  );
}
