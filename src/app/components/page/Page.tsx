import type { ComponentProps, MutableRefObject, ReactNode } from 'react';
import React, { useRef } from 'react';
import { Box, Header, Icon, Icons, Line, Scroll, Text, as } from 'folds';
import classNames from 'classnames';
import { ContainerColor } from '../../styles/ContainerColor.css';
import * as paneResizeCss from '../../styles/PaneResizeHandle.css';
import * as css from './style.css';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { checkIsSideDock, useCallPaneDock } from '../../hooks/useCallPaneLayout';
import { usePaneResize } from '../../hooks/usePaneResize';
import { useSetting } from '../../state/hooks/settings';
import { settingsAtom } from '../../state/settings';

export const PAGE_NAV_MIN_WIDTH = 180;
export const PAGE_NAV_MAX_CONTAINER_FRACTION = 0.5;
export const PAGE_NAV_KEYBOARD_RESIZE_STEP = 16;

type PageRootProps = {
  nav: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
};

export function PageRoot({ nav, aside, children }: PageRootProps) {
  const screenSize = useScreenSizeContext();
  const { dock } = useCallPaneDock();
  const isAsideBeforeContent = dock === 'Left' || dock === 'Top';

  if (screenSize === ScreenSize.Mobile) {
    return (
      <Box grow="Yes" className={ContainerColor({ variant: 'Background' })}>
        {nav}
        {children}
      </Box>
    );
  }

  return (
    <Box grow="Yes" className={ContainerColor({ variant: 'Background' })}>
      {nav}
      <Line variant="Background" size="300" direction="Vertical" />
      <Box
        grow="Yes"
        direction={checkIsSideDock(dock) ? 'Row' : 'Column'}
        className={css.PageRootContent}
      >
        {isAsideBeforeContent && aside}
        {children}
        {!isAsideBeforeContent && aside}
      </Box>
    </Box>
  );
}

type ClientDrawerLayoutProps = {
  children: ReactNode;
};
export function PageNav({ size, children }: ClientDrawerLayoutProps & css.PageNavVariants) {
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;

  return (
    <Box
      grow={isMobile ? 'Yes' : undefined}
      className={css.PageNav({ size })}
      shrink={isMobile ? 'Yes' : 'No'}
      style={isMobile ? { width: '100%' } : undefined}
      data-tooltip-boundary=""
    >
      <Box grow="Yes" direction="Column">
        {children}
      </Box>
    </Box>
  );
}

type AdjustablePageNavProps = {
  isDrawerMode?: boolean;
  children: ReactNode;
};
export function AdjustablePageNav({ isDrawerMode, children }: AdjustablePageNavProps) {
  const navRef = useRef<HTMLDivElement>(null);
  const screenSize = useScreenSizeContext();
  const [isCollapsed, setIsCollapsed] = useSetting(settingsAtom, 'isPageNavCollapsed');
  const [isResizeEnabled] = useSetting(settingsAtom, 'isPageNavResizeEnabled');
  const [storedWidth, setStoredWidth] = useSetting(settingsAtom, 'pageNavWidth');
  const { paneSize, isResizing, handleResizePointerDown, handleResizeKeyDown } = usePaneResize({
    paneRef: navRef,
    anchor: 'Left',
    size: storedWidth,
    onSizeChange: setStoredWidth,
    minSize: PAGE_NAV_MIN_WIDTH,
    maxContainerFraction: PAGE_NAV_MAX_CONTAINER_FRACTION,
    keyboardStep: PAGE_NAV_KEYBOARD_RESIZE_STEP,
  });

  if (screenSize === ScreenSize.Mobile || isDrawerMode) {
    return <PageNav>{children}</PageNav>;
  }

  if (isCollapsed) {
    return (
      <button
        type="button"
        className={css.PageNavCollapsedStrip}
        onClick={() => setIsCollapsed(false)}
        aria-label="Expand Side Panel"
        data-testid="page-nav-expand-button"
      >
        <Icon src={Icons.ChevronRight} size="200" />
      </button>
    );
  }

  return (
    <Box
      ref={navRef}
      className={css.AdjustablePageNav}
      style={{ width: paneSize }}
      data-testid="page-nav"
      data-tooltip-boundary=""
    >
      <Box grow="Yes" direction="Column">
        {children}
      </Box>
      {isResizeEnabled && (
        <button
          type="button"
          className={classNames(
            paneResizeCss.PaneResizeHandle,
            paneResizeCss.PaneResizeHandleSide,
            paneResizeCss.PaneResizeHandleAnchor.Left
          )}
          data-resizing={isResizing}
          data-testid="page-nav-resize-handle"
          onPointerDown={handleResizePointerDown}
          onKeyDown={handleResizeKeyDown}
          aria-label="Resize Side Panel"
        />
      )}
    </Box>
  );
}

export const PageNavHeader = as<'header', css.PageNavHeaderVariants>(
  ({ className, outlined, ...props }, ref) => (
    <Header
      className={classNames(css.PageNavHeader({ outlined }), className)}
      variant="Background"
      size="600"
      {...props}
      ref={ref}
    />
  )
);

export function PageNavContent({
  scrollRef,
  children,
}: {
  children: ReactNode;
  scrollRef?: MutableRefObject<HTMLDivElement | null>;
}) {
  return (
    <Box grow="Yes" direction="Column">
      <Scroll
        ref={scrollRef}
        variant="Background"
        direction="Vertical"
        size="300"
        hideTrack
        visibility="Hover"
      >
        <div className={css.PageNavContent}>{children}</div>
      </Scroll>
    </Box>
  );
}

export const Page = as<'div'>(({ className, ...props }, ref) => (
  <Box
    grow="Yes"
    direction="Column"
    className={classNames(ContainerColor({ variant: 'Surface' }), className)}
    {...props}
    ref={ref}
  />
));

export const PageHeader = as<'div', css.PageHeaderVariants>(
  ({ className, outlined, balance, ...props }, ref) => (
    <Header
      as="header"
      size="600"
      className={classNames(css.PageHeader({ balance, outlined }), className)}
      {...props}
      ref={ref}
    />
  )
);

export const PageContent = as<'div'>(({ className, ...props }, ref) => (
  <div className={classNames(css.PageContent, className)} {...props} ref={ref} />
));

export function PageHeroEmpty({ children }: { children: ReactNode }) {
  return (
    <Box
      className={classNames(ContainerColor({ variant: 'SurfaceVariant' }), css.PageHeroEmpty)}
      direction="Column"
      alignItems="Center"
      justifyContent="Center"
      gap="200"
    >
      {children}
    </Box>
  );
}

export const PageHeroSection = as<'div', ComponentProps<typeof Box>>(
  ({ className, ...props }, ref) => (
    <Box
      direction="Column"
      className={classNames(css.PageHeroSection, className)}
      {...props}
      ref={ref}
    />
  )
);

export function PageHero({
  icon,
  title,
  subTitle,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  subTitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Box direction="Column" gap="400">
      <Box direction="Column" alignItems="Center" gap="200">
        {icon}
      </Box>
      <Box as="h2" direction="Column" gap="200" alignItems="Center">
        <Text align="Center" size="H2">
          {title}
        </Text>
        {subTitle && (
          <Text align="Center" priority="400">
            {subTitle}
          </Text>
        )}
      </Box>
      {children}
    </Box>
  );
}

export const PageContentCenter = as<'div'>(({ className, ...props }, ref) => (
  <div className={classNames(css.PageContentCenter, className)} {...props} ref={ref} />
));
