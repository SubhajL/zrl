import type {
  ArtifactType,
  DestinationMarket,
  ProductType,
} from '../../../frontend/src/lib/types';
import { loadDocumentCatalogSync } from './document-catalog';

export interface DocumentCatalogBrowserRequiredSlot {
  readonly combo: `${DestinationMarket}/${ProductType}`;
  readonly documentLabel: string;
  readonly artifactType: ArtifactType;
  readonly fixturePath: string;
  readonly uploadFileName: string;
  readonly expectedPresentFieldKeys: readonly string[];
}

function slugifyDocumentLabel(documentLabel: string): string {
  return documentLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

export const DOCUMENT_CATALOG_BROWSER_REQUIRED_SLOTS: readonly DocumentCatalogBrowserRequiredSlot[] =
  loadDocumentCatalogSync()
    .fixtureBackedRequiredSlots.map((slot) => ({
      combo: slot.combo,
      documentLabel: slot.documentLabel,
      artifactType: slot.artifactType,
      fixturePath: slot.fixturePath.replace(
        'frontend/e2e/test-assets/ocr-forms/',
        '',
      ),
      uploadFileName: `${slot.combo.toLowerCase().replace('/', '-')}-${slugifyDocumentLabel(slot.documentLabel)}.svg`,
      expectedPresentFieldKeys: slot.expectedPresentFieldKeys,
    }))
    .sort((left, right) =>
      left.combo === right.combo
        ? left.documentLabel.localeCompare(right.documentLabel)
        : left.combo.localeCompare(right.combo),
    );

export const DOCUMENT_CATALOG_BROWSER_REQUIRED_SLOT_COUNT =
  DOCUMENT_CATALOG_BROWSER_REQUIRED_SLOTS.length;
