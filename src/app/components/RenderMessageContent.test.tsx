import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MsgType } from 'matrix-js-sdk';
import { RenderMessageContent } from './RenderMessageContent';
import { MatrixTestWrapper } from '../../test/wrapper';
import { LINKIFY_OPTS, getReactCustomHtmlParser } from '../plugins/react-custom-html-parser';
import { createMockMatrixClient } from '../../test/mocks';

let imageContentRenderCount = 0;

vi.mock('./message', async (importOriginal) => {
  const mod = await importOriginal<typeof import('./message')>();
  const Real = mod.ImageContent as React.ComponentType<any>;
  return {
    ...mod,
    ImageContent: (props: any) => {
      imageContentRenderCount++;
      return React.createElement(Real, props);
    },
  };
});

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
      expect(screen.getByText(/unsupported/i)).toBeInTheDocument();
    });

    it('renders bad encrypted content with a decrypt failure message', () => {
      renderMessageContent('m.bad.encrypted', {});
      expect(screen.getByText(/decrypt/i)).toBeInTheDocument();
    });
  });
});

const STABLE_IMAGE_CONTENT = {
  body: 'photo.png',
  msgtype: 'm.image',
  url: 'mxc://example.com/abc123',
  info: { w: 800, h: 600, mimetype: 'image/png' },
};

describe('RenderMessageContent memoization', () => {
  const mx = createMockMatrixClient();
  const htmlReactParserOptions = getReactCustomHtmlParser(mx as any, '!room:example.com', {
    linkifyOpts: LINKIFY_OPTS,
  });

  beforeEach(() => {
    imageContentRenderCount = 0;
  });

  it('does NOT re-render ImageContent when parent re-renders with stable props', async () => {
    function SimulatedMessage({ trigger: _trigger }: { trigger: number }) {
      return (
        <RenderMessageContent
          displayName="Alice"
          msgType={MsgType.Image}
          content={STABLE_IMAGE_CONTENT as any}
          mediaAutoLoad={false}
          urlPreview={false}
          htmlReactParserOptions={htmlReactParserOptions}
          linkifyOpts={LINKIFY_OPTS}
        />
      );
    }

    const { rerender } = render(
      <MatrixTestWrapper matrixClient={mx}>
        <SimulatedMessage trigger={0} />
      </MatrixTestWrapper>
    );
    await act(async () => {});

    const rendersOnMount = imageContentRenderCount;
    expect(rendersOnMount).toBeGreaterThan(0);

    for (let i = 1; i <= 3; i++) {
      rerender(
        <MatrixTestWrapper matrixClient={mx}>
          <SimulatedMessage trigger={i} />
        </MatrixTestWrapper>
      );
      await act(async () => {});
    }

    expect(imageContentRenderCount).toBe(rendersOnMount);
  });

  it('DOES re-render ImageContent when a Fragment wrapper appears or disappears', async () => {
    // This test documents the bug that was fixed in RoomTimeline: when eventRenderer
    // returned <React.Fragment key={id}> with a divider vs <Message key={id}> directly,
    // the type-flip caused React to unmount and remount the message.
    function WithoutWrapper() {
      return (
        <RenderMessageContent
          displayName="Alice"
          msgType={MsgType.Image}
          content={STABLE_IMAGE_CONTENT as any}
          mediaAutoLoad={false}
          urlPreview={false}
          htmlReactParserOptions={htmlReactParserOptions}
          linkifyOpts={LINKIFY_OPTS}
        />
      );
    }

    function WithWrapper() {
      return (
        <>
          <div data-testid="divider">New Messages</div>
          <RenderMessageContent
            displayName="Alice"
            msgType={MsgType.Image}
            content={STABLE_IMAGE_CONTENT as any}
            mediaAutoLoad={false}
            urlPreview={false}
            htmlReactParserOptions={htmlReactParserOptions}
            linkifyOpts={LINKIFY_OPTS}
          />
        </>
      );
    }

    function SimulatedTimeline({ showDivider }: { showDivider: boolean }) {
      return showDivider ? <WithWrapper /> : <WithoutWrapper />;
    }

    const { rerender } = render(
      <MatrixTestWrapper matrixClient={mx}>
        <SimulatedTimeline showDivider={false} />
      </MatrixTestWrapper>
    );
    await act(async () => {});

    const rendersBeforeDivider = imageContentRenderCount;

    rerender(
      <MatrixTestWrapper matrixClient={mx}>
        <SimulatedTimeline showDivider />
      </MatrixTestWrapper>
    );
    await act(async () => {});
    expect(screen.getByTestId('divider')).toBeInTheDocument();

    rerender(
      <MatrixTestWrapper matrixClient={mx}>
        <SimulatedTimeline showDivider={false} />
      </MatrixTestWrapper>
    );
    await act(async () => {});

    expect(imageContentRenderCount).toBeGreaterThan(rendersBeforeDivider);
  });
});
