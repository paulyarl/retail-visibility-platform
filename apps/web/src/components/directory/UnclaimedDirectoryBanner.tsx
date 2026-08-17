'use client';

import Link from 'next/link';
import { IconInfoCircle } from '@tabler/icons-react';
import { Alert, Text } from '@mantine/core';

/**
 * UnclaimedDirectoryBanner — shown on directory listing pages for
 * listings with listing_origin = 'directory_seed' (unclaimed presence seeds).
 *
 * Renders a non-intrusive alert explaining this is a public-information
 * listing that the owner can claim.
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
  const claimHref = claimToken
    ? `/place/claim/${claimToken}`
    : '/directory';

  return (
    <Alert
      color="blue"
      variant="light"
      icon={<IconInfoCircle size={18} />}
      radius="md"
      className="mb-4"
    >
      <Text size="sm" c="blue.9">
        <strong>{businessName}</strong> is listed from public information (address, phone, and SNAP
        where reported). This is not a claimed profile.{' '}
        <Link href={claimHref} className="underline font-medium">
          Are you the owner? Claim this listing
        </Link>
        .
      </Text>
      {publicDisclaimer && (
        <Text size="xs" c="dimmed" mt={4}>
          {publicDisclaimer}
        </Text>
      )}
    </Alert>
  );
}
