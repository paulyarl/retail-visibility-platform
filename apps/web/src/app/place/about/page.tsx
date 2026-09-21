import { Metadata } from 'next';
import PlaceAboutClient from './PlaceAboutClient';

export const metadata: Metadata = {
  title: 'Make Your Physical Shelves Visible | VisibleShelf for Retailers',
  description:
    'Claim your free store listing, put your in-stock inventory in front of nearby shoppers, and turn local search into walk-in foot traffic. Zero delivery logistics, zero commissions.',
};

export default function PlaceAboutPage() {
  return <PlaceAboutClient />;
}
