"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Badge, Button } from "@/components/ui";
import { motion, AnimatePresence } from "framer-motion";

type Item = {
  id: string;
  sku: string;
  name: string;
  priceCents?: number;
  stock?: number;
  imageUrl?: string;
  itemStatus?: 'active' | 'inactive' | 'archived';
  visibility?: 'public' | 'private';
  availability?: 'in_stock' | 'out_of_stock' | 'preorder';
  googleSyncStatus?: 'synced' | 'pending' | 'error';
};

type ItemsGridV2Props = {
  items: Item[];
  onEdit?: (item: Item) => void;
  onDelete?: (item: Item) => void;
  onStatusToggle?: (item: Item) => void;
  onVisibilityToggle?: (item: Item) => void;
  onViewPhotos?: (item: Item) => void;
};

export default function ItemsGridV2({ 
  items, 
  onEdit, 
  onDelete, 
  onStatusToggle, 
  onVisibilityToggle,
  onViewPhotos 
}: ItemsGridV2Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      {(!items || items.length === 0) ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-neutral-500">
              <svg className="mx-auto h-12 w-12 text-neutral-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <p className="text-sm">No items found</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              onMouseEnter={() => setHoveredId(item.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <Card className="h-full hover:shadow-lg transition-shadow duration-200 overflow-hidden">
                {/* Image Header */}
                <div className="relative h-48 bg-gradient-to-br from-neutral-100 to-neutral-200">
                  {item.imageUrl ? (
                    <img 
                      src={item.imageUrl} 
                      alt={item.name} 
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <svg className="h-16 w-16 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  
                  {/* Status Badges Overlay */}
                  <div className="absolute top-2 right-2 flex flex-col gap-1">
                    {item.itemStatus === 'active' && (
                      <Badge variant="success" className="shadow-sm">
                        Active
                      </Badge>
                    )}
                    {item.itemStatus === 'inactive' && (
                      <Badge variant="default" className="shadow-sm">
                        Paused
                      </Badge>
                    )}
                    {item.visibility === 'public' && (
                      <Badge variant="info" className="shadow-sm">
                        <svg className="w-3 h-3 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                        Public
                      </Badge>
                    )}
                    {item.googleSyncStatus === 'error' && (
                      <Badge variant="error" className="shadow-sm">
                        Sync Error
                      </Badge>
                    )}
                  </div>
                  
                  {/* Quick Actions Overlay */}
                  <AnimatePresence>
                    {hoveredId === item.id && onViewPhotos && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black bg-opacity-40 flex items-center justify-center"
                      >
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => onViewPhotos(item)}
                          className="bg-white hover:bg-neutral-100"
                        >
                          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          View Photos
                        </Button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Content */}
                <CardContent className="p-4">
                  {/* Title & SKU */}
                  <div className="mb-3">
                    <h3 className="font-semibold text-neutral-900 text-lg mb-1 line-clamp-2">
                      {item.name}
                    </h3>
                    <p className="text-sm text-neutral-500 font-mono">{item.sku}</p>
                  </div>

                  {/* Price & Stock */}
                  <div className="flex items-center justify-between mb-4 pb-4 border-b border-neutral-200">
                    <div>
                      {typeof item.priceCents === 'number' && (
                        <p className="text-2xl font-bold text-neutral-900">
                          ${(item.priceCents / 100).toFixed(2)}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      {typeof item.stock === 'number' && (
                        <div>
                          <p className="text-xs text-neutral-500">Stock</p>
                          <p className={`text-lg font-semibold ${
                            item.stock === 0 ? 'text-danger' : 
                            item.stock < 10 ? 'text-warning' : 
                            'text-success'
                          }`}>
                            {item.stock}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="grid grid-cols-2 gap-2">
                    {onStatusToggle && (
                      <Button
                        size="sm"
                        variant={item.itemStatus === 'active' ? 'secondary' : 'primary'}
                        onClick={() => onStatusToggle(item)}
                        className="w-full"
                        title={item.itemStatus === 'active' ? 'Pause item' : 'Activate item'}
                      >
                        {item.itemStatus === 'active' ? (
                          <>
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Pause
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Resume
                          </>
                        )}
                      </Button>
                    )}

                    {onVisibilityToggle && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onVisibilityToggle(item)}
                        className="w-full"
                        title={item.visibility === 'public' ? 'Hide from storefront' : 'Show on storefront'}
                      >
                        {item.visibility === 'public' ? (
                          <>
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Public
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            </svg>
                            Private
                          </>
                        )}
                      </Button>
                    )}

                    {onEdit && (
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => onEdit(item)}
                        className="w-full"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Edit
                      </Button>
                    )}

                    {onDelete && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onDelete(item)}
                        className="w-full text-danger hover:bg-danger-50"
                      >
                        <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Delete
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
