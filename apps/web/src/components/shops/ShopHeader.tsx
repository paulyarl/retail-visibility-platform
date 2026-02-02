'use client';

import { Shop } from '@/lib/shops/shop-resolver';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Separator } from '@/components/ui/Separator';
import { 
  MapPin, 
  Phone, 
  Mail, 
  Globe, 
  Clock, 
  CheckCircle,
  Star,
  Users,
  Package
} from 'lucide-react';
import Image from 'next/image';

interface ShopHeaderProps {
  shop: Shop;
  variant?: 'full' | 'compact';
}

export default function ShopHeader({ shop, variant = 'full' }: ShopHeaderProps) {
  const isCompact = variant === 'compact';

  return (
    <div className="relative">
      {/* Banner Image */}
      <div className="relative h-48 md:h-64 bg-gradient-to-r from-blue-500 to-purple-600">
        {shop.bannerUrl ? (
          <Image
            src={shop.bannerUrl}
            alt={`${shop.name} banner`}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-purple-600" />
        )}
        
        {/* Overlay gradient for better text visibility */}
        <div className="absolute inset-0 bg-black bg-opacity-30" />
      </div>

      {/* Shop Info Overlay */}
      <div className="container mx-auto px-4">
        <div className="relative -mt-16 md:-mt-20">
          <Card className="bg-white shadow-lg">
            <CardContent className="p-6 md:p-8">
              <div className="flex flex-col md:flex-row gap-6">
                {/* Logo */}
                <div className="flex-shrink-0">
                  <div className="w-24 h-24 md:w-32 md:h-32 bg-white rounded-lg shadow-md border-2 border-white overflow-hidden">
                    {shop.logoUrl ? (
                      <Image
                        src={shop.logoUrl}
                        alt={`${shop.name} logo`}
                        width={128}
                        height={128}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                        <span className="text-white text-2xl md:text-3xl font-bold">
                          {shop.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Shop Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="min-w-0">
                      {/* Shop Name and Verification */}
                      <div className="flex items-center gap-2 mb-2">
                        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 truncate">
                          {shop.name}
                        </h1>
                        {shop.isVerified && (
                          <div className="flex items-center text-blue-600">
                            <CheckCircle className="w-5 h-5" />
                          </div>
                        )}
                      </div>

                      {/* Tagline */}
                      {shop.tagline && !isCompact && (
                        <p className="text-gray-600 mb-3">{shop.tagline}</p>
                      )}

                      {/* Rating and Stats */}
                      <div className="flex flex-wrap items-center gap-4 text-sm">
                        {shop.rating && (
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-500 fill-current" />
                            <span className="font-medium">{shop.rating.toFixed(1)}</span>
                            {shop.reviewCount && (
                              <span className="text-gray-500">({shop.reviewCount} reviews)</span>
                            )}
                          </div>
                        )}
                        
                        {shop.productCount && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Package className="w-4 h-4" />
                            <span>{shop.productCount} products</span>
                          </div>
                        )}
                        
                        {shop.followerCount && (
                          <div className="flex items-center gap-1 text-gray-600">
                            <Users className="w-4 h-4" />
                            <span>{shop.followerCount} followers</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    {!isCompact && (
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button className="w-full sm:w-auto">
                          Follow Shop
                        </Button>
                        <Button variant="outline" className="w-full sm:w-auto">
                          Contact
                        </Button>
                        <Button variant="outline" className="w-full sm:w-auto">
                          Share
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* Location and Contact Info */}
                  {!isCompact && (
                    <>
                      <Separator className="my-4" />
                      <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                        {shop.address && (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            <span>{shop.address}</span>
                          </div>
                        )}
                        {shop.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-4 h-4" />
                            <a href={`tel:${shop.phone}`} className="hover:text-blue-600">
                              {shop.phone}
                            </a>
                          </div>
                        )}
                        {shop.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-4 h-4" />
                            <a href={`mailto:${shop.email}`} className="hover:text-blue-600">
                              {shop.email}
                            </a>
                          </div>
                        )}
                        {shop.website && (
                          <div className="flex items-center gap-1">
                            <Globe className="w-4 h-4" />
                            <a 
                              href={shop.website} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="hover:text-blue-600"
                            >
                              Visit Website
                            </a>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Compact Variant - Additional Info */}
              {isCompact && (
                <>
                  <Separator className="my-4" />
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                      {shop.address && (
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          <span>{shop.address}</span>
                        </div>
                      )}
                      {shop.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="w-4 h-4" />
                          <a href={`tel:${shop.phone}`} className="hover:text-blue-600">
                            {shop.phone}
                          </a>
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm">Follow</Button>
                      <Button variant="outline" size="sm">Contact</Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
