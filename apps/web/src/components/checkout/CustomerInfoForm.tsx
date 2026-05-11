'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@mantine/core';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/Form';
import { Input } from '@/components/ui/Input';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import customerAddressesService, { CustomerAddress } from '@/services/CustomerAddressesService';
import { LogIn, User, MapPin, Check } from 'lucide-react';

type CustomerInfoFormData = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
};

interface CustomerInfoFormProps {
  initialData?: CustomerInfoFormData | null;
  onSubmit: (data: CustomerInfoFormData, customerId?: string, selectedAddressId?: string) => void;
}

export function CustomerInfoForm({ initialData, onSubmit }: CustomerInfoFormProps) {
  const { customer, isAuthenticated, isLoading: authLoading, login, register } = useCustomerAuth();
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLoginForm, setShowLoginForm] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(false);
  
  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  // Register form state
  const [registerData, setRegisterData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: '',
  });
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  const form = useForm<CustomerInfoFormData>({
    defaultValues: initialData || {
      email: customer?.email || '',
      firstName: customer?.firstName || '',
      lastName: customer?.lastName || '',
      phone: customer?.phone || '',
    },
  });

  // Update form when customer changes
  useEffect(() => {
    if (customer) {
      form.reset({
        email: customer.email,
        firstName: customer.firstName || '',
        lastName: customer.lastName || '',
        phone: customer.phone || '',
      });
    }
  }, [customer, form]);

  // Load addresses when authenticated
  useEffect(() => {
    if (isAuthenticated && customer) {
      loadAddresses();
    }
  }, [isAuthenticated, customer]);

  const loadAddresses = async () => {
    setIsLoadingAddresses(true);
    try {
      const result = await customerAddressesService.listAddresses();
      if (result.success && result.addresses) {
        setAddresses(result.addresses);
        // Select default address
        const defaultAddr = result.addresses.find(a => a.isDefault) || result.addresses[0];
        if (defaultAddr) {
          setSelectedAddressId(defaultAddr.id);
        }
      }
    } catch (error) {
      console.error('[CustomerInfoForm] Failed to load addresses:', error);
    } finally {
      setIsLoadingAddresses(false);
    }
  };

  const handleSubmit = async (data: CustomerInfoFormData) => {
    setIsSubmitting(true);
    try {
      onSubmit(data, customer?.id, selectedAddressId || undefined);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setIsLoggingIn(true);

    try {
      const result = await login(loginEmail, loginPassword);
      if (!result.success) {
        setLoginError(result.error || 'Login failed');
      } else {
        setShowLoginForm(false);
      }
    } catch (err: any) {
      setLoginError(err.message || 'Login failed');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setRegisterError(null);

    if (registerData.password !== registerData.confirmPassword) {
      setRegisterError('Passwords do not match');
      return;
    }

    if (registerData.password.length < 8) {
      setRegisterError('Password must be at least 8 characters');
      return;
    }

    setIsRegistering(true);

    try {
      const result = await register(
        registerData.email,
        registerData.password,
        registerData.firstName,
        registerData.lastName
      );
      if (!result.success) {
        setRegisterError(result.error || 'Registration failed');
      } else {
        setShowRegisterForm(false);
      }
    } catch (err: any) {
      setRegisterError(err.message || 'Registration failed');
    } finally {
      setIsRegistering(false);
    }
  };

  // Show loading state
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show logged-in customer view
  if (isAuthenticated && customer) {
    return (
      <div className="space-y-6">
        {/* Customer Info Summary */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-700 mb-2">
            <User className="h-5 w-5" />
            <span className="font-medium">Welcome back, {customer.firstName || customer.email}!</span>
          </div>
          <p className="text-sm text-green-600">
            {customer.email}
            {customer.phone && ` • ${customer.phone}`}
          </p>
        </div>

        {/* Saved Addresses */}
        {isLoadingAddresses ? (
          <div className="flex items-center justify-center py-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        ) : addresses.length > 0 ? (
          <div className="space-y-3">
            <h3 className="font-medium text-gray-900 flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Shipping Address
            </h3>
            <div className="space-y-2">
              {addresses.map((address) => (
                <div
                  key={address.id}
                  onClick={() => setSelectedAddressId(address.id)}
                  className={`border rounded-lg p-3 cursor-pointer transition-all ${
                    selectedAddressId === address.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2">
                      {selectedAddressId === address.id && (
                        <Check className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                      )}
                      <div>
                        {address.label && (
                          <span className="text-xs font-medium text-blue-600 uppercase tracking-wide">
                            {address.label}
                          </span>
                        )}
                        <p className="font-medium text-gray-900">
                          {address.recipientName || `${customer.firstName} ${customer.lastName}`}
                        </p>
                        <p className="text-sm text-gray-600">
                          {address.addressLine1}
                          {address.addressLine2 && `, ${address.addressLine2}`}
                        </p>
                        <p className="text-sm text-gray-600">
                          {address.city}, {address.state} {address.postalCode}
                        </p>
                        {address.phone && (
                          <p className="text-sm text-gray-500">{address.phone}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Continue Button */}
        <Button
          onClick={() => form.handleSubmit(handleSubmit)()}
          className="w-full"
          style={{ color: 'white', animation: 'step-start 0s' }}
          variant="gradient"
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Processing...' : 'Continue to Shipping'}
        </Button>
      </div>
    );
  }

  // Show login/register forms
  if (showLoginForm) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Log in to your account</h3>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="your@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <Input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          
          {loginError && (
            <p className="text-sm text-red-600">{loginError}</p>
          )}
          
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowLoginForm(false)}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="submit"
              className="flex-1"
              style={{ color: 'white' }}
              variant="gradient"
              disabled={isLoggingIn}
            >
              {isLoggingIn ? 'Logging in...' : 'Log in'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  if (showRegisterForm) {
    return (
      <div className="space-y-4">
        <h3 className="font-medium text-gray-900">Create an account</h3>
        
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
              <Input
                value={registerData.firstName}
                onChange={(e) => setRegisterData({ ...registerData, firstName: e.target.value })}
                placeholder="John"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
              <Input
                value={registerData.lastName}
                onChange={(e) => setRegisterData({ ...registerData, lastName: e.target.value })}
                placeholder="Doe"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <Input
              type="email"
              value={registerData.email}
              onChange={(e) => setRegisterData({ ...registerData, email: e.target.value })}
              placeholder="your@email.com"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password (min 8 characters)</label>
            <Input
              type="password"
              value={registerData.password}
              onChange={(e) => setRegisterData({ ...registerData, password: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <Input
              type="password"
              value={registerData.confirmPassword}
              onChange={(e) => setRegisterData({ ...registerData, confirmPassword: e.target.value })}
              placeholder="••••••••"
              required
            />
          </div>
          
          {registerError && (
            <p className="text-sm text-red-600">{registerError}</p>
          )}
          
          <div className="flex gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowRegisterForm(false)}
              className="flex-1"
            >
              Back
            </Button>
            <Button
              type="submit"
              className="flex-1"
              style={{ color: 'white' }}
              variant="gradient"
              disabled={isRegistering}
            >
              {isRegistering ? 'Creating account...' : 'Create account'}
            </Button>
          </div>
        </form>
      </div>
    );
  }

  // Show guest checkout form with login option
  return (
    <div className="space-y-6">
      {/* Login/Register Option */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-blue-700">
            <LogIn className="h-5 w-5" />
            <span className="text-sm">Have an account?</span>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="xs"
              onClick={() => setShowLoginForm(true)}
            >
              Log in
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => setShowRegisterForm(true)}
            >
              Sign up
            </Button>
          </div>
        </div>
      </div>

      {/* Guest Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>First Name</FormLabel>
                  <FormControl>
                    <Input placeholder="John" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Last Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="john.doe@example.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input type="tel" placeholder="(555) 123-4567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}
            style={{ color: 'white', animation: 'step-start 0s' }}
            variant="gradient">
            {isSubmitting ? 'Processing...' : 'Continue to Shipping'}
          </Button>
        </form>
      </Form>
    </div>
  );
}
