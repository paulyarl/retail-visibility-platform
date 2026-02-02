/**
 * Component Mapping Reference for Mantine Migration
 *
 * Maps shadcn/ui components to their Mantine equivalents
 * Used for systematic migration across the platform
 */

export interface ComponentMapping {
  shadcnComponent: string;
  mantineImport: string;
  mantineComponent: string;
  propMapping?: Record<string, string>;
  notes?: string;
}

export const COMPONENT_MAPPINGS: ComponentMapping[] = [
  // Core Components
  {
    shadcnComponent: 'Button',
    mantineImport: '@mantine/core',
    mantineComponent: 'Button',
    propMapping: {
      'variant="outline"': 'variant="outline"',
      'variant="ghost"': 'variant="subtle"',
      'variant="destructive"': 'color="red"',
      'size="sm"': 'size="sm"',
      'size="lg"': 'size="lg"',
    },
  },
  {
    shadcnComponent: 'Card',
    mantineImport: '@mantine/core',
    mantineComponent: 'Card',
    notes: 'Use Card.Section for CardHeader/CardContent equivalent',
  },
  {
    shadcnComponent: 'Input',
    mantineImport: '@mantine/core',
    mantineComponent: 'TextInput',
    propMapping: {
      'placeholder': 'placeholder',
      'type': 'type',
      'disabled': 'disabled',
    },
  },
  {
    shadcnComponent: 'Label',
    mantineImport: '@mantine/core',
    mantineComponent: 'Text',
    notes: 'Use Text component with fw="500" for labels',
  },
  {
    shadcnComponent: 'Badge',
    mantineImport: '@mantine/core',
    mantineComponent: 'Badge',
    propMapping: {
      'variant="secondary"': 'variant="light"',
      'variant="destructive"': 'color="red"',
    },
  },

  // Form Components
  {
    shadcnComponent: 'Textarea',
    mantineImport: '@mantine/core',
    mantineComponent: 'Textarea',
    propMapping: {
      'placeholder': 'placeholder',
      'disabled': 'disabled',
      'rows': 'rows',
    },
  },
  {
    shadcnComponent: 'Select',
    mantineImport: '@mantine/core',
    mantineComponent: 'Select',
    propMapping: {
      'placeholder': 'placeholder',
      'disabled': 'disabled',
    },
    notes: 'Data prop format: [{ value: "1", label: "Option 1" }]',
  },
  {
    shadcnComponent: 'Checkbox',
    mantineImport: '@mantine/core',
    mantineComponent: 'Checkbox',
    propMapping: {
      'checked': 'checked',
      'onCheckedChange': 'onChange',
      'disabled': 'disabled',
    },
  },
  {
    shadcnComponent: 'RadioGroup',
    mantineImport: '@mantine/core',
    mantineComponent: 'Radio.Group',
    propMapping: {
      'value': 'value',
      'onValueChange': 'onChange',
      'disabled': 'disabled',
    },
  },
  {
    shadcnComponent: 'Switch',
    mantineImport: '@mantine/core',
    mantineComponent: 'Switch',
    propMapping: {
      'checked': 'checked',
      'onCheckedChange': 'onChange',
      'disabled': 'disabled',
    },
  },

  // Layout Components
  {
    shadcnComponent: 'Modal',
    mantineImport: '@mantine/core',
    mantineComponent: 'Modal',
    propMapping: {
      'open': 'opened',
      'onOpenChange': 'onClose',
      'title': 'title',
    },
    notes: 'Use ModalsProvider in root and useModals hook',
  },
  {
    shadcnComponent: 'Alert',
    mantineImport: '@mantine/core',
    mantineComponent: 'Alert',
    propMapping: {
      'variant="destructive"': 'color="red"',
    },
  },
  {
    shadcnComponent: 'Skeleton',
    mantineImport: '@mantine/core',
    mantineComponent: 'Skeleton',
    propMapping: {
      'className': 'className',
    },
  },

  // Advanced Components (for future phases)
  {
    shadcnComponent: 'DataTable',
    mantineImport: '@mantine/data-table',
    mantineComponent: 'DataTable',
    notes: 'Requires @mantine/data-table package',
  },
  {
    shadcnComponent: 'DatePicker',
    mantineImport: '@mantine/dates',
    mantineComponent: 'DatePicker',
    notes: 'Requires @mantine/dates package',
  },
  {
    shadcnComponent: 'Toast',
    mantineImport: '@mantine/notifications',
    mantineComponent: 'notifications.show',
    notes: 'Use notifications.show() function instead of component',
  },
  {
    shadcnComponent: 'Tooltip',
    mantineImport: '@mantine/core',
    mantineComponent: 'Tooltip',
  },
  {
    shadcnComponent: 'Tabs',
    mantineImport: '@mantine/core',
    mantineComponent: 'Tabs',
  },
  {
    shadcnComponent: 'Progress',
    mantineImport: '@mantine/core',
    mantineComponent: 'Progress',
  },
  {
    shadcnComponent: 'Pagination',
    mantineImport: '@mantine/core',
    mantineComponent: 'Pagination',
  },
];

/**
 * Utility function to find Mantine equivalent for shadcn component
 */
export function findMantineEquivalent(shadcnComponent: string): ComponentMapping | undefined {
  return COMPONENT_MAPPINGS.find(mapping => mapping.shadcnComponent === shadcnComponent);
}

/**
 * Generate import statement for Mantine components
 */
export function generateMantineImport(components: string[]): string {
  const uniqueImports = new Set<string>();

  components.forEach(component => {
    const mapping = findMantineEquivalent(component);
    if (mapping) {
      uniqueImports.add(mapping.mantineImport);
    }
  });

  if (uniqueImports.size === 0) return '';

  const imports = Array.from(uniqueImports).map(imp => `import { ... } from '${imp}';`);
  return imports.join('\n');
}

/**
 * Migration checklist for each component
 */
export const MIGRATION_CHECKLIST = {
  Button: [
    '✅ Update import from @/components/ui to @mantine/core',
    '✅ Map variant props (outline→outline, ghost→subtle, destructive→color="red")',
    '✅ Verify size props (sm, lg work as-is)',
    '✅ Test click handlers and disabled states',
  ],
  Card: [
    '✅ Replace CardHeader with Card.Section',
    '✅ Replace CardTitle with Text component inside section',
    '✅ Replace CardContent with Card.Section',
    '✅ Update padding classes if needed',
  ],
  Input: [
    '✅ Rename to TextInput',
    '✅ Verify placeholder, type, disabled props',
    '✅ Check label integration (may need separate Text component)',
  ],
  Select: [
    '✅ Update data prop format: [{ value: "1", label: "Option 1" }]',
    '✅ Verify onChange handlers work with new format',
    '✅ Check placeholder and disabled props',
  ],
} as const;
