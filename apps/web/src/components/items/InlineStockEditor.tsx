"use client";

import { useState, useRef, useEffect } from 'react';

interface InlineStockEditorProps {
  itemId: string;
  itemName: string;
  currentStock: number;
  onUpdate: (itemId: string, newStock: number) => Promise<void>;
  className?: string;
}


// Force edge runtime to prevent prerendering issues
export const runtime = 'edge';

// Force dynamic rendering to prevent prerendering issues
export const dynamic = 'force-dynamic';

export default function InlineStockEditor({
  itemId,
  itemName,
  currentStock,
  onUpdate,
  className = '',
}: InlineStockEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [stockValue, setStockValue] = useState(currentStock.toString());
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSave = async () => {
    console.log('[InlineStockEditor.handleSave] START - stockValue:', stockValue, 'currentStock:', currentStock);
    const newStock = parseInt(stockValue);
    console.log('[InlineStockEditor.handleSave] Parsed newStock:', newStock);
    
    if (isNaN(newStock) || newStock < 0) {
      console.log('[InlineStockEditor.handleSave] Invalid stock number');
      alert('Please enter a valid stock number (0 or greater)');
      setStockValue(currentStock.toString());
      setIsEditing(false);
      return;
    }

    if (newStock === currentStock) {
      console.log('[InlineStockEditor.handleSave] No change, closing editor');
      setIsEditing(false);
      return;
    }

    console.log('[InlineStockEditor.handleSave] Calling onUpdate with:', { itemId, newStock });
    console.log('[InlineStockEditor.handleSave] onUpdate type:', typeof onUpdate);
    setIsSaving(true);
    try {
      console.log(`[InlineStockEditor] Updating stock from ${currentStock} to ${newStock}`);
      await onUpdate(itemId, newStock);
      console.log(`[InlineStockEditor] Stock update successful`);
      setIsEditing(false);
      // Small delay to ensure the parent component refreshes
      setTimeout(() => {
        console.log(`[InlineStockEditor] Update complete, editor closed`);
      }, 100);
    } catch (error) {
      console.error('[InlineStockEditor] Failed to update stock:', error);
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
    console.log('[InlineStockEditor] Input blur event');
    // Check if the blur is because we're clicking on a button inside the editor
    const relatedTarget = e.relatedTarget as HTMLElement;
    if (relatedTarget && relatedTarget.closest('.inline-stock-editor-buttons')) {
      console.log('[InlineStockEditor] Blur ignored - clicking on editor button');
      return; // Don't close if clicking on our buttons
    }
    
    // Small delay to allow click on save button
    setTimeout(() => {
      if (!isSaving) {
        console.log('[InlineStockEditor] Closing editor due to blur');
        setStockValue(currentStock.toString());
        setIsEditing(false);
      }
    }, 150);
  };

  if (isEditing) {
    return (
      <div className={`flex items-center gap-1 ${className}`}>
        <span className="text-sm text-neutral-500">Stock:</span>
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={stockValue}
          onChange={(e) => setStockValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          disabled={isSaving}
          className="w-16 px-2 py-1 text-sm font-medium border-2 border-primary-500 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <div className="inline-stock-editor-buttons flex items-center gap-1">
        <button
          onClick={(e) => {
            console.log('[InlineStockEditor] Save button clicked!', e);
            handleSave();
          }}
          disabled={isSaving}
          className="p-1 text-green-600 hover:text-green-700 hover:bg-green-50 rounded transition-colors"
          title="Save"
        >
          {isSaving ? (
            <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
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
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        console.log('[InlineStockEditor] Opening editor for item:', itemId, 'current stock:', currentStock);
        setIsEditing(true);
      }}
      className={`flex items-center gap-1 group hover:bg-primary-50 dark:hover:bg-primary-900/20 px-2 py-1 rounded transition-colors ${className}`}
      title={`Click to edit stock for ${itemName}`}
    >
      <span className="text-sm text-neutral-500 group-hover:text-primary-600">Stock:</span>
      <span className={`text-sm font-medium ${currentStock < 10 ? 'text-warning' : 'text-neutral-600 dark:text-neutral-400'} group-hover:text-primary-700`}>
        {currentStock}
      </span>
      <svg className="w-3 h-3 text-neutral-400 group-hover:text-primary-600 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
      </svg>
    </button>
  );
}
