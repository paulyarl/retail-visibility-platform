import { Metadata } from 'next';
import StoreTypeViewClient from './StoreTypeViewClient';

interface PageProps {
  params: {
    storeTypeSlug: string;
  };
  searchParams: {
    lat?: string;
    lng?: string;
    radius?: string;
    search?: string;
  };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  // Convert slug to title (capitalize words)
  const title = params.storeTypeSlug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');

  return {
    title: `${title} | Store Directory`,
    description: `Browse ${title.toLowerCase()} in your area. Find local stores and discover their products.`,
  };
}

export default function StoreTypePage({ params, searchParams }: PageProps) {
  return (
    <StoreTypeViewClient
      storeTypeSlug={params.storeTypeSlug}
      searchParams={searchParams}
    />
  );
}
