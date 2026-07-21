import { describe, it, expect } from 'vitest';
import { contentBlocksSchema, SAMPLE_CONTENT_BLOCKS } from './content-blocks';

describe('content-blocks schema', () => {
  it('validates all supported block types from the sample', () => {
    const result = contentBlocksSchema.parse(SAMPLE_CONTENT_BLOCKS);
    expect(result.blocks).toHaveLength(10);
    expect(result.blocks.map((block) => block.type)).toEqual([
      'paragraph',
      'heading',
      'bullet_list',
      'numbered_list',
      'image',
      'video_embed',
      'button',
      'button_pill',
      'icon',
      'callout',
    ]);
  });

  it('fills default variants for button, button_pill, and callout', () => {
    const input = {
      version: '1',
      blocks: [
        { type: 'button', label: 'Click', url: '/buy' },
        { type: 'button_pill', label: 'New' },
        { type: 'callout', text: 'Note' },
      ],
    };
    const result = contentBlocksSchema.parse(input);
    expect(result.blocks[0]).toMatchObject({ type: 'button', label: 'Click', url: '/buy', variant: 'primary' });
    expect(result.blocks[1]).toMatchObject({ type: 'button_pill', label: 'New', variant: 'info' });
    expect(result.blocks[2]).toMatchObject({ type: 'callout', text: 'Note', style: 'info' });
  });

  it('rejects unknown block types', () => {
    expect(() =>
      contentBlocksSchema.parse({
        version: '1',
        blocks: [{ type: 'unknown', data: 'x' }],
      }),
    ).toThrow();
  });

  it('rejects more than 50 blocks', () => {
    const blocks = Array.from({ length: 51 }, (_, index) => ({
      type: 'paragraph',
      text: `Paragraph ${index}`,
    }));
    expect(() => contentBlocksSchema.parse({ version: '1', blocks })).toThrow();
  });
});
