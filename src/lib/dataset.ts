import dataset from '../../metadata/dataset.json' with { type: 'json' };

/** Provenance of the corpus text. Edit metadata/dataset.json to change these. */
export const datasetInfo = dataset as { source: string; sourceUrl: string; receivedOn: string; builtFrom: string };
