import type { JoinRule } from 'matrix-js-sdk';
import { AvatarFallback, AvatarImage, Icon, Icons, color } from 'folds';
import type { ComponentProps, ReactEventHandler, ReactNode } from 'react';
import React, { forwardRef, useState } from 'react';
import * as css from './RoomAvatar.css';
import { joinRuleToIconSrc } from '../../utils/room';
import colorMXID from '../../../util/colorMXID';
import { markCachedMediaUrl } from '../../utils/mediaCache';

type RoomAvatarProps = {
  roomId: string;
  src?: string;
  alt?: string;
  renderFallback: () => ReactNode;
};
export function RoomAvatar({ roomId, src, alt, renderFallback }: RoomAvatarProps) {
  const [error, setError] = useState(false);

  const handleLoad: ReactEventHandler<HTMLImageElement> = (evt) => {
    evt.currentTarget.setAttribute('data-image-loaded', 'true');
  };

  if (!src || error) {
    return (
      <AvatarFallback
        style={{ backgroundColor: colorMXID(roomId ?? ''), color: color.Surface.Container }}
        className={css.RoomAvatar}
      >
        {renderFallback()}
      </AvatarFallback>
    );
  }

  return (
    <AvatarImage
      className={css.RoomAvatar}
      src={markCachedMediaUrl(src, 'avatar')}
      alt={alt}
      onError={() => setError(true)}
      onLoad={handleLoad}
      draggable={false}
    />
  );
}

export const RoomIcon = forwardRef<
  SVGSVGElement,
  Omit<ComponentProps<typeof Icon>, 'src'> & {
    joinRule: JoinRule;
    space?: boolean;
    call?: boolean;
  }
>(({ joinRule, space, call, ...props }, ref) => {
  const src = call ? Icons.VolumeHigh : joinRuleToIconSrc(Icons, joinRule, space || false);

  return <Icon src={src ?? Icons.Hash} {...props} ref={ref} />;
});
