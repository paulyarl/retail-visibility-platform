// ============================================================================
// PHASE 3: DIRECTORY NAVIGATION AND ROUTING
// ============================================================================

import DirectoryHomepage from './PHASE_3_DIRECTORY_HOMEPAGE';
import CategoriesPage from './PHASE_3_CATEGORIES_PAGE';
import CategoryDetailPage from './PHASE_3_CATEGORY_DETAIL';
import SearchPage from './PHASE_3_SEARCH_PAGE';
import StoreDetailPage from './PHASE_3_STORE_DETAIL';

import React from 'react';

// Navigation Component for Directory
export const DirectoryNavigation: React.FC = () => {
  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-8">
            <a href="/directory" className="text-xl font-bold text-blue-600">
              Directory
            </a>
            
            <div className="hidden md:flex items-center gap-6">
              <a 
                href="/directory" 
                className="text-gray-700 hover:text-blue-600 transition-colors font-medium"
              >
                Home
              </a>
              <a 
                href="/directory/categories" 
                className="text-gray-700 hover:text-blue-600 transition-colors font-medium"
              >
                Categories
              </a>
              <a 
                href="/directory/stores" 
                className="text-gray-700 hover:text-blue-600 transition-colors font-medium"
              >
                Stores
              </a>
              <a 
                href="/directory/search" 
                className="text-gray-700 hover:text-blue-600 transition-colors font-medium"
              >
                Search
              </a>
            </div>
          </div>
          
          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  );
};

// Breadcrumb Component
interface BreadcrumbItem {
  label: string;
  href?: string;
}

export const DirectoryBreadcrumb: React.FC<{ items: BreadcrumbItem[] }> = ({ items }) => {
  return (
    <div className="bg-gray-50 border-b">
      <div className="container mx-auto px-4 py-3">
        <nav className="flex items-center gap-2 text-sm">
          <a href="/directory" className="text-blue-600 hover:text-blue-700">
            Directory
          </a>
          {items.map((item, index) => (
            <React.Fragment key={index}>
              <span className="text-gray-400">/</span>
              {item.href ? (
                <a href={item.href} className="text-blue-600 hover:text-blue-700">
                  {item.label}
                </a>
              ) : (
                <span className="text-gray-700 font-medium">{item.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>
    </div>
  );
};

// Directory Layout Component
export const DirectoryLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <DirectoryNavigation />
      {children}
      
      {/* Footer */}
      <footer className="bg-gray-900 text-white mt-16">
        <div className="container mx-auto px-4 py-12">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-semibold mb-4">Directory</h3>
              <p className="text-gray-400 text-sm">
                Discover local stores and products in your area.
              </p>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Browse</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/directory" className="hover:text-white">Home</a></li>
                <li><a href="/directory/categories" className="hover:text-white">Categories</a></li>
                <li><a href="/directory/stores" className="hover:text-white">Stores</a></li>
                <li><a href="/directory/search" className="hover:text-white">Search</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Popular Categories</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="/directory/categories/books-media" className="hover:text-white">Books & Media</a></li>
                <li><a href="/directory/categories/sports-outdoors" className="hover:text-white">Sports & Outdoors</a></li>
                <li><a href="/directory/categories/health-beauty" className="hover:text-white">Health & Beauty</a></li>
                <li><a href="/directory/categories/toys-games" className="hover:text-white">Toys & Games</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-medium mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-gray-400">
                <li><a href="#" className="hover:text-white">Help Center</a></li>
                <li><a href="#" className="hover:text-white">Contact Us</a></li>
                <li><a href="#" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="#" className="hover:text-white">Terms of Service</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400">
            <p>&copy; 2024 Retail Visibility Platform. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

// Directory Page Wrapper with Breadcrumbs
export const DirectoryPageWrapper: React.FC<{
  children: React.ReactNode;
  breadcrumbs?: BreadcrumbItem[];
}> = ({ children, breadcrumbs = [] }) => {
  return (
    <DirectoryLayout>
      {breadcrumbs.length > 0 && <DirectoryBreadcrumb items={breadcrumbs} />}
      {children}
    </DirectoryLayout>
  );
};

// ============================================================================
// NEXT.JS APP ROUTER PAGES
// ============================================================================

// app/directory/page.tsx
export function DirectoryHomePage() {
  return (
    <DirectoryPageWrapper>
      <DirectoryHomepage />
    </DirectoryPageWrapper>
  );
}

// app/directory/categories/page.tsx
export function CategoriesPageWrapper() {
  return (
    <DirectoryPageWrapper 
      breadcrumbs={[{ label: 'Categories' }]}
    >
      <CategoriesPage />
    </DirectoryPageWrapper>
  );
}

// app/directory/categories/[slug]/page.tsx
export function CategoryDetailPageWrapper() {
  return (
    <DirectoryPageWrapper 
      breadcrumbs={[
        { label: 'Categories', href: '/directory/categories' },
        { label: 'Category Details' }
      ]}
    >
      <CategoryDetailPage />
    </DirectoryPageWrapper>
  );
}

// app/directory/search/page.tsx
export function SearchPageWrapper() {
  return (
    <DirectoryPageWrapper 
      breadcrumbs={[{ label: 'Search' }]}
    >
      <SearchPage />
    </DirectoryPageWrapper>
  );
}

// app/directory/stores/[id]/page.tsx
export function StoreDetailPageWrapper() {
  return (
    <DirectoryPageWrapper 
      breadcrumbs={[
        { label: 'Stores', href: '/directory/stores' },
        { label: 'Store Details' }
      ]}
    >
      <StoreDetailPage />
    </DirectoryPageWrapper>
  );
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

// Format price in dollars
export const formatPrice = (priceCents: number): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(priceCents / 100);
};

// Format rating with stars
export const formatRating = (rating: number, count: number): string => {
  if (count === 0) return 'No reviews';
  return `${rating.toFixed(1)} (${count} ${count === 1 ? 'review' : 'reviews'})`;
};

// Generate star rating display
export const StarRating: React.FC<{ rating: number; size?: 'sm' | 'md' | 'lg' }> = ({ 
  rating, 
  size = 'sm' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  };

  return (
    <div className="flex">
      {[...Array(5)].map((_, i) => (
        <svg
          key={i}
          className={`${sizeClasses[size]} ${
            i < Math.floor(rating)
              ? 'text-yellow-400 fill-current'
              : 'text-gray-300'
          }`}
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
};

// Loading Spinner Component
export const LoadingSpinner: React.FC<{ size?: 'sm' | 'md' | 'lg' }> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12'
  };

  return (
    <div className={`animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]}`}></div>
  );
};

// Empty State Component
export const EmptyState: React.FC<{
  icon: string;
  title: string;
  description: string;
  action?: {
    label: string;
    href: string;
  };
}> = ({ icon, title, description, action }) => {
  return (
    <div className="text-center py-12">
      <div className="text-gray-400 text-6xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
      <p className="text-gray-600 mb-6">{description}</p>
      {action && (
        <a
          href={action.href}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
        >
          {action.label}
        </a>
      )}
    </div>
  );
};

// ============================================================================
// ROUTE CONFIGURATION
// ============================================================================

export const directoryRoutes = [
  {
    path: '/directory',
    component: DirectoryHomePage,
    title: 'Directory - Discover Local Stores'
  },
  {
    path: '/directory/categories',
    component: CategoriesPageWrapper,
    title: 'Browse Categories - Directory'
  },
  {
    path: '/directory/categories/:slug',
    component: CategoryDetailPageWrapper,
    title: 'Category Details - Directory'
  },
  {
    path: '/directory/search',
    component: SearchPageWrapper,
    title: 'Search Directory'
  },
  {
    path: '/directory/stores/:id',
    component: StoreDetailPageWrapper,
    title: 'Store Details - Directory'
  }
];

export default DirectoryNavigation;
