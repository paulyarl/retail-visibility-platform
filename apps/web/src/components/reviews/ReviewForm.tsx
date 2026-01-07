'use client';

import React, { useState } from 'react';
import { Star } from 'lucide-react';

interface ReviewFormProps {
  tenantId: string;
  productId?: string; // Optional - for product reviews
  onClose: () => void;
  onSubmit: (review: {
    rating: number;
    title: string;
    content: string;
    userName: string;
    userEmail: string;
    sessionId?: string;
  }) => Promise<void>;
  isAnonymous?: boolean; // New prop to indicate anonymous mode
  initialValues?: { // New prop for editing existing reviews
    rating: number;
    reviewText: string;
  };
}

export default function ReviewForm({ tenantId, onClose, onSubmit, isAnonymous = false, initialValues }: ReviewFormProps) {
  console.log('[ReviewForm] Component mounted, isAnonymous:', isAnonymous, 'tenantId:', tenantId, 'initialValues:', initialValues);
  const [rating, setRating] = useState(initialValues?.rating || 0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState(initialValues?.reviewText || '');
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Generate session ID for anonymous users
  const generateSessionId = () => {
    return `anon_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (rating === 0) {
      setError('Please select a rating');
      return;
    }
    
    if (!title.trim() || !content.trim()) {
      setError('Please fill in all required fields');
      return;
    }
    
    if (isAnonymous && (!userName.trim() || !userEmail.trim())) {
      setError('Please provide your name and email');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const sessionId = isAnonymous ? generateSessionId() : undefined;
      
      await onSubmit({
        rating,
        title: title.trim(),
        content: content.trim(),
        userName: userName.trim(),
        userEmail: userEmail.trim(),
        sessionId
      });
      
      // Reset form
      setRating(0);
      setTitle('');
      setContent('');
      setUserName('');
      setUserEmail('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit review');
    } finally {
      setIsSubmitting(false);
    }
  };

  const StarRating = () => {
    return (
      <div className="flex items-center gap-1 mb-4">
        <span className="text-sm font-medium text-gray-700 mr-2">Rating:</span>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            onClick={() => setRating(star)}
            onMouseEnter={() => setHoveredStar(star)}
            onMouseLeave={() => setHoveredStar(0)}
            className="transition-colors"
          >
            <Star
              className={`w-6 h-6 ${
                star <= (hoveredStar || rating)
                  ? 'fill-yellow-400 text-yellow-400'
                  : 'text-gray-300'
              }`}
            />
          </button>
        ))}
        {rating > 0 && (
          <span className="ml-2 text-sm text-gray-600">
            {rating}.0{rating === 1 ? ' star' : ' stars'}
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Write a Review</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <StarRating />

            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Review Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Summarize your experience"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={100}
              />
            </div>

            <div>
              <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">
                Your Review <span className="text-red-500">*</span>
              </label>
              <textarea
                id="content"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Tell us about your experience with this store..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                maxLength={1000}
              />
              <p className="text-xs text-gray-500 mt-1">
                {content.length}/1000 characters
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="userName" className="block text-sm font-medium text-gray-700 mb-1">
                  Your Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="userName"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label htmlFor="userEmail" className="block text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  id="userEmail"
                  value={userEmail}
                  onChange={(e) => setUserEmail(e.target.value)}
                  placeholder="john@example.com"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            <div className="bg-gray-50 p-3 rounded-md">
              <p className="text-xs text-gray-600">
                <strong>Privacy Note:</strong> Your name will be displayed publicly with your review. 
                Your email is used for verification purposes only and will not be shared.
              </p>
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
