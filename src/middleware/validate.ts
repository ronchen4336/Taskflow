import { Request, Response, NextFunction } from "express";

type FieldType = "string" | "number" | "boolean" | "email";

interface SchemaDefinition {
  body?: Record<string, FieldType>;
  query?: Record<string, FieldType>;
  params?: Record<string, FieldType>;
}

interface FieldError {
  field: string;
  message: string;
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function validateFields(
  data: Record<string, unknown>,
  schema: Record<string, FieldType>,
  source: string,
): FieldError[] {
  const errors: FieldError[] = [];

  for (const [field, expectedType] of Object.entries(schema)) {
    const value = data[field];

    if (value === undefined || value === null || value === "") {
      errors.push({ field: `${source}.${field}`, message: `${field} is required` });
      continue;
    }

    if (expectedType === "email") {
      if (typeof value !== "string") {
        errors.push({ field: `${source}.${field}`, message: `${field} must be a string` });
      } else if (!isValidEmail(value)) {
        errors.push({ field: `${source}.${field}`, message: `${field} must be a valid email address` });
      }
      continue;
    }

    if (typeof value !== expectedType) {
      errors.push({ field: `${source}.${field}`, message: `${field} must be of type ${expectedType}` });
    }
  }

  return errors;
}

export function validate(schema: SchemaDefinition) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: FieldError[] = [];

    if (schema.body) {
      errors.push(...validateFields(req.body as Record<string, unknown>, schema.body, "body"));
    }
    if (schema.query) {
      errors.push(...validateFields(req.query as Record<string, unknown>, schema.query, "query"));
    }
    if (schema.params) {
      errors.push(...validateFields(req.params as Record<string, unknown>, schema.params, "params"));
    }

    if (errors.length > 0) {
      res.status(400).json({
        error: "Validation failed",
        code: "VALIDATION_ERROR",
        details: errors,
      });
      return;
    }

    next();
  };
}
