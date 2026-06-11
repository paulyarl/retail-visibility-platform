'use client';

import { SearchableSelect } from '@/components/ui/SearchableSelect';

export const CARRIER_OPTIONS = [
  { value: 'usps', label: 'USPS' },
  { value: 'ups', label: 'UPS' },
  { value: 'fedex', label: 'FedEx' },
  { value: 'dhl', label: 'DHL' },
  { value: 'amazon', label: 'Amazon Logistics' },
  { value: 'ontrac', label: 'OnTrac' },
  { value: 'lasership', label: 'LaserShip' },
];

interface CarrierSelectProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  disabled?: boolean;
}

export function CarrierSelect({
  value,
  onChange,
  placeholder = 'Select carrier...',
  label = 'Carrier',
  disabled = false,
}: CarrierSelectProps) {
  return (
    <SearchableSelect
      options={CARRIER_OPTIONS}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      label={label}
      disabled={disabled}
    />
  );
}
