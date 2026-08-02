import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { Response } from 'express';
import * as fs from 'fs';
import { ReportType, UserRole } from '@leaderprism/shared';
import { ReportingService } from './reporting.service';
import { RolesGuard } from '../core/auth/guards/roles.guard';
import { Roles } from '../shared/decorators/roles.decorator';

@ApiTags('Reports')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER)
@Controller('reports')
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}

  @Post('generate')
  @ApiOperation({ summary: 'Trigger PDF report generation' })
  generate(
    @Request() req: any,
    @Body()
    body: {
      assessmentId: string;
      participantId?: string;
      reportType: ReportType;
      language?: string;
    },
  ) {
    return this.reportingService.requestReport(
      req.user.orgId,
      body.assessmentId,
      body.participantId ?? null,
      body.reportType,
      body.language ?? 'en',
      req.user.sub,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List reports for the organisation' })
  listReports(@Request() req: any, @Query('assessmentId') assessmentId?: string) {
    return this.reportingService.listReports(req.user.orgId, assessmentId);
  }

  // ── Participant self-service (registered before :id so "mine" isn't captured as an id) ──

  @Get('mine')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.PARTICIPANT)
  @ApiOperation({ summary: 'List reports where the current user is the subject' })
  listMyReports(@Request() req: any) {
    return this.reportingService.listMyReports(req.user.orgId, req.user.sub);
  }

  @Get('mine/:id/download')
  @Roles(UserRole.ORG_ADMIN, UserRole.HR_MANAGER, UserRole.MANAGER, UserRole.PARTICIPANT)
  @ApiOperation({ summary: 'Download own report PDF (only if the current user is its subject)' })
  async downloadMine(@Request() req: any, @Param('id') id: string, @Res() res: Response) {
    const filePath = await this.reportingService.getMyDownloadPath(id, req.user.orgId, req.user.sub);
    this.sendReportFile(filePath, id, res);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get report metadata' })
  getReport(@Request() req: any, @Param('id') id: string) {
    return this.reportingService.getReport(id, req.user.orgId);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Download the PDF file (local dev: serves file directly)' })
  async download(
    @Request() req: any,
    @Param('id') id: string,
    @Res() res: Response,
  ) {
    const filePath = await this.reportingService.getDownloadPath(id, req.user.orgId);
    this.sendReportFile(filePath, id, res);
  }

  private sendReportFile(filePath: string, id: string, res: Response): void {
    if (filePath.startsWith('http')) {
      // Blob storage configured: redirect to the signed/blob URL
      res.redirect(filePath);
    } else {
      // Local disk fallback (no Blob Storage configured — see Tier 2B)
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ message: 'Report file not found on disk' });
        return;
      }
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="report-${id}.pdf"`);
      res.sendFile(filePath);
    }
  }
}
