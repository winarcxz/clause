export interface ProviderErrorOptions {
  code: string;
  message: string;
  retryable: boolean;
  providerRequestId?: string;
  cause?: unknown;
}

export class ProviderError extends Error {
  readonly code: string;
  readonly retryable: boolean;
  readonly providerRequestId?: string;
  override readonly cause?: unknown;

  constructor(options: ProviderErrorOptions) {
    super(options.message);
    this.name = "ProviderError";
    this.code = options.code;
    this.retryable = options.retryable;
    this.providerRequestId = options.providerRequestId;
    this.cause = options.cause;
  }
}
