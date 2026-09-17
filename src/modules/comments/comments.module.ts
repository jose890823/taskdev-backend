import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from './entities/comment.entity';
import { TaskCommentRead } from './entities/task-comment-read.entity';
import { CommentsService } from './comments.service';
import { CommentsController } from './comments.controller';
import { TasksModule } from '../tasks/tasks.module';
import { ApiKeysModule } from '../api-keys/api-keys.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, TaskCommentRead]),
    TasksModule,
    ApiKeysModule,
    AuthModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
  exports: [CommentsService],
})
export class CommentsModule {}
