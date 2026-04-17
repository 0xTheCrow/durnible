import { describe, it, expect, vi } from 'vitest';
import type { MatrixClient } from 'matrix-js-sdk';
import type * as MatrixUtils from '../../utils/matrix';
import {
  domToMatrixCustomHTML,
  domToPlainText,
  getMentionsFromDom,
  replaceShortcodesInDom,
  getCommandFromDom,
} from './altOutput';
import { ALT_NODE_ATTR, ALT_EMOTICON, ALT_MENTION, ALT_COMMAND } from './altInput';
import type { ShortcodeMapEntry } from '../../plugins/emoji';

vi.mock('../../utils/matrix', async () => {
  const actual = (await vi.importActual('../../utils/matrix')) as typeof MatrixUtils;
  return {
    ...actual,
    mxcUrlToHttp: (_mx: unknown, key: string) =>
      key.startsWith('mxc://') ? `https://example.com/${key.slice(6)}` : null,
  };
});

const mockMx = {
  getUserId: () => '@me:server.com',
} as unknown as MatrixClient;

const el = (): HTMLDivElement => document.createElement('div');

const mentionNode = (id: string, name: string, opts?: { eventId?: string; via?: string }) => {
  const span = document.createElement('span');
  span.setAttribute(ALT_NODE_ATTR, ALT_MENTION);
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
  span.setAttribute(ALT_NODE_ATTR, ALT_EMOTICON);
  span.setAttribute('contenteditable', 'false');
  span.dataset.key = key;
  span.dataset.shortcode = shortcode;
  span.textContent = key.startsWith('mxc://') ? shortcode : key;
  return span;
};

const commandNode = (command: string) => {
  const span = document.createElement('span');
  span.setAttribute(ALT_NODE_ATTR, ALT_COMMAND);
  span.setAttribute('contenteditable', 'false');
  span.dataset.command = command;
  span.textContent = `/${command}`;
  return span;
};

const ALL_FORMATTING = {
  allowTextFormatting: true,
  allowInlineMarkdown: true,
  allowBlockMarkdown: true,
};

const NO_MARKDOWN = {
  allowTextFormatting: true,
  allowInlineMarkdown: false,
  allowBlockMarkdown: false,
};

describe('domToMatrixCustomHTML', () => {
  it('converts plain text to text<br/>', () => {
    const root = el();
    root.textContent = 'hello world';
    expect(domToMatrixCustomHTML(root, ALL_FORMATTING)).toBe('hello world<br/>');
  });

  it('sanitizes HTML special characters in text', () => {
    const root = el();
    root.textContent = '<script>alert("xss")</script>';
    const html = domToMatrixCustomHTML(root, ALL_FORMATTING);
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('converts <b> to <strong>', () => {
    const root = el();
    const b = document.createElement('b');
    b.textContent = 'bold';
    root.appendChild(b);
    expect(domToMatrixCustomHTML(root, NO_MARKDOWN)).toContain('<strong>bold</strong>');
  });

  it('converts <i> to <i>', () => {
    const root = el();
    const i = document.createElement('i');
    i.textContent = 'italic';
    root.appendChild(i);
    expect(domToMatrixCustomHTML(root, NO_MARKDOWN)).toContain('<i>italic</i>');
  });

  it('converts <u> to <u>', () => {
    const root = el();
    const u = document.createElement('u');
    u.textContent = 'underline';
    root.appendChild(u);
    expect(domToMatrixCustomHTML(root, NO_MARKDOWN)).toContain('<u>underline</u>');
  });

  it('converts <s> to <s>', () => {
    const root = el();
    const s = document.createElement('s');
    s.textContent = 'strike';
    root.appendChild(s);
    expect(domToMatrixCustomHTML(root, NO_MARKDOWN)).toContain('<s>strike</s>');
  });

  it('converts <code> to <code>', () => {
    const root = el();
    const code = document.createElement('code');
    code.textContent = 'inline';
    root.appendChild(code);
    expect(domToMatrixCustomHTML(root, NO_MARKDOWN)).toContain('<code>inline</code>');
  });

  it('converts <span data-mx-spoiler> to <span data-mx-spoiler>', () => {
    const root = el();
    const span = document.createElement('span');
    span.setAttribute('data-mx-spoiler', '');
    span.textContent = 'hidden';
    root.appendChild(span);
    expect(domToMatrixCustomHTML(root, NO_MARKDOWN)).toContain(
      '<span data-mx-spoiler>hidden</span>'
    );
  });

  it('handles nested formatting', () => {
    const root = el();
    const b = document.createElement('b');
    const i = document.createElement('i');
    i.textContent = 'both';
    b.appendChild(i);
    root.appendChild(b);
    expect(domToMatrixCustomHTML(root, NO_MARKDOWN)).toContain('<strong><i>both</i></strong>');
  });

  it('ignores formatting when allowTextFormatting is false', () => {
    const root = el();
    const b = document.createElement('b');
    b.textContent = 'bold';
    root.appendChild(b);
    const html = domToMatrixCustomHTML(root, { allowTextFormatting: false });
    expect(html).not.toContain('<strong>');
    expect(html).toContain('bold');
  });

  it('converts <br> to <br/>', () => {
    const root = el();
    root.appendChild(document.createTextNode('line1'));
    root.appendChild(document.createElement('br'));
    root.appendChild(document.createTextNode('line2'));
    expect(domToMatrixCustomHTML(root, NO_MARKDOWN)).toContain('line1<br/>line2');
  });

  it('converts mention void to matrix.to link', () => {
    const root = el();
    root.appendChild(mentionNode('@alice:server.com', 'Alice'));
    const html = domToMatrixCustomHTML(root, NO_MARKDOWN);
    expect(html).toContain('href="https://matrix.to/#/@alice:server.com"');
    expect(html).toContain('>Alice</a>');
  });

  it('includes eventId and viaServers in mention link', () => {
    const root = el();
    root.appendChild(
      mentionNode('!room:server.com', 'Room', {
        eventId: '$event123',
        via: 'server1.com,server2.com',
      })
    );
    const html = domToMatrixCustomHTML(root, NO_MARKDOWN);
    expect(html).toContain('!room:server.com/$event123');
    expect(html).toContain('via=server1.com');
    expect(html).toContain('via=server2.com');
  });

  it('converts mxc emoticon void to <img>', () => {
    const root = el();
    root.appendChild(emoticonNode('mxc://example/wave', 'wave'));
    const html = domToMatrixCustomHTML(root, NO_MARKDOWN);
    expect(html).toContain('data-mx-emoticon');
    expect(html).toContain('src="mxc://example/wave"');
    expect(html).toContain('alt="wave"');
  });

  it('converts unicode emoticon void to text', () => {
    const root = el();
    root.appendChild(emoticonNode('😀', 'grinning'));
    const html = domToMatrixCustomHTML(root, NO_MARKDOWN);
    expect(html).toContain('😀');
    expect(html).not.toContain('data-mx-emoticon');
  });

  it('converts command void to /command', () => {
    const root = el();
    root.appendChild(commandNode('me'));
    const html = domToMatrixCustomHTML(root, NO_MARKDOWN);
    expect(html).toContain('/me');
  });

  it('converts <h1> to <h1>', () => {
    const root = el();
    const h1 = document.createElement('h1');
    h1.textContent = 'Title';
    root.appendChild(h1);
    expect(domToMatrixCustomHTML(root, NO_MARKDOWN)).toContain('<h1>Title</h1>');
  });

  it('converts <blockquote> to <blockquote>', () => {
    const root = el();
    const bq = document.createElement('blockquote');
    bq.textContent = 'quoted';
    root.appendChild(bq);
    expect(domToMatrixCustomHTML(root, NO_MARKDOWN)).toContain('<blockquote>quoted</blockquote>');
  });

  it('converts <pre> to <pre><code>', () => {
    const root = el();
    const pre = document.createElement('pre');
    pre.textContent = 'code here';
    root.appendChild(pre);
    expect(domToMatrixCustomHTML(root, NO_MARKDOWN)).toContain('<pre><code>code here</code></pre>');
  });

  it('converts <ol>/<ul>/<li> to list HTML', () => {
    const root = el();
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    li.textContent = 'item';
    ul.appendChild(li);
    root.appendChild(ul);
    const html = domToMatrixCustomHTML(root, NO_MARKDOWN);
    expect(html).toContain('<ul>');
    expect(html).toContain('<li><p>item</p></li>');
    expect(html).toContain('</ul>');
  });

  it('does not parse inline markdown when text has a formatting ancestor', () => {
    const root = el();
    const b = document.createElement('b');
    b.textContent = '*not italic*';
    root.appendChild(b);
    const html = domToMatrixCustomHTML(root, ALL_FORMATTING);
    expect(html).toContain('<strong>*not italic*</strong>');
    expect(html).not.toContain('<i>');
  });

  it('strips zero-width caret anchors', () => {
    const root = el();
    root.textContent = '\u200Bhello\u200B';
    const html = domToMatrixCustomHTML(root, NO_MARKDOWN);
    expect(html).not.toContain('\u200B');
    expect(html).toContain('hello');
  });
});

describe('domToPlainText', () => {
  it('extracts plain text', () => {
    const root = el();
    root.textContent = 'hello world';
    expect(domToPlainText(root)).toBe('hello world');
  });

  it('strips formatting tags', () => {
    const root = el();
    const b = document.createElement('b');
    b.textContent = 'bold';
    root.appendChild(document.createTextNode('before '));
    root.appendChild(b);
    root.appendChild(document.createTextNode(' after'));
    expect(domToPlainText(root)).toBe('before bold after');
  });

  it('converts <br> to newline', () => {
    const root = el();
    root.appendChild(document.createTextNode('line1'));
    root.appendChild(document.createElement('br'));
    root.appendChild(document.createTextNode('line2'));
    expect(domToPlainText(root)).toBe('line1\nline2');
  });

  it('converts mention to raw id', () => {
    const root = el();
    root.appendChild(mentionNode('@alice:server.com', 'Alice'));
    expect(domToPlainText(root)).toBe('@alice:server.com');
  });

  it('converts mxc emoticon to :shortcode:', () => {
    const root = el();
    root.appendChild(emoticonNode('mxc://example/wave', 'wave'));
    expect(domToPlainText(root)).toBe(':wave:');
  });

  it('converts unicode emoticon to raw key', () => {
    const root = el();
    root.appendChild(emoticonNode('😀', 'grinning'));
    expect(domToPlainText(root)).toBe('😀');
  });

  it('converts command to /command', () => {
    const root = el();
    root.appendChild(commandNode('me'));
    expect(domToPlainText(root)).toBe('/me');
  });

  it('converts blockquote lines to | prefix', () => {
    const root = el();
    const bq = document.createElement('blockquote');
    bq.textContent = 'quoted';
    root.appendChild(bq);
    expect(domToPlainText(root)).toBe('| quoted\n');
  });

  it('converts list items to - prefix', () => {
    const root = el();
    const ul = document.createElement('ul');
    const li = document.createElement('li');
    li.textContent = 'item';
    ul.appendChild(li);
    root.appendChild(ul);
    expect(domToPlainText(root)).toBe('- item\n');
  });

  it('converts heading to text with newline', () => {
    const root = el();
    const h1 = document.createElement('h1');
    h1.textContent = 'Title';
    root.appendChild(h1);
    expect(domToPlainText(root)).toBe('Title\n');
  });

  it('strips zero-width caret anchors', () => {
    const root = el();
    root.textContent = '\u200Bhello\u200B';
    expect(domToPlainText(root)).toBe('hello');
  });
});

describe('getMentionsFromDom', () => {
  it('collects user mentions by data-id', () => {
    const root = el();
    root.appendChild(mentionNode('@alice:server.com', 'Alice'));
    root.appendChild(mentionNode('@bob:server.com', 'Bob'));
    const data = getMentionsFromDom(root, mockMx);
    expect(data.users).toContain('@alice:server.com');
    expect(data.users).toContain('@bob:server.com');
    expect(data.room).toBe(false);
  });

  it('sets room to true for @room mention', () => {
    const root = el();
    root.appendChild(mentionNode('@room:server.com', '@room'));
    const data = getMentionsFromDom(root, mockMx);
    expect(data.room).toBe(true);
  });

  it('excludes current user', () => {
    const root = el();
    root.appendChild(mentionNode('@me:server.com', 'Me'));
    const data = getMentionsFromDom(root, mockMx);
    expect(data.users.size).toBe(0);
  });

  it('skips mentions inside <pre>', () => {
    const root = el();
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
    const root = el();
    root.textContent = 'hello :wave: world';
    replaceShortcodesInDom(root, shortcodeMap, mockMx, false);
    expect(root.querySelectorAll(`[${ALT_NODE_ATTR}="${ALT_EMOTICON}"]`)).toHaveLength(1);
    expect(root.textContent).toContain('hello');
    expect(root.textContent).toContain('world');
  });

  it('leaves unknown shortcodes as-is', () => {
    const root = el();
    root.textContent = 'hello :unknown: world';
    replaceShortcodesInDom(root, shortcodeMap, mockMx, false);
    expect(root.querySelectorAll(`[${ALT_NODE_ATTR}="${ALT_EMOTICON}"]`)).toHaveLength(0);
    expect(root.textContent).toContain(':unknown:');
  });

  it('handles multiple shortcodes in one text node', () => {
    const root = el();
    root.textContent = ':wave: and :smile:';
    replaceShortcodesInDom(root, shortcodeMap, mockMx, false);
    expect(root.querySelectorAll(`[${ALT_NODE_ATTR}="${ALT_EMOTICON}"]`)).toHaveLength(2);
  });

  it('skips shortcodes inside <pre>', () => {
    const root = el();
    const pre = document.createElement('pre');
    pre.textContent = ':wave:';
    root.appendChild(pre);
    replaceShortcodesInDom(root, shortcodeMap, mockMx, false);
    expect(root.querySelectorAll(`[${ALT_NODE_ATTR}="${ALT_EMOTICON}"]`)).toHaveLength(0);
  });

  it('skips shortcodes inside <code>', () => {
    const root = el();
    const code = document.createElement('code');
    code.textContent = ':wave:';
    root.appendChild(code);
    replaceShortcodesInDom(root, shortcodeMap, mockMx, false);
    expect(root.querySelectorAll(`[${ALT_NODE_ATTR}="${ALT_EMOTICON}"]`)).toHaveLength(0);
  });
});

describe('getCommandFromDom', () => {
  it('returns command from void element at start', () => {
    const root = el();
    root.appendChild(commandNode('me'));
    expect(getCommandFromDom(root)).toBe('me');
  });

  it('returns command from void element after empty text', () => {
    const root = el();
    root.appendChild(document.createTextNode(''));
    root.appendChild(commandNode('notice'));
    expect(getCommandFromDom(root)).toBe('notice');
  });

  it('returns command from /command text at start', () => {
    const root = el();
    root.textContent = '/me hello';
    expect(getCommandFromDom(root)).toBe('me');
  });

  it('returns undefined for empty input', () => {
    const root = el();
    expect(getCommandFromDom(root)).toBeUndefined();
  });

  it('returns undefined for text without slash', () => {
    const root = el();
    root.textContent = 'hello world';
    expect(getCommandFromDom(root)).toBeUndefined();
  });
});
