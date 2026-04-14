import type { Descendant } from 'slate';
import type { MatrixClient } from 'matrix-js-sdk';
import * as css from '../../styles/CustomHtml.css';
import { mxcUrlToHttp } from '../../utils/matrix';
import type {
  CommandElement,
  EmoticonElement,
  InlineElement,
  MentionElement,
  ParagraphElement,
} from './slate';
import { BlockType } from './types';
import { createEmoticonElement, createMentionElement } from './utils';

export const ALT_NODE_ATTR = 'data-alt-type';
export const ALT_EMOTICON = 'emoticon';
export const ALT_MENTION = 'mention';
export const ALT_COMMAND = 'command';

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
      const text = (child as Text).data;
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
    const text = element.textContent ?? '';
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

export const insertNodeAtRange = (el: HTMLElement, savedRange: Range | null, node: Node): Range => {
  const range = savedRange ? savedRange.cloneRange() : document.createRange();
  if (!savedRange || !el.contains(range.startContainer)) {
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.deleteContents();
  range.insertNode(node);

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
  placeCaretAt(afterNode, 0);
  return { node: afterNode, offset: 0 };
};
