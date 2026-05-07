"use client";

import { useState, useRef, useEffect } from 'react';
import { StockUpdateService } from '@/services/stockUpdateService';
import { Check, X, Edit2, Package, AlertTriangle } from 'lucide-react';

interface QuickStockEditorProps {
  itemId: string;
  itemName: string;
  currentStock: number;
  tenantId?: string;
  className?: string;
  showStatus?: boolean;
  compact?: boolean;
  onUpdate?: (itemId: string, newStock: number) => Promise<void> | void;
  onError?: (error: Error) => void;
}

/**
 * Reusable quick stock editor component
 * Can be used across the platform for instant stock updates
 * Features:
 * - Click to edit inline
 * - Enter to save, Escape to cancel
 * - Visual stock status indicators
 * - Loading states and error handling
 * - Compact and full display modes
 */
export default function QuickStockEditor({
  itemId,
  itemName,
  currentStock,
  tenantId,
  className = '',
  showStatus = true,
  compact = false,
  onUpdate,
  onError,
}: QuickStockEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [stockValue, setStockValue] = useState(currentStock.toString());
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const stockStatus = StockUpdateService.getInstance().getStockStatus(currentStock);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    // Update display value when currentStock changes externally
    if (!isEditing) {
      setStockValue(currentStock.toString());
    }
  }, [currentStock, isEditing]);

  const handleSave = async () => {
    const newStock = parseInt(stockValue);
    
    if (isNaN(newStock) || newStock < 0) {
      alert('Please enter a valid stock number (0 or greater)');
      setStockValue(currentStock.toString());
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      console.log(`[QuickStockEditor] Updating stock from ${currentStock} to ${newStock}`);
      
      if (onUpdate) {
        await onUpdate(itemId, newStock);
      }
      
      setIsEditing(false);
      // Small delay to ensure the parent component refreshes
      setTimeout(() => {
        console.log(`[QuickStockEditor] Update complete, editor closed`);
      }, 100);
    } catch (error) {
      console.error('[QuickStockEditor] Failed to update stock:', error);
      alert(`Failed to update stock: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setStockValue(currentStock.toString());
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setStockValue(currentStock.toString());
      setIsEditing(false);
    }
  };

  const handleBlur = (e: React.FocusEvent) => {
    // Check if the blur is because we're clicking on a button inside the editor
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.closest('.quick-stock-editor-buttons')) {
      return; // Don't close if clicking on our buttons
    }
    
    // Small delay to allow click on save button
    setTimeout(() => {
      if (!isSaving) {
        setStockValue(currentStock.toString());
        setIsEditing(false);
      }
    }, 150);
  };

  if (isEditing) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={stockValue}
          onChange={(e) => setStockValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isSaving}
          className={`w-16 px-2 py-1 text-sm font-medium border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 ${compact ? 'w-14 text-xs' : ''}`}
        />
        <div className="quick-stock-editor-buttons flex items-center gap-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
            title="Save"
          >
            {isSaving ? (
              <div className="w-4 h-4 animate-spin border-2 border-green-600 border-t-transparent rounded-full" />
            ) : (
              <Check className="w-4 h-4" />
            )}
          </button>
          <button
            onClick={() => {
              setStockValue(currentStock.toString());
              setIsEditing(false);
            }}
            disabled={isSaving}
            className="p-1 text-red-600 hover:text-red-700 hover:bg-red-50 rounded transition-colors"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  const StatusIcon = () => {
    if (stockStatus.status === 'out_of_stock') {
      return <X className="w-3 h-3" />;
    } else if (stockStatus.status === 'low_stock') {
      return <AlertTriangle className="w-3 h-3" />;
    } else {
      return <Package className="w-3 h-3" />;
    }
  };

  return (
    <div className={`flex items-center justify-between ${className}`}>
      {showStatus && (
        <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${
          stockStatus.status === 'out_of_stock' 
            ? 'bg-red-100 text-red-700' 
            : stockStatus.status === 'low_stock'
            ? 'bg-amber-100 text-amber-700'
            : 'bg-green-100 text-green-700'
        }`}>
          <StatusIcon />
          {!compact && <span>{stockStatus.message}</span>}
        </div>
      )}
      
      <button
        onClick={() => setIsEditing(true)}
        className={`group flex items-center gap-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 px-2 py-1 rounded transition-colors ${
          compact ? 'text-xs' : 'text-sm'
        }`}
        title={`Click to edit stock for ${itemName}`}
      >
        <span className="text-neutral-500 group-hover:text-blue-600">Stock:</span>
        <span className={`font-medium ${
          stockStatus.status === 'out_of_stock' 
            ? 'text-red-600' 
            : stockStatus.status === 'low_stock'
            ? 'text-amber-600'
            : 'text-neutral-600 dark:text-neutral-400'
        } group-hover:text-blue-700`}>
          {currentStock}
        </span>
        <Edit2 className="w-3 h-3 text-neutral-400 group-hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </button>
    </div>
  );
}
