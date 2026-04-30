import { Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  Body,
  Get,
  HttpError,
  InternalServerError,
  JsonController,
  NotFoundError,
  Param,
  Post,
  Res,
} from 'routing-controllers';
import { OpenAPI, ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { MemberService } from '../services/member.service';
import { SubmitMemberViaInviteLinkRequest } from './requests/member.request';
import { ErrorResponseModel } from './responses/common.reponse';
import { MemberCreateApiResponse, MemberDetailApiResponse } from './responses/member.response';

@Service()
@JsonController('/public/members')
export class PublicMemberController {
  constructor(private readonly memberService: MemberService) {}

  @Get('/invite/:token')
  @OpenAPI({ summary: 'Get member invite form page' })
  public async getInviteLinkFormPage(
    @Param('token') token: string,
    @Res() res: Response,
  ): Promise<void> {
    try {
      const inviteLink = await this.memberService.getInviteLinkDetails(token.trim());
      if (!inviteLink) {
        res.status(404).send('<h1>Invite link invalid or expired</h1>');
        return;
      }

      const htmlPath = join(process.cwd(), 'public', 'member-registration.html');
      let html = readFileSync(htmlPath, 'utf-8');
      html = html.replace(/const TOKEN = .*?;/, `const TOKEN = '${token.trim()}';`);

      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self'; base-uri 'self'; font-src 'self' https: data:; form-action 'self'; frame-ancestors 'self'; img-src 'self' data:; object-src 'none'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' https: 'unsafe-inline'; upgrade-insecure-requests",
      );
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
    } catch {
      res.status(500).send('<h1>An error occurred</h1>');
    }
  }

  @Get('/invite/:token/details')
  @OpenAPI({ summary: 'Get member invite form details by token' })
  @ResponseSchema(MemberDetailApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async getInviteLinkDetailsApi(@Param('token') token: string): Promise<{
    responseCode: number;
    data: { token: string; expiresIn: number; siteLibraryId: string };
  }> {
    try {
      const inviteLink = await this.memberService.getInviteLinkDetails(token.trim());
      if (!inviteLink) {
        throw new NotFoundError('INVITE_LINK_INVALID_OR_EXPIRED');
      }

      const expiresIn = Math.max(
        0,
        Math.floor((inviteLink.expiresAt.getTime() - Date.now()) / 1000),
      );
      return {
        responseCode: 200,
        data: {
          token: inviteLink.token,
          expiresIn,
          siteLibraryId: inviteLink.siteLibraryId,
        },
      };
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('GET_INVITE_LINK_FAILED');
    }
  }

  @Post('/invite/:token/submit')
  @OpenAPI({ summary: 'Submit member details via invite link' })
  @ResponseSchema(MemberDetailApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 404 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 409 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public async submitMemberViaInviteLink(
    @Param('token') token: string,
    @Body() payload: SubmitMemberViaInviteLinkRequest,
  ): Promise<MemberCreateApiResponse> {
    try {
      await this.memberService.submitMemberViaInviteLink(token.trim(), payload);
      return new MemberCreateApiResponse('MEMBER_CREATED_VIA_INVITE_LINK', 201);
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new InternalServerError('SUBMIT_MEMBER_VIA_INVITE_LINK_FAILED');
    }
  }
}
