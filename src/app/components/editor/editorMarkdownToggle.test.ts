import { describe, it, expect } from 'vitest';
import type { MatrixClient } from 'matrix-js-sdk';
import { htmlToEditorDom } from './editorInput';
import { domToMarkdown, domToMatrixCustomHTML, trimCustomHtml } from './editorOutput';

const mockMx = {} as MatrixClient;

const setContent = (rootElement: HTMLElement, html: string) => {
  rootElement.replaceChildren(htmlToEditorDom(html, { mx: mockMx, useAuthentication: false }));
};

const enableMarkdown = (rootElement: HTMLElement) => {
  setContent(
    rootElement,
    trimCustomHtml(
      domToMatrixCustomHTML(rootElement, {
        allowMarkdown: true,
      })
    )
  );
};

const disableMarkdown = (rootElement: HTMLElement) => {
  setContent(rootElement, domToMarkdown(rootElement));
};

const editorWith = (source: string): HTMLElement => {
  const rootElement = document.createElement('div');
  setContent(rootElement, source);
  return rootElement;
};

const EVERY_MARKDOWN_TYPE = [
  '**bold** *italic* __underline__ ~~strike~~ `code` ||spoiler||',
  '# heading one',
  '###### heading six',
  '&gt; quoted',
  '* first',
  '* second',
  '1. first',
  '2. second',
  '```',
  'let x = 1;',
  '```',
  'plain text',
].join('<br/>');

const EVERY_FORMATTING_TYPE = [
  '<strong>bold</strong> <i>italic</i> <u>underline</u> <s>strike</s> <code>code</code>',
  ' <span data-mx-spoiler>spoiler</span><br/>',
  '<h1>heading one</h1>',
  '<h6>heading six</h6>',
  '<blockquote>quoted</blockquote>',
  '<ul><li>first</li><li>second</li></ul>',
  '<ol><li>first</li><li>second</li></ol>',
  '<pre><code>let x = 1;</code></pre>',
  'plain text',
].join('');

describe('markdown toggle', () => {
  it('restores the original source after enabling then disabling markdown', () => {
    const rootElement = editorWith(EVERY_MARKDOWN_TYPE);
    const original = domToMarkdown(rootElement);

    enableMarkdown(rootElement);
    disableMarkdown(rootElement);

    expect(domToMarkdown(rootElement)).toBe(original);
  });

  it('restores the original formatting after disabling then enabling markdown', () => {
    const rootElement = editorWith(EVERY_FORMATTING_TYPE);
    const original = rootElement.innerHTML;

    disableMarkdown(rootElement);
    enableMarkdown(rootElement);

    expect(rootElement.innerHTML).toBe(original);
  });

  it('renders every markdown type as formatting when markdown is enabled', () => {
    const rootElement = editorWith(EVERY_MARKDOWN_TYPE);

    enableMarkdown(rootElement);

    const tags = Array.from(rootElement.querySelectorAll('*')).map(
      (formatted) => formatted.tagName
    );
    expect(tags).toEqual(
      expect.arrayContaining([
        'B',
        'I',
        'U',
        'S',
        'CODE',
        'SPAN',
        'H1',
        'H6',
        'BLOCKQUOTE',
        'UL',
        'OL',
        'LI',
        'PRE',
      ])
    );
  });

  it('round trips a blockquote, which markdown only parses on a single-line message', () => {
    const rootElement = editorWith('&gt; quoted');
    const original = domToMarkdown(rootElement);

    enableMarkdown(rootElement);
    expect(rootElement.querySelector('blockquote')).not.toBeNull();

    disableMarkdown(rootElement);
    expect(domToMarkdown(rootElement)).toBe(original);
  });

  it('preserves line breaks inside a multi-line blockquote', () => {
    const rootElement = editorWith('<blockquote>line one<br>line two</blockquote>');
    const original = rootElement.innerHTML;

    disableMarkdown(rootElement);
    expect(domToMarkdown(rootElement)).toBe('&gt; line one<br/>&gt; line two');

    enableMarkdown(rootElement);
    expect(rootElement.innerHTML).toBe(original);
  });

  it('preserves line breaks inside a multi-line code block', () => {
    const rootElement = editorWith('<pre><code>let x = 1;\nlet y = 2;</code></pre>');
    const original = rootElement.innerHTML;

    disableMarkdown(rootElement);
    expect(domToMarkdown(rootElement)).toBe('```<br/>let x = 1;<br/>let y = 2;<br/>```');

    enableMarkdown(rootElement);
    expect(rootElement.innerHTML).toBe(original);
  });

  it('parses a blockquote wherever it appears, not only on the first line', () => {
    const rootElement = editorWith('# heading<br/>&gt; quoted');

    enableMarkdown(rootElement);

    expect(rootElement.querySelector('blockquote')?.textContent).toBe('quoted');
  });

  it('drops the link target when markdown is enabled, because the editor has no link node', () => {
    const rootElement = editorWith('[alt](https://example.com)');

    enableMarkdown(rootElement);

    expect(domToMarkdown(rootElement)).toBe('alt');
  });

  it('drops the code fence language when markdown is enabled', () => {
    const rootElement = editorWith(['```js', 'let x = 1;', '```'].join('<br/>'));

    enableMarkdown(rootElement);

    expect(domToMarkdown(rootElement)).toBe(['```', 'let x = 1;', '```'].join('<br/>'));
  });
});
