import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  UnsupportedMediaTypeException,
  UsePipes,
  ValidationPipe,
} from "@nestjs/common";
import { ManualAudit } from "../common/decorators/manual-audit.decorator";
import { CompanyAccessService } from "./company-access.service";
import { CreateCompanyAccessRequestInput } from "./company-access.dto";
import { Public } from "../auth/public.decorator";

@Controller("company-access-requests")
@ManualAudit()
export class CompanyAccessController {
  constructor(private readonly companyAccess: CompanyAccessService) {}

  @Post()
  @Public()
  @HttpCode(202)
  @UsePipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      validationError: { target: false, value: false },
    }),
  )
  async create(
    @Headers("content-type") contentType: string | undefined,
    @Body() input: CreateCompanyAccessRequestInput,
  ): Promise<{ accepted: true }> {
    if (
      !String(contentType || "")
        .toLowerCase()
        .startsWith("application/json")
    ) {
      throw new UnsupportedMediaTypeException("JSON requests are required");
    }
    await this.companyAccess.createPublicRequest(input);
    return { accepted: true };
  }
}
