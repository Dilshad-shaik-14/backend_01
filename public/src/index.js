import { app } from "./app.js";
import serverless from "serverless-http";

// Export for Vercel
export const handler = serverless(app);

// Run locally (only if not in serverless environment)
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
  });
}
