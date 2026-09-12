'use client';

import Link from 'next/link';
import { IconShieldCheck } from '@tabler/icons-react';
import { Alert, Button, Text } from '@mantine/core';

/**
 * UnclaimedDirectoryBanner — primary "Claim this listing" CTA for
 * directory presence seeds. Uses the ShieldCheck icon to distinguish
 * the claim action from suggest/add CTAs elsewhere.
 *
 * The shelf line is incentive copy only — it never renders the seed's
 * secondary categories. Per the claim gate (multi-category shelf
 * placement spec §3.7), secondaries do not render publicly until the
 * listing is claimed; the promise of multi-shelf placement is the
 * claim incentive itself.
 */
export interface UnclaimedDirectoryBannerProps {
  businessName: string;
  claimToken?: string | null;
  publicDisclaimer?: string | null;
}

export default function UnclaimedDirectoryBanner({
  businessName,
  claimToken,
  publicDisclaimer,
}: UnclaimedDirectoryBannerProps) {
  const hasToken = !!claimToken;
  const claimHref = hasToken
    ? `/place/claim/${claimToken}`
    : '#claim-inquiry';

  return (
    <Alert
      color="blue"
      variant="light"
      icon={<IconShieldCheck size={20} />}
      radius="md"
      className="mb-4"
    >
      <Text size="sm" c="blue.9" className="mb-2">
        <strong>{businessName}</strong> is listed from public information. This is not a claimed profile.
        Claim to verify your details and appear on every matching category shelf.
      </Text>

      {hasToken ? (
        <Button
          component={Link}
          href={claimHref}
          size="xs"
          leftSection={<IconShieldCheck size={16} />}
          color="white"
          variant="gradient"
        >
          Claim this listing
        </Button>
      ) : (
        <Text size="sm" c="blue.9">
          Are you the owner? <Link href="#claim-inquiry" className="underline font-medium">Contact us</Link> to claim this listing.
        </Text>
      )}
    </Alert>
  );
}
