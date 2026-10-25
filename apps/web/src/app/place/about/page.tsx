import { Metadata } from 'next';
import PlaceAboutClient from './PlaceAboutClient';

export const metadata: Metadata = {
  // The root layout appends "| VisibleShelf" via title.template — never bake
  // the brand into a page title or it renders twice.
  title: 'Make your physical shelves visible',
  description:
    'Claim your free store listing, put your in-stock inventory in front of nearby shoppers, and turn local search into walk-in foot traffic. Zero delivery logistics, zero commissions.',
};

export default function PlaceAboutPage() {
  return <PlaceAboutClient />;
}
