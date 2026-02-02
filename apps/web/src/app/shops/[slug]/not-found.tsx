/**
 * Shop Not Found Page
 * Displayed when a shop profile doesn't exist
 */

import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Store, Search, ArrowLeft } from 'lucide-react';

export default function ShopNotFound() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto text-center">
          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                <Store className="h-8 w-8 text-gray-400" />
              </div>
              <CardTitle className="text-2xl">Shop Not Found</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">
                We couldn't find the shop you're looking for. It might have been removed, 
                or the URL might be incorrect.
              </p>
              
              <div className="space-y-3">
                <Link href="/shops/directory">
                  <Button className="w-full">
                    <Search className="h-4 w-4 mr-2" />
                    Browse Shop Directory
                  </Button>
                </Link>
                
                <Link href="/shops">
                  <Button variant="outline" className="w-full">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Shops
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
