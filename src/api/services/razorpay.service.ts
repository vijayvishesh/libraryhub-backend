import { Service } from 'typedi';
import * as crypto from 'crypto';

@Service()
export class RazorpayService {
  private readonly keyId: string;
  private readonly keySecret: string;
  private readonly baseUrl = 'https://api.razorpay.com/v1';

  constructor() {
    this.keyId     = process.env.RAZORPAY_KEY_ID     || '';
    this.keySecret = process.env.RAZORPAY_KEY_SECRET || '';

    if (!this.keyId || !this.keySecret) {
      console.warn('[RazorpayService] RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET not set');
    }
  }

  // Create a Razorpay order — call this before showing checkout
  public async createOrder(input: {
    amount: number;        // in INR (will convert to paise internally)
    currency?: string;     // default INR
    receipt: string;       // your internal reference e.g. SUB-libraryId-timestamp
    notes?: Record<string, string>;
  }): Promise<{
    orderId: string;
    amount: number;
    currency: string;
    receipt: string;
  }> {
    const body = {
      amount:   Math.round(input.amount * 100), // paise
      currency: input.currency || 'INR',
      receipt:  input.receipt,
      notes:    input.notes || {},
    };

    const response = await fetch(`${this.baseUrl}/orders`, {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Razorpay order creation failed: ${JSON.stringify(error)}`);
    }

    const data = await response.json() as {
      id: string;
      amount: number;
      currency: string;
      receipt: string;
    };

    return {
      orderId:  data.id,
      amount:   data.amount / 100, // back to INR
      currency: data.currency,
      receipt:  data.receipt,
    };
  }

  // Verify payment signature — MUST verify before activating subscription
  public verifyPaymentSignature(input: {
    razorpayOrderId:   string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }): boolean {
    const body      = `${input.razorpayOrderId}|${input.razorpayPaymentId}`;
    const expected  = crypto
      .createHmac('sha256', this.keySecret)
      .update(body)
      .digest('hex');

    return expected === input.razorpaySignature;
  }

  // Fetch payment details from Razorpay (optional — for double verification)
  public async fetchPayment(razorpayPaymentId: string): Promise<{
    id:       string;
    amount:   number;
    currency: string;
    status:   string;
    method:   string;
  } | null> {
    try {
      const response = await fetch(`${this.baseUrl}/payments/${razorpayPaymentId}`, {
        method:  'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64')}`,
        },
      });

      if (!response.ok) return null;

      const data = await response.json() as {
        id: string;
        amount: number;
        currency: string;
        status: string;
        method: string;
      };

      return {
        id:       data.id,
        amount:   data.amount / 100,
        currency: data.currency,
        status:   data.status,
        method:   data.method,
      };
    } catch {
      return null;
    }
  }

  public getKeyId(): string {
    return this.keyId;
  }
}