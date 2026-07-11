'use client';

import { useEffect } from 'react';

type PhotonFeature = {
  properties?: {
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    district?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
};

type PhotonResponse = {
  features?: PhotonFeature[];
};

function findAddressInput(): HTMLInputElement | null {
  const form = document.querySelector<HTMLFormElement>('.unified-job-form');
  if (!form) return null;

  const labels = Array.from(form.querySelectorAll('label'));
  const addressLabel = labels.find((label) => label.textContent?.trim().toLowerCase() === 'address');
  const input = addressLabel?.nextElementSibling;
  return input instanceof HTMLInputElement ? input : null;
}

function dispatchReactInput(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function formatAddress(feature: PhotonFeature): string {
  const p = feature.properties || {};
  const streetLine = [p.housenumber, p.street || p.name].filter(Boolean).join(' ');
  const locality = p.city || p.district;
  return [streetLine, locality, p.state, p.postcode, p.country].filter(Boolean).join(', ');
}

export function JobAddressAutocomplete() {
  useEffect(() => {
    let cancelled = false;
    let observer: MutationObserver | null = null;
    let cleanupInput: (() => void) | null = null;

    function attach() {
      const input = findAddressInput();
      if (!input || input.dataset.photonAutocompleteAttached === 'true') return Boolean(input);

      input.dataset.photonAutocompleteAttached = 'true';
      input.autocomplete = 'street-address';
      input.placeholder = 'Start typing an address or enter it manually';

      const wrapper = document.createElement('div');
      wrapper.style.position = 'relative';
      wrapper.style.width = '100%';
      input.parentNode?.insertBefore(wrapper, input);
      wrapper.appendChild(input);

      const menu = document.createElement('div');
      menu.setAttribute('role', 'listbox');
      menu.style.position = 'absolute';
      menu.style.zIndex = '30';
      menu.style.top = 'calc(100% + 6px)';
      menu.style.left = '0';
      menu.style.right = '0';
      menu.style.display = 'none';
      menu.style.maxHeight = '260px';
      menu.style.overflowY = 'auto';
      menu.style.border = '1px solid var(--line)';
      menu.style.borderRadius = 'var(--radius-md, 12px)';
      menu.style.background = 'var(--surface)';
      menu.style.boxShadow = 'var(--shadow-subtle)';
      wrapper.appendChild(menu);

      let timer: ReturnType<typeof setTimeout> | null = null;
      let controller: AbortController | null = null;
      let activeIndex = -1;
      let options: HTMLButtonElement[] = [];

      const closeMenu = () => {
        menu.style.display = 'none';
        menu.replaceChildren();
        options = [];
        activeIndex = -1;
      };

      const highlight = (index: number) => {
        options.forEach((option, optionIndex) => {
          option.style.background = optionIndex === index ? 'var(--surface-subtle)' : 'transparent';
        });
        activeIndex = index;
        options[index]?.scrollIntoView({ block: 'nearest' });
      };

      const renderResults = (features: PhotonFeature[]) => {
        closeMenu();
        const addresses = Array.from(new Set(features.map(formatAddress).filter(Boolean))).slice(0, 6);
        if (addresses.length === 0) return;

        options = addresses.map((address) => {
          const button = document.createElement('button');
          button.type = 'button';
          button.setAttribute('role', 'option');
          button.textContent = address;
          button.style.display = 'block';
          button.style.width = '100%';
          button.style.padding = '12px 14px';
          button.style.border = '0';
          button.style.borderBottom = '1px solid var(--line)';
          button.style.background = 'transparent';
          button.style.color = 'inherit';
          button.style.textAlign = 'left';
          button.style.cursor = 'pointer';
          button.addEventListener('mousedown', (event) => event.preventDefault());
          button.addEventListener('click', () => {
            dispatchReactInput(input, address);
            closeMenu();
            input.focus();
          });
          menu.appendChild(button);
          return button;
        });

        if (options.length > 0) options[options.length - 1].style.borderBottom = '0';
        menu.style.display = 'block';
      };

      const search = async (query: string) => {
        controller?.abort();
        controller = new AbortController();
        try {
          const url = new URL('https://photon.komoot.io/api/');
          url.searchParams.set('q', query);
          url.searchParams.set('limit', '6');
          url.searchParams.set('lang', 'en');
          const response = await fetch(url.toString(), { signal: controller.signal });
          if (!response.ok) throw new Error('Address search failed');
          const data = (await response.json()) as PhotonResponse;
          if (!cancelled) renderResults(data.features || []);
        } catch (error) {
          if ((error as Error).name !== 'AbortError') closeMenu();
        }
      };

      const onInput = () => {
        if (timer) clearTimeout(timer);
        const query = input.value.trim();
        if (query.length < 3) {
          controller?.abort();
          closeMenu();
          return;
        }
        timer = setTimeout(() => void search(query), 350);
      };

      const onKeyDown = (event: KeyboardEvent) => {
        if (menu.style.display === 'none' || options.length === 0) return;
        if (event.key === 'ArrowDown') {
          event.preventDefault();
          highlight((activeIndex + 1) % options.length);
        } else if (event.key === 'ArrowUp') {
          event.preventDefault();
          highlight(activeIndex <= 0 ? options.length - 1 : activeIndex - 1);
        } else if (event.key === 'Enter' && activeIndex >= 0) {
          event.preventDefault();
          options[activeIndex].click();
        } else if (event.key === 'Escape') {
          closeMenu();
        }
      };

      const onBlur = () => window.setTimeout(closeMenu, 150);
      input.addEventListener('input', onInput);
      input.addEventListener('keydown', onKeyDown);
      input.addEventListener('blur', onBlur);

      cleanupInput = () => {
        if (timer) clearTimeout(timer);
        controller?.abort();
        input.removeEventListener('input', onInput);
        input.removeEventListener('keydown', onKeyDown);
        input.removeEventListener('blur', onBlur);
        input.removeAttribute('data-photon-autocomplete-attached');
        closeMenu();
      };

      return true;
    }

    if (!attach()) {
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
      cleanupInput?.();
    };
  }, []);

  return null;
}
