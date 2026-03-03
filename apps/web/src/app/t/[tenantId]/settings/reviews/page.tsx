import { Metadata } from 'next';
import { use } from 'react';
import { Container, Title, Text, Stack } from '@mantine/core';
import ReviewManagementDashboard from '@/components/reviews/ReviewManagementDashboard';

interface ReviewManagementPageProps {
  params: Promise<{
    tenantId: string;
  }>;
}

export const metadata: Metadata = {
  title: 'Review Management',
  description: 'Manage and moderate customer reviews for your store',
};

export default function ReviewManagementPage({ params }: ReviewManagementPageProps) {
  const { tenantId } = use(params);

  return (
    <Container size="xl" py="md">
      <Stack gap="lg">
        <div>
          <Title order={1}>Review Management</Title>
          <Text c="dimmed" size="sm">
            Review and moderate customer reviews for your store. Anonymous reviews require approval before they become visible.
          </Text>
        </div>

        <ReviewManagementDashboard tenantId={tenantId} />
      </Stack>
    </Container>
  );
}
