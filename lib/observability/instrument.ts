/**
 * Side-effect module that starts Sentry, and nothing else.
 *
 * It exists because `import` statements are hoisted: calling `initSentry()`
 * between the imports of `server.ts` would run it *after* `next` and the socket
 * server had already been evaluated, and the SDK's auto-instrumentation only
 * wraps `http`/`pg`/`undici` if it loads before they do. A bare
 * `import "./lib/observability/instrument"` as the first line of the entrypoint
 * is the one form that reliably runs first, because ESM evaluates imported
 * modules in the order their import statements appear.
 *
 * Keep this file to a single import and a single call — anything else added
 * here would load before the instrumentation is in place.
 */
import { initSentry } from "./sentry";

initSentry();
