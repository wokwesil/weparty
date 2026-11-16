export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

export const notFound = (what = "Not found") => new AppError(404, what, "not_found");
export const forbidden = (why = "You don't have permission to do that.") => new AppError(403, why, "forbidden");
export const badRequest = (why: string, code = "bad_request") => new AppError(400, why, code);
export const unauthorized = (why = "Please sign in.") => new AppError(401, why, "unauthorized");
