import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import {
  DEFAULT_PAGE_SIZE,
  getPaginationOffset,
  paginate,
  PaginatedList,
} from '../common/dto/pagination.dto';
import { AuditAction } from '../common/enums';
import { User, UserDocument } from '../users/schemas/user.schema';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';
import { AuditLog, AuditLogDocument } from './schemas/audit-log.schema';

export interface RecordAuditLogInput {
  adminId: Types.ObjectId | string;
  adminName?: string;
  adminEmail?: string;
  action: AuditAction | string;
  targetType?: string;
  targetId?: string;
  reason?: string;
  details?: Record<string, unknown>;
}

export type RecordAuditParams = RecordAuditLogInput;

export interface AuditLogAdmin {
  id: string;
  name: string;
  email: string;
}

export interface AuditLogItem {
  id: string;
  admin: AuditLogAdmin;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string;
  details?: Record<string, unknown>;
  createdAt: Date;
  date: Date;
}

export type LeanAuditLog = AuditLog & { _id: Types.ObjectId };

// Area: Community & Cross-cutting
// Business logic and database access for: GEN-07
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
  ) {}

  // GEN-07: Record an admin action in the audit log
  async record(input: RecordAuditLogInput): Promise<AuditLogDocument | null> {
    try {
      const adminObjectId =
        typeof input.adminId === 'string' &&
        Types.ObjectId.isValid(input.adminId)
          ? new Types.ObjectId(input.adminId)
          : input.adminId;

      let adminName = input.adminName;
      let adminEmail = input.adminEmail;

      if (
        (!adminName || !adminEmail) &&
        Types.ObjectId.isValid(input.adminId)
      ) {
        const adminUser = await this.userModel
          .findById(input.adminId)
          .select('name email')
          .lean()
          .exec();
        if (adminUser) {
          adminName = adminName ?? adminUser.name;
          adminEmail = adminEmail ?? adminUser.email;
        }
      }

      const auditEntry = new this.auditLogModel({
        adminId: adminObjectId,
        adminName: adminName ?? 'Admin',
        adminEmail: adminEmail ?? '',
        action: input.action,
        targetType: input.targetType ?? 'account',
        targetId: input.targetId ?? '',
        reason: input.reason ?? (input.details?.reason as string) ?? null,
        details: input.details ?? {},
      });

      return await auditEntry.save();
    } catch (error) {
      this.logger.error('Failed to write audit log entry', error);
      return null;
    }
  }

  // GEN-07: List audit logs with pagination and filters
  async list(
    query: ListAuditLogsQueryDto,
  ): Promise<PaginatedList<AuditLogItem>> {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException('from date must not be after to date');
    }

    const filter: FilterQuery<AuditLogDocument> = {};

    if (query.action) {
      filter.action = query.action;
    }

    if (query.from || query.to) {
      const dateFilter: Record<string, Date> = {};
      if (query.from) {
        dateFilter.$gte = new Date(`${query.from}T00:00:00.000Z`);
      }
      if (query.to) {
        dateFilter.$lte = new Date(`${query.to}T23:59:59.999Z`);
      }
      filter.createdAt = dateFilter;
    }

    const page = query.page ?? 1;
    const { skip, limit } = getPaginationOffset(page, DEFAULT_PAGE_SIZE);

    const [logs, total] = await Promise.all([
      this.auditLogModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean<LeanAuditLog[]>()
        .exec(),
      this.auditLogModel.countDocuments(filter).exec(),
    ]);

    const items: AuditLogItem[] = logs.map((log) => ({
      id: log._id.toString(),
      admin: {
        id: log.adminId ? log.adminId.toString() : '',
        name: log.adminName ?? 'Admin',
        email: log.adminEmail ?? '',
      },
      action: log.action,
      targetType: log.targetType ?? '',
      targetId: log.targetId ?? '',
      reason: log.reason ?? (log.details?.reason as string) ?? undefined,
      details: log.details,
      createdAt: log.createdAt ?? new Date(),
      date: log.createdAt ?? new Date(),
    }));

    return paginate(items, total, page, DEFAULT_PAGE_SIZE);
  }
}
