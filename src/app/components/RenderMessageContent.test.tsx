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
      expect(screen.getByTestId('message-body')).toHaveTextContent('Hello, world!');
    });

    it('renders an HTML formatted text message', () => {
      renderMessageContent(MsgType.Text, {
        body: 'hello **bold**',
        msgtype: 'm.text',
        format: 'org.matrix.custom.html',
        formatted_body: 'hello <strong>bold</strong>',
      });
      const body = screen.getByTestId('message-body');
      expect(body).toHaveTextContent('hello bold');
      expect(body.querySelector('strong')).not.toBeNull();
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
            edited
            content={{ body: 'edited message', msgtype: 'm.text' } as any}
            mediaAutoLoad={false}
            urlPreview={false}
            htmlReactParserOptions={htmlReactParserOptions}
            linkifyOpts={LINKIFY_OPTS}
          />
        </MatrixTestWrapper>
      );
      expect(screen.getByTestId('message-body')).toHaveTextContent('edited message');
    });
  });

  describe('emote messages', () => {
    it('renders an emote message with display name', () => {
      renderMessageContent(MsgType.Emote, {
        body: 'waves hello',
        msgtype: 'm.emote',
      });
      expect(screen.getByTestId('message-body')).toHaveTextContent('waves hello');
    });
  });

  describe('notice messages', () => {
    it('renders a notice message', () => {
      renderMessageContent(MsgType.Notice, {
        body: 'This is a notice',
        msgtype: 'm.notice',
      });
      expect(screen.getByTestId('message-body')).toHaveTextContent('This is a notice');
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
    it('renders a file message with the provided filename', () => {
      renderMessageContent(MsgType.File, {
        body: 'document.pdf',
        msgtype: 'm.file',
        url: 'mxc://example.com/file123',
        info: {
          size: 1024,
          mimetype: 'application/pdf',
        },
      });
      expect(screen.getByTestId('file-name')).toHaveTextContent('document.pdf');
    });
  });

  describe('video messages', () => {
    it('renders a video message without crashing', async () => {
      renderMessageContent(MsgType.Video, {
        body: 'video.mp4',
        msgtype: 'm.video',
        url: 'mxc://example.com/vid123',
        info: {
          w: 1280,
          h: 720,
          size: 5_000_000,
          mimetype: 'video/mp4',
          duration: 30000,
        },
      });
      await act(async () => {});
    });
  });

  describe('audio messages', () => {
    it('renders an audio message without crashing', async () => {
      renderMessageContent(MsgType.Audio, {
        body: 'audio.ogg',
        msgtype: 'm.audio',
        url: 'mxc://example.com/aud123',
        info: {
          size: 200_000,
          mimetype: 'audio/ogg',
          duration: 10000,
        },
      });
      await act(async () => {});
    });
  });

  describe('unsupported messages', () => {
    it('renders unsupported content for unknown message type', () => {
      renderMessageContent('m.unknown.type', {
        body: 'something',
        msgtype: 'm.unknown.type',
      });
      expect(screen.getByTestId('message-unsupported')).toBeInTheDocument();
    });

    it('renders bad encrypted content with a decrypt failure message', () => {
      renderMessageContent('m.bad.encrypted', {});
      expect(screen.getByTestId('message-bad-encrypted')).toBeInTheDocument();
    });
  });
});
