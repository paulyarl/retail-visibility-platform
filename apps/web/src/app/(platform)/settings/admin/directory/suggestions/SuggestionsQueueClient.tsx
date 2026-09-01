'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Lightbulb, RefreshCw, Check, X, FileSearch, Copy, Loader2 } from 'lucide-react';
import { Badge, Button, Select, Table, Modal } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';
import directorySuggestionAdminService, { SuggestionRecord } from '@/services/DirectorySuggestionAdminService';
import { formatDistanceToNow } from 'date-fns';

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'submitted', label: 'Submitted' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'duplicate', label: 'Duplicate' },
];

export default function SuggestionsQueueClient() {
  const router = useRouter();
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>('submitted');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<SuggestionRecord | null>(null);
  const [opened, { open, close }] = useDisclosure(false);

  const limit = 25;

  const fetchSuggestions = async (reset = false) => {
    setLoading(true);
    setError(null);
    try {
      const filters: any = { limit, offset: (page - 1) * limit };
      if (status && status !== 'all') filters.status = status;
      const result = await directorySuggestionAdminService.listSuggestions(filters);
      setSuggestions(result.suggestions);
      setTotal(result.total);
      if (reset) setPage(1);
    } catch (err: any) {
      setError(err?.message || 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuggestions(true);
  }, [status]);

  useEffect(() => {
    fetchSuggestions(false);
  }, [page]);

  const handleStatusChange = async (id: string, newStatus: SuggestionRecord['status']) => {
    try {
      const result = await directorySuggestionAdminService.updateStatus(id, newStatus);
      if (result.success) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === id ? { ...s, ...result.suggestion } as SuggestionRecord : s))
        );
      } else {
        setError(result.error || 'Failed to update status');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update status');
    }
  };

  const openDetail = (s: SuggestionRecord) => {
    setDetail(s);
    open();
  };

  const statusColor: Record<string, string> = {
    submitted: 'blue',
    under_review: 'yellow',
    approved: 'green',
    rejected: 'red',
    duplicate: 'gray',
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Lightbulb className="w-6 h-6 text-yellow-500" />
            Public Suggestions
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Review businesses suggested by visitors. {total} total.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={status}
            onChange={setStatus}
            data={STATUS_OPTIONS}
            clearable
            placeholder="Filter by status"
          />
          <Button
            variant="light"
            onClick={() => fetchSuggestions(false)}
            leftSection={<RefreshCw className="w-4 h-4" />}
            loading={loading}
          >
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 overflow-hidden">
        <Table striped highlightOnHover>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Business</Table.Th>
              <Table.Th>Location</Table.Th>
              <Table.Th>Category</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>Submitted</Table.Th>
              <Table.Th className="text-right">Actions</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {loading && suggestions.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" />
                  <p className="text-sm text-gray-500 mt-2">Loading suggestions...</p>
                </Table.Td>
              </Table.Tr>
            ) : suggestions.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={6} className="text-center py-12 text-gray-500">
                  No suggestions found.
                </Table.Td>
              </Table.Tr>
            ) : (
              suggestions.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>
                    <div className="font-medium text-gray-900 dark:text-white">{s.businessName}</div>
                    {s.submitterEmail && (
                      <div className="text-xs text-gray-500">{s.submitterEmail}</div>
                    )}
                  </Table.Td>
                  <Table.Td className="text-sm text-gray-600 dark:text-gray-400">
                    {s.city ? `${s.city}, ${s.state || ''}` : '—'}
                  </Table.Td>
                  <Table.Td className="text-sm text-gray-600 dark:text-gray-400">
                    {s.primaryCategory || '—'}
                  </Table.Td>
                  <Table.Td>
                    <Badge color={statusColor[s.status] || 'gray'} size="sm">
                      {s.status.replace('_', ' ')}
                    </Badge>
                  </Table.Td>
                  <Table.Td className="text-sm text-gray-500">
                    {formatDistanceToNow(new Date(s.createdAt), { addSuffix: true })}
                  </Table.Td>
                  <Table.Td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button size="xs" variant="subtle" onClick={() => openDetail(s)} leftSection={<FileSearch className="w-3.5 h-3.5" />}>
                        View
                      </Button>
                      <Button size="xs" color="green" variant="light" onClick={() => handleStatusChange(s.id, 'approved')} leftSection={<Check className="w-3.5 h-3.5" />}>
                        Approve
                      </Button>
                      <Button size="xs" color="red" variant="light" onClick={() => handleStatusChange(s.id, 'rejected')} leftSection={<X className="w-3.5 h-3.5" />}>
                        Reject
                      </Button>
                      <Button size="xs" color="gray" variant="light" onClick={() => handleStatusChange(s.id, 'duplicate')} leftSection={<Copy className="w-3.5 h-3.5" />}>
                        Dup
                      </Button>
                    </div>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>

        {total > limit && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <Button variant="subtle" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Previous
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {page} of {Math.ceil(total / limit)}
            </span>
            <Button
              variant="subtle"
              disabled={page * limit >= total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </div>

      <Modal opened={opened} onClose={close} title={detail?.businessName || 'Suggestion Detail'} size="lg">
        {detail && (
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-500">Address</span>
                <p className="text-gray-900 dark:text-white">{detail.address || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">City / State</span>
                <p className="text-gray-900 dark:text-white">{detail.city ? `${detail.city}, ${detail.state}` : '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">ZIP</span>
                <p className="text-gray-900 dark:text-white">{detail.zipCode || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Phone</span>
                <p className="text-gray-900 dark:text-white">{detail.phone || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Category</span>
                <p className="text-gray-900 dark:text-white">{detail.primaryCategory || '—'}</p>
              </div>
              <div>
                <span className="text-gray-500">Source Page</span>
                <p className="text-gray-900 dark:text-white break-all">{detail.sourcePage || '—'}</p>
              </div>
            </div>
            {detail.submitterComment && (
              <div>
                <span className="text-gray-500">Comment</span>
                <p className="text-gray-900 dark:text-white whitespace-pre-wrap">{detail.submitterComment}</p>
              </div>
            )}
            <div className="pt-4 flex gap-2 justify-end border-t border-gray-200 dark:border-gray-700">
              <Button color="green" onClick={() => handleStatusChange(detail.id, 'approved')}>Approve</Button>
              <Button color="red" variant="light" onClick={() => handleStatusChange(detail.id, 'rejected')}>Reject</Button>
              <Button color="gray" variant="light" onClick={() => handleStatusChange(detail.id, 'duplicate')}>Duplicate</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
