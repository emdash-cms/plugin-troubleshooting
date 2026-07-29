import { describe, expect, it, vi } from "vitest";

import plugin from "../src/plugin.js";

describe("admin route", () => {
	it("disables the clear button when object cache is not configured", async () => {
		const getObjectCacheStatus = vi.fn().mockResolvedValue({ configured: false });
		const result = (await callAdmin(
			{ type: "page_load", page: "/" },
			{ cache: { getObjectCacheStatus, purgeObjectCache: vi.fn() } },
		)) as {
			blocks: Array<{
				type: string;
				text?: string;
				elements?: Array<Record<string, unknown>>;
			}>;
		};

		expect(getObjectCacheStatus).toHaveBeenCalledOnce();
		expect(result.blocks.some((b) => b.type === "section" && b.text?.startsWith("Status:"))).toBe(
			false,
		);
		const actions = result.blocks.find((b) => b.type === "actions");
		expect(actions?.elements?.[0]).toMatchObject({
			type: "button",
			label: "Clear object cache",
			action_id: "purge_object_cache",
			style: "secondary",
			disabled: true,
			title: "Object Cache Not Configured",
		});
	});

	it("enables the clear button when object cache is configured", async () => {
		const getObjectCacheStatus = vi.fn().mockResolvedValue({ configured: true });
		const result = (await callAdmin(
			{ type: "page_load", page: "/" },
			{ cache: { getObjectCacheStatus, purgeObjectCache: vi.fn() } },
		)) as {
			blocks: Array<{
				type: string;
				elements?: Array<Record<string, unknown>>;
			}>;
		};

		const actions = result.blocks.find((b) => b.type === "actions");
		expect(actions?.elements?.[0]).toMatchObject({
			type: "button",
			label: "Clear object cache",
			action_id: "purge_object_cache",
			style: "primary",
		});
		expect(actions?.elements?.[0]).not.toHaveProperty("disabled");
		expect(actions?.elements?.[0]).not.toHaveProperty("title");
	});

	it("purges object cache on button action when configured", async () => {
		const purgeObjectCache = vi.fn().mockResolvedValue({
			configured: true,
			active: true,
			purged: ["settings", "menus", "content:posts"],
		});
		const getObjectCacheStatus = vi.fn().mockResolvedValue({ configured: true });
		const result = (await callAdmin(
			{ type: "block_action", action_id: "purge_object_cache" },
			{ cache: { purgeObjectCache, getObjectCacheStatus } },
		)) as {
			toast?: { type: string; message: string };
		};

		expect(purgeObjectCache).toHaveBeenCalledOnce();
		expect(result.toast).toEqual({
			message: "Object cache cleared (3 namespaces)",
			type: "success",
		});
	});

	it("returns empty blocks for unknown pages", async () => {
		const result = await callAdmin({ type: "page_load", page: "/unknown" });
		expect(result).toEqual({ blocks: [] });
	});

	it("shows the shenanigans subtitle", async () => {
		const result = (await callAdmin({ type: "page_load", page: "/" })) as {
			blocks: Array<{ type: string; text?: string }>;
		};
		expect(result.blocks.some((b) => b.type === "context" && b.text === "Resolve EmDash shenanigans")).toBe(
			true,
		);
	});
});

async function callAdmin(
	input: { type: string; page?: string; action_id?: string },
	ctxOverrides: Record<string, unknown> = {},
) {
	const handler = plugin.routes?.admin;
	if (!handler || typeof handler !== "object" || !("handler" in handler)) {
		throw new Error("admin route handler not found");
	}
	return handler.handler({ input } as never, makeTestContext(ctxOverrides));
}

function makeTestContext(overrides: Record<string, unknown> = {}) {
	return {
		plugin: { id: "troubleshooting", version: "0.1.0" },
		log: {
			info: () => {},
			warn: () => {},
			error: () => {},
			debug: () => {},
		},
		cache: {
			getObjectCacheStatus: async () => ({ configured: false }),
			purgeObjectCache: async () => ({ configured: false, active: false, purged: [] }),
		},
		...overrides,
	} as unknown as import("emdash").PluginContext;
}
