import Link from 'next/link';
import { ArrowLeft, XCircle } from 'lucide-react';

export default function PlaceNotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white dark:bg-neutral-900 rounded-2xl shadow-lg border border-gray-200 dark:border-neutral-700 p-8 text-center">
        <div className="mx-auto w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-6">
          <XCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-3">
          Place Not Found
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
          We couldn&apos;t find this place. It may have been removed or the URL might be incorrect.
        </p>
        <Link
          href="/directory"
          className="inline-flex items-center justify-center w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg transition-colors"
        >
          <ArrowLeft className="w-5 h-5 mr-2" />
          Browse Directory
        </Link>
      </div>
    </div>
  );
}
