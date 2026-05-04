import { useCallback, useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import type { OnIntersectionCallback } from './useIntersectionObserver';
import { useIntersectionObserver } from './useIntersectionObserver';
import { getScrollInfo, isIntersectingScrollView } from '../utils/dom';

const PAGINATOR_ANCHOR_ATTR = 'data-paginator-anchor';

export enum Direction {
  Backward = 'B',
  Forward = 'F',
}

export type ItemRange = {
  start: number;
  end: number;
};

type HandleObserveAnchor = (element: HTMLElement | null) => void;

type VirtualPaginatorOptions<TScrollElement extends HTMLElement> = {
  count: number;
  limit: number;
  range: ItemRange;
  onRangeChange: (range: ItemRange) => void;
  getScrollElement: () => TScrollElement | null;
  getItemElement: (index: number) => HTMLElement | undefined;
  onEnd?: (back: boolean) => void;
};

type VirtualPaginator = {
  getItems: () => number[];
  observeBackAnchor: HandleObserveAnchor;
  observeFrontAnchor: HandleObserveAnchor;
};

const generateItems = (range: ItemRange) => {
  const items: number[] = [];
  for (let index = range.start; index < range.end; index += 1) {
    items.push(index);
  }
  return items;
};

const getDropIndex = (
  scrollElement: HTMLElement,
  range: ItemRange,
  dropDirection: Direction,
  getItemElement: (index: number) => HTMLElement | undefined,
  pageThreshold = 1
): number | undefined => {
  const fromBackward = dropDirection === Direction.Backward;
  const items = fromBackward ? generateItems(range) : generateItems(range).reverse();

  const { viewHeight, top, height } = getScrollInfo(scrollElement);
  const { offsetTop: scrollOffsetTop } = scrollElement;
  const bottom = top + viewHeight;
  const dropEdgePx = fromBackward
    ? Math.max(top - viewHeight * pageThreshold, 0)
    : Math.min(bottom + viewHeight * pageThreshold, height);
  if (dropEdgePx === 0 || dropEdgePx === height) return undefined;

  let dropIndex: number | undefined;

  items.find((item) => {
    const element = getItemElement(item);
    if (!element) {
      dropIndex = item;
      return false;
    }
    const { clientHeight } = element;
    const offsetTop = element.offsetTop - scrollOffsetTop;
    const offsetBottom = offsetTop + clientHeight;
    const isInView = fromBackward ? offsetBottom > dropEdgePx : offsetTop < dropEdgePx;
    if (isInView) return true;
    dropIndex = item;
    return false;
  });

  return dropIndex;
};

type RestoreAnchorData = [number | undefined, HTMLElement | undefined];
const getRestoreAnchor = (
  range: ItemRange,
  getItemElement: (index: number) => HTMLElement | undefined,
  direction: Direction
): RestoreAnchorData => {
  let scrollAnchorElement: HTMLElement | undefined;
  const scrollAnchorItem = (
    direction === Direction.Backward ? generateItems(range) : generateItems(range).reverse()
  ).find((item) => {
    const element = getItemElement(item);
    if (element) {
      scrollAnchorElement = element;
      return true;
    }
    return false;
  });
  return [scrollAnchorItem, scrollAnchorElement];
};

const getRestoreScrollData = (scrollTop: number, restoreAnchorData: RestoreAnchorData) => {
  const [anchorItem, anchorElement] = restoreAnchorData;
  if (anchorItem === undefined || !anchorElement) {
    return undefined;
  }
  return {
    scrollTop,
    anchorItem,
    anchorOffsetTop: anchorElement.offsetTop,
  };
};

const useObserveAnchorHandle = (
  intersectionObserver: ReturnType<typeof useIntersectionObserver>,
  anchorType: Direction
): HandleObserveAnchor =>
  useMemo<HandleObserveAnchor>(() => {
    let anchor: HTMLElement | null = null;
    return (element) => {
      if (element === anchor) return;
      if (anchor) intersectionObserver?.unobserve(anchor);
      if (!element) return;
      anchor = element;
      element.setAttribute(PAGINATOR_ANCHOR_ATTR, anchorType);
      intersectionObserver?.observe(element);
    };
  }, [intersectionObserver, anchorType]);

export const useVirtualPaginator = <TScrollElement extends HTMLElement>(
  options: VirtualPaginatorOptions<TScrollElement>
): VirtualPaginator => {
  const { count, limit, range, onRangeChange, getScrollElement, getItemElement, onEnd } = options;

  const initialRenderRef = useRef(true);

  const restoreScrollRef = useRef<{
    scrollTop: number;
    anchorOffsetTop: number;
    anchorItem: number;
  }>();

  const propRef = useRef({
    range,
    limit,
    count,
  });
  if (propRef.current.count !== count) {
    restoreScrollRef.current = undefined;
  }
  propRef.current = {
    range,
    count,
    limit,
  };

  const getItems = useMemo(() => {
    const items = generateItems(range);
    return () => items;
  }, [range]);

  const paginate = useCallback(
    (direction: Direction) => {
      const scrollElement = getScrollElement();
      const { range: currentRange, limit: currentLimit, count: currentCount } = propRef.current;
      let { start, end } = currentRange;

      if (direction === Direction.Backward) {
        restoreScrollRef.current = undefined;
        if (start === 0) {
          onEnd?.(true);
          return;
        }
        if (scrollElement) {
          end =
            getDropIndex(scrollElement, currentRange, Direction.Forward, getItemElement, 2) ?? end;
          restoreScrollRef.current = getRestoreScrollData(
            scrollElement.scrollTop,
            getRestoreAnchor({ start, end }, getItemElement, Direction.Backward)
          );
        }
        start = Math.max(start - currentLimit, 0);
      }

      if (direction === Direction.Forward) {
        restoreScrollRef.current = undefined;
        if (end === currentCount) {
          onEnd?.(false);
          return;
        }
        if (scrollElement) {
          start =
            getDropIndex(scrollElement, currentRange, Direction.Backward, getItemElement, 2) ??
            start;
          restoreScrollRef.current = getRestoreScrollData(
            scrollElement.scrollTop,
            getRestoreAnchor({ start, end }, getItemElement, Direction.Forward)
          );
        }
        end = Math.min(end + currentLimit, currentCount);
      }

      onRangeChange({
        start,
        end,
      });
    },
    [getScrollElement, getItemElement, onEnd, onRangeChange]
  );

  const handlePaginatorElementIntersection: OnIntersectionCallback = useCallback(
    (entries) => {
      const anchorBackward = entries.find(
        (entry) => entry.target.getAttribute(PAGINATOR_ANCHOR_ATTR) === Direction.Backward
      );
      if (anchorBackward?.isIntersecting) {
        paginate(Direction.Backward);
      }
      const anchorForward = entries.find(
        (entry) => entry.target.getAttribute(PAGINATOR_ANCHOR_ATTR) === Direction.Forward
      );
      if (anchorForward?.isIntersecting) {
        paginate(Direction.Forward);
      }
    },
    [paginate]
  );

  const intersectionObserver = useIntersectionObserver(
    handlePaginatorElementIntersection,
    useCallback(
      () => ({
        root: getScrollElement(),
      }),
      [getScrollElement]
    )
  );

  const observeBackAnchor = useObserveAnchorHandle(intersectionObserver, Direction.Backward);
  const observeFrontAnchor = useObserveAnchorHandle(intersectionObserver, Direction.Forward);

  useLayoutEffect(() => {
    const scrollElement = getScrollElement();
    if (!restoreScrollRef.current || !scrollElement) return;
    const {
      anchorOffsetTop: oldOffsetTop,
      anchorItem,
      scrollTop: oldScrollTop,
    } = restoreScrollRef.current;
    const anchorElement = getItemElement(anchorItem);

    if (!anchorElement) return;
    const { offsetTop } = anchorElement;
    const offsetAddition = offsetTop - oldOffsetTop;
    const restoreTop = oldScrollTop + offsetAddition;

    scrollElement.scrollTo({
      top: restoreTop,
      behavior: 'instant',
    });
    restoreScrollRef.current = undefined;
  }, [range, getScrollElement, getItemElement]);

  useEffect(() => {
    if (initialRenderRef.current) {
      initialRenderRef.current = false;
      return;
    }
    const scrollElement = getScrollElement();
    if (!scrollElement) return;
    const backAnchor = scrollElement.querySelector(
      `[${PAGINATOR_ANCHOR_ATTR}="${Direction.Backward}"]`
    ) as HTMLElement | null;
    const frontAnchor = scrollElement.querySelector(
      `[${PAGINATOR_ANCHOR_ATTR}="${Direction.Forward}"]`
    ) as HTMLElement | null;

    if (backAnchor && isIntersectingScrollView(scrollElement, backAnchor)) {
      paginate(Direction.Backward);
      return;
    }
    if (frontAnchor && isIntersectingScrollView(scrollElement, frontAnchor)) {
      paginate(Direction.Forward);
    }
  }, [range, getScrollElement, paginate]);

  return {
    getItems,
    observeBackAnchor,
    observeFrontAnchor,
  };
};
