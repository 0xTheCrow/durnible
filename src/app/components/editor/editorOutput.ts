import type { MatrixClient } from 'matrix-js-sdk';
import { sanitizeText } from '../../utils/sanitize';
import { parseBlockMD, parseInlineMD } from '../../plugins/markdown';
import { findAndReplace } from '../../utils/findAndReplace';
import { isUserId } from '../../utils/matrix';
import { sanitizeForRegex } from '../../utils/regex';
import {
  COMMAND_NODE,
  EMOTICON_NODE,
  MENTION_NODE,
  NODE_TYPE_ATTR,
  createEmoticonNode,
} from './editorInput';
import type { MentionsData } from './editorInput';
import type { ShortcodeMapEntry } from '../../plugins/emoji';

export const customHtmlEqualsPlainText = (customHtml: string, plain: string): boolean =>
  customHtml.replace(/<br\/>/g, '\n') === sanitizeText(plain);

export const trimCustomHtml = (customHtml: string) => customHtml.replace(/<br\/>$/g, '').trim();

export const trimCommand = (cmdName: string, str: string) => {
  const cmdRegX = new RegExp(`^(\\s+)?(\\/${sanitizeForRegex(cmdName)})([^\\S\n]+)?`);
  const match = str.match(cmdRegX);
  if (!match) return str;
  return str.slice(match[0].length);
};

export type DomOutputOptions = {
  allowMarkdown?: boolean;
};

const stripCaretAnchors = (text: string): string => text.replace(/\u200B/g, '');

const FORMATTING_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'STRIKE', 'CODE']);

const isInsideTag = (node: Node, rootElement: HTMLElement, tag: string): boolean => {
  let current: Node | null = node.parentNode;
  while (current && current !== rootElement) {
    if (current.nodeType === Node.ELEMENT_NODE && (current as HTMLElement).tagName === tag) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
};

const LINE_CONTAINER_TAGS = new Set(['DIV', 'P']);

const BLOCK_LINE_TAGS = new Set(['H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'BLOCKQUOTE', 'LI']);

const BLOCK_CONTAINER_TAGS = new Set(['PRE', 'OL', 'UL']);

const hasOnlyLineContainerAncestors = (node: Node, root: HTMLElement): boolean => {
  let current: Node | null = node.parentNode;
  while (current && current !== root) {
    if (
      current.nodeType !== Node.ELEMENT_NODE ||
      !LINE_CONTAINER_TAGS.has((current as HTMLElement).tagName)
    ) {
      return false;
    }
    current = current.parentNode;
  }
  return current === root;
};

const isBlockMarkdownLineBreak = (node: Node, root: HTMLElement, opts: DomOutputOptions): boolean =>
  Boolean(opts.allowMarkdown) && hasOnlyLineContainerAncestors(node, root);

const QUOTE_MARKER_AT_LINE_START = /^(\\*)&gt;/gm;
const unescapeQuoteMarkers = (html: string): string =>
  html.replace(QUOTE_MARKER_AT_LINE_START, '$1>');

const HTML_TAG_RE = /<([\w-]+)(?: [^>]*)?(?:(?:\/>)|(?:>.*?<\/\1>))/g;
const ignoreHTMLParseInlineMD = (text: string): string =>
  findAndReplace(
    text,
    HTML_TAG_RE,
    (match) => match[0],
    (txt) => parseInlineMD(txt)
  ).join('');

const voidToCustomHtml = (element: HTMLElement): string => {
  const altType = element.getAttribute(NODE_TYPE_ATTR);

  if (altType === MENTION_NODE) {
    const id = element.dataset.id ?? '';
    const name = element.dataset.name ?? '';
    const eventId = element.dataset.eventId;
    const via = element.dataset.via;

    let fragment = id;
    if (eventId) fragment += `/${eventId}`;
    if (via) {
      const servers = via.split(',').filter((s) => s.length > 0);
      if (servers.length > 0) {
        fragment += `?${servers.map((s) => `via=${s}`).join('&')}`;
      }
    }
    const matrixTo = `https://matrix.to/#/${fragment}`;
    return `<a href="${encodeURI(matrixTo)}">${sanitizeText(name)}</a>`;
  }

  if (altType === EMOTICON_NODE) {
    const key = element.dataset.key ?? '';
    const shortcode = element.dataset.shortcode ?? '';
    if (key.startsWith('mxc://')) {
      return `<img data-mx-emoticon src="${key}" alt="${sanitizeText(
        shortcode
      )}" title="${sanitizeText(shortcode)}" height="32" />`;
    }
    return sanitizeText(key);
  }

  if (altType === COMMAND_NODE) {
    const command = element.dataset.command ?? '';
    return `/${sanitizeText(command)}`;
  }

  return sanitizeText(element.textContent ?? '');
};

const voidToPlainText = (element: HTMLElement): string => {
  const altType = element.getAttribute(NODE_TYPE_ATTR);

  if (altType === MENTION_NODE) {
    return element.dataset.id ?? '';
  }

  if (altType === EMOTICON_NODE) {
    const key = element.dataset.key ?? '';
    const shortcode = element.dataset.shortcode ?? '';
    if (key.startsWith('mxc://')) return `:${shortcode}:`;
    return key;
  }

  if (altType === COMMAND_NODE) {
    const command = element.dataset.command ?? '';
    return `/${command}`;
  }

  return stripCaretAnchors(element.textContent ?? '');
};

const nodeToCustomHtml = (node: Node, root: HTMLElement, opts: DomOutputOptions): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = stripCaretAnchors((node as Text).data);
    if (raw.length === 0) return '';
    return sanitizeText(raw);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as HTMLElement;

  if (element.hasAttribute(NODE_TYPE_ATTR)) {
    return voidToCustomHtml(element);
  }

  const tag = element.tagName;

  if (tag === 'BR') {
    return isBlockMarkdownLineBreak(element, root, opts) ? '\n' : '<br/>';
  }

  const childHtml = childrenToCustomHtml(element, root, opts);

  if (opts.allowMarkdown) {
    if (tag === 'B' || tag === 'STRONG') return `<strong>${childHtml}</strong>`;
    if (tag === 'I' || tag === 'EM') return `<i>${childHtml}</i>`;
    if (tag === 'U') return `<u>${childHtml}</u>`;
    if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') return `<s>${childHtml}</s>`;
    if (tag === 'CODE' && !isInsideTag(element, root, 'PRE')) return `<code>${childHtml}</code>`;
    if (element.hasAttribute('data-mx-spoiler')) return `<span data-mx-spoiler>${childHtml}</span>`;
  } else {
    if (BLOCK_LINE_TAGS.has(tag)) return `${childHtml}<br/>`;
    if (BLOCK_CONTAINER_TAGS.has(tag)) return childHtml;
  }

  if (tag === 'H1') return `<h1>${childHtml}</h1>`;
  if (tag === 'H2') return `<h2>${childHtml}</h2>`;
  if (tag === 'H3') return `<h3>${childHtml}</h3>`;
  if (tag === 'H4') return `<h4>${childHtml}</h4>`;
  if (tag === 'H5') return `<h5>${childHtml}</h5>`;
  if (tag === 'H6') return `<h6>${childHtml}</h6>`;

  if (tag === 'BLOCKQUOTE') return `<blockquote>${childHtml}</blockquote>`;
  if (tag === 'PRE') return `<pre><code>${childHtml}</code></pre>`;
  if (tag === 'OL') return `<ol>${childHtml}</ol>`;
  if (tag === 'UL') return `<ul>${childHtml}</ul>`;
  if (tag === 'LI') return `<li><p>${childHtml}</p></li>`;

  if (tag === 'DIV' || tag === 'P') {
    return isBlockMarkdownLineBreak(element, root, opts) ? `${childHtml}\n` : `${childHtml}<br/>`;
  }

  return childHtml;
};

const childrenToCustomHtml = (
  parent: HTMLElement,
  root: HTMLElement,
  opts: DomOutputOptions
): string => {
  let result = '';
  parent.childNodes.forEach((child) => {
    result += nodeToCustomHtml(child, root, opts);
  });
  return result;
};

export const domToMatrixCustomHTML = (rootElement: HTMLElement, opts: DomOutputOptions): string => {
  const hasBlocks =
    rootElement.querySelector('h1, h2, h3, h4, h5, h6, blockquote, pre, ol, ul, div, p, li') !==
    null;

  if (hasBlocks) {
    let html = '';
    rootElement.childNodes.forEach((child) => {
      html += nodeToCustomHtml(child, rootElement, opts);
    });

    if (opts.allowMarkdown) {
      html = parseBlockMD(unescapeQuoteMarkers(html), ignoreHTMLParseInlineMD);
    }
    return html;
  }

  let lineHtml = '';
  rootElement.childNodes.forEach((child) => {
    lineHtml += nodeToCustomHtml(child, rootElement, opts);
  });
  lineHtml += '<br/>';

  if (opts.allowMarkdown) {
    const asLine = unescapeQuoteMarkers(lineHtml.replace(/<br\/>$/, '\n'));
    return parseBlockMD(asLine, ignoreHTMLParseInlineMD);
  }

  return lineHtml;
};

const LINE_BREAK = '<br/>';

const HEADING_MARKERS: Record<string, string> = {
  H1: '#',
  H2: '##',
  H3: '###',
  H4: '####',
  H5: '#####',
  H6: '######',
};

const BLOCK_ELEMENT_TAGS = new Set([
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
  'BLOCKQUOTE',
  'PRE',
  'OL',
  'UL',
]);

const isBlockSeparator = (node: Node): boolean => {
  let previous: Node | null = node.previousSibling;
  while (previous && previous.nodeType === Node.TEXT_NODE && previous.textContent === '') {
    previous = previous.previousSibling;
  }
  return (
    previous !== null &&
    previous.nodeType === Node.ELEMENT_NODE &&
    BLOCK_ELEMENT_TAGS.has((previous as HTMLElement).tagName)
  );
};

const prefixLines = (markdown: string, prefix: string): string =>
  markdown
    .split(LINE_BREAK)
    .map((line) => `${prefix}${line}`)
    .join(LINE_BREAK);

const TRAILING_LINE_BREAK = /<br\/>$/;

const asBlockLine = (markdown: string): string =>
  markdown.endsWith(LINE_BREAK) ? markdown : `${markdown}${LINE_BREAK}`;

const nodeToMarkdown = (node: Node, root: HTMLElement): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return sanitizeText(stripCaretAnchors((node as Text).data));
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as HTMLElement;

  if (element.hasAttribute(NODE_TYPE_ATTR)) {
    return voidToCustomHtml(element);
  }

  const tag = element.tagName;

  if (tag === 'BR') return isBlockSeparator(element) ? '' : LINE_BREAK;

  const childMarkdown = childrenToMarkdown(element, root);

  if (tag === 'B' || tag === 'STRONG') return `**${childMarkdown}**`;
  if (tag === 'I' || tag === 'EM') return `*${childMarkdown}*`;
  if (tag === 'U') return `__${childMarkdown}__`;
  if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') return `~~${childMarkdown}~~`;
  if (tag === 'CODE' && !isInsideTag(element, root, 'PRE')) return `\`${childMarkdown}\``;
  if (element.hasAttribute('data-mx-spoiler')) return `||${childMarkdown}||`;

  const headingMarker = HEADING_MARKERS[tag];
  if (headingMarker) return asBlockLine(`${headingMarker} ${childMarkdown}`);

  if (tag === 'BLOCKQUOTE') {
    const lines = childMarkdown.replace(TRAILING_LINE_BREAK, '');
    return asBlockLine(prefixLines(lines, '> '));
  }

  if (tag === 'PRE') {
    const lines = childMarkdown.replace(/\n/g, LINE_BREAK).replace(TRAILING_LINE_BREAK, '');
    return `\`\`\`${LINE_BREAK}${lines}${LINE_BREAK}\`\`\`${LINE_BREAK}`;
  }

  if (tag === 'OL' || tag === 'UL') return childMarkdown;

  if (tag === 'LI') {
    const parentTag = element.parentElement?.tagName;
    const marker =
      parentTag === 'OL'
        ? `${Array.from(element.parentElement?.children ?? []).indexOf(element) + 1}.`
        : '*';
    return asBlockLine(`${marker} ${childMarkdown}`);
  }

  if (tag === 'DIV' || tag === 'P') return asBlockLine(childMarkdown);

  return childMarkdown;
};

const childrenToMarkdown = (parent: HTMLElement, root: HTMLElement): string => {
  let result = '';
  parent.childNodes.forEach((child) => {
    result += nodeToMarkdown(child, root);
  });
  return result;
};

export const domToMarkdown = (rootElement: HTMLElement): string => {
  let markdown = '';
  rootElement.childNodes.forEach((child) => {
    markdown += nodeToMarkdown(child, rootElement);
  });
  return markdown.replace(TRAILING_LINE_BREAK, '');
};

const nodeToPlainText = (node: Node, root: HTMLElement): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return stripCaretAnchors((node as Text).data);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as HTMLElement;

  if (element.hasAttribute(NODE_TYPE_ATTR)) {
    return voidToPlainText(element);
  }

  const tag = element.tagName;
  if (tag === 'BR') return '\n';

  const childText = childrenToPlainText(element, root);

  if (FORMATTING_TAGS.has(tag) || element.hasAttribute('data-mx-spoiler')) {
    return childText;
  }

  if (tag === 'BLOCKQUOTE') {
    const lines = childText.split('\n').filter((l) => l.length > 0);
    return `${lines.map((l) => `| ${l}`).join('\n')}\n`;
  }

  if (tag === 'PRE') return `${childText}\n`;
  if (tag === 'LI') return `- ${childText}\n`;
  if (tag === 'OL' || tag === 'UL') return childText;

  if (tag.match(/^H[1-6]$/)) return `${childText}\n`;
  if (tag === 'DIV' || tag === 'P') return `${childText}\n`;

  return childText;
};

const childrenToPlainText = (parent: HTMLElement, root: HTMLElement): string => {
  let result = '';
  parent.childNodes.forEach((child) => {
    result += nodeToPlainText(child, root);
  });
  return result;
};

export const domToPlainText = (rootElement: HTMLElement): string => {
  let text = '';
  rootElement.childNodes.forEach((child) => {
    text += nodeToPlainText(child, rootElement);
  });
  return text;
};

export const getMentionsFromDom = (rootElement: HTMLElement, mx: MatrixClient): MentionsData => {
  const data: MentionsData = { room: false, users: new Set() };

  const mentions = rootElement.querySelectorAll(`[${NODE_TYPE_ATTR}="${MENTION_NODE}"]`);
  mentions.forEach((mention) => {
    if (isInsideTag(mention, rootElement, 'PRE')) return;

    const htmlMention = mention as HTMLElement;
    const name = htmlMention.dataset.name;
    const id = htmlMention.dataset.id;

    if (name === '@room') {
      data.room = true;
    }
    if (id && isUserId(id) && id !== mx.getUserId()) {
      data.users.add(id);
    }
  });

  return data;
};

const SHORTCODE_RE = /:([a-zA-Z0-9_.+-]+):/g;

export const replaceShortcodesInDom = (
  rootElement: HTMLElement,
  shortcodeMap: Map<string, ShortcodeMapEntry>,
  mx: MatrixClient,
  useAuthentication: boolean
): void => {
  const walker = document.createTreeWalker(rootElement, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (!isInsideTag(current, rootElement, 'PRE') && !isInsideTag(current, rootElement, 'CODE')) {
      textNodes.push(current as Text);
    }
    current = walker.nextNode();
  }

  textNodes.forEach((textNode) => {
    const text = textNode.data;
    SHORTCODE_RE.lastIndex = 0;
    const matches: { index: number; length: number; entry: ShortcodeMapEntry }[] = [];
    let match = SHORTCODE_RE.exec(text);
    while (match !== null) {
      const entry = shortcodeMap.get(match[1]);
      if (entry) {
        matches.push({ index: match.index, length: match[0].length, entry });
      }
      match = SHORTCODE_RE.exec(text);
    }
    if (matches.length === 0) return;

    const parent = textNode.parentNode;
    if (!parent) return;
    const fragment = document.createDocumentFragment();
    let lastIndex = 0;

    matches.forEach(({ index, length, entry }) => {
      const before = text.slice(lastIndex, index);
      if (before) fragment.appendChild(document.createTextNode(before));

      const emoticonNode = createEmoticonNode({
        mx,
        useAuthentication,
        key: entry.key,
        shortcode: entry.shortcode,
      });
      fragment.appendChild(emoticonNode);
      lastIndex = index + length;
    });

    const remaining = text.slice(lastIndex);
    if (remaining) fragment.appendChild(document.createTextNode(remaining));

    parent.replaceChild(fragment, textNode);
  });
};

export const getCommandFromDom = (rootElement: HTMLElement): string | undefined => {
  const firstChild = rootElement.firstChild;
  if (!firstChild) return undefined;

  if (firstChild.nodeType === Node.TEXT_NODE) {
    const text = stripCaretAnchors((firstChild as Text).data);
    if (text.trimStart().length === 0) {
      const second = firstChild.nextSibling;
      if (
        second &&
        second.nodeType === Node.ELEMENT_NODE &&
        (second as HTMLElement).getAttribute(NODE_TYPE_ATTR) === COMMAND_NODE
      ) {
        return (second as HTMLElement).dataset.command;
      }
    }
    const match = text.match(/^\/(\S+)/);
    if (match) return match[1];
  }

  if (
    firstChild.nodeType === Node.ELEMENT_NODE &&
    (firstChild as HTMLElement).getAttribute(NODE_TYPE_ATTR) === COMMAND_NODE
  ) {
    return (firstChild as HTMLElement).dataset.command;
  }

  return undefined;
};
