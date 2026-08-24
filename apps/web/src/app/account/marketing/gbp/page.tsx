'use client';

import { useEffect, useState, useCallback } from 'react';
import { Star, MapPin, Phone, Globe, Tag, RefreshCw, AlertCircle } from 'lucide-react';
import marketingCustomerService, {
  GbpStatusResponse,
  GbpVerificationOption,
} from '@/services/MarketingCustomerService';
import { VerificationStatusCard } from './VerificationStatusCard';
import { PinDialog } from './PinDialog';

export default function GbpDashboardPage() {
  const [status, setStatus] = useState<GbpStatusResponse | null>(null);
  const [options, setOptions] = useState<GbpVerificationOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [startingVerification, setStartingVerification] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const data = await marketingCustomerService.getGbpStatus();
      setStatus(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load GBP status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  const handleStartVerification = async () => {
    if (!status?.connected) return;
    try {
      setStartingVerification(true);
      const opts = await marketingCustomerService.getVerificationOptions();
      setOptions(opts);
    } catch (err: any) {
      setError(err.message || 'Failed to load verification options');
    } finally {
      setStartingVerification(false);
    }
  };

  const handleSelectOption = async (option: GbpVerificationOption) => {
    try {
      setStartingVerification(true);
      await marketingCustomerService.startVerification(option);
      setShowPinDialog(true);
      setOptions([]);
    } catch (err: any) {
      setError(err.message || 'Failed to start verification');
    } finally {
      setStartingVerification(false);
    }
  };

  const handleCompleteVerification = async (pin: string) => {
    const result = await marketingCustomerService.completeVerification(pin);
    setShowPinDialog(false);
    await loadStatus();
    if (!result.verified) {
      setError(result.message || 'PIN verification failed — please try again');
    }
    return result;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            {error}
            <button
              onClick={() => { setError(null); loadStatus(); }}
              className="ml-2 underline text-sm"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!status) return null;

  const loc = status.location;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Google Business Profile</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your business presence on Google</p>
        </div>
        <button
          onClick={loadStatus}
          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          title="Refresh"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Connection Status */}
      <div className={`rounded-lg border p-4 ${status.connected ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${status.connected ? 'bg-green-500' : 'bg-yellow-500'}`} />
          <div>
            <p className="font-medium text-gray-900 dark:text-gray-100">
              {status.connected ? 'Google Business Profile Connected' : 'Not Connected'}
            </p>
            <p className="text-sm text-gray-500">
              {status.connected ? 'Your Google Business Profile is linked to your account.' : 'Connect your Google Business Profile to manage reviews, posts, and photos.'}
            </p>
          </div>
        </div>
      </div>

      {/* Verification Status */}
      {status.connected && loc && (
        <VerificationStatusCard
          verificationState={loc.verificationState}
          onStartVerification={handleStartVerification}
          startingVerification={startingVerification}
          options={options}
          onSelectOption={handleSelectOption}
          onShowPinDialog={() => setShowPinDialog(true)}
        />
      )}

      {/* Location Metadata */}
      {status.connected && loc && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Location Details</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Business Name</p>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1">{loc.businessName || loc.locationName || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Category</p>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-1">
                <Tag className="w-3 h-3 text-gray-400" />
                {loc.category || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Address</p>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-gray-400" />
                {loc.address || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</p>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-1">
                <Phone className="w-3 h-3 text-gray-400" />
                {loc.phone || '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Website</p>
              <p className="text-sm text-gray-900 dark:text-gray-100 mt-1 flex items-center gap-1">
                <Globe className="w-3 h-3 text-gray-400" />
                {loc.websiteUrl ? (
                  <a href={loc.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {loc.websiteUrl}
                  </a>
                ) : '—'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Aggregate Rating */}
      {status.connected && loc && (loc.cachedAverageRating !== null || loc.cachedReviewCount !== null) && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Reviews Summary</h2>
          <div className="flex items-center gap-6">
            {loc.cachedAverageRating !== null && (
              <div className="flex items-center gap-2">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-5 h-5 ${
                        star <= Math.round(loc.cachedAverageRating!)
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-300 dark:text-gray-600'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {loc.cachedAverageRating!.toFixed(1)}
                </span>
              </div>
            )}
            {loc.cachedReviewCount !== null && (
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{loc.cachedReviewCount}</p>
                <p className="text-xs text-gray-500">total reviews</p>
              </div>
            )}
            {loc.ratingCacheUpdated && (
              <p className="text-xs text-gray-400 ml-auto">
                Updated {new Date(loc.ratingCacheUpdated).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* PIN Dialog */}
      {showPinDialog && (
        <PinDialog
          onClose={() => setShowPinDialog(false)}
          onSubmit={handleCompleteVerification}
        />
      )}
    </div>
  );
}
