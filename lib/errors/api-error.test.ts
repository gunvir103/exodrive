import { test, expect, describe, beforeEach } from "bun:test";
import { ApiError, ErrorCodes, errors } from "./api-error";

describe("ApiError", () => {
  describe("constructor", () => {
    test("should create an error with all properties", () => {
      const error = new ApiError(
        ErrorCodes.INVALID_REQUEST,
        "Bad request",
        400,
        { field: "email", reason: "invalid format" }
      );

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ApiError);
      expect(error.name).toBe("ApiError");
      expect(error.code).toBe(ErrorCodes.INVALID_REQUEST);
      expect(error.message).toBe("Bad request");
      expect(error.status).toBe(400);
      expect(error.details).toEqual({ field: "email", reason: "invalid format" });
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test("should create an error without details", () => {
      const error = new ApiError(
        ErrorCodes.UNAUTHORIZED,
        "Unauthorized access",
        401
      );

      expect(error.code).toBe(ErrorCodes.UNAUTHORIZED);
      expect(error.message).toBe("Unauthorized access");
      expect(error.status).toBe(401);
      expect(error.details).toBeUndefined();
    });

    test("should have proper stack trace", () => {
      const error = new ApiError(
        ErrorCodes.INTERNAL_ERROR,
        "Server error",
        500
      );

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain("ApiError");
      expect(error.stack).toContain("api-error.test.ts");
    });
  });

  describe("toJSON", () => {
    test("should serialize error to JSON format", () => {
      const error = new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        "Validation failed",
        400,
        { fields: ["email", "password"] }
      );

      const json = error.toJSON();

      expect(json).toEqual({
        code: ErrorCodes.VALIDATION_ERROR,
        message: "Validation failed",
        details: { fields: ["email", "password"] },
        timestamp: error.timestamp,
      });

      // Ensure traceId is not included
      expect(json).not.toHaveProperty("traceId");
    });

    test("should serialize error without details", () => {
      const error = new ApiError(
        ErrorCodes.NOT_FOUND,
        "Resource not found",
        404
      );

      const json = error.toJSON();

      expect(json).toEqual({
        code: ErrorCodes.NOT_FOUND,
        message: "Resource not found",
        details: undefined,
        timestamp: error.timestamp,
      });
    });
  });

  describe("ErrorCodes", () => {
    test("should have all client error codes", () => {
      expect(ErrorCodes.INVALID_REQUEST).toBe("INVALID_REQUEST");
      expect(ErrorCodes.UNAUTHORIZED).toBe("UNAUTHORIZED");
      expect(ErrorCodes.FORBIDDEN).toBe("FORBIDDEN");
      expect(ErrorCodes.NOT_FOUND).toBe("NOT_FOUND");
      expect(ErrorCodes.CONFLICT).toBe("CONFLICT");
      expect(ErrorCodes.RATE_LIMITED).toBe("RATE_LIMITED");
      expect(ErrorCodes.VALIDATION_ERROR).toBe("VALIDATION_ERROR");
    });

    test("should have all server error codes", () => {
      expect(ErrorCodes.INTERNAL_ERROR).toBe("INTERNAL_ERROR");
      expect(ErrorCodes.DATABASE_ERROR).toBe("DATABASE_ERROR");
      expect(ErrorCodes.EXTERNAL_SERVICE_ERROR).toBe("EXTERNAL_SERVICE_ERROR");
      expect(ErrorCodes.CACHE_ERROR).toBe("CACHE_ERROR");
    });
  });

  describe("error factory functions", () => {
    describe("badRequest", () => {
      test("should create bad request error with details", () => {
        const error = errors.badRequest("Invalid input", { field: "age" });

        expect(error.code).toBe(ErrorCodes.INVALID_REQUEST);
        expect(error.message).toBe("Invalid input");
        expect(error.status).toBe(400);
        expect(error.details).toEqual({ field: "age" });
      });

      test("should create bad request error without details", () => {
        const error = errors.badRequest("Invalid input");

        expect(error.code).toBe(ErrorCodes.INVALID_REQUEST);
        expect(error.message).toBe("Invalid input");
        expect(error.status).toBe(400);
        expect(error.details).toBeUndefined();
      });
    });

    describe("unauthorized", () => {
      test("should create unauthorized error with default message", () => {
        const error = errors.unauthorized();

        expect(error.code).toBe(ErrorCodes.UNAUTHORIZED);
        expect(error.message).toBe("Unauthorized");
        expect(error.status).toBe(401);
      });

      test("should create unauthorized error with custom message", () => {
        const error = errors.unauthorized("Invalid token");

        expect(error.code).toBe(ErrorCodes.UNAUTHORIZED);
        expect(error.message).toBe("Invalid token");
        expect(error.status).toBe(401);
      });
    });

    describe("forbidden", () => {
      test("should create forbidden error with default message", () => {
        const error = errors.forbidden();

        expect(error.code).toBe(ErrorCodes.FORBIDDEN);
        expect(error.message).toBe("Forbidden");
        expect(error.status).toBe(403);
      });

      test("should create forbidden error with custom message", () => {
        const error = errors.forbidden("Access denied");

        expect(error.code).toBe(ErrorCodes.FORBIDDEN);
        expect(error.message).toBe("Access denied");
        expect(error.status).toBe(403);
      });
    });

    describe("notFound", () => {
      test("should create not found error", () => {
        const error = errors.notFound("User");

        expect(error.code).toBe(ErrorCodes.NOT_FOUND);
        expect(error.message).toBe("User not found");
        expect(error.status).toBe(404);
      });
    });

    describe("conflict", () => {
      test("should create conflict error with details", () => {
        const error = errors.conflict("Email already exists", { email: "test@example.com" });

        expect(error.code).toBe(ErrorCodes.CONFLICT);
        expect(error.message).toBe("Email already exists");
        expect(error.status).toBe(409);
        expect(error.details).toEqual({ email: "test@example.com" });
      });

      test("should create conflict error without details", () => {
        const error = errors.conflict("Resource conflict");

        expect(error.code).toBe(ErrorCodes.CONFLICT);
        expect(error.message).toBe("Resource conflict");
        expect(error.status).toBe(409);
        expect(error.details).toBeUndefined();
      });
    });

    describe("rateLimited", () => {
      test("should create rate limited error with retry after", () => {
        const error = errors.rateLimited(60);

        expect(error.code).toBe(ErrorCodes.RATE_LIMITED);
        expect(error.message).toBe("Too many requests, please try again later");
        expect(error.status).toBe(429);
        expect(error.details).toEqual({ retryAfter: 60 });
      });

      test("should create rate limited error without retry after", () => {
        const error = errors.rateLimited();

        expect(error.code).toBe(ErrorCodes.RATE_LIMITED);
        expect(error.message).toBe("Too many requests, please try again later");
        expect(error.status).toBe(429);
        expect(error.details).toEqual({ retryAfter: undefined });
      });
    });

    describe("validationError", () => {
      test("should create validation error", () => {
        const validationErrors = {
          email: "Invalid email format",
          password: "Password too short",
        };
        const error = errors.validationError("Validation failed", validationErrors);

        expect(error.code).toBe(ErrorCodes.VALIDATION_ERROR);
        expect(error.message).toBe("Validation failed");
        expect(error.status).toBe(400);
        expect(error.details).toEqual(validationErrors);
      });
    });

    describe("internalError", () => {
      test("should create internal error with default message", () => {
        const error = errors.internalError();

        expect(error.code).toBe(ErrorCodes.INTERNAL_ERROR);
        expect(error.message).toBe("An unexpected error occurred");
        expect(error.status).toBe(500);
      });

      test("should create internal error with custom message", () => {
        const error = errors.internalError("Server crashed");

        expect(error.code).toBe(ErrorCodes.INTERNAL_ERROR);
        expect(error.message).toBe("Server crashed");
        expect(error.status).toBe(500);
      });
    });

    describe("databaseError", () => {
      test("should create database error with default message", () => {
        const error = errors.databaseError();

        expect(error.code).toBe(ErrorCodes.DATABASE_ERROR);
        expect(error.message).toBe("Database operation failed");
        expect(error.status).toBe(500);
      });

      test("should create database error with custom message", () => {
        const error = errors.databaseError("Connection timeout");

        expect(error.code).toBe(ErrorCodes.DATABASE_ERROR);
        expect(error.message).toBe("Connection timeout");
        expect(error.status).toBe(500);
      });
    });

    describe("externalServiceError", () => {
      test("should create external service error with default message", () => {
        const error = errors.externalServiceError("PaymentAPI");

        expect(error.code).toBe(ErrorCodes.EXTERNAL_SERVICE_ERROR);
        expect(error.message).toBe("External service error: PaymentAPI");
        expect(error.status).toBe(502);
      });

      test("should create external service error with custom message", () => {
        const error = errors.externalServiceError("PaymentAPI", "Payment gateway timeout");

        expect(error.code).toBe(ErrorCodes.EXTERNAL_SERVICE_ERROR);
        expect(error.message).toBe("Payment gateway timeout");
        expect(error.status).toBe(502);
      });
    });

    describe("cacheError", () => {
      test("should create cache error with default message", () => {
        const error = errors.cacheError();

        expect(error.code).toBe(ErrorCodes.CACHE_ERROR);
        expect(error.message).toBe("Cache operation failed");
        expect(error.status).toBe(500);
      });

      test("should create cache error with custom message", () => {
        const error = errors.cacheError("Redis connection lost");

        expect(error.code).toBe(ErrorCodes.CACHE_ERROR);
        expect(error.message).toBe("Redis connection lost");
        expect(error.status).toBe(500);
      });
    });
  });

  describe("ErrorResponse interface", () => {
    test("should match expected structure", () => {
      const error = new ApiError(
        ErrorCodes.INVALID_REQUEST,
        "Test error",
        400,
        { test: true }
      );

      const errorResponse = {
        error: {
          code: error.code,
          message: error.message,
          details: error.details,
          timestamp: error.timestamp,
          traceId: "test-trace-id",
        },
        status: error.status,
      };

      // Type check - this should compile without errors
      const response: import("./api-error").ErrorResponse = errorResponse;

      expect(response.error.code).toBe(ErrorCodes.INVALID_REQUEST);
      expect(response.error.message).toBe("Test error");
      expect(response.error.details).toEqual({ test: true });
      expect(response.error.timestamp).toBe(error.timestamp);
      expect(response.error.traceId).toBe("test-trace-id");
      expect(response.status).toBe(400);
    });
  });

  describe("edge cases", () => {
    test("should handle very long error messages", () => {
      const longMessage = "A".repeat(1000);
      const error = new ApiError(ErrorCodes.INTERNAL_ERROR, longMessage, 500);

      expect(error.message).toBe(longMessage);
      expect(error.message.length).toBe(1000);
    });

    test("should handle complex details objects", () => {
      const complexDetails = {
        nested: {
          deep: {
            value: "test",
            array: [1, 2, 3],
          },
        },
        date: new Date(),
        null: null,
        undefined: undefined,
      };

      const error = new ApiError(
        ErrorCodes.VALIDATION_ERROR,
        "Complex error",
        400,
        complexDetails
      );

      expect(error.details).toEqual(complexDetails);
    });

    test("should maintain error instance properties", () => {
      const error = new ApiError(ErrorCodes.NOT_FOUND, "Not found", 404);

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ApiError).toBe(true);
      expect(error.constructor).toBe(ApiError);
      expect(error.toString()).toContain("ApiError: Not found");
    });
  });
});