import { formatQuotation, type QuoteEntry, type CitationStyle, type QuoteLayout } from '../lib/quotation';
import { isScenePath } from '../lib/reader';
import { exportCitation } from '../lib/citation-export';
import type { CustomQuoteOptions } from '../lib/quotation';
import { setupCitationSelection } from './citation-selection';

const form = document.querySelector<HTMLFormElement>('#citation-form');
if (form) {
  const status = document.querySelector<HTMLElement>('#citation-status')!;
  const output = document.querySelector<HTMLElement>('#citation-output')!;
  const plain = document.querySelector<HTMLTextAreaElement>('#citation-plain')!;
  const source = document.querySelector<HTMLTextAreaElement>('#citation-source')!;
  const preview = document.querySelector<HTMLElement>('#citation-preview')!;
  const sourcePreview = document.querySelector<HTMLElement>('#citation-source-preview')!;
  const guidance = document.querySelector<HTMLElement>('#citation-guidance')!;
  const accessed = form.elements.namedItem('accessed') as HTMLInputElement;
  const now = new Date();
  accessed.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let index: QuoteEntry[] | null = null;
  let result: ReturnType<typeof formatQuotation> | null = null;
  let pending = false;
  let revision = 0;
  const invalidate = () => {
    revision++;
    result = null;
    output.hidden = true;
    plain.value = source.value = '';
    status.textContent = 'Selection changed. Preview again before copying.';
  };
  form.addEventListener('input', event => {
    if (!(event.target instanceof HTMLTextAreaElement)) invalidate();
  });
  const customFields = form.querySelector<HTMLFieldSetElement>('#citation-custom')!;
  const syncCustom = () => {
    const custom = (form.elements.namedItem('style') as HTMLSelectElement).value === 'custom';
    customFields.hidden = customFields.disabled = !custom;
    (form.elements.namedItem('delimiter') as HTMLInputElement).disabled = !custom || (form.elements.namedItem('separator') as HTMLSelectElement).value !== 'custom';
  };
  form.addEventListener('change', event => {
    syncCustom();
    if (!(event.target instanceof HTMLTextAreaElement)) invalidate();
  });
  syncCustom();
  setupCitationSelection(form, invalidate);
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    pending = true;
    const currentRevision = revision;
    const submit = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
    submit.disabled = true;
    form.setAttribute('aria-busy', 'true');
    result = null;
    output.hidden = true;
    status.textContent = 'Preparing citation…';
    const values = new FormData(form);
    try {
      if (!index) {
        const response = await fetch(`/plays/${form.dataset.play}/citation.json`);
        if (!response.ok) throw new Error('The citation index could not be loaded. Check your connection and preview again, or use the full line index.');
        const data: unknown = await response.json();
        if (!Array.isArray(data) || !data.length || !data.every(entry => entry &&
          (entry.kind === 'line' || entry.kind === 'stage_direction' || entry.kind === 'label') && typeof entry.text === 'string' &&
          (entry.ref === null || typeof entry.ref === 'string') && typeof entry.anchor === 'string' &&
          typeof entry.path === 'string' && isScenePath(entry.path, form.dataset.play ?? '') &&
          typeof entry.section === 'string' && typeof entry.speech === 'string' &&
          (entry.speaker === null || typeof entry.speaker === 'string') && ['verse', 'prose', 'unknown'].includes(entry.form))) {
          throw new Error('The citation index is invalid. Reload or use the full line index.');
        }
        index = data as QuoteEntry[];
      }
      if (currentRevision !== revision) return;
      result = formatQuotation(index, {
        title: form.dataset.title!, start: String(values.get('start')).trim(), end: String(values.get('end') ?? '').trim(),
        style: values.get('style') as CitationStyle, layout: values.get('layout') as QuoteLayout,
        includeText: values.get('contents') === 'text', origin: location.origin, accessed: String(values.get('accessed')),
        custom: values.get('style') === 'custom' ? {
          base: values.get('base') as CustomQuoteOptions['base'], separator: values.get('separator') as CustomQuoteOptions['separator'],
          delimiter: String(values.get('delimiter') ?? ''), speakers: values.get('speakers') === 'yes', quotationMarks: values.get('marks') === 'yes',
        } : undefined,
      });
      plain.value = result.text;
      source.value = result.source;
      // Only formatter-generated markup; every source string is HTML-escaped there.
      preview.innerHTML = result.html;
      sourcePreview.innerHTML = result.sourceHtml;
      document.querySelector('#citation-source-heading')!.textContent = result.sourceHeading;
      document.querySelector('#citation-layout-status')!.textContent = result.layoutLabel;
      guidance.replaceChildren(...result.warnings.map(message => {
        const item = document.createElement('li'); item.textContent = message; return item;
      }));
      output.hidden = false;
      status.textContent = `Ready: ${result.ref} · ${result.count} ${result.count === 1 ? 'line' : 'lines'}.`;
    } catch (error) {
      if (currentRevision === revision) status.textContent = error instanceof Error ? error.message : 'Could not prepare the citation. Preview again to retry.';
    } finally {
      pending = false;
      submit.disabled = false;
      form.removeAttribute('aria-busy');
    }
  });
  form.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach(button => button.addEventListener('click', async () => {
    if (!result) return;
    const sourceCopy = button.dataset.copy === 'source';
    const text = sourceCopy ? result.source : result.text;
    const html = sourceCopy ? result.sourceHtml : result.html;
    const field = sourceCopy ? source : plain;
    try {
      if (button.dataset.copy !== 'plain' && navigator.clipboard?.write && typeof ClipboardItem !== 'undefined') {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([text], { type: 'text/plain' }), 'text/html': new Blob([html], { type: 'text/html' }) })]);
      } else {
        await navigator.clipboard.writeText(text);
      }
      status.textContent = sourceCopy ? 'Source entry copied.' : 'Citation copied.';
    } catch {
      field.focus(); field.select();
      status.textContent = 'Clipboard access is unavailable. The plain text is selected; press Ctrl+C (Windows) or Command+C (Mac) to copy.';
    }
  }));
  form.querySelectorAll<HTMLButtonElement>('[data-export]').forEach(button => button.addEventListener('click', () => {
    if (!result) return;
    const format = button.dataset.export as 'ris' | 'bib';
    const text = exportCitation({ title: form.dataset.title!, playId: form.dataset.play!, ref: result.ref, url: result.url, accessed: accessed.value }, format);
    const url = URL.createObjectURL(new Blob([text], { type: format === 'ris' ? 'application/x-research-info-systems;charset=utf-8' : 'application/x-bibtex;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url; link.download = `${form.dataset.play}-${result.ref}.${format}`.replace(/[^A-Za-z0-9.\-]/g, '-');
    document.body.append(link); link.click(); link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    status.textContent = `${format === 'ris' ? 'RIS' : 'BibTeX'} download prepared.`;
  }));
  form.hidden = false;
}
