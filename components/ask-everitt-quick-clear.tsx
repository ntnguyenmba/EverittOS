'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isSessionExemptPath } from '@/lib/session-policy';

function clearLabel(): string {
  const lang = document.documentElement.lang.toLowerCase();
  if (lang.startsWith('es')) return 'Borrar pregunta';
  if (lang.startsWith('vi')) return 'Xóa câu hỏi';
  return 'Clear question';
}

function setNativeValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

export function AskEverittQuickClear() {
  const pathname = usePathname() || '/';

  useEffect(() => {
    if (isSessionExemptPath(pathname)) return;

    let activeInput: HTMLInputElement | null = null;
    let activeButton: HTMLButtonElement | null = null;
    let cleanupInput: (() => void) | null = null;

    function attach() {
      const input = document.querySelector<HTMLInputElement>('.everitt-cmd-input');
      if (!input || input === activeInput) return;

      cleanupInput?.();
      activeButton?.remove();
      activeInput = input;

      const bar = input.closest<HTMLElement>('.everitt-cmd-bar');
      if (!bar) return;

      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'everitt-cmd-quick-clear';
      button.setAttribute('aria-label', clearLabel());
      button.title = clearLabel();
      button.textContent = '×';
      button.style.display = input.value ? 'inline-flex' : 'none';

      const updateVisibility = () => {
        button.style.display = input.value ? 'inline-flex' : 'none';
      };

      const clear = () => {
        setNativeValue(input, '');
        updateVisibility();
        input.focus();
      };

      button.addEventListener('click', clear);
      input.addEventListener('input', updateVisibility);
      bar.appendChild(button);
      activeButton = button;

      cleanupInput = () => {
        button.removeEventListener('click', clear);
        input.removeEventListener('input', updateVisibility);
      };
    }

    const observer = new MutationObserver(attach);
    observer.observe(document.body, { childList: true, subtree: true });
    attach();

    return () => {
      observer.disconnect();
      cleanupInput?.();
      activeButton?.remove();
    };
  }, [pathname]);

  return (
    <style jsx global>{`
      .everitt-cmd-bar {
        position: relative;
      }

      .everitt-cmd-quick-clear {
        flex: 0 0 auto;
        align-items: center;
        justify-content: center;
        width: 34px;
        height: 34px;
        min-width: 34px;
        padding: 0;
        margin-right: 2px;
        border: 1px solid rgba(36, 63, 83, 0.18);
        border-radius: 999px;
        background: rgba(246, 249, 250, 0.96);
        color: #243f53;
        font: inherit;
        font-size: 23px;
        font-weight: 400;
        line-height: 1;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      .everitt-cmd-quick-clear:hover,
      .everitt-cmd-quick-clear:focus-visible {
        background: #edf2f5;
        border-color: rgba(36, 63, 83, 0.3);
        outline: none;
      }

      @media (max-width: 700px), (pointer: coarse) {
        .everitt-cmd-quick-clear {
          width: 40px;
          height: 40px;
          min-width: 40px;
          font-size: 25px;
        }
      }
    `}</style>
  );
}
