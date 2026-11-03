import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, FilterQuery, Model, Types } from 'mongoose';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  paginate,
  PaginatedList,
} from '../common/dto/pagination.dto';
import { ContentType, ReportStatus } from '../common/enums';
import type { AuthUser } from '../common/interfaces';
import { User, UserDocument } from '../users/schemas/user.schema';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
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
  constructor(
    @InjectModel(Report.name)
    private readonly reportModel: Model<ReportDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectConnection()
    private readonly connection: Connection,
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

  // GEN-09: A registered user reports a post, comment, review or itinerary
  async createReport(
    user: AuthUser,
    dto: CreateReportDto,
  ): Promise<ReportItem> {
    const contentObjectId = new Types.ObjectId(dto.contentId);
    const collectionName = this.getCollectionName(dto.contentType);

    // Verify target content exists in MongoDB
    const contentDoc = await this.connection.db
      ?.collection(collectionName)
      .findOne({ _id: contentObjectId });

    if (
      !contentDoc ||
      (contentDoc as Record<string, unknown>).deleted === true
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
      reason: dto.reason.trim(),
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
