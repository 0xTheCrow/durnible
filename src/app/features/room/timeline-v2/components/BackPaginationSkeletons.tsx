import React from 'react';
import {
  CompactPlaceholder,
  DefaultPlaceholder,
  MessageBase,
} from '../../../../components/message';
import { MessageLayout } from '../../../../state/settings';

type BackPaginationSkeletonsProps = {
  layout: MessageLayout;
  anchorRef: (element: HTMLElement | null) => void;
};

export function BackPaginationSkeletons({ layout, anchorRef }: BackPaginationSkeletonsProps) {
  if (layout === MessageLayout.Compact) {
    return (
      <>
        <MessageBase>
          <CompactPlaceholder />
        </MessageBase>
        <MessageBase>
          <CompactPlaceholder />
        </MessageBase>
        <MessageBase>
          <CompactPlaceholder />
        </MessageBase>
        <MessageBase>
          <CompactPlaceholder />
        </MessageBase>
        <MessageBase ref={anchorRef}>
          <CompactPlaceholder />
        </MessageBase>
      </>
    );
  }
  return (
    <>
      <MessageBase>
        <DefaultPlaceholder />
      </MessageBase>
      <MessageBase>
        <DefaultPlaceholder />
      </MessageBase>
      <MessageBase ref={anchorRef}>
        <DefaultPlaceholder />
      </MessageBase>
    </>
  );
}
