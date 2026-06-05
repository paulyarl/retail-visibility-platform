'use client';

import { Shop } from '@/lib/shops/shop-resolver';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Clock, 
  Calendar,
  Building,
  Users,
  Star
} from 'lucide-react';

interface ShopInfoProps {
  shop: Shop;
}

export default function ShopInfo({ shop }: ShopInfoProps) {
  const getFullAddress = () => {
    if (!shop.address) return null;
    // Use location which contains city, state combined
    return shop.location ? `${shop.address}, ${shop.location}` : shop.address;
  };

  const getOperatingStatus = () => {
    // Business hours not available in Shop interface
    return { status: 'unknown', label: 'Hours Not Available' };
  };

  const operatingStatus = getOperatingStatus();

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5" />
            Shop Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {shop.description && (
            <div>
              <h4 className="font-semibold mb-2">About</h4>
              <p className="text-gray-600 leading-relaxed">{shop.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-semibold mb-2">Shop ID</h4>
              <p className="text-gray-600 font-mono text-sm">{shop.tenantId}</p>
            </div>
            <div>
              <h4 className="font-semibold mb-2">Member Since</h4>
              <p className="text-gray-600">
                {new Date(shop.createdAt).toLocaleDateString('en-US', { 
                  year: 'numeric', 
                  month: 'long' 
                })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5" />
            Contact Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {getFullAddress() && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Address</h4>
                <p className="text-gray-600">{getFullAddress()}</p>
              </div>
            </div>
          )}

          {shop.contact?.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Phone</h4>
                <a 
                  href={`tel:${shop.contact?.phone}`} 
                  className="text-blue-600 hover:text-blue-700"
                >
                  {shop.contact?.phone}
                </a>
              </div>
            </div>
          )}

          {shop.contact?.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Email</h4>
                <a 
                  href={`mailto:${shop.contact?.email}`} 
                  className="text-blue-600 hover:text-blue-700"
                >
                  {shop.contact?.email}
                </a>
              </div>
            </div>
          )}

          {shop.contact?.website && (
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Website</h4>
                <a 
                  href={shop.contact?.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  {shop.contact?.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Shop Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {shop.productCount || 0}
              </div>
              <div className="text-sm text-gray-600">Products</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {shop.reviewCount || 0}
              </div>
              <div className="text-sm text-gray-600">Followers</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {shop.reviewCount || 0}
              </div>
              <div className="text-sm text-gray-600">Reviews</div>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1">
                <span className="text-2xl font-bold text-orange-600">
                  {shop.rating ? shop.rating.toFixed(1) : '0.0'}
                </span>
                <Star className="w-5 h-5 text-yellow-500 fill-current" />
              </div>
              <div className="text-sm text-gray-600">Rating</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Verification Status */}
      {shop.isVerified && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                  <span className="text-white text-sm">✓</span>
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-lg">Verified Shop</h3>
                <p className="text-gray-600">
                  This shop has been verified by our team and meets our quality standards.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
