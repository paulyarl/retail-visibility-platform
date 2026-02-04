'use client';

import { useState } from 'react';
import { shopsService, type Shop } from '@/services/ShopsService';
import { Card, CardContent } from '@/components/ui/Card';
import { 
  Heart, 
  Share2, 
  MessageCircle, 
  Phone, 
  Mail, 
  Globe,
  ExternalLink,
  Check
} from 'lucide-react';
import { Button } from '@mantine/core';

interface ShopActionsProps {
  shop: Shop;
}

export default function ShopActions({ shop }: ShopActionsProps) {
  const [isFollowing, setIsFollowing] = useState(false);
  const [showShareOptions, setShowShareOptions] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleFollow = async () => {
    const success = await shopsService.followShop(shop.tenantId, !isFollowing);
    if (success) {
      setIsFollowing(!isFollowing);
    }
  };

  const handleShare = async (method: 'link' | 'facebook' | 'twitter' | 'email') => {
    const shopUrl = `${window.location.origin}/shops/${shop.slug || shop.tenantId}`;
    
    switch (method) {
      case 'link':
        await navigator.clipboard.writeText(shopUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        break;
      
      case 'facebook':
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shopUrl)}`, '_blank');
        break;
      
      case 'twitter':
        const text = `Check out ${shop.name} - ${shop.description || 'Amazing products and services!'}`;
        window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(shopUrl)}`, '_blank');
        break;
      
      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent(`Check out ${shop.name}`)}&body=${encodeURIComponent(`I thought you might be interested in ${shop.name}. ${shop.description || ''}\n\nVisit them at: ${shopUrl}`)}`;
        break;
    }
  };

  const handleContact = (method: 'phone' | 'email' | 'website') => {
    switch (method) {
      case 'phone':
        if (shop.phone) {
          window.location.href = `tel:${shop.phone}`;
        }
        break;
      
      case 'email':
        if (shop.email) {
          window.location.href = `mailto:${shop.email}`;
        }
        break;
      
      case 'website':
        if (shop.website) {
          window.open(shop.website, '_blank');
        }
        break;
    }
  };

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {/* Follow Button */}
        <Button
          onClick={handleFollow}
          variant={isFollowing ? "outline" : "default"}
          className="w-full"
        >
          <Heart className={`w-4 h-4 mr-2 ${isFollowing ? 'fill-current' : ''}`} />
          {isFollowing ? 'Following' : 'Follow Shop'}
        </Button>

        {/* Contact Actions */}
        <div className="grid grid-cols-1 gap-2">
          {shop.phone && (
            <Button
              variant="outline"
              onClick={() => handleContact('phone')}
              className="w-full justify-start"
            >
              <Phone className="w-4 h-4 mr-2" />
              Call Shop
            </Button>
          )}
          
          {shop.email && (
            <Button
              variant="outline"
              onClick={() => handleContact('email')}
              className="w-full justify-start"
            >
              <Mail className="w-4 h-4 mr-2" />
              Send Email
            </Button>
          )}
          
          {shop.website && (
            <Button
              variant="outline"
              onClick={() => handleContact('website')}
              className="w-full justify-start"
            >
              <Globe className="w-4 h-4 mr-2" />
              Visit Website
              <ExternalLink className="w-3 h-3 ml-auto" />
            </Button>
          )}
        </div>

        {/* Share Button */}
        <div className="relative">
          <Button
            variant="outline"
            onClick={() => setShowShareOptions(!showShareOptions)}
            className="w-full justify-start"
          >
            <Share2 className="w-4 h-4 mr-2" />
            Share Shop
          </Button>

          {/* Share Options Dropdown */}
          {showShareOptions && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
              <div className="p-2 space-y-1">
                <Button
                  variant="ghost"
                  onClick={() => handleShare('link')}
                  className="w-full justify-start"
                >
                  {copied ? (
                    <>
                      <Check className="w-4 h-4 mr-2 text-green-600" />
                      Link Copied!
                    </>
                  ) : (
                    <>
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Copy Link
                    </>
                  )}
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={() => handleShare('facebook')}
                  className="w-full justify-start"
                >
                  <div className="w-4 h-4 mr-2 bg-blue-600 rounded" />
                  Share on Facebook
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={() => handleShare('twitter')}
                  className="w-full justify-start"
                >
                  <div className="w-4 h-4 mr-2 bg-sky-500 rounded" />
                  Share on Twitter
                </Button>
                
                <Button
                  variant="ghost"
                  onClick={() => handleShare('email')}
                  className="w-full justify-start"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Share via Email
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Message Button */}
        <Button
          variant="outline"
          className="w-full justify-start"
        >
          <MessageCircle className="w-4 h-4 mr-2" />
          Send Message
        </Button>

        {/* Shop Stats */}
        <div className="pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {shop.followerCount || 0}
              </div>
              <div className="text-xs text-gray-600">Followers</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {shop.productCount || 0}
              </div>
              <div className="text-xs text-gray-600">Products</div>
            </div>
            <div>
              <div className="text-lg font-semibold text-gray-900">
                {shop.rating ? shop.rating.toFixed(1) : '0.0'}
              </div>
              <div className="text-xs text-gray-600">Rating</div>
            </div>
          </div>
        </div>

        {/* Verification Badge */}
        {shop.isVerified && (
          <div className="flex items-center justify-center p-3 bg-blue-50 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                <span className="text-white text-xs">✓</span>
              </div>
              <span className="text-sm text-blue-800 font-medium">
                Verified Shop
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
