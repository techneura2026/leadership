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
import { ReportType } from '@leaderprism/shared';
import { ReportingService } from './reporting.service';

@ApiTags('Reports')
@UseGuards(AuthGuard('jwt'))
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
    return this.reportingService.generateReport(
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

    if (filePath.startsWith('http')) {
      // Production: redirect to signed blob URL
      res.redirect(filePath);
    } else {
      // Local dev: send file
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
