/**
 * Shop Categories Component
 * Displays shop categories with browsing, filtering, and popular highlights
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@mantine/core';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { 
  ShoppingBag, 
  Coffee, 
  Smartphone, 
  Heart, 
  Home, 
  Car, 
  Book, 
  Gamepad2, 
  Music, 
  Dumbbell,
  Baby,
  Pizza,
  Flower,
  Camera,
  Shirt,
  Search,
  TrendingUp,
  Star,
  MapPin
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShopCategoriesProps {
  selectedCategory?: string;
  onCategorySelect?: (category: string) => void;
  className?: string;
}

interface Category {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  shopCount: number;
  isPopular: boolean;
  description: string;
  color: string;
  trending?: boolean;
  growthRate?: number;
}

const categoryIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  'Electronics': Smartphone,
  'Coffee': Coffee,
  'Fashion': Shirt,
  'Food': Pizza,
  'Florist': Flower,
  'Home': Home,
  'Books': Book,
  'Gaming': Gamepad2,
  'Music': Music,
  'Fitness': Dumbbell,
  'Baby': Baby,
  'Photography': Camera,
  'Automotive': Car,
  'Health': Heart,
  'Shopping': ShoppingBag,
};

export function ShopCategories({ selectedCategory, onCategorySelect, className }: ShopCategoriesProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'popular' | 'name' | 'shops'>('popular');
  const [showPopularOnly, setShowPopularOnly] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  const fetchCategories = async () => {
    setLoading(true);
    try {
      // Mock API call - would integrate with actual categories API
      const mockCategories: Category[] = [
        {
          id: 'electronics',
          name: 'Electronics',
          icon: Smartphone,
          shopCount: 342,
          isPopular: true,
          description: 'Gadgets, computers, and tech accessories',
          color: 'bg-blue-100 text-blue-600',
          trending: true,
          growthRate: 15.3
        },
        {
          id: 'coffee',
          name: 'Coffee & Tea',
          icon: Coffee,
          shopCount: 189,
          isPopular: true,
          description: 'Coffee shops, roasters, and tea houses',
          color: 'bg-amber-100 text-amber-600',
          trending: true,
          growthRate: 22.7
        },
        {
          id: 'fashion',
          name: 'Fashion',
          icon: Shirt,
          shopCount: 567,
          isPopular: true,
          description: 'Clothing, shoes, and accessories',
          color: 'bg-pink-100 text-pink-600',
          growthRate: 8.9
        },
        {
          id: 'food',
          name: 'Food & Dining',
          icon: Pizza,
          shopCount: 423,
          isPopular: true,
          description: 'Restaurants, cafes, and food delivery',
          color: 'bg-orange-100 text-orange-600',
          trending: true,
          growthRate: 18.2
        },
        {
          id: 'florist',
          name: 'Florist',
          icon: Flower,
          shopCount: 78,
          isPopular: false,
          description: 'Flowers, plants, and arrangements',
          color: 'bg-green-100 text-green-600',
          growthRate: 12.1
        },
        {
          id: 'home',
          name: 'Home & Garden',
          icon: Home,
          shopCount: 234,
          isPopular: false,
          description: 'Furniture, decor, and garden supplies',
          color: 'bg-purple-100 text-purple-600',
          growthRate: 6.4
        },
        {
          id: 'books',
          name: 'Books & Media',
          icon: Book,
          shopCount: 156,
          isPopular: false,
          description: 'Bookstores, media, and entertainment',
          color: 'bg-indigo-100 text-indigo-600',
          growthRate: 3.8
        },
        {
          id: 'gaming',
          name: 'Gaming',
          icon: Gamepad2,
          shopCount: 98,
          isPopular: false,
          description: 'Video games, consoles, and accessories',
          color: 'bg-red-100 text-red-600',
          trending: true,
          growthRate: 28.5
        },
        {
          id: 'music',
          name: 'Music',
          icon: Music,
          shopCount: 67,
          isPopular: false,
          description: 'Musical instruments and equipment',
          color: 'bg-cyan-100 text-cyan-600',
          growthRate: 9.7
        },
        {
          id: 'fitness',
          name: 'Fitness',
          icon: Dumbbell,
          shopCount: 145,
          isPopular: false,
          description: 'Gym equipment and fitness gear',
          color: 'bg-lime-100 text-lime-600',
          growthRate: 14.2
        },
        {
          id: 'baby',
          name: 'Baby & Kids',
          icon: Baby,
          shopCount: 89,
          isPopular: false,
          description: 'Baby products and children\'s items',
          color: 'bg-yellow-100 text-yellow-600',
          growthRate: 11.3
        },
        {
          id: 'photography',
          name: 'Photography',
          icon: Camera,
          shopCount: 45,
          isPopular: false,
          description: 'Cameras, lenses, and photo services',
          color: 'bg-gray-100 text-gray-600',
          growthRate: 7.6
        }
      ];

      setCategories(mockCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredCategories = categories
    .filter(category => {
      const matchesSearch = category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          category.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPopular = !showPopularOnly || category.isPopular;
      return matchesSearch && matchesPopular;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'shops':
          return b.shopCount - a.shopCount;
        case 'popular':
        default:
          return (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0) || b.shopCount - a.shopCount;
      }
    });

  const handleCategoryClick = (categoryId: string) => {
    onCategorySelect?.(categoryId);
  };

  const formatShopCount = (count: number) => {
    if (count >= 1000) {
      return `${(count / 1000).toFixed(1)}k`;
    }
    return count.toString();
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-48 mb-6"></div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {[...Array(8)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">
              Shop Categories
            </h2>
            <Badge variant="default" className="bg-blue-100 text-blue-800">
              {categories.length} Categories
            </Badge>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search categories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
              <option value="popular">Most Popular</option>
              <option value="name">Name</option>
              <option value="shops">Most Shops</option>
            </Select>
            
            <Button
              variant={showPopularOnly ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowPopularOnly(!showPopularOnly)}
            >
              <Star className="w-4 h-4 mr-2" />
              Popular Only
            </Button>
          </div>
        </div>

        {/* Popular Categories */}
        {categories.filter(c => c.isPopular).length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500" />
              Popular Categories
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {categories
                .filter(category => category.isPopular)
                .slice(0, 8)
                .map((category) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    isSelected={selectedCategory === category.id}
                    onClick={() => handleCategoryClick(category.id)}
                  />
                ))}
            </div>
          </div>
        )}

        {/* All Categories */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            All Categories
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredCategories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                isSelected={selectedCategory === category.id}
                onClick={() => handleCategoryClick(category.id)}
              />
            ))}
          </div>
        </div>

        {/* No Results */}
        {filteredCategories.length === 0 && (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No categories found</h3>
            <p className="text-gray-600">
              Try adjusting your search or filters
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface CategoryCardProps {
  category: Category;
  isSelected: boolean;
  onClick: () => void;
}

function CategoryCard({ category, isSelected, onClick }: CategoryCardProps) {
  const Icon = category.icon;

  return (
    <div 
      className={cn(
        'cursor-pointer transition-all duration-200 hover:shadow-md hover:scale-105',
        isSelected && 'ring-2 ring-blue-500 shadow-md'
      )}
      onClick={onClick}
    >
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {/* Icon and Name */}
            <div className="flex items-center gap-3">
              <div className={cn('p-2 rounded-lg', category.color)}>
                <Icon className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 text-sm">
                  {category.name}
                </h4>
              </div>
            </div>

            {/* Description */}
            <p className="text-xs text-gray-600 line-clamp-2">
              {category.description}
            </p>

            {/* Stats */}
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1 text-gray-600">
                <MapPin className="w-3 h-3" />
                <span>{formatShopCount(category.shopCount)} shops</span>
              </div>
              
              {category.trending && (
                <div className="flex items-center gap-1 text-green-600">
                  <TrendingUp className="w-3 h-3" />
                  <span>+{category.growthRate}%</span>
                </div>
              )}
            </div>

            {/* Popular Badge */}
            {category.isPopular && (
              <Badge variant="default" className="text-xs w-fit">
                <Star className="w-3 h-3 mr-1" />
                Popular
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatShopCount(count: number) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}
