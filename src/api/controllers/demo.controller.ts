import {
  Body,
  Delete,
  Get,
  HttpCode,
  JsonController,
  Param,
  Patch,
  Post,
} from 'routing-controllers';
import { ResponseSchema } from 'routing-controllers-openapi';
import { Service } from 'typedi';
import { DemoService } from '../services/demo.service';
import { CreateDemoRequest, UpdateDemoRequest } from './requests/demo.request';
import { ErrorResponseModel } from './responses/common.reponse';
import {
  DemoDeleteApiResponse,
  DemoDeleteData,
  DemoItemApiResponse,
  DemoListApiResponse,
  DemoSummaryApiResponse,
  DemoSummaryData,
} from './responses/demo.response';

@Service()
@JsonController('/demo')
export class DemoController {
  constructor(private readonly demoService: DemoService) {}

  @Get('/')
  @ResponseSchema(DemoSummaryApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public getSummary(): DemoSummaryApiResponse {
    const summary = this.demoService.getSummary();

    return new DemoSummaryApiResponse(
      200,
      new DemoSummaryData(
        summary.service,
        summary.mongoConnection,
        summary.message,
      ),
    );
  }

  @Get('/items')
  @ResponseSchema(DemoListApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public list(): DemoListApiResponse {
    return new DemoListApiResponse(200, this.demoService.list());
  }

  @Get('/items/:id')
  @ResponseSchema(DemoItemApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public getById(@Param('id') id: string): DemoItemApiResponse {
    return new DemoItemApiResponse(200, this.demoService.getById(id));
  }

  @Post('/items')
  @HttpCode(201)
  @ResponseSchema(DemoItemApiResponse, { statusCode: 201 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public create(@Body() payload: CreateDemoRequest): DemoItemApiResponse {
    return new DemoItemApiResponse(201, this.demoService.create(payload));
  }

  @Patch('/items/:id')
  @ResponseSchema(DemoItemApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public update(
    @Param('id') id: string,
    @Body() payload: UpdateDemoRequest,
  ): DemoItemApiResponse {
    return new DemoItemApiResponse(200, this.demoService.update(id, payload));
  }

  @Delete('/items/:id')
  @ResponseSchema(DemoDeleteApiResponse, { statusCode: 200 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 400 })
  @ResponseSchema(ErrorResponseModel, { statusCode: 500 })
  public delete(@Param('id') id: string): DemoDeleteApiResponse {
    const result = this.demoService.delete(id);

    return new DemoDeleteApiResponse(
      200,
      new DemoDeleteData(result.deleted, result.id),
    );
  }
}
