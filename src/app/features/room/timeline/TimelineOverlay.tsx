import React from 'react';
import classNames from 'classnames';
import { Box, as } from 'folds';
import * as css from './RoomTimeline.css';
import type { TimelineOverlayVariants } from './RoomTimeline.css';

export const TimelineOverlay = as<'div', TimelineOverlayVariants>(
  ({ position, className, ...props }, ref) => (
    <Box
      className={classNames(css.TimelineOverlay({ position }), className)}
      justifyContent="Center"
      alignItems="Center"
      gap="200"
      {...props}
      ref={ref}
    />
  )
);
