import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';

export interface RecordAuditParams {
  adminId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  details?: Record<string, unknown>;
}

// Area: Community & Cross-cutting
// Business logic and database access for: GEN-07
@Injectable()
export class AuditService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  async record(params: RecordAuditParams): Promise<void> {
    try {
      await this.connection.db?.collection('audit_logs').insertOne({
        adminId: params.adminId,
        action: params.action,
        targetType: params.targetType,
        targetId: params.targetId,
        details: params.details,
        createdAt: new Date(),
      });
    } catch {
      // Audit log failures should not block the primary action.
    }
  }
}
