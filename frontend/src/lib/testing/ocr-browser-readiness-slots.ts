import type { DestinationMarket, ProductType } from '../types';
import {
  LIVE_LANE_CREATION_SCENARIOS,
  type LaneCreationScenario,
} from './lane-creation-scenarios';
import {
  DOCUMENT_CATALOG_BROWSER_REQUIRED_SLOTS,
  DOCUMENT_CATALOG_BROWSER_REQUIRED_SLOT_COUNT,
} from '../../../../src/modules/evidence/document-catalog.browser';

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

const LIVE_SCENARIO_BY_COMBO = new Map<
  `${DestinationMarket}/${ProductType}`,
  LaneCreationScenario
>(
  LIVE_LANE_CREATION_SCENARIOS.map((scenario) => [
    `${scenario.market}/${scenario.product}` as const,
    scenario,
  ]),
);

export const OCR_BROWSER_READINESS_SLOTS: readonly BrowserReadySlot[] =
  DOCUMENT_CATALOG_BROWSER_REQUIRED_SLOTS.flatMap((slot) => {
      const laneScenario = LIVE_SCENARIO_BY_COMBO.get(slot.combo);
      if (!laneScenario) {
        throw new Error(
          `Missing live lane creation scenario for combo ${slot.combo}.`,
        );
      }

      return [
        {
          combo: slot.combo,
          documentLabel: slot.documentLabel,
          artifactType: slot.artifactType as BrowserReadyArtifactType,
          fixturePath: slot.fixturePath,
          uploadFileName: slot.uploadFileName,
          expectedPresentFieldKeys: slot.expectedPresentFieldKeys,
          laneScenario,
        } satisfies BrowserReadySlot,
      ];
    })
    .sort((left, right) =>
      left.combo === right.combo
        ? left.documentLabel.localeCompare(right.documentLabel)
        : left.combo.localeCompare(right.combo),
    );

export const OCR_BROWSER_REQUIRED_SLOT_COUNT =
  DOCUMENT_CATALOG_BROWSER_REQUIRED_SLOT_COUNT;
