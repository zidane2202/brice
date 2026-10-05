"use client";

import { useLocale } from "next-intl";
import { useEffect, useRef } from "react";
import { UI_EN, UI_EN_EXTRA } from "@/i18n/ui-dictionary";
import { UI_EN_APP } from "@/i18n/ui-dictionary-app";
import { createUiTranslator } from "@/lib/ui-translate";

const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "CODE", "PRE", "TEXTAREA"]);
const translate = createUiTranslator([UI_EN_APP, UI_EN_EXTRA, UI_EN]);

type Tracked = { original: string; written: string };

export function RuntimeI18n() {
  const locale = useLocale();
  const texts = useRef(new WeakMap<Node, Tracked>());
  const attributes = useRef(new WeakMap<Element, Map<string, Tracked>>());

  useEffect(() => {
    const render = (original: string) => (locale === "en" ? translate(original) : original);

    // Si React a réécrit la valeur depuis notre dernier passage, elle devient le nouvel original.
    const sync = (tracked: Tracked | undefined, current: string): Tracked => {
      if (!tracked || current !== tracked.written) return { original: current, written: current };
      return tracked;
    };

    const visitText = (node: Node) => {
      const parent = node.parentElement;
      if (!parent || SKIP_TAGS.has(parent.tagName) || parent.closest("[data-no-i18n]")) return;
      const current = node.textContent ?? "";
      const tracked = sync(texts.current.get(node), current);
      const next = render(tracked.original);
      if (current !== next) node.textContent = next;
      texts.current.set(node, { original: tracked.original, written: next });
    };

    const visitAttributes = (element: Element) => {
      let saved = attributes.current.get(element);
      for (const attr of ATTRS) {
        const current = element.getAttribute(attr);
        if (current === null) continue;
        if (!saved) {
          saved = new Map();
          attributes.current.set(element, saved);
        }
        const tracked = sync(saved.get(attr), current);
        const next = render(tracked.original);
        if (current !== next) element.setAttribute(attr, next);
        saved.set(attr, { original: tracked.original, written: next });
      }
    };

    const visitElement = (element: Element) => {
      if (SKIP_TAGS.has(element.tagName) || element.hasAttribute("data-no-i18n")) return;
      visitAttributes(element);
      for (const child of element.childNodes) visit(child);
    };

    const visit = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) visitText(node);
      else if (node instanceof Element) visitElement(node);
    };

    visit(document.body);
    const observer = new MutationObserver((records) => {
      for (const record of records) {
        if (record.type === "characterData") visit(record.target);
        else if (record.type === "attributes" && record.target instanceof Element) {
          if (!record.target.closest("[data-no-i18n]")) visitAttributes(record.target);
        }
        else for (const node of record.addedNodes) visit(node);
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: [...ATTRS],
    });
    return () => observer.disconnect();
  }, [locale]);

  return null;
}
