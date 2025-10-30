"use client";

import React from "react";
import { Card, CardHeader, CardTitle, CardContent, Badge } from "@/components/ui";

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
};

export default function ItemsGridV2({ items }: { items: Item[] }) {
  return (
    <Card aria-label="items-grid-v2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            Items (Grid v2)
            <Badge variant="info">Experimental</Badge>
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {(!items || items.length === 0) ? (
          <div className="text-center py-12 text-sm text-neutral-500">No items</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((i) => (
              <div key={i.id} className="border border-neutral-200 rounded-lg p-4 bg-white flex gap-4">
                <div className="flex-shrink-0">
                  {i.imageUrl ? (
                    <img src={i.imageUrl} alt={i.name} className="h-16 w-16 object-cover rounded-lg border border-neutral-200" />
                  ) : (
                    <div className="h-16 w-16 bg-neutral-100 rounded-lg" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="inline-block px-2 py-1 bg-primary-100 rounded">
                      <span className="text-sm font-semibold text-primary-900">{i.name}</span>
                    </div>
                    <Badge variant="default">{i.sku}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-neutral-600 flex items-center gap-3">
                    {typeof i.priceCents === 'number' && <span>${(i.priceCents / 100).toFixed(2)}</span>}
                    {typeof i.stock === 'number' && <span>Stock: {i.stock}</span>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
