import type { Descendant } from 'slate';
import type { MatrixClient } from 'matrix-js-sdk';
import parse from 'html-dom-parser';
import type { ChildNode, Element } from 'domhandler';
import { isText, isTag } from 'domhandler';
import * as css from '../../styles/CustomHtml.css';
import { mxcUrlToHttp } from '../../utils/matrix';
import { sanitizeCustomHtml } from '../../utils/sanitize';
import {
  parseMatrixToRoom,
  parseMatrixToRoomEvent,
  parseMatrixToUser,
  testMatrixTo,
} from '../../plugins/matrix-to';
import type {
  CommandElement,
  EmoticonElement,
  InlineElement,
  MentionElement,
  ParagraphElement,
} from './slate';
import { BlockType } from './types';
import { createEmoticonElement, createMentionElement } from './utils';

export type MentionsData = {
  room: boolean;
  users: Set<string>;
};

export const ALT_NODE_ATTR = 'data-alt-type';
export const ALT_EMOTICON = 'emoticon';
export const ALT_MENTION = 'mention';
export const ALT_COMMAND = 'command';

// Browsers won't render a caret in an empty text node adjacent to a
// contenteditable=false sibling, so the cursor can't navigate before a void
// at the start of the input. A zero-width space (U+200B) gives the text
// node a renderable position; serializeAltInput strips it so it never
// reaches the message body.
const INLINE_VOID_CARET_ANCHOR = '\u200B';
const stripCaretAnchors = (text: string): string =>
  text.replace(new RegExp(INLINE_VOID_CARET_ANCHOR, 'g'), '');

type CreateEmoticonNodeArgs = {
  mx: MatrixClient;
  useAuthentication: boolean;
  key: string;
  shortcode: string;
};

export const createAltEmoticonNode = ({
  mx,
  useAuthentication,
  key,
  shortcode,
}: CreateEmoticonNodeArgs): HTMLSpanElement => {
  const wrapper = document.createElement('span');
  wrapper.setAttribute(ALT_NODE_ATTR, ALT_EMOTICON);
  wrapper.setAttribute('contenteditable', 'false');
  wrapper.dataset.key = key;
  wrapper.dataset.shortcode = shortcode;
  wrapper.className = css.Emoticon({ focus: false });

  if (key.startsWith('mxc://')) {
    const img = document.createElement('img');
    img.className = css.EmoticonImg;
    img.src = mxcUrlToHttp(mx, key, useAuthentication) ?? key;
    img.alt = shortcode;
    wrapper.appendChild(img);
  } else {
    wrapper.textContent = key;
  }

  return wrapper;
};

type CreateMentionNodeArgs = {
  id: string;
  name: string;
  highlight: boolean;
  eventId?: string;
  viaServers?: string[];
};

export const createAltMentionNode = ({
  id,
  name,
  highlight,
  eventId,
  viaServers,
}: CreateMentionNodeArgs): HTMLSpanElement => {
  const wrapper = document.createElement('span');
  wrapper.setAttribute(ALT_NODE_ATTR, ALT_MENTION);
  wrapper.setAttribute('contenteditable', 'false');
  wrapper.dataset.id = id;
  wrapper.dataset.name = name;
  wrapper.dataset.highlight = highlight ? 'true' : 'false';
  if (eventId) wrapper.dataset.eventId = eventId;
  if (viaServers && viaServers.length > 0) wrapper.dataset.via = viaServers.join(',');
  wrapper.className = css.Mention({ highlight, focus: false });
  wrapper.textContent = name;
  return wrapper;
};

type CreateCommandNodeArgs = {
  command: string;
};

export const createAltCommandNode = ({ command }: CreateCommandNodeArgs): HTMLSpanElement => {
  const wrapper = document.createElement('span');
  wrapper.setAttribute(ALT_NODE_ATTR, ALT_COMMAND);
  wrapper.setAttribute('contenteditable', 'false');
  wrapper.dataset.command = command;
  wrapper.className = css.Command({ active: false, focus: false });
  wrapper.textContent = `/${command}`;
  return wrapper;
};

const readEmoticonElement = (el: HTMLElement): EmoticonElement | null => {
  const key = el.dataset.key;
  const shortcode = el.dataset.shortcode;
  if (!key || !shortcode) return null;
  return createEmoticonElement(key, shortcode);
};

const readMentionElement = (el: HTMLElement): MentionElement | null => {
  const id = el.dataset.id;
  const name = el.dataset.name;
  if (!id || !name) return null;
  const highlight = el.dataset.highlight === 'true';
  const eventId = el.dataset.eventId;
  const via = el.dataset.via;
  const viaServers = via ? via.split(',').filter((s) => s.length > 0) : undefined;
  return createMentionElement(id, name, highlight, eventId, viaServers);
};

const readCommandElement = (el: HTMLElement): CommandElement | null => {
  const command = el.dataset.command;
  if (!command) return null;
  return {
    type: BlockType.Command,
    command,
    children: [{ text: '' }],
  };
};

const pushInline = (buffer: InlineElement[], node: InlineElement) => {
  if ('type' in node) {
    const last = buffer[buffer.length - 1];
    if (!last || 'type' in last) buffer.push({ text: '' });
    buffer.push(node);
    buffer.push({ text: '' });
    return;
  }
  buffer.push(node);
};

export const serializeAltInput = (el: HTMLElement): Descendant[] => {
  const children: InlineElement[] = [];

  el.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const text = stripCaretAnchors((child as Text).data);
      if (text.length === 0) return;
      const last = children[children.length - 1];
      if (last && !('type' in last)) {
        last.text += text;
      } else {
        children.push({ text });
      }
      return;
    }

    if (child.nodeType !== Node.ELEMENT_NODE) return;
    const element = child as HTMLElement;

    if (element.tagName === 'BR') {
      const last = children[children.length - 1];
      if (last && !('type' in last)) {
        last.text += '\n';
      } else {
        children.push({ text: '\n' });
      }
      return;
    }

    const altType = element.getAttribute(ALT_NODE_ATTR);
    if (altType === ALT_EMOTICON) {
      const node = readEmoticonElement(element);
      if (node) pushInline(children, node);
      return;
    }
    if (altType === ALT_MENTION) {
      const node = readMentionElement(element);
      if (node) pushInline(children, node);
      return;
    }
    if (altType === ALT_COMMAND) {
      const node = readCommandElement(element);
      if (node) pushInline(children, node);
      return;
    }

    // Unknown element: fall back to its text content so we don't lose data
    const text = stripCaretAnchors(element.textContent ?? '');
    if (text.length === 0) return;
    const last = children[children.length - 1];
    if (last && !('type' in last)) {
      last.text += text;
    } else {
      children.push({ text });
    }
  });

  if (children.length === 0) children.push({ text: '' });
  if ('type' in children[0]) children.unshift({ text: '' });
  const tail = children[children.length - 1];
  if ('type' in tail) children.push({ text: '' });

  const paragraph: ParagraphElement = {
    type: BlockType.Paragraph,
    children,
  };
  return [paragraph];
};

const placeCaretAt = (node: Node, offset: number) => {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  const sel = window.getSelection();
  sel?.removeAllRanges();
  sel?.addRange(range);
};

const ensureLeadingAnchor = (node: Node) => {
  const before = node.previousSibling;
  if (before && before.nodeType === Node.TEXT_NODE) return;
  if (before && before.nodeType === Node.ELEMENT_NODE) return;
  node.parentNode?.insertBefore(document.createTextNode(INLINE_VOID_CARET_ANCHOR), node);
};

const isAltVoidElement = (node: Node): boolean => {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  return (node as HTMLElement).hasAttribute(ALT_NODE_ATTR);
};

export const handleAltInputBackspace = (el: HTMLElement, range: Range): boolean => {
  if (!range.collapsed) return false;
  const textNode = el.firstChild;
  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) return false;
  if ((textNode as Text).data !== INLINE_VOID_CARET_ANCHOR) return false;

  const { startContainer, startOffset } = range;
  const atAnchor =
    (startContainer === textNode && startOffset <= INLINE_VOID_CARET_ANCHOR.length) ||
    (startContainer === el && startOffset === 0);
  if (!atAnchor) return false;

  const next = textNode.nextSibling;
  if (!next || !isAltVoidElement(next)) return false;

  el.removeChild(next);
  return true;
};

export const insertNodeAtRange = (el: HTMLElement, savedRange: Range | null, node: Node): Range => {
  const range = savedRange ? savedRange.cloneRange() : document.createRange();
  if (!savedRange || !el.contains(range.startContainer)) {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.deleteContents();
  range.insertNode(node);

  ensureLeadingAnchor(node);

  let after = node.nextSibling;
  if (!after || after.nodeType !== Node.TEXT_NODE) {
    after = document.createTextNode('');
    node.parentNode?.insertBefore(after, node.nextSibling);
  }

  const newRange = document.createRange();
  newRange.setStart(after, 0);
  newRange.collapse(true);
  placeCaretAt(after, 0);
  return newRange;
};

export const replaceTextInNode = (
  textNode: Text,
  start: number,
  end: number,
  replacement: string
): { node: Text; offset: number } => {
  textNode.replaceData(start, end - start, replacement);
  const offset = start + replacement.length;
  placeCaretAt(textNode, offset);
  return { node: textNode, offset };
};

type HtmlToAltInputCtx = {
  mx: MatrixClient;
  useAuthentication: boolean;
};

const BLOCK_TAGS = new Set([
  'p',
  'div',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'ul',
  'ol',
  'li',
]);

const appendVoidToParent = (parent: Node, voidNode: HTMLElement) => {
  const last = parent.lastChild;
  if (!last) {
    parent.appendChild(document.createTextNode(INLINE_VOID_CARET_ANCHOR));
  } else if (last.nodeType !== Node.TEXT_NODE) {
    parent.appendChild(document.createTextNode(''));
  }
  parent.appendChild(voidNode);
  parent.appendChild(document.createTextNode(''));
};

const WHITESPACE_ONLY = /^\s*$/;

const isBrElement = (node: Node | null): boolean =>
  node !== null && node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'BR';

const appendTextToParent = (parent: Node, text: string) => {
  if (text.length === 0) return;
  const last = parent.lastChild;
  if (WHITESPACE_ONLY.test(text) && (!last || isBrElement(last))) {
    return;
  }
  if (last && last.nodeType === Node.TEXT_NODE) {
    (last as Text).appendData(text);
    return;
  }
  parent.appendChild(document.createTextNode(text));
};

const emitBlockSeparator = (parent: Node) => {
  const last = parent.lastChild;
  if (last && last.nodeType === Node.TEXT_NODE) {
    const textNode = last as Text;
    textNode.data = textNode.data.replace(/\s+$/, '');
    if (textNode.data.length === 0) parent.removeChild(textNode);
  }
  if (parent.childNodes.length === 0) return;
  parent.appendChild(document.createElement('br'));
};

const INLINE_FORMAT_TAGS: Record<string, string> = {
  b: 'b',
  strong: 'b',
  i: 'i',
  em: 'i',
  u: 'u',
  s: 's',
  del: 's',
  strike: 's',
  code: 'code',
};

const PRESERVED_BLOCK_TAGS = new Set([
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'blockquote',
  'pre',
  'ol',
  'ul',
  'li',
]);

const collectTextContent = (nodes: ChildNode[]): string =>
  nodes
    .map((child) => {
      if (isText(child)) return child.data;
      if (isTag(child)) return collectTextContent(child.children);
      return '';
    })
    .join('');

const resolveMentionFromAnchor = (
  el: Element,
  href: string
): {
  id: string;
  name: string;
  highlight: boolean;
  eventId?: string;
  viaServers?: string[];
} | null => {
  const name = collectTextContent(el.children).trim();
  const displayName = name.length > 0 ? name : href;

  const roomEvent = parseMatrixToRoomEvent(href);
  if (roomEvent) {
    return {
      id: roomEvent.roomIdOrAlias,
      name: displayName,
      highlight: false,
      eventId: roomEvent.eventId,
      viaServers: roomEvent.viaServers,
    };
  }

  const user = parseMatrixToUser(href);
  if (user) {
    return { id: user, name: displayName, highlight: false };
  }

  const room = parseMatrixToRoom(href);
  if (room) {
    return {
      id: room.roomIdOrAlias,
      name: displayName,
      highlight: false,
      viaServers: room.viaServers,
    };
  }

  return null;
};

const walkHtmlNodes = (
  nodes: ChildNode[],
  parent: Node,
  ctx: HtmlToAltInputCtx,
  initialIsFirstBlockChild: boolean,
  insideCodeBlock = false
): boolean => {
  let isFirstBlockChild = initialIsFirstBlockChild;

  nodes.forEach((node) => {
    if (isText(node)) {
      const before = parent.lastChild;
      appendTextToParent(parent, node.data);
      if (parent.lastChild !== before) isFirstBlockChild = false;
      return;
    }
    if (!isTag(node)) return;

    const element = node;
    const tag = element.name.toLowerCase();

    if (tag === 'br') {
      parent.appendChild(document.createElement('br'));
      isFirstBlockChild = false;
      return;
    }

    if (tag === 'img' && element.attribs['data-mx-emoticon'] !== undefined) {
      const key = element.attribs.src;
      const shortcode = element.attribs.alt || element.attribs.title || '';
      if (key) {
        const voidNode = createAltEmoticonNode({
          mx: ctx.mx,
          useAuthentication: ctx.useAuthentication,
          key,
          shortcode,
        });
        appendVoidToParent(parent, voidNode);
        isFirstBlockChild = false;
      }
      return;
    }

    if (tag === 'a') {
      const href = element.attribs.href ?? '';
      if (testMatrixTo(href)) {
        const mention = resolveMentionFromAnchor(element, href);
        if (mention) {
          const voidNode = createAltMentionNode(mention);
          appendVoidToParent(parent, voidNode);
          isFirstBlockChild = false;
          return;
        }
      }
      isFirstBlockChild = walkHtmlNodes(
        element.children,
        parent,
        ctx,
        isFirstBlockChild,
        insideCodeBlock
      );
      return;
    }

    if (tag === 'span' && element.attribs['data-mx-spoiler'] !== undefined) {
      const wrapper = document.createElement('span');
      wrapper.setAttribute('data-mx-spoiler', '');
      walkHtmlNodes(element.children, wrapper, ctx, true, insideCodeBlock);
      parent.appendChild(wrapper);
      isFirstBlockChild = false;
      return;
    }

    const inlineTag = INLINE_FORMAT_TAGS[tag];
    if (inlineTag && !(insideCodeBlock && tag === 'code')) {
      const wrapper = document.createElement(inlineTag);
      walkHtmlNodes(element.children, wrapper, ctx, true, insideCodeBlock);
      parent.appendChild(wrapper);
      isFirstBlockChild = false;
      return;
    }

    if (PRESERVED_BLOCK_TAGS.has(tag)) {
      if (!isFirstBlockChild && tag !== 'li') emitBlockSeparator(parent);
      const blockEl = document.createElement(tag);
      walkHtmlNodes(element.children, blockEl, ctx, true, tag === 'pre');
      parent.appendChild(blockEl);
      isFirstBlockChild = false;
      return;
    }

    if (BLOCK_TAGS.has(tag)) {
      if (!isFirstBlockChild) emitBlockSeparator(parent);
      walkHtmlNodes(element.children, parent, ctx, true, insideCodeBlock);
      isFirstBlockChild = false;
      return;
    }

    isFirstBlockChild = walkHtmlNodes(
      element.children,
      parent,
      ctx,
      isFirstBlockChild,
      insideCodeBlock
    );
  });

  return isFirstBlockChild;
};

const NON_EMPTY_TAGS = new Set([
  'OL',
  'UL',
  'BLOCKQUOTE',
  'PRE',
  'H1',
  'H2',
  'H3',
  'H4',
  'H5',
  'H6',
]);

export const isAltInputEmpty = (el: HTMLElement): boolean => {
  const text = el.textContent ?? '';
  if (stripCaretAnchors(text).trim().length > 0) return false;
  for (let i = 0; i < el.childNodes.length; i += 1) {
    const child = el.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = (child as HTMLElement).tagName;
      if (NON_EMPTY_TAGS.has(tag)) return false;
      if ((child as HTMLElement).hasAttribute(ALT_NODE_ATTR)) return false;
    }
  }
  return true;
};

export const htmlToAltInputDom = (html: string, ctx: HtmlToAltInputCtx): DocumentFragment => {
  const sanitized = sanitizeCustomHtml(html);
  const parsed = parse(sanitized) as ChildNode[];
  const fragment = document.createDocumentFragment();
  walkHtmlNodes(parsed, fragment, ctx, true);
  return fragment;
};

export const replaceRangeWithNode = (
  textNode: Text,
  start: number,
  end: number,
  replacement: Node
): { node: Text; offset: number } => {
  const parent = textNode.parentNode;
  if (!parent) throw new Error('alt input text node has no parent');
  const after = textNode.substringData(end, textNode.data.length - end);
  textNode.deleteData(start, textNode.data.length - start);
  parent.insertBefore(replacement, textNode.nextSibling);
  const afterNode = document.createTextNode(after);
  parent.insertBefore(afterNode, replacement.nextSibling);
  if (textNode.data.length === 0 && !textNode.previousSibling) {
    textNode.appendData(INLINE_VOID_CARET_ANCHOR);
  }
  placeCaretAt(afterNode, 0);
  return { node: afterNode, offset: 0 };
};
