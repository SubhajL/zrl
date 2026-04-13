import ocrFixtureManifest from '../../../e2e/test-assets/ocr-forms/manifest.json';
import type { ArtifactType, DestinationMarket, ProductType } from '../types';
import {
  LIVE_LANE_CREATION_SCENARIOS,
  type LaneCreationScenario,
} from './lane-creation-scenarios';

type ManifestEntry = {
  documentLabel: string;
  artifactType: ArtifactType;
  assetPath: string;
  applicableCombos: string[];
  expectedFieldCompleteness: {
    presentFieldKeys: string[];
    missingFieldKeys: string[];
    lowConfidenceFieldKeys: string[];
    unsupportedFieldKeys: string[];
  };
  variants?: Array<{
    combo: string;
    assetPath: string;
    expectedFieldCompleteness: {
      presentFieldKeys: string[];
      missingFieldKeys: string[];
      lowConfidenceFieldKeys: string[];
      unsupportedFieldKeys: string[];
    };
  }>;
};

type BrowserReadySlot = {
  readonly combo: `${DestinationMarket}/${ProductType}`;
  readonly documentLabel: string;
  readonly artifactType:
    | 'PHYTO_CERT'
    | 'MRL_TEST'
    | 'GAP_CERT'
    | 'VHT_CERT'
    | 'INVOICE';
  readonly fixturePath: string;
  readonly uploadFileName: string;
  readonly expectedPresentFieldKeys: readonly string[];
  readonly laneScenario: LaneCreationScenario;
};

type BrowserReadyArtifactType = BrowserReadySlot['artifactType'];

const manifestDocuments = (
  ocrFixtureManifest.documents as ManifestEntry[]
).filter(
  (entry) =>
    entry.artifactType === 'PHYTO_CERT' ||
    entry.artifactType === 'MRL_TEST' ||
    entry.artifactType === 'GAP_CERT' ||
    entry.artifactType === 'VHT_CERT' ||
    entry.artifactType === 'INVOICE',
);

const LIVE_SCENARIO_BY_COMBO = new Map<
  `${DestinationMarket}/${ProductType}`,
  LaneCreationScenario
>(
  LIVE_LANE_CREATION_SCENARIOS.map((scenario) => [
    `${scenario.market}/${scenario.product}` as const,
    scenario,
  ]),
);

const REQUIRED_DOCUMENTS_BY_COMBO = new Map<
  `${DestinationMarket}/${ProductType}`,
  readonly string[]
>(
  manifestDocuments
    .reduce<Array<[`${DestinationMarket}/${ProductType}`, string[]]>>(
      (entries, document) => {
        for (const combo of document.applicableCombos) {
          const typedCombo = combo as `${DestinationMarket}/${ProductType}`;
          if (!LIVE_SCENARIO_BY_COMBO.has(typedCombo)) {
            continue;
          }

          const existing = entries.find(
            ([entryCombo]) => entryCombo === typedCombo,
          );
          if (existing) {
            existing[1].push(document.documentLabel);
          } else {
            entries.push([typedCombo, [document.documentLabel]]);
          }
        }

        return entries;
      },
      [],
    )
    .map(([combo, requiredDocuments]) => [
      combo,
      [...requiredDocuments].sort((left, right) => left.localeCompare(right)),
    ]),
);

function slugifyDocumentLabel(documentLabel: string): string {
  return documentLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function getManifestEntry(documentLabel: string): ManifestEntry {
  const entry = manifestDocuments.find(
    (document) => document.documentLabel === documentLabel,
  );
  if (!entry) {
    throw new Error(`Missing OCR fixture manifest entry for ${documentLabel}.`);
  }

  return entry;
}

export const OCR_BROWSER_READINESS_SLOTS: readonly BrowserReadySlot[] =
  Array.from(REQUIRED_DOCUMENTS_BY_COMBO.entries())
    .flatMap(([combo, requiredDocuments]) => {
      const laneScenario = LIVE_SCENARIO_BY_COMBO.get(combo);
      if (!laneScenario) {
        throw new Error(
          `Missing live lane creation scenario for combo ${combo}.`,
        );
      }

      return requiredDocuments.map((documentLabel) => {
        const manifestEntry = getManifestEntry(documentLabel);
        const variant = manifestEntry.variants?.find(
          (entry) => entry.combo === combo,
        );
        const fixturePath = variant?.assetPath ?? manifestEntry.assetPath;
        const expectedPresentFieldKeys =
          variant?.expectedFieldCompleteness.presentFieldKeys ??
          manifestEntry.expectedFieldCompleteness.presentFieldKeys;

        return {
          combo,
          documentLabel,
          artifactType: manifestEntry.artifactType as BrowserReadyArtifactType,
          fixturePath: fixturePath.replace(
            'frontend/e2e/test-assets/ocr-forms/',
            '',
          ),
          uploadFileName: `${combo.toLowerCase().replace('/', '-')}-${slugifyDocumentLabel(documentLabel)}.svg`,
          expectedPresentFieldKeys,
          laneScenario,
        } satisfies BrowserReadySlot;
      });
    })
    .sort((left, right) =>
      left.combo === right.combo
        ? left.documentLabel.localeCompare(right.documentLabel)
        : left.combo.localeCompare(right.combo),
    );

export const OCR_BROWSER_REQUIRED_SLOT_COUNT =
  OCR_BROWSER_READINESS_SLOTS.length;
