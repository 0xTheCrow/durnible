import React, { useEffect, useRef } from 'react';
import { useAtomValue } from 'jotai';
import { MsgType } from 'matrix-js-sdk';
import { HTMLReactParserOptions } from 'html-react-parser';
import { Opts } from 'linkifyjs';
import { config } from 'folds';
import {
  AudioContent,
  DownloadFile,
  FileContent,
  ImageContent,
  MAudio,
  MBadEncrypted,
  MEmote,
  MFile,
  MImage,
  MLocation,
  MNotice,
  MText,
  MVideo,
  ReadPdfFile,
  ReadTextFile,
  RenderBody,
  ThumbnailContent,
  UnsupportedContent,
  VideoContent,
} from './message';
import { YouTubeEmbed, SpotifyEmbed, SoundCloudEmbed, NitterEmbed } from './url-preview';
import { Image, MediaControl, Video } from './media';
import { PdfViewer } from './Pdf-viewer';
import { TextViewer } from './text-viewer';
import { testMatrixTo } from '../plugins/matrix-to';
import {
  testYouTubeUrl, getYouTubeVideoId,
  testSpotifyUrl, getSpotifyEmbedInfo,
  testSoundCloudUrl, getSoundCloudEmbedInfo,
  testTwitterUrl, getTwitterEmbedInfo,
} from '../utils/embeds';
import { settingsAtom } from '../state/settings';
import { IAudioContent, IFileContent, IImageContent, IVideoContent } from '../../types/matrix/common';
import { getBlobSafeMimeType } from '../utils/mimeTypes';

const MEDIA_VOLUME_KEY = 'cinny_media_volume';

function VideoWithPersistedVolume(props: React.VideoHTMLAttributes<HTMLVideoElement>) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const stored = localStorage.getItem(MEDIA_VOLUME_KEY);
    el.volume = stored !== null ? Math.max(0, Math.min(1, parseFloat(stored))) : 0.5;

    const handleVolumeChange = () => {
      localStorage.setItem(MEDIA_VOLUME_KEY, String(el.volume));
    };

    el.addEventListener('volumechange', handleVolumeChange);
    return () => el.removeEventListener('volumechange', handleVolumeChange);
  }, []);

  return <Video {...props} ref={ref} />;
}

type RenderMessageContentProps = {
  displayName: string;
  msgType: string;
  ts: number;
  edited?: boolean;
  content: Record<string, any>;
  mediaAutoLoad?: boolean;
  urlPreview?: boolean;
  highlightRegex?: RegExp;
  htmlReactParserOptions: HTMLReactParserOptions;
  linkifyOpts: Opts;
  outlineAttachment?: boolean;
};
export const RenderMessageContent = React.memo(function RenderMessageContent({
  displayName,
  msgType,
  ts,
  edited,
  content,
  mediaAutoLoad,
  urlPreview,
  highlightRegex,
  htmlReactParserOptions,
  linkifyOpts,
  outlineAttachment,
}: RenderMessageContentProps) {
  const settings = useAtomValue(settingsAtom);

  const renderUrlsPreview = (urls: string[]) => {
    const filteredUrls = urls.filter((url) => !testMatrixTo(url));
    if (filteredUrls.length === 0) return undefined;

    const youtubeUrls = settings.embedYouTube ? filteredUrls.filter((url) => testYouTubeUrl(url)) : [];
    const spotifyUrls = settings.embedSpotify ? filteredUrls.filter((url) => testSpotifyUrl(url)) : [];
    const soundcloudUrls = settings.embedSoundCloud ? filteredUrls.filter((url) => testSoundCloudUrl(url)) : [];
    const twitterUrls = settings.embedNitter ? filteredUrls.filter((url) => testTwitterUrl(url)) : [];

    if (
      youtubeUrls.length === 0 &&
      spotifyUrls.length === 0 &&
      soundcloudUrls.length === 0 &&
      twitterUrls.length === 0
    )
      return undefined;

    const showEmbed = !!urlPreview;
    const showLink = settings.embedLinks;

    return (
      <>
        {youtubeUrls.map((url) => {
          const videoId = getYouTubeVideoId(url);
          return videoId ? (
            <YouTubeEmbed
              key={url}
              videoId={videoId}
              url={url}
              ts={ts}
              showEmbed={showEmbed}
              showLink={showLink}
              style={{ marginTop: config.space.S200 }}
            />
          ) : null;
        })}
        {spotifyUrls.map((url) => {
          const info = getSpotifyEmbedInfo(url);
          return info ? (
            <SpotifyEmbed
              key={url}
              info={info}
              url={url}
              showEmbed={showEmbed}
              showLink={showLink}
              style={{ marginTop: config.space.S200 }}
            />
          ) : null;
        })}
        {soundcloudUrls.map((url) => {
          const info = getSoundCloudEmbedInfo(url);
          return info ? (
            <SoundCloudEmbed
              key={url}
              info={info}
              url={url}
              showEmbed={showEmbed}
              showLink={showLink}
              style={{ marginTop: config.space.S200 }}
            />
          ) : null;
        })}
        {twitterUrls.map((url) => {
          const info = getTwitterEmbedInfo(url);
          return info ? (
            <NitterEmbed
              key={url}
              info={info}
              url={url}
              showEmbed={showEmbed}
              showLink={showLink}
              style={{ marginTop: config.space.S200 }}
            />
          ) : null;
        })}
      </>
    );
  };
  const renderCaption = () => {
    const imageContent = content as IImageContent;
    if (imageContent.filename && imageContent.filename !== imageContent.body) {
      return (
        <MText
          style={{ marginTop: config.space.S200 }}
          edited={edited}
          content={content}
          renderBody={(props) => (
            <RenderBody
              {...props}
              highlightRegex={highlightRegex}
              htmlReactParserOptions={htmlReactParserOptions}
              linkifyOpts={linkifyOpts}
            />
          )}
          renderUrlsPreview={(urlPreview || settings.embedLinks) ? renderUrlsPreview : undefined}
        />
      );
    }
    return null;
  };

  const renderFile = () => (
    <>
      <MFile
        content={content as IFileContent}
        renderFileContent={({ body, mimeType, info, encInfo, url }) => (
          <FileContent
            body={body}
            mimeType={mimeType}
            renderAsPdfFile={() => (
              <ReadPdfFile
                body={body}
                mimeType={mimeType}
                url={url}
                encInfo={encInfo}
                renderViewer={(p) => <PdfViewer {...p} />}
              />
            )}
            renderAsTextFile={() => (
              <ReadTextFile
                body={body}
                mimeType={mimeType}
                url={url}
                encInfo={encInfo}
                renderViewer={(p) => <TextViewer {...p} />}
              />
            )}
          >
            <DownloadFile body={body} mimeType={mimeType} url={url} encInfo={encInfo} info={info} />
          </FileContent>
        )}
        outlined={outlineAttachment}
      />
      {renderCaption()}
    </>
  );

  if (msgType === MsgType.Text) {
    return (
      <MText
        edited={edited}
        content={content}
        renderBody={(props) => (
          <RenderBody
            {...props}
            highlightRegex={highlightRegex}
            htmlReactParserOptions={htmlReactParserOptions}
            linkifyOpts={linkifyOpts}
          />
        )}
        renderUrlsPreview={(urlPreview || settings.embedLinks) ? renderUrlsPreview : undefined}
      />
    );
  }

  if (msgType === MsgType.Emote) {
    return (
      <MEmote
        displayName={displayName}
        edited={edited}
        content={content}
        renderBody={(props) => (
          <RenderBody
            {...props}
            highlightRegex={highlightRegex}
            htmlReactParserOptions={htmlReactParserOptions}
            linkifyOpts={linkifyOpts}
          />
        )}
        renderUrlsPreview={(urlPreview || settings.embedLinks) ? renderUrlsPreview : undefined}
      />
    );
  }

  if (msgType === MsgType.Notice) {
    return (
      <MNotice
        edited={edited}
        content={content}
        renderBody={(props) => (
          <RenderBody
            {...props}
            highlightRegex={highlightRegex}
            htmlReactParserOptions={htmlReactParserOptions}
            linkifyOpts={linkifyOpts}
          />
        )}
        renderUrlsPreview={(urlPreview || settings.embedLinks) ? renderUrlsPreview : undefined}
      />
    );
  }

  if (msgType === MsgType.Image) {
    return (
      <>
        <MImage
          content={content as IImageContent}
          renderImageContent={(props) => (
            <ImageContent
              {...props}
              autoPlay={mediaAutoLoad}
              renderImage={(p) => <Image {...p} loading="lazy" />}
            />
          )}
          outlined={outlineAttachment}
        />
        {renderCaption()}
      </>
    );
  }

  if (msgType === MsgType.Video) {
    return (
      <>
        <MVideo
          content={content as IVideoContent}
          renderAsFile={renderFile}
          renderVideoContent={({ body, info, ...props }) => (
            <VideoContent
              body={body}
              info={info}
              {...props}
              renderThumbnail={
                mediaAutoLoad
                  ? () => (
                      <ThumbnailContent
                        info={info}
                        renderImage={(src) => (
                          <Image alt={body} title={body} src={src} loading="lazy" />
                        )}
                      />
                    )
                  : undefined
              }
              renderVideo={(p) => <VideoWithPersistedVolume {...p} />}
            />
          )}
          outlined={outlineAttachment}
        />
        {renderCaption()}
      </>
    );
  }

  if (msgType === MsgType.Audio) {
    return (
      <>
        <MAudio
          content={content as IAudioContent}
          renderAsFile={renderFile}
          renderAudioContent={(props) => (
            <AudioContent {...props} renderMediaControl={(p) => <MediaControl {...p} />} />
          )}
          outlined={outlineAttachment}
        />
        {renderCaption()}
      </>
    );
  }

  if (msgType === MsgType.File) {
    const fileContent = content as IAudioContent;
    const fileMimeType = getBlobSafeMimeType(fileContent.info?.mimetype ?? '');
    if (fileMimeType.startsWith('audio')) {
      return (
        <>
          <MAudio
            content={fileContent}
            renderAsFile={renderFile}
            renderAudioContent={(props) => (
              <AudioContent {...props} renderMediaControl={(p) => <MediaControl {...p} />} />
            )}
            outlined={outlineAttachment}
          />
          {renderCaption()}
        </>
      );
    }
    return renderFile();
  }

  if (msgType === MsgType.Location) {
    return <MLocation content={content} />;
  }

  if (msgType === 'm.bad.encrypted') {
    return <MBadEncrypted />;
  }

  return <UnsupportedContent />;
});
