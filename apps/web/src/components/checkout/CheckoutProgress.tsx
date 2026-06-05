'use client';

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type CheckoutStep = 'review' | 'fulfillment' | 'shipping' | 'payment';

interface CheckoutProgressProps {
  currentStep: CheckoutStep;
}

const steps = [
  { id: 'review', name: 'Review', description: 'Cart & Info' },
  { id: 'fulfillment', name: 'Fulfillment', description: 'Delivery Method' },
  { id: 'shipping', name: 'Address', description: 'Details' },
  { id: 'payment', name: 'Payment', description: 'Complete' },
] as const;

export function CheckoutProgress({ currentStep }: CheckoutProgressProps) {
  const currentStepIndex = steps.findIndex((step) => step.id === currentStep);

  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {steps.map((step, index) => {
          const isCompleted = index < currentStepIndex;
          const isCurrent = index === currentStepIndex;
          const isUpcoming = index > currentStepIndex;

          return (
            <div key={step.id} className="flex items-center flex-1">
              {/* Step Circle */}
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    'flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors',
                    {
                      'bg-primary border-primary text-primary-foreground': isCompleted || isCurrent,
                      'bg-background border-gray-300 text-gray-400': isUpcoming,
                    }
                  )}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    <span className="text-sm font-semibold">{index + 1}</span>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p
                    className={cn('text-sm font-medium', {
                      'text-primary': isCurrent || isCompleted,
                      'text-gray-500': isUpcoming,
                    })}
                  >
                    {step.name}
                  </p>
                  <p className="text-xs text-gray-500">{step.description}</p>
                </div>
              </div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'flex-1 h-0.5 mx-4 transition-colors',
                    {
                      'bg-primary': isCompleted,
                      'bg-gray-300': !isCompleted,
                    }
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
