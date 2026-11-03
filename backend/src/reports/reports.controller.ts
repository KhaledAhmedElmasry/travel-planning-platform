import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../common/decorators';
import { Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ReportsService } from './reports.service';

// Area: Community & Cross-cutting
// Requirements: GEN-09, GEN-10
// Endpoints implemented:
//   POST   /api/reports        GEN-09 (a registered user reporting content)
//   GET    /api/admin/reports  GEN-09, GEN-10 (admin listing of reports)
@Controller()
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  // GEN-09: A registered user reports a post, comment, review or itinerary
  @Post('reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.User)
  @HttpCode(HttpStatus.CREATED)
  async createReport(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReportDto,
  ) {
    return await this.reportsService.createReport(user, dto);
  }

  // GEN-09, GEN-10: Admin view of reported content (default: open reports)
  @Get('admin/reports')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async listReports(@Query() query: ListReportsQueryDto) {
    return await this.reportsService.listReports(query);
  }
}
