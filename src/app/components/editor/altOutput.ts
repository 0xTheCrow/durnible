import type { MatrixClient } from 'matrix-js-sdk';
import { sanitizeText } from '../../utils/sanitize';
import { parseBlockMD, parseInlineMD } from '../../plugins/markdown';
import { findAndReplace } from '../../utils/findAndReplace';
import { isUserId } from '../../utils/matrix';
import {
  ALT_COMMAND,
  ALT_EMOTICON,
  ALT_MENTION,
  ALT_NODE_ATTR,
  createAltEmoticonNode,
} from './altInput';
import type { MentionsData } from './altInput';
import type { ShortcodeMapEntry } from '../../plugins/emoji';

export type DomOutputOptions = {
  allowTextFormatting?: boolean;
  allowInlineMarkdown?: boolean;
  allowBlockMarkdown?: boolean;
};

const stripCaretAnchors = (text: string): string => text.replace(/\u200B/g, '');

const FORMATTING_TAGS = new Set(['B', 'STRONG', 'I', 'EM', 'U', 'S', 'DEL', 'STRIKE', 'CODE']);

const isInsideTag = (node: Node, el: HTMLElement, tag: string): boolean => {
  let current: Node | null = node.parentNode;
  while (current && current !== el) {
    if (current.nodeType === Node.ELEMENT_NODE && (current as HTMLElement).tagName === tag) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
};

const hasFormattingAncestor = (node: Node, el: HTMLElement): boolean => {
  let current: Node | null = node.parentNode;
  while (current && current !== el) {
    if (
      current.nodeType === Node.ELEMENT_NODE &&
      FORMATTING_TAGS.has((current as HTMLElement).tagName)
    ) {
      return true;
    }
    current = current.parentNode;
  }
  return false;
};

const HTML_TAG_RE = /<([\w-]+)(?: [^>]*)?(?:(?:\/>)|(?:>.*?<\/\1>))/g;
const ignoreHTMLParseInlineMD = (text: string): string =>
  findAndReplace(
    text,
    HTML_TAG_RE,
    (match) => match[0],
    (txt) => parseInlineMD(txt)
  ).join('');

const voidToCustomHtml = (element: HTMLElement): string => {
  const altType = element.getAttribute(ALT_NODE_ATTR);

  if (altType === ALT_MENTION) {
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

  if (altType === ALT_EMOTICON) {
    const key = element.dataset.key ?? '';
    const shortcode = element.dataset.shortcode ?? '';
    if (key.startsWith('mxc://')) {
      return `<img data-mx-emoticon src="${key}" alt="${sanitizeText(
        shortcode
      )}" title="${sanitizeText(shortcode)}" height="32" />`;
    }
    return sanitizeText(key);
  }

  if (altType === ALT_COMMAND) {
    const command = element.dataset.command ?? '';
    return `/${sanitizeText(command)}`;
  }

  return sanitizeText(element.textContent ?? '');
};

const voidToPlainText = (element: HTMLElement): string => {
  const altType = element.getAttribute(ALT_NODE_ATTR);

  if (altType === ALT_MENTION) {
    return element.dataset.id ?? '';
  }

  if (altType === ALT_EMOTICON) {
    const key = element.dataset.key ?? '';
    const shortcode = element.dataset.shortcode ?? '';
    if (key.startsWith('mxc://')) return `:${shortcode}:`;
    return key;
  }

  if (altType === ALT_COMMAND) {
    const command = element.dataset.command ?? '';
    return `/${command}`;
  }

  return stripCaretAnchors(element.textContent ?? '');
};

const nodeToCustomHtml = (node: Node, root: HTMLElement, opts: DomOutputOptions): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    const raw = stripCaretAnchors((node as Text).data);
    if (raw.length === 0) return '';
    let text = sanitizeText(raw);
    if (opts.allowInlineMarkdown && !hasFormattingAncestor(node, root)) {
      text = parseInlineMD(text);
    }
    return text;
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as HTMLElement;

  if (element.hasAttribute(ALT_NODE_ATTR)) {
    return voidToCustomHtml(element);
  }

  const tag = element.tagName;

  if (tag === 'BR') return '<br/>';

  const childHtml = childrenToCustomHtml(element, root, opts);

  if (opts.allowTextFormatting) {
    if (tag === 'B' || tag === 'STRONG') return `<strong>${childHtml}</strong>`;
    if (tag === 'I' || tag === 'EM') return `<i>${childHtml}</i>`;
    if (tag === 'U') return `<u>${childHtml}</u>`;
    if (tag === 'S' || tag === 'DEL' || tag === 'STRIKE') return `<s>${childHtml}</s>`;
    if (tag === 'CODE' && !isInsideTag(element, root, 'PRE')) return `<code>${childHtml}</code>`;
    if (element.hasAttribute('data-mx-spoiler')) return `<span data-mx-spoiler>${childHtml}</span>`;
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

  if (tag === 'DIV' || tag === 'P') return `${childHtml}<br/>`;

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

export const domToMatrixCustomHTML = (el: HTMLElement, opts: DomOutputOptions): string => {
  const hasBlocks =
    el.querySelector('h1, h2, h3, h4, h5, h6, blockquote, pre, ol, ul, div, p, li') !== null;

  if (hasBlocks) {
    let html = '';
    el.childNodes.forEach((child) => {
      html += nodeToCustomHtml(child, el, opts);
    });

    if (opts.allowBlockMarkdown) {
      html = parseBlockMD(html, ignoreHTMLParseInlineMD);
    }
    return html;
  }

  let lineHtml = '';
  el.childNodes.forEach((child) => {
    lineHtml += nodeToCustomHtml(child, el, opts);
  });
  lineHtml += '<br/>';

  if (opts.allowBlockMarkdown) {
    const asLine = lineHtml.replace(/<br\/>$/, '\n').replace(/^(\\*)&gt;/, '$1>');
    return parseBlockMD(asLine, ignoreHTMLParseInlineMD);
  }

  return lineHtml;
};

const nodeToPlainText = (node: Node, root: HTMLElement): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return stripCaretAnchors((node as Text).data);
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return '';
  const element = node as HTMLElement;

  if (element.hasAttribute(ALT_NODE_ATTR)) {
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

export const domToPlainText = (el: HTMLElement): string => {
  let text = '';
  el.childNodes.forEach((child) => {
    text += nodeToPlainText(child, el);
  });
  return text;
};

export const getMentionsFromDom = (el: HTMLElement, mx: MatrixClient): MentionsData => {
  const data: MentionsData = { room: false, users: new Set() };

  const mentions = el.querySelectorAll(`[${ALT_NODE_ATTR}="${ALT_MENTION}"]`);
  mentions.forEach((mention) => {
    if (isInsideTag(mention, el, 'PRE')) return;

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
  el: HTMLElement,
  shortcodeMap: Map<string, ShortcodeMapEntry>,
  mx: MatrixClient,
  useAuthentication: boolean
): void => {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    if (!isInsideTag(current, el, 'PRE') && !isInsideTag(current, el, 'CODE')) {
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

      const emoticonNode = createAltEmoticonNode({
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

export const getCommandFromDom = (el: HTMLElement): string | undefined => {
  const firstChild = el.firstChild;
  if (!firstChild) return undefined;

  if (firstChild.nodeType === Node.TEXT_NODE) {
    const text = stripCaretAnchors((firstChild as Text).data);
    if (text.trimStart().length === 0) {
      const second = firstChild.nextSibling;
      if (
        second &&
        second.nodeType === Node.ELEMENT_NODE &&
        (second as HTMLElement).getAttribute(ALT_NODE_ATTR) === ALT_COMMAND
      ) {
        return (second as HTMLElement).dataset.command;
      }
    }
    const match = text.match(/^\/(\S+)/);
    if (match) return match[1];
  }

  if (
    firstChild.nodeType === Node.ELEMENT_NODE &&
    (firstChild as HTMLElement).getAttribute(ALT_NODE_ATTR) === ALT_COMMAND
  ) {
    return (firstChild as HTMLElement).dataset.command;
  }

  return undefined;
};
