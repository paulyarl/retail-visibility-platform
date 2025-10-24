'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';
import PageHeader, { Icons } from '@/components/PageHeader';
import Protected from '@/components/Protected';

const brandingSchema = z.object({
  platformName: z.string().min(1, 'Platform name is required'),
  platformDescription: z.string().optional(),
  logo: z.any().optional(),
  favicon: z.any().optional(),
});

type BrandingFormValues = z.infer<typeof brandingSchema>;

export default function BrandingSettings() {
  const { toast, success, error: showError } = useToast();
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [faviconPreview, setFaviconPreview] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<BrandingFormValues>({
    resolver: zodResolver(brandingSchema),
    defaultValues: {
      platformName: '',
      platformDescription: '',
    },
  });

  // Load existing settings
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const res = await fetch('/api/admin/settings/branding');
        if (res.ok) {
          const data = await res.json();
          setValue('platformName', data.platformName || '');
          setValue('platformDescription', data.platformDescription || '');
          if (data.logoUrl) setLogoPreview(data.logoUrl);
          if (data.faviconUrl) setFaviconPreview(data.faviconUrl);
        }
      } catch (err) {
        console.error('Failed to load branding settings:', err);
        showError('Failed to load branding settings');
      } finally {
        setIsLoading(false);
      }
    };
    loadSettings();
  }, [setValue, toast]);

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setValue('logo', file);
    }
  };

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFaviconPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
      setValue('favicon', file);
    }
  };

  const onSubmit = async (data: BrandingFormValues) => {
    try {
      const formData = new FormData();
      formData.append('platformName', data.platformName);
      formData.append('platformDescription', data.platformDescription || '');
      if (data.logo) formData.append('logo', data.logo);
      if (data.favicon) formData.append('favicon', data.favicon);

      const res = await fetch('/api/admin/settings/branding', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) throw new Error('Failed to update branding');

      success('Branding settings updated successfully');
    } catch (err) {
      console.error('Failed to update branding:', err);
      showError('Failed to update branding settings');
    }
  };

  if (isLoading) {
    return (
      <Protected>
        <div className="min-h-screen bg-neutral-50">
          <PageHeader
            title="Platform Branding"
            description="Customize your platform's branding"
            icon={Icons.Settings}
          />
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
          </div>
        </div>
      </Protected>
    );
  }

  return (
    <Protected>
      <div className="min-h-screen bg-neutral-50">
        <PageHeader
          title="Platform Branding"
          description="Customize your platform's logo, name, and favicon"
          icon={Icons.Settings}
        />
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Card>
        <CardHeader>
          <CardTitle>Branding Settings</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="platformName">Platform Name</Label>
                <Input
                  id="platformName"
                  {...register('platformName')}
                  placeholder="Enter platform name"
                  className="mt-1"
                />
                {errors.platformName && (
                  <p className="mt-1 text-sm text-red-500">{errors.platformName.message}</p>
                )}
              </div>

              <div>
                <Label htmlFor="platformDescription">Platform Description</Label>
                <Textarea
                  id="platformDescription"
                  {...register('platformDescription')}
                  placeholder="Enter platform description"
                  className="mt-1 min-h-[100px]"
                />
              </div>

              <div className="space-y-4">
                <div>
                  <Label>Platform Logo</Label>
                  <div className="mt-2 flex items-center space-x-4">
                    <div className="h-16 w-16 rounded-md overflow-hidden border border-input">
                      {logoPreview ? (
                        <Image
                          src={logoPreview}
                          alt="Logo preview"
                          width={64}
                          height={64}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="h-full w-full bg-neutral-100 flex items-center justify-center">
                          <span className="text-neutral-500 text-xs">No logo</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <Input
                        id="logo"
                        type="file"
                        accept="image/*"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                      <Label
                        htmlFor="logo"
                        className="cursor-pointer inline-flex items-center px-4 py-2 border border-neutral-300 rounded-md text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
                      >
                        Change Logo
                      </Label>
                      <p className="mt-1 text-xs text-neutral-500">
                        Recommended size: 200x50px, SVG or PNG
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Favicon</Label>
                  <div className="mt-2 flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-md overflow-hidden border border-input">
                      {faviconPreview ? (
                        <Image
                          src={faviconPreview}
                          alt="Favicon preview"
                          width={32}
                          height={32}
                          className="h-full w-full object-contain"
                        />
                      ) : (
                        <div className="h-full w-full bg-neutral-100 flex items-center justify-center">
                          <span className="text-neutral-500 text-xs">No favicon</span>
                        </div>
                      )}
                    </div>
                    <div>
                      <Input
                        id="favicon"
                        type="file"
                        accept="image/x-icon,image/png"
                        onChange={handleFaviconChange}
                        className="hidden"
                      />
                      <Label
                        htmlFor="favicon"
                        className="cursor-pointer inline-flex items-center px-4 py-2 border border-neutral-300 rounded-md text-sm font-medium text-neutral-700 shadow-sm hover:bg-neutral-50"
                      >
                        Change Favicon
                      </Label>
                      <p className="mt-1 text-xs text-neutral-500">
                        Recommended size: 32x32px, ICO or PNG
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
        </div>
      </div>
    </Protected>
  );
}
