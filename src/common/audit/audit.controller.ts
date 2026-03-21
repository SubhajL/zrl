import { Controller, Get, Param, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { Audited } from './audit.decorator';
import { AuditService } from './audit.service';
import {
  AuditAction,
  AuditEntityType,
  isAuditAction,
  type AuditEntryFilters,
} from './audit.types';

@Controller()
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('lanes/:id/audit')
  async getLaneAudit(
    @Param('id') laneId: string,
    @Query() query: Record<string, string | undefined>,
  ) {
    const filters = this.parseFilters(query);
    const entries = await this.auditService.getEntriesForLane(laneId, filters);

    return { entries };
  }

  @Post('lanes/:id/audit/verify')
  @Audited(AuditAction.VERIFY, AuditEntityType.LANE)
  async verifyLaneAudit(@Param('id') laneId: string) {
    return await this.auditService.verifyChainForLane(laneId);
  }

  @Get('audit/export/:laneId')
  async exportLaneAudit(
    @Param('laneId') laneId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    response.setHeader('Content-Type', 'application/json; charset=utf-8');
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-${laneId}.json"`,
    );

    return await this.auditService.exportForLane(laneId);
  }

  private parseFilters(
    query: Record<string, string | undefined>,
  ): AuditEntryFilters {
    const filters: AuditEntryFilters = {};

    if (query['action'] !== undefined && isAuditAction(query['action'])) {
      filters.action = query['action'];
    }

    if (query['actor'] !== undefined && query['actor'].length > 0) {
      filters.actor = query['actor'];
    }

    const from = this.parseDate(query['from']);
    if (from !== undefined) {
      filters.from = from;
    }

    const to = this.parseDate(query['to']);
    if (to !== undefined) {
      filters.to = to;
    }

    const page = this.parsePositiveInteger(query['page']);
    if (page !== undefined) {
      filters.page = page;
    }

    const pageSize = this.parsePositiveInteger(query['pageSize']);
    if (pageSize !== undefined) {
      filters.pageSize = pageSize;
    }

    return filters;
  }

  private parseDate(value: string | undefined): Date | undefined {
    if (value === undefined || value.length === 0) {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }

  private parsePositiveInteger(value: string | undefined): number | undefined {
    if (value === undefined || value.length === 0) {
      return undefined;
    }

    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) || parsed <= 0 ? undefined : parsed;
  }
}
