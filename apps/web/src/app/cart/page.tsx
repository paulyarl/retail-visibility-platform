import { redirect } from 'next/navigation';

export default function CartPage() {
  // Redirect to multi-cart overview page
  redirect('/carts');
}
