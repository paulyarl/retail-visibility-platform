'use client';

import { useState } from 'react';
import { useDirectorySupport } from '@/hooks/support/useDirectorySupport';
import DirectoryStatusBadge from '@/components/directory/DirectoryStatusBadge';

export default function DirectoryTenantLookup() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<any>(null);
  const [status, setStatus] = useState<any>(null);
  const [quality, setQuality] = useState<any>(null);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  
  const { loading, error, getStatus, checkQuality, getNotes, addNote, searchTenants } = useDirectorySupport();

  const handleSearch = async () => {
    if (searchQuery.length < 2) return;
    const results = await searchTenants(searchQuery);
    setSearchResults(results);
  };

  const handleSelectTenant = async (tenant: any) => {
    setSelectedTenant(tenant);
    const [statusData, qualityData, notesData] = await Promise.all([
      getStatus(tenant.id),
      checkQuality(tenant.id),
      getNotes(tenant.id),
    ]);
    setStatus(statusData);
    setQuality(qualityData);
    setNotes(notesData);
  };

  const handleAddNote = async () => {
    if (!selectedTenant || !newNote.trim()) return;
    const success = await addNote(selectedTenant.id, newNote);
    if (success) {
      setNewNote('');
      const updatedNotes = await getNotes(selectedTenant.id);
      setNotes(updatedNotes);
    }
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Tenant Lookup
        </h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search by tenant ID or business name..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
          />
          <button
            onClick={handleSearch}
            disabled={loading || searchQuery.length < 2}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Search
          </button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((tenant) => (
              <button
                key={tenant.id}
                onClick={() => handleSelectTenant(tenant)}
                className="w-full text-left p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {tenant.businessProfile?.businessName || tenant.name}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {tenant.id} • {tenant.subscriptionTier}
                    </p>
                  </div>
                  {tenant.directorySettings && (
                    <DirectoryStatusBadge
                      isPublished={tenant.directorySettings.isPublished}
                      isFeatured={tenant.directorySettings.isFeatured}
                    />
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected Tenant Details */}
      {selectedTenant && status && quality && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Directory Status
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Business Name</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {status.profile?.businessName || 'Not set'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
                <DirectoryStatusBadge
                  isPublished={status.settings.isPublished}
                  isFeatured={status.isFeatured}
                />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Tier</p>
                <p className="font-medium text-gray-900 dark:text-white capitalize">
                  {status.tenant.subscriptionTier.replace('_', ' ')}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Items</p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {status.itemCount}
                </p>
              </div>
            </div>
          </div>

          {/* Quality Check */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quality Check
            </h3>
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">Completeness</span>
                <span className="text-lg font-bold text-gray-900 dark:text-white">
                  {quality.completenessPercent}%
                </span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    quality.completenessPercent >= 80
                      ? 'bg-green-600'
                      : quality.completenessPercent >= 60
                      ? 'bg-amber-600'
                      : 'bg-red-600'
                  }`}
                  style={{ width: `${quality.completenessPercent}%` }}
                />
              </div>
            </div>

            {quality.recommendations.length > 0 && (
              <div>
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Recommendations:
                </p>
                <ul className="space-y-1">
                  {quality.recommendations.map((rec: string, i: number) => (
                    <li key={i} className="text-sm text-gray-600 dark:text-gray-400">
                      • {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Support Notes */}
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Support Notes
            </h3>
            
            {/* Add Note */}
            <div className="mb-4 flex gap-2">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a support note..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Note
              </button>
            </div>

            {/* Notes List */}
            <div className="space-y-3">
              {notes.length === 0 ? (
                <p className="text-sm text-gray-500 dark:text-gray-400">No notes yet</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="border-l-4 border-blue-500 pl-4 py-2">
                    <p className="text-sm text-gray-900 dark:text-white">{note.note}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {note.createdByUser.firstName} {note.createdByUser.lastName} •{' '}
                      {new Date(note.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
    </div>
  );
}
