'use client';

import Link from 'next/link';
import { IconShieldCheck } from '@tabler/icons-react';
import { Alert, Button, Text } from '@mantine/core';

/**
 * UnclaimedDirectoryBanner — primary "Claim this listing" CTA for
 * directory presence seeds. Uses the ShieldCheck icon to distinguish
 * the claim action from suggest/add CTAs elsewhere.
 *
 * When the seed has secondary categories, the copy adds the multi-shelf
 * claim incentive (multi-category shelf placement spec §3.3): claiming
 * lets the owner manage categories, and the listing appears on every
 * matching category shelf (post-claim /directory browse honors
 * secondary_categories; pre-claim /place shelves do since the shelf-match
 * update). Never renders a shelf promise when there are no secondaries.
 */
export interface UnclaimedDirectoryBannerProps {
  businessName: string;
  claimToken?: string | null;
  publicDisclaimer?: string | null;
  secondaryCategories?: string[];
}

export default function UnclaimedDirectoryBanner({
  businessName,
  claimToken,
  publicDisclaimer,
  secondaryCategories,
}: UnclaimedDirectoryBannerProps) {
  const hasToken = !!claimToken;
  const claimHref = hasToken
    ? `/place/claim/${claimToken}`
    : '#claim-inquiry';
  const shelves = (secondaryCategories || []).filter(Boolean);

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
        {shelves.length > 0 && (
          <> Claim to verify your details and appear on every matching category shelf.</>
        )}
      </Text>

      {hasToken ? (
        <Button
          component={Link}
          href={claimHref}
          size="xs"
          leftSection={<IconShieldCheck size={16} />}
          color="blue"
          variant="filled"
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
