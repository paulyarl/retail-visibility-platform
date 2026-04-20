"use client";

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button, Card } from '@/components/ui';
import { Check, X, CreditCard, Gift } from 'lucide-react';

interface TrialSetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTrial: (selectedTier: string) => void;
  tenantId: string;
}

const trialTiers = [
 
  {
    key: 'trial_discovery',
    name: 'Trial: Discovery',
    description: 'Get Found on Google',
    features: ['100 SKUs', '1 Location', 'Full catalog', 'Customer reviews'],
    recommended: true
  },
  {
    key: 'trial_commitment',
    name: 'Trial: Commitment',
    description: 'Capture Intent & Drive Foot Traffic',
    features: ['500 SKUs', '1 Location', 'Full catalog', 'Customer reviews'],
    recommended: false
  },
  {
    key: 'trial_storefront',
    name: 'Trial: Storefront',
    description: 'Your Own Platform Presence',
    features: ['250 SKUs', '1 Location', 'Full catalog', 'Customer reviews'],
    recommended: false
  },
  {
    key: 'trial_professional',
    name: 'Trial: Professional',
    description: 'Ideal for growing businesses with multiple needs',
    features: ['750 SKUs', '2 Locations', 'Advanced analytics', 'Priority support'],
    recommended: false
  },
  {
    key: 'trial_chain_starter',
    name: 'Trial: Chain Starter',
    description: 'Perfect for small chains and franchises',
    features: ['2000 SKUs', '5 Locations', 'Multi-store management', 'Chain analytics'],
    recommended: false
  }
];

export default function TrialSetupModal({ isOpen, onClose, onStartTrial, tenantId }: TrialSetupModalProps) {
  const [selectedTier, setSelectedTier] = useState('trial_discovery');

  const handleStartTrial = () => {
    onStartTrial(selectedTier);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={onClose}
            />

            {/* Modal */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative w-full max-w-4xl bg-white dark:bg-neutral-900 rounded-xl shadow-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-neutral-200 dark:border-neutral-700">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                    <Gift className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-neutral-900 dark:text-neutral-100">
                      Start Your Free Trial
                    </h2>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Choose the perfect plan for your business. No credit card required to start.
                    </p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="p-2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Content */}
              <div className="p-6">
                {/* Trial Tiers */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  {trialTiers.map((tier) => (
                    <div
                      key={tier.key}
                      className={`p-4 cursor-pointer transition-all border rounded-lg ${
                        selectedTier === tier.key
                          ? 'ring-2 ring-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-500'
                          : 'hover:ring-1 hover:ring-neutral-300 dark:hover:ring-neutral-600 border-neutral-200 dark:border-neutral-700'
                      }`}
                      onClick={() => setSelectedTier(tier.key)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-neutral-900 dark:text-neutral-100">
                            {tier.name}
                          </h3>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                            {tier.description}
                          </p>
                        </div>
                        {tier.recommended && (
                          <span className="px-2 py-1 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-xs font-medium rounded-full">
                            Most Popular
                          </span>
                        )}
                      </div>
                      <ul className="space-y-2">
                        {tier.features.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-400">
                            <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Trial Details */}
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 mb-6">
                  <div className="flex items-start gap-3">
                    <div className="p-1 bg-blue-100 dark:bg-blue-900/30 rounded">
                      <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-1">
                        14-Day Free Trial
                      </h4>
                      <p className="text-sm text-blue-700 dark:text-blue-300">
                        Full access to all features. No credit card required to start. 
                        After 14 days, you can choose to continue with a paid plan or downgrade to our free tier.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <Button variant="secondary" onClick={onClose}>
                    Skip for Now
                  </Button>
                  <Button onClick={handleStartTrial} className="bg-amber-600 hover:bg-amber-700">
                    Start Free Trial
                  </Button>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
}
