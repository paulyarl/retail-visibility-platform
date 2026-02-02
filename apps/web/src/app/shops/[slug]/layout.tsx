/**
 * Shop Profile Layout
 * Provides consistent layout for shop profile pages
 */

import { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    default: 'Shop Profile',
    template: '%s | Shop Profile'
  },
  description: 'Discover amazing shops and products from our marketplace',
};

export default function ShopProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
