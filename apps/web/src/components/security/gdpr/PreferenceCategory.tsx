/**
 * Preference Category
 * Phase 2: Grouped preferences display
 */

'use client';

import { useState } from 'react';
import { PreferenceCategory as PreferenceCategoryType } from '@/types/security';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PreferenceEditor } from './PreferenceEditor';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface PreferenceCategoryProps {
  category: PreferenceCategoryType;
  onChange: (key: string, value: any) => Promise<void>;
}

export function PreferenceCategory({ category, onChange }: PreferenceCategoryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>{category.name}</CardTitle>
            <CardDescription>{category.description}</CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-4">
          {category.preferences.map((preference) => (
            <PreferenceEditor
              key={preference.key}
              preference={preference}
              onChange={onChange}
            />
          ))}
        </CardContent>
      )}
    </Card>
  );
}
