import { Injectable } from '@nestjs/common';
import { RulesEngineService } from '../rules-engine/rules-engine.service';
import type {
  LaneMarket,
  LaneProduct,
  LaneRuleSnapshotPayload,
  LaneRuleSnapshotResolver,
} from './lane.types';

@Injectable()
export class RulesEngineLaneRuleSnapshotResolver implements LaneRuleSnapshotResolver {
  constructor(private readonly rulesEngineService: RulesEngineService) {}

  async resolve(
    market: LaneMarket,
    product: LaneProduct,
  ): Promise<LaneRuleSnapshotPayload | null> {
    const snapshot = await this.rulesEngineService.getRuleSnapshot(
      market,
      product,
    );

    if (snapshot === null) {
      return null;
    }

    return snapshot;
  }
}
