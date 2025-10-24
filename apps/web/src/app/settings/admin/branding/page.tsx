'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Button, Input, Label, Textarea } from '@/components/ui';
import { useToast } from '@/components/ui/use-toast';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import Image from 'next/image';

const brandingSchema = z.object({
  platformName: z.string().min(1, 'Platform name is required'),
  platformDescription: z.string().optional(),
  logo: z.any().optional(),
  favicon: z.any().optional(),
});

type BrandingFormValues = z.infer<typeof brandingSchema>;

export default function BrandingSettings() {
  const { toast } = useToast();
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
      } catch (error) {
        console.error('Failed to load branding settings:', error);
        toast({
          title: 'Error',
          description: 'Failed to load branding settings',
          variant: 'destructive',
        });
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

      toast({
        title: 'Success',
        description: 'Branding settings updated successfully',
      });
    } catch (error) {
      console.error('Failed to update branding:', error);
      toast({
        title: 'Error',
        description: 'Failed to update branding settings',
        variant: 'destructive',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Branding</h2>
        <p className="text-muted-foreground">
          Customize your platform's branding including logo, name, and favicon
        </p>
      </div>

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
                        <div className="h-full w-full bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground text-xs">No logo</span>
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
                        className="cursor-pointer inline-flex items-center px-4 py-2 border border-input rounded-md text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        Change Logo
                      </Label>
                      <p className="mt-1 text-xs text-muted-foreground">
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
                        <div className="h-full w-full bg-muted flex items-center justify-center">
                          <span className="text-muted-foreground text-xs">No favicon</span>
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
                        className="cursor-pointer inline-flex items-center px-4 py-2 border border-input rounded-md text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
                      >
                        Change Favicon
                      </Label>
                      <p className="mt-1 text-xs text-muted-foreground">
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
  );
}
