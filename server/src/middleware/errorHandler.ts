import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { OpenDotaError } from "../services/openDotaClient.js";
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ZodError)
    return res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: error.issues[0]?.message ?? "Invalid request.",
      },
    });
  // OpenDota's own status codes describe ITS failure, not a problem with the
  // caller's request to us - e.g. a 400 from a timed-out /explorer query
  // shouldn't be reported to our client as their bad request, and its message
  // can mention our internal call shape. Always surface this as a generic
  // upstream failure instead.
  if (error instanceof OpenDotaError) {
    console.error(error);
    return res.status(502).json({
      error: {
        code: "OPENDOTA_UNAVAILABLE",
        message: "The Dota data service is temporarily unavailable. Please try again.",
      },
    });
  }
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
