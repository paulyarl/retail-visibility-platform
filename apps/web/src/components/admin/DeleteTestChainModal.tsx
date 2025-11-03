'use client';

import { X } from 'lucide-react';

interface DeleteTestChainModalProps {
  onClose: () => void;
}

export default function DeleteTestChainModal({ onClose }: DeleteTestChainModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-lg w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Delete Test Chain</h2>
          <button onClick={onClose}><X className="w-6 h-6" /></button>
        </div>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Coming soon! This will allow you to delete test organizations and all associated data.
        </p>
        <button onClick={onClose} className="w-full bg-gray-600 hover:bg-gray-700 text-white py-3 rounded-lg">
          Close
        </button>
      </div>
    </div>
  );
}
