/**
 * Product Featured Badges Component
 * 
 * Displays multiple featured type badges for products
 * Supports trending, featured, new, premium, staff pick, etc.
 */

'use client';

import * as React from 'react';
import { FeaturedType } from '../../services/EnhancedProductService';

interface ProductFeaturedBadgesProps {
  featuredTypes: FeaturedType[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const ProductFeaturedBadges: React.FC<ProductFeaturedBadgesProps> = ({
  featuredTypes,
  size = 'md',
  className = ''
}) => {
  if (!featuredTypes || featuredTypes.length === 0) {
    return null;
  }

  const getBadgeStyles = (type: FeaturedType['type'], isActive: boolean) => {
    const baseStyles = "inline-flex items-center gap-1 font-medium transition-all duration-200";
    
    const sizeStyles = {
      sm: "text-xs px-2 py-1 rounded-full",
      md: "text-sm px-3 py-1.5 rounded-full",
      lg: "text-base px-4 py-2 rounded-full"
    }[size];

    const labels = {
      featured: 'Featured',
      trending: 'Trending',
      new: 'New',
      premium: 'Premium',
      staff_pick: 'Staff Pick',
      bestseller: 'Bestseller',
      gift_idea: 'Gift Idea',
      popular: 'Popular'
    };

    const typeStyles = {
      featured: isActive 
        ? "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200"
        : "bg-purple-100 text-purple-700",
      trending: isActive
        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-orange-200"
        : "bg-orange-100 text-orange-700",
      new: isActive
        ? "bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-green-200"
        : "bg-green-100 text-green-700",
      premium: isActive
        ? "bg-gradient-to-r from-yellow-500 to-amber-500 text-white shadow-yellow-200"
        : "bg-yellow-100 text-yellow-700",
      staff_pick: isActive
        ? "bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-blue-200"
        : "bg-blue-100 text-blue-700",
      bestseller: isActive
        ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-pink-200"
        : "bg-pink-100 text-pink-700",
      gift_idea: isActive
        ? "bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-teal-200"
        : "bg-teal-100 text-teal-700",
      popular: isActive
        ? "bg-gradient-to-r from-indigo-500 to-purple-500 text-white shadow-indigo-200"
        : "bg-indigo-100 text-indigo-700"
    };

    return `${baseStyles} ${sizeStyles} ${typeStyles[type] || 'bg-gray-100 text-gray-700'}`;
  };

  const getBadgeIcon = (type: FeaturedType['type']) => {
    const iconSize = size === 'sm' ? 12 : size === 'md' ? 14 : 16;
    
    const icons = {
      featured: (
        <svg width={iconSize} height={iconSize} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      ),
      trending: (
        <svg width={iconSize} height={iconSize} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd"/>
        </svg>
      ),
      new: (
        <svg width={iconSize} height={iconSize} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd"/>
        </svg>
      ),
      premium: (
        <svg width={iconSize} height={iconSize} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd"/>
        </svg>
      ),
      staff_pick: (
        <svg width={iconSize} height={iconSize} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      ),
      bestseller: (
        <svg width={iconSize} height={iconSize} fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zM8 7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zM14 4a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z"/>
        </svg>
      ),
      gift_idea: (
        <svg width={iconSize} height={iconSize} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 5a3 3 0 015-2.236A3 3 0 0114.83 6H16a2 2 0 110 4h-5V9a1 1 0 10-2 0v1H4a2 2 0 110-4h1.17C5.06 5.687 5 5.35 5 5zm4 1V5a1 1 0 10-1 1h1zm3 0a1 1 0 10-1-1v1h1z" clipRule="evenodd"/>
          <path d="M9 11H3v5a2 2 0 002 2h4v-7zM11 18h4a2 2 0 002-2v-5h-6v7z"/>
        </svg>
      ),
      popular: (
        <svg width={iconSize} height={iconSize} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      )
    };

    return icons[type] || icons.featured;
  };

  // Sort by priority and limit to 3 badges
  const sortedBadges = featuredTypes
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3);

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {sortedBadges.map((badge, index) => (
        <div
          key={`${badge.type}-${index}`}
          className={getBadgeStyles(badge.type, badge.active)}
        >
          {getBadgeIcon(badge.type)}
          <span>{badge.label}</span>
          {badge.active && (
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          )}
        </div>
      ))}
    </div>
  );
};

export default ProductFeaturedBadges;
