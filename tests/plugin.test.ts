import { describe, expect, it, vi } from "vitest";

import plugin from "../src/plugin.js";

describe("admin route", () => {
	it("disables clear buttons when caches are not configured", async () => {
		const getObjectCacheStatus = vi.fn().mockResolvedValue({ configured: false });
		const getWorkersCacheStatus = vi.fn().mockResolvedValue({ configured: false });
		const result = (await callAdmin(
			{ type: "page_load", page: "/" },
			{
				cache: {
					getObjectCacheStatus,
					getWorkersCacheStatus,
					purgeObjectCache: vi.fn(),
					purgeWorkersCache: vi.fn(),
				},
			},
		)) as {
			blocks: Array<{
				type: string;
				text?: string;
				elements?: Array<Record<string, unknown>>;
			}>;
		};

		expect(getObjectCacheStatus).toHaveBeenCalledOnce();
		expect(getWorkersCacheStatus).toHaveBeenCalledOnce();
		const actionBlocks = result.blocks.filter((b) => b.type === "actions");
		expect(actionBlocks).toHaveLength(2);
		expect(actionBlocks[0]?.elements?.[0]).toMatchObject({
			type: "button",
			label: "Clear object cache",
			action_id: "purge_object_cache",
			style: "secondary",
			disabled: true,
			title: "Object Cache Not Configured",
		});
		expect(actionBlocks[1]?.elements?.[0]).toMatchObject({
			type: "button",
			label: "Clear Workers Cache",
			action_id: "purge_workers_cache",
			style: "secondary",
			disabled: true,
			title: "Workers Cache Not Configured",
		});
	});

	it("enables clear buttons when caches are configured", async () => {
		const getObjectCacheStatus = vi.fn().mockResolvedValue({ configured: true });
		const getWorkersCacheStatus = vi.fn().mockResolvedValue({ configured: true });
		const result = (await callAdmin(
			{ type: "page_load", page: "/" },
			{
				cache: {
					getObjectCacheStatus,
					getWorkersCacheStatus,
					purgeObjectCache: vi.fn(),
					purgeWorkersCache: vi.fn(),
				},
			},
		)) as {
			blocks: Array<{
				type: string;
				elements?: Array<Record<string, unknown>>;
			}>;
		};

		const actionBlocks = result.blocks.filter((b) => b.type === "actions");
		expect(actionBlocks[0]?.elements?.[0]).toMatchObject({
			type: "button",
			label: "Clear object cache",
			action_id: "purge_object_cache",
			style: "primary",
		});
		expect(actionBlocks[0]?.elements?.[0]).not.toHaveProperty("disabled");
		expect(actionBlocks[1]?.elements?.[0]).toMatchObject({
			type: "button",
			label: "Clear Workers Cache",
			action_id: "purge_workers_cache",
			style: "primary",
		});
		expect(actionBlocks[1]?.elements?.[0]).not.toHaveProperty("disabled");
	});

	it("purges object cache on button action when configured", async () => {
		const purgeObjectCache = vi.fn().mockResolvedValue({
			configured: true,
			active: true,
			purged: ["settings", "menus", "content:posts"],
		});
		const getObjectCacheStatus = vi.fn().mockResolvedValue({ configured: true });
		const getWorkersCacheStatus = vi.fn().mockResolvedValue({ configured: false });
		const result = (await callAdmin(
			{ type: "block_action", action_id: "purge_object_cache" },
			{
				cache: {
					purgeObjectCache,
					getObjectCacheStatus,
					getWorkersCacheStatus,
					purgeWorkersCache: vi.fn(),
				},
			},
		)) as {
			toast?: { type: string; message: string };
		};

		expect(purgeObjectCache).toHaveBeenCalledOnce();
		expect(result.toast).toEqual({
			message: "Object cache cleared (3 namespaces)",
			type: "success",
		});
	});

	it("purges Workers Cache on button action when configured", async () => {
		const purgeWorkersCache = vi.fn().mockResolvedValue({
			configured: true,
			purged: true,
		});
		const getObjectCacheStatus = vi.fn().mockResolvedValue({ configured: false });
		const getWorkersCacheStatus = vi.fn().mockResolvedValue({ configured: true });
		const result = (await callAdmin(
			{ type: "block_action", action_id: "purge_workers_cache" },
			{
				cache: {
					purgeWorkersCache,
					getObjectCacheStatus,
					getWorkersCacheStatus,
					purgeObjectCache: vi.fn(),
				},
			},
		)) as {
			toast?: { type: string; message: string };
		};

		expect(purgeWorkersCache).toHaveBeenCalledOnce();
		expect(result.toast).toEqual({
			message: "Workers Cache cleared",
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
		expect(
			result.blocks.some((b) => b.type === "context" && b.text === "Resolve EmDash shenanigans"),
		).toBe(true);
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
			getWorkersCacheStatus: async () => ({ configured: false }),
			purgeWorkersCache: async () => ({ configured: false, purged: false }),
		},
		...overrides,
	} as unknown as import("emdash").PluginContext;
}
