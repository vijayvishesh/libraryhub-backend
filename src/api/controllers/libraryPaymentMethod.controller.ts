import {
  Authorized,
  Body,
  CurrentUser,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
  Param,
  Patch,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { LibraryPaymentMethodService } from '../services/libraryPaymentMethod.service';
import { UpdatePaymentMethodsRequest } from './requests/libraryPaymentMethod.request';
import {
  LibraryPaymentMethodsApiResponse,
  LibraryPaymentMethodsData,
  PaymentMethodData,
} from './responses/libraryPaymentMethod.response';
import { CurrentSessionData } from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';

@Service()
@JsonController('/v1/payment-methods')
export class LibraryPaymentMethodController {
  constructor(
    private readonly libraryPaymentMethodService: LibraryPaymentMethodService,
  ) {}

  // ── Owner: GET /api/v1/payment-methods/my ─────────────────────────────────

  @Get('/my')
  @Authorized('OWNER')
  @OpenAPI({
    summary: 'Get all payment methods for owner library',
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(LibraryPaymentMethodsApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getMyPaymentMethods(
    @CurrentUser({ required: true }) session: CurrentSessionData,
  ): Promise<LibraryPaymentMethodsApiResponse> {
    try {
      const result = await this.libraryPaymentMethodService.getOwnerPaymentMethods(
        session.user.id,
      );
      return new LibraryPaymentMethodsApiResponse(
        new LibraryPaymentMethodsData({
          libraryId: result.libraryId,
          methods: result.methods.map(m => new PaymentMethodData(m)),
        }),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_PAYMENT_METHODS_FAILED');
    }
  }

  // ── Owner: PATCH /api/v1/payment-methods/my ───────────────────────────────

  @Patch('/my')
  @Authorized('OWNER')
  @OpenAPI({
    summary: 'Toggle payment methods on/off',
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(LibraryPaymentMethodsApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async updateMyPaymentMethods(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: UpdatePaymentMethodsRequest,
  ): Promise<LibraryPaymentMethodsApiResponse> {
    try {
      const result = await this.libraryPaymentMethodService.updateOwnerPaymentMethods(
        session.user.id,
        payload.methods,
      );
      return new LibraryPaymentMethodsApiResponse(
        new LibraryPaymentMethodsData({
          libraryId: result.libraryId,
          methods: result.methods.map(m => new PaymentMethodData(m)),
        }),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('UPDATE_PAYMENT_METHODS_FAILED');
    }
  }

  // ── Student: GET /api/v1/payment-methods/:libraryId ───────────────────────

  @Get('/:libraryId')
  @Authorized('STUDENT')
  @OpenAPI({
    summary: 'Get enabled payment methods for a library (student view)',
    security: [{ bearerAuth: [] }],
  })
  @ResponseSchema(LibraryPaymentMethodsApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getLibraryPaymentMethods(
    @Param('libraryId') libraryId: string,
  ): Promise<LibraryPaymentMethodsApiResponse> {
    try {
      const result = await this.libraryPaymentMethodService.getStudentPaymentMethods(libraryId);
      return new LibraryPaymentMethodsApiResponse(
        new LibraryPaymentMethodsData({
          libraryId: result.libraryId,
          methods: result.methods.map(m => new PaymentMethodData(m)),
        }),
        200,
      );
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new InternalServerError('GET_PAYMENT_METHODS_FAILED');
    }
  }
}