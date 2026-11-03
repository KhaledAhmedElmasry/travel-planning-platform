import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser, Roles } from '../common/decorators';
import { ContentType, Role } from '../common/enums';
import { JwtAuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import type { AuthUser } from '../common/interfaces';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import { ResolveReportDto } from './dto/resolve-report.dto';
import { ReportsService } from './reports.service';

// Area: Community & Cross-cutting
// Requirements: GEN-09, GEN-10
// Endpoints implemented:
//   POST   /api/reports                      GEN-09 (a registered user reporting content)
//   GET    /api/admin/reports                GEN-09, GEN-10 (admin listing of reports)
//   PATCH  /api/admin/reports/:id            GEN-10 (admin resolves a report)
//   DELETE /api/admin/content/:type/:id      GEN-10 (admin deletes content directly)
//   PATCH  /api/admin/content/:type/:id/hide GEN-10 (admin hides content directly)
//   PATCH  /api/admin/content/:type/:id/unhide GEN-10 (admin unhides content directly)
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

  // GEN-10: Admin resolves a report by dismissing it, hiding content, or deleting it
  @Patch('admin/reports/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async resolveReport(
    @CurrentUser() admin: AuthUser,
    @Param('id') id: string,
    @Body() dto: ResolveReportDto,
  ) {
    return await this.reportsService.resolveReport(admin, id, dto);
  }

  // GEN-10: Admin deletes a post, comment, review or itinerary directly
  @Delete('admin/content/:type/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteContent(
    @CurrentUser() admin: AuthUser,
    @Param('type') type: ContentType,
    @Param('id') id: string,
  ) {
    return await this.reportsService.deleteContentDirect(admin, type, id);
  }

  // GEN-10: Admin hides content directly
  @Patch('admin/content/:type/:id/hide')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async hideContent(
    @CurrentUser() admin: AuthUser,
    @Param('type') type: ContentType,
    @Param('id') id: string,
    @Body() body?: { reason?: string },
  ) {
    return await this.reportsService.hideContentDirect(
      admin,
      type,
      id,
      true,
      body?.reason,
    );
  }

  // GEN-10: Admin unhides content directly
  @Patch('admin/content/:type/:id/unhide')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.Admin)
  async unhideContent(
    @CurrentUser() admin: AuthUser,
    @Param('type') type: ContentType,
    @Param('id') id: string,
  ) {
    return await this.reportsService.hideContentDirect(admin, type, id, false);
  }
}
