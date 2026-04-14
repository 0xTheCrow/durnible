import { describe, it, expect, vi } from 'vitest';
import type { MatrixClient } from 'matrix-js-sdk';
import type * as MatrixUtils from '../../utils/matrix';
import {
  createAltEmoticonNode,
  serializeAltInput,
  replaceTextInNode,
  replaceRangeWithNode,
  ALT_NODE_ATTR,
  ALT_EMOTICON,
} from './altInput';
import { BlockType } from './types';
import type { EmoticonElement, InlineElement, ParagraphElement } from './slate';

vi.mock('../../utils/matrix', async () => {
  const actual = (await vi.importActual('../../utils/matrix')) as typeof MatrixUtils;
  return {
    ...actual,
    mxcUrlToHttp: (_mx: unknown, key: string) =>
      key.startsWith('mxc://') ? `https://example.com/${key.slice(6)}` : null,
  };
});

const mockMx = {} as MatrixClient;

const paragraphFrom = (descendants: unknown[]): ParagraphElement => {
  expect(descendants).toHaveLength(1);
  const [first] = descendants as ParagraphElement[];
  expect(first.type).toBe(BlockType.Paragraph);
  return first;
};

const isEmoticon = (node: InlineElement): node is EmoticonElement =>
  'type' in node && node.type === BlockType.Emoticon;

describe('createAltEmoticonNode', () => {
  it('builds a contenteditable span with an img for mxc emojis', () => {
    const node = createAltEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example.com/abc',
      shortcode: 'wave',
    });

    expect(node.tagName).toBe('SPAN');
    expect(node.getAttribute('contenteditable')).toBe('false');
    expect(node.getAttribute(ALT_NODE_ATTR)).toBe(ALT_EMOTICON);
    expect(node.dataset.key).toBe('mxc://example.com/abc');
    expect(node.dataset.shortcode).toBe('wave');

    const img = node.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe('https://example.com/example.com/abc');
    expect(img?.getAttribute('alt')).toBe('wave');
  });

  it('builds a span containing the unicode key for unicode emojis', () => {
    const node = createAltEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: '😀',
      shortcode: 'grinning',
    });

    expect(node.querySelector('img')).toBeNull();
    expect(node.textContent).toBe('😀');
    expect(node.dataset.key).toBe('😀');
  });
});

describe('serializeAltInput', () => {
  const buildContainer = (build: (el: HTMLDivElement) => void): HTMLDivElement => {
    const el = document.createElement('div');
    build(el);
    return el;
  };

  const emoticonNode = (key: string, shortcode: string) =>
    createAltEmoticonNode({ mx: mockMx, useAuthentication: false, key, shortcode });

  it('returns a paragraph with one text leaf for plain text', () => {
    const el = buildContainer((root) => {
      root.appendChild(document.createTextNode('hello world'));
    });

    const paragraph = paragraphFrom(serializeAltInput(el));
    expect(paragraph.children).toEqual([{ text: 'hello world' }]);
  });

  it('flanks an inline void with text leaves when surrounded by text', () => {
    const el = buildContainer((root) => {
      root.appendChild(document.createTextNode('hi '));
      root.appendChild(emoticonNode('mxc://example/wave', 'wave'));
      root.appendChild(document.createTextNode(' there'));
    });

    const paragraph = paragraphFrom(serializeAltInput(el));
    const { children } = paragraph;

    expect(children).toHaveLength(3);
    expect(children[0]).toEqual({ text: 'hi ' });
    expect(isEmoticon(children[1])).toBe(true);
    expect((children[1] as EmoticonElement).key).toBe('mxc://example/wave');
    expect((children[1] as EmoticonElement).shortcode).toBe('wave');
    expect(children[2]).toEqual({ text: ' there' });
  });

  it('prepends an empty text leaf when a void is the first child', () => {
    const el = buildContainer((root) => {
      root.appendChild(emoticonNode('mxc://example/a', 'a'));
      root.appendChild(document.createTextNode(' tail'));
    });

    const paragraph = paragraphFrom(serializeAltInput(el));
    const { children } = paragraph;

    expect(children[0]).toEqual({ text: '' });
    expect(isEmoticon(children[1])).toBe(true);
    expect(children[2]).toEqual({ text: ' tail' });
  });

  it('appends an empty text leaf when a void is the last child', () => {
    const el = buildContainer((root) => {
      root.appendChild(document.createTextNode('head '));
      root.appendChild(emoticonNode('mxc://example/a', 'a'));
    });

    const paragraph = paragraphFrom(serializeAltInput(el));
    const { children } = paragraph;

    expect(children[0]).toEqual({ text: 'head ' });
    expect(isEmoticon(children[1])).toBe(true);
    expect(children[children.length - 1]).toEqual({ text: '' });
  });

  it('places empty text leaves between adjacent inline voids', () => {
    const el = buildContainer((root) => {
      root.appendChild(emoticonNode('mxc://example/a', 'a'));
      root.appendChild(emoticonNode('mxc://example/b', 'b'));
    });

    const paragraph = paragraphFrom(serializeAltInput(el));
    const { children } = paragraph;

    const emoticonIndexes: number[] = [];
    children.forEach((child, index) => {
      if (isEmoticon(child)) emoticonIndexes.push(index);
    });
    expect(emoticonIndexes).toHaveLength(2);

    const [first, second] = emoticonIndexes;
    expect(second - first).toBeGreaterThanOrEqual(2);
    expect(children[first - 1]).toEqual({ text: '' });
    expect(children[first + 1]).toEqual({ text: '' });
    expect(children[second + 1]).toEqual({ text: '' });
  });

  it('returns a paragraph with one empty text leaf for an empty container', () => {
    const el = document.createElement('div');
    const paragraph = paragraphFrom(serializeAltInput(el));
    expect(paragraph.children).toEqual([{ text: '' }]);
  });
});

describe('replaceTextInNode', () => {
  it('replaces a range inside the target text node without touching siblings', () => {
    const parent = document.createElement('div');
    const before = document.createTextNode('alpha');
    const target = document.createTextNode('hello @que');
    const after = document.createTextNode('bravo');
    parent.appendChild(before);
    parent.appendChild(target);
    parent.appendChild(after);

    const result = replaceTextInNode(target, 6, 10, '@alice ');

    expect(target.data).toBe('hello @alice ');
    expect(result.node).toBe(target);
    expect(result.offset).toBe('hello @alice '.length);
    expect(before.data).toBe('alpha');
    expect(after.data).toBe('bravo');
    expect(parent.childNodes).toHaveLength(3);
  });
});

describe('replaceRangeWithNode', () => {
  it('splits the target text node and inserts the new node between the halves', () => {
    const parent = document.createElement('div');
    const before = document.createTextNode('alpha');
    const target = document.createTextNode('hello @que tail');
    const after = document.createTextNode('bravo');
    parent.appendChild(before);
    parent.appendChild(target);
    parent.appendChild(after);

    const replacement = createAltEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'x',
    });

    const result = replaceRangeWithNode(target, 6, 10, replacement);

    expect(target.data).toBe('hello ');
    expect(target.nextSibling).toBe(replacement);
    const afterSplit = replacement.nextSibling as Text;
    expect(afterSplit.nodeType).toBe(Node.TEXT_NODE);
    expect(afterSplit.data).toBe(' tail');
    expect(result.node).toBe(afterSplit);
    expect(result.offset).toBe(0);

    // Siblings outside the target are untouched.
    expect(before.data).toBe('alpha');
    expect(after.data).toBe('bravo');
    expect(parent.firstChild).toBe(before);
    expect(parent.lastChild).toBe(after);
  });
});
