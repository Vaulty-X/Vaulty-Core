import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/AppError';
import { redact, redactError } from '../utils/redact';

export const errorHandler = (
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  void req;
  void next;

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      success: false,
      message: redact(err.message),
      ...(err.errors && {
        errors: err.errors.map((e) => ({
          ...e,
          message: redact(e.message),
        })),
      }),
      ...(process.env.NODE_ENV === 'development' && { stack: redact(err.stack || '') }),
    });
    return;
  }

  // Handle unexpected errors
  console.error('Unexpected error:', redactError(err));
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: redact(err.stack || '') }),
  });
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
  });
};
