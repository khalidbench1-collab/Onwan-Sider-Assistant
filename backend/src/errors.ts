export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function publicError(error: unknown): {
  status: number;
  body: { ok: false; error: string; message: string };
} {
  if (error instanceof ApiError) {
    return {
      status: error.status,
      body: { ok: false, error: error.code, message: error.message },
    };
  }
  return {
    status: 500,
    body: {
      ok: false,
      error: "INTERNAL",
      message: "The request could not be completed.",
    },
  };
}
