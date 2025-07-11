import { useFluent_unstable } from '@fluentui/react-shared-contexts';
import { useEventCallback, useMergedRefs } from '@fluentui/react-utilities';
import * as React from 'react';

import { createSafeZoneAreaStateStore } from './createSafeZoneAreaStateStore';
import { type SafeZoneAreaImperativeHandle, SafeZoneArea } from './SafeZoneArea';

export type UseSafeZoneOptions = {
  /** Enables debug mode: makes drawn shapes visible. */
  debug?: boolean;

  /** Disables the safe zone area. */
  disabled?: boolean;

  /** The time in milliseconds to wait before clearing the safe zone. */
  timeout?: number;

  /** Called when the mouse enters the safe zone. */
  onSafeZoneEnter?: (e: React.MouseEvent) => void;

  /** Called when the mouse moves within the safe zone. */
  onSafeZoneMove?: (e: React.MouseEvent) => void;

  /** Called when the mouse leaves the safe zone. */
  onSafeZoneLeave?: (e: React.MouseEvent) => void;

  /** Called when the safe zone times out, even if a cursor is still over a safe zone. */
  onSafeZoneTimeout?: () => void;
};

export function useSafeZoneArea({
  debug = false,
  disabled = false,

  onSafeZoneEnter,
  onSafeZoneMove,
  onSafeZoneLeave,
  onSafeZoneTimeout,

  timeout = 1500,
}: UseSafeZoneOptions = {}) {
  const [stateStore] = React.useState(createSafeZoneAreaStateStore);
  const { targetDocument } = useFluent_unstable();

  const safeZoneAreaRef = React.useRef<SafeZoneAreaImperativeHandle>(null);
  const containerRef = React.useRef<HTMLElement>(null);
  const targetRef = React.useRef<HTMLElement>(null);

  const timeoutIdRef = React.useRef<number | null>(null);
  const mouseMoveIdRef = React.useRef<number | null>(null);

  const mouseCoordinatesRef = React.useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const containerListenerRef = React.useMemo(() => {
    if (disabled) {
      return () => {
        // do nothing
      };
    }

    let containerEl: HTMLElement | null = null;

    function onContainerMouseEnter() {
      const targetWindow = targetDocument?.defaultView;

      if (!targetWindow) {
        return;
      }

      if (timeoutIdRef.current) {
        targetWindow.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }

      stateStore.toggleActive(false);
    }

    return (el: HTMLElement | null) => {
      if (el === null) {
        containerEl?.removeEventListener('mouseenter', onContainerMouseEnter);
      }

      containerEl = el;
      el?.addEventListener('mouseenter', onContainerMouseEnter);
    };
  }, [disabled, stateStore, targetDocument]);

  const targetListenerRef = React.useMemo(() => {
    if (disabled) {
      return () => {
        // do nothing
      };
    }

    let targetEl: HTMLElement | null = null;

    function onTargetMouseMove(e: MouseEvent) {
      mouseCoordinatesRef.current = { x: e.clientX, y: e.clientY };

      if (timeoutIdRef.current) {
        targetDocument?.defaultView?.clearTimeout(timeoutIdRef.current);
        timeoutIdRef.current = null;
      }

      if (!stateStore.isActive()) {
        stateStore.toggleActive(true);
      }
    }

    return (el: HTMLElement | null) => {
      if (el === null) {
        const targetWindow = targetDocument?.defaultView;

        if (targetWindow) {
          if (mouseMoveIdRef.current) {
            targetWindow.cancelAnimationFrame(mouseMoveIdRef.current);
            mouseMoveIdRef.current = null;
          }

          if (timeoutIdRef.current) {
            targetWindow.clearTimeout(timeoutIdRef.current);
            timeoutIdRef.current = null;
          }
        }

        targetEl?.removeEventListener('mousemove', onTargetMouseMove);
      }

      targetEl = el;
      el?.addEventListener('mousemove', onTargetMouseMove);
    };
  }, [disabled, stateStore, targetDocument]);

  const onSvgMouseEnter = useEventCallback((e: React.MouseEvent) => {
    onSafeZoneEnter?.(e);

    const targetWindow = targetDocument?.defaultView;

    if (!targetWindow) {
      return;
    }

    if (timeoutIdRef.current) {
      targetWindow.clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }

    // React 17 still uses pooled synthetic events
    e.persist();

    timeoutIdRef.current = targetWindow.setTimeout(() => {
      stateStore.toggleActive(false);
      onSafeZoneTimeout?.();
    }, timeout);
  });

  const onSvgMouseMove = useEventCallback((e: React.MouseEvent) => {
    onSafeZoneMove?.(e);
  });

  const onSvgMouseLeave = useEventCallback((e: React.MouseEvent) => {
    onSafeZoneLeave?.(e);
  });

  React.useEffect(() => {
    return stateStore.subscribe(isActive => {
      if (isActive) {
        function updateSVGs() {
          const containerEl = containerRef.current;
          const targetEl = targetRef.current;
          const targetWindow = targetDocument?.defaultView;

          if (containerEl && targetEl) {
            safeZoneAreaRef.current?.updateSVG({
              containerRect: containerEl.getBoundingClientRect(),
              mouseCoordinates: [mouseCoordinatesRef.current.x, mouseCoordinatesRef.current.y],
              targetRect: targetEl.getBoundingClientRect(),
            });
          }

          if (targetWindow) {
            mouseMoveIdRef.current = targetWindow.requestAnimationFrame(updateSVGs);
          }
        }

        updateSVGs();
        return;
      }

      if (mouseMoveIdRef.current) {
        targetDocument?.defaultView?.cancelAnimationFrame(mouseMoveIdRef.current);
        mouseMoveIdRef.current = null;
      }
    });
  }, [stateStore, targetDocument]);

  return {
    containerRef: useMergedRefs(containerRef, containerListenerRef),
    targetRef: useMergedRefs(targetRef, targetListenerRef),

    elementToRender: React.useMemo(
      () =>
        disabled ? null : (
          <SafeZoneArea
            debug={debug}
            onMouseEnter={onSvgMouseEnter}
            onMouseMove={onSvgMouseMove}
            onMouseLeave={onSvgMouseLeave}
            imperativeRef={safeZoneAreaRef}
            stateStore={stateStore}
          />
        ),
      [disabled, debug, onSvgMouseEnter, onSvgMouseMove, onSvgMouseLeave, stateStore],
    ),
  };
}
