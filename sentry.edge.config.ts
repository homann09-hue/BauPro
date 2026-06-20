import * as Sentry from "@sentry/nextjs";
import { sentryBaseConfig } from "@/lib/monitoring/sentry";

const options = sentryBaseConfig();

if (options.dsn) {
  Sentry.init({
    ...options
  });
}
