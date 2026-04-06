import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeCustomHtml } from './sanitize';

describe('sanitizeText', () => {
  it('escapes ampersands', () => {
    expect(sanitizeText('a & b')).toBe('a &amp; b');
  });

  it('escapes angle brackets', () => {
    expect(sanitizeText('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes double quotes', () => {
    expect(sanitizeText('"hello"')).toBe('&quot;hello&quot;');
  });

  it('escapes single quotes', () => {
    expect(sanitizeText("it's")).toBe('it&#39;s');
  });

  it('leaves plain text unchanged', () => {
    expect(sanitizeText('hello world')).toBe('hello world');
  });

  it('handles all special characters together', () => {
    expect(sanitizeText('&<>"\'')).toBe('&amp;&lt;&gt;&quot;&#39;');
  });
});

describe('sanitizeCustomHtml', () => {
  it('strips script tags entirely', () => {
    const result = sanitizeCustomHtml("<script>alert('xss')</script>");
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert');
  });

  it('strips javascript: href links', () => {
    const result = sanitizeCustomHtml("<a href=\"javascript:alert('xss')\">click</a>");
    expect(result).not.toContain('javascript:');
  });

  it('preserves allowed tags like <b> and <i>', () => {
    const result = sanitizeCustomHtml('<b>bold</b> and <i>italic</i>');
    expect(result).toContain('<b>bold</b>');
    expect(result).toContain('<i>italic</i>');
  });

  it('strips disallowed tags like <marquee>', () => {
    const result = sanitizeCustomHtml('<marquee>wheee</marquee>');
    expect(result).not.toContain('<marquee');
    expect(result).toContain('wheee');
  });

  it('transforms <a> tags to add rel=noopener and target=_blank', () => {
    const result = sanitizeCustomHtml('<a href="https://example.com">link</a>');
    expect(result).toContain('rel="noopener"');
    expect(result).toContain('target="_blank"');
  });

  it('converts non-mxc <img> tags to links', () => {
    const result = sanitizeCustomHtml(
      '<img src="https://external.com/img.png" alt="test image">'
    );
    expect(result).not.toContain('<img');
    expect(result).toContain('<a');
    expect(result).toContain('https://external.com/img.png');
  });

  it('keeps mxc:// <img> tags as images', () => {
    const result = sanitizeCustomHtml(
      '<img src="mxc://example.com/abc123" alt="emoji">'
    );
    expect(result).toContain('<img');
    expect(result).toContain('mxc://example.com/abc123');
  });

  it('allows data-mx-spoiler on <span>', () => {
    const result = sanitizeCustomHtml(
      '<span data-mx-spoiler="secret">hidden text</span>'
    );
    expect(result).toContain('data-mx-spoiler');
    expect(result).toContain('hidden text');
  });

  it('strips disallowed attributes like onclick', () => {
    const result = sanitizeCustomHtml('<b onclick="evil()">text</b>');
    expect(result).not.toContain('onclick');
    expect(result).toContain('text');
  });

  it('strips non-hex color names from styles', () => {
    // The span transformer replaces style with data-mx-* values.
    // Without data-mx-color the computed style has no recognisable color.
    const result = sanitizeCustomHtml('<span style="color: red">text</span>');
    expect(result).not.toContain('color: red');
  });

  it('preserves the Matrix color attribute value through sanitization', () => {
    // data-mx-color is the Matrix spec attribute for text colour.
    // The value should survive sanitization regardless of how it is applied.
    const result = sanitizeCustomHtml('<font data-mx-color="#ff0000">red</font>');
    expect(result).toContain('red');      // text content preserved
    expect(result).toContain('#ff0000'); // colour value preserved in some form
  });

  it('strips mx-reply tags', () => {
    const result = sanitizeCustomHtml(
      '<mx-reply><blockquote>quoted</blockquote></mx-reply>real message'
    );
    expect(result).not.toContain('<mx-reply');
    expect(result).not.toContain('quoted');
    expect(result).toContain('real message');
  });
});
