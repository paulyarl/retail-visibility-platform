/**
 * Preferences Manager
 * Phase 2: User preferences management interface
 */

'use client';

import { useState, useMemo } from 'react';
import { useGDPR } from '@/hooks/useGDPR';
import { UserPreference, PreferenceCategory } from '@/types/security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PreferenceCategory as PreferenceCategoryComponent } from './PreferenceCategory';
import { PreferenceBackup } from './PreferenceBackup';
import { Settings, Search, Download, Upload } from 'lucide-react';

export function PreferencesManager() {
  const { preferences, updatePreference, loading } = useGDPR();
  const [searchQuery, setSearchQuery] = useState('');
  const [showBackup, setShowBackup] = useState(false);

  const groupedPreferences = useMemo(() => {
    const groups: Record<string, PreferenceCategory> = {};

    preferences.forEach((pref) => {
      if (!groups[pref.category]) {
        groups[pref.category] = {
          name: pref.category,
          description: `${pref.category} preferences`,
          preferences: [],
        };
      }
      groups[pref.category].preferences.push(pref);
    });

    return Object.values(groups);
  }, [preferences]);

  const filteredCategories = useMemo(() => {
    if (!searchQuery) return groupedPreferences;

    return groupedPreferences
      .map(category => ({
        ...category,
        preferences: category.preferences.filter(pref =>
          pref.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          pref.description.toLowerCase().includes(searchQuery.toLowerCase())
        ),
      }))
      .filter(category => category.preferences.length > 0);
  }, [groupedPreferences, searchQuery]);

  const handlePreferenceChange = async (key: string, value: any) => {
    try {
      await updatePreference({ key, value });
    } catch (error) {
      console.error('Failed to update preference:', error);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-32 bg-muted animate-pulse rounded-lg" />
        <div className="h-64 bg-muted animate-pulse rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
          <Settings className="h-8 w-8" />
          User Preferences
        </h2>
        <p className="text-muted-foreground mt-2">
          Customize your experience and manage your preferences
        </p>
      </div>

      <div className="flex gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search preferences..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Button
          variant={showBackup ? 'secondary' : 'ghost'}
          onClick={() => setShowBackup(!showBackup)}
        >
          {showBackup ? <Upload className="h-4 w-4 mr-2" /> : <Download className="h-4 w-4 mr-2" />}
          {showBackup ? 'Hide Backup' : 'Backup'}
        </Button>
      </div>

      {showBackup ? (
        <PreferenceBackup />
      ) : (
        <div className="space-y-6">
          {filteredCategories.map((category) => (
            <PreferenceCategoryComponent
              key={category.name}
              category={category}
              onChange={handlePreferenceChange}
            />
          ))}

          {filteredCategories.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>
                  {searchQuery
                    ? `No preferences found matching "${searchQuery}"`
                    : 'No preferences found'}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
