import { useCallback } from 'react';
import type * as PdfJsDist from 'pdfjs-dist';
import type { GetViewportParameters } from 'pdfjs-dist/types/src/display/api';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useAsyncCallback } from '../hooks/useAsyncCallback';

export const usePdfJSLoader = () =>
  useAsyncCallback(
    useCallback(async () => {
      const pdf = await import('pdfjs-dist');
      pdf.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
      return pdf;
    }, [])
  );

export const usePdfDocumentLoader = (pdfJS: typeof PdfJsDist | undefined, src: string) =>
  useAsyncCallback(
    useCallback(async () => {
      if (!pdfJS) {
        throw new Error('PdfJS is not loaded');
      }
      const doc = await pdfJS.getDocument(src).promise;
      return doc;
    }, [pdfJS, src])
  );

export const createPage = async (
  doc: PdfJsDist.PDFDocumentProxy,
  pageNumber: number,
  viewportParams: GetViewportParameters
): Promise<HTMLCanvasElement> => {
  const page = await doc.getPage(pageNumber);
  const pageViewport = page.getViewport(viewportParams);
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');

  if (!context) throw new Error('failed to render page.');

  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.floor(pageViewport.width * pixelRatio);
  canvas.height = Math.floor(pageViewport.height * pixelRatio);
  canvas.style.width = `${Math.floor(pageViewport.width)}px`;
  canvas.style.height = `${Math.floor(pageViewport.height)}px`;

  await page.render({
    canvasContext: context,
    viewport: pageViewport,
    transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
  }).promise;

  return canvas;
};
