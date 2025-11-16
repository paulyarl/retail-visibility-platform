import { Metadata } from 'next';
import StoreTypeViewClient from './StoreTypeViewClient';

interface PageProps {
  params: Promise<{
    storeTypeSlug: string;
  }>;
  searchParams: Promise<{
    lat?: string;
    lng?: string;
    radius?: string;
    search?: string;
  }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const resolvedParams = await params;
  
  // Convert slug to title (capitalize words)
  const title = resolvedParams.storeTypeSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    title: `${title} | Store Directory`,
    description: `Browse ${title.toLowerCase()} in your area. Find local stores and discover their products.`,
  };
}

export default async function StoreTypePage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

  return (
    <StoreTypeViewClient
      storeTypeSlug={resolvedParams.storeTypeSlug}
      searchParams={resolvedSearchParams}
    />
  );
}
