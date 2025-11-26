"use client";

import { useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui';

export default function ItemsGuide() {
  const [isExpanded, setIsExpanded] = useState(false);
  const params = useParams();
  const tenantId = params?.tenantId as string;

  return (
    <div className="mt-8 mb-6">
      <Card>
        <CardContent className="p-6">
          {/* Header - Always Visible */}
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full flex items-center justify-between text-left"
          >
            <div className="flex items-center gap-3" >
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-pulse">
                <h3 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  Quick Start Guide
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400">
                  Learn how to manage your inventory and sync to Google
                </p>
              </div>
            </div>
            <svg 
              className={`w-5 h-5 text-neutral-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Expandable Content */}
          {isExpanded && (
            <div className="mt-6 space-y-6">
              {/* Product Quick Start - Hero Feature */}
              <section className="relative">
                {/* Attention-grabbing badge */}
                <div className="absolute -top-3 -left-3">
                  <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-pulse">
                    🚀 START HERE
                  </div>
                </div>
                
                <div className="border-2 border-purple-200 dark:border-purple-800 rounded-xl p-6 bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-purple-900/20 dark:via-pink-900/20 dark:to-rose-900/20">
                  <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-bold shadow-lg">★</span>
                    Product Quick Start
                  </h4>
                  
                  <div className="ml-10 space-y-4">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      The <strong className="text-purple-600 dark:text-purple-400">"Quick Start"</strong> button at the top is your fastest path to adding products!
                    </p>
                    
                    <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-purple-200 dark:border-purple-800">
                      <p className="font-semibold text-sm text-neutral-900 dark:text-white mb-3">
                        🎯 What Quick Start Does:
                      </p>
                      
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                            <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">1</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white">Scan or Enter Barcode</p>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400">Use your device camera or type manually</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-100 dark:bg-pink-900/40 flex items-center justify-center">
                            <span className="text-pink-600 dark:text-pink-400 font-bold text-sm">2</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white">Auto-Fill Everything</p>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400">Product name, brand, description, images - all filled automatically!</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center">
                            <span className="text-rose-600 dark:text-rose-400 font-bold text-sm">3</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white">Smart Category Suggestion</p>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400">We suggest a category - you approve or pick your own</p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                            <span className="text-purple-600 dark:text-purple-400 font-bold text-sm">4</span>
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-neutral-900 dark:text-white">One-Click Save</p>
                            <p className="text-xs text-neutral-600 dark:text-neutral-400">Product is live and ready to sync to Google!</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 rounded-lg p-3 border border-purple-200 dark:border-purple-800">
                        <p className="text-xs font-semibold text-purple-900 dark:text-purple-100 mb-1">⚡ Speed</p>
                        <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">30 seconds</p>
                        <p className="text-xs text-purple-700 dark:text-purple-300">per product</p>
                      </div>
                      
                      <div className="bg-gradient-to-r from-pink-100 to-rose-100 dark:from-pink-900/30 dark:to-rose-900/30 rounded-lg p-3 border border-pink-200 dark:border-pink-800">
                        <p className="text-xs font-semibold text-pink-900 dark:text-pink-100 mb-1">🎯 Accuracy</p>
                        <p className="text-2xl font-bold text-pink-600 dark:text-pink-400">95%+</p>
                        <p className="text-xs text-pink-700 dark:text-pink-300">auto-filled correctly</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                      <svg className="w-5 h-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <div className="text-sm text-purple-900 dark:text-purple-100">
                        <p className="font-semibold mb-1">Pro Tip</p>
                        <p>Use Quick Start for your first 10-20 products to get familiar with the system. Then switch to CSV Bulk Import for larger catalogs!</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Understanding Sync Status */}
              <section className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                <h4 className="text-md font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-sm font-bold">1</span>
                  Understanding Sync Status
                </h4>
                <div className="ml-8 space-y-3 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-1.5 text-green-600 dark:text-green-500 mt-0.5">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-sm">Syncing</span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Item is active, public, and has a category. It's syncing to Google Merchant Center.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-1.5 text-red-600 dark:text-red-500 mt-0.5">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-sm">Blocked</span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Item is inactive or private. You've intentionally blocked it from syncing.
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-500 mt-0.5">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      <span className="font-medium text-sm">Incomplete</span>
                    </div>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Item is missing a category. Assign one to enable syncing.
                    </p>
                  </div>
                </div>
              </section>

              {/* Understanding Categories */}
              <section className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                <h4 className="text-md font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center text-purple-600 dark:text-purple-400 text-sm font-bold">2</span>
                  Understanding Categories
                </h4>
                <div className="ml-8 space-y-3">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Categories organize your products and appear consistently across your <strong>storefront</strong>, <strong>product pages</strong>, and <strong>directory listing</strong>.
                  </p>
                  <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                      <div className="w-8 h-8 rounded bg-blue-600 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-sm text-blue-900 dark:text-blue-100 mb-1">
                          How Categories Work
                        </p>
                        <ol className="text-sm text-blue-800 dark:text-blue-200 space-y-1.5 list-decimal list-inside">
                          <li><strong>Create categories</strong> in Settings (e.g., "Electronics", "Clothing")</li>
                          <li><strong>Optionally map</strong> to Google taxonomy for SEO & sync</li>
                          <li><strong>Assign products</strong> to your categories (products can only use your categories)</li>
                          <li><strong>Categories appear</strong> on storefront sidebar, product cards, and directory filters</li>
                        </ol>
                      </div>
                    </div>
                    <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                      <Link
                        href={`/t/${tenantId}/settings/tenant`}
                        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        Manage Categories in Settings
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 mt-3">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      <strong>Note:</strong> Products don't have direct access to Google's 6000+ categories. You create your own categories and optionally map them to Google for SEO and sync purposes.
                    </p>
                  </div>
                </div>
              </section>

              {/* Bulk Actions Power Feature - NEW */}
              <section className="relative">
                {/* Attention-grabbing badge */}
                <div className="absolute -top-3 -left-3">
                  <div className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg animate-pulse">
                    ⚡ POWER FEATURE
                  </div>
                </div>
                
                <div className="border-2 border-primary-200 dark:border-primary-800 rounded-xl p-6 bg-gradient-to-br from-primary-50 via-blue-50 to-purple-50 dark:from-primary-900/20 dark:via-blue-900/20 dark:to-purple-900/20">
                  <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-primary-500 flex items-center justify-center text-white text-sm font-bold shadow-lg">3</span>
                    Bulk Category Assignment
                  </h4>
                  
                  <div className="ml-10 space-y-4 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      Save <strong className="text-primary-600 dark:text-primary-400">97% of your time</strong> by assigning categories to multiple items at once!
                    </p>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* Before */}
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <span className="font-semibold text-sm text-red-900 dark:text-red-100">Old Way (Slow)</span>
                        </div>
                        <p className="text-xs text-red-800 dark:text-red-200 mb-2">
                          25 items × 30 seconds each
                        </p>
                        <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                          12.5 minutes
                        </p>
                      </div>
                      
                      {/* After */}
                      <div className="bg-green-50 dark:bg-green-900/20 border-2 border-green-500 dark:border-green-600 rounded-lg p-4 shadow-lg">
                        <div className="flex items-center gap-2 mb-2">
                          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <span className="font-semibold text-sm text-green-900 dark:text-green-100">New Way (Fast)</span>
                        </div>
                        <p className="text-xs text-green-800 dark:text-green-200 mb-2">
                          Select all + assign once
                        </p>
                        <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                          30 seconds
                        </p>
                      </div>
                    </div>
                    
                    <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                      <p className="font-semibold text-sm text-neutral-900 dark:text-white mb-3">
                        How to Use Bulk Actions:
                      </p>
                      <ol className="text-sm text-neutral-700 dark:text-neutral-300 space-y-2 list-decimal list-inside mb-4">
                        <li>Click the <strong className="text-primary-600 dark:text-primary-400">"Select Items"</strong> button above your inventory</li>
                        <li>Click items to select them (or use <strong>"Select All"</strong>)</li>
                        <li>Choose an action from the bulk action buttons</li>
                        <li>Done! All selected items updated instantly</li>
                      </ol>
                      
                      <div className="pt-3 border-t border-primary-200 dark:border-primary-800">
                        <p className="font-semibold text-xs text-neutral-700 dark:text-neutral-400 mb-2">
                          Available Bulk Actions:
                        </p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-primary-500" />
                            <span className="text-neutral-700 dark:text-neutral-300"><strong>Category</strong> - Assign to all</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500" />
                            <span className="text-neutral-700 dark:text-neutral-300"><strong>Status</strong> - Active/Inactive/Archive</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-blue-500" />
                            <span className="text-neutral-700 dark:text-neutral-300"><strong>Visibility</strong> - Public/Private</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-purple-500" />
                            <span className="text-neutral-700 dark:text-neutral-300"><strong>Propagate</strong> - Sync to locations</span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                      <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-sm text-blue-900 dark:text-blue-100">
                        <strong>Pro Tip:</strong> Use filters to narrow down items first (e.g., filter by "No category"), then select all and assign in one go!
                      </p>
                    </div>
                  </div>
                </div>
              </section>

              {/* CSV Bulk Import Guide - NEW */}
              <section className="relative">
                <div className="border-2 border-green-200 dark:border-green-800 rounded-xl p-6 bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/20 dark:via-emerald-900/20 dark:to-teal-900/20">
                  <h4 className="text-lg font-bold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                    <span className="w-8 h-8 rounded-lg bg-green-500 flex items-center justify-center text-white text-sm font-bold shadow-lg">4</span>
                    CSV Bulk Import
                  </h4>
                  
                  <div className="ml-10 space-y-4 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                    <p className="text-sm font-medium text-neutral-900 dark:text-white">
                      Import hundreds of products at once with categories, status, and visibility pre-configured!
                    </p>
                    
                    <div className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-green-200 dark:border-green-800">
                      <p className="font-semibold text-sm text-neutral-900 dark:text-white mb-3">
                        📋 CSV Format & Fields:
                      </p>
                      
                      <div className="space-y-3 text-sm">
                        <div>
                          <p className="font-semibold text-green-700 dark:text-green-300 mb-1">Required Fields:</p>
                          <div className="ml-4 space-y-1">
                            <div className="flex items-start gap-2">
                              <span className="text-red-500 font-bold">*</span>
                              <code className="text-xs bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 rounded">name</code>
                              <span className="text-neutral-600 dark:text-neutral-400">- Product name</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-red-500 font-bold">*</span>
                              <code className="text-xs bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 rounded">sku</code>
                              <span className="text-neutral-600 dark:text-neutral-400">- Unique product identifier</span>
                            </div>
                            <div className="flex items-start gap-2">
                              <span className="text-red-500 font-bold">*</span>
                              <code className="text-xs bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 rounded">price</code>
                              <span className="text-neutral-600 dark:text-neutral-400">- Product price (e.g., 89.99)</span>
                            </div>
                          </div>
                        </div>
                        
                        <div>
                          <p className="font-semibold text-blue-700 dark:text-blue-300 mb-1">Optional Fields:</p>
                          <div className="ml-4 space-y-1 text-xs">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                              <div>
                                <code className="bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 rounded">title</code>
                                <span className="text-neutral-600 dark:text-neutral-400"> - Full product title</span>
                              </div>
                              <div>
                                <code className="bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 rounded">brand</code>
                                <span className="text-neutral-600 dark:text-neutral-400"> - Brand name</span>
                              </div>
                              <div>
                                <code className="bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 rounded">manufacturer</code>
                                <span className="text-neutral-600 dark:text-neutral-400"> - Manufacturer</span>
                              </div>
                              <div>
                                <code className="bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 rounded">description</code>
                                <span className="text-neutral-600 dark:text-neutral-400"> - Product details</span>
                              </div>
                              <div>
                                <code className="bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 rounded">currency</code>
                                <span className="text-neutral-600 dark:text-neutral-400"> - USD, EUR, etc.</span>
                              </div>
                              <div>
                                <code className="bg-neutral-100 dark:bg-neutral-700 px-2 py-0.5 rounded">imageUrl</code>
                                <span className="text-neutral-600 dark:text-neutral-400"> - Product image URL</span>
                              </div>
                            </div>
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t border-green-200 dark:border-green-800">
                          <p className="font-semibold text-primary-700 dark:text-primary-300 mb-2">🆕 New Power Fields:</p>
                          <div className="ml-4 space-y-2">
                            <div className="bg-primary-50 dark:bg-primary-900/20 p-2 rounded">
                              <code className="text-xs bg-white dark:bg-neutral-800 px-2 py-0.5 rounded font-bold">category</code>
                              <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-1">
                                Your tenant category name (e.g., "Athletic Footwear")
                                <br />
                                <span className="text-primary-600 dark:text-primary-400">→ Will be created if it doesn't exist!</span>
                              </p>
                            </div>
                            <div className="bg-green-50 dark:bg-green-900/20 p-2 rounded">
                              <code className="text-xs bg-white dark:bg-neutral-800 px-2 py-0.5 rounded font-bold">status</code>
                              <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-1">
                                <strong>active</strong>, inactive, archived, draft (default: active)
                                <br />
                                <span className="text-green-600 dark:text-green-400">→ Control which items are live immediately</span>
                              </p>
                            </div>
                            <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                              <code className="text-xs bg-white dark:bg-neutral-800 px-2 py-0.5 rounded font-bold">visibility</code>
                              <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-1">
                                <strong>public</strong>, private (default: public)
                                <br />
                                <span className="text-blue-600 dark:text-blue-400">→ Control Google Shopping sync on import</span>
                              </p>
                            </div>
                            <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                              <code className="text-xs bg-white dark:bg-neutral-800 px-2 py-0.5 rounded font-bold">availability</code>
                              <p className="text-xs text-neutral-700 dark:text-neutral-300 mt-1">
                                <strong>in_stock</strong>, out_of_stock, preorder, discontinued
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 mb-3">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <div className="text-sm text-amber-900 dark:text-amber-100">
                          <h2 className="font-semibold mb-1">⚠️ Important CSV Formatting Rule:</h2>
                          <p className="mb-2">Optional fields can be <strong>empty</strong>, but you must <strong>keep the commas</strong>!</p>
                          <div className="bg-white dark:bg-neutral-800 rounded p-2 font-mono text-xs space-y-1">
                            <div className="text-green-600 dark:text-green-400">✓ Correct: Red Shoes,SHOE-01,89.99,,active,public</div>
                            <div className="text-red-600 dark:text-red-400">✗ Wrong: Red Shoes,SHOE-01,89.99,active,public</div>
                          </div>
                          <p className="text-xs mt-2">Notice the double comma (,,) for the empty category field</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-neutral-100 dark:bg-neutral-800 rounded-lg p-3 font-mono text-xs overflow-x-auto">
                      <h2 className="text-neutral-500 dark:text-neutral-400 mb-2"># Example CSV:</h2>
                      <div className="text-neutral-900 dark:text-neutral-100 space-y-1">
                        <div>name,sku,price,category,status,visibility</div>
                        <div className="text-green-600 dark:text-green-400">Red Shoes,SHOE-01,89.99,Athletic Footwear,active,public</div>
                        <div className="text-blue-600 dark:text-blue-400">Blue Shirt,SHIRT-01,24.99,Apparel,active,public</div>
                        <div className="text-amber-600 dark:text-amber-400">Yoga Mat,YOGA-01,34.99,Fitness Equipment,inactive,private</div>
                        <div className="text-neutral-500 dark:text-neutral-400"># Empty optional fields (notice the commas):</div>
                        <div className="text-purple-600 dark:text-purple-400">Water Bottle,BOTTLE-01,12.99,,active,</div>
                      </div>
                    </div>
                    
                    <div className="flex items-start gap-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-green-900 dark:text-green-100">
                        <h2 className="font-semibold mb-1">Download Template</h2>
                        <p>Click "Bulk Upload" → "Download Template" to get a pre-formatted CSV with examples and instructions!</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Quick Actions */}
              <section className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                <h4 className="text-md font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 text-sm font-bold">5</span>
                  Quick Actions
                </h4>
                <div className="ml-8 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-neutral-900 dark:text-white">Enrich</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">Scan barcode to auto-fill images, descriptions, and details</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-gradient-to-r from-blue-600 to-cyan-600 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-neutral-900 dark:text-white">Propagate</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">Copy item to other locations (Premium feature)</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-neutral-600 dark:text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-neutral-900 dark:text-white">Public/Private</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">Control visibility on your storefront</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center flex-shrink-0">
                      <svg className="w-4 h-4 text-neutral-600 dark:text-neutral-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-sm text-neutral-900 dark:text-white">Active/Archived</p>
                      <p className="text-xs text-neutral-600 dark:text-neutral-400">Enable or archive items (archived items won't sync)</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Getting Items to Sync */}
              <section className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                <h4 className="text-md font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 dark:text-green-400 text-sm font-bold">6</span>
                  Getting Items to Sync
                </h4>
                <div className="ml-8 space-y-2 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    For an item to sync to Google Merchant Center, it must meet all three requirements:
                  </p>
                  <ul className="space-y-2">
                    <li className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-neutral-700 dark:text-neutral-300">
                        <strong>Status: Active</strong> - Click the status toggle to activate
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-neutral-700 dark:text-neutral-300">
                        <strong>Visibility: Public</strong> - Click the eye icon to make public
                      </span>
                    </li>
                    <li className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      <span className="text-neutral-700 dark:text-neutral-300">
                        <strong>Category Assigned</strong> - Click "Category" to assign one
                      </span>
                    </li>
                  </ul>
                </div>
              </section>

              {/* Tips & Best Practices */}
              <section className="bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                <h4 className="text-md font-semibold text-neutral-900 dark:text-white mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-amber-600 dark:text-amber-400 text-sm font-bold">💡</span>
                  Tips & Best Practices
                </h4>
                <div className="ml-8 space-y-2 bg-white/80 dark:bg-neutral-800/80 backdrop-blur-sm rounded-lg p-4 border border-primary-200 dark:border-primary-800">
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Use <strong>filters</strong> to quickly find items that aren't syncing
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Use <strong>Enrich</strong> to quickly add product details by scanning barcodes
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Set items to <strong>Private</strong> if you want them on your storefront but not on Google
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <svg className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-1" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                    <p className="text-sm text-neutral-600 dark:text-neutral-400">
                      Watch the <strong>sync status indicator</strong> - it tells you exactly what needs fixing
                    </p>
                  </div>
                </div>
              </section>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
