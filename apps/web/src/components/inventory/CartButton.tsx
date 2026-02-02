'use client';

import { useState, useEffect } from 'react';
import { ShoppingCart, Plus } from 'lucide-react';
import { Button } from '@mantine/core';
import { Badge } from '@/components/ui/Badge';
import ProductQueue from './ProductQueue';

interface CartButtonProps {
  tenantId: string;
  onOpenCart?: () => void;
  onAddToQueue?: (productData: any) => void;
}

export default function CartButton({ tenantId, onOpenCart, onAddToQueue }: CartButtonProps) {
  const [queueCount, setQueueCount] = useState(0);
  const [showQueue, setShowQueue] = useState(false);

  // Listen for queue changes
  useEffect(() => {
    // Check queue count from both localStorage and item-creation-draft
    const checkQueueCount = () => {
      // Get queued items count
      const queueCount = localStorage.getItem(`queue-${tenantId}`);
      const queuedItems = queueCount ? parseInt(queueCount) : 0;
      
      // Check if there's a draft item that hasn't been queued yet
      const draftData = localStorage.getItem('item-creation-draft');
      const hasDraft = draftData ? 1 : 0;
      
      // Total count is queued items + draft
      const totalCount = queuedItems + hasDraft;
      setQueueCount(totalCount);
    };

    // Check immediately
    checkQueueCount();
    
    // Set up interval to check for changes
    const interval = setInterval(checkQueueCount, 2000);
    
    return () => clearInterval(interval);
  }, [tenantId]);

  const handleAddToQueue = async (productData?: any) => {
    if (!tenantId) return;
    
    // If no productData provided, try to get it from item-creation-draft
    let actualProductData = productData;
    if (!actualProductData) {
      try {
        const draftData = localStorage.getItem('item-creation-draft');
        if (draftData) {
          const draft = JSON.parse(draftData);
          actualProductData = draft.wizardData;
          console.log('Using product data from item-creation-draft');
        }
      } catch (error) {
        console.error('Error reading item-creation-draft:', error);
      }
    }
    
    if (!actualProductData) {
      console.error('No product data available');
      return;
    }
    
    try {
      // Call the API to add item to queue
      const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000';
      const response = await fetch(`${API_BASE_URL}/api/queue/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productData: actualProductData,
          priority: 'normal',
          sessionId: `session-${Date.now()}`,
          userAgent: navigator.userAgent,
          source: 'wizard'
        })
      });

      if (response.ok) {
        // Clear the draft after successful queue addition
        localStorage.removeItem('item-creation-draft');
        
        // Increment local counter for immediate UI feedback
        const currentCount = localStorage.getItem(`queue-${tenantId}`) || '0';
        localStorage.setItem(`queue-${tenantId}`, (parseInt(currentCount) + 1).toString());
        setQueueCount(prev => prev + 1);
        
        if (onAddToQueue) {
          onAddToQueue(actualProductData);
        }
      } else {
        console.error('Failed to add item to queue');
        // Store in localStorage as fallback
        storeItemInLocalStorage(actualProductData);
      }
    } catch (error) {
      console.error('Error adding to queue:', error);
      // Store in localStorage as fallback
      storeItemInLocalStorage(actualProductData);
    }
  };

  // Store item in localStorage for later sync
  const storeItemInLocalStorage = (productData: any) => {
    try {
      const stored = localStorage.getItem(`queue-${tenantId}`);
      const items = stored ? JSON.parse(stored) : [];
      
      items.push({
        id: `local-${Date.now()}`,
        productData,
        priority: 'normal',
        sessionId: `session-${Date.now()}`,
        userAgent: navigator.userAgent,
        source: 'wizard',
        createdAt: new Date().toISOString(),
        addedAt: new Date().toISOString(),
        estimatedTime: 0,
        specialTreatment: [],
        status: 'pending'
      });
      
      localStorage.setItem(`queue-${tenantId}`, JSON.stringify(items));
      
      // Update counter
      const currentCount = localStorage.getItem(`queue-${tenantId}`) || '0';
      localStorage.setItem(`queue-${tenantId}`, (parseInt(currentCount) + 1).toString());
      setQueueCount(prev => prev + 1);
      
      if (onAddToQueue) {
        onAddToQueue(productData);
      }
    } catch (error) {
      console.error('Error storing item in localStorage:', error);
    }
  };

  const handleOpenCart = () => {
    if (onOpenCart) {
      onOpenCart();
    } else {
      // Default behavior - toggle queue visibility
      setShowQueue(!showQueue);
    }
  };

  const getCartColor = () => {
    if (queueCount === 0) return 'text-gray-600';
    if (queueCount <= 3) return 'text-blue-600';
    if (queueCount <= 5) return 'text-orange-600';
    return 'text-red-600';
  };

  const getCartBgColor = () => {
    if (queueCount === 0) return 'bg-gray-100 hover:bg-gray-200';
    if (queueCount <= 3) return 'bg-blue-100 hover:bg-blue-200';
    if (queueCount <= 5) return 'bg-orange-100 hover:bg-orange-200';
    return 'bg-red-100 hover:bg-red-200';
  };

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Cart Button */}
      <Button
        onClick={handleOpenCart}
        className={`flex items-center gap-2 px-4 py-2 rounded-lg shadow-lg transition-all duration-200 ${getCartBgColor()} ${getCartColor()}`}
        size="sm"
      >
        <ShoppingCart className="h-4 w-4" />
        <span className="font-medium">Queue</span>
        
        {/* Count Badge */}
        {queueCount > 0 && (
          <Badge 
            variant="default" 
            className="absolute -top-2 -right-2 bg-red-500 text-white text-xs min-w-[20px] h-5 flex items-center justify-center"
          >
            {queueCount > 99 ? '99+' : queueCount}
          </Badge>
        )}
      </Button>

      {/* Queue Dropdown */}
      {showQueue && (
        <div className="absolute top-full right-0 mt-2 w-96 bg-white border border-gray-200 rounded-lg shadow-xl p-4 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">Product Queue</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowQueue(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              ×
            </Button>
          </div>
          
          {/* Quick Queue Preview */}
          <ProductQueue 
            tenantId={tenantId}
            preview={true}
            onItemRemove={(itemId: string) => {
              console.log('Item removed from queue:', itemId);
              // Update local counter
              const currentCount = localStorage.getItem(`queue-${tenantId}`) || '0';
              const newCount = Math.max(0, parseInt(currentCount) - 1);
              localStorage.setItem(`queue-${tenantId}`, newCount.toString());
              setQueueCount(newCount);
            }}
          />
        </div>
      )}
    </div>
  );
}
