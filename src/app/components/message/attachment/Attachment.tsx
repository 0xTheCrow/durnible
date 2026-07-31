import React from 'react';
import { Box, as } from 'folds';
import classNames from 'classnames';
import * as css from './Attachment.css';

export const Attachment = as<'div', css.AttachmentVariants>(
  ({ className, outlined, media, ...props }, ref) => (
    <Box
      display="InlineFlex"
      direction="Column"
      className={classNames(css.Attachment({ outlined, media }), className)}
      {...props}
      ref={ref}
    />
  )
);

type AttachmentHeaderProps = {
  isTextOnly?: boolean;
};
export const AttachmentHeader = as<'div', AttachmentHeaderProps>(
  ({ className, isTextOnly, ...props }, ref) => (
    <Box
      shrink="No"
      gap="200"
      className={classNames(
        css.AttachmentHeader,
        isTextOnly && css.AttachmentHeaderTextOnly,
        className
      )}
      {...props}
      ref={ref}
    />
  )
);

export const AttachmentBox = as<'div'>(({ className, ...props }, ref) => (
  <Box
    direction="Column"
    className={classNames(css.AttachmentBox, className)}
    {...props}
    ref={ref}
  />
));

export const AttachmentContent = as<'div'>(({ className, ...props }, ref) => (
  <Box
    direction="Column"
    className={classNames(css.AttachmentContent, className)}
    {...props}
    ref={ref}
  />
));
