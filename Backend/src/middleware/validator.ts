import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError, ZodIssue } from 'zod';
import { AppError, ValidationErrorDetail } from '../utils/AppError';

const toValidationErrors = (zodError: ZodError): ValidationErrorDetail[] =>
  zodError.issues.map(formatZodIssue);

const formatZodIssue = (issue: ZodIssue): ValidationErrorDetail => ({
  path: issue.path as (string | number)[],
  message: issue.message,
  code: issue.code,
});

export const validate = (schema: ZodSchema) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      // Assign parsed/transformed output so email/phone canonicalization reaches controllers
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(AppError.validationFailed(toValidationErrors(error)));
        return;
      }

      next(error);
    }
  };
};
