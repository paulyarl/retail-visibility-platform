/**
 * Preference Editor
 * Phase 2: Individual preference editing
 */

'use client';

import { useState } from 'react';
import { UserPreference } from '@/types/security';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import { Select } from '@/components/ui/Select';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { Check } from 'lucide-react';
import { format } from 'date-fns';

interface PreferenceEditorProps {
  preference: UserPreference;
  onChange: (key: string, value: any) => Promise<void>;
}

export function PreferenceEditor({ preference, onChange }: PreferenceEditorProps) {
  const [value, setValue] = useState(preference.value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (value === preference.value) return;

    try {
      setSaving(true);
      await onChange(preference.key, value);
    } catch (error) {
      console.error('Failed to save preference:', error);
      setValue(preference.value);
    } finally {
      setSaving(false);
    }
  };

  const renderInput = () => {
    switch (preference.type) {
      case 'boolean':
        return (
          <Switch
            checked={value as boolean}
            onCheckedChange={(checked: boolean) => {
              setValue(checked);
              onChange(preference.key, checked);
            }}
          />
        );

      case 'select':
        return (
          <Select
            value={value as string}
            onChange={(e) => {
              const newValue = e.target.value;
              setValue(newValue);
              onChange(preference.key, newValue);
            }}
          >
            {preference.options?.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </Select>
        );

      case 'number':
        return (
          <div className="flex gap-2">
            <Input
              type="number"
              value={value as number}
              onChange={(e) => setValue(Number(e.target.value))}
              onBlur={handleSave}
            />
            {value !== preference.value && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        );

      case 'json':
        return (
          <div className="space-y-2">
            <Textarea
              value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
              onChange={(e) => setValue(e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
            {value !== preference.value && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                <Check className="h-4 w-4 mr-2" />
                Save
              </Button>
            )}
          </div>
        );

      default:
        return (
          <div className="flex gap-2">
            <Input
              value={value as string}
              onChange={(e) => setValue(e.target.value)}
              onBlur={handleSave}
            />
            {value !== preference.value && (
              <Button
                size="sm"
                onClick={handleSave}
                disabled={saving}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </div>
        );
    }
  };

  return (
    <div className="flex items-start justify-between p-4 border rounded-lg">
      <div className="flex-1 space-y-2">
        <Label htmlFor={preference.key} className="font-medium">
          {preference.label}
        </Label>
        <p className="text-sm text-muted-foreground">
          {preference.description}
        </p>
        <p className="text-xs text-muted-foreground">
          Last modified: {format(new Date(preference.lastModified), 'PPp')}
        </p>
      </div>

      <div className="ml-4 min-w-[200px]">
        {renderInput()}
      </div>
    </div>
  );
}
