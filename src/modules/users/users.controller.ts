import {
  Controller,
  Get,
  Patch,
  Delete,
  Body,
  UseGuards,
  Post,
  UseInterceptors,
  UploadedFile,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './services/users.service';
import { FileUploadService } from './services/file-upload.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../auth/entities/user.entity';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SendPhoneOtpDto, VerifyPhoneDto } from './dto/verify-phone.dto';

@ApiTags('Users - Profile')
@Controller('users')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly fileUploadService: FileUploadService,
  ) {}

  // ============================================
  // USER PROFILE
  // ============================================

  @Get('profile')
  @ApiOperation({
    summary: 'Get my profile',
    description: 'Get complete profile information for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'User profile',
    type: User,
  })
  async getProfile(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  @Patch('profile')
  @ApiOperation({
    summary: 'Update my profile',
    description: 'Update profile information (name, address, phone, etc.)',
  })
  @ApiResponse({
    status: 200,
    description: 'Profile updated',
    type: User,
  })
  async updateProfile(
    @CurrentUser('id') userId: string,
    @Body() updateDto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(userId, updateDto);
  }

  // ============================================
  // PROFILE PHOTO
  // ============================================

  @Post('profile/photo')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload profile photo',
    description: 'Upload or update profile photo (max 5MB, JPEG/PNG/WebP)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Photo uploaded',
    type: User,
  })
  async uploadPhoto(
    @CurrentUser('id') userId: string,
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 5 * 1024 * 1024 }), // 5MB
          new FileTypeValidator({ fileType: /(jpg|jpeg|png|webp)$/ }),
        ],
      }),
    )
    file: Express.Multer.File,
  ) {
    // Get current user to delete old photo
    const user = await this.usersService.findById(userId);

    // Delete old photo if exists
    if (user.profilePhoto) {
      await this.fileUploadService.deleteProfilePhoto(user.profilePhoto);
    }

    // Upload new photo
    const photoUrl = await this.fileUploadService.uploadProfilePhoto(
      file,
      userId,
    );

    // Update user profile
    return this.usersService.updateProfilePhoto(userId, photoUrl);
  }

  @Delete('profile/photo')
  @ApiOperation({
    summary: 'Delete profile photo',
    description: 'Remove profile photo',
  })
  @ApiResponse({
    status: 200,
    description: 'Photo deleted',
    type: User,
  })
  async deletePhoto(@CurrentUser('id') userId: string) {
    // Get current user
    const user = await this.usersService.findById(userId);

    // Delete photo file if exists
    if (user.profilePhoto) {
      await this.fileUploadService.deleteProfilePhoto(user.profilePhoto);
    }

    // Update user profile
    return this.usersService.deleteProfilePhoto(userId);
  }

  // ============================================
  // PHONE VERIFICATION
  // ============================================

  @Post('verify-phone/send-otp')
  @ApiOperation({
    summary: 'Send phone verification OTP',
    description:
      'Send a 6-digit OTP code to the specified phone number via SMS',
  })
  @ApiResponse({
    status: 200,
    description: 'OTP sent successfully',
    schema: {
      example: {
        success: true,
        message: 'OTP sent to your phone',
      },
    },
  })
  async sendPhoneOtp(
    @CurrentUser('id') userId: string,
    @Body() dto: SendPhoneOtpDto,
  ) {
    await this.usersService.sendPhoneOtp(userId, dto);

    return {
      success: true,
      message: 'OTP sent to your phone',
    };
  }

  @Post('verify-phone')
  @ApiOperation({
    summary: 'Verify phone with OTP',
    description: 'Verify phone number by providing the 6-digit OTP code',
  })
  @ApiResponse({
    status: 200,
    description: 'Phone verified successfully',
    type: User,
  })
  async verifyPhone(
    @CurrentUser('id') userId: string,
    @Body() dto: VerifyPhoneDto,
  ) {
    return this.usersService.verifyPhone(userId, dto);
  }
}
