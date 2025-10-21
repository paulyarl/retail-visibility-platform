"use client";

import { motion } from 'framer-motion';
import { Badge } from '@/components/ui';

export interface Step {
  id: string;
  title: string;
  description: string;
}

interface ProgressStepsProps {
  steps: Step[];
  currentStep: number;
}

export default function ProgressSteps({ steps, currentStep }: ProgressStepsProps) {
  return (
    <div className="w-full">
      {/* Desktop: Horizontal */}
      <div className="hidden md:flex items-center justify-center gap-2">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;
          const isPending = index > currentStep;

          return (
            <div key={step.id} className="flex items-center">
              {/* Step Badge */}
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col items-center"
              >
                <div className="relative">
                  {isCompleted ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 500 }}
                      className="w-10 h-10 rounded-full bg-success flex items-center justify-center"
                    >
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </motion.div>
                  ) : isCurrent ? (
                    <div className="w-10 h-10 rounded-full bg-primary-600 flex items-center justify-center ring-4 ring-primary-100">
                      <span className="text-white font-semibold">{index + 1}</span>
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-neutral-200 flex items-center justify-center">
                      <span className="text-neutral-500 font-semibold">{index + 1}</span>
                    </div>
                  )}
                </div>
                <div className="mt-2 text-center">
                  <p className={`text-sm font-medium ${
                    isCurrent ? 'text-primary-600' : 
                    isCompleted ? 'text-success' : 
                    'text-neutral-500'
                  }`}>
                    {step.title}
                  </p>
                  <p className="text-xs text-neutral-500 mt-0.5 max-w-[100px]">
                    {step.description}
                  </p>
                </div>
              </motion.div>

              {/* Connector Line */}
              {index < steps.length - 1 && (
                <div className="w-16 h-0.5 mx-2 mb-12">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: isCompleted ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="h-full bg-success origin-left"
                  />
                  {!isCompleted && (
                    <div className="h-full bg-neutral-200" />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: Vertical */}
      <div className="md:hidden space-y-4">
        {steps.map((step, index) => {
          const isCompleted = index < currentStep;
          const isCurrent = index === currentStep;

          return (
            <div key={step.id} className="flex items-start gap-3">
              {/* Step Indicator */}
              <div className="flex flex-col items-center">
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-8 h-8 rounded-full bg-success flex items-center justify-center flex-shrink-0"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </motion.div>
                ) : isCurrent ? (
                  <div className="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center ring-4 ring-primary-100 flex-shrink-0">
                    <span className="text-white text-sm font-semibold">{index + 1}</span>
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-full bg-neutral-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-neutral-500 text-sm font-semibold">{index + 1}</span>
                  </div>
                )}
                
                {/* Vertical Line */}
                {index < steps.length - 1 && (
                  <div className="w-0.5 h-12 mt-2">
                    {isCompleted ? (
                      <div className="h-full bg-success" />
                    ) : (
                      <div className="h-full bg-neutral-200" />
                    )}
                  </div>
                )}
              </div>

              {/* Step Info */}
              <div className="flex-1 pt-1">
                <p className={`text-sm font-medium ${
                  isCurrent ? 'text-primary-600' : 
                  isCompleted ? 'text-success' : 
                  'text-neutral-500'
                }`}>
                  {step.title}
                </p>
                <p className="text-xs text-neutral-500 mt-0.5">
                  {step.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
