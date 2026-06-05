/**
 * Capability Management Page
 * 
 * Admin page wrapper for the capability management interface
 */

import React from 'react';
import CapabilityManagement from '../components/CapabilityManagement';

export default function CapabilityManagementPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <CapabilityManagement />
    </div>
  );
}
