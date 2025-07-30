export class ServiceError extends Error {
  constructor(
    message: string,
    public originalError?: any
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}

export class DatabaseError extends ServiceError {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class ValidationError extends ServiceError {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}
