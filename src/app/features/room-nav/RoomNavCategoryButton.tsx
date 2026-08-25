import React from 'react';
import { as, Chip, Icon, Icons } from 'folds';
import classNames from 'classnames';
import * as css from './styles.css';
import { TruncatedText } from '../../components/TruncatedText';

export const RoomNavCategoryButton = as<'button', { closed?: boolean }>(
  ({ className, closed, children, ...props }, ref) => (
    <Chip
      className={classNames(css.CategoryButton, className)}
      variant="Background"
      radii="Pill"
      before={
        <Icon
          className={css.CategoryButtonIcon}
          size="50"
          src={closed ? Icons.ChevronRight : Icons.ChevronBottom}
        />
      }
      {...props}
      ref={ref}
    >
      <TruncatedText size="O400" priority="300">
        {children}
      </TruncatedText>
    </Chip>
  )
);
