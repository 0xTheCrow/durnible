const YOUTUBE_URL_REG =
  /^https?:\/\/(?:(?:www\.|m\.)?youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export const testYouTubeUrl = (url: string): boolean => YOUTUBE_URL_REG.test(url);

export const getYouTubeVideoId = (url: string): string | undefined => {
  const match = url.match(YOUTUBE_URL_REG);
  return match?.[1];
};
