import type { NextConfig } from "next";
import { withWorkflow } from "workflow/next";
const nextConfig: NextConfig = {
  // … rest of your Next.js config
};
export default withWorkflow(nextConfig);
