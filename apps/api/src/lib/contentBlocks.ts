import { z } from 'zod';

export const paragraphBlockSchema = z.object({
  type: z.literal('paragraph'),
  text: z.string(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const headingBlockSchema = z.object({
  type: z.literal('heading'),
  level: z.number().int().min(1).max(6),
  text: z.string(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const bulletListBlockSchema = z.object({
  type: z.literal('bullet_list'),
  items: z.array(z.string()),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const numberedListBlockSchema = z.object({
  type: z.literal('numbered_list'),
  items: z.array(z.string()),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const checklistItemSchema = z.object({
  text: z.string(),
  checked: z.boolean().default(false),
});

export const checklistBlockSchema = z.object({
  type: z.literal('checklist'),
  items: z.array(checklistItemSchema),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const imageBlockSchema = z.object({
  type: z.literal('image'),
  src: z.string().min(1),
  alt: z.string().optional(),
  caption: z.string().optional(),
});

export const videoEmbedBlockSchema = z.object({
  type: z.literal('video_embed'),
  url: z.string().min(1),
  caption: z.string().optional(),
});

export const buttonBlockSchema = z.object({
  type: z.literal('button'),
  label: z.string().min(1),
  url: z.string().min(1),
  variant: z.enum(['primary', 'secondary', 'outline', 'gradient']).default('primary'),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  foregroundColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const buttonPillBlockSchema = z.object({
  type: z.literal('button_pill'),
  label: z.string().min(1),
  variant: z.enum(['success', 'warning', 'info', 'neutral', 'gradient']).default('info'),
  foregroundColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const iconButtonBlockSchema = z.object({
  type: z.literal('icon_button'),
  icon: z.string().min(1),
  label: z.string().min(1),
  url: z.string().min(1),
  variant: z.enum(['primary', 'secondary', 'outline', 'gradient']).default('primary'),
  size: z.enum(['small', 'medium', 'large']).default('medium'),
  foregroundColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const iconBlockSchema = z.object({
  type: z.literal('icon'),
  name: z.string().min(1),
  color: z.string().optional(),
});

export const calloutBlockSchema = z.object({
  type: z.literal('callout'),
  style: z.enum(['info', 'warning', 'success', 'error']).default('info'),
  text: z.string().min(1),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  foregroundColor: z.string().optional(),
  backgroundColor: z.string().optional(),
  textSize: z.enum(['paragraph', 'h1', 'h2', 'h3']).optional(),
});

export const codeBlockSchema = z.object({
  type: z.literal('code'),
  language: z.string().default('text'),
  text: z.string(),
});

export const quoteBlockSchema = z.object({
  type: z.literal('quote'),
  text: z.string(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

export const toggleListBlockSchema = z.object({
  type: z.literal('toggle_list'),
  text: z.string(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
  children: z.array(z.unknown()).optional(),
});

export const dividerBlockSchema = z.object({
  type: z.literal('divider'),
});

export const sideBySideBlockSchema = z.object({
  type: z.literal('side_by_side'),
  imagePosition: z.enum(['left', 'right']).default('left'),
  imageSrc: z.string(),
  imageAlt: z.string().optional(),
  text: z.string().optional(),
  content: z.array(z.unknown()).optional(),
  textAlign: z.enum(['left', 'center', 'right', 'justify']).optional(),
});

const tableCellSchema = z.object({
  type: z.literal('tableCell'),
  props: z.object({
    backgroundColor: z.string().optional(),
    textColor: z.string().optional(),
    textAlignment: z.enum(['left', 'center', 'right', 'justify']).optional(),
    colspan: z.number().int().optional(),
    rowspan: z.number().int().optional(),
  }).optional(),
  content: z.array(z.unknown()).default([]),
});

const tableRowSchema = z.object({
  cells: z.array(tableCellSchema),
});

const tableBlockSchema = z.object({
  type: z.literal('table'),
  props: z.object({
    textColor: z.string().optional(),
  }).optional(),
  columnWidths: z.array(z.union([z.number(), z.null(), z.undefined()])).optional(),
  headerRows: z.number().int().optional(),
  headerCols: z.number().int().optional(),
  rows: z.array(tableRowSchema),
});

export const contentBlockSchema = z.union([
  paragraphBlockSchema,
  headingBlockSchema,
  bulletListBlockSchema,
  numberedListBlockSchema,
  checklistBlockSchema,
  imageBlockSchema,
  videoEmbedBlockSchema,
  buttonBlockSchema,
  buttonPillBlockSchema,
  iconButtonBlockSchema,
  iconBlockSchema,
  calloutBlockSchema,
  codeBlockSchema,
  quoteBlockSchema,
  toggleListBlockSchema,
  dividerBlockSchema,
  sideBySideBlockSchema,
  tableBlockSchema,
]);

export const contentBlocksSchema = z.object({
  version: z.literal('1'),
  blocks: z.array(contentBlockSchema).max(50),
});

export type ContentBlock = z.infer<typeof contentBlockSchema>;
export type ContentBlocks = z.infer<typeof contentBlocksSchema>;

export function validateContentBlocks(value: unknown): ContentBlocks | null {
  const parsed = contentBlocksSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function inlineContentToText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content.map(inlineContentToText).join('');
  }
  const node = content as any;
  if (node?.type === 'link' && Array.isArray(node.content)) {
    return inlineContentToText(node.content);
  }
  if (typeof node?.text === 'string') return node.text;
  return '';
}

function collectTextFromBlock(block: ContentBlock): string[] {
  switch (block.type) {
    case 'paragraph':
    case 'heading':
      return [block.text];
    case 'callout':
      return [block.text];
    case 'bullet_list':
    case 'numbered_list':
      return block.items;
    case 'checklist':
      return block.items.map((item: { text: string; checked?: boolean }) => item.text);
    case 'image':
      return [block.caption, block.alt].filter((s): s is string => typeof s === 'string');
    case 'video_embed':
      return [block.caption].filter((s): s is string => typeof s === 'string');
    case 'button':
    case 'icon_button':
      return [block.label];
    case 'button_pill':
      return [block.label];
    case 'icon':
      return [block.name];
    case 'side_by_side':
      return [block.text, block.imageAlt].filter((s): s is string => typeof s === 'string');
    case 'code':
      return [block.text];
    case 'quote':
      return [block.text];
    case 'toggle_list': {
      const childText = block.children?.length
        ? contentBlocksToPlainText({ version: '1', blocks: block.children as ContentBlock[] })
        : '';
      return childText ? [block.text, childText] : [block.text];
    }
    case 'divider':
      return [];
    case 'table':
      return (block.rows || []).flatMap((row) =>
        row.cells.map((cell) => inlineContentToText(cell.content))
      );
    default:
      return [];
  }
}

export function contentBlocksToPlainText(content: ContentBlocks): string {
  const parts = content.blocks.flatMap(block => collectTextFromBlock(block));
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}
