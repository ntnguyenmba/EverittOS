'use client';

import { useEffect, useMemo } from 'react';
import { useTranslation } from '@/components/locale-provider';
import { getMessages, type Messages } from '@/lib/i18n/get-messages';

type FlatMessages = Record<string, string>;

function flattenMessages(value: unknown, prefix = '', output: FlatMessages = {}): FlatMessages {
  if (!value || typeof value !== 'object') return output;

  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') output[path] = child;
    else flattenMessages(child, path, output);
  }

  return output;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function buildTranslationMap(locale: 'en' | 'es' | 'vi'): Map<string, string> {
  const catalogs: Messages[] = [getMessages('en'), getMessages('es'), getMessages('vi')];
  const flattened = catalogs.map((catalog) => flattenMessages(catalog));
  const target = flattened[locale === 'en' ? 0 : locale === 'es' ? 1 : 2];
  const result = new Map<string, string>();

  for (const sourceCatalog of flattened) {
    for (const [path, sourceValue] of Object.entries(sourceCatalog)) {
      const translatedValue = target[path];
      if (!translatedValue || /\{\w+\}/.test(sourceValue) || /\{\w+\}/.test(translatedValue)) continue;
      const source = normalize(sourceValue);
      if (!source || source.length > 180) continue;
      result.set(source, translatedValue);
    }
  }

  return result;
}

function shouldSkip(element: Element | null): boolean {
  if (!element) return true;
  return Boolean(
    element.closest(
      '[data-no-translate], [data-user-content], [contenteditable="true"], script, style, code, pre, textarea'
    )
  );
}

function translateElementAttributes(root: ParentNode, translations: Map<string, string>) {
  const elements = root.querySelectorAll<HTMLElement>('[placeholder], [title], [aria-label]');
  for (const element of elements) {
    if (shouldSkip(element)) continue;
    for (const attribute of ['placeholder', 'title', 'aria-label'] as const) {
      const current = element.getAttribute(attribute);
      if (!current) continue;
      const translated = translations.get(normalize(current));
      if (translated && translated !== current) element.setAttribute(attribute, translated);
    }
  }
}

function translateTextNodes(root: ParentNode, translations: Map<string, string>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let current = walker.nextNode();
  while (current) {
    nodes.push(current as Text);
    current = walker.nextNode();
  }

  for (const node of nodes) {
    const parent = node.parentElement;
    if (shouldSkip(parent)) continue;
    const raw = node.nodeValue || '';
    const key = normalize(raw);
    if (!key) continue;
    const translated = translations.get(key);
    if (!translated || translated === key) continue;
    const leading = raw.match(/^\s*/)?.[0] || '';
    const trailing = raw.match(/\s*$/)?.[0] || '';
    node.nodeValue = `${leading}${translated}${trailing}`;
  }
}

export function GlobalLocaleFallback() {
  const { locale } = useTranslation();
  const translations = useMemo(() => buildTranslationMap(locale), [locale]);

  useEffect(() => {
    let scheduled = false;

    const apply = () => {
      scheduled = false;
      translateTextNodes(document.body, translations);
      translateElementAttributes(document.body, translations);
    };

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(apply);
    };

    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'title', 'aria-label']
    });

    return () => observer.disconnect();
  }, [translations]);

  return null;
}
