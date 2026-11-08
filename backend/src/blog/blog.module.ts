import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BlogController } from './blog.controller';
import { BlogService } from './blog.service';
import { Post, PostSchema } from './schemas/post.schema';
import { Comment, CommentSchema } from './schemas/comment.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UploadsModule } from '../uploads/uploads.module';
import { UsersModule } from '../users/users.module';
import { ItinerariesModule } from '../itineraries/itineraries.module';
import { Like, LikeSchema } from './schemas/like.schema';
import {
  PostDeletionCleanup,
  PostDeletionCleanupSchema,
} from './schemas/post-deletion-cleanup.schema';

@Module({
  imports: [
    UploadsModule,
    UsersModule,
    ItinerariesModule,
    MongooseModule.forFeature([
      { name: Post.name, schema: PostSchema },
      { name: Comment.name, schema: CommentSchema },
      { name: Like.name, schema: LikeSchema },
      { name: PostDeletionCleanup.name, schema: PostDeletionCleanupSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [BlogController],
  providers: [BlogService],
  exports: [BlogService],
})
export class BlogModule {}
