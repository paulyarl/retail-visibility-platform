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
  const formatAddress = () => {
    if (!shop.address) return null;
    const parts = [shop.address, shop.city, shop.state, shop.postalCode].filter(Boolean);
    return parts.join(', ');
  };

  const getOperatingStatus = () => {
    const now = new Date();
    const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const dayHours = [
      shop.sunday,    // 0
      shop.monday,    // 1
      shop.tuesday,   // 2
      shop.wednesday, // 3
      shop.thursday,  // 4
      shop.friday,    // 5
      shop.saturday   // 6
    ][day];

    if (!dayHours || dayHours === 'Closed') {
      return { status: 'closed', label: 'Closed Now' };
    }

    // Parse hours like "9:00 AM - 6:00 PM"
    const match = dayHours.match(/(\d+):?\d*\s*(AM|PM)\s*-\s*(\d+):?\d*\s*(AM|PM)/i);
    if (!match) {
      return { status: 'unknown', label: dayHours };
    }

    const [, openTime, openPeriod, closeTime, closePeriod] = match;
    
    const convertToMinutes = (time: string, period: string) => {
      const [hours, minutes = '0'] = time.split(':').map(Number);
      const totalMinutes = hours * 60 + (minutes as number);
      return period.toUpperCase() === 'PM' && hours !== 12 ? totalMinutes + 720 : totalMinutes;
    };

    const openMinutes = convertToMinutes(openTime, openPeriod);
    const closeMinutes = convertToMinutes(closeTime, closePeriod);

    if (currentTime >= openMinutes && currentTime < closeMinutes) {
      return { status: 'open', label: 'Open Now' };
    }

    return { status: 'closed', label: 'Closed Now' };
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

          {shop.tagline && (
            <div>
              <h4 className="font-semibold mb-2">Tagline</h4>
              <p className="text-gray-600 italic">{shop.tagline}</p>
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
                {shop.createdAt.toLocaleDateString('en-US', { 
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
          {formatAddress() && (
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Address</h4>
                <p className="text-gray-600">{formatAddress()}</p>
              </div>
            </div>
          )}

          {shop.phone && (
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Phone</h4>
                <a 
                  href={`tel:${shop.phone}`} 
                  className="text-blue-600 hover:text-blue-700"
                >
                  {shop.phone}
                </a>
              </div>
            </div>
          )}

          {shop.email && (
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Email</h4>
                <a 
                  href={`mailto:${shop.email}`} 
                  className="text-blue-600 hover:text-blue-700"
                >
                  {shop.email}
                </a>
              </div>
            </div>
          )}

          {shop.website && (
            <div className="flex items-center gap-3">
              <Globe className="w-5 h-5 text-gray-400 flex-shrink-0" />
              <div>
                <h4 className="font-semibold mb-1">Website</h4>
                <a 
                  href={shop.website} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-700"
                >
                  {shop.website.replace(/^https?:\/\//, '')}
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Business Hours */}
      {(shop.monday || shop.tuesday || shop.wednesday || shop.thursday || 
        shop.friday || shop.saturday || shop.sunday) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              Business Hours
              <Badge 
                variant={operatingStatus.status === 'open' ? 'default' : 'info'}
                className="ml-auto"
              >
                {operatingStatus.label}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {shop.monday && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Monday</span>
                  <span className="text-gray-600">{shop.monday}</span>
                </div>
              )}
              {shop.tuesday && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Tuesday</span>
                  <span className="text-gray-600">{shop.tuesday}</span>
                </div>
              )}
              {shop.wednesday && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Wednesday</span>
                  <span className="text-gray-600">{shop.wednesday}</span>
                </div>
              )}
              {shop.thursday && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Thursday</span>
                  <span className="text-gray-600">{shop.thursday}</span>
                </div>
              )}
              {shop.friday && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Friday</span>
                  <span className="text-gray-600">{shop.friday}</span>
                </div>
              )}
              {shop.saturday && (
                <div className="flex justify-between items-center py-2 border-b">
                  <span className="font-medium">Saturday</span>
                  <span className="text-gray-600">{shop.saturday}</span>
                </div>
              )}
              {shop.sunday && (
                <div className="flex justify-between items-center py-2">
                  <span className="font-medium">Sunday</span>
                  <span className="text-gray-600">{shop.sunday}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Shop Statistics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Shop Statistics
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
                {shop.followerCount || 0}
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
