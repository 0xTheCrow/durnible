const getSelectionInElement = (inputElement: HTMLElement): Range | null => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return null;
  const range = sel.getRangeAt(0);
  if (!inputElement.contains(range.startContainer)) return null;
  return range;
};

const selectionInsideTag = (inputElement: HTMLElement, tagName: string): boolean => {
  const range = getSelectionInElement(inputElement);
  if (!range) return false;
  let node: Node | null = range.startContainer;
  while (node && node !== inputElement) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).tagName === tagName) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
};

const selectionInsideSelector = (inputElement: HTMLElement, selector: string): boolean => {
  const range = getSelectionInElement(inputElement);
  if (!range) return false;
  let node: Node | null = range.startContainer;
  while (node && node !== inputElement) {
    if (node.nodeType === Node.ELEMENT_NODE && (node as HTMLElement).matches(selector)) {
      return true;
    }
    node = node.parentNode;
  }
  return false;
};

const wrapSelectionWithElement = (
  inputElement: HTMLElement,
  tag: string,
  attrs?: Record<string, string>
) => {
  const range = getSelectionInElement(inputElement);
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

const unwrapSelection = (inputElement: HTMLElement, selector: string) => {
  const range = getSelectionInElement(inputElement);
  if (!range) return;
  let node: Node | null = range.startContainer;
  while (node && node !== inputElement) {
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

export const toggleInlineCode = (inputElement: HTMLElement) => {
  if (selectionInsideTag(inputElement, 'CODE')) {
    unwrapSelection(inputElement, 'code');
  } else {
    wrapSelectionWithElement(inputElement, 'code');
  }
};

export const toggleSpoiler = (inputElement: HTMLElement) => {
  if (selectionInsideSelector(inputElement, '[data-mx-spoiler]')) {
    unwrapSelection(inputElement, '[data-mx-spoiler]');
  } else {
    wrapSelectionWithElement(inputElement, 'span', { 'data-mx-spoiler': '' });
  }
};

export const toggleBlockFormat = (inputElement: HTMLElement, tag: string) => {
  if (selectionInsideTag(inputElement, tag.toUpperCase())) {
    document.execCommand('formatBlock', false, 'div');
  } else {
    document.execCommand('formatBlock', false, tag);
  }
};

export const toggleCodeBlock = (inputElement: HTMLElement) => {
  if (selectionInsideTag(inputElement, 'PRE')) {
    document.execCommand('formatBlock', false, 'div');
  } else {
    document.execCommand('formatBlock', false, 'pre');
  }
};

export const isFormatActive = (command: string): boolean => document.queryCommandState(command);

export const isCodeActive = (inputElement: HTMLElement): boolean =>
  selectionInsideTag(inputElement, 'CODE');

export const isSpoilerActive = (inputElement: HTMLElement): boolean =>
  selectionInsideSelector(inputElement, '[data-mx-spoiler]');

export const isBlockFormatActive = (inputElement: HTMLElement, tag: string): boolean =>
  selectionInsideTag(inputElement, tag.toUpperCase());

export const isInsideList = (inputElement: HTMLElement): boolean =>
  selectionInsideTag(inputElement, 'OL') || selectionInsideTag(inputElement, 'UL');

export const handleListEnter = (inputElement: HTMLElement) => {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0) return;

  let node: Node | null = sel.getRangeAt(0).startContainer;
  let currentLi: HTMLElement | null = null;
  while (node && node !== inputElement) {
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

export const isExitableBlock = (inputElement: HTMLElement): boolean => {
  if (isBlockFormatActive(inputElement, 'blockquote')) return true;
  if (isBlockFormatActive(inputElement, 'pre')) return true;
  if (isBlockFormatActive(inputElement, 'ol')) return true;
  if (isBlockFormatActive(inputElement, 'ul')) return true;
  if (isBlockFormatActive(inputElement, 'h1')) return true;
  if (isBlockFormatActive(inputElement, 'h2')) return true;
  if (isBlockFormatActive(inputElement, 'h3')) return true;
  return false;
};

export const exitBlock = (inputElement: HTMLElement) => {
  if (isInsideList(inputElement)) {
    if (isBlockFormatActive(inputElement, 'ol')) document.execCommand('insertOrderedList', false);
    if (isBlockFormatActive(inputElement, 'ul')) document.execCommand('insertUnorderedList', false);
  }
  if (
    isBlockFormatActive(inputElement, 'blockquote') ||
    isBlockFormatActive(inputElement, 'pre') ||
    isBlockFormatActive(inputElement, 'h1') ||
    isBlockFormatActive(inputElement, 'h2') ||
    isBlockFormatActive(inputElement, 'h3')
  ) {
    document.execCommand('formatBlock', false, 'div');
  }
};
