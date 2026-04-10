import React, { useCallback, useMemo } from 'react';
import { Box, Text, color } from 'folds';
import { EventTimelineSet, MatrixClient, MatrixEvent, RelationType } from 'matrix-js-sdk';
import { MessageEvent } from '../../../types/matrix/room';
import * as css from './MPoll.css';

type PollAnswer = {
  id: string;
  'org.matrix.msc1767.text'?: string;
  'org.matrix.msc3381.v2.text'?: string;
  'm.text'?: string;
  // legacy fallback from older poll spec versions
  body?: string;
};

type PollContent = {
  question?: {
    'org.matrix.msc1767.text'?: string;
    'org.matrix.msc3381.v2.text'?: string;
    'm.text'?: string;
    body?: string;
    text?: string;
  };
  kind?: string;
  max_selections?: number;
  answers?: PollAnswer[];
};

const UNDISCLOSED_KINDS = [
  'org.matrix.msc3381.v1.undisclosed',
  'org.matrix.msc3381.v2.undisclosed',
  'm.undisclosed',
];

function getPollContent(mEvent: MatrixEvent): PollContent | undefined {
  const content = mEvent.getContent();
  return (
    content['org.matrix.msc3381.poll.start'] ??
    content['m.poll.start'] ??
    content['org.matrix.msc3381.v2.poll'] ??
    undefined
  );
}

function getAnswerText(answer: PollAnswer): string {
  return (
    answer['org.matrix.msc1767.text'] ??
    answer['org.matrix.msc3381.v2.text'] ??
    answer['m.text'] ??
    answer.body ??
    answer.id
  );
}

function getQuestionText(pollContent: PollContent): string {
  const q = pollContent.question;
  if (!q) return 'Poll';
  return (
    q['org.matrix.msc1767.text'] ??
    q['org.matrix.msc3381.v2.text'] ??
    q['m.text'] ??
    q.body ??
    q.text ??
    'Poll'
  );
}

type VoteCounts = Map<string, { count: number; voters: Set<string> }>;

function aggregateVotes(
  responses: MatrixEvent[],
  validAnswerIds: Set<string>,
  endTs?: number
): VoteCounts {
  // Only keep the latest response per user
  const latestByUser = new Map<string, MatrixEvent>();
  for (const evt of responses) {
    if (endTs !== undefined && evt.getTs() > endTs) continue;
    const sender = evt.getSender();
    if (!sender) continue;
    const existing = latestByUser.get(sender);
    if (!existing || evt.getTs() > existing.getTs()) {
      latestByUser.set(sender, evt);
    }
  }

  const counts: VoteCounts = new Map();
  for (const [userId, evt] of latestByUser) {
    const content = evt.getContent();
    const responseData = content['org.matrix.msc3381.poll.response'] ?? content['m.poll.response'];
    const answers: string[] = responseData?.answers ?? [];
    for (const answerId of answers) {
      if (!validAnswerIds.has(answerId)) continue;
      const entry = counts.get(answerId) ?? { count: 0, voters: new Set() };
      entry.count += 1;
      entry.voters.add(userId);
      counts.set(answerId, entry);
    }
  }
  return counts;
}

type MPollProps = {
  mEvent: MatrixEvent;
  timelineSet: EventTimelineSet;
  mx: MatrixClient;
};

export function MPoll({ mEvent, timelineSet, mx }: MPollProps) {
  const eventId = mEvent.getId();
  // Memoize so the `?? []` fallback below doesn't manufacture a fresh empty
  // array every render — that defeats the downstream useMemos that depend on
  // `answers` (and would also break referential equality for child re-renders).
  const pollContent = useMemo(() => getPollContent(mEvent), [mEvent]);

  const answers = useMemo(() => pollContent?.answers ?? [], [pollContent]);
  const question = pollContent ? getQuestionText(pollContent) : 'Poll';
  const kind = pollContent?.kind ?? 'org.matrix.msc3381.v2.disclosed';
  const isUndisclosed = UNDISCLOSED_KINDS.includes(kind);

  const validAnswerIds = useMemo(() => new Set(answers.map((a) => a.id)), [answers]);

  // Get poll responses
  const responseRelations = eventId
    ? timelineSet.relations.getChildEventsForEvent(
        eventId,
        RelationType.Reference,
        MessageEvent.PollResponse
      ) ??
      timelineSet.relations.getChildEventsForEvent(
        eventId,
        RelationType.Reference,
        'm.poll.response'
      )
    : undefined;

  // Get poll end events
  const endRelations = eventId
    ? timelineSet.relations.getChildEventsForEvent(
        eventId,
        RelationType.Reference,
        MessageEvent.PollEnd
      ) ??
      timelineSet.relations.getChildEventsForEvent(eventId, RelationType.Reference, 'm.poll.end')
    : undefined;

  const endEvents = endRelations?.getRelations() ?? [];
  const isEnded = endEvents.length > 0;
  const endTs = isEnded ? Math.min(...endEvents.map((e) => e.getTs())) : undefined;

  const voteCounts = useMemo(
    () => aggregateVotes(responseRelations?.getRelations() ?? [], validAnswerIds, endTs),
    [responseRelations, validAnswerIds, endTs]
  );

  const totalVotes = useMemo(() => {
    let total = 0;
    for (const [, entry] of voteCounts) {
      total += entry.count;
    }
    return total;
  }, [voteCounts]);

  const myUserId = mx.getUserId();
  const myVotedAnswers = useMemo(() => {
    const voted = new Set<string>();
    for (const [answerId, entry] of voteCounts) {
      if (myUserId && entry.voters.has(myUserId)) {
        voted.add(answerId);
      }
    }
    return voted;
  }, [voteCounts, myUserId]);

  const showResults = !isUndisclosed || isEnded;

  const handleVote = useCallback(
    (answerId: string) => {
      if (!eventId || isEnded) return;
      mx.sendEvent(mEvent.getRoomId()!, MessageEvent.PollResponse, {
        'm.relates_to': {
          rel_type: 'm.reference',
          event_id: eventId,
        },
        'org.matrix.msc3381.poll.response': {
          answers: [answerId],
        },
      });
    },
    [mx, mEvent, eventId, isEnded]
  );

  if (!pollContent) {
    return (
      <Text size="T300" priority="300">
        Unsupported poll format
      </Text>
    );
  }

  return (
    <div className={css.PollContainer}>
      <Text className={css.PollQuestion} size="T400">
        {question}
      </Text>
      {answers.map((answer) => {
        const count = voteCounts.get(answer.id)?.count ?? 0;
        const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
        const isMyVote = myVotedAnswers.has(answer.id);

        return (
          <button
            key={answer.id}
            type="button"
            className={css.PollOption}
            aria-pressed={isMyVote}
            aria-disabled={isEnded}
            onClick={() => !isEnded && handleVote(answer.id)}
          >
            <Box justifyContent="SpaceBetween" alignItems="Center" gap="200">
              <Text size="T300">{getAnswerText(answer)}</Text>
              {showResults && (
                <Text size="T200" priority="300">
                  {count} {count === 1 ? 'vote' : 'votes'} ({pct}%)
                </Text>
              )}
            </Box>
            {showResults && (
              <div
                className={css.PollOptionBar}
                style={{
                  width: `${pct}%`,
                  backgroundColor: isMyVote ? color.Primary.Main : color.Secondary.Main,
                }}
              />
            )}
          </button>
        );
      })}
      <Box justifyContent="SpaceBetween" alignItems="Center">
        <Text size="T200" priority="300">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
          {isUndisclosed && !isEnded ? ' (results hidden until poll ends)' : ''}
        </Text>
        {isEnded && (
          <Text className={css.PollEnded} size="T200" priority="300">
            Poll ended
          </Text>
        )}
      </Box>
    </div>
  );
}
