"use client";

import { useState } from 'react';
import { Modal, ModalFooter, Button, Input } from '@/components/ui';
import TenantCategorySelector from './TenantCategorySelector';

interface CategorySuggestion {
  suggestedName: string;
  googleCategoryId?: string;
  categoryPath: string[];
  existingTenantCategory?: {
    id: string;
    name: string;
    googleCategoryId?: string | null;
  };
}

interface CategorySuggestionModalProps {
  isOpen: boolean;
  itemName: string;
  itemId: string;
  suggestion: CategorySuggestion;
  tenantId: string;
  onCreateAndAssign: (categoryName: string, googleCategoryId?: string) => Promise<void>;
  onAssignToExisting: (categoryId: string) => Promise<void>;
  onSkip: () => void;
  onClose: () => void;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function CategorySuggestionModal({
  isOpen,
  itemName,
  itemId,
  suggestion,
  tenantId,
  onCreateAndAssign,
  onAssignToExisting,
  onSkip,
  onClose,
}: CategorySuggestionModalProps) {
  const [mode, setMode] = useState<'create' | 'existing'>('create');
  const [categoryName, setCategoryName] = useState(suggestion.suggestedName);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const handleCreateAndAssign = async () => {
    if (!categoryName.trim()) return;
    
    setLoading(true);
    try {
      await onCreateAndAssign(categoryName, suggestion.googleCategoryId);
      onClose();
    } catch (error) {
      console.error('Failed to create category:', error);
      alert(error instanceof Error ? error.message : 'Failed to create category');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignToExisting = async () => {
    if (!selectedCategoryId) return;
    
    setLoading(true);
    try {
      await onAssignToExisting(selectedCategoryId);
      onClose();
    } catch (error) {
      console.error('Failed to assign category:', error);
      alert(error instanceof Error ? error.message : 'Failed to assign category');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Category Suggestion from Product Scan">
      <div className="space-y-4">
        {/* Product Info */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-white">
                Product: {itemName}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                Suggested Category: <span className="font-semibold">{suggestion.suggestedName}</span>
              </p>
              {suggestion.googleCategoryId && (
                <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                  Google Category ID: {suggestion.googleCategoryId}
                </p>
              )}
              {suggestion.categoryPath.length > 1 && (
                <p className="text-xs text-neutral-500 dark:text-neutral-500 mt-1">
                  Path: {suggestion.categoryPath.join(' > ')}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Info Message */}
        <div className="text-sm text-neutral-600 dark:text-neutral-400">
          This category doesn't exist in your catalog yet. You can:
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-2 border-b border-neutral-200 dark:border-neutral-700">
          <button
            onClick={() => setMode('create')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'create'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Create New Category
          </button>
          <button
            onClick={() => setMode('existing')}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              mode === 'existing'
                ? 'text-primary-600 dark:text-primary-400 border-b-2 border-primary-600 dark:border-primary-400'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white'
            }`}
          >
            Assign to Existing
          </button>
        </div>

        {/* Create Mode */}
        {mode === 'create' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Category Name
              </label>
              <Input
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                placeholder="Enter category name"
                className="w-full"
              />
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                You can edit the suggested name to match your naming convention
              </p>
            </div>
            {suggestion.googleCategoryId && (
              <div className="p-2 bg-neutral-50 dark:bg-neutral-800 rounded text-xs text-neutral-600 dark:text-neutral-400">
                <strong>Google Category ID:</strong> {suggestion.googleCategoryId}
                <br />
                This will be saved with the category for Google Shopping sync
              </div>
            )}
          </div>
        )}

        {/* Existing Mode */}
        {mode === 'existing' && (
          <div className="space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">
              Select an existing category to assign this product to:
            </p>
            <TenantCategorySelector
              selectedCategoryId={selectedCategoryId}
              onSelect={setSelectedCategoryId}
            />
            {selectedCategoryId && suggestion.googleCategoryId && (
              <div className="p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded text-xs text-amber-800 dark:text-amber-200">
                <strong>Note:</strong> If the selected category doesn't have a Google ID, it will be updated with ID: {suggestion.googleCategoryId}
              </div>
            )}
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={onSkip} disabled={loading}>
          Skip for Now
        </Button>
        {mode === 'create' ? (
          <Button
            variant="primary"
            onClick={handleCreateAndAssign}
            disabled={!categoryName.trim() || loading}
          >
            {loading ? 'Creating...' : 'Create & Assign'}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={handleAssignToExisting}
            disabled={!selectedCategoryId || loading}
          >
            {loading ? 'Assigning...' : 'Assign to Selected'}
          </Button>
        )}
      </ModalFooter>
    </Modal>
  );
}
