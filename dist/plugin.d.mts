import { PluginContext } from "emdash/plugin";

//#region src/plugin.d.ts
/**
 * Normalize a path or full URL to a Workers Caching path prefix.
 * Kept in the plugin so UI validation works even against older hosts.
 */
declare function normalizePathPrefix(raw: string): {
  ok: true;
  path: string;
} | {
  ok: false;
  message: string;
};
declare const plugin: {
  routes: {
    admin: {
      handler: (routeCtx: {
        input: unknown;
      }, ctx: PluginContext) => Promise<{
        toast?: {
          message: string;
          type: "success" | "error" | "info";
        } | undefined;
        blocks: Record<string, unknown>[];
      }>;
    };
  };
};
//#endregion
export { plugin as default, normalizePathPrefix };