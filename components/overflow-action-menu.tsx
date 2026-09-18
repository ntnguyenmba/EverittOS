'use client';

import { type CSSProperties, type ReactNode, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type OverflowActionMenuProps = {
  label: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

type MenuPosition = {
  left: number;
  top?: number;
  bottom?: number;
  width: number;
  maxHeight: number;
};

const VIEWPORT_GAP = 12;
const MENU_GAP = 8;
const MENU_WIDTH = 224;
const MIN_MENU_SPACE = 220;

export function OverflowActionMenu({ label, open, onOpenChange, children }: OverflowActionMenuProps) {
  const menuId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<MenuPosition | null>(null);
  const onOpenChangeRef = useRef(onOpenChange);

  useLayoutEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  useLayoutEffect(() => {
    if (!open) {
      setPosition(null);
      return;
    }

    function placeMenu() {
      const trigger = triggerRef.current;
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(MENU_WIDTH, window.innerWidth - VIEWPORT_GAP * 2);
      const left = Math.min(
        Math.max(VIEWPORT_GAP, rect.right - width),
        window.innerWidth - width - VIEWPORT_GAP
      );
      const below = window.innerHeight - rect.bottom - MENU_GAP - VIEWPORT_GAP;
      const above = rect.top - MENU_GAP - VIEWPORT_GAP;

      if (below >= MIN_MENU_SPACE || below >= above) {
        setPosition({
          left,
          top: rect.bottom + MENU_GAP,
          width,
          maxHeight: Math.max(120, below)
        });
      } else {
        setPosition({
          left,
          bottom: window.innerHeight - rect.top + MENU_GAP,
          width,
          maxHeight: Math.max(120, above)
        });
      }
    }

    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null;
      if (target && (triggerRef.current?.contains(target) || panelRef.current?.contains(target))) return;
      onOpenChangeRef.current(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      onOpenChangeRef.current(false);
      triggerRef.current?.focus();
    }

    placeMenu();
    window.addEventListener('resize', placeMenu);
    window.addEventListener('scroll', placeMenu, true);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    const focusFrame = window.requestAnimationFrame(() => {
      panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]:not([disabled])')?.focus();
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener('resize', placeMenu);
      window.removeEventListener('scroll', placeMenu, true);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const panelStyle: CSSProperties | undefined = position ? {
    position: 'fixed',
    left: position.left,
    top: position.top,
    bottom: position.bottom,
    width: position.width,
    maxHeight: position.maxHeight,
    overflowY: 'auto',
    zIndex: 10000,
    display: 'grid',
    gap: 4,
    padding: 8,
    border: '1px solid var(--eo-color-border, #DDE6F2)',
    borderRadius: 14,
    background: 'var(--eo-color-surface, #FFFFFF)',
    boxShadow: '0 18px 48px rgba(23, 32, 51, 0.18)'
  } : undefined;

  return (
    <div className="jobs-more-menu">
      <button
        ref={triggerRef}
        type="button"
        className="jobs-menu-trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-controls={menuId}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          onOpenChange(!open);
        }}
      >
        •••
      </button>
      {open && position && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={panelRef}
              id={menuId}
              className="app-overflow-menu"
              role="menu"
              style={panelStyle}
              onClick={(event) => event.stopPropagation()}
            >
              {children}
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
