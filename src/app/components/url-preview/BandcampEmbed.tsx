import React from 'react';
import classNames from 'classnames';
import { Box, Text, as, color } from 'folds';
import * as css from './BandcampEmbed.css';
import { BandcampInfo } from '../../utils/embeds';

const linkStyles = { color: color.Success.Main };
const labelStyles = { color: color.SurfaceVariant.OnContainer };

export const BandcampEmbed = as<'div', { info: BandcampInfo; url: string }>(
  ({ info, url, className, ...props }, ref) => {
    const cleanUrl = `https://${info.artist}.bandcamp.com/${info.type}/${info.slug}`;

    return (
      <Box
        shrink="No"
        direction="Column"
        className={classNames(css.BandcampEmbed, className)}
        {...props}
        ref={ref}
      >
        <div className={css.BandcampBody}>
          <Text style={labelStyles} size="T300" priority="300">
            {`${info.artist} — ${info.type}`}
          </Text>
          <Text style={labelStyles} size="T200" priority="400">
            {info.slug.replace(/-/g, ' ')}
          </Text>
        </div>
        <div className={css.BandcampLink}>
          <Text
            style={linkStyles}
            as="a"
            href={cleanUrl}
            target="_blank"
            rel="noreferrer noopener"
            size="T200"
            priority="300"
          >
            {`[Bandcamp] - ${cleanUrl}`}
          </Text>
        </div>
      </Box>
    );
  }
);
