import { redirect } from 'next/navigation';

// Skip prerendering for this redirect page
export const dynamic = 'force-dynamic';

export default function CartPage() {
  // Redirect to multi-cart overview page
  redirect('/carts');
}
