import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message ?? "Invalid request.",
      },
    });
  const status =
    typeof error === "object" && error && "status" in error && typeof error.status === "number"
      ? error.status
      : 500;
  const code =
    typeof error === "object" && error && "code" in error && typeof error.code === "string"
      ? error.code
      : "INTERNAL_ERROR";
  if (status >= 500) console.error(error);
  res.status(status).json({
    error: {
      code,
      message:
        status >= 500
          ? "An unexpected error occurred."
          : error instanceof Error
            ? error.message
            : "Request failed.",
    },
  });
};
