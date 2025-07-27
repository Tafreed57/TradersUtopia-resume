export class StripeServiceError extends Error {
  constructor(
    message: string,
    public stripeErrorType?: string,
    public stripeErrorCode?: string,
    public originalMessage?: string
  ) {
    super(message);
    this.name = 'StripeServiceError';
  }
}

export class StripeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StripeConfigError';
  }
}
