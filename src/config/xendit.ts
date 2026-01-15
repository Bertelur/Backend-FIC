import { Xendit } from 'xendit-node';

let xenditClient: Xendit | null = null;

function getXenditClient(): Xendit {
  if (!xenditClient) {
    const secretKey = process.env.XENDIT_SECRET_KEY;
    
    if (!secretKey) {
      throw new Error('XENDIT_SECRET_KEY is not set in environment variables');
    }

    if (!secretKey.startsWith('xnd_')) {
      throw new Error('Invalid XENDIT_SECRET_KEY format. Secret key must start with "xnd_"');
    }

    xenditClient = new Xendit({
      secretKey,
    });
  }

  return xenditClient;
}

export function getInvoice() {
  return getXenditClient().Invoice;
}

export function getPaymentRequest() {
  return getXenditClient().PaymentRequest;
}

export default getXenditClient;
