/* eslint-disable no-param-reassign */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
import type { FormEventHandler, MouseEventHandler } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import type { RectCords } from 'folds';
import {
  Box,
  Button,
  Chip,
  Header,
  Icon,
  Icons,
  Input,
  Menu,
  PopOut,
  Scroll,
  Spinner,
  Text,
  as,
  config,
} from 'folds';
import FocusTrap from 'focus-trap-react';
import * as css from './PdfViewer.css';
import { AsyncStatus } from '../../hooks/useAsyncCallback';
import { useZoom } from '../../hooks/useZoom';
import { clampZoom } from '../../utils/zoom';
import { createPage, usePdfDocumentLoader, usePdfJSLoader } from '../../plugins/pdfjs-dist';
import { stopPropagation } from '../../utils/keyboard';
import { MediaFrame, MediaFrameZoomControls } from '../media';

export type PdfViewerProps = {
  name: string;
  src: string;
  onClose: () => void;
  onDownload?: () => void;
};

export const PdfViewer = as<'div', PdfViewerProps>(
  ({ className, name, src, onClose, onDownload, ...props }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const { zoom, zoomIn, zoomOut, setZoom } = useZoom(0.2);

    const [pdfJSState, loadPdfJS] = usePdfJSLoader();
    const [docState, loadPdfDocument] = usePdfDocumentLoader(
      pdfJSState.status === AsyncStatus.Success ? pdfJSState.data : undefined,
      src
    );
    const isLoading =
      pdfJSState.status === AsyncStatus.Loading || docState.status === AsyncStatus.Loading;
    const isError =
      pdfJSState.status === AsyncStatus.Error || docState.status === AsyncStatus.Error;
    const [pageNo, setPageNo] = useState(1);
    const [jumpAnchor, setJumpAnchor] = useState<RectCords>();

    useEffect(() => {
      loadPdfJS();
    }, [loadPdfJS]);
    useEffect(() => {
      if (pdfJSState.status === AsyncStatus.Success) {
        loadPdfDocument();
      }
    }, [pdfJSState, loadPdfDocument]);

    useEffect(() => {
      if (docState.status !== AsyncStatus.Success) return undefined;
      const scrollElement = scrollRef.current;
      if (!scrollElement) return undefined;

      let isStale = false;
      docState.data.getPage(1).then((page) => {
        if (isStale) return;
        const { width, height } = page.getViewport({ scale: 1 });
        setZoom(
          clampZoom(
            Math.min(scrollElement.clientWidth / width, scrollElement.clientHeight / height)
          )
        );
      });

      return () => {
        isStale = true;
      };
    }, [docState, setZoom]);

    useEffect(() => {
      if (docState.status !== AsyncStatus.Success) return undefined;
      const doc = docState.data;
      if (pageNo < 0 || pageNo > doc.numPages) return undefined;

      let isStale = false;
      createPage(doc, pageNo, { scale: zoom }).then((canvas) => {
        const container = containerRef.current;
        if (isStale || !container) return;
        container.textContent = '';
        container.append(canvas);
        scrollRef.current?.scrollTo({
          top: 0,
        });
      });

      return () => {
        isStale = true;
      };
    }, [docState, pageNo, zoom]);

    const handleJumpSubmit: FormEventHandler<HTMLFormElement> = (evt) => {
      evt.preventDefault();
      if (docState.status !== AsyncStatus.Success) return;
      const jumpInput = evt.currentTarget.jumpInput as HTMLInputElement;
      if (!jumpInput) return;
      const jumpTo = parseInt(jumpInput.value, 10);
      setPageNo(Math.max(1, Math.min(docState.data.numPages, jumpTo)));
      setJumpAnchor(undefined);
    };

    const handlePrevPage = () => {
      setPageNo((n) => Math.max(n - 1, 1));
    };

    const handleNextPage = () => {
      if (docState.status !== AsyncStatus.Success) return;
      setPageNo((n) => Math.min(n + 1, docState.data.numPages));
    };

    const handleOpenJump: MouseEventHandler<HTMLButtonElement> = (evt) => {
      setJumpAnchor(evt.currentTarget.getBoundingClientRect());
    };

    useEffect(() => {
      if (docState.status !== AsyncStatus.Success) return undefined;
      const { numPages } = docState.data;
      const handleKeyDown = (evt: KeyboardEvent) => {
        const target = evt.target as HTMLElement | null;
        if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;
        if (evt.key === 'ArrowRight') {
          setPageNo((n) => Math.min(n + 1, numPages));
        } else if (evt.key === 'ArrowLeft') {
          setPageNo((n) => Math.max(n - 1, 1));
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }, [docState]);

    return (
      <MediaFrame
        name={name}
        onClose={onClose}
        className={className}
        headerAfter={
          <>
            <MediaFrameZoomControls
              zoom={zoom}
              zoomIn={zoomIn}
              zoomOut={zoomOut}
              setZoom={setZoom}
            />
            {onDownload && (
              <button
                type="button"
                className={css.PdfViewerDownloadButton}
                onClick={onDownload}
                aria-label="Download"
              >
                <Icon size="100" src={Icons.Download} />
                <Text size="B300" as="span">
                  Download
                </Text>
              </button>
            )}
          </>
        }
        {...props}
        ref={ref}
      >
        <Box direction="Column" grow="Yes" alignItems="Center" justifyContent="Center" gap="200">
          {isLoading && <Spinner variant="Secondary" size="600" />}
          {isError && (
            <>
              <Text>Failed to load PDF</Text>
              <Button
                variant="Critical"
                fill="Soft"
                size="300"
                radii="300"
                before={<Icon src={Icons.Warning} size="50" />}
                onClick={loadPdfJS}
              >
                <Text size="B300">Retry</Text>
              </Button>
            </>
          )}
          {docState.status === AsyncStatus.Success && (
            <Scroll
              ref={scrollRef}
              size="300"
              direction="Both"
              variant="Surface"
              visibility="Hover"
            >
              <Box>
                <div className={css.PdfViewerContent} ref={containerRef} />
              </Box>
            </Scroll>
          )}
        </Box>
        {docState.status === AsyncStatus.Success && (
          <Header as="footer" className={css.PdfViewerFooter} size="400">
            <button
              type="button"
              className={css.PdfViewerPrevPageButton}
              onClick={handlePrevPage}
              disabled={pageNo <= 1}
              aria-label="Previous Page"
            >
              <Icon size="100" src={Icons.ChevronLeft} />
              <Text size="B300" as="span">
                Previous
              </Text>
            </button>
            <Box grow="Yes" justifyContent="Center" alignItems="Center" gap="200">
              <PopOut
                anchor={jumpAnchor}
                align="Center"
                position="Top"
                content={
                  <FocusTrap
                    focusTrapOptions={{
                      initialFocus: false,
                      onDeactivate: () => setJumpAnchor(undefined),
                      clickOutsideDeactivates: true,
                      escapeDeactivates: stopPropagation,
                    }}
                  >
                    <Menu variant="Surface">
                      <Box
                        as="form"
                        onSubmit={handleJumpSubmit}
                        style={{ padding: config.space.S200 }}
                        direction="Column"
                        gap="200"
                      >
                        <Input
                          name="jumpInput"
                          size="300"
                          variant="Background"
                          defaultValue={pageNo}
                          min={1}
                          max={docState.data.numPages}
                          step={1}
                          outlined
                          type="number"
                          radii="300"
                          aria-label="Page Number"
                        />
                        <Button type="submit" size="300" variant="Primary" radii="300">
                          <Text size="B300">Jump To Page</Text>
                        </Button>
                      </Box>
                    </Menu>
                  </FocusTrap>
                }
              >
                <Chip
                  onClick={handleOpenJump}
                  variant="SurfaceVariant"
                  radii="300"
                  aria-pressed={jumpAnchor !== undefined}
                >
                  <Text size="B300">{`${pageNo}/${docState.data.numPages}`}</Text>
                </Chip>
              </PopOut>
            </Box>
            <button
              type="button"
              className={css.PdfViewerNextPageButton}
              onClick={handleNextPage}
              disabled={pageNo >= docState.data.numPages}
              aria-label="Next Page"
            >
              <Text size="B300" as="span">
                Next
              </Text>
              <Icon size="100" src={Icons.ChevronRight} />
            </button>
          </Header>
        )}
      </MediaFrame>
    );
  }
);
