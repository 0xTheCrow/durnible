import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MsgType } from 'matrix-js-sdk';
import { RenderMessageContent } from './RenderMessageContent';
import { MatrixTestWrapper } from '../../test/wrapper';
import { LINKIFY_OPTS, getReactCustomHtmlParser } from '../plugins/react-custom-html-parser';
import { createMockMatrixClient } from '../../test/mocks';

function renderMessageContent(
  msgType: string,
  content: Record<string, unknown>,
  opts?: { mediaAutoLoad?: boolean }
) {
  const mx = createMockMatrixClient();
  const htmlReactParserOptions = getReactCustomHtmlParser(mx as any, '!room:example.com', {
    linkifyOpts: LINKIFY_OPTS,
  });

  return render(
    <MatrixTestWrapper matrixClient={mx}>
      <RenderMessageContent
        displayName="Alice"
        msgType={msgType}
        ts={Date.now()}
        content={content as any}
        mediaAutoLoad={opts?.mediaAutoLoad ?? false}
        urlPreview={false}
        htmlReactParserOptions={htmlReactParserOptions}
        linkifyOpts={LINKIFY_OPTS}
      />
    </MatrixTestWrapper>
  );
}

describe('RenderMessageContent', () => {
  describe('text messages', () => {
    it('renders a plain text message', () => {
      renderMessageContent(MsgType.Text, {
        body: 'Hello, world!',
        msgtype: 'm.text',
      });
      expect(screen.getByText('Hello, world!')).toBeInTheDocument();
    });

    it('renders an HTML formatted text message', () => {
      renderMessageContent(MsgType.Text, {
        body: 'hello **bold**',
        msgtype: 'm.text',
        format: 'org.matrix.custom.html',
        formatted_body: 'hello <strong>bold</strong>',
      });
      expect(screen.getByText('bold')).toBeInTheDocument();
    });

    it('renders an edited text message', () => {
      const mx = createMockMatrixClient();
      const htmlReactParserOptions = getReactCustomHtmlParser(mx as any, '!room:example.com', {
        linkifyOpts: LINKIFY_OPTS,
      });

      render(
        <MatrixTestWrapper matrixClient={mx}>
          <RenderMessageContent
            displayName="Alice"
            msgType={MsgType.Text}
            ts={Date.now()}
            edited
            content={{ body: 'edited message', msgtype: 'm.text' } as any}
            mediaAutoLoad={false}
            urlPreview={false}
            htmlReactParserOptions={htmlReactParserOptions}
            linkifyOpts={LINKIFY_OPTS}
          />
        </MatrixTestWrapper>
      );
      expect(screen.getByText('edited message')).toBeInTheDocument();
    });
  });

  describe('emote messages', () => {
    it('renders an emote message with display name', () => {
      renderMessageContent(MsgType.Emote, {
        body: 'waves hello',
        msgtype: 'm.emote',
      });
      expect(screen.getByText(/waves hello/)).toBeInTheDocument();
    });
  });

  describe('notice messages', () => {
    it('renders a notice message', () => {
      renderMessageContent(MsgType.Notice, {
        body: 'This is a notice',
        msgtype: 'm.notice',
      });
      expect(screen.getByText('This is a notice')).toBeInTheDocument();
    });
  });

  describe('image messages', () => {
    it('renders an image message without crashing', async () => {
      renderMessageContent(MsgType.Image, {
        body: 'photo.png',
        msgtype: 'm.image',
        url: 'mxc://example.com/abc123',
        info: {
          w: 800,
          h: 600,
          size: 50000,
          mimetype: 'image/png',
        },
      });
      await act(async () => {});
    });

    it('renders an image with autoPlay loading', async () => {
      renderMessageContent(
        MsgType.Image,
        {
          body: 'photo.png',
          msgtype: 'm.image',
          url: 'mxc://example.com/abc123',
          info: {
            w: 800,
            h: 600,
            size: 50000,
            mimetype: 'image/png',
          },
        },
        { mediaAutoLoad: true }
      );
      await act(async () => {});
    });
  });

  describe('file messages', () => {
    it('renders a file message', () => {
      renderMessageContent(MsgType.File, {
        body: 'document.pdf',
        msgtype: 'm.file',
        url: 'mxc://example.com/file123',
        info: {
          size: 1024,
          mimetype: 'application/pdf',
        },
      });
      expect(screen.getByText('document.pdf')).toBeInTheDocument();
    });
  });

  describe('unsupported messages', () => {
    it('renders unsupported content for unknown message type', () => {
      renderMessageContent('m.unknown.type', {
        body: 'something',
        msgtype: 'm.unknown.type',
      });
    });

    it('renders bad encrypted content', () => {
      renderMessageContent('m.bad.encrypted', {});
    });
  });
});
