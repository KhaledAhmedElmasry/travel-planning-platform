import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import { AuditService } from '../audit/audit.service';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  paginate,
  PaginatedList,
} from '../common/dto/pagination.dto';
import { AuditAction, ContentType, ReportStatus } from '../common/enums';
import type { AuthUser } from '../common/interfaces';
import { NotificationsService } from '../notifications/notifications.service';
import { removeRatingPipeline } from '../reviews/reviews.service';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import {
  ReportResolutionAction,
  ResolveReportDto,
} from './dto/resolve-report.dto';
import { Report, ReportDocument } from './schemas/report.schema';

export interface ReportReporter {
  id: string;
  name: string;
  email: string;
}

export interface ReportItem {
  id: string;
  contentType: ContentType;
  contentId: string;
  contentPreview?: string;
  content?: {
    type: ContentType;
    id: string;
    preview?: string;
  };
  reporter: ReportReporter;
  reason: string;
  status: ReportStatus;
  createdAt: Date;
  date: Date;
}

export type LeanReport = Report & { _id: Types.ObjectId };

// Area: Community & Cross-cutting
// Business logic and database access for: GEN-09, GEN-10
@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
    private readonly auditService: AuditService,
    private readonly notificationsService: NotificationsService,
  ) {}

  private getCollectionName(contentType: ContentType): string {
    switch (contentType) {
      case ContentType.Post:
        return 'posts';
      case ContentType.Comment:
        return 'comments';
      case ContentType.Review:
        return 'reviews';
      case ContentType.Itinerary:
        return 'itineraries';
      default:
        return 'items';
    }
  }

  // Check if content is visible to the reporting user; content the user cannot see is treated as 404
  private isContentVisibleToUser(
    doc: Record<string, unknown>,
    contentType: ContentType,
    userId: string,
  ): boolean {
    // Deleted content is never visible
    if (
      doc.deleted === true ||
      doc.isDeleted === true ||
      doc.deletedAt != null
    ) {
      return false;
    }

    const authorId = this.extractAuthorId(doc);
    const isAuthor = authorId === userId;

    // GEN-10: Hidden content is visible only to its author (and admins)
    if ((doc.hidden === true || doc.isHidden === true) && !isAuthor) {
      return false;
    }

    // Itineraries: private itineraries are visible only to their author
    if (contentType === ContentType.Itinerary) {
      const isPrivate =
        doc.visibility === 'private' ||
        (doc.visibility !== undefined && doc.visibility !== 'public');
      if (isPrivate && !isAuthor) {
        return false;
      }
    }

    // Posts: drafts are visible only to their author
    if (contentType === ContentType.Post) {
      const isDraft =
        doc.status === 'draft' ||
        doc.isDraft === true ||
        doc.draft === true ||
        doc.published === false ||
        doc.state === 'draft';
      if (isDraft && !isAuthor) {
        return false;
      }
    }

    return true;
  }

  // GEN-10 + HTL-23: delete one content document. When it is a review, the
  // hotel's averageRating / ratingCount are updated in the same transaction
  // (the same pipeline the author's own delete uses), so an admin delete can
  // never leave the rating out of date. Only the delete that really removed
  // the document changes the rating, so a repeated delete changes nothing.
  private async deleteContentDocument(
    type: ContentType,
    id: Types.ObjectId,
    doc: unknown,
  ): Promise<void> {
    const db = this.connection.db;
    if (!db) return;
    await this.connection.transaction(async (session) => {
      const result = await db
        .collection(this.getCollectionName(type))
        .deleteOne({ _id: id }, { session });
      if (type !== ContentType.Review || result.deletedCount !== 1) return;
      const review = doc as { hotel?: Types.ObjectId; rating?: number } | null;
      if (!review?.hotel || typeof review.rating !== 'number') return;
      await db
        .collection('hotels')
        .updateOne({ _id: review.hotel }, removeRatingPipeline(review.rating), {
          session,
        });
    });
  }

  private extractAuthorId(doc: unknown): string | undefined {
    if (!doc || typeof doc !== 'object') return undefined;
    const d = doc as Record<string, unknown>;
    const id =
      (d.userId as Types.ObjectId | string | undefined)?.toString?.() ??
      (d.user as Types.ObjectId | string | undefined)?.toString?.() ??
      (d.authorId as Types.ObjectId | string | undefined)?.toString?.() ??
      (d.author as Types.ObjectId | string | undefined)?.toString?.() ??
      (typeof d.author === 'object' && d.author !== null
        ? ((d.author as Record<string, unknown>).id?.toString?.() ??
          (d.author as Record<string, unknown>)._id?.toString?.())
        : undefined);
    return id ? String(id) : undefined;
  }

  // GEN-09: A registered user reports a post, comment, review or itinerary
  async createReport(
    user: AuthUser,
    dto: CreateReportDto,
  ): Promise<ReportItem> {
    const trimmedReason =
      typeof dto.reason === 'string' ? dto.reason.trim() : '';
    if (!trimmedReason) {
      throw new BadRequestException('reason is required');
    }

    const contentObjectId = new Types.ObjectId(dto.contentId);
    const collectionName = this.getCollectionName(dto.contentType);

    // Verify target content exists in MongoDB and is visible to the reporting user
    const contentDoc = await this.connection.db
      ?.collection(collectionName)
      .findOne({ _id: contentObjectId });

    if (
      !contentDoc ||
      !this.isContentVisibleToUser(contentDoc, dto.contentType, user.id)
    ) {
      throw new NotFoundException(`${dto.contentType} not found`);
    }

    // Extract a short preview of the content for admin preview
    let contentPreview: string | undefined;
    const doc = contentDoc as Record<string, unknown>;
    if (typeof doc.title === 'string' && doc.title.trim()) {
      contentPreview = doc.title.trim();
    } else if (typeof doc.content === 'string' && doc.content.trim()) {
      contentPreview =
        doc.content.trim().length > 120
          ? `${doc.content.trim().slice(0, 117)}...`
          : doc.content.trim();
    } else if (typeof doc.text === 'string' && doc.text.trim()) {
      contentPreview =
        doc.text.trim().length > 120
          ? `${doc.text.trim().slice(0, 117)}...`
          : doc.text.trim();
    } else if (typeof doc.name === 'string' && doc.name.trim()) {
      contentPreview = doc.name.trim();
    } else if (typeof doc.description === 'string' && doc.description.trim()) {
      contentPreview =
        doc.description.trim().length > 120
          ? `${doc.description.trim().slice(0, 117)}...`
          : doc.description.trim();
    }

    const reporterObjectId = new Types.ObjectId(user.id);

    // Check if user has already reported this content item (at most once per item)
    const existing = await this.reportModel.findOne({
      reporterId: reporterObjectId,
      contentType: dto.contentType,
      contentId: contentObjectId,
    });

    if (existing) {
      throw new ConflictException('You have already reported this item');
    }

    // Get reporter user information
    const reporterUser = await this.userModel
      .findById(reporterObjectId)
      .select('name email')
      .lean()
      .exec();

    const report = new this.reportModel({
      reporterId: reporterObjectId,
      reporterName: reporterUser?.name ?? 'User',
      reporterEmail: reporterUser?.email ?? '',
      contentType: dto.contentType,
      contentId: contentObjectId,
      contentPreview,
      reason: trimmedReason,
      status: ReportStatus.Open,
    });

    try {
      await report.save();
    } catch (err: unknown) {
      if ((err as { code?: number })?.code === 11000) {
        throw new ConflictException('You have already reported this item');
      }
      throw err;
    }

    return this.mapReportItem(report);
  }

  // GEN-09, GEN-10: List reports with pagination and filtering
  async listReports(
    query: ListReportsQueryDto,
  ): Promise<PaginatedList<ReportItem>> {
    const filter: FilterQuery<ReportDocument> = {};

    // Defaults to 'open' reports unless another status is requested
    filter.status = query.status ?? ReportStatus.Open;

    if (query.contentType) {
      filter.contentType = query.contentType;
    }

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);

    const [reports, total] = await Promise.all([
      this.reportModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<LeanReport[]>()
        .exec(),
      this.reportModel.countDocuments(filter).exec(),
    ]);

    const items = reports.map((r) => this.mapReportItem(r));
    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }

  // GEN-10: Admin resolves a report (dismiss, hide, or delete)
  async resolveReport(
    admin: AuthUser,
    id: Types.ObjectId | string,
    dto: ResolveReportDto,
  ): Promise<ReportItem> {
    const reportObjectId = typeof id === 'string' ? new Types.ObjectId(id) : id;

    let targetStatus: ReportStatus;
    if (dto.action === ReportResolutionAction.Dismiss) {
      targetStatus = ReportStatus.Dismissed;
    } else if (dto.action === ReportResolutionAction.Hide) {
      targetStatus = ReportStatus.ContentHidden;
    } else {
      targetStatus = ReportStatus.ContentDeleted;
    }

    const adminObjectId = new Types.ObjectId(admin.id);
    const resolutionNote = dto.note?.trim() ?? undefined;

    // Atomic conditional update: only the request that updates an open report succeeds
    const updatedReport = await this.reportModel
      .findOneAndUpdate(
        { _id: reportObjectId, status: ReportStatus.Open },
        {
          $set: {
            status: targetStatus,
            resolvedBy: adminObjectId,
            resolvedAt: new Date(),
            resolutionNote,
          },
        },
        { new: true },
      )
      .exec();

    if (!updatedReport) {
      const existing = await this.reportModel.findById(reportObjectId).exec();
      if (!existing) {
        throw new NotFoundException('Report not found.');
      }
      throw new ConflictException('The report is already resolved.');
    }

    const collectionName = this.getCollectionName(updatedReport.contentType);
    const contentId = updatedReport.contentId;
    const reportIdStr = updatedReport._id.toString();

    // Look up target content to extract authorId for notification
    const contentDoc = await this.connection.db
      ?.collection(collectionName)
      .findOne({ _id: contentId });
    const authorId = this.extractAuthorId(contentDoc);

    if (dto.action === ReportResolutionAction.Dismiss) {
      // Write to audit log (GEN-07)
      await this.auditService.record({
        adminId: admin.id,
        action: AuditAction.DismissReport,
        targetType: updatedReport.contentType,
        targetId: contentId.toString(),
        details: {
          reportId: reportIdStr,
          note: resolutionNote,
        },
      });

      return this.mapReportItem(updatedReport);
    }

    if (dto.action === ReportResolutionAction.Hide) {
      // Hide content in its collection
      await this.connection.db?.collection(collectionName).updateOne(
        { _id: contentId },
        {
          $set: {
            hidden: true,
            hiddenAt: new Date(),
            hiddenBy: adminObjectId,
          },
        },
      );

      // Cascade resolution: resolve any other open reports about this content item
      await this.reportModel.updateMany(
        {
          contentType: updatedReport.contentType,
          contentId,
          status: ReportStatus.Open,
          _id: { $ne: updatedReport._id },
        },
        {
          $set: {
            status: ReportStatus.ContentHidden,
            resolvedBy: adminObjectId,
            resolvedAt: new Date(),
            resolutionNote: resolutionNote
              ? `Resolved with report ${reportIdStr}: ${resolutionNote}`
              : `Resolved with report ${reportIdStr}`,
          },
        },
      );

      // Write to audit log (GEN-07)
      await this.auditService.record({
        adminId: admin.id,
        action: AuditAction.HideContent,
        targetType: updatedReport.contentType,
        targetId: contentId.toString(),
        details: {
          reportId: reportIdStr,
          note: resolutionNote,
        },
      });

      // Send in-app notification to the content author (GEN-01)
      if (authorId) {
        await this.notificationsService.notify(
          authorId,
          'Content Hidden',
          `Your ${updatedReport.contentType} has been hidden by an administrator${
            resolutionNote
              ? `: ${resolutionNote}`
              : ' for violating community guidelines.'
          }`,
          'moderation',
        );
      }

      return this.mapReportItem(updatedReport);
    }

    if (dto.action === ReportResolutionAction.Delete) {
      // Delete content from its collection (a review also leaves the hotel's
      // average rating, HTL-23)
      await this.deleteContentDocument(
        updatedReport.contentType,
        contentId,
        contentDoc,
      );

      // Cascade resolution: resolve any other open reports about this content item
      await this.reportModel.updateMany(
        {
          contentType: updatedReport.contentType,
          contentId,
          status: ReportStatus.Open,
          _id: { $ne: updatedReport._id },
        },
        {
          $set: {
            status: ReportStatus.ContentDeleted,
            resolvedBy: adminObjectId,
            resolvedAt: new Date(),
            resolutionNote: resolutionNote
              ? `Resolved with report ${reportIdStr}: ${resolutionNote}`
              : `Resolved with report ${reportIdStr}`,
          },
        },
      );

      // Write to audit log (GEN-07)
      await this.auditService.record({
        adminId: admin.id,
        action: AuditAction.DeleteContent,
        targetType: updatedReport.contentType,
        targetId: contentId.toString(),
        details: {
          reportId: reportIdStr,
          note: resolutionNote,
        },
      });

      // Send in-app notification to the content author (GEN-01)
      if (authorId) {
        await this.notificationsService.notify(
          authorId,
          'Content Deleted',
          `Your ${updatedReport.contentType} has been deleted by an administrator${
            resolutionNote
              ? `: ${resolutionNote}`
              : ' for violating community guidelines.'
          }`,
          'moderation',
        );
      }

      return this.mapReportItem(updatedReport);
    }

    return this.mapReportItem(updatedReport);
  }

  // GEN-10: Admin deletes a post, comment, review or itinerary directly
  async deleteContentDirect(
    admin: AuthUser,
    type: ContentType,
    id: Types.ObjectId | string,
  ): Promise<void> {
    const contentObjectId =
      typeof id === 'string' ? new Types.ObjectId(id) : id;
    const collectionName = this.getCollectionName(type);

    const doc = await this.connection.db
      ?.collection(collectionName)
      .findOne({ _id: contentObjectId });

    if (!doc || (doc as Record<string, unknown>).deleted === true) {
      throw new NotFoundException('Content not found.');
    }

    // Delete in MongoDB (a review also leaves the hotel's average rating, HTL-23)
    await this.deleteContentDocument(type, contentObjectId, doc);

    const adminObjectId = new Types.ObjectId(admin.id);

    // Resolve any open reports as content_deleted
    await this.reportModel.updateMany(
      {
        contentType: type,
        contentId: contentObjectId,
        status: ReportStatus.Open,
      },
      {
        $set: {
          status: ReportStatus.ContentDeleted,
          resolvedBy: adminObjectId,
          resolvedAt: new Date(),
          resolutionNote: 'Content deleted directly by administrator',
        },
      },
    );

    // Write to audit log (GEN-07)
    await this.auditService.record({
      adminId: admin.id,
      action: AuditAction.DeleteContent,
      targetType: type,
      targetId: contentObjectId.toString(),
    });

    // Send in-app notification to author (GEN-01)
    const authorId = this.extractAuthorId(doc);
    if (authorId) {
      await this.notificationsService.notify(
        authorId,
        'Content Deleted',
        `Your ${type} has been deleted by an administrator.`,
        'moderation',
      );
    }
  }

  // GEN-10: Admin hides or unhides content directly
  async hideContentDirect(
    admin: AuthUser,
    type: ContentType,
    id: Types.ObjectId | string,
    hidden = true,
    reason?: string,
  ): Promise<{
    id: string;
    type: ContentType;
    hidden: boolean;
    message: string;
  }> {
    const contentObjectId =
      typeof id === 'string' ? new Types.ObjectId(id) : id;
    const collectionName = this.getCollectionName(type);

    const doc = await this.connection.db
      ?.collection(collectionName)
      .findOne({ _id: contentObjectId });

    if (!doc || (doc as Record<string, unknown>).deleted === true) {
      throw new NotFoundException('Content not found.');
    }

    const adminObjectId = new Types.ObjectId(admin.id);

    await this.connection.db?.collection(collectionName).updateOne(
      { _id: contentObjectId },
      {
        $set: {
          hidden,
          hiddenAt: hidden ? new Date() : null,
          hiddenBy: hidden ? adminObjectId : null,
        },
      },
    );

    if (hidden) {
      // Resolve open reports as content_hidden
      await this.reportModel.updateMany(
        {
          contentType: type,
          contentId: contentObjectId,
          status: ReportStatus.Open,
        },
        {
          $set: {
            status: ReportStatus.ContentHidden,
            resolvedBy: adminObjectId,
            resolvedAt: new Date(),
            resolutionNote: reason
              ? `Content hidden directly by administrator: ${reason}`
              : 'Content hidden directly by administrator',
          },
        },
      );

      // Write to audit log (GEN-07)
      await this.auditService.record({
        adminId: admin.id,
        action: AuditAction.HideContent,
        targetType: type,
        targetId: contentObjectId.toString(),
        details: reason ? { reason } : undefined,
      });

      // Send in-app notification to author (GEN-01)
      const authorId = this.extractAuthorId(doc);
      if (authorId) {
        await this.notificationsService.notify(
          authorId,
          'Content Hidden',
          `Your ${type} has been hidden by an administrator${reason ? `: ${reason}` : '.'}`,
          'moderation',
        );
      }
    }

    return {
      id: contentObjectId.toString(),
      type,
      hidden,
      message: hidden
        ? `${type} hidden successfully.`
        : `${type} unhidden successfully.`,
    };
  }

  private mapReportItem(
    report: ReportDocument | LeanReport | (Report & { _id: Types.ObjectId }),
  ): ReportItem {
    const id = (report as { _id: Types.ObjectId })._id.toString();
    const contentIdStr = report.contentId.toString();
    const createdAt = report.createdAt ?? new Date();

    return {
      id,
      contentType: report.contentType,
      contentId: contentIdStr,
      contentPreview: report.contentPreview ?? undefined,
      content: {
        type: report.contentType,
        id: contentIdStr,
        preview: report.contentPreview ?? undefined,
      },
      reporter: {
        id: report.reporterId.toString(),
        name: report.reporterName,
        email: report.reporterEmail,
      },
      reason: report.reason,
      status: report.status,
      createdAt,
      date: createdAt,
    };
  }
}
