'use client';

import { useState } from 'react';
import {
  Container,
  Card,
  Text,
  Title,
  Button,
  TextInput,
  Alert,
  Group,
  Stack,
  ThemeIcon,
  Loader,
  Center,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconRefresh,
  IconCheck,
  IconMailForward,
} from '@tabler/icons-react';
import recoveryIntakePublicService from '@/services/RecoveryIntakePublicService';

export default function RecoveryExpiredPage() {
  const [campaignId, setCampaignId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleReissue = async () => {
    if (!campaignId.trim()) {
      setError('Please enter your campaign ID.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await recoveryIntakePublicService.reissueLink(campaignId.trim());
      setSuccess(`A new link has been generated. Please check your email or contact your representative. New link: ${result.url}`);
    } catch (err) {
      setError((err as Error).message || 'Failed to reissue link. Please contact your representative.');
    }
    setLoading(false);
  };

  return (
    <Container size="md" py={40}>
      <Card withBorder shadow="sm" p="xl">
        <Stack align="center" gap="lg">
          <ThemeIcon size={64} radius="xl" color="orange" variant="light">
            <IconAlertCircle size={32} />
          </ThemeIcon>
          <Title order={2} ta="center">Link Expired</Title>
          <Text c="dimmed" ta="center" maw={500}>
            Your dispute intake link has expired. Enter your campaign ID below to
            request a new link, or contact the representative who sent you the
            original outreach email.
          </Text>

          {error && (
            <Alert color="red" icon={<IconAlertCircle size={16} />} w="100%">
              {error}
            </Alert>
          )}

          {success && (
            <Alert color="green" icon={<IconCheck size={16} />} w="100%">
              {success}
            </Alert>
          )}

          <Stack w="100%" maw={400}>
            <TextInput
              label="Campaign ID"
              placeholder="e.g., mcamp-xxxxxxxx"
              value={campaignId}
              onChange={(e) => setCampaignId(e.currentTarget.value)}
            />
            <Button
              size="lg"
              loading={loading}
              onClick={handleReissue}
              leftSection={<IconRefresh size={18} />}
              fullWidth
            >
              Request New Link
            </Button>
          </Stack>

          <DividerLabel>or</DividerLabel>

          <Group gap="sm">
            <IconMailForward size={20} />
            <Text size="sm" c="dimmed">
              Contact your representative directly for assistance.
            </Text>
          </Group>
        </Stack>
      </Card>
    </Container>
  );
}

function DividerLabel({ children }: { children: React.ReactNode }) {
  return (
    <Group gap="xs" w="100%" justify="center">
      <div style={{ flex: 1, height: 1, background: '#dee2e6' }} />
      <Text size="xs" c="dimmed">{children}</Text>
      <div style={{ flex: 1, height: 1, background: '#dee2e6' }} />
    </Group>
  );
}
