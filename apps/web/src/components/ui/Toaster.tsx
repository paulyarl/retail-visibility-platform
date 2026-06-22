'use client';

import { useToast } from '@/hooks/use-toast';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'lucide-react';

const VARIANT_STYLES: Record<string, string> = {
  default: 'bg-white border-neutral-200 text-neutral-900',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  destructive: 'bg-red-50 border-red-200 text-red-900',
};

const VARIANT_ICON_COLORS: Record<string, string> = {
  default: 'text-neutral-500',
  success: 'text-emerald-500',
  warning: 'text-amber-500',
  info: 'text-blue-500',
  destructive: 'text-red-500',
};

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      <AnimatePresence mode="popLayout">
        {toasts.filter((t) => t.open !== false).map((t) => {
          const variant = t.variant || 'default';
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, transition: { duration: 0.2 } }}
              className={`flex items-start gap-3 p-4 rounded-lg border shadow-lg ${VARIANT_STYLES[variant]}`}
            >
              <div className="flex-1 min-w-0">
                {t.title && (
                  <p className="text-sm font-semibold">{t.title}</p>
                )}
                {t.description && (
                  <p className="text-xs mt-0.5 opacity-80">{t.description}</p>
                )}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                className={`flex-shrink-0 rounded p-0.5 hover:bg-black/5 transition-colors ${VARIANT_ICON_COLORS[variant]}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
