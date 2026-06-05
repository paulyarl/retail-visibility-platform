export interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; search?: string; category?: string; products_only?: string; featured?: string; view?: string }>;
}

export interface ShopsPageClientProps {
  id: string;
  searchParams: { page?: string; search?: string; category?: string; products_only?: string; featured?: string; view?: string };
}
