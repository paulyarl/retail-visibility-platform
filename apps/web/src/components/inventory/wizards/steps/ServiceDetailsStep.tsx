/**
 * Service Details Step
 *
 * Service-specific configuration shown within Step 2 when product type is 'service'.
 * Captures booking method, duration, service area, and pricing model metadata.
 * Metadata is stored in product.metadata and rendered by ServiceBookingCTA,
 * ServiceDurationInfo, and ServiceAreaInfo on public product pages.
 */

'use client';

import { Calendar, Clock, MapPin, DollarSign, Phone, Link as LinkIcon, Store, MessageSquare } from 'lucide-react';

import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Separator } from '@/components/ui/Separator';
import { Textarea } from '@/components/ui/Textarea';

interface ServiceProductData {
  bookingMethod: 'external_url' | 'phone' | 'in_store' | 'contact_only';
  bookingUrl?: string;
  bookingPhone?: string;
  durationMinutes?: number | null;
  sessionLength?: string;
  availabilitySchedule?: string;
  serviceLocation: 'on_site' | 'remote' | 'customer_location';
  serviceArea?: string;
  travelRadius?: number | null;
  pricingModel: 'per_session' | 'per_hour' | 'fixed' | 'deposit';
  depositAmount?: number | null;
  requiresDeposit: boolean;
}

interface ServiceDetailsStepProps {
  data: ServiceProductData;
  errors: Record<string, string>;
  onChange: (data: ServiceProductData) => void;
}

const BOOKING_METHODS = [
  { value: 'external_url', label: 'External Booking URL', icon: LinkIcon, description: 'Redirect customers to an external booking page' },
  { value: 'phone', label: 'Phone Booking', icon: Phone, description: 'Customers call to schedule the service' },
  { value: 'in_store', label: 'In-Store Booking', icon: Store, description: 'Customers visit your location to book' },
  { value: 'contact_only', label: 'Contact Only', icon: MessageSquare, description: 'No online booking — contact for details' },
] as const;

const SERVICE_LOCATIONS = [
  { value: 'on_site', label: 'On-Site', description: 'Service performed at your location' },
  { value: 'remote', label: 'Remote', description: 'Service delivered online/remotely' },
  { value: 'customer_location', label: 'Customer Location', description: 'You travel to the customer' },
] as const;

const PRICING_MODELS = [
  { value: 'fixed', label: 'Fixed Price', description: 'One flat price for the service' },
  { value: 'per_session', label: 'Per Session', description: 'Price per individual session' },
  { value: 'per_hour', label: 'Per Hour', description: 'Hourly rate pricing' },
  { value: 'deposit', label: 'Deposit Required', description: 'Customers pay a deposit upfront' },
] as const;

export default function ServiceDetailsStep({ data, errors, onChange }: ServiceDetailsStepProps) {
  const update = (field: keyof ServiceProductData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  return (
    <div className="space-y-6">
      {/* Booking Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-blue-600" />
            Booking Configuration
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Booking Method */}
          <div>
            <Label className="mb-2 block">Booking Method</Label>
            <div className="grid grid-cols-2 gap-3">
              {BOOKING_METHODS.map((method) => {
                const Icon = method.icon;
                const isSelected = data.bookingMethod === method.value;
                return (
                  <button
                    key={method.value}
                    type="button"
                    onClick={() => update('bookingMethod', method.value)}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`w-5 h-5 mt-0.5 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                    <div>
                      <p className={`text-sm font-medium ${isSelected ? 'text-blue-900' : 'text-gray-700'}`}>
                        {method.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{method.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conditional booking fields */}
          {data.bookingMethod === 'external_url' && (
            <div>
              <Label htmlFor="bookingUrl">Booking URL</Label>
              <Input
                id="bookingUrl"
                type="url"
                placeholder="https://book.example.com/service"
                value={data.bookingUrl || ''}
                onChange={(e) => update('bookingUrl', e.target.value)}
              />
              {errors.bookingUrl && <p className="text-sm text-red-500 mt-1">{errors.bookingUrl}</p>}
            </div>
          )}

          {data.bookingMethod === 'phone' && (
            <div>
              <Label htmlFor="bookingPhone">Booking Phone Number</Label>
              <Input
                id="bookingPhone"
                type="tel"
                placeholder="+1 (555) 123-4567"
                value={data.bookingPhone || ''}
                onChange={(e) => update('bookingPhone', e.target.value)}
              />
              {errors.bookingPhone && <p className="text-sm text-red-500 mt-1">{errors.bookingPhone}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duration & Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-green-600" />
            Duration & Availability
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="durationMinutes">Duration (minutes)</Label>
              <Input
                id="durationMinutes"
                type="number"
                min={0}
                placeholder="e.g. 60"
                value={data.durationMinutes ?? ''}
                onChange={(e) => update('durationMinutes', e.target.value ? Number(e.target.value) : null)}
              />
              <p className="text-xs text-gray-500 mt-1">How long each session takes</p>
            </div>
            <div>
              <Label htmlFor="sessionLength">Session Length Description</Label>
              <Input
                id="sessionLength"
                type="text"
                placeholder="e.g. 1 hour, Half day"
                value={data.sessionLength || ''}
                onChange={(e) => update('sessionLength', e.target.value)}
              />
              <p className="text-xs text-gray-500 mt-1">Human-readable session length</p>
            </div>
          </div>
          <div>
            <Label htmlFor="availabilitySchedule">Availability Schedule</Label>
            <Textarea
              id="availabilitySchedule"
              placeholder="e.g. Mon-Fri 9am-5pm, Saturdays by appointment"
              value={data.availabilitySchedule || ''}
              onChange={(e) => update('availabilitySchedule', e.target.value)}
              rows={2}
            />
            <p className="text-xs text-gray-500 mt-1">When this service is available</p>
          </div>
        </CardContent>
      </Card>

      {/* Service Location & Area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="w-5 h-5 text-purple-600" />
            Service Location & Area
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">Service Location</Label>
            <div className="grid grid-cols-3 gap-3">
              {SERVICE_LOCATIONS.map((loc) => {
                const isSelected = data.serviceLocation === loc.value;
                return (
                  <button
                    key={loc.value}
                    type="button"
                    onClick={() => update('serviceLocation', loc.value)}
                    className={`p-3 rounded-lg border-2 text-center transition-colors ${
                      isSelected
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className={`text-sm font-medium ${isSelected ? 'text-purple-900' : 'text-gray-700'}`}>
                      {loc.label}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{loc.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {data.serviceLocation === 'customer_location' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="serviceArea">Service Area</Label>
                <Input
                  id="serviceArea"
                  type="text"
                  placeholder="e.g. Greater Boston Area"
                  value={data.serviceArea || ''}
                  onChange={(e) => update('serviceArea', e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="travelRadius">Travel Radius (miles)</Label>
                <Input
                  id="travelRadius"
                  type="number"
                  min={0}
                  placeholder="e.g. 25"
                  value={data.travelRadius ?? ''}
                  onChange={(e) => update('travelRadius', e.target.value ? Number(e.target.value) : null)}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pricing Model */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-amber-600" />
            Pricing Model
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="mb-2 block">How is this service priced?</Label>
            <div className="grid grid-cols-2 gap-3">
              {PRICING_MODELS.map((model) => {
                const isSelected = data.pricingModel === model.value;
                return (
                  <button
                    key={model.value}
                    type="button"
                    onClick={() => {
                      update('pricingModel', model.value);
                      if (model.value !== 'deposit') {
                        update('requiresDeposit', false);
                      }
                    }}
                    className={`flex items-start gap-3 p-3 rounded-lg border-2 text-left transition-colors ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <p className={`text-sm font-medium ${isSelected ? 'text-amber-900' : 'text-gray-700'}`}>
                        {model.label}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">{model.description}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {data.pricingModel === 'deposit' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="depositAmount">Deposit Amount ($)</Label>
                <Input
                  id="depositAmount"
                  type="number"
                  min={0}
                  step="1"
                  placeholder="e.g. 50.00"
                  value={data.depositAmount ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : null;
                    update('depositAmount', val);
                    update('requiresDeposit', val !== null && val > 0);
                  }}
                />
              </div>
              <div className="flex items-end">
                <Badge variant={data.requiresDeposit ? 'default' : 'outline'}>
                  {data.requiresDeposit ? 'Deposit Required' : 'No Deposit'}
                </Badge>
              </div>
            </div>
          )}

          <Separator />

          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Calendar className="w-4 h-4" />
            <span>
              Final price is set in the Pricing step. The pricing model here determines how it's displayed to customers.
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
