import {
  Controller, Get, Post, Param, Body, Query,
  UseGuards, Headers, RawBodyRequest, Req, ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { IsString, IsEnum, IsOptional, IsNumberString, IsUUID } from 'class-validator';
import type { Request } from 'express';
import { PaymentsService } from './payments.service';
import { ReconciliationService } from './reconciliation.service';
import { TenantStorage } from '@lumora/shared-tenancy';
import { AuthGuard, Roles, Public } from '../../common/guards/auth.guard';

class InitiatePaymentDto {
  @IsString() invoiceId!: string;
  @IsNumberString() amount!: string;
  @IsEnum(['mobile_money', 'bank', 'gepg', 'cash']) channel!: 'mobile_money' | 'bank' | 'gepg' | 'cash';
  @IsString() @IsOptional() provider?: 'selcom' | 'nmb' | 'crdb' | 'gepg' | 'cash';
  @IsString() @IsOptional() payerPhone?: string;
  @IsString() @IsOptional() payerName?: string;
  @IsString() idempotencyKey!: string;
}

class ConfirmCashDto {
  @IsString() confirmedByUserId!: string;
}

class ConfirmReconItemDto {
  @IsUUID() paymentId!: string;
}

@ApiTags('payments')
@ApiBearerAuth()
@Controller('payments')
@UseGuards(AuthGuard)
export class PaymentsController {
  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly reconciliationService: ReconciliationService,
  ) {}

  @Post()
  @Roles('owner', 'bursar', 'accountant', 'parent')
  initiate(@Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiatePayment(dto);
  }

  @Get()
  @Roles('owner', 'bursar', 'accountant', 'auditor')
  list(@Query('invoiceId') invoiceId?: string, @Query('status') status?: string) {
    return this.paymentsService.listPayments(invoiceId, status);
  }

  @Get(':id')
  @Roles('owner', 'bursar', 'accountant', 'auditor', 'parent')
  get(@Param('id') id: string) {
    return this.paymentsService.getPayment(id);
  }

  @Get(':id/status')
  @Roles('owner', 'bursar', 'accountant', 'parent')
  statusCheck(@Param('id') id: string) {
    return this.paymentsService.statusCheck(id);
  }

  @Post(':id/confirm-cash')
  @Roles('owner', 'bursar', 'accountant')
  confirmCash(@Param('id') id: string, @Body() dto: ConfirmCashDto) {
    return this.paymentsService.confirmCashPayment({ paymentId: id, confirmedByUserId: dto.confirmedByUserId });
  }

  /**
   * Webhook endpoints — not authenticated by JWT.
   * Each provider posts to /payments/webhook/:provider.
   * Signature verification is handled inside each adapter.
   */
  @Post('webhook/:provider')
  @Public()
  async webhook(
    @Param('provider') provider: string,
    @Headers() headers: Record<string, string>,
    @Req() req: RawBodyRequest<Request>,
  ) {
    const rawBody = req.rawBody?.toString() ?? JSON.stringify(req.body);
    return this.paymentsService.handleWebhook(provider, { rawBody, headers });
  }

  // ── Reconciliation ──────────────────────────────────────────────────────────

  @Post('reconciliation/run')
  @Roles('owner', 'bursar', 'accountant')
  async triggerReconciliation() {
    const { tenantId } = TenantStorage.get();
    return this.reconciliationService.runForTenant(tenantId, new Date());
  }

  @Get('reconciliation/runs')
  @Roles('owner', 'bursar', 'accountant', 'auditor')
  listRuns() {
    return this.reconciliationService.listRuns();
  }

  @Get('reconciliation/ambiguous')
  @Roles('owner', 'bursar', 'accountant')
  listAmbiguous(@Query('runId') runId?: string) {
    return this.reconciliationService.listAmbiguousItems(runId);
  }

  @Post('reconciliation/ambiguous/:itemId/confirm')
  @Roles('owner', 'bursar', 'accountant')
  confirmAmbiguous(
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: ConfirmReconItemDto,
  ) {
    return this.reconciliationService.confirmAmbiguousItem(itemId, dto.paymentId);
  }
}
