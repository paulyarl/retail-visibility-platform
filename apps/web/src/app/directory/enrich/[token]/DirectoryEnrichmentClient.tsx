'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Container,
  Card,
  Text,
  Title,
  Button,
  Alert,
  Stack,
  ThemeIcon,
  Center,
  Group,
  Loader,
  Badge,
  TextInput,
  Textarea,
  Checkbox,
  FileInput,
  Divider,
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconClock,
  IconArrowLeft,
  IconUpload,
  IconSparkles,
} from '@tabler/icons-react';
import directoryEnrichmentPublicService, {
  EnrichmentContext,
  IntakeDefinition,
} from '@/services/DirectoryEnrichmentPublicService';

type PageState = 'loading' | 'valid' | 'expired' | 'submitted' | 'error';

interface FormValues {
  hours?: any;
  phone?: string;
  website?: string;
  snap_ebt?: boolean;
  description?: string;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
}

export default function DirectoryEnrichmentClient() {
  const params = useParams();
  const router = useRouter();
  const token = (params?.token as string) || '';

  const [state, setState] = useState<PageState>('loading');
  const [context, setContext] = useState<EnrichmentContext | null>(null);
  const [definition, setDefinition] = useState<IntakeDefinition | null>(null);
  const [values, setValues] = useState<FormValues>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [files, setFiles] = useState<File[]>([]);

  const loadContext = useCallback(async () => {
    if (!token) {
      setState('error');
      return;
    }
    const result = await directoryEnrichmentPublicService.resolveToken(token);
    if (!result) {
      setState('error');
      return;
    }
    if (result.expired) {
      setState('expired');
      return;
    }
    if (result.context && result.definition) {
      setContext(result.context);
      setDefinition(result.definition);
      setState('valid');
    } else {
      setState('error');
    }
  }, [token]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const result = await directoryEnrichmentPublicService.submitEnrichment(token, {
        ownerEmail: values.owner_email,
        ownerPhone: values.owner_phone,
        evidencePayload: {
          hours: values.hours,
          phone: values.phone,
          website: values.website,
          snap_ebt: values.snap_ebt,
          description: values.description,
          owner_name: values.owner_name,
        },
      });
      if (result.success) {
        setState('submitted');
      } else {
        setError(result.error || 'submission_failed');
      }
    } catch (err: any) {
      setError(err?.message || 'submission_failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (state === 'loading') {
    return (
      <Container size="sm" className="py-12">
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Loading enrichment form...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (state === 'error') {
    return (
      <Container size="sm" className="py-12">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="md" ta="center">
            <ThemeIcon size={56} radius="xl" color="red">
              <IconAlertCircle size={28} />
            </ThemeIcon>
            <Title order={3}>Link Not Found</Title>
            <Text c="dimmed">
              This enrichment link is invalid or has been removed. Please contact the directory
              operator for a new link.
            </Text>
            <Button component={Link} href="/directory" variant="light" leftSection={<IconArrowLeft size={16} />}>
              Back to Directory
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  if (state === 'expired') {
    return (
      <Container size="sm" className="py-12">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="md" ta="center">
            <ThemeIcon size={56} radius="xl" color="orange">
              <IconClock size={28} />
            </ThemeIcon>
            <Title order={3}>Link Expired</Title>
            <Text c="dimmed">
              This enrichment link has expired. Please request a new link from the directory
              operator.
            </Text>
            <Button component={Link} href="/directory" variant="light" leftSection={<IconArrowLeft size={16} />}>
              Back to Directory
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  if (state === 'submitted') {
    return (
      <Container size="sm" className="py-12">
        <Card withBorder shadow="sm" padding="xl" radius="md">
          <Stack align="center" gap="md" ta="center">
            <ThemeIcon size={56} radius="xl" color="green">
              <IconCheck size={28} />
            </ThemeIcon>
            <Title order={3}>Listing Updated!</Title>
            <Text>
              Thank you! Your information has been saved and will appear on the{' '}
              <strong>{context?.city}</strong> {context?.category} directory for{' '}
              <strong>{context?.businessName}</strong>.
            </Text>
            <Alert color="blue" variant="light" icon={<IconSparkles size={16} />} w="100%">
              Would you like to claim this listing to get a dashboard where you can manage
              everything in one place? Claiming gives you full control and unlocks upgrade options.
            </Alert>
            <Group>
              <Button component={Link} href={`/place/${context?.slug}`} leftSection={<IconCheck size={16} />}>
                View My Listing
              </Button>
              <Button
                component={Link}
                href="/directory"
                variant="light"
                leftSection={<IconArrowLeft size={16} />}
              >
                Back to Directory
              </Button>
            </Group>
          </Stack>
        </Card>
      </Container>
    );
  }

  // state === 'valid'
  return (
    <Container size="md" className="py-12">
      <Card withBorder shadow="sm" padding="xl" radius="md">
        <Stack gap="lg">
          {/* Header */}
          <div>
            <Badge color="blue" variant="light" mb="sm">
              Update Your Listing
            </Badge>
            <Title order={2}>{context?.businessName}</Title>
            <Text c="dimmed" size="sm" mt="xs">
              {context?.category} · {context?.city}, {context?.state}
            </Text>
          </div>

          <Divider />

          <Text size="sm" c="dimmed">
            Update your listing information below. Your changes will appear on the public directory.
            Fields marked with * are required.
          </Text>

          {/* Form fields */}
          <Stack gap="md">
            {/* Phone */}
            <TextInput
              label="Phone Number"
              placeholder="(317) 555-0100"
              value={values.phone || ''}
              onChange={(e) => setValues({ ...values, phone: e.target.value })}
            />

            {/* Website */}
            <TextInput
              label="Website"
              placeholder="https://yourbusiness.com"
              value={values.website || ''}
              onChange={(e) => setValues({ ...values, website: e.target.value })}
            />

            {/* Description */}
            <Textarea
              label="Business Description"
              placeholder="A short description of your business..."
              autosize
              minRows={3}
              value={values.description || ''}
              onChange={(e) => setValues({ ...values, description: e.target.value })}
            />

            {/* SNAP/EBT */}
            <Checkbox
              label="We accept SNAP/EBT"
              checked={!!values.snap_ebt}
              onChange={(e) => setValues({ ...values, snap_ebt: e.currentTarget.checked })}
            />

            {/* Photos */}
            <FileInput
              label="Logo or Storefront Photo"
              placeholder="Upload up to 3 photos"
              multiple
              accept="image/*"
              value={files}
              onChange={setFiles}
              leftSection={<IconUpload size={16} />}
            />

            <Divider label="Owner Info (not published)" labelPosition="center" />

            {/* Owner name */}
            <TextInput
              label="Your Name (optional)"
              placeholder="Jane Doe"
              value={values.owner_name || ''}
              onChange={(e) => setValues({ ...values, owner_name: e.target.value })}
            />

            {/* Owner email */}
            <TextInput
              label="Your Email (optional)"
              placeholder="jane@example.com"
              value={values.owner_email || ''}
              onChange={(e) => setValues({ ...values, owner_email: e.target.value })}
            />

            {/* Owner phone */}
            <TextInput
              label="Your Phone (optional)"
              placeholder="(317) 555-0100"
              value={values.owner_phone || ''}
              onChange={(e) => setValues({ ...values, owner_phone: e.target.value })}
            />
          </Stack>

          {error && (
            <Alert color="red" variant="light">
              {error === 'validation_failed'
                ? 'Please check your inputs and try again.'
                : error === 'token_expired'
                  ? 'This link has expired. Please request a new one.'
                  : 'Something went wrong. Please try again.'}
            </Alert>
          )}

          <Divider />

          <Group justify="space-between">
            <Button
              component={Link}
              href="/directory"
              variant="light"
              leftSection={<IconArrowLeft size={16} />}
            >
              Cancel
            </Button>
            <Button size="md" loading={submitting} onClick={handleSubmit} leftSection={<IconCheck size={18} />}>
              Submit Updates
            </Button>
          </Group>

          <Text size="xs" c="dimmed" ta="center">
            Your information will be reviewed and published to the directory.
          </Text>
        </Stack>
      </Card>
    </Container>
  );
}
