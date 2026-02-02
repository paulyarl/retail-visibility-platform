/**
 * Wizard Navigation Component
 * 
 * Provides navigation controls for the product creation wizard:
 * - Previous/Next buttons
 * - Save functionality
 * - Submit/Publish button
 * - Keyboard shortcuts
 * - Loading states
 * 
 * Following shop management dashboard patterns
 */

'use client';

import { useState, useEffect } from 'react';
import { 
  ChevronLeft, 
  ChevronRight, 
  Save, 
  Eye,
  Loader2,
  Keyboard,
  ShoppingCart
} from 'lucide-react';

import { Button } from '@mantine/core';
import { Card, CardContent } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  isFirstStep: boolean;
  isLastStep: boolean;
  canGoNext: boolean;
  canGoPrevious: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onSubmit: () => void;
  onSave: () => void;
  isSubmitting?: boolean;
  onAddToQueue?: () => void;
  showShortcuts?: boolean;
  setShowShortcuts?: (show: boolean) => void;
  hasSku?: boolean;
}

export default function WizardNavigation({
  currentStep,
  totalSteps,
  onPrevious,
  onNext,
  onSave,
  onSubmit,
  isSubmitting,
  canGoNext,
  canGoPrevious,
  onAddToQueue,
  hasSku = false
}: WizardNavigationProps) {
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case 'ArrowLeft':
          if (canGoPrevious && !isSubmitting) {
            e.preventDefault();
            onPrevious();
          }
          break;
        case 'ArrowRight':
          if (canGoNext && !isSubmitting) {
            e.preventDefault();
            onNext();
          }
          break;
        case 's':
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            handleSave();
          }
          break;
        case '?':
          if (!showShortcuts) {
            e.preventDefault();
            setShowShortcuts(true);
          }
          break;
        case 'Escape':
          if (showShortcuts) {
            e.preventDefault();
            setShowShortcuts(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canGoPrevious, canGoNext, isSubmitting, showShortcuts]);

  const handleSave = async () => {
    await onSave();
    setLastSaveTime(new Date());
  };

  const getSaveText = () => {
    if (lastSaveTime) {
      const seconds = Math.floor((new Date().getTime() - lastSaveTime.getTime()) / 1000);
      if (seconds < 60) {
        return `Saved ${seconds}s ago`;
      } else {
        const minutes = Math.floor(seconds / 60);
        return `Saved ${minutes}m ago`;
      }
    }
    return 'Save';
  };

  const isLastStep = currentStep === totalSteps - 1;
  const isFirstStep = currentStep === 0;

  return (
    <div className="space-y-4">
      {/* Navigation Card */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Step Info */}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-gray-900">
                  Step {currentStep + 1} of {totalSteps}
                </div>
                <div className="text-xs text-gray-500">
                  {isFirstStep ? 'Getting started' : 
                   isLastStep ? 'Final review' : 
                   'In progress'}
                </div>
              </div>
              <Badge variant={isLastStep ? "default" : "info"}>
                {isLastStep ? 'Ready to publish' : 'In progress'}
              </Badge>
            </div>

            <Separator />

            {/* Navigation Buttons */}
            <div className="space-y-3">
              {/* Previous/Next Row */}
              <div className="flex flex-row gap-2">
                {/* Previous Button */}
                <Button
                  variant="outline"
                  onClick={onPrevious}
                  disabled={!canGoPrevious || isSubmitting}
                  className="flex items-center gap-2"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>

                {/* Next/Submit Button */}
                <Button
                  onClick={isLastStep ? onSubmit : onNext}
                  disabled={!canGoNext || isSubmitting}
                  className="flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : isLastStep ? (
                    <>
                      <Eye className="h-4 w-4" />
                      Publish Product
                    </>
                  ) : (
                    <>
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {/* Save and Queue Row */}
              <div className="flex flex-row gap-2">
                {/* Save Button */}
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={isSubmitting}
                  className="flex items-center gap-2 flex-1"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {getSaveText()}
                </Button>

                {/* Add to Queue Button */}
                {onAddToQueue && (
                  <Button
                    variant="outline"
                    onClick={onAddToQueue}
                    disabled={isSubmitting || !hasSku}
                    className="flex items-center gap-2"
                    title={!hasSku ? 'SKU required to add to queue' : 'Add draft to processing queue'}
                  >
                    <ShoppingCart className="h-4 w-4" />
                    Add to Queue
                  </Button>
                )}
              </div>
            </div>

            {/* Keyboard Shortcuts Help */}
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowShortcuts(!showShortcuts)}
                className="text-xs text-gray-500"
              >
                <Keyboard className="h-3 w-3 mr-1" />
                Keyboard shortcuts
              </Button>
              <div className="text-xs text-gray-400">
                Press ? for help
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard Shortcuts Modal */}
      {showShortcuts && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4">
            <div className="space-y-3">
              <div className="font-medium text-blue-900">Keyboard Shortcuts</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Previous step:</span>
                  <kbd className="px-2 py-1 bg-white rounded border border-gray-300 text-xs">←</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Next step:</span>
                  <kbd className="px-2 py-1 bg-white rounded border border-gray-300 text-xs">→</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Save:</span>
                  <kbd className="px-2 py-1 bg-white rounded border border-gray-300 text-xs">Ctrl+S</kbd>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Help:</span>
                  <kbd className="px-2 py-1 bg-white rounded border border-gray-300 text-xs">?</kbd>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowShortcuts(false)}
                >
                  Close
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Progress Summary */}
      <Card className="border-gray-200">
        <CardContent className="p-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Overall Progress</span>
              <span className="font-medium">
                {Math.round(((currentStep + 1) / totalSteps) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
            <div className="text-xs text-gray-500">
              {isLastStep ? 'Ready to publish your product!' : 
               currentStep === 0 ? 'Let\'s get started with the basics' : 
               `Keep going, you're ${Math.round(((currentStep + 1) / totalSteps) * 100)}% complete!`}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
