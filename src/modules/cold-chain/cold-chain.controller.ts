import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { ColdChainService } from './cold-chain.service';
import type { LaneProduct } from '../lane/lane.types';

function parseProduct(value: string): LaneProduct {
  const normalized = value.trim().toUpperCase();
  if (!['MANGO', 'DURIAN', 'MANGOSTEEN', 'LONGAN'].includes(normalized)) {
    throw new BadRequestException('Unsupported product.');
  }

  return normalized as LaneProduct;
}

@Controller('cold-chain')
export class ColdChainController {
  constructor(private readonly coldChainService: ColdChainService) {}

  @Get('profiles')
  async listProfiles() {
    return {
      profiles: await this.coldChainService.listProfiles(),
    };
  }

  @Get('profiles/:product')
  async getProfile(@Param('product') product: string) {
    return {
      profile: await this.coldChainService.getProfile(parseProduct(product)),
    };
  }
}
