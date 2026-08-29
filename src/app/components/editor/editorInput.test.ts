import { describe, it, expect, vi } from 'vitest';
import type { MatrixClient } from 'matrix-js-sdk';
import type * as MatrixUtils from '../../utils/matrix';
import type * as MediaCacheUtils from '../../utils/mediaCache';
import {
  createEmoticonNode,
  createMentionNode,
  insertNodeAtRange,
  replaceTextInNode,
  replaceRangeWithNode,
  handleEditorBackspace,
  getSelectedVoidElement,
  deleteVoidElement,
  htmlToEditorDom,
  isEditorEmpty,
  normalizeEditorRoot,
  removeEditedInlineReferences,
  restoreEditorDraft,
  stripDeadCaretAnchors,
  NODE_TYPE_ATTR,
  EMOTICON_NODE,
} from './editorInput';
import { domToPlainText } from './editorOutput';
import { markCachedMediaUrl } from '../../utils/mediaCache';

vi.mock('../../utils/matrix', async () => {
  const actual = (await vi.importActual('../../utils/matrix')) as typeof MatrixUtils;
  const { markCachedMediaUrl: mark } = await vi.importActual<typeof MediaCacheUtils>(
    '../../utils/mediaCache'
  );
  const mockHttp = (key: string): string | null =>
    key.startsWith('mxc://') ? `https://example.com/${key.slice(6)}` : null;
  return {
    ...actual,
    mxcUrlToHttp: (_mx: unknown, key: string) => mockHttp(key),
    mxcUrlToEmojiHttp: (_mx: unknown, key: string) => {
      const httpUrl = mockHttp(key);
      return httpUrl ? mark(httpUrl, 'emoji') : null;
    },
  };
});

const mockMx = {} as MatrixClient;

const setCollapsedSelection = (node: Node, offset: number): Range => {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  return range;
};

describe('createEmoticonNode', () => {
  it('builds a contenteditable span with an img for mxc emojis', () => {
    const node = createEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example.com/abc',
      shortcode: 'wave',
    });

    expect(node.tagName).toBe('SPAN');
    expect(node.getAttribute('contenteditable')).toBe('false');
    expect(node.getAttribute(NODE_TYPE_ATTR)).toBe(EMOTICON_NODE);
    expect(node.dataset.key).toBe('mxc://example.com/abc');
    expect(node.dataset.shortcode).toBe('wave');

    const img = node.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.getAttribute('src')).toBe(
      markCachedMediaUrl('https://example.com/example.com/abc', 'emoji')
    );
    expect(img?.getAttribute('alt')).toBe('wave');
  });

  it('builds a span containing the unicode key for unicode emojis', () => {
    const node = createEmoticonNode({
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

    const replacement = createEmoticonNode({
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

    expect(before.data).toBe('alpha');
    expect(after.data).toBe('bravo');
    expect(parent.firstChild).toBe(before);
    expect(parent.lastChild).toBe(after);
  });
});

describe('inline void leading anchor', () => {
  it('keeps a renderable text node before a void inserted at the start of the input', () => {
    const rootElement = document.createElement('div');
    const replacement = createEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'x',
    });

    insertNodeAtRange(rootElement, null, replacement);

    const first = rootElement.firstChild;
    expect(first).not.toBeNull();
    expect(first?.nodeType).toBe(Node.TEXT_NODE);
    expect((first as Text).data.length).toBeGreaterThan(0);
    expect(first?.nextSibling).toBe(replacement);
  });
});

describe('inline void trailing anchor', () => {
  it('keeps a renderable text node after a void inserted at the end of the input', () => {
    const rootElement = document.createElement('div');
    rootElement.appendChild(document.createTextNode('hello '));
    const emoticon = createEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'wave',
    });

    insertNodeAtRange(rootElement, null, emoticon);

    const last = rootElement.lastChild;
    expect(last).not.toBeNull();
    expect(last?.nodeType).toBe(Node.TEXT_NODE);
    expect((last as Text).data.length).toBeGreaterThan(0);
    expect(emoticon.nextSibling).toBe(last);
  });

  it('keeps a renderable text node when autocomplete replaces a trailing shortcode with nothing following it', () => {
    const rootElement = document.createElement('div');
    const textNode = document.createTextNode('hello :wave:');
    rootElement.appendChild(textNode);

    const replacement = createEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'wave',
    });
    const result = replaceRangeWithNode(textNode, 6, 12, replacement);

    expect(result.node.data.length).toBeGreaterThan(0);
    expect(replacement.nextSibling).toBe(result.node);
  });

  it('keeps a renderable text node when a void directly follows a non-text element like <br>', () => {
    const fragment = htmlToEditorDom(
      '<br /><img data-mx-emoticon src="mxc://example/x" alt="wave" />',
      ctx
    );
    const rootElement = document.createElement('div');
    rootElement.appendChild(fragment);

    const br = rootElement.querySelector('br');
    expect(br).not.toBeNull();
    const separator = br?.nextSibling;
    expect(separator?.nodeType).toBe(Node.TEXT_NODE);
    expect((separator as Text).data.length).toBeGreaterThan(0);
  });
});

describe('handleEditorBackspace', () => {
  it('deletes a trailing custom emoji when backspacing right after it', () => {
    const rootElement = document.createElement('div');
    rootElement.appendChild(document.createTextNode('hello '));
    const emoticon = createEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'wave',
    });

    const range = insertNodeAtRange(rootElement, null, emoticon);
    const handled = handleEditorBackspace(rootElement, range);

    expect(handled).toBe(true);
    expect(rootElement.contains(emoticon)).toBe(false);
    expect(domToPlainText(rootElement)).toBe('hello ');
  });

  it('deletes a trailing void on a line other than the first without throwing', () => {
    const rootElement = document.createElement('div');
    const firstLine = document.createElement('div');
    firstLine.textContent = 'line one';
    rootElement.appendChild(firstLine);

    const secondLine = document.createElement('div');
    secondLine.appendChild(document.createTextNode('hey '));
    rootElement.appendChild(secondLine);

    const emoticon = createEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'wave',
    });
    const initialRange = document.createRange();
    initialRange.selectNodeContents(secondLine);
    initialRange.collapse(false);
    const range = insertNodeAtRange(rootElement, initialRange, emoticon);

    let handled = false;
    expect(() => {
      handled = handleEditorBackspace(rootElement, range);
    }).not.toThrow();

    expect(handled).toBe(true);
    expect(rootElement.contains(emoticon)).toBe(false);
    expect(firstLine.textContent).toBe('line one');
  });

  it('leaves a mention to ordinary text backspacing since it is no longer void', () => {
    const rootElement = document.createElement('div');
    const mention = createMentionNode({
      id: '@alice:example.org',
      name: '@alice',
      highlight: false,
    });
    rootElement.appendChild(mention);
    const range = setCollapsedSelection(rootElement, 1);

    const handled = handleEditorBackspace(rootElement, range);

    expect(handled).toBe(false);
    expect(rootElement.contains(mention)).toBe(true);
  });

  it('does not require a second backspace once the void is already gone', () => {
    const rootElement = document.createElement('div');
    rootElement.appendChild(document.createTextNode('hello '));
    const emoticon = createEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'wave',
    });
    const range = insertNodeAtRange(rootElement, null, emoticon);

    expect(handleEditorBackspace(rootElement, range)).toBe(true);
    expect(handleEditorBackspace(rootElement, range)).toBe(false);
  });

  it('deletes a void that is the first thing in the input via its leading anchor', () => {
    const rootElement = document.createElement('div');
    const emoticon = createEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'wave',
    });
    insertNodeAtRange(rootElement, null, emoticon);

    const leadingAnchor = rootElement.firstChild as Text;
    const range = setCollapsedSelection(leadingAnchor, 0);
    const handled = handleEditorBackspace(rootElement, range);

    expect(handled).toBe(true);
    expect(rootElement.contains(emoticon)).toBe(false);
  });

  it('leaves ordinary text backspacing to the browser', () => {
    const rootElement = document.createElement('div');
    const textNode = document.createTextNode('hello');
    rootElement.appendChild(textNode);
    const range = setCollapsedSelection(textNode, 5);

    const handled = handleEditorBackspace(rootElement, range);

    expect(handled).toBe(false);
    expect(rootElement.textContent).toBe('hello');
  });

  it('deletes the real trailing space after a void instead of leaving an unrenderable empty node', () => {
    const rootElement = document.createElement('div');
    const emoticon = createEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'wave',
    });
    rootElement.appendChild(emoticon);
    const trailingSpace = document.createTextNode(' ');
    rootElement.appendChild(trailingSpace);
    const range = setCollapsedSelection(trailingSpace, 1);

    const handled = handleEditorBackspace(rootElement, range);

    expect(handled).toBe(true);
    expect(emoticon.nextSibling).toBe(trailingSpace);
    expect(trailingSpace.data.length).toBeGreaterThan(0);
  });
});

describe('getSelectedVoidElement', () => {
  it('finds the void element when the selection ends inside its own children, per the observed Android selection shape', () => {
    const rootElement = document.createElement('div');
    rootElement.appendChild(document.createTextNode('hello'));
    const emoticon = createEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'wave',
    });
    insertNodeAtRange(rootElement, null, emoticon);

    const precedingText = emoticon.previousSibling as Text;
    const range = document.createRange();
    range.setStart(precedingText, precedingText.data.length);
    range.setEnd(emoticon, emoticon.childNodes.length);

    expect(getSelectedVoidElement(range)).toBe(emoticon);
  });

  it('returns null when the bracketed element is not a void', () => {
    const rootElement = document.createElement('div');
    const precedingText = document.createTextNode('hello');
    const bold = document.createElement('b');
    bold.textContent = 'world';
    rootElement.append(precedingText, bold);

    const range = document.createRange();
    range.setStart(precedingText, precedingText.data.length);
    range.setEnd(bold, bold.childNodes.length);

    expect(getSelectedVoidElement(range)).toBeNull();
  });

  it('returns null when the selection does not reach the end of the void', () => {
    const rootElement = document.createElement('div');
    rootElement.appendChild(document.createTextNode('hello'));
    const emoticon = createEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'wave',
    });
    insertNodeAtRange(rootElement, null, emoticon);

    const precedingText = emoticon.previousSibling as Text;
    const range = document.createRange();
    range.setStart(precedingText, precedingText.data.length);
    range.setEnd(emoticon, 0);

    expect(getSelectedVoidElement(range)).toBeNull();
  });
});

describe('deleteVoidElement', () => {
  it('removes the void element and places the caret at the start of the following anchor', () => {
    const rootElement = document.createElement('div');
    rootElement.appendChild(document.createTextNode('hello '));
    const emoticon = createEmoticonNode({
      mx: mockMx,
      useAuthentication: false,
      key: 'mxc://example/x',
      shortcode: 'wave',
    });
    insertNodeAtRange(rootElement, null, emoticon);
    document.body.appendChild(rootElement);

    const trailingAnchor = emoticon.nextSibling as Text;
    deleteVoidElement(emoticon);

    expect(rootElement.contains(emoticon)).toBe(false);
    const range = window.getSelection()!.getRangeAt(0);
    expect(range.startContainer).toBe(trailingAnchor);
    expect(range.startOffset).toBe(0);

    rootElement.remove();
  });
});

describe('removeEditedInlineReferences', () => {
  it('removes a mention entirely once it has been backspaced shorter than its name', () => {
    const rootElement = document.createElement('div');
    const mention = createMentionNode({
      id: '@alice:example.org',
      name: '@alice',
      highlight: false,
    });
    rootElement.appendChild(mention);
    mention.textContent = '@alic';

    const changed = removeEditedInlineReferences(rootElement);

    expect(changed).toBe(true);
    expect(rootElement.contains(mention)).toBe(false);
  });
});

const ctx = { mx: mockMx, useAuthentication: false };

const blockDiv = (text: string): HTMLDivElement => {
  const div = document.createElement('div');
  div.textContent = text;
  return div;
};

describe('htmlToEditorDom formatting preservation', () => {
  it('converts <strong> to <b>', () => {
    const fragment = htmlToEditorDom('<strong>bold</strong>', ctx);
    const b = fragment.querySelector('b');
    expect(b).not.toBeNull();
    expect(b?.textContent).toBe('bold');
  });

  it('converts <em> to <i>', () => {
    const fragment = htmlToEditorDom('<em>italic</em>', ctx);
    const i = fragment.querySelector('i');
    expect(i).not.toBeNull();
    expect(i?.textContent).toBe('italic');
  });

  it('preserves <u>', () => {
    const fragment = htmlToEditorDom('<u>underline</u>', ctx);
    const u = fragment.querySelector('u');
    expect(u).not.toBeNull();
    expect(u?.textContent).toBe('underline');
  });

  it('converts <del> to <s>', () => {
    const fragment = htmlToEditorDom('<del>strike</del>', ctx);
    const s = fragment.querySelector('s');
    expect(s).not.toBeNull();
    expect(s?.textContent).toBe('strike');
  });

  it('preserves <code> for inline code', () => {
    const fragment = htmlToEditorDom('<code>inline</code>', ctx);
    const code = fragment.querySelector('code');
    expect(code).not.toBeNull();
    expect(code?.textContent).toBe('inline');
  });

  it('preserves <span data-mx-spoiler>', () => {
    const fragment = htmlToEditorDom('<span data-mx-spoiler>hidden</span>', ctx);
    const spoiler = fragment.querySelector('[data-mx-spoiler]');
    expect(spoiler).not.toBeNull();
    expect(spoiler?.textContent).toBe('hidden');
  });

  it('preserves <blockquote>', () => {
    const fragment = htmlToEditorDom('<blockquote>quoted</blockquote>', ctx);
    const bq = fragment.querySelector('blockquote');
    expect(bq).not.toBeNull();
    expect(bq?.textContent).toBe('quoted');
  });

  it('preserves <h1>', () => {
    const fragment = htmlToEditorDom('<h1>title</h1>', ctx);
    const h1 = fragment.querySelector('h1');
    expect(h1).not.toBeNull();
    expect(h1?.textContent).toBe('title');
  });

  it('preserves <ol> and <li>', () => {
    const fragment = htmlToEditorDom('<ol><li>item</li></ol>', ctx);
    const ol = fragment.querySelector('ol');
    const li = fragment.querySelector('li');
    expect(ol).not.toBeNull();
    expect(li).not.toBeNull();
    expect(li?.textContent).toBe('item');
  });

  it('preserves <pre> and skips <code> inside it', () => {
    const fragment = htmlToEditorDom('<pre><code>code block</code></pre>', ctx);
    const pre = fragment.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toBe('code block');
    expect(pre?.querySelector('code')).toBeNull();
  });
});

describe('isEditorEmpty', () => {
  it('returns true for empty div', () => {
    const rootElement = document.createElement('div');
    expect(isEditorEmpty(rootElement)).toBe(true);
  });

  it('returns false for text content', () => {
    const rootElement = document.createElement('div');
    rootElement.textContent = 'hello';
    expect(isEditorEmpty(rootElement)).toBe(false);
  });

  it('returns true for only zero-width spaces', () => {
    const rootElement = document.createElement('div');
    rootElement.textContent = '\u200B\u200B';
    expect(isEditorEmpty(rootElement)).toBe(true);
  });

  it('returns true for empty formatting tag left behind', () => {
    const rootElement = document.createElement('div');
    rootElement.appendChild(document.createElement('b'));
    expect(isEditorEmpty(rootElement)).toBe(true);
  });

  it('returns false for list with no text', () => {
    const rootElement = document.createElement('div');
    const ol = document.createElement('ol');
    ol.appendChild(document.createElement('li'));
    rootElement.appendChild(ol);
    expect(isEditorEmpty(rootElement)).toBe(false);
  });

  it('returns false for void mention element', () => {
    const rootElement = document.createElement('div');
    rootElement.appendChild(
      createMentionNode({ id: '@alice:server.com', name: 'Alice', highlight: false })
    );
    expect(isEditorEmpty(rootElement)).toBe(false);
  });

  it('returns false for void emoticon element', () => {
    const rootElement = document.createElement('div');
    rootElement.appendChild(
      createEmoticonNode({
        mx: mockMx,
        useAuthentication: false,
        key: '😀',
        shortcode: 'grinning',
      })
    );
    expect(isEditorEmpty(rootElement)).toBe(false);
  });

  it('returns true for only whitespace', () => {
    const rootElement = document.createElement('div');
    rootElement.textContent = '   \n  ';
    expect(isEditorEmpty(rootElement)).toBe(true);
  });

  it('returns false for a textless mxc emoticon nested in a block', () => {
    const rootElement = document.createElement('div');
    const line = document.createElement('div');
    line.appendChild(
      createEmoticonNode({
        mx: mockMx,
        useAuthentication: false,
        key: 'mxc://server.com/party',
        shortcode: 'party',
      })
    );
    const emptyLine = document.createElement('div');
    emptyLine.appendChild(document.createElement('br'));
    rootElement.append(line, emptyLine);

    expect(isEditorEmpty(rootElement)).toBe(false);
  });
});

describe('normalizeEditorRoot', () => {
  it.each([
    ['pure inline root', 'hello'],
    ['all-block root', '<div>a</div><div>b</div>'],
  ])('leaves a uniform root untouched (%s)', (_label, html) => {
    const rootElement = document.createElement('div');
    rootElement.innerHTML = html;
    const before = rootElement.innerHTML;

    expect(normalizeEditorRoot(rootElement)).toBe(false);
    expect(rootElement.innerHTML).toBe(before);
  });

  it('wraps an inline node sandwiched between blocks so lines do not join', () => {
    const rootElement = document.createElement('div');
    rootElement.append(blockDiv('a'), document.createTextNode('b'), blockDiv('c'));

    expect(normalizeEditorRoot(rootElement)).toBe(true);
    expect(domToPlainText(rootElement)).toBe('a\nb\nc\n');
  });

  it('wraps a leading inline node before a block', () => {
    const rootElement = document.createElement('div');
    rootElement.append(document.createTextNode('a'), blockDiv('b'));

    expect(normalizeEditorRoot(rootElement)).toBe(true);
    expect(domToPlainText(rootElement)).toBe('a\nb\n');
  });

  it('groups a consecutive inline run into a single block', () => {
    const rootElement = document.createElement('div');
    rootElement.append(
      blockDiv('a'),
      document.createTextNode('b'),
      document.createElement('br'),
      document.createTextNode('c'),
      blockDiv('d')
    );

    expect(normalizeEditorRoot(rootElement)).toBe(true);
    // The b/br/c run becomes one block (b\nc), not three (which would add a
    // blank line from the lone <br>).
    expect(domToPlainText(rootElement)).toBe('a\nb\nc\nd\n');
  });

  it('preserves the collapsed caret across the reparenting', () => {
    const rootElement = document.createElement('div');
    const inlineText = document.createTextNode('bee');
    rootElement.append(blockDiv('a'), inlineText, blockDiv('c'));
    document.body.appendChild(rootElement);

    const selection = window.getSelection();
    const range = document.createRange();
    range.setStart(inlineText, 2);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);

    expect(normalizeEditorRoot(rootElement)).toBe(true);
    expect(selection?.anchorNode).toBe(inlineText);
    expect(selection?.anchorOffset).toBe(2);

    rootElement.remove();
  });
});

describe('restoreEditorDraft', () => {
  it('preserves a mention node across a save/restore round-trip', () => {
    const source = document.createElement('div');
    source.appendChild(
      createMentionNode({ id: '@alice:server.com', name: 'Alice', highlight: false })
    );
    const savedDraft = source.innerHTML;

    const restored = document.createElement('div');
    restoreEditorDraft(restored, savedDraft);

    const mention = restored.querySelector<HTMLElement>(`[${NODE_TYPE_ATTR}="mention"]`);
    expect(mention).not.toBeNull();
    expect(mention?.dataset.id).toBe('@alice:server.com');
    // A live mention serializes to its id; a flattened one would serialize to
    // the display name 'Alice'.
    expect(domToPlainText(restored)).toBe('@alice:server.com');
  });
});

describe('stripDeadCaretAnchors', () => {
  const ZWSP = '\u200B';

  const setCaret = (node: Node, offset: number) => {
    const range = document.createRange();
    range.setStart(node, offset);
    range.collapse(true);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  };

  it('removes an anchor that shares a text node with typed text and keeps the caret', () => {
    const root = document.createElement('div');
    root.innerHTML = `<strong>${ZWSP}hi</strong>`;
    document.body.appendChild(root);
    const text = root.querySelector('strong')!.firstChild as Text;
    setCaret(text, 3);

    stripDeadCaretAnchors(root);

    expect(root.querySelector('strong')?.textContent).toBe('hi');
    const range = window.getSelection()!.getRangeAt(0);
    expect(range.startContainer).toBe(text);
    expect(range.startOffset).toBe(2);
  });

  it('strips a trailing exit anchor merged with following text', () => {
    const root = document.createElement('div');
    root.innerHTML = `<strong>hi</strong>${ZWSP} world`;
    document.body.appendChild(root);

    stripDeadCaretAnchors(root);

    expect(root.textContent).toBe('hi world');
  });

  it('keeps a lone length-1 anchor still holding the caret', () => {
    const root = document.createElement('div');
    root.innerHTML = `<strong>hi</strong>${ZWSP}`;
    document.body.appendChild(root);

    stripDeadCaretAnchors(root);

    expect(root.textContent).toBe(`hi${ZWSP}`);
  });
});
