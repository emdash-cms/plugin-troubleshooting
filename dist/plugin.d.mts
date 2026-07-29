import { PluginContext } from "emdash/plugin";

//#region src/plugin.d.ts
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
        blocks: ({
          type: string;
          text: string;
          elements?: undefined;
        } | {
          type: string;
          text?: undefined;
          elements?: undefined;
        } | {
          type: string;
          elements: ({
            type: string;
            label: string;
            action_id: string;
            style: string;
            disabled?: undefined;
            title?: undefined;
          } | {
            type: string;
            label: string;
            action_id: string;
            style: string;
            disabled: boolean;
            title: string;
          })[];
          text?: undefined;
        })[];
      }>;
    };
  };
};
//#endregion
export { plugin as default };