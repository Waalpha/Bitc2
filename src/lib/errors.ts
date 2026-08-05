export class AppError extends Error {
  public code: string;
  public status: number;
  public details?: any;

  constructor(message: string, code = 'APP_ERROR', status = 500, details?: any) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class FirestoreError extends AppError {
  public path?: string;
  public operation?: string;

  constructor(message: string, path?: string, operation?: string, details?: any) {
    super(message, 'FIRESTORE_ERROR', 500, details);
    this.name = 'FirestoreError';
    this.path = path;
    this.operation = operation;
  }
}

export class ValidationError extends AppError {
  public validationErrors: Record<string, string>;

  constructor(message: string, validationErrors: Record<string, string> = {}) {
    super(message, 'VALIDATION_ERROR', 400, validationErrors);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
  }
}

export class PermissionError extends AppError {
  public requiredPermission?: string;

  constructor(message = 'Access Denied: Missing required permission', requiredPermission?: string) {
    super(message, 'PERMISSION_DENIED', 403, { requiredPermission });
    this.name = 'PermissionError';
    this.requiredPermission = requiredPermission;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'User is not authenticated') {
    super(message, 'AUTH_REQUIRED', 401);
    this.name = 'AuthenticationError';
  }
}

export function handleAppError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }
  if (error instanceof Error) {
    return new AppError(error.message, 'UNKNOWN_ERROR', 500, { originalError: error.stack });
  }
  return new AppError('An unexpected error occurred', 'UNKNOWN_ERROR', 500, { originalError: String(error) });
}
