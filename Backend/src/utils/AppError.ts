export type ValidationErrorDetail = {
  path: (string | number)[];
  message: string;
  code: string;
};

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;
  public errors?: ValidationErrorDetail[];

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    errors?: ValidationErrorDetail[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;

    Error.captureStackTrace(this, this.constructor);
  }

  static validationFailed(errors: ValidationErrorDetail[]): AppError {
    return new AppError('Validation failed', 400, true, errors);
  }
}
