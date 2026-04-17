import { describe, it, expect, vi } from 'vitest';
import type { MatrixClient } from 'matrix-js-sdk';
import type * as MatrixUtils from '../../utils/matrix';
import {
  createAltEmoticonNode,
  createAltMentionNode,
  insertNodeAtRange,
  serializeAltInput,
  replaceTextInNode,
  replaceRangeWithNode,
  htmlToAltInputDom,
  isAltInputEmpty,
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

describe('serializeAltInput zero-width-space handling', () => {
  it('strips zero-width spaces from text content', () => {
    const el = document.createElement('div');
    el.appendChild(document.createTextNode('hi\u200Bthere'));

    const paragraph = paragraphFrom(serializeAltInput(el));
    expect(paragraph.children).toEqual([{ text: 'hithere' }]);
  });

  it('treats a text node containing only zero-width spaces as empty', () => {
    const el = document.createElement('div');
    el.appendChild(document.createTextNode('\u200B'));

    const paragraph = paragraphFrom(serializeAltInput(el));
    expect(paragraph.children).toEqual([{ text: '' }]);
  });
});

describe('inline void leading anchor', () => {
  it('keeps a renderable text node before a void inserted at the start of the input', () => {
    const el = document.createElement('div');
    const replacement = createAltEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'x',
    });

    insertNodeAtRange(el, null, replacement);

    const first = el.firstChild;
    expect(first).not.toBeNull();
    expect(first?.nodeType).toBe(Node.TEXT_NODE);
    expect((first as Text).data.length).toBeGreaterThan(0);
    expect(first?.nextSibling).toBe(replacement);
  });
});

const ctx = { mx: mockMx, useAuthentication: false };

describe('htmlToAltInputDom formatting preservation', () => {
  it('converts <strong> to <b>', () => {
    const fragment = htmlToAltInputDom('<strong>bold</strong>', ctx);
    const b = fragment.querySelector('b');
    expect(b).not.toBeNull();
    expect(b?.textContent).toBe('bold');
  });

  it('converts <em> to <i>', () => {
    const fragment = htmlToAltInputDom('<em>italic</em>', ctx);
    const i = fragment.querySelector('i');
    expect(i).not.toBeNull();
    expect(i?.textContent).toBe('italic');
  });

  it('preserves <u>', () => {
    const fragment = htmlToAltInputDom('<u>underline</u>', ctx);
    const u = fragment.querySelector('u');
    expect(u).not.toBeNull();
    expect(u?.textContent).toBe('underline');
  });

  it('converts <del> to <s>', () => {
    const fragment = htmlToAltInputDom('<del>strike</del>', ctx);
    const s = fragment.querySelector('s');
    expect(s).not.toBeNull();
    expect(s?.textContent).toBe('strike');
  });

  it('preserves <code> for inline code', () => {
    const fragment = htmlToAltInputDom('<code>inline</code>', ctx);
    const code = fragment.querySelector('code');
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe('inline');
  });

  it('preserves <span data-mx-spoiler>', () => {
    const fragment = htmlToAltInputDom('<span data-mx-spoiler>hidden</span>', ctx);
    const spoiler = fragment.querySelector('[data-mx-spoiler]');
    expect(spoiler).not.toBeNull();
    expect(spoiler?.textContent).toBe('hidden');
  });

  it('preserves <blockquote>', () => {
    const fragment = htmlToAltInputDom('<blockquote>quoted</blockquote>', ctx);
    const bq = fragment.querySelector('blockquote');
    expect(bq).not.toBeNull();
    expect(bq?.textContent).toBe('quoted');
  });

  it('preserves <h1>', () => {
    const fragment = htmlToAltInputDom('<h1>title</h1>', ctx);
    const h1 = fragment.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe('title');
  });

  it('preserves <ol> and <li>', () => {
    const fragment = htmlToAltInputDom('<ol><li>item</li></ol>', ctx);
    const ol = fragment.querySelector('ol');
    const li = fragment.querySelector('li');
    expect(ol).not.toBeNull();
    expect(li).not.toBeNull();
    expect(li?.textContent).toBe('item');
  });

  it('preserves <pre> and skips <code> inside it', () => {
    const fragment = htmlToAltInputDom('<pre><code>code block</code></pre>', ctx);
    const pre = fragment.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toBe('code block');
    expect(pre?.querySelector('code')).toBeNull();
  });
});

describe('isAltInputEmpty', () => {
  it('returns true for empty div', () => {
    const el = document.createElement('div');
    expect(isAltInputEmpty(el)).toBe(true);
  });

  it('returns false for text content', () => {
    const el = document.createElement('div');
    el.textContent = 'hello';
    expect(isAltInputEmpty(el)).toBe(false);
  });

  it('returns true for only zero-width spaces', () => {
    const el = document.createElement('div');
    el.textContent = '\u200B\u200B';
    expect(isAltInputEmpty(el)).toBe(true);
  });

  it('returns true for empty formatting tag left behind', () => {
    const el = document.createElement('div');
    el.appendChild(document.createElement('b'));
    expect(isAltInputEmpty(el)).toBe(true);
  });

  it('returns false for list with no text', () => {
    const el = document.createElement('div');
    const ol = document.createElement('ol');
    ol.appendChild(document.createElement('li'));
    el.appendChild(ol);
    expect(isAltInputEmpty(el)).toBe(false);
  });

  it('returns false for void mention element', () => {
    const el = document.createElement('div');
    el.appendChild(
      createAltMentionNode({ id: '@alice:server.com', name: 'Alice', highlight: false })
    );
    expect(isAltInputEmpty(el)).toBe(false);
  });

  it('returns false for void emoticon element', () => {
    const el = document.createElement('div');
    el.appendChild(
      createAltEmoticonNode({
        mx: mockMx,
        useAuthentication: false,
        key: '😀',
        shortcode: 'grinning',
      })
    );
    expect(isAltInputEmpty(el)).toBe(false);
  });

  it('returns true for only whitespace', () => {
    const el = document.createElement('div');
    el.textContent = '   \n  ';
    expect(isAltInputEmpty(el)).toBe(true);
  });
});
