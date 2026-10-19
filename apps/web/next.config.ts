import type { NextConfig } from "next";
import {
  PHASE_PRODUCTION_BUILD,
  PHASE_PRODUCTION_SERVER,
} from "next/constants";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
};

const configForPhase = (phase: string): NextConfig => {
  if (
    (phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER) &&
    process.env.NEXT_PUBLIC_AUTH_MODE === "fake"
  ) {
    throw new Error(
      "NEXT_PUBLIC_AUTH_MODE=fake is not allowed in a production build",
    );
  }
  return config;
};

export default configForPhase;
