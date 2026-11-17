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
import { UploadsService } from '../uploads/uploads.service';
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
    private readonly uploadsService: UploadsService,
  ) {}

  // The collection of each kind of content (the Mongoose models of the blog, reviews and
  // itineraries modules).
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
    }
  }

  // GEN-09: content the reporting user cannot see is treated as 404: hidden content of another
  // user (GEN-10), a draft post of another user (BLG-01) and a private itinerary of another user
  // (ITN-20).
  private isContentVisibleToUser(
    doc: Record<string, unknown>,
    contentType: ContentType,
    userId: string,
  ): boolean {
    if (this.extractAuthorId(contentType, doc) === userId) return true;
    if (doc.hidden === true) return false;
    if (contentType === ContentType.Post && doc.status !== 'published') {
      return false;
    }
    if (contentType === ContentType.Itinerary && doc.visibility !== 'public') {
      return false;
    }
    return true;
  }

  // GEN-10: delete one content document and everything that depends on it, in one transaction:
  //   - comment: the post's comment count goes down by one (BLG-03, BLG-09);
  //   - post: its comments and likes are deleted (as when the author deletes it, BLG-04);
  //   - itinerary: its booking links (ITN-27) are deleted and posts no longer point to it (BLG-13);
  //   - review: the hotel's average rating and rating count are recalculated (HTL-23).
  // Only a delete that really removed the document changes anything, so repeating it is safe.
  // The image files of a post or an itinerary are removed after the commit (GEN-08).
  private async deleteContentDocument(
    type: ContentType,
    id: Types.ObjectId,
    doc: Record<string, unknown>,
  ): Promise<void> {
    const db = this.connection.db;
    if (!db) return;
    let removed = false;
    await this.connection.transaction(async (session) => {
      const deleted = await db
        .collection(this.getCollectionName(type))
        .findOneAndDelete({ _id: id }, { session });
      removed = deleted !== null;
      if (!deleted) return;
      switch (type) {
        case ContentType.Comment:
          // A hidden comment was already taken off the count when it was hidden.
          if (deleted.hidden === true) break;
          await db.collection('posts').updateOne(
            {
              _id: deleted.post as Types.ObjectId,
              commentCount: { $gt: 0 },
            },
            { $inc: { commentCount: -1 } },
            { session },
          );
          break;
        case ContentType.Post:
          await db.collection('comments').deleteMany({ post: id }, { session });
          await db.collection('likes').deleteMany({ post: id }, { session });
          break;
        case ContentType.Itinerary:
          await db
            .collection('itinerary_booking_links')
            .deleteMany({ itineraryId: id }, { session });
          await db
            .collection('posts')
            .updateMany(
              { itinerary: id },
              { $set: { itinerary: null } },
              { session },
            );
          break;
        case ContentType.Review: {
          const { hotel, rating } = doc as {
            hotel?: Types.ObjectId;
            rating?: number;
          };
          if (hotel && typeof rating === 'number') {
            await db
              .collection('hotels')
              .updateOne({ _id: hotel }, removeRatingPipeline(rating), {
                session,
              });
          }
          break;
        }
      }
    });
    if (removed) await this.removeImageFiles(type, doc);
  }

  // The uploaded files of a deleted post (BLG-10) or itinerary (ITN-12).
  private async removeImageFiles(
    type: ContentType,
    doc: Record<string, unknown>,
  ): Promise<void> {
    type Image = { storageKey?: string };
    let images: Image[] = [];
    if (type === ContentType.Post) {
      images = (doc.images as Image[] | undefined) ?? [];
    } else if (type === ContentType.Itinerary) {
      const days =
        (doc.days as { activities?: { images?: Image[] }[] }[] | undefined) ??
        [];
      images = days.flatMap((day) =>
        (day.activities ?? []).flatMap((activity) => activity.images ?? []),
      );
    }
    const keys = images
      .map((image) => image.storageKey)
      .filter((key): key is string => typeof key === 'string');
    if (keys.length === 0) return;
    try {
      await this.uploadsService.removeImages(keys);
    } catch (error) {
      this.logger.error(
        `Could not remove the image files of deleted ${type} ${String(doc._id)}: ${String(error)}`,
      );
    }
  }

  // The account that wrote the content: posts and comments have `author`, reviews `user` and
  // itineraries `userId`.
  private extractAuthorId(
    type: ContentType,
    doc: Record<string, unknown>,
  ): string | undefined {
    const field = (
      type === ContentType.Review
        ? doc.user
        : type === ContentType.Itinerary
          ? doc.userId
          : doc.author
    ) as Types.ObjectId | undefined;
    return field ? field.toString() : undefined;
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
    // Posts and itineraries have a title, comments and reviews a text.
    let contentPreview: string | undefined;
    const doc = contentDoc as Record<string, unknown>;
    const previewText =
      typeof doc.title === 'string'
        ? doc.title.trim()
        : typeof doc.text === 'string'
          ? doc.text.trim()
          : '';
    if (previewText) {
      contentPreview =
        previewText.length > 120
          ? `${previewText.slice(0, 117)}...`
          : previewText;
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
    const authorId = contentDoc
      ? this.extractAuthorId(updatedReport.contentType, contentDoc)
      : undefined;

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
      await this.setHidden(
        updatedReport.contentType,
        contentId,
        true,
        adminObjectId,
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
      if (contentDoc) {
        await this.deleteContentDocument(
          updatedReport.contentType,
          contentId,
          contentDoc,
        );
      }

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

    if (!doc) {
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
    const authorId = this.extractAuthorId(type, doc);
    if (authorId) {
      await this.notificationsService.notify(
        authorId,
        'Content Deleted',
        `Your ${type} has been deleted by an administrator.`,
        'moderation',
      );
    }
  }

  // GEN-10, BLG-03, BLG-09: hides or unhides one item. A post's commentCount counts only the
  // comments readers can see (it is shown in the lists and orders the blog search), so hiding a
  // comment takes it off its post's count and unhiding puts it back, in the same transaction. Only
  // a real change of state does that, so hiding twice (or two admins at once) counts once.
  private async setHidden(
    type: ContentType,
    id: Types.ObjectId,
    hidden: boolean,
    adminObjectId: Types.ObjectId,
  ): Promise<void> {
    const db = this.connection.db;
    if (!db) return;
    await this.connection.transaction(async (session) => {
      const changed = await db
        .collection(this.getCollectionName(type))
        .findOneAndUpdate(
          { _id: id, hidden: hidden ? { $ne: true } : true },
          {
            $set: {
              hidden,
              hiddenAt: hidden ? new Date() : null,
              hiddenBy: hidden ? adminObjectId : null,
            },
          },
          { session },
        );
      if (changed && type === ContentType.Comment) {
        await db.collection('posts').updateOne(
          hidden
            ? {
                _id: changed.post as Types.ObjectId,
                commentCount: { $gt: 0 },
              }
            : { _id: changed.post as Types.ObjectId },
          { $inc: { commentCount: hidden ? -1 : 1 } },
          { session },
        );
      }
    });
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

    if (!doc) {
      throw new NotFoundException('Content not found.');
    }

    const adminObjectId = new Types.ObjectId(admin.id);

    await this.setHidden(type, contentObjectId, hidden, adminObjectId);

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
      const authorId = this.extractAuthorId(type, doc);
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
