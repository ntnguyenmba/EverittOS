'use client';

import { useEffect } from 'react';

declare global {
  interface Window {
    google?: {
      maps?: {
        places?: {
          Autocomplete: new (
            input: HTMLInputElement,
            options?: { fields?: string[]; types?: string[]; componentRestrictions?: { country: string | string[] } }
          ) => {
            addListener: (eventName: string, callback: () => void) => void;
            getPlace: () => { formatted_address?: string; name?: string };
          };
        };
      };
    };
  }
}

const SCRIPT_ID = 'everittos-google-places';

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

export function JobAddressAutocomplete() {
  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim();
    if (!apiKey) return;

    let cancelled = false;
    let observer: MutationObserver | null = null;

    const attach = () => {
      if (cancelled || !window.google?.maps?.places?.Autocomplete) return false;
      const input = findAddressInput();
      if (!input || input.dataset.googleAutocompleteAttached === 'true') return Boolean(input);

      input.dataset.googleAutocompleteAttached = 'true';
      input.autocomplete = 'street-address';
      input.placeholder = input.placeholder || 'Start typing an address or enter it manually';

      const autocomplete = new window.google.maps.places.Autocomplete(input, {
        fields: ['formatted_address', 'name'],
        types: ['address'],
        componentRestrictions: { country: ['us'] }
      });

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        const selectedAddress = place.formatted_address || place.name;
        if (selectedAddress) dispatchReactInput(input, selectedAddress);
      });

      return true;
    };

    const startWatching = () => {
      if (attach()) return;
      observer = new MutationObserver(() => {
        if (attach()) observer?.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    };

    if (window.google?.maps?.places?.Autocomplete) {
      startWatching();
    } else {
      const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
      const script = existing || document.createElement('script');
      if (!existing) {
        script.id = SCRIPT_ID;
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&libraries=places&loading=async`;
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }
      script.addEventListener('load', startWatching, { once: true });
    }

    return () => {
      cancelled = true;
      observer?.disconnect();
    };
  }, []);

  return null;
}
