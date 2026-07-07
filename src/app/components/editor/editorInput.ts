import type { MatrixClient } from 'matrix-js-sdk';
import parse from 'html-dom-parser';
import type { ChildNode, Element } from 'domhandler';
import { isText, isTag } from 'domhandler';
import * as css from '../../styles/CustomHtml.css';
import { mxcUrlToEmojiHttp } from '../../utils/matrix';
import { sanitizeCustomHtml } from '../../utils/sanitize';
import {
  parseMatrixToRoom,
  parseMatrixToRoomEvent,
  parseMatrixToUser,
  testMatrixTo,
} from '../../plugins/matrix-to';

export type MentionsData = {
  room: boolean;
  users: Set<string>;
};

export const NODE_TYPE_ATTR = 'data-node-type';
export const EMOTICON_NODE = 'emoticon';
export const MENTION_NODE = 'mention';
export const COMMAND_NODE = 'command';

// Browsers won't render a caret in an empty text node adjacent to a
// contenteditable=false sibling. A zero-width space (U+200B) gives the text
// node a renderable position; stripCaretAnchors removes it before serialization
// so it never reaches the message body.
const INLINE_VOID_CARET_ANCHOR = '\u200B';
const stripCaretAnchors = (text: string): string =>
  text.replace(new RegExp(INLINE_VOID_CARET_ANCHOR, 'g'), '');

type CreateEmoticonNodeArgs = {
  mx: MatrixClient;
  useAuthentication: boolean;
  key: string;
  shortcode: string;
};

export const createEmoticonNode = ({
  mx,
  useAuthentication,
  key,
  shortcode,
}: CreateEmoticonNodeArgs): HTMLSpanElement => {
  const wrapper = document.createElement('span');
  wrapper.setAttribute(NODE_TYPE_ATTR, EMOTICON_NODE);
  wrapper.setAttribute('contenteditable', 'false');
  wrapper.dataset.key = key;
  wrapper.dataset.shortcode = shortcode;
  wrapper.className = css.Emoticon({ focus: false });

  if (key.startsWith('mxc://')) {
    const img = document.createElement('img');
    img.className = css.EmoticonImg;
    img.src = mxcUrlToEmojiHttp(mx, key, useAuthentication) ?? key;
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

export const createMentionNode = ({
  id,
  name,
  highlight,
  eventId,
  viaServers,
}: CreateMentionNodeArgs): HTMLSpanElement => {
  const wrapper = document.createElement('span');
  wrapper.setAttribute(NODE_TYPE_ATTR, MENTION_NODE);
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

export const createCommandNode = ({ command }: CreateCommandNodeArgs): HTMLSpanElement => {
  const wrapper = document.createElement('span');
  wrapper.setAttribute(NODE_TYPE_ATTR, COMMAND_NODE);
  wrapper.setAttribute('contenteditable', 'false');
  wrapper.dataset.command = command;
  wrapper.className = css.Command({ active: false, focus: false });
  wrapper.textContent = `/${command}`;
  return wrapper;
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

const isVoidElement = (node: Node): boolean => {
  if (node.nodeType !== Node.ELEMENT_NODE) return false;
  return (node as HTMLElement).hasAttribute(NODE_TYPE_ATTR);
};

export const handleEditorBackspace = (el: HTMLElement, range: Range): boolean => {
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
  if (!next || !isVoidElement(next)) return false;

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
  convertListsToMarkdown?: boolean;
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
  if (isBrElement(parent.lastChild)) return;
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

const LINE_BREAKING_TAGS = new Set([
  'ul',
  'ol',
  'blockquote',
  'pre',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'br',
]);

const containsLineBreakingTag = (nodes: ChildNode[]): boolean =>
  nodes.some(
    (child) =>
      isTag(child) &&
      (LINE_BREAKING_TAGS.has(child.name.toLowerCase()) || containsLineBreakingTag(child.children))
  );

const containsTagName = (nodes: ChildNode[], name: string): boolean =>
  nodes.some(
    (child) => isTag(child) && (child.name === name || containsTagName(child.children, name))
  );

const isSingleLineListItem = (listItem: Element): boolean => {
  if (containsLineBreakingTag(listItem.children)) return false;
  if (
    collectTextContent(listItem.children).trim().length === 0 &&
    !containsTagName(listItem.children, 'img')
  ) {
    return false;
  }
  const paragraphCount = listItem.children.filter(
    (child) => isTag(child) && (child.name === 'p' || child.name === 'div')
  ).length;
  return paragraphCount <= 1;
};

const LETTER_MARKER = /^[a-zA-Z]$/;
const NUMERIC_MARKER = /^\d+$/;

const getListLineMarkers = (list: Element, listItems: Element[]): string[] | null => {
  if (listItems.length === 0) return null;
  if (!listItems.every(isSingleLineListItem)) return null;

  if (list.name === 'ul') return listItems.map(() => '*');

  const dataMd = list.attribs['data-md'];
  if (dataMd === '-') return listItems.map(() => '-');

  const letterMarker = [dataMd, list.attribs.type].find(
    (value) => value !== undefined && LETTER_MARKER.test(value)
  );
  if (letterMarker) {
    const firstCharCode = letterMarker.charCodeAt(0);
    const lastCharCode = firstCharCode + listItems.length - 1;
    const maxCharCode = letterMarker === letterMarker.toLowerCase() ? 122 : 90;
    if (lastCharCode > maxCharCode) return null;
    return listItems.map((_, index) => `${String.fromCharCode(firstCharCode + index)}.`);
  }

  const numericMarker = [dataMd, list.attribs.start].find(
    (value) => value !== undefined && NUMERIC_MARKER.test(value)
  );
  const firstNumber = numericMarker ? Number(numericMarker) : 1;
  return listItems.map((_, index) => `${firstNumber + index}.`);
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
        const voidNode = createEmoticonNode({
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
          const voidNode = createMentionNode(mention);
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

    if (
      ctx.convertListsToMarkdown &&
      (tag === 'ol' || tag === 'ul') &&
      parent.nodeType === Node.DOCUMENT_FRAGMENT_NODE
    ) {
      const listItems = element.children.filter(
        (child): child is Element => isTag(child) && child.name === 'li'
      );
      const markers = getListLineMarkers(element, listItems);
      if (markers) {
        if (!isFirstBlockChild) emitBlockSeparator(parent);
        listItems.forEach((listItem, index) => {
          if (index > 0) emitBlockSeparator(parent);
          appendTextToParent(parent, `${markers[index]} `);
          walkHtmlNodes(listItem.children, parent, ctx, true, insideCodeBlock);
        });
        const followingNode = element.next;
        if (
          followingNode &&
          !(isTag(followingNode) && BLOCK_TAGS.has(followingNode.name.toLowerCase()))
        ) {
          emitBlockSeparator(parent);
        }
        isFirstBlockChild = false;
        return;
      }
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

export const isEditorEmpty = (el: HTMLElement): boolean => {
  const text = el.textContent ?? '';
  if (stripCaretAnchors(text).trim().length > 0) return false;
  for (let i = 0; i < el.childNodes.length; i += 1) {
    const child = el.childNodes[i];
    if (child.nodeType === Node.ELEMENT_NODE) {
      const tag = (child as HTMLElement).tagName;
      if (NON_EMPTY_TAGS.has(tag)) return false;
      if ((child as HTMLElement).hasAttribute(NODE_TYPE_ATTR)) return false;
    }
  }
  return true;
};

const ROOT_BLOCK_TAGS = new Set([
  'DIV',
  'P',
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
  'LI',
]);

const isRootBlock = (node: Node): boolean =>
  node.nodeType === Node.ELEMENT_NODE && ROOT_BLOCK_TAGS.has((node as HTMLElement).tagName);

// The serializer (domToPlainText / domToMatrixCustomHTML) emits a line separator
// after a block element but nothing around a bare text or inline node. So a root
// that mixes blocks with bare inline siblings — e.g. `<div>a</div>b<div>c</div>`,
// which the browser's native contentEditable handling can produce — serializes
// with the inline run silently joined to its neighbor. Wrapping each maximal run
// of inline siblings in its own block restores a uniform structure. Returns true
// if it mutated the DOM. Reparents existing nodes, so the caret is captured and
// restored around the move.
export const normalizeEditorRoot = (element: HTMLElement): boolean => {
  const children = Array.from(element.childNodes);
  const hasBlock = children.some(isRootBlock);
  const hasInline = children.some((node) => !isRootBlock(node));
  if (!hasBlock || !hasInline) return false;

  const selection = window.getSelection();
  let caret: { node: Node; offset: number } | null = null;
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    if (
      range.collapsed &&
      range.startContainer !== element &&
      element.contains(range.startContainer)
    ) {
      caret = { node: range.startContainer, offset: range.startOffset };
    }
  }

  let run: Node[] = [];
  const flushRun = () => {
    if (run.length === 0) return;
    const block = document.createElement('div');
    element.insertBefore(block, run[0]);
    run.forEach((node) => block.appendChild(node));
    run = [];
  };
  children.forEach((child) => {
    if (isRootBlock(child)) {
      flushRun();
    } else {
      run.push(child);
    }
  });
  flushRun();

  if (caret && caret.node.isConnected) {
    const range = document.createRange();
    range.setStart(caret.node, caret.offset);
    range.collapse(true);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }

  return true;
};

// Parse the draft as-is; routing it through htmlToEditorDom/sanitize strips the
// internal void-node attributes and flattens mentions/emojis to text.
export const restoreEditorDraft = (element: HTMLElement, html: string): void => {
  const template = document.createElement('template');
  template.innerHTML = html;
  element.replaceChildren(template.content);
  normalizeEditorRoot(element);
};

export type HtmlToEditorDomOptions = Pick<HtmlToAltInputCtx, 'convertListsToMarkdown'>;

export const htmlToEditorDom = (html: string, ctx: HtmlToAltInputCtx): DocumentFragment => {
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
