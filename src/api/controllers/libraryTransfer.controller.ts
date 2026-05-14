import {
  Authorized,
  Body,
  CurrentUser,
  HttpError,
  InternalServerError,
  JsonController,
  Post,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { LibraryTransferService } from '../services/libraryTransfer.service';
import {
  InitiateLibraryTransferRequest,
  VerifyLibraryTransferOtpRequest,
} from './requests/libraryTransfer.request';
import { CurrentSessionData } from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';
import {
  LibraryTransferApiResponse,
  LibraryTransferData,
  LibraryTransferInitiateApiResponse,
} from './responses/libraryTransfer.response';

@Service()
@JsonController('/v1/library/transfer')
@OpenAPI({ tags: ['Library Transfer'] })
export class LibraryTransferController {
  constructor(private readonly libraryTransferService: LibraryTransferService) {}

  // ── POST /initiate ────────────────────────────────────────────────────────
  @Post('/initiate')
  @Authorized('OWNER')
  @OpenAPI({
    summary: 'Initiate library ownership transfer — sends OTP to both owners',
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(LibraryTransferInitiateApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 403 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async initiateTransfer(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: InitiateLibraryTransferRequest,
  ): Promise<LibraryTransferInitiateApiResponse> {
    try {
      const data = await this.libraryTransferService.initiateTransfer(session.user.id, payload);
      return new LibraryTransferInitiateApiResponse(data, 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('INITIATE_TRANSFER_FAILED');
    }
  }

  // ── POST /verify-otp ──────────────────────────────────────────────────────
  @Post('/verify-otp')
  @Authorized('OWNER')
  @OpenAPI({
    summary: 'Verify OTPs from both owners and complete library transfer',
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(LibraryTransferApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 403 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async verifyAndCompleteTransfer(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: VerifyLibraryTransferOtpRequest,
  ): Promise<LibraryTransferApiResponse> {
    try {
      const record = await this.libraryTransferService.verifyAndCompleteTransfer(
        session.user.id,
        payload,
      );
      return new LibraryTransferApiResponse(new LibraryTransferData(record), 200);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }
      throw new InternalServerError('VERIFY_TRANSFER_FAILED');
    }
  }
}
