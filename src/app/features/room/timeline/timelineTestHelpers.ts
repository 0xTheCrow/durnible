import { EventEmitter } from 'events';
import type { MatrixEvent, Room } from 'matrix-js-sdk';

export type FakeIntersectionObserver = {
  callback: IntersectionObserverCallback;
  observed: Set<Element>;
  observe: (target: Element) => void;
  unobserve: (target: Element) => void;
  disconnect: () => void;
  trigger: (isIntersecting: boolean) => void;
};

export const ioInstances: FakeIntersectionObserver[] = [];

export function createFakeIntersectionObserver(
  cb: IntersectionObserverCallback
): FakeIntersectionObserver {
  const instance: FakeIntersectionObserver = {
    callback: cb,
    observed: new Set(),
    observe(target) {
      instance.observed.add(target);
    },
    unobserve(target) {
      instance.observed.delete(target);
    },
    disconnect() {
      instance.observed.clear();
    },
    trigger(isIntersecting) {
      const rect = {
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: 0,
        height: 0,
        x: 0,
        y: 0,
        toJSON() {
          return {};
        },
      } as DOMRectReadOnly;
      const entries: IntersectionObserverEntry[] = Array.from(instance.observed).map((target) => ({
        target,
        isIntersecting,
        intersectionRatio: isIntersecting ? 1 : 0,
        boundingClientRect: rect,
        intersectionRect: rect,
        rootBounds: null,
        time: 0,
      }));
      instance.callback(entries, instance as unknown as IntersectionObserver);
    },
  };
  return instance;
}

export function installIntersectionObserverStub(): void {
  ioInstances.length = 0;
  const ctor = function StubIntersectionObserver(
    this: IntersectionObserver,
    cb: IntersectionObserverCallback
  ) {
    const instance = createFakeIntersectionObserver(cb);
    ioInstances.push(instance);
    return instance as unknown as IntersectionObserver;
  } as unknown as typeof IntersectionObserver;
  (
    globalThis as unknown as { IntersectionObserver: typeof IntersectionObserver }
  ).IntersectionObserver = ctor;
}

export function findObserverOf(target: Element): FakeIntersectionObserver | undefined {
  return ioInstances.find((io) => io.observed.has(target));
}

export function createEventEmitterRoom(roomId: string): Room & {
  emit: (event: string, ...args: unknown[]) => boolean;
} {
  const emitter = new EventEmitter();
  const room = {
    roomId,
    on: (ev: string, fn: (...args: unknown[]) => void) => {
      emitter.on(ev, fn);
      return room;
    },
    off: (ev: string, fn: (...args: unknown[]) => void) => {
      emitter.off(ev, fn);
      return room;
    },
    removeListener: (ev: string, fn: (...args: unknown[]) => void) => {
      emitter.removeListener(ev, fn);
      return room;
    },
    emit: (ev: string, ...args: unknown[]) => emitter.emit(ev, ...args),
  };
  return room as unknown as Room & {
    emit: (event: string, ...args: unknown[]) => boolean;
  };
}

export function createFakeEvent(type: string): MatrixEvent {
  const id = `$${Math.random().toString(36).slice(2)}`;
  return {
    getId: () => id,
    getType: () => type,
    getContent: () => ({}),
    getRoomId: () => '!test:example.com',
    getSender: () => '@alice:example.com',
    isRedacted: () => false,
  } as unknown as MatrixEvent;
}

export type ScrollGeometry = {
  setScrollHeight: (value: number) => void;
  getScrollTop: () => number;
  setScrollTop: (value: number) => void;
  getLastScrollBehavior: () => string | undefined;
};

export function stubScrollGeometry(
  el: HTMLElement,
  initial: { scrollHeight: number; offsetHeight: number }
): ScrollGeometry {
  let scrollTop = 0;
  let scrollHeight = initial.scrollHeight;
  let lastBehavior: string | undefined;
  const { offsetHeight } = initial;

  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => scrollHeight,
  });
  Object.defineProperty(el, 'offsetHeight', {
    configurable: true,
    get: () => offsetHeight,
  });
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    get: () => offsetHeight,
  });
  Object.defineProperty(el, 'scrollTop', {
    configurable: true,
    get: () => scrollTop,
    set: (v: number) => {
      scrollTop = v;
    },
  });
  Object.defineProperty(el, 'scrollTo', {
    configurable: true,
    writable: true,
    value: (arg: ScrollToOptions | number, y?: number) => {
      if (typeof arg === 'number') {
        scrollTop = y ?? 0;
        return;
      }
      if (arg && typeof arg === 'object') {
        if (typeof arg.top === 'number') scrollTop = arg.top;
        lastBehavior = arg.behavior;
      }
    },
  });

  return {
    setScrollHeight: (value) => {
      scrollHeight = value;
    },
    getScrollTop: () => scrollTop,
    setScrollTop: (value) => {
      scrollTop = value;
    },
    getLastScrollBehavior: () => lastBehavior,
  };
}
