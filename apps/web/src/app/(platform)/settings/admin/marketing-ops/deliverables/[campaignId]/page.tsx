import { Metadata } from 'next';
import DeliverableWorkspaceClient from './DeliverableWorkspaceClient';

export const metadata: Metadata = {
  title: 'Deliverable Construction — Marketing Ops',
};

export default function DeliverablePage() {
  return <DeliverableWorkspaceClient />;
}
