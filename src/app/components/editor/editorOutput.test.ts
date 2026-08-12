import { describe, it, expect, vi } from 'vitest';
import type { MatrixClient } from 'matrix-js-sdk';
import type * as MatrixUtils from '../../utils/matrix';
import type * as MediaCacheUtils from '../../utils/mediaCache';
import {
  domToMatrixCustomHTML,
  domToPlainText,
  getMentionsFromDom,
  replaceShortcodesInDom,
  getCommandFromDom,
  trimCustomHtml,
} from './editorOutput';
import { NODE_TYPE_ATTR, EMOTICON_NODE, MENTION_NODE, COMMAND_NODE } from './editorInput';
import type { ShortcodeMapEntry } from '../../plugins/emoji';

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

const mockMx = {
  getUserId: () => '@me:server.com',
} as unknown as MatrixClient;

const createRootElement = (): HTMLDivElement => document.createElement('div');

const mentionNode = (id: string, name: string, opts?: { eventId?: string; via?: string }) => {
  const span = document.createElement('span');
  span.setAttribute(NODE_TYPE_ATTR, MENTION_NODE);
  span.setAttribute('contenteditable', 'false');
  span.dataset.id = id;
  span.dataset.name = name;
  span.dataset.highlight = 'false';
  if (opts?.eventId) span.dataset.eventId = opts.eventId;
  if (opts?.via) span.dataset.via = opts.via;
  span.textContent = name;
  return span;
};

const emoticonNode = (key: string, shortcode: string) => {
  const span = document.createElement('span');
  span.setAttribute(NODE_TYPE_ATTR, EMOTICON_NODE);
  span.setAttribute('contenteditable', 'false');
  span.dataset.key = key;
  span.dataset.shortcode = shortcode;
  span.textContent = key.startsWith('mxc://') ? shortcode : key;
  return span;
};

const commandNode = (command: string) => {
  const span = document.createElement('span');
  span.setAttribute(NODE_TYPE_ATTR, COMMAND_NODE);
  span.setAttribute('contenteditable', 'false');
  span.dataset.command = command;
  span.textContent = `/${command}`;
  return span;
};

const MARKDOWN = {
  allowMarkdown: true,
};

const PLAIN_TEXT = {
  allowMarkdown: false,
};

describe('domToMatrixCustomHTML', () => {
  it('converts plain text to text<br/>', () => {
    const root = createRootElement();
    root.textContent = 'hello world';
    expect(domToMatrixCustomHTML(root, MARKDOWN)).toBe('hello world<br/>');
  });

  it('sanitizes HTML special characters in text', () => {
    const root = createRootElement();
    root.textContent = '<script>alert("xss")</script>';
    const html = domToMatrixCustomHTML(root, MARKDOWN);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('converts <b> to <strong>', () => {
    const root = createRootElement();
    const b = document.createElement('b');
    b.textContent = 'bold';
    root.appendChild(b);
    expect(domToMatrixCustomHTML(root, MARKDOWN)).toContain('<strong>bold</strong>');
  });

  it('converts <i> to <i>', () => {
    const root = createRootElement();
    const i = document.createElement('i');
    i.textContent = 'italic';
    root.appendChild(i);
    expect(domToMatrixCustomHTML(root, MARKDOWN)).toContain('<i>italic</i>');
  });

  it('converts <u> to <u>', () => {
    const root = createRootElement();
    const u = document.createElement('u');
    u.textContent = 'underline';
    root.appendChild(u);
    expect(domToMatrixCustomHTML(root, MARKDOWN)).toContain('<u>underline</u>');
  });

  it('converts <s> to <s>', () => {
    const root = createRootElement();
    const s = document.createElement('s');
    s.textContent = 'strike';
    root.appendChild(s);
    expect(domToMatrixCustomHTML(root, MARKDOWN)).toContain('<s>strike</s>');
  });

  it('converts <code> to <code>', () => {
    const root = createRootElement();
    const code = document.createElement('code');
    code.textContent = 'inline';
    root.appendChild(code);
    expect(domToMatrixCustomHTML(root, MARKDOWN)).toContain('<code>inline</code>');
  });

  it('converts <span data-mx-spoiler> to <span data-mx-spoiler>', () => {
    const root = createRootElement();
    const span = document.createElement('span');
    span.setAttribute('data-mx-spoiler', '');
    span.textContent = 'hidden';
    root.appendChild(span);
    expect(domToMatrixCustomHTML(root, MARKDOWN)).toContain('<span data-mx-spoiler>hidden</span>');
  });

  it('handles nested formatting', () => {
    const root = createRootElement();
    const b = document.createElement('b');
    const i = document.createElement('i');
    i.textContent = 'both';
    b.appendChild(i);
    root.appendChild(b);
    expect(domToMatrixCustomHTML(root, MARKDOWN)).toContain('<strong><i>both</i></strong>');
  });

  it('ignores formatting when allowMarkdown is false', () => {
    const root = createRootElement();
    const b = document.createElement('b');
    b.textContent = 'bold';
    root.appendChild(b);
    const html = domToMatrixCustomHTML(root, PLAIN_TEXT);
    expect(html).not.toContain('<strong>');
    expect(html).toContain('bold');
  });

  it('converts <br> to <br/>', () => {
    const root = createRootElement();
    root.appendChild(document.createTextNode('line1'));
    root.appendChild(document.createElement('br'));
    root.appendChild(document.createTextNode('line2'));
    expect(domToMatrixCustomHTML(root, MARKDOWN)).toContain('line1<br/>line2');
  });

  it('converts mention void to matrix.to link', () => {
    const root = createRootElement();
    root.appendChild(mentionNode('@alice:server.com', 'Alice'));
    const html = domToMatrixCustomHTML(root, MARKDOWN);
    expect(html).toContain('href="https://matrix.to/#/@alice:server.com"');
    expect(html).toContain('>Alice</a>');
  });

  it('includes eventId and viaServers in mention link', () => {
    const root = createRootElement();
    root.appendChild(
      mentionNode('!room:server.com', 'Room', {
        eventId: '$event123',
        via: 'server1.com,server2.com',
      })
    );
    const html = domToMatrixCustomHTML(root, MARKDOWN);
    expect(html).toContain('!room:server.com/$event123');
    expect(html).toContain('via=server1.com');
    expect(html).toContain('via=server2.com');
  });

  it('converts mxc emoticon void to <img>', () => {
    const root = createRootElement();
    root.appendChild(emoticonNode('mxc://example/wave', 'wave'));
    const html = domToMatrixCustomHTML(root, MARKDOWN);
    expect(html).toContain('data-mx-emoticon');
    expect(html).toContain('src="mxc://example/wave"');
    expect(html).toContain('alt="wave"');
  });

  it('converts unicode emoticon void to text', () => {
    const root = createRootElement();
    root.appendChild(emoticonNode('😀', 'grinning'));
    const html = domToMatrixCustomHTML(root, MARKDOWN);
    expect(html).toContain('😀');
    expect(html).not.toContain('data-mx-emoticon');
  });

  it('converts command void to /command', () => {
    const root = createRootElement();
    root.appendChild(commandNode('me'));
    const html = domToMatrixCustomHTML(root, MARKDOWN);
    expect(html).toContain('/me');
  });

  it('converts <h1> to <h1>', () => {
    const root = createRootElement();
    const h1 = document.createElement('h1');
    h1.textContent = 'Title';
    root.appendChild(h1);
    expect(domToMatrixCustomHTML(root, MARKDOWN)).toContain('<h1>Title</h1>');
  });

  it('converts <blockquote> to <blockquote>', () => {
    const root = createRootElement();
    const bq = document.createElement('blockquote');
    bq.textContent = 'quoted';
    root.appendChild(bq);
    expect(domToMatrixCustomHTML(root, MARKDOWN)).toContain('<blockquote>quoted</blockquote>');
  });

  it('converts <pre> to <pre><code>', () => {
    const root = createRootElement();
    const pre = document.createElement('pre');
    pre.textContent = 'code here';
    root.appendChild(pre);
    expect(domToMatrixCustomHTML(root, MARKDOWN)).toContain('<pre><code>code here</code></pre>');
  });

  it('converts <ol>/<ul>/<li> to list HTML', () => {
    const root = createRootElement();
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    li.textContent = 'item';
    ul.appendChild(li);
    root.appendChild(ul);
    const html = domToMatrixCustomHTML(root, MARKDOWN);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li><p>item</p></li>');
    expect(html).toContain('</ul>');
  });

  it('does not parse inline markdown when text has a formatting ancestor', () => {
    const root = createRootElement();
    const b = document.createElement('b');
    b.textContent = '*not italic*';
    root.appendChild(b);
    const html = domToMatrixCustomHTML(root, MARKDOWN);
    expect(html).toContain('<strong>*not italic*</strong>');
    expect(html).not.toContain('<i>');
  });

  it('strips zero-width caret anchors', () => {
    const root = createRootElement();
    root.textContent = '\u200Bhello\u200B';
    const html = domToMatrixCustomHTML(root, MARKDOWN);
    expect(html).not.toContain('\u200B');
    expect(html).toContain('hello');
  });
});

describe('browser line break fillers', () => {
  const withEmptyMiddleLine = (): HTMLDivElement => {
    const root = createRootElement();
    const first = document.createElement('div');
    first.textContent = 'a';
    const empty = document.createElement('div');
    empty.appendChild(document.createElement('br'));
    const last = document.createElement('div');
    last.textContent = 'b';
    root.append(first, empty, last);
    return root;
  };

  it('counts a <div><br></div> empty line once in the custom html', () => {
    expect(trimCustomHtml(domToMatrixCustomHTML(withEmptyMiddleLine(), MARKDOWN))).toBe(
      'a<br/><br/>b'
    );
  });

  it('counts a <div><br></div> empty line once in the plain text', () => {
    expect(domToPlainText(withEmptyMiddleLine()).trim()).toBe('a\n\nb');
  });

  it('drops a trailing <br> filler left at the end of a line', () => {
    const root = createRootElement();
    root.appendChild(document.createTextNode('hi'));
    root.appendChild(document.createElement('br'));

    expect(trimCustomHtml(domToMatrixCustomHTML(root, MARKDOWN))).toBe('hi');
    expect(domToPlainText(root).trim()).toBe('hi');
  });

  it('keeps a <br> that has content after it', () => {
    const root = createRootElement();
    root.appendChild(document.createTextNode('a'));
    root.appendChild(document.createElement('br'));
    root.appendChild(document.createElement('br'));
    root.appendChild(document.createTextNode('b'));

    expect(trimCustomHtml(domToMatrixCustomHTML(root, MARKDOWN))).toBe('a<br/><br/>b');
  });
});

describe('trimCustomHtml', () => {
  it('strips a run of trailing line breaks, matching the plain text trim', () => {
    expect(trimCustomHtml('hello<br/><br/><br/>')).toBe('hello');
  });

  it('keeps line breaks that are followed by content', () => {
    expect(trimCustomHtml('hello<br/><br/>world<br/>')).toBe('hello<br/><br/>world');
  });
});

describe('domToPlainText', () => {
  it('extracts plain text', () => {
    const root = createRootElement();
    root.textContent = 'hello world';
    expect(domToPlainText(root)).toBe('hello world');
  });

  it('strips formatting tags', () => {
    const root = createRootElement();
    const b = document.createElement('b');
    b.textContent = 'bold';
    root.appendChild(document.createTextNode('before '));
    root.appendChild(b);
    root.appendChild(document.createTextNode(' after'));
    expect(domToPlainText(root)).toBe('before bold after');
  });

  it('converts <br> to newline', () => {
    const root = createRootElement();
    root.appendChild(document.createTextNode('line1'));
    root.appendChild(document.createElement('br'));
    root.appendChild(document.createTextNode('line2'));
    expect(domToPlainText(root)).toBe('line1\nline2');
  });

  it('converts mention to raw id', () => {
    const root = createRootElement();
    root.appendChild(mentionNode('@alice:server.com', 'Alice'));
    expect(domToPlainText(root)).toBe('@alice:server.com');
  });

  it('converts mxc emoticon to :shortcode:', () => {
    const root = createRootElement();
    root.appendChild(emoticonNode('mxc://example/wave', 'wave'));
    expect(domToPlainText(root)).toBe(':wave:');
  });

  it('converts unicode emoticon to raw key', () => {
    const root = createRootElement();
    root.appendChild(emoticonNode('😀', 'grinning'));
    expect(domToPlainText(root)).toBe('😀');
  });

  it('converts command to /command', () => {
    const root = createRootElement();
    root.appendChild(commandNode('me'));
    expect(domToPlainText(root)).toBe('/me');
  });

  it('converts blockquote lines to | prefix', () => {
    const root = createRootElement();
    const bq = document.createElement('blockquote');
    bq.textContent = 'quoted';
    root.appendChild(bq);
    expect(domToPlainText(root)).toBe('| quoted\n');
  });

  it('converts list items to - prefix', () => {
    const root = createRootElement();
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    li.textContent = 'item';
    ul.appendChild(li);
    root.appendChild(ul);
    expect(domToPlainText(root)).toBe('- item\n');
  });

  it('converts heading to text with newline', () => {
    const root = createRootElement();
    const h1 = document.createElement('h1');
    h1.textContent = 'Title';
    root.appendChild(h1);
    expect(domToPlainText(root)).toBe('Title\n');
  });

  it('strips zero-width caret anchors', () => {
    const root = createRootElement();
    root.textContent = '\u200Bhello\u200B';
    expect(domToPlainText(root)).toBe('hello');
  });
});

describe('getMentionsFromDom', () => {
  it('collects user mentions by data-id', () => {
    const root = createRootElement();
    root.appendChild(mentionNode('@alice:server.com', 'Alice'));
    root.appendChild(mentionNode('@bob:server.com', 'Bob'));
    const data = getMentionsFromDom(root, mockMx);
    expect(data.users).toContain('@alice:server.com');
    expect(data.users).toContain('@bob:server.com');
    expect(data.room).toBe(false);
  });

  it('sets room to true for @room mention', () => {
    const root = createRootElement();
    root.appendChild(mentionNode('@room:server.com', '@room'));
    const data = getMentionsFromDom(root, mockMx);
    expect(data.room).toBe(true);
  });

  it('excludes current user', () => {
    const root = createRootElement();
    root.appendChild(mentionNode('@me:server.com', 'Me'));
    const data = getMentionsFromDom(root, mockMx);
    expect(data.users.size).toBe(0);
  });

  it('skips mentions inside <pre>', () => {
    const root = createRootElement();
    const pre = document.createElement('pre');
    pre.appendChild(mentionNode('@alice:server.com', 'Alice'));
    root.appendChild(pre);
    const data = getMentionsFromDom(root, mockMx);
    expect(data.users.size).toBe(0);
  });
});

describe('replaceShortcodesInDom', () => {
  const shortcodeMap = new Map<string, ShortcodeMapEntry>([
    ['wave', { key: 'mxc://example/wave', shortcode: 'wave' }],
    ['smile', { key: '😀', shortcode: 'smile' }],
  ]);

  it('replaces :shortcode: with emoticon node', () => {
    const root = createRootElement();
    root.textContent = 'hello :wave: world';
    replaceShortcodesInDom(root, shortcodeMap, mockMx, false);
    expect(root.querySelectorAll(`[${NODE_TYPE_ATTR}="${EMOTICON_NODE}"]`)).toHaveLength(1);
    expect(root.textContent).toContain('hello');
    expect(root.textContent).toContain('world');
  });

  it('leaves unknown shortcodes as-is', () => {
    const root = createRootElement();
    root.textContent = 'hello :unknown: world';
    replaceShortcodesInDom(root, shortcodeMap, mockMx, false);
    expect(root.querySelectorAll(`[${NODE_TYPE_ATTR}="${EMOTICON_NODE}"]`)).toHaveLength(0);
    expect(root.textContent).toContain(':unknown:');
  });

  it('handles multiple shortcodes in one text node', () => {
    const root = createRootElement();
    root.textContent = ':wave: and :smile:';
    replaceShortcodesInDom(root, shortcodeMap, mockMx, false);
    expect(root.querySelectorAll(`[${NODE_TYPE_ATTR}="${EMOTICON_NODE}"]`)).toHaveLength(2);
  });

  it('skips shortcodes inside <pre>', () => {
    const root = createRootElement();
    const pre = document.createElement('pre');
    pre.textContent = ':wave:';
    root.appendChild(pre);
    replaceShortcodesInDom(root, shortcodeMap, mockMx, false);
    expect(root.querySelectorAll(`[${NODE_TYPE_ATTR}="${EMOTICON_NODE}"]`)).toHaveLength(0);
  });

  it('skips shortcodes inside <code>', () => {
    const root = createRootElement();
    const code = document.createElement('code');
    code.textContent = ':wave:';
    root.appendChild(code);
    replaceShortcodesInDom(root, shortcodeMap, mockMx, false);
    expect(root.querySelectorAll(`[${NODE_TYPE_ATTR}="${EMOTICON_NODE}"]`)).toHaveLength(0);
  });
});

describe('getCommandFromDom', () => {
  it('returns command from void element at start', () => {
    const root = createRootElement();
    root.appendChild(commandNode('me'));
    expect(getCommandFromDom(root)).toBe('me');
  });

  it('returns command from void element after empty text', () => {
    const root = createRootElement();
    root.appendChild(document.createTextNode(''));
    root.appendChild(commandNode('notice'));
    expect(getCommandFromDom(root)).toBe('notice');
  });

  it('returns command from /command text at start', () => {
    const root = createRootElement();
    root.textContent = '/me hello';
    expect(getCommandFromDom(root)).toBe('me');
  });

  it('returns undefined for empty input', () => {
    const root = createRootElement();
    expect(getCommandFromDom(root)).toBeUndefined();
  });

  it('returns undefined for text without slash', () => {
    const root = createRootElement();
    root.textContent = 'hello world';
    expect(getCommandFromDom(root)).toBeUndefined();
  });
});
