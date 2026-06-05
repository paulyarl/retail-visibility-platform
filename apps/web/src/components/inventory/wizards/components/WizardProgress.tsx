/**
 * Wizard Progress Component
 * 
 * Displays progress through the 7-step product creation wizard:
 * - Visual step indicators with validation status
 * - Progress bar showing overall completion
 * - Mobile-responsive design
 * - Accessibility compliant
 * 
 * Following shop management dashboard patterns
 */

'use client';

import { Check, Circle, AlertCircle } from 'lucide-react';
import { Progress } from '@/components/ui/Progress';
import { Badge } from '@/components/ui/Badge';

interface WizardProgressProps {
  steps: Array<{
    id: string;
    title: string;
    description: string;
  }>;
  currentStep: number;
  validation: Record<number, boolean>;
  onStepClick?: (stepIndex: number) => void;
  allowJumping?: boolean;
}

export default function WizardProgress({ steps, currentStep, validation, onStepClick, allowJumping = false }: WizardProgressProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  const handleStepClick = (stepIndex: number) => {
    if (allowJumping && onStepClick) {
      onStepClick(stepIndex);
    }
  };

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Progress</span>
          <span className="text-muted-foreground">{Math.round(progress)}%</span>
        </div>
        <Progress value={progress} className="w-full" />
      </div>

      {/* Step Indicators */}
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-wrap gap-4 justify-start">
          {steps.map((step, index) => (
            <div 
              key={step.id} 
              className={`flex items-center space-x-2 min-w-0 flex-shrink-0 ${
                allowJumping ? 'cursor-pointer hover:opacity-80' : ''
              }`}
              onClick={() => handleStepClick(index)}
            >
              {/* Step Circle */}
              <div
                className={`
                  w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0
                  ${currentStep === index ? 'bg-blue-500' : 
                   validation[index] ? 'bg-green-500' : 
                   index < currentStep ? 'bg-gray-300' : 'bg-gray-100'}
                  ${currentStep === index ? 'ring-2 ring-blue-500 ring-offset-2' : ''}
                  transition-all duration-200
                `}
              >
                {validation[index] ? (
                  <Check className="h-4 w-4 text-white" />
                ) : currentStep === index ? (
                  <span className="text-white text-xs font-medium">
                    {index + 1}
                  </span>
                ) : (
                  <span className="text-gray-500 text-xs font-medium">
                    {index + 1}
                  </span>
                )}
              </div>

              {/* Step Info */}
              <div className="hidden sm:block min-w-0">
                <div className="text-sm font-medium text-gray-900 truncate">
                  {step.title}
                </div>
                <div className="text-xs text-gray-500 truncate">
                  {step.description}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Step Summary */}
      <div className="sm:hidden">
        <div className="bg-gray-50 rounded-lg p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Current Step:</span>
            <Badge variant="default" className="text-xs">
              {steps[currentStep].title}
            </Badge>
          </div>
          <Progress value={progress} className="w-full" />
        </div>
      </div>
    </div>
  );
}
