import * as multer from 'multer';
import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  HttpError,
  InternalServerError,
  JsonController,
  Patch,
  Post,
  QueryParam,
  Req,
  Res,
  UseBefore,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { AuthRepository } from '../repositories/auth.repositories';
import { LibraryRepository } from '../repositories/library.repository';
import { UploadService } from '../services/upload.service';
import { DeleteUploadRequest, GeneratePresignedUrlRequest } from './requests/upload.request';
import {
  DeleteUploadApiResponse,
  PresignedUrlApiResponse,
  PresignedUrlData,
  UploadFileApiResponse,
  UploadFileData,
} from './responses/upload.response';
import { ErrorResponseModel } from './responses/common.reponse';
import { CurrentSessionData } from './responses/auth.response';

const upload = multer({ storage: multer.memoryStorage() });

@Service()
@JsonController('/v1/upload')
export class UploadController {
  constructor(
    private readonly uploadService: UploadService,
    private readonly authRepository: AuthRepository,
    private readonly libraryRepository: LibraryRepository, // ✅ ADD THIS
  ) {}

  @Post('/presigned')
  @Authorized()
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(PresignedUrlApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async generatePresignedUrl(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: GeneratePresignedUrlRequest,
  ): Promise<PresignedUrlApiResponse> {
    try {
      const result = await this.uploadService.generatePresignedUrl(
        payload.fileName,
        payload.fileType,
        payload.folder,
      );

      await this.saveFileUrlToUser(session, payload.folder ?? 'uploads', result.fileUrl);

      return new PresignedUrlApiResponse(new PresignedUrlData(result), 200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GENERATE_PRESIGNED_URL_FAILED');
    }
  }

  @Patch('/')
  @Authorized()
  @UseBefore(upload.single('file'))
  @OpenAPI({
    security: [{ bearerAuth: [] }],
    requestBody: {
      content: {
        'multipart/form-data': {
          schema: {
            type: 'object',
            properties: {
              file: { type: 'string', format: 'binary' },
            },
          },
        },
      },
    },
  })
  @ResponseSchema(UploadFileApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async uploadFile(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @QueryParam('folder') folder: string = 'uploads',
    @Req() req: any,
    @Res() res: any,
  ): Promise<UploadFileApiResponse> {
    try {
      const file = req.file;
      if (!file) {
        throw new HttpError(400, 'FILE_REQUIRED');
      }

      const result = await this.uploadService.uploadFile(
        file.buffer,
        file.mimetype,
        file.originalname,
        folder,
      );

      await this.saveFileUrlToUser(session, folder, result.fileUrl);

      return new UploadFileApiResponse(
        new UploadFileData({ key: result.key, fileUrl: result.fileUrl }),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('UPLOAD_FILE_FAILED');
    }
  }

  @Delete('/')
  @Authorized()
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(DeleteUploadApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async deleteFile(
    @CurrentUser({ required: true }) _session: CurrentSessionData,
    @Body() payload: DeleteUploadRequest,
  ): Promise<DeleteUploadApiResponse> {
    try {
      await this.uploadService.deleteFile(payload.key);
      return new DeleteUploadApiResponse(200);
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('DELETE_FILE_FAILED');
    }
  }

  private async saveFileUrlToUser(
    session: CurrentSessionData,
    folder: string,
    fileUrl: string,
  ): Promise<void> {
    try {
      const role = session.user.role;
      const userId = session.user.id;

      // ✅ Student avatar
      if (folder === 'avatars' && role === 'STUDENT') {
        await this.authRepository.updateStudentProfile(userId, { avatarUrl: fileUrl });
        return;
      }

      // ✅ Owner logo/avatar
      if (folder === 'logos' && role === 'OWNER') {
        await this.authRepository.updateOwnerProfile(userId, { avatarUrl: fileUrl });
        return;
      }

      // ✅ Library photos — append new photo to library's photos array in MongoDB
      if (folder === 'library-photos' && role === 'OWNER') {
        const library = await this.libraryRepository.findLibraryByOwnerId(userId);
        if (!library) return;

        const existingPhotos = library.photos ?? [];
        const newPhoto = {
          url: fileUrl,
          publicId: null,
          order: existingPhotos.length, // append at end
          uploadedAt: new Date(),
        };

        await this.libraryRepository.partialUpdateLibrary(library.id, {
          photos: [...existingPhotos, newPhoto],
        });
        return;
      }
    } catch {
      // non-critical
    }
  }
}