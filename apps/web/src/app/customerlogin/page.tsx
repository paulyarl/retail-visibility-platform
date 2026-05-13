'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { usePlatformSettings } from '@/contexts/PlatformSettingsContext';
import { LogIn, UserPlus, Mail, Lock, User } from 'lucide-react';

export default function CustomerLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, register, isAuthenticated, isLoading: authLoading } = useCustomerAuth();
  const { settings } = usePlatformSettings();

  const redirect = searchParams?.get('redirect') || '/account';
  const [isLogin, setIsLogin] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Login form
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Register form
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regFirstName, setRegFirstName] = useState('');
  const [regLastName, setRegLastName] = useState('');

  // Redirect if already authenticated
  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      router.push(redirect);
    }
  }, [authLoading, isAuthenticated, redirect, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await login(email, password);
      if (result.success) {
        router.push(redirect);
      } else {
        setError(result.error || 'Invalid email or password');
      }
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (regPassword.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setIsSubmitting(true);

    try {
      const result = await register(regEmail, regPassword, regFirstName, regLastName);
      if (result.success) {
        router.push(redirect);
      } else {
        setError(result.error || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="text-2xl font-bold text-gray-900">
            {settings?.platformName || 'VisibleShelf'}
          </Link>
          <p className="text-gray-600 mt-2">Customer Account</p>
        </div>

        <Card>
          <CardHeader>
            <div className="flex border-b border-gray-200">
              <button
                onClick={() => { setIsLogin(true); setError(null); }}
                className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
                  isLogin
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <LogIn className="w-4 h-4 inline mr-1" />
                Sign In
              </button>
              <button
                onClick={() => { setIsLogin(false); setError(null); }}
                className={`flex-1 py-3 text-sm font-medium text-center transition-colors ${
                  !isLogin
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                <UserPlus className="w-4 h-4 inline mr-1" />
                Create Account
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            {isLogin ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Signing in...' : 'Sign In'}
                </Button>
                <p className="text-sm text-center text-gray-500">
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setIsLogin(false); setError(null); }}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Create one
                  </button>
                </p>
              </form>
            ) : (
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        value={regFirstName}
                        onChange={(e) => setRegFirstName(e.target.value)}
                        placeholder="John"
                        className="pl-10"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                    <Input
                      value={regLastName}
                      onChange={(e) => setRegLastName(e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password (min 8 characters)</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating Account...' : 'Create Account'}
                </Button>
                <p className="text-sm text-center text-gray-500">
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => { setIsLogin(true); setError(null); }}
                    className="text-blue-600 hover:underline font-medium"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-center text-gray-400 mt-6">
          This is a customer account. For merchant/tenant access,{' '}
          <a href="/auth/login" className="text-blue-500 hover:underline">sign in here</a>.
        </p>
      </div>
    </div>
  );
}
