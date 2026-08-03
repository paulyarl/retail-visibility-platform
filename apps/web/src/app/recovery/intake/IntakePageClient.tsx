'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, useCallback } from 'react';
import {
  Container,
  Card,
  Text,
  Title,
  Button,
  Textarea,
  Select,
  TextInput,
  Alert,
  Anchor,
  Group,
  Stack,
  Divider,
  Badge,
  Loader,
  Center,
  Box,
  ThemeIcon,
  Paper,
  FileInput,
  List,
  rem,
} from '@mantine/core';
import {
  IconCheck,
  IconAlertCircle,
  IconShield,
  IconUpload,
  IconFile,
  IconBuildingStore,
  IconCalendar,
  IconArrowRight,
} from '@tabler/icons-react';
import recoveryIntakePublicService from '@/services/RecoveryIntakePublicService';
import type { IntakeContext, SubmitResult, AttachmentUploadResult } from '@/services/RecoveryIntakePublicService';

const RESOLUTION_OPTIONS = [
  { value: 'Full Refund', label: 'Full Refund' },
  { value: 'Partial Refund', label: 'Partial Refund' },
  { value: 'Re-scheduled', label: 'Re-scheduled Service' },
  { value: 'Enforcing Agreement', label: 'Enforcing Agreement' },
  { value: 'Other', label: 'Other (describe in statement)' },
];

const PROFILE_REPAIR_ISSUE_TYPES = [
  { value: 'suspension', label: 'Profile Suspension' },
  { value: 'duplicate_listing', label: 'Duplicate Listing' },
  { value: 'hijacked_listing', label: 'Hijacked Listing' },
  { value: 'ownership_dispute', label: 'Ownership Dispute' },
  { value: 'address_verification_block', label: 'Address Verification Block' },
];

export default function IntakePageClient() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [expired, setExpired] = useState(false);
  const [context, setContext] = useState<IntakeContext | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [ownerStatement, setOwnerStatement] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPhone, setOwnerPhone] = useState('');
  const [proposedResolution, setProposedResolution] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<AttachmentUploadResult[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<SubmitResult | null>(null);

  // Profile repair form state (Track B — escalated)
  const isProfileRepair = context?.intakeKind === 'profile_repair';
  const [issueType, setIssueType] = useState('');
  const [googleProfileId, setGoogleProfileId] = useState('');
  const [suspensionDate, setSuspensionDate] = useState('');
  const [suspensionReason, setSuspensionReason] = useState('');
  const [duplicateListingUrl, setDuplicateListingUrl] = useState('');

  const resolveToken = useCallback(async () => {
    if (!token) {
      setError('No token provided. Please use the link from your outreach email.');
      setLoading(false);
      return;
    }

    try {
      const result = await recoveryIntakePublicService.resolveIntake(token);
      if (result && 'expired' in result && result.expired) {
        setExpired(true);
      } else if (result && !('expired' in result)) {
        // IntakeContext (has full fields) — not the expired shorthand
        setContext(result);
        if (result.alreadySubmitted) {
          setSubmitted({
            intakeId: result.intakeId,
            campaignId: result.campaignId,
            stage: 'intake_submitted',
            alreadySubmitted: true,
          });
        }
      } else {
        setError('Invalid token. Please check your link and try again.');
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to resolve intake');
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    resolveToken();
  }, [resolveToken]);

  const handleFileUpload = async (newFiles: File[]) => {
    if (!token || newFiles.length === 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of newFiles) {
        const result = await recoveryIntakePublicService.uploadAttachment(token, file);
        setUploadedAttachments((prev) => [...prev, result]);
      }
      setFiles([]);
    } catch (err) {
      setError((err as Error).message || 'Failed to upload file');
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!token) return;
    if (ownerStatement.length < 20) {
      setError('Please provide a statement of at least 20 characters.');
      return;
    }
    if (!ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) {
      setError('Please provide a valid email address so we can deliver your resolution.');
      return;
    }

    if (isProfileRepair) {
      // Profile repair intake — evidence payload + issue type
      if (!issueType) {
        setError('Please select the issue type for your profile repair case.');
        return;
      }
      if (uploadedAttachments.length === 0) {
        setError('At least one proof-of-location document (business license or utility bill) is required.');
        return;
      }

      setSubmitting(true);
      setError(null);
      try {
        const result = await recoveryIntakePublicService.submitProfileRepairIntake(token, {
          ownerStatement,
          ownerEmail,
          ownerPhone: ownerPhone || null,
          issueType,
          evidencePayload: {
            proof_of_location: uploadedAttachments.map((a) => a.attachmentId),
            storefront_photos: uploadedAttachments.map((a) => a.attachmentId),
            google_profile_id: googleProfileId || null,
            suspension_notice_details: (suspensionDate || suspensionReason)
              ? { date: suspensionDate || null, quoted_reason: suspensionReason || null }
              : null,
            duplicate_listing_url: duplicateListingUrl || null,
          },
          attachmentIds: uploadedAttachments.map((a) => a.attachmentId),
        });
        setSubmitted(result);
      } catch (err) {
        setError((err as Error).message || 'Failed to submit profile repair intake');
      }
      setSubmitting(false);
      return;
    }

    // Dispute intake (default)
    if (!proposedResolution) {
      setError('Please select a proposed resolution.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = await recoveryIntakePublicService.submitIntake(token, {
        ownerStatement,
        ownerEmail,
        ownerPhone: ownerPhone || null,
        proposedResolution,
        serviceDate: serviceDate || null,
        attachmentIds: uploadedAttachments.map((a) => a.attachmentId),
      });
      setSubmitted(result);
    } catch (err) {
      setError((err as Error).message || 'Failed to submit intake');
    }
    setSubmitting(false);
  };

  // ─── Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <Container size="md" py={40}>
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Resolving your intake link...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  // ─── Expired ──────────────────────────────────────────────────────
  if (expired) {
    return (
      <Container size="md" py={40}>
        <Card withBorder shadow="sm" p="xl">
          <Stack align="center" gap="lg">
            <ThemeIcon size={64} radius="xl" color="orange" variant="light">
              <IconAlertCircle size={32} />
            </ThemeIcon>
            <Title order={2} ta="center">Link Expired</Title>
            <Text c="dimmed" ta="center" maw={500}>
              This dispute intake link has expired. Please request a new link below,
              or contact the representative who sent you the original outreach.
            </Text>
            <Button
              component="a"
              href="/recovery/expired"
              size="lg"
              leftSection={<IconArrowRight size={18} />}
            >
              Request New Link
            </Button>
          </Stack>
        </Card>
      </Container>
    );
  }

  // ─── Error ────────────────────────────────────────────────────────
  if (error && !context) {
    return (
      <Container size="md" py={40}>
        <Card withBorder shadow="sm" p="xl">
          <Stack align="center" gap="lg">
            <ThemeIcon size={64} radius="xl" color="red" variant="light">
              <IconAlertCircle size={32} />
            </ThemeIcon>
            <Title order={2} ta="center">Something Went Wrong</Title>
            <Text c="dimmed" ta="center">{error}</Text>
          </Stack>
        </Card>
      </Container>
    );
  }

  // ─── Submitted (success + idempotent double-submit) ───────────────
  if (submitted) {
    return (
      <Container size="md" py={40}>
        <Card withBorder shadow="sm" p="xl">
          <Stack align="center" gap="lg">
            <ThemeIcon size={64} radius="xl" color="green" variant="light">
              <IconCheck size={32} />
            </ThemeIcon>
            <Title order={2} ta="center">
              {submitted.alreadySubmitted ? 'Already Submitted' : 'Submission Received'}
            </Title>
            <Text c="dimmed" ta="center" maw={500}>
              {submitted.alreadySubmitted
                ? isProfileRepair
                  ? 'Your profile repair intake was already submitted. No further action is needed — your representative will follow up with your appeal letter.'
                  : 'Your dispute intake was already submitted. No further action is needed — your representative will follow up.'
                : isProfileRepair
                  ? 'Thank you for submitting your evidence. Your representative will review your case and draft a reinstatement appeal letter, then follow up with next steps.'
                  : 'Thank you for submitting your dispute intake. Your representative will review your statement and proposed resolution, then follow up with next steps.'}
            </Text>
            <Badge variant="light" color="blue" size="lg">
              Stage: {submitted.stage.replace(/_/g, ' ')}
            </Badge>
          </Stack>
        </Card>
      </Container>
    );
  }

  // ─── Intake Form ──────────────────────────────────────────────────
  if (!context) return null;

  return (
    <Container size="md" py={40}>
      <Stack gap="xl">
        {/* Header */}
        <Card withBorder shadow="sm" p="lg">
          <Group justify="space-between" mb="md">
            <Group gap="sm">
              <ThemeIcon size={40} radius="xl" color="blue" variant="light">
                <IconShield size={20} />
              </ThemeIcon>
              <div>
                <Title order={3}>{isProfileRepair ? 'Profile Repair Appeal Intake' : 'Dispute Resolution Intake'}</Title>
                <Text size="sm" c="dimmed">{isProfileRepair ? 'Profile Repair Portal' : 'Recovery Management Portal'}</Text>
              </div>
            </Group>
            <Badge variant="light" color="gray">Secure</Badge>
          </Group>
          <Divider mb="md" />
          <Stack gap="xs">
            {context.businessName && (
              <Group gap="sm">
                <IconBuildingStore size={16} />
                <Text size="sm"><strong>Business:</strong> {context.businessName}</Text>
              </Group>
            )}
            <Group gap="sm">
              <IconCalendar size={16} />
              <Text size="sm"><strong>Category:</strong> {context.category} · {context.city}</Text>
            </Group>
            <Text size="xs" c="dimmed">
              Link expires: {new Date(context.expiresAt).toLocaleString()}
            </Text>
          </Stack>
        </Card>

        {/* Form */}
        <Card withBorder shadow="sm" p="lg">
          <Stack gap="md">
            <div>
              <Title order={4} mb="xs">Your Statement</Title>
              <Text size="sm" c="dimmed" mb="sm">
                {isProfileRepair
                  ? 'Describe the issue with your business profile from your perspective. When did you notice it? What impact has it had on your business?'
                  : 'Describe what happened from your perspective. Be specific about dates, services, and the nature of the complaint.'}
              </Text>
              <Textarea
                value={ownerStatement}
                onChange={(e) => setOwnerStatement(e.currentTarget.value)}
                placeholder={isProfileRepair
                  ? 'When did you notice the suspension/duplicate/hijack? How has it affected your calls and customers?'
                  : 'What actually happened? Please describe the situation in detail...'}
                minRows={5}
                autosize
              />
              <Text size="xs" c="dimmed" mt={4}>
                {ownerStatement.length}/20 characters minimum
              </Text>
            </div>

            <div>
              <Title order={4} mb="xs">Contact Information</Title>
              <Text size="sm" c="dimmed" mb="sm">
                {isProfileRepair
                  ? 'We need your email to deliver the drafted appeal letter. Phone is optional but helps us reach you urgently.'
                  : 'We need your email to deliver the drafted resolution. Phone is optional but helps us reach you urgently if there\'s a deadline.'}
              </Text>
              <Stack gap="sm">
                <TextInput
                  label="Email Address"
                  required
                  type="email"
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.currentTarget.value)}
                  placeholder="owner@example.com"
                  description={isProfileRepair ? 'Your appeal letter will be delivered to this address.' : 'Your resolution will be delivered to this address.'}
                />
                <TextInput
                  label="Phone Number (optional)"
                  value={ownerPhone}
                  onChange={(e) => setOwnerPhone(e.currentTarget.value)}
                  placeholder="+1 (555) 123-4567"
                />
              </Stack>
            </div>

            {isProfileRepair ? (
              <>
                {/* Profile repair specific fields */}
                <div>
                  <Title order={4} mb="xs">Issue Type</Title>
                  <Text size="sm" c="dimmed" mb="sm">
                    What type of profile issue are you experiencing?
                  </Text>
                  <Select
                    value={issueType}
                    onChange={(val) => setIssueType(val || '')}
                    data={PROFILE_REPAIR_ISSUE_TYPES}
                    placeholder="Select the issue type..."
                  />
                </div>

                <div>
                  <Title order={4} mb="xs">Google Business Profile ID or URL</Title>
                  <Text size="sm" c="dimmed" mb="sm">
                    The original Google Business Profile ID or URL (if known). This helps us identify the correct listing to appeal.
                  </Text>
                  <TextInput
                    value={googleProfileId}
                    onChange={(e) => setGoogleProfileId(e.currentTarget.value)}
                    placeholder="e.g. https://www.google.com/maps/place/... or profile ID"
                  />
                </div>

                {(issueType === 'suspension' || !issueType) && (
                  <div>
                    <Title order={4} mb="xs">Suspension Notice Details (if suspended)</Title>
                    <Text size="sm" c="dimmed" mb="sm">
                      When did you receive the suspension notice, and what reason was given?
                    </Text>
                    <Stack gap="sm">
                      <TextInput
                        label="Suspension Date"
                        type="date"
                        value={suspensionDate}
                        onChange={(e) => setSuspensionDate(e.currentTarget.value)}
                      />
                      <Textarea
                        label="Quoted Reason (if any)"
                        value={suspensionReason}
                        onChange={(e) => setSuspensionReason(e.currentTarget.value)}
                        placeholder="Paste the reason Google gave for the suspension..."
                        minRows={2}
                        autosize
                      />
                    </Stack>
                  </div>
                )}

                {(issueType === 'duplicate_listing' || issueType === 'hijacked_listing') && (
                  <div>
                    <Title order={4} mb="xs">{issueType === 'duplicate_listing' ? 'Duplicate Listing URL' : 'Hijacked Listing URL'}</Title>
                    <Text size="sm" c="dimmed" mb="sm">
                      The URL of the duplicate or hijacked listing that should be removed or transferred to you.
                    </Text>
                    <TextInput
                      value={duplicateListingUrl}
                      onChange={(e) => setDuplicateListingUrl(e.currentTarget.value)}
                      placeholder="https://www.google.com/maps/place/..."
                    />
                  </div>
                )}

                <div>
                  <Title order={4} mb="xs">Evidence Documents (required)</Title>
                  <Text size="sm" c="dimmed" mb="sm">
                    Upload proof of business ownership: business license, utility bill, storefront photos. PDF, PNG, or JPEG. Max 10MB each.
                  </Text>
                  <FileInput
                    multiple
                    value={files}
                    onChange={handleFileUpload}
                    placeholder="Click to upload evidence documents"
                    accept="application/pdf,image/png,image/jpeg"
                    leftSection={<IconUpload size={16} />}
                  />
                  {uploading && (
                    <Group gap="sm" mt="sm">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Uploading...</Text>
                    </Group>
                  )}
                  {uploadedAttachments.length > 0 && (
                    <List mt="sm" spacing="xs">
                      {uploadedAttachments.map((att) => (
                        <List.Item
                          key={att.attachmentId}
                          icon={<IconFile size={16} />}
                        >
                          <Anchor
                            size="sm"
                            href={`/api/public/recovery/intake/attachments/${att.attachmentId}?token=${encodeURIComponent(token || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {att.fileName} ({att.fileType}, {(att.fileSize / 1024).toFixed(0)}KB)
                          </Anchor>
                        </List.Item>
                      ))}
                    </List>
                  )}
                </div>
              </>
            ) : (
              <>
                {/* Dispute intake fields (default) */}
                <div>
                  <Title order={4} mb="xs">Proposed Resolution</Title>
                  <Text size="sm" c="dimmed" mb="sm">
                    What outcome would resolve this dispute for you?
                  </Text>
                  <Select
                    value={proposedResolution}
                    onChange={(val) => setProposedResolution(val || '')}
                    data={RESOLUTION_OPTIONS}
                    placeholder="Select a proposed resolution..."
                  />
                </div>

                <div>
                  <Title order={4} mb="xs">Service Date (optional)</Title>
                  <input
                    type="date"
                    value={serviceDate}
                    onChange={(e) => setServiceDate(e.currentTarget.value)}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: rem(4),
                      border: '1px solid #ced4da',
                      fontSize: rem(14),
                    }}
                  />
                </div>

                <div>
                  <Title order={4} mb="xs">Supporting Documents (optional)</Title>
                  <Text size="sm" c="dimmed" mb="sm">
                    Upload proof: contracts, receipts, photos. PDF, PNG, or JPEG. Max 10MB each.
                  </Text>
                  <FileInput
                    multiple
                    value={files}
                    onChange={handleFileUpload}
                    placeholder="Click to upload files"
                    accept="application/pdf,image/png,image/jpeg"
                    leftSection={<IconUpload size={16} />}
                  />
                  {uploading && (
                    <Group gap="sm" mt="sm">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Uploading...</Text>
                    </Group>
                  )}
                  {uploadedAttachments.length > 0 && (
                    <List mt="sm" spacing="xs">
                      {uploadedAttachments.map((att) => (
                        <List.Item
                          key={att.attachmentId}
                          icon={<IconFile size={16} />}
                        >
                          <Anchor
                            size="sm"
                            href={`/api/public/recovery/intake/attachments/${att.attachmentId}?token=${encodeURIComponent(token || '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {att.fileName} ({att.fileType}, {(att.fileSize / 1024).toFixed(0)}KB)
                          </Anchor>
                        </List.Item>
                      ))}
                    </List>
                  )}
                </div>
              </>
            )}

            {error && (
              <Alert color="red" icon={<IconAlertCircle size={16} />}>
                {error}
              </Alert>
            )}

            <Divider my="sm" />

            <Group justify="flex-end">
              <Button
                size="lg"
                loading={submitting}
                onClick={handleSubmit}
                leftSection={<IconCheck size={18} />}
              >
                Submit Intake
              </Button>
            </Group>
          </Stack>
        </Card>

        <Paper p="md" withBorder>
          <Text size="xs" c="dimmed" ta="center">
            This portal is token-gated and requires no account. Your submission is confidential
            and will only be reviewed by your assigned representative.
          </Text>
        </Paper>
      </Stack>
    </Container>
  );
}
