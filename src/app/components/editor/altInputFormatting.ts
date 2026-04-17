const getSelectionInElement = (el: HTMLElement): Range | null => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!el.contains(range.startContainer)) return null;
  return range;
};

const selectionInsideTag = (el: HTMLElement, tagName: string): boolean => {
  const range = getSelectionInElement(el);
  if (!range) return false;
  let node: Node | null = range.startContainer;
  while (node && node !== el) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === tagName) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
};

const selectionInsideSelector = (el: HTMLElement, selector: string): boolean => {
  const range = getSelectionInElement(el);
  if (!range) return false;
  let node: Node | null = range.startContainer;
  while (node && node !== el) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).matches(selector)) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
};

const wrapSelectionWithElement = (el: HTMLElement, tag: string, attrs?: Record<string, string>) => {
  const range = getSelectionInElement(el);
  if (!range) return;

  const wrapper = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      wrapper.setAttribute(k, v);
    }
  }

  if (range.collapsed) {
    const zeroWidthSpace = document.createTextNode('\u200B');
    wrapper.appendChild(zeroWidthSpace);
    range.insertNode(wrapper);
    const sel = window.getSelection();
    const r = document.createRange();
    r.setStart(zeroWidthSpace, 1);
    r.collapse(true);
    sel?.removeAllRanges();
    sel?.addRange(r);
    return;
  }

  const contents = range.extractContents();
  wrapper.appendChild(contents);
  range.insertNode(wrapper);
  const sel = window.getSelection();
  const r = document.createRange();
  r.selectNodeContents(wrapper);
  sel?.removeAllRanges();
  sel?.addRange(r);
};

const unwrapSelection = (el: HTMLElement, selector: string) => {
  const range = getSelectionInElement(el);
  if (!range) return;
  let node: Node | null = range.startContainer;
  while (node && node !== el) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).matches(selector)) {
      const parent = node.parentNode;
      if (!parent) return;
      while (node.firstChild) {
        parent.insertBefore(node.firstChild, node);
      }
      parent.removeChild(node);
      return;
    }
    node = node.parentNode;
  }
};

export const toggleExecFormat = (command: string) => {
  document.execCommand(command, false);
};

export const toggleInlineCode = (el: HTMLElement) => {
  if (selectionInsideTag(el, 'CODE')) {
    unwrapSelection(el, 'code');
  } else {
    wrapSelectionWithElement(el, 'code');
  }
};

export const toggleSpoiler = (el: HTMLElement) => {
  if (selectionInsideSelector(el, '[data-mx-spoiler]')) {
    unwrapSelection(el, '[data-mx-spoiler]');
  } else {
    wrapSelectionWithElement(el, 'span', { 'data-mx-spoiler': '' });
  }
};

export const toggleBlockFormat = (el: HTMLElement, tag: string) => {
  if (selectionInsideTag(el, tag.toUpperCase())) {
    document.execCommand('formatBlock', false, 'div');
  } else {
    document.execCommand('formatBlock', false, tag);
  }
};

export const toggleCodeBlock = (el: HTMLElement) => {
  if (selectionInsideTag(el, 'PRE')) {
    document.execCommand('formatBlock', false, 'div');
  } else {
    document.execCommand('formatBlock', false, 'pre');
  }
};

export const isFormatActive = (command: string): boolean => document.queryCommandState(command);

export const isCodeActive = (el: HTMLElement): boolean => selectionInsideTag(el, 'CODE');

export const isSpoilerActive = (el: HTMLElement): boolean =>
  selectionInsideSelector(el, '[data-mx-spoiler]');

export const isBlockFormatActive = (el: HTMLElement, tag: string): boolean =>
  selectionInsideTag(el, tag.toUpperCase());

export const isInsideList = (el: HTMLElement): boolean =>
  selectionInsideTag(el, 'OL') || selectionInsideTag(el, 'UL');

export const handleListEnter = (el: HTMLElement) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  let node: Node | null = sel.getRangeAt(0).startContainer;
  let currentLi: HTMLElement | null = null;
  while (node && node !== el) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === 'LI') {
      currentLi = node as HTMLElement;
      break;
    }
    node = node.parentNode;
  }

  if (!currentLi || !currentLi.parentNode) {
    document.execCommand('insertParagraph', false);
    return;
  }

  const newLi = document.createElement('li');
  newLi.appendChild(document.createElement('br'));
  currentLi.parentNode.insertBefore(newLi, currentLi.nextSibling);

  const range = document.createRange();
  range.setStart(newLi, 0);
  range.collapse(true);
  sel.removeAllRanges();
  sel.addRange(range);
};

export const isExitableBlock = (el: HTMLElement): boolean => {
  if (isBlockFormatActive(el, 'blockquote')) return true;
  if (isBlockFormatActive(el, 'pre')) return true;
  if (isBlockFormatActive(el, 'ol')) return true;
  if (isBlockFormatActive(el, 'ul')) return true;
  if (isBlockFormatActive(el, 'h1')) return true;
  if (isBlockFormatActive(el, 'h2')) return true;
  if (isBlockFormatActive(el, 'h3')) return true;
  return false;
};

export const exitBlock = (el: HTMLElement) => {
  if (isInsideList(el)) {
    if (isBlockFormatActive(el, 'ol')) document.execCommand('insertOrderedList', false);
    if (isBlockFormatActive(el, 'ul')) document.execCommand('insertUnorderedList', false);
  }
  if (
    isBlockFormatActive(el, 'blockquote') ||
    isBlockFormatActive(el, 'pre') ||
    isBlockFormatActive(el, 'h1') ||
    isBlockFormatActive(el, 'h2') ||
    isBlockFormatActive(el, 'h3')
  ) {
    document.execCommand('formatBlock', false, 'div');
  }
};
