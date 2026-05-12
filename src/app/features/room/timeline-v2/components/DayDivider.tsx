import React from 'react';
import { Badge, Text } from 'folds';
import { MessageBase } from '../../../../components/message';
import { useSetting } from '../../../../state/hooks/settings';
import { settingsAtom } from '../../../../state/settings';
import { timeDayMonthYear, today, yesterday } from '../../../../utils/time';
import { TimelineDivider } from './TimelineDivider';

type DayDividerProps = {
  ts: number;
};

export function DayDivider({ ts }: DayDividerProps) {
  const [messageSpacing] = useSetting(settingsAtom, 'messageSpacing');
  const label = (() => {
    if (today(ts)) return 'Today';
    if (yesterday(ts)) return 'Yesterday';
    return timeDayMonthYear(ts);
  })();

  return (
    <MessageBase space={messageSpacing}>
      <TimelineDivider variant="Surface">
        <Badge as="span" size="500" variant="Secondary" fill="None" radii="300">
          <Text size="L400">{label}</Text>
        </Badge>
      </TimelineDivider>
    </MessageBase>
  );
}
