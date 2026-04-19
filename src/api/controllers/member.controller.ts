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

import { ActivityService } from '../services/activity.service';
import { MemberService } from '../services/member.service';
import { AddMemberRequest } from './requests/member.request';
import { CurrentSessionData } from './responses/auth.response';
import { ErrorResponseModel } from './responses/common.reponse';
import { MemberCreateApiResponse } from './responses/member.response';

@Service()
@JsonController('/library')
export class MemberController {
  constructor(
    private readonly memberService: MemberService,
    private readonly activityService: ActivityService,
  ) {}

  @Post('/members')
  @Authorized('OWNER')
  @OpenAPI({ security: [{ bearerAuth: [] }] })
  @ResponseSchema(MemberCreateApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 401 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async addMember(
    @CurrentUser({ required: true }) session: CurrentSessionData,
    @Body() payload: AddMemberRequest,
  ): Promise<MemberCreateApiResponse> {
    try {
      const result = await this.memberService.addMember(session.user.id, payload);

      // Log the activity
      await this.activityService.logActivity(
        session.user.id,
        'NEW_MEMBER_ADDED',
        `New member added: ${payload.fullName}`,
        { memberName: payload.fullName, memberEmail: payload.email, memberPhone: payload.mobileNo },
      );

      return new MemberCreateApiResponse(result.msg, 201);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('ADD_MEMBER_FAILED');
    }
  }
}
