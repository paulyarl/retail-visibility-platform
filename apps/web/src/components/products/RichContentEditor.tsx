'use client';

import React from 'react';
import { useCreateBlockNote, createReactBlockSpec } from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs } from '@blocknote/core';
import { cn } from '@/lib/utils';
import { Check, Info, AlertCircle, XCircle, HelpCircle } from 'lucide-react';
import { uploadImage, ImageUploadPresets } from '@/lib/image-upload';
import { itemsService } from '@/services/ItemsSingletonService';
import { parseVideoUrl } from './ProductVideoPlayer';
import '@blocknote/mantine/style.css';
import '@blocknote/core/fonts/inter.css';

import { contentBlocksSchema, ContentBlock, ContentBlocks, DEFAULT_CONTENT_BLOCKS } from './content-blocks';

const BUTTON_VARIANTS = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700',
  secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
  outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50',
};

const PILL_VARIANTS = {
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-800',
  info: 'bg-blue-100 text-blue-800',
  neutral: 'bg-gray-100 text-gray-800',
};

const CALLOUT_STYLES = {
  info: 'bg-blue-50 border-blue-200 text-blue-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  success: 'bg-green-50 border-green-200 text-green-900',
  error: 'bg-red-50 border-red-200 text-red-900',
};

type IconComponent = React.ComponentType<{ className?: string; size?: number; style?: React.CSSProperties }>;

const ICON_MAP: Record<string, IconComponent> = {
  check: Check,
  info: Info,
  'alert-circle': AlertCircle,
  'x-circle': XCircle,
  help: HelpCircle,
};

const buttonBlockSpec = createReactBlockSpec(
  {
    type: 'button',
    propSchema: {
      label: { default: 'Button', type: 'string' },
      url: { default: '#', type: 'string' },
      variant: { default: 'primary', values: ['primary', 'secondary', 'outline'] as const },
    },
    content: 'none',
  },
  {
    render: ({ block }) => (
      <a
        href={block.props.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn('inline-block rounded-md px-4 py-2 font-medium transition-colors', BUTTON_VARIANTS[block.props.variant])}
      >
        {block.props.label}
      </a>
    ),
  },
)();

const buttonPillBlockSpec = createReactBlockSpec(
  {
    type: 'button_pill',
    propSchema: {
      label: { default: 'Pill', type: 'string' },
      variant: { default: 'info', values: ['success', 'warning', 'info', 'neutral'] as const },
    },
    content: 'none',
  },
  {
    render: ({ block }) => (
      <span className={cn('inline-flex rounded-full px-3 py-1 text-sm font-medium', PILL_VARIANTS[block.props.variant])}>
        {block.props.label}
      </span>
    ),
  },
)();

const iconBlockSpec = createReactBlockSpec(
  {
    type: 'icon',
    propSchema: {
      name: { default: 'help', type: 'string' },
      color: { default: '', type: 'string' },
    },
    content: 'none',
  },
  {
    render: ({ block }) => {
      const Icon = ICON_MAP[block.props.name] || HelpCircle;
      return <Icon className="inline-block h-5 w-5" style={{ color: block.props.color || undefined }} />;
    },
  },
)();

const calloutBlockSpec = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: {
      style: { default: 'info', values: ['info', 'warning', 'success', 'error'] as const },
    },
    content: 'inline',
  },
  {
    render: ({ block, contentRef }) => (
      <div className={cn('rounded-lg border p-4', CALLOUT_STYLES[block.props.style])} ref={contentRef} />
    ),
  },
)();

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    button: buttonBlockSpec,
    button_pill: buttonPillBlockSpec,
    icon: iconBlockSpec,
    callout: calloutBlockSpec,
  },
});

interface RichContentEditorProps {
  value?: ContentBlocks;
  onChange?: (value: ContentBlocks) => void;
  className?: string;
  tenantId?: string;
}

function contentBlockToBlockNote(block: ContentBlock): unknown | unknown[] | null {
  switch (block.type) {
    case 'paragraph':
      return { type: 'paragraph', content: block.text };
    case 'heading':
      return { type: 'heading', props: { level: block.level }, content: block.text };
    case 'bullet_list':
      return block.items.map((item) => ({ type: 'bulletListItem', content: item }));
    case 'numbered_list':
      return block.items.map((item) => ({ type: 'numberedListItem', content: item }));
    case 'image':
      return {
        type: 'image',
        props: { url: block.src, name: block.alt, caption: block.caption ?? '' },
      };
    case 'video_embed':
      return { type: 'video', props: { url: block.url, caption: block.caption ?? '' } };
    case 'button':
      return { type: 'button', props: { label: block.label, url: block.url, variant: block.variant } };
    case 'button_pill':
      return { type: 'button_pill', props: { label: block.label, variant: block.variant } };
    case 'icon':
      return { type: 'icon', props: { name: block.name, color: block.color ?? '' } };
    case 'callout':
      return { type: 'callout', props: { style: block.style }, content: block.text };
    default:
      return null;
  }
}

function inlineToText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map((c) => (typeof c === 'string' ? c : (c as { text?: string }).text ?? '')).join('');
  }
  return '';
}

function blockNoteToContentBlock(block: { type: string; props?: Record<string, unknown>; content?: unknown }): ContentBlock | ContentBlock[] | null {
  switch (block.type) {
    case 'paragraph':
      return { type: 'paragraph', text: inlineToText(block.content) };
    case 'heading':
      return {
        type: 'heading',
        level: (block.props?.level as number) ?? 2,
        text: inlineToText(block.content),
      };
    case 'bulletListItem':
      return { type: 'bullet_list', items: [inlineToText(block.content)] };
    case 'numberedListItem':
      return { type: 'numbered_list', items: [inlineToText(block.content)] };
    case 'image':
      return {
        type: 'image',
        src: (block.props?.url as string) ?? '',
        alt: (block.props?.name as string) || undefined,
        caption: (block.props?.caption as string) || undefined,
      };
    case 'video':
      return {
        type: 'video_embed',
        url: (block.props?.url as string) ?? '',
        caption: (block.props?.caption as string) || undefined,
      };
    case 'button':
      return {
        type: 'button',
        label: (block.props?.label as string) ?? 'Button',
        url: (block.props?.url as string) ?? '#',
        variant: (block.props?.variant as 'primary' | 'secondary' | 'outline') ?? 'primary',
      };
    case 'button_pill':
      return {
        type: 'button_pill',
        label: (block.props?.label as string) ?? 'Pill',
        variant: (block.props?.variant as 'success' | 'warning' | 'info' | 'neutral') ?? 'info',
      };
    case 'icon':
      return {
        type: 'icon',
        name: (block.props?.name as string) ?? 'help',
        color: (block.props?.color as string) || undefined,
      };
    case 'callout':
      return {
        type: 'callout',
        style: (block.props?.style as 'info' | 'warning' | 'success' | 'error') ?? 'info',
        text: inlineToText(block.content),
      };
    default:
      return null;
  }
}

function contentBlocksToBlockNote(blocks: ContentBlock[]): unknown[] {
  return blocks.flatMap(contentBlockToBlockNote).filter(Boolean) as unknown[];
}

function blockNoteToContentBlocks(blocks: { type: string; props?: Record<string, unknown>; content?: unknown }[]): ContentBlock[] {
  return blocks.flatMap(blockNoteToContentBlock).filter(Boolean) as ContentBlock[];
}

async function handleUploadFile(file: File, tenantId?: string): Promise<string> {
  const processed = await uploadImage(file, ImageUploadPresets.product);
  if (processed.error || !processed.dataUrl) {
    throw new Error(processed.error?.message || 'Image upload failed');
  }
  if (tenantId) {
    const result = await itemsService.uploadTempPhoto({ tenantId, dataUrl: processed.dataUrl });
    return result.url;
  }
  return processed.dataUrl;
}

function CustomBlockToolbar({ editor, tenantId }: { editor: any; tenantId?: string }) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const insert = (type: string, props?: Record<string, unknown>, content?: unknown) => {
    if (!editor) return;
    const position = editor.getTextCursorPosition?.();
    const ref = position?.block ?? editor.document[0];
    editor.insertBlocks?.([{ type, props, content }], ref, 'after');
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const url = await handleUploadFile(file, tenantId);
      insert('image', { url, name: file.name, caption: '' });
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Image upload failed');
    } finally {
      e.target.value = '';
    }
  };

  const handleVideoInsert = () => {
    const url = window.prompt('Paste a YouTube or Vimeo URL');
    if (!url) return;
    if (!parseVideoUrl(url)) {
      window.alert('Invalid URL. Only YouTube and Vimeo links are supported.');
      return;
    }
    insert('video', { url, caption: '' });
  };

  return (
    <div className="mb-2 flex flex-wrap gap-2 rounded-md border bg-white p-2 shadow-sm dark:bg-gray-900">
      <button
        type="button"
        onClick={() => {
          const label = window.prompt('Button label');
          if (!label) return;
          const url = window.prompt('Button URL');
          if (!url) return;
          insert('button', { label, url, variant: 'primary' });
        }}
        className="rounded bg-blue-600 px-2 py-1 text-sm text-white hover:bg-blue-700"
      >
        + Button
      </button>
      <button
        type="button"
        onClick={() => {
          const label = window.prompt('Pill label');
          if (!label) return;
          insert('button_pill', { label, variant: 'info' });
        }}
        className="rounded bg-blue-100 px-2 py-1 text-sm text-blue-800 hover:bg-blue-200"
      >
        + Pill
      </button>
      <button
        type="button"
        onClick={() => {
          const name = window.prompt('Icon name (e.g. check, info)', 'check');
          if (!name) return;
          const color = window.prompt('Icon color (optional)');
          insert('icon', { name, color: color || '' });
        }}
        className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 hover:bg-gray-200"
      >
        + Icon
      </button>
      <button
        type="button"
        onClick={() => {
          const style = window.prompt('Callout style (info, warning, success, error)', 'info');
          insert('callout', { style: style || 'info' }, '');
        }}
        className="rounded bg-amber-100 px-2 py-1 text-sm text-amber-800 hover:bg-amber-200"
      >
        + Callout
      </button>
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="rounded bg-green-100 px-2 py-1 text-sm text-green-800 hover:bg-green-200"
      >
        + Image
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageSelect}
      />
      <button
        type="button"
        onClick={handleVideoInsert}
        className="rounded bg-red-100 px-2 py-1 text-sm text-red-800 hover:bg-red-200"
      >
        + Video
      </button>
    </div>
  );
}

export function RichContentEditor({ value = DEFAULT_CONTENT_BLOCKS, onChange, className, tenantId }: RichContentEditorProps) {
  const initialContent = React.useMemo(() => {
    const blocks = contentBlocksToBlockNote(value.blocks);
    return blocks.length > 0 ? blocks : undefined;
  }, []);

  const editor: any = useCreateBlockNote(
    {
      schema,
      initialContent: initialContent as any,
      uploadFile: (file: File) => handleUploadFile(file, tenantId),
    } as any,
    [],
  );

  const handleChange = () => {
    const blocks = blockNoteToContentBlocks(editor.document as any[]);
    const parsed = contentBlocksSchema.safeParse({ version: '1', blocks });
    if (parsed.success) {
      onChange?.(parsed.data);
    }
  };

  return (
    <div className={className}>
      <CustomBlockToolbar editor={editor} tenantId={tenantId} />
      <BlockNoteView editor={editor} onChange={handleChange} theme="light" />
    </div>
  );
}
