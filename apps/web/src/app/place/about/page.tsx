import { Metadata } from 'next';
import PlaceAboutClient from './PlaceAboutClient';

export const metadata: Metadata = {
  title: 'For Business Owners | VisibleShelf',
  description: 'Claim your free directory listing and unlock tools to manage your online presence, list products, and reach more customers.',
};

export default function PlaceAboutPage() {
  return <PlaceAboutClient />;
}
