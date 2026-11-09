import { useLayoutEffect, useState, type RefObject } from 'react';

export function useTabScroll(ref: RefObject<HTMLElement | null>, activeId: string, order: string) {
  const [edges, setEdges] = useState({ left: false, right: false });
  useLayoutEffect(() => {
    const element = ref.current; if (!element) return;
    const update = () => {
      const next = { left: element.scrollLeft > 1, right: element.scrollLeft + element.clientWidth < element.scrollWidth - 1 };
      setEdges(previous => previous.left === next.left && previous.right === next.right ? previous : next);
    };
    const selected = Array.from(element.querySelectorAll<HTMLElement>('[data-tab-id]')).find(tab => tab.dataset.tabId === activeId);
    if (selected) {
      const box = selected.closest('.document-tab')!.getBoundingClientRect(); const viewport = element.getBoundingClientRect();
      const inset = parseFloat(getComputedStyle(element).scrollPaddingInlineStart) || 0;
      if (box.left < viewport.left + inset) element.scrollLeft -= viewport.left + inset - box.left;
      else if (box.right > viewport.right - inset) element.scrollLeft += box.right - viewport.right + inset;
    }
    update(); const observer = new ResizeObserver(update); observer.observe(element);
    for (const child of element.children) observer.observe(child);
    element.addEventListener('scroll', update, { passive: true });
    const region = element.parentElement;
    const wheel = (event: WheelEvent) => {
      if (event.ctrlKey || event.metaKey || element.scrollWidth <= element.clientWidth) return;
      const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
      if (!delta) return;
      const scale = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? 16 : event.deltaMode === WheelEvent.DOM_DELTA_PAGE ? element.clientWidth : 1;
      event.preventDefault(); element.scrollLeft += delta * scale;
    };
    region?.addEventListener('wheel', wheel, { passive: false });
    return () => { observer.disconnect(); element.removeEventListener('scroll', update); region?.removeEventListener('wheel', wheel); };
  }, [ref, activeId, order]);
  return { ...edges, scroll: (direction: number) => { const element = ref.current; if (element) element.scrollBy({ left: direction * Math.max(180, element.clientWidth * .65), behavior: 'smooth' }); } };
}
