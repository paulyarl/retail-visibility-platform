'use client';

import { useState } from 'react';
import { Calendar, Star, X } from 'lucide-react';

interface FeatureListingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (until: Date, priority: number) => void;
  loading?: boolean;
  tenantName?: string;
}

export default function FeatureListingModal({
  isOpen,
  onClose,
  onConfirm,
  loading = false,
  tenantName = ''
}: FeatureListingModalProps) {
  const [featuredUntil, setFeaturedUntil] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [priority, setPriority] = useState<number>(5);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const until = new Date(featuredUntil);
    if (until > new Date()) {
      onConfirm(until, priority);
    }
  };

  const getPriorityLabel = (value: number) => {
    if (value <= 3) return 'Low';
    if (value <= 7) return 'Medium';
    return 'High';
  };

  const getPriorityColor = (value: number) => {
    if (value <= 3) return 'text-gray-600 border-gray-300';
    if (value <= 7) return 'text-blue-600 border-blue-300';
    return 'text-purple-600 border-purple-300';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Star className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Feature Listing</h3>
              <p className="text-sm text-gray-500">
                {tenantName ? `Feature ${tenantName}` : 'Feature this listing'} in the directory
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Featured Until
            </label>
            <input
              type="date"
              value={featuredUntil}
              onChange={(e) => setFeaturedUntil(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              required
            />
            <p className="mt-1 text-xs text-gray-500">
              The listing will be featured until this date
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Placement Priority
            </label>
            <div className="flex items-center gap-4">
              <input
                type="range"
                min="1"
                max="10"
                value={priority}
                onChange={(e) => setPriority(Number(e.target.value))}
                className="flex-1"
              />
              <div className={`px-3 py-1 rounded-full border text-sm font-medium ${getPriorityColor(priority)}`}>
                {priority} - {getPriorityLabel(priority)}
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Higher priority = better placement in directory listings
            </p>
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {loading ? 'Featuring...' : 'Feature Listing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
