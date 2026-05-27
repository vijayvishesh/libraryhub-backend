import { HttpError, NotFoundError } from 'routing-controllers';
import { Service } from 'typedi';
import { LibraryRepository } from '../repositories/library.repository';
import { LibrarySubscriptionRepository } from '../repositories/librarySubscription.repository';
import { LibrarySubscriptionRecord } from '../repositories/types/librarySubscription.repository.types';
import { SubscriptionPlanRecord } from '../repositories/types/subscriptionPlan.repository.types';
import {
  LibrarySubscriptionResult,
  LibrarySubscriptionStatusResult,
  SubscriptionPlanResult,
} from './types/subscription.service.types';
import { SubscriptionPlanRepository } from '../repositories/subscriptionPlan.repository';
import { RazorpayService } from './razorpay.service';
import { SubscriptionPaymentRepository } from '../repositories/subscriptionPayment.repository';

@Service()
export class SubscriptionService {
  constructor(
    private readonly subscriptionPlanRepository: SubscriptionPlanRepository,
    private readonly librarySubscriptionRepository: LibrarySubscriptionRepository,
    private readonly libraryRepository: LibraryRepository,
    private readonly paymentRepository:SubscriptionPaymentRepository, 
    private readonly razorpayService: RazorpayService,
  ) {}

  // ── Plans (Admin) ────────────────────────────────────────────────────

  public async createPlan(input: {
    name: string;
    description: string;
    price: number;
    durationDays: number;
    features: SubscriptionPlanRecord['features'];
    isActive: boolean;
    sortOrder: number;
  }): Promise<SubscriptionPlanResult> {
    const plan = await this.subscriptionPlanRepository.createPlan(input);
    return this.mapPlan(plan);
  }

  public async listPlans(onlyActive = false): Promise<SubscriptionPlanResult[]> {
    const plans = await this.subscriptionPlanRepository.listAllPlans(onlyActive);
    return plans.map(p => this.mapPlan(p));
  }

  public async updatePlan(
    planId: string,
    input: Partial<{
      name: string;
      description: string;
      price: number;
      durationDays: number;
      features: SubscriptionPlanRecord['features'];
      isActive: boolean;
      sortOrder: number;
    }>,
  ): Promise<SubscriptionPlanResult> {
    const updated = await this.subscriptionPlanRepository.updatePlan(planId, input);
    if (!updated) throw new NotFoundError('PLAN_NOT_FOUND');
    return this.mapPlan(updated);
  }

  public async deletePlan(planId: string): Promise<void> {
    const deleted = await this.subscriptionPlanRepository.deletePlan(planId);
    if (!deleted) throw new NotFoundError('PLAN_NOT_FOUND');
  }

  // ── Owner: get my library subscription status ─────────────────────

  public async getLibrarySubscriptionStatus(
    libraryId: string,
  ): Promise<LibrarySubscriptionStatusResult> {
    const library = await this.libraryRepository.findLibraryById(libraryId);
    if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');

    const active = await this.librarySubscriptionRepository.findActiveByLibraryId(libraryId);

    if (!active) {
      // No active plan — return noPlan with available plans
      const availablePlans = await this.subscriptionPlanRepository.listAllPlans(true);
      return {
        noPlan: true,
        libraryId,
        message: 'No active subscription found for this library',
        availablePlans: availablePlans.map(p => this.mapPlan(p)),
      };
    }

    return { noPlan: false, subscription: this.mapSubscription(active) };
  }

  // ── Admin: activate plan for ONE library ─────────────────────────

  public async adminActivatePlan(input: {
    libraryId: string;
    planId: string;
    startDate?: string;
    notes?: string;
    paymentMethod?: string;
  }): Promise<LibrarySubscriptionResult> {
    const library = await this.libraryRepository.findLibraryById(input.libraryId);
    if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');

    const plan = await this.subscriptionPlanRepository.findPlanById(input.planId);
    if (!plan) throw new NotFoundError('PLAN_NOT_FOUND');
    if (!plan.isActive) throw new HttpError(400, 'PLAN_IS_NOT_ACTIVE');

    const startDate = input.startDate || new Date().toISOString().slice(0, 10);
    const endDate   = this.addDaysToDate(startDate, plan.durationDays);

    // Expire any existing active subscription first
    await this.librarySubscriptionRepository.expireActiveSubscriptions(input.libraryId);

    const sub = await this.librarySubscriptionRepository.createSubscription({
      libraryId:        input.libraryId,
      planId:           plan.id,
      planName:         plan.name,
      features:         plan.features,
      status:           'active',
      activatedBy:      'admin',
      startDate,
      endDate,
      amount:           plan.price,
      paymentMethod:    input.paymentMethod || null,
      paymentReference: null,
      notes:            input.notes || null,
    });

    return this.mapSubscription(sub);
  }

  // ── Admin: activate plan for ALL libraries at once ────────────────

  public async adminActivatePlanForAllLibraries(input: {
    planId: string;
    startDate?: string;
    notes?: string;
  }): Promise<{ activated: number }> {
    const plan = await this.subscriptionPlanRepository.findPlanById(input.planId);
    if (!plan) throw new NotFoundError('PLAN_NOT_FOUND');
    if (!plan.isActive) throw new HttpError(400, 'PLAN_IS_NOT_ACTIVE');

    const startDate = input.startDate || new Date().toISOString().slice(0, 10);
    const endDate   = this.addDaysToDate(startDate, plan.durationDays);

    // Get all libraries
    const libraries = await this.libraryRepository.findAllLibraries();

    // Expire all current active subscriptions
    await this.librarySubscriptionRepository.expireAllActiveSubscriptions();

    // Create new subscription for each library
    await Promise.all(
      libraries.map(lib =>
        this.librarySubscriptionRepository.createSubscription({
          libraryId:        lib.id,
          planId:           plan.id,
          planName:         plan.name,
          features:         plan.features,
          status:           'active',
          activatedBy:      'admin',
          startDate,
          endDate,
          amount:           0, // free when admin bulk activates
          paymentMethod:    null,
          paymentReference: null,
          notes:            input.notes || null,
        }),
      ),
    );

    return { activated: libraries.length };
  }

  // ── Admin: list all subscriptions ────────────────────────────────

  public async adminListSubscriptions(query: {
    libraryId?: string;
    status?: 'active' | 'expired' | 'cancelled' | 'trial';
    page: number;
    limit: number;
  }): Promise<{ subscriptions: LibrarySubscriptionResult[]; total: number }> {
    const result = await this.librarySubscriptionRepository.listSubscriptions({
      ...query,
      page:  query.page  || 1,
      limit: query.limit || 20,
    });

    return {
      subscriptions: result.subscriptions.map(s => this.mapSubscription(s)),
      total:         result.total,
    };
  }

  // ── Admin: update one subscription ───────────────────────────────

  public async adminUpdateSubscription(
    subscriptionId: string,
    input: {
      status?: 'active' | 'expired' | 'cancelled' | 'trial';
      endDate?: string;
      notes?: string;
    },
  ): Promise<LibrarySubscriptionResult> {
    const updated = await this.librarySubscriptionRepository.updateSubscription(
      subscriptionId,
      { ...input, updatedAt: new Date() },
    );
    if (!updated) throw new NotFoundError('SUBSCRIPTION_NOT_FOUND');
    return this.mapSubscription(updated);
  }

  // ── Helpers ──────────────────────────────────────────────────────

  private mapPlan(plan: SubscriptionPlanRecord): SubscriptionPlanResult {
    return {
      id:          plan.id,
      name:        plan.name,
      description: plan.description,
      price:       plan.price,
      durationDays:plan.durationDays,
      features:    plan.features,
      isActive:    plan.isActive,
      sortOrder:   plan.sortOrder,
      createdAt:   plan.createdAt,
      updatedAt:   plan.updatedAt,
    };
  }

  private mapSubscription(sub: LibrarySubscriptionRecord): LibrarySubscriptionResult {
    const today        = new Date().toISOString().slice(0, 10);
    const endDate      = new Date(sub.endDate);
    const todayDate    = new Date(today);
    const daysRemaining = Math.max(
      0,
      Math.ceil((endDate.getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)),
    );

    return {
      id:               sub.id,
      libraryId:        sub.libraryId,
      planId:           sub.planId,
      planName:         sub.planName,
      features:         sub.features,
      status:           sub.status,
      activatedBy:      sub.activatedBy,
      startDate:        sub.startDate,
      endDate:          sub.endDate,
      daysRemaining,
      amount:           sub.amount,
      paymentMethod:    sub.paymentMethod,
      paymentReference: sub.paymentReference,
      notes:            sub.notes,
      createdAt:        sub.createdAt,
      updatedAt:        sub.updatedAt,
    };
  }

  private addDaysToDate(isoDate: string, days: number): string {
    const date = new Date(`${isoDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  public async createSubscriptionOrder(
  ownerId:   string,
  input: {
    libraryId:      string;
    planId:         string;
    durationMonths?: number;
    startDate?:     string;
  },
): Promise<{
  paymentId:       string;
  razorpayOrderId: string;
  razorpayKeyId:   string;
  amount:          number;
  currency:        string;
  planName:        string;
  receipt:         string;
}> {
  // 1. Validate library belongs to owner
  const library = await this.libraryRepository.findLibraryById(input.libraryId);
  if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');
  if (library.ownerId !== ownerId) throw new HttpError(403, 'NOT_YOUR_LIBRARY');

  // 2. Validate plan
  const plan = await this.subscriptionPlanRepository.findPlanById(input.planId);
  if (!plan)         throw new NotFoundError('PLAN_NOT_FOUND');
  if (!plan.isActive) throw new HttpError(400, 'PLAN_NOT_AVAILABLE');

  // 3. Check if already has active subscription
  const existing = await this.librarySubscriptionRepository.findActiveByLibraryId(input.libraryId);
  if (existing) throw new HttpError(409, 'ALREADY_HAS_ACTIVE_SUBSCRIPTION');

  // 4. Build receipt — unique reference
  const receipt = `SUB-${input.libraryId.slice(-6)}-${Date.now()}`;

  // 5. Create Razorpay order
  const order = await this.razorpayService.createOrder({
    amount:  plan.price,
    receipt,
    notes: {
      libraryId: input.libraryId,
      planId:    plan.id,
      planName:  plan.name,
      ownerId,
    },
  });

  // 6. Save payment record with status 'created'
  const payment = await this.paymentRepository.createPayment({
    libraryId:         input.libraryId,
    ownerId,
    purpose:           'subscription',
    planId:            plan.id,
    planName:          plan.name,
    amount:            plan.price,
    currency:          'INR',
    status:            'created',
    razorpayOrderId:   order.orderId,
    razorpayPaymentId: null,
    razorpaySignature: null,
    receipt,
    subscriptionId:    null,
  });

  return {
    paymentId:       payment.id,
    razorpayOrderId: order.orderId,
    razorpayKeyId:   this.razorpayService.getKeyId(),
    amount:          plan.price,
    currency:        'INR',
    planName:        plan.name,
    receipt,
  };
}

// ── Step 2: Verify payment & activate subscription ───────────────────

public async verifyAndActivateSubscription(
  ownerId: string,
  input: {
    razorpayOrderId:   string;
    razorpayPaymentId: string;
    razorpaySignature: string;
    libraryId:         string;
    startDate?:        string;
  },
): Promise<{
  subscriptionId: string;
  libraryId:      string;
  planName:       string;
  status:         string;
  startDate:      string;
  endDate:        string;
  daysRemaining:  number;
  paymentId:      string;
  message:        string;
}> {
  // 1. Find the payment record
  const payment = await this.paymentRepository.findByRazorpayOrderId(input.razorpayOrderId);
  if (!payment) throw new HttpError(404, 'PAYMENT_ORDER_NOT_FOUND');

  // 2. Validate ownership
  if (payment.ownerId !== ownerId) throw new HttpError(403, 'NOT_YOUR_PAYMENT');
  if (payment.libraryId !== input.libraryId) throw new HttpError(400, 'LIBRARY_MISMATCH');

  // 3. Prevent double activation
  if (payment.status === 'paid') throw new HttpError(409, 'PAYMENT_ALREADY_PROCESSED');

  // 4. Verify Razorpay signature — CRITICAL security check
  const isValid = this.razorpayService.verifyPaymentSignature({
    razorpayOrderId:   input.razorpayOrderId,
    razorpayPaymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
  });
  if (!isValid) {
    // Mark payment as failed
    await this.paymentRepository.updatePayment(payment.id, {
      status:            'failed',
      razorpayPaymentId: input.razorpayPaymentId,
      razorpaySignature: input.razorpaySignature,
      updatedAt:         new Date(),
    });
    throw new HttpError(400, 'INVALID_PAYMENT_SIGNATURE');
  }

  // 5. Fetch plan
  const plan = await this.subscriptionPlanRepository.findPlanById(payment.planId);
  if (!plan) throw new NotFoundError('PLAN_NOT_FOUND');

  // 6. Calculate subscription dates
  const startDate = input.startDate || new Date().toISOString().slice(0, 10);
  const endDate   = this.addDaysToDate(startDate, plan.durationDays);

  // 7. Expire any existing active subscriptions
  await this.librarySubscriptionRepository.expireActiveSubscriptions(input.libraryId);

  // 8. Create subscription
  const subscription = await this.librarySubscriptionRepository.createSubscription({
    libraryId:        input.libraryId,
    planId:           plan.id,
    planName:         plan.name,
    features:         plan.features,
    status:           'active',
    activatedBy:      'owner',
    startDate,
    endDate,
    amount:           payment.amount,
    paymentMethod:    'razorpay',
    paymentReference: input.razorpayPaymentId,
    notes:            null,
  });

  // 9. Update payment record to paid + link subscription
  await this.paymentRepository.updatePayment(payment.id, {
    status:            'paid',
    razorpayPaymentId: input.razorpayPaymentId,
    razorpaySignature: input.razorpaySignature,
    subscriptionId:    subscription.id,
    updatedAt:         new Date(),
  });

  // 10. Calculate days remaining
  const today         = new Date(new Date().toISOString().slice(0, 10));
  const end           = new Date(endDate);
  const daysRemaining = Math.max(
    0,
    Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
  );

  return {
    subscriptionId: subscription.id,
    libraryId:      input.libraryId,
    planName:       plan.name,
    status:         'active',
    startDate,
    endDate,
    daysRemaining,
    paymentId:      payment.id,
    message:        'Subscription activated successfully',
  };
}

// ── Retry failed/expired payment ─────────────────────────────────────

public async retrySubscriptionOrder(
  ownerId:   string,
  input: { libraryId: string; planId: string },
): Promise<{
  paymentId:       string;
  razorpayOrderId: string;
  razorpayKeyId:   string;
  amount:          number;
  currency:        string;
  planName:        string;
  receipt:         string;
}> {
  // Same as createOrder — just re-creates a fresh Razorpay order
  return this.createSubscriptionOrder(ownerId, input);
}

// ── Owner: subscription history ──────────────────────────────────────

public async getSubscriptionHistory(
  ownerId:   string,
  input: {
    libraryId: string;
    status?:   'active' | 'expired' | 'cancelled' | 'trial';
    page:      number;
    limit:     number;
  },
): Promise<{ subscriptions: any[]; total: number }> {
  const library = await this.libraryRepository.findLibraryById(input.libraryId);
  if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');
  if (library.ownerId !== ownerId) throw new HttpError(403, 'NOT_YOUR_LIBRARY');

  const result = await this.librarySubscriptionRepository.listSubscriptions({
    libraryId: input.libraryId,
    status:    input.status,
    page:      input.page,
    limit:     input.limit,
  });

  return {
    subscriptions: result.subscriptions.map(s => this.mapSubscription(s)),
    total:         result.total,
  };
}

// ── Owner: payment history ───────────────────────────────────────────

public async getPaymentHistory(
  ownerId:   string,
  libraryId: string,
  page:      number,
  limit:     number,
): Promise<{ payments: any[]; total: number }> {
  const library = await this.libraryRepository.findLibraryById(libraryId);
  if (!library) throw new NotFoundError('LIBRARY_NOT_FOUND');
  if (library.ownerId !== ownerId) throw new HttpError(403, 'NOT_YOUR_LIBRARY');

  return this.paymentRepository.listPayments({ libraryId, page, limit });
}
}