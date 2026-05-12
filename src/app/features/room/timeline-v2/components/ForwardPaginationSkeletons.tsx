import React from 'react';
import {
  CompactPlaceholder,
  DefaultPlaceholder,
  MessageBase,
} from '../../../../components/message';
import { MessageLayout } from '../../../../state/settings';

type ForwardPaginationSkeletonsProps = {
  layout: MessageLayout;
};

export function ForwardPaginationSkeletons({ layout }: ForwardPaginationSkeletonsProps) {
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
        <MessageBase>
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
      <MessageBase>
        <DefaultPlaceholder />
      </MessageBase>
    </>
  );
}
