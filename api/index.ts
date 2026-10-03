import app from "../server";

/**
 * Vercel Serverless Function entry point.
 * Forwards all incoming HTTP requests directly to the configured Express application.
 */
export default function handler(req: any, res: any) {
  return app(req, res);
}
