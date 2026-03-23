import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthPrincipalRequest } from '../../common/auth/auth.types';
import { JwtAuthGuard, RolesGuard } from '../../common/auth/auth.guards';
import { Roles } from '../../common/auth/auth.decorators';
import { RulesEngineService } from './rules-engine.service';

interface SubstanceBody {
  name: string;
  cas: string;
  thaiMrl: number;
  destinationMrl: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function parseSubstanceBody(body: unknown): SubstanceBody {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new BadRequestException('Invalid substance payload.');
  }

  const record = body as Record<string, unknown>;
  const name = record['name'];
  const cas = record['cas'];
  const thaiMrl = record['thaiMrl'];
  const destinationMrl = record['destinationMrl'];

  if (typeof name !== 'string' || name.trim().length === 0) {
    throw new BadRequestException('Substance name is required.');
  }

  if (typeof cas !== 'string' || cas.trim().length === 0) {
    throw new BadRequestException('CAS number is required.');
  }

  if (!isFiniteNumber(thaiMrl) || !isFiniteNumber(destinationMrl)) {
    throw new BadRequestException('MRL values must be numeric.');
  }

  return {
    name: name.trim(),
    cas: cas.trim(),
    thaiMrl,
    destinationMrl,
  };
}

@Controller('rules')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RulesEngineController {
  constructor(private readonly rulesEngineService: RulesEngineService) {}

  @Get('markets')
  async listMarkets() {
    return await this.rulesEngineService.listMarkets();
  }

  @Post('reload')
  @Roles('ADMIN')
  async reloadRules() {
    const result = await this.rulesEngineService.reloadRules();
    return { loaded: result.loaded };
  }

  @Get('markets/:market/checklist')
  async getChecklist(
    @Param('market') market: string,
    @Query('product') product: string | undefined,
  ) {
    if (typeof product !== 'string' || product.trim().length === 0) {
      throw new BadRequestException('product query parameter is required.');
    }

    return await this.rulesEngineService.getChecklist(market, product);
  }

  @Get('markets/:market/products/:product/ruleset')
  async getRuleSet(
    @Param('market') market: string,
    @Param('product') product: string,
  ) {
    const snapshot = await this.rulesEngineService.getRuleSnapshot(
      market,
      product,
    );

    if (snapshot === null) {
      throw new BadRequestException('Rule definition not found.');
    }

    return snapshot;
  }

  @Get('markets/:market/substances')
  async listSubstances(@Param('market') market: string) {
    return await this.rulesEngineService.listSubstances(market);
  }

  @Post('markets/:market/substances')
  @Roles('ADMIN')
  async createSubstance(
    @Param('market') market: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    return await this.rulesEngineService.createSubstance(
      market,
      parseSubstanceBody(body),
      request.user!.id,
    );
  }

  @Patch('substances/:id')
  @Roles('ADMIN')
  async updateSubstance(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() request: AuthPrincipalRequest,
  ) {
    const parsed = parseSubstanceBody(body);
    return await this.rulesEngineService.updateSubstance(
      id,
      parsed,
      request.user!.id,
    );
  }

  @Get('versions')
  async listVersions() {
    return await this.rulesEngineService.listRuleVersions();
  }
}
