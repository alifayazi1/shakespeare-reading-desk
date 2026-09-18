/** Selection is only a shortcut to whole-line references, never an alternate text source. */
export function setupCitationSelection(form: HTMLFormElement, invalidate: () => void) {
  const article = document.querySelector<HTMLElement>('.play-text');
  const button = document.querySelector<HTMLButtonElement>('#cite-selection');
  const panel = document.querySelector<HTMLDetailsElement>('#quote-and-cite');
  const announcement = document.querySelector<HTMLElement>('#cite-selection-status');
  if (!article || !button || !panel || !announcement) return;
  let refs: [string, string] | null = null;
  const hide = () => { refs = null; button.hidden = true; announcement.textContent = ''; };
  const update = () => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount !== 1) {
      if (document.activeElement !== button) hide();
      return;
    }
    const range = selection.getRangeAt(0);
    if (!article.contains(range.startContainer) || !article.contains(range.endContainer)) { hide(); return; }
    const lines = Array.from(article.querySelectorAll<HTMLElement>('[data-ref]')).filter(line => {
      const text = line.querySelector('.line-text');
      if (!text || !range.intersectsNode(text)) return false;
      const overlap = document.createRange(); overlap.selectNodeContents(text);
      if (range.compareBoundaryPoints(Range.START_TO_START, overlap) > 0) overlap.setStart(range.startContainer, range.startOffset);
      if (range.compareBoundaryPoints(Range.END_TO_END, overlap) < 0) overlap.setEnd(range.endContainer, range.endOffset);
      return Boolean(overlap.toString().trim());
    });
    if (!lines.length) { hide(); return; }
    refs = [lines[0].dataset.ref!, lines.at(-1)!.dataset.ref!];
    button.textContent = `Cite this range · ${refs[0]}${refs[0] === refs[1] ? '' : `–${refs[1]}`}`;
    button.hidden = false;
    announcement.textContent = 'Cite this range available. Press Alt+Shift+C to open the citation panel. Partial selections expand to whole numbered lines.';
  };
  const activate = () => {
    if (!refs) return;
    const [start, end] = refs;
    const input = form.elements.namedItem('start') as HTMLInputElement;
    input.value = start;
    (form.elements.namedItem('end') as HTMLInputElement).value = end === start ? '' : end;
    invalidate();
    panel.open = true;
    hide(); window.getSelection()?.removeAllRanges();
    input.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    form.querySelector<HTMLElement>('#citation-status')!.textContent = `Selected ${start}${end === start ? '' : `–${end}`}. Whole numbered lines will be quoted. Preview to continue.`;
  };
  document.addEventListener('selectionchange', update);
  button.addEventListener('pointerdown', event => event.preventDefault());
  button.addEventListener('click', activate);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && refs) { hide(); return; }
    if (event.altKey && event.shiftKey && event.code === 'KeyC' && !event.ctrlKey && !event.metaKey && refs) {
      event.preventDefault(); activate();
    }
  });
}
