'use client';

import React from 'react';
import {
  useCreateBlockNote,
  createReactBlockSpec,
  createReactInlineContentSpec,
  FormattingToolbar,
  FormattingToolbarController,
  BasicTextStyleButton,
  ColorStyleButton,
  CreateLinkButton,
  TextAlignButton,
  useBlockNoteEditor,
} from '@blocknote/react';
import { BlockNoteView } from '@blocknote/mantine';
import { BlockNoteSchema, defaultBlockSpecs, defaultInlineContentSpecs } from '@blocknote/core';
import { cn } from '@/lib/utils';
import { getIcon, ICON_OPTIONS } from './icon-map';
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

const buttonSizeClasses = {
  small: 'text-sm px-2 py-1',
  medium: 'text-base px-4 py-2',
  large: 'text-lg px-6 py-3',
};

const buttonBlockSpec = createReactBlockSpec(
  {
    type: 'button',
    propSchema: {
      label: { default: 'Button', type: 'string' },
      url: { default: '#', type: 'string' },
      variant: { default: 'primary', values: ['primary', 'secondary', 'outline'] as const },
      size: { default: 'medium', values: ['small', 'medium', 'large'] as const },
      foregroundColor: { default: '', type: 'string' },
      backgroundColor: { default: '', type: 'string' },
      textAlign: { default: 'left', values: ['left', 'center', 'right', 'justify'] as const },
    },
    content: 'none',
  },
  {
    render: ({ block }) => (
      <div style={{ textAlign: block.props.textAlign || 'left' }}>
        <a
          href={block.props.url}
          target="_blank"
          rel="noopener noreferrer"
          className={cn('inline-block rounded-md font-medium transition-colors', buttonSizeClasses[block.props.size], BUTTON_VARIANTS[block.props.variant])}
          style={{ color: block.props.foregroundColor || undefined, backgroundColor: block.props.backgroundColor || undefined }}
        >
          {block.props.label}
        </a>
      </div>
    ),
  },
)();

const buttonPillBlockSpec = createReactBlockSpec(
  {
    type: 'button_pill',
    propSchema: {
      label: { default: 'Pill', type: 'string' },
      variant: { default: 'info', values: ['success', 'warning', 'info', 'neutral'] as const },
      foregroundColor: { default: '', type: 'string' },
      backgroundColor: { default: '', type: 'string' },
      textAlign: { default: 'left', values: ['left', 'center', 'right', 'justify'] as const },
    },
    content: 'none',
  },
  {
    render: ({ block }) => (
      <div style={{ textAlign: block.props.textAlign || 'left' }}>
        <span
          className={cn('inline-flex rounded-full px-3 py-1 text-sm font-medium', PILL_VARIANTS[block.props.variant])}
          style={{ color: block.props.foregroundColor || undefined, backgroundColor: block.props.backgroundColor || undefined }}
        >
          {block.props.label}
        </span>
      </div>
    ),
  },
)();

const iconButtonBlockSpec = createReactBlockSpec(
  {
    type: 'icon_button',
    propSchema: {
      icon: { default: 'check', type: 'string' },
      label: { default: 'Button', type: 'string' },
      url: { default: '#', type: 'string' },
      variant: { default: 'primary', values: ['primary', 'secondary', 'outline'] as const },
      size: { default: 'medium', values: ['small', 'medium', 'large'] as const },
      foregroundColor: { default: '', type: 'string' },
      backgroundColor: { default: '', type: 'string' },
      textAlign: { default: 'left', values: ['left', 'center', 'right', 'justify'] as const },
    },
    content: 'none',
  },
  {
    render: ({ block }) => {
      const Icon = getIcon(block.props.icon);
      return (
        <div style={{ textAlign: block.props.textAlign || 'left' }}>
          <a
            href={block.props.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex items-center gap-2 rounded-md font-medium transition-colors', buttonSizeClasses[block.props.size], BUTTON_VARIANTS[block.props.variant])}
            style={{ color: block.props.foregroundColor || undefined, backgroundColor: block.props.backgroundColor || undefined }}
          >
            <Icon className="h-4 w-4" />
            {block.props.label}
          </a>
        </div>
      );
    },
  },
)();

const iconInlineSpec = createReactInlineContentSpec(
  {
    type: 'icon',
    propSchema: {
      name: { default: 'help', type: 'string' },
      color: { default: '', type: 'string' },
    },
    content: 'none',
  },
  {
    render: ({ inlineContent, contentRef }) => {
      const Icon = getIcon(inlineContent.props.name);
      return (
        <span ref={contentRef} className="inline-block h-5 w-5 align-middle" style={{ color: inlineContent.props.color || undefined }}>
          <Icon />
        </span>
      );
    },
  },
);

const CALLOUT_TEXT_SIZE_CLASSES = {
  paragraph: 'text-base',
  h1: 'text-3xl font-semibold',
  h2: 'text-2xl font-semibold',
  h3: 'text-xl font-semibold',
};

const calloutBlockSpec = createReactBlockSpec(
  {
    type: 'callout',
    propSchema: {
      style: { default: 'info', values: ['info', 'warning', 'success', 'error'] as const },
      textAlign: { default: 'left', values: ['left', 'center', 'right', 'justify'] as const },
      foregroundColor: { default: '', type: 'string' },
      backgroundColor: { default: '', type: 'string' },
      textSize: { default: 'paragraph', values: ['paragraph', 'h1', 'h2', 'h3'] as const },
    },
    content: 'inline',
  },
  {
    render: ({ block, contentRef }) => (
      <div
        className={cn('rounded-lg border p-4', CALLOUT_STYLES[block.props.style], CALLOUT_TEXT_SIZE_CLASSES[block.props.textSize])}
        style={{
          textAlign: block.props.textAlign || 'left',
          color: block.props.foregroundColor || undefined,
          backgroundColor: block.props.backgroundColor || undefined,
        }}
        ref={contentRef}
      />
    ),
  },
)();

const schema = BlockNoteSchema.create({
  blockSpecs: {
    ...defaultBlockSpecs,
    button: buttonBlockSpec,
    button_pill: buttonPillBlockSpec,
    icon_button: iconButtonBlockSpec,
    callout: calloutBlockSpec,
  },
  inlineContentSpecs: {
    ...defaultInlineContentSpecs,
    icon: iconInlineSpec,
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
      return { type: 'paragraph', props: { textAlignment: block.textAlign || 'left' }, content: textToInlineContent(block.text) };
    case 'heading':
      return { type: 'heading', props: { level: block.level, textAlignment: block.textAlign || 'left' }, content: textToInlineContent(block.text) };
    case 'bullet_list':
      return block.items.map((item) => ({ type: 'bulletListItem', props: { textAlignment: block.textAlign || 'left' }, content: textToInlineContent(item) }));
    case 'numbered_list':
      return block.items.map((item) => ({ type: 'numberedListItem', props: { textAlignment: block.textAlign || 'left' }, content: textToInlineContent(item) }));
    case 'image':
      return {
        type: 'image',
        props: { url: block.src, name: block.alt, caption: block.caption ?? '' },
      };
    case 'video_embed':
      return { type: 'video', props: { url: block.url, caption: block.caption ?? '' } };
    case 'button':
      return {
        type: 'button',
        props: {
          label: block.label,
          url: block.url,
          variant: block.variant,
          size: block.size,
          foregroundColor: block.foregroundColor || '',
          backgroundColor: block.backgroundColor || '',
          textAlign: block.textAlign || 'left',
        },
      };
    case 'button_pill':
      return {
        type: 'button_pill',
        props: {
          label: block.label,
          variant: block.variant,
          foregroundColor: block.foregroundColor || '',
          backgroundColor: block.backgroundColor || '',
          textAlign: block.textAlign || 'left',
        },
      };
    case 'icon_button':
      return {
        type: 'icon_button',
        props: {
          icon: block.icon,
          label: block.label,
          url: block.url,
          variant: block.variant,
          size: block.size,
          foregroundColor: block.foregroundColor || '',
          backgroundColor: block.backgroundColor || '',
          textAlign: block.textAlign || 'left',
        },
      };
    case 'icon':
      return { type: 'paragraph', content: [{ type: 'icon', props: { name: block.name, color: block.color ?? '' } }] };
    case 'callout':
      return {
        type: 'callout',
        props: {
          style: block.style,
          textAlign: block.textAlign || 'left',
          foregroundColor: block.foregroundColor || '',
          backgroundColor: block.backgroundColor || '',
          textSize: block.textSize || 'paragraph',
        },
        content: textToInlineContent(block.text),
      };
    default:
      return null;
  }
}

function textToInlineContent(text: string): unknown[] {
  const parts: unknown[] = [];
  const regex = /\{\{icon:([^:{}]+)(?::([^:{}]*))?\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    parts.push({ type: 'icon', props: { name: match[1], color: match[2] || '' } });
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

function inlineToString(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((node) => {
        if (typeof node === 'string') return node;
        const n = node as { type?: string; text?: string; props?: { name?: string; color?: string } };
        if (n.type === 'icon') {
          return `{{icon:${n.props?.name ?? 'help'}:${n.props?.color ?? ''}}}`;
        }
        return n.text ?? '';
      })
      .join('');
  }
  return '';
}

function blockNoteToContentBlock(block: { type: string; props?: Record<string, unknown>; content?: unknown }): ContentBlock | ContentBlock[] | null {
  switch (block.type) {
    case 'paragraph':
      return { type: 'paragraph', text: inlineToString(block.content), textAlign: (block.props?.textAlignment as 'left' | 'center' | 'right' | 'justify') || undefined };
    case 'heading':
      return {
        type: 'heading',
        level: (block.props?.level as number) ?? 2,
        text: inlineToString(block.content),
        textAlign: (block.props?.textAlignment as 'left' | 'center' | 'right' | 'justify') || undefined,
      };
    case 'bulletListItem':
      return { type: 'bullet_list', items: [inlineToString(block.content)], textAlign: (block.props?.textAlignment as 'left' | 'center' | 'right' | 'justify') || undefined };
    case 'numberedListItem':
      return { type: 'numbered_list', items: [inlineToString(block.content)], textAlign: (block.props?.textAlignment as 'left' | 'center' | 'right' | 'justify') || undefined };
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
        size: (block.props?.size as 'small' | 'medium' | 'large') ?? 'medium',
        foregroundColor: (block.props?.foregroundColor as string) || undefined,
        backgroundColor: (block.props?.backgroundColor as string) || undefined,
        textAlign: (block.props?.textAlign as 'left' | 'center' | 'right' | 'justify') || undefined,
      };
    case 'button_pill':
      return {
        type: 'button_pill',
        label: (block.props?.label as string) ?? 'Pill',
        variant: (block.props?.variant as 'success' | 'warning' | 'info' | 'neutral') ?? 'info',
        foregroundColor: (block.props?.foregroundColor as string) || undefined,
        backgroundColor: (block.props?.backgroundColor as string) || undefined,
        textAlign: (block.props?.textAlign as 'left' | 'center' | 'right' | 'justify') || undefined,
      };
    case 'icon_button':
      return {
        type: 'icon_button',
        icon: (block.props?.icon as string) ?? 'check',
        label: (block.props?.label as string) ?? 'Button',
        url: (block.props?.url as string) ?? '#',
        variant: (block.props?.variant as 'primary' | 'secondary' | 'outline') ?? 'primary',
        size: (block.props?.size as 'small' | 'medium' | 'large') ?? 'medium',
        foregroundColor: (block.props?.foregroundColor as string) || undefined,
        backgroundColor: (block.props?.backgroundColor as string) || undefined,
        textAlign: (block.props?.textAlign as 'left' | 'center' | 'right' | 'justify') || undefined,
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
        text: inlineToString(block.content),
        textAlign: (block.props?.textAlign as 'left' | 'center' | 'right' | 'justify') || undefined,
        foregroundColor: (block.props?.foregroundColor as string) || undefined,
        backgroundColor: (block.props?.backgroundColor as string) || undefined,
        textSize: (block.props?.textSize as 'paragraph' | 'h1' | 'h2' | 'h3') || undefined,
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
      <select
        defaultValue=""
        onChange={(e) => {
          const name = e.currentTarget.value;
          if (!name) return;
          editor.insertInlineContent?.([{ type: 'icon', props: { name, color: '' } }]);
          e.currentTarget.value = '';
        }}
        className="rounded bg-gray-100 px-2 py-1 text-sm text-gray-800 hover:bg-gray-200 cursor-pointer"
      >
        <option value="">+ Icon</option>
        {ICON_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <select
        defaultValue=""
        onChange={(e) => {
          const icon = e.currentTarget.value;
          if (!icon) return;
          const label = window.prompt('Button label');
          if (!label) {
            e.currentTarget.value = '';
            return;
          }
          const url = window.prompt('Button URL');
          if (!url) {
            e.currentTarget.value = '';
            return;
          }
          insert('icon_button', { icon, label, url, variant: 'primary', size: 'medium' });
          e.currentTarget.value = '';
        }}
        className="rounded bg-indigo-100 px-2 py-1 text-sm text-indigo-800 hover:bg-indigo-200 cursor-pointer"
      >
        <option value="">+ Icon Button</option>
        {ICON_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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

  const [selectedBlock, setSelectedBlock] = React.useState<any>(null);

  const handleChange = () => {
    const blocks = blockNoteToContentBlocks(editor.document as any[]);
    const parsed = contentBlocksSchema.safeParse({ version: '1', blocks });
    if (parsed.success) {
      onChange?.(parsed.data);
    }
  };

  const handleSelectionChange = () => {
    try {
      const pos = editor.getTextCursorPosition?.();
      setSelectedBlock(pos?.block || null);
    } catch {
      setSelectedBlock(null);
    }
  };

  const isCustomBlock = selectedBlock && ['button', 'button_pill', 'icon_button', 'callout'].includes(selectedBlock.type);

  return (
    <div className={className}>
      <CustomBlockToolbar editor={editor} tenantId={tenantId} />
      {isCustomBlock && <BlockSettingsPanel key={selectedBlock.id} editor={editor} block={selectedBlock} />}
      <BlockNoteView
        editor={editor}
        onChange={handleChange}
        onSelectionChange={handleSelectionChange}
        theme="light"
        formattingToolbar={false}
        sideMenu={true}
      >
        <FormattingToolbarController formattingToolbar={CustomFormattingToolbar as any} />
      </BlockNoteView>
    </div>
  );
}

function CustomFormattingToolbar() {
  const editor = useBlockNoteEditor() as any;
  const block = editor?.getTextCursorPosition?.()?.block as { type: string; id: string } | undefined;
  const type = block?.type ?? 'paragraph';
  const blockId = block?.id;
  const isText = ['paragraph', 'heading', 'bulletListItem', 'numberedListItem', 'callout'].includes(type);
  const isHeading = type === 'heading';
  const isImage = type === 'image';
  const isCallout = type === 'callout';

  return (
    <FormattingToolbar>
      {isText && (
        <>
          <BasicTextStyleButton basicTextStyle="bold" />
          <BasicTextStyleButton basicTextStyle="italic" />
          <BasicTextStyleButton basicTextStyle="underline" />
          <BasicTextStyleButton basicTextStyle="strike" />
          <BasicTextStyleButton basicTextStyle="code" />
          <ColorStyleButton />
          <CreateLinkButton />
        </>
      )}
      {(isText || isImage) && (
        <div className="ml-2 flex items-center gap-1 border-l border-neutral-300 pl-2 dark:border-neutral-700">
          {isCallout ? (
            ['left', 'center', 'right', 'justify'].map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => editor.updateBlock?.(blockId, { props: { textAlign: a } })}
                className="rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                {a[0].toUpperCase()}
              </button>
            ))
          ) : (
            <>
              <TextAlignButton textAlignment="left" />
              <TextAlignButton textAlignment="center" />
              <TextAlignButton textAlignment="right" />
              <TextAlignButton textAlignment="justify" />
            </>
          )}
        </div>
      )}
      {isHeading && (
        <div className="ml-2 flex items-center gap-1 border-l border-neutral-300 pl-2 dark:border-neutral-700">
          {[1, 2, 3].map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => editor.updateBlock?.(blockId, { props: { level: lvl } })}
              className="rounded px-2 py-1 text-xs font-semibold hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              H{lvl}
            </button>
          ))}
        </div>
      )}
      {isImage && (
        <div className="ml-2 flex items-center gap-1 border-l border-neutral-300 pl-2 dark:border-neutral-700">
          <CreateLinkButton />
        </div>
      )}
    </FormattingToolbar>
  );
}

const inputClass = 'rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100';
const selectClass = 'rounded border border-neutral-300 px-2 py-1 text-sm dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100';
const deleteClass = 'rounded bg-red-100 px-2 py-1 text-sm text-red-800 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-200';

function BlockSettingsPanel({ editor, block }: { editor: any; block: any }) {
  const update = (key: string, value: string) => {
    editor.updateBlock?.(block.id, { props: { [key]: value } });
  };
  const remove = () => editor.removeBlocks?.([block.id]);
  const props = block.props || {};

  return (
    <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border bg-neutral-50 p-2 text-sm dark:bg-neutral-900">
      <span className="font-medium text-neutral-700 dark:text-neutral-300">Edit {block.type}</span>
      {(block.type === 'button' || block.type === 'icon_button') && (
        <>
          <input defaultValue={props.label} onBlur={(e) => update('label', e.target.value)} placeholder="Label" className={inputClass} />
          <input defaultValue={props.url} onBlur={(e) => update('url', e.target.value)} placeholder="URL" className={inputClass} />
          <select value={props.variant} onChange={(e) => update('variant', e.target.value)} className={selectClass}>
            <option value="primary">Primary</option>
            <option value="secondary">Secondary</option>
            <option value="outline">Outline</option>
          </select>
          <select value={props.size} onChange={(e) => update('size', e.target.value)} className={selectClass}>
            <option value="small">Small</option>
            <option value="medium">Medium</option>
            <option value="large">Large</option>
          </select>
          {block.type === 'icon_button' && (
            <select value={props.icon} onChange={(e) => update('icon', e.target.value)} className={selectClass}>
              {ICON_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
          <input defaultValue={props.foregroundColor} onBlur={(e) => update('foregroundColor', e.target.value)} placeholder="Text color" className={inputClass} />
          <input defaultValue={props.backgroundColor} onBlur={(e) => update('backgroundColor', e.target.value)} placeholder="Bg color" className={inputClass} />
        </>
      )}
      {block.type === 'button_pill' && (
        <>
          <input defaultValue={props.label} onBlur={(e) => update('label', e.target.value)} placeholder="Label" className={inputClass} />
          <select value={props.variant} onChange={(e) => update('variant', e.target.value)} className={selectClass}>
            <option value="success">Success</option>
            <option value="warning">Warning</option>
            <option value="info">Info</option>
            <option value="neutral">Neutral</option>
          </select>
          <input defaultValue={props.foregroundColor} onBlur={(e) => update('foregroundColor', e.target.value)} placeholder="Text color" className={inputClass} />
          <input defaultValue={props.backgroundColor} onBlur={(e) => update('backgroundColor', e.target.value)} placeholder="Bg color" className={inputClass} />
        </>
      )}
      {block.type === 'callout' && (
        <>
          <select value={props.style} onChange={(e) => update('style', e.target.value)} className={selectClass}>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="success">Success</option>
            <option value="error">Error</option>
          </select>
          <select value={props.textSize || 'paragraph'} onChange={(e) => update('textSize', e.target.value)} className={selectClass}>
            <option value="paragraph">Paragraph</option>
            <option value="h1">H1</option>
            <option value="h2">H2</option>
            <option value="h3">H3</option>
          </select>
          <input defaultValue={props.foregroundColor} onBlur={(e) => update('foregroundColor', e.target.value)} placeholder="Text color" className={inputClass} />
          <input defaultValue={props.backgroundColor} onBlur={(e) => update('backgroundColor', e.target.value)} placeholder="Bg color" className={inputClass} />
        </>
      )}
      {(['button', 'button_pill', 'icon_button', 'callout'].includes(block.type)) && (
        <div className="flex items-center gap-1">
          {(['left', 'center', 'right', 'justify'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => update('textAlign', a)}
              className={cn(
                'rounded px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-800',
                (props.textAlign || 'left') === a ? 'bg-neutral-200 dark:bg-neutral-700' : 'bg-white dark:bg-neutral-900'
              )}
            >
              {a[0].toUpperCase()}
            </button>
          ))}
        </div>
      )}
      <button type="button" onClick={remove} className={deleteClass}>
        Delete
      </button>
    </div>
  );
}
