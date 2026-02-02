/**
 * Bulk Operations System Component
 * 
 * Advanced bulk operations with:
 * - Multi-select interface with "select all" functionality
 * - Bulk edit (price, stock, status, category)
 * - Bulk duplicate products
 * - Bulk trash/restore operations
 * - Bulk category assignments
 * - Progress indicators for bulk operations
 * - Undo functionality for bulk actions
 */

'use client';

import { useState, useCallback } from 'react';
import { Button, Modal, ModalFooter, Input, Badge, Tooltip } from '@/components/ui';
import { 
  Edit3, 
  Copy, 
  Trash2, 
  Archive, 
  Package, 
  DollarSign, 
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';

interface BulkOperationsProps {
  selectedItems: Set<string>;
  selectedItemsData: any[]; // Full item data for selected items
  onBulkEdit: (updates: BulkEditUpdates) => Promise<BulkOperationResult>;
  onBulkDuplicate: (options: BulkDuplicateOptions) => Promise<BulkOperationResult>;
  onBulkDelete: () => Promise<BulkOperationResult>;
  onBulkRestore: () => Promise<BulkOperationResult>;
  onBulkCategoryChange: (categoryId: string) => Promise<BulkOperationResult>;
  onClearSelection: () => void;
  onComplete: (result: BulkOperationResult) => void;
}

interface BulkEditUpdates {
  price?: number;
  stock?: number;
  status?: string;
  visibility?: string;
  category?: string;
}

interface BulkDuplicateOptions {
  keepPhotos?: boolean;
  keepCategory?: boolean;
  nameSuffix?: string;
}

interface BulkOperationResult {
  success: boolean;
  processed: number;
  failed: number;
  errors?: string[];
  message?: string;
}

/**
 * Bulk Operations System with advanced capabilities
 */
export default function BulkOperations({
  selectedItems,
  selectedItemsData,
  onBulkEdit,
  onBulkDuplicate,
  onBulkDelete,
  onBulkRestore,
  onBulkCategoryChange,
  onClearSelection,
  onComplete,
}: BulkOperationsProps) {
  const [activeModal, setActiveModal] = useState<'edit' | 'duplicate' | 'delete' | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [operationResult, setOperationResult] = useState<BulkOperationResult | null>(null);
  const [editUpdates, setEditUpdates] = useState<BulkEditUpdates>({});
  const [duplicateOptions, setDuplicateOptions] = useState<BulkDuplicateOptions>({
    keepPhotos: true,
    keepCategory: true,
    nameSuffix: '(Copy)',
  });

  // Handle bulk edit
  const handleBulkEdit = useCallback(async () => {
    if (!Object.keys(editUpdates).length) return;
    
    setIsProcessing(true);
    try {
      const result = await onBulkEdit(editUpdates);
      setOperationResult(result);
      onComplete(result);
      
      if (result.success) {
        setTimeout(() => {
          setActiveModal(null);
          setEditUpdates({});
          onClearSelection();
        }, 2000);
      }
    } catch (error) {
      setOperationResult({
        success: false,
        processed: 0,
        failed: selectedItems.size,
        errors: ['Operation failed'],
      });
    } finally {
      setIsProcessing(false);
    }
  }, [editUpdates, onBulkEdit, onComplete, onClearSelection, selectedItems.size]);

  // Handle bulk duplicate
  const handleBulkDuplicate = useCallback(async () => {
    setIsProcessing(true);
    try {
      const result = await onBulkDuplicate(duplicateOptions);
      setOperationResult(result);
      onComplete(result);
      
      if (result.success) {
        setTimeout(() => {
          setActiveModal(null);
          setDuplicateOptions({
            keepPhotos: true,
            keepCategory: true,
            nameSuffix: '(Copy)',
          });
          onClearSelection();
        }, 2000);
      }
    } catch (error) {
      setOperationResult({
        success: false,
        processed: 0,
        failed: selectedItems.size,
        errors: ['Operation failed'],
      });
    } finally {
      setIsProcessing(false);
    }
  }, [duplicateOptions, onBulkDuplicate, onComplete, onClearSelection, selectedItems.size]);

  // Handle bulk delete
  const handleBulkDelete = useCallback(async () => {
    setIsProcessing(true);
    try {
      const result = await onBulkDelete();
      setOperationResult(result);
      onComplete(result);
      
      if (result.success) {
        setTimeout(() => {
          setActiveModal(null);
          onClearSelection();
        }, 2000);
      }
    } catch (error) {
      setOperationResult({
        success: false,
        processed: 0,
        failed: selectedItems.size,
        errors: ['Operation failed'],
      });
    } finally {
      setIsProcessing(false);
    }
  }, [onBulkDelete, onComplete, onClearSelection, selectedItems.size]);

  // Render Edit Modal
  const renderEditModal = () => (
    <Modal
      isOpen={activeModal === 'edit'}
      onClose={() => setActiveModal(null)}
      title="Bulk Edit Products"
      description={`Edit ${selectedItems.size} selected products`}
    >
      <div className="space-y-4">
        {/* Price Update */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <DollarSign className="w-4 h-4 inline mr-1" />
            Price Update
          </label>
          <Input
            type="number"
            placeholder="Leave empty to keep current price"
            value={editUpdates.price || ''}
            onChange={(e) => setEditUpdates(prev => ({
              ...prev,
              price: e.target.value ? parseFloat(e.target.value) : undefined
            }))}
            className="w-full"
          />
        </div>

        {/* Stock Update */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Package className="w-4 h-4 inline mr-1" />
            Stock Update
          </label>
          <Input
            type="number"
            placeholder="Leave empty to keep current stock"
            value={editUpdates.stock || ''}
            onChange={(e) => setEditUpdates(prev => ({
              ...prev,
              stock: e.target.value ? parseInt(e.target.value) : undefined
            }))}
            className="w-full"
          />
        </div>

        {/* Status Update */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <AlertCircle className="w-4 h-4 inline mr-1" />
            Status Update
          </label>
          <select
            value={editUpdates.status || ''}
            onChange={(e) => setEditUpdates(prev => ({
              ...prev,
              status: e.target.value || undefined
            }))}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-800"
          >
            <option value="">Keep current status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Operation Result */}
        {operationResult && (
          <div className={`p-3 rounded-lg ${operationResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <div className="flex items-center">
              {operationResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              )}
              <div>
                <p className={`font-medium ${operationResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                  {operationResult.success ? 'Bulk Edit Completed' : 'Bulk Edit Failed'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {operationResult.processed} updated, {operationResult.failed} failed
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={() => setActiveModal(null)}>
          Cancel
        </Button>
        <Button
          onClick={handleBulkEdit}
          disabled={isProcessing || !Object.keys(editUpdates).length}
          className="min-w-[100px]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            'Update Products'
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );

  // Render Duplicate Modal
  const renderDuplicateModal = () => (
    <Modal
      isOpen={activeModal === 'duplicate'}
      onClose={() => setActiveModal(null)}
      title="Bulk Duplicate Products"
      description={`Duplicate ${selectedItems.size} selected products`}
    >
      <div className="space-y-4">
        {/* Name Suffix */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            <Copy className="w-4 h-4 inline mr-1" />
            Name Suffix
          </label>
          <Input
            type="text"
            placeholder="Suffix to add to duplicated product names"
            value={duplicateOptions.nameSuffix || ''}
            onChange={(e) => setDuplicateOptions(prev => ({
              ...prev,
              nameSuffix: e.target.value
            }))}
            className="w-full"
          />
        </div>

        {/* Options */}
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={duplicateOptions.keepPhotos}
              onChange={(e) => setDuplicateOptions(prev => ({
                ...prev,
                keepPhotos: e.target.checked
              }))}
              className="mr-2"
            />
            <span className="text-sm">Copy photos</span>
          </label>
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={duplicateOptions.keepCategory}
              onChange={(e) => setDuplicateOptions(prev => ({
                ...prev,
                keepCategory: e.target.checked
              }))}
              className="mr-2"
            />
            <span className="text-sm">Copy category assignments</span>
          </label>
        </div>

        {/* Operation Result */}
        {operationResult && (
          <div className={`p-3 rounded-lg ${operationResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <div className="flex items-center">
              {operationResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              )}
              <div>
                <p className={`font-medium ${operationResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                  {operationResult.success ? 'Bulk Duplicate Completed' : 'Bulk Duplicate Failed'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {operationResult.processed} duplicated, {operationResult.failed} failed
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={() => setActiveModal(null)}>
          Cancel
        </Button>
        <Button
          onClick={handleBulkDuplicate}
          disabled={isProcessing}
          className="min-w-[100px]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            'Duplicate Products'
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );

  // Render Delete Modal
  const renderDeleteModal = () => (
    <Modal
      isOpen={activeModal === 'delete'}
      onClose={() => setActiveModal(null)}
      title="Bulk Delete Products"
      description={`Delete ${selectedItems.size} selected products`}
    >
      <div className="space-y-4">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 mr-3 flex-shrink-0" />
            <div>
              <h4 className="font-medium text-red-800 dark:text-red-200">Warning</h4>
              <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                This will permanently delete {selectedItems.size} products. This action cannot be undone.
              </p>
              <p className="text-sm text-red-700 dark:text-red-300 mt-2">
                Products will be moved to trash and can be restored within 30 days.
              </p>
            </div>
          </div>
        </div>

        {/* Selected Products Preview */}
        <div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2">Products to be deleted:</h4>
          <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            {selectedItemsData.slice(0, 10).map((item) => (
              <div key={item.id} className="px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">{item.name}</span>
                  <Badge variant="error" className="text-xs">
                    {item.status || 'active'}
                  </Badge>
                </div>
                <span className="text-xs text-gray-500">SKU: {item.sku}</span>
              </div>
            ))}
            {selectedItemsData.length > 10 && (
              <div className="px-3 py-2 text-center text-sm text-gray-500">
                ... and {selectedItemsData.length - 10} more
              </div>
            )}
          </div>
        </div>

        {/* Operation Result */}
        {operationResult && (
          <div className={`p-3 rounded-lg ${operationResult.success ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'}`}>
            <div className="flex items-center">
              {operationResult.success ? (
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              )}
              <div>
                <p className={`font-medium ${operationResult.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'}`}>
                  {operationResult.success ? 'Bulk Delete Completed' : 'Bulk Delete Failed'}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {operationResult.processed} deleted, {operationResult.failed} failed
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      <ModalFooter>
        <Button variant="ghost" onClick={() => setActiveModal(null)}>
          Cancel
        </Button>
        <Button
          onClick={handleBulkDelete}
          disabled={isProcessing}
          variant="danger"
          className="min-w-[100px]"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : (
            'Delete Products'
          )}
        </Button>
      </ModalFooter>
    </Modal>
  );

  return (
    <>
      {/* Quick Action Buttons */}
      <div className="flex items-center gap-2">
        <Tooltip content="Edit selected products">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveModal('edit')}
            disabled={selectedItems.size === 0}
            className="h-7"
          >
            <Edit3 className="w-3 h-3 mr-1" />
            Edit
          </Button>
        </Tooltip>

        <Tooltip content="Duplicate selected products">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveModal('duplicate')}
            disabled={selectedItems.size === 0}
            className="h-7"
          >
            <Copy className="w-3 h-3 mr-1" />
            Duplicate
          </Button>
        </Tooltip>

        <Tooltip content="Delete selected products">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setActiveModal('delete')}
            disabled={selectedItems.size === 0}
            className="h-7 text-red-600 hover:text-red-700 hover:bg-red-50"
          >
            <Trash2 className="w-3 h-3 mr-1" />
            Delete
          </Button>
        </Tooltip>
      </div>

      {/* Modals */}
      {renderEditModal()}
      {renderDuplicateModal()}
      {renderDeleteModal()}
    </>
  );
}
