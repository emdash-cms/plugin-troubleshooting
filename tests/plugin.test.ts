import { describe, expect, it, vi } from "vitest";

import plugin, { normalizePathPrefix } from "../src/plugin.js";

describe("normalizePathPrefix", () => {
	it("normalizes paths and URLs", () => {
		expect(normalizePathPrefix("/posts/a")).toEqual({ ok: true, path: "/posts/a" });
		expect(normalizePathPrefix("posts/a")).toEqual({ ok: true, path: "/posts/a" });
		expect(normalizePathPrefix("https://ex.com/posts/a?x=1")).toEqual({
			ok: true,
			path: "/posts/a",
		});
	});

	it("rejects empty", () => {
		expect(normalizePathPrefix("")).toMatchObject({ ok: false });
	});

	it("rejects protocol-relative URLs", () => {
		expect(normalizePathPrefix("//example.com/posts")).toEqual({
			ok: false,
			message: "Protocol-relative URLs are not allowed",
		});
	});
});

describe("admin route", () => {
	it("renders form sections when caches are configured", async () => {
		const result = (await callAdmin(
			{ type: "page_load", page: "/" },
			{
				cache: {
					getObjectCacheStatus: vi.fn().mockResolvedValue({ configured: true }),
					getWorkersCacheStatus: vi.fn().mockResolvedValue({ configured: true }),
					purgeObjectCache: vi.fn(),
					purgeWorkersCache: vi.fn(),
				},
			},
		)) as {
			blocks: Array<{ type: string; block_id?: string; submit?: { action_id: string } }>;
		};

		const forms = result.blocks.filter((b) => b.type === "form");
		expect(forms.map((f) => f.block_id)).toEqual([
			"object-cache",
			"workers-cache-all",
			"workers-cache-path",
		]);
		expect(forms[2]?.submit?.action_id).toBe("purge_workers_cache_path");
	});

	it("shows banners when caches are not configured", async () => {
		const result = (await callAdmin({ type: "page_load", page: "/" })) as {
			blocks: Array<{ type: string; title?: string }>;
		};
		const banners = result.blocks.filter((b) => b.type === "banner");
		expect(banners.some((b) => b.title === "Object Cache Not Configured")).toBe(true);
		expect(banners.some((b) => b.title === "Workers Cache Not Available")).toBe(true);
	});

	it("purges object cache on form submit", async () => {
		const purgeObjectCache = vi.fn().mockResolvedValue({
			configured: true,
			active: true,
			purged: ["settings", "menus"],
		});
		const result = (await callAdmin(
			{ type: "form_submit", action_id: "purge_object_cache", values: {} },
			{
				cache: {
					getObjectCacheStatus: vi.fn().mockResolvedValue({ configured: true }),
					getWorkersCacheStatus: vi.fn().mockResolvedValue({ configured: false }),
					purgeObjectCache,
					purgeWorkersCache: vi.fn(),
				},
			},
		)) as { toast?: { message: string; type: string } };

		expect(purgeObjectCache).toHaveBeenCalledOnce();
		expect(result.toast).toEqual({
			message: "Object cache cleared (2 namespaces)",
			type: "success",
		});
	});

	it("purges all Workers Cache on form submit", async () => {
		const purgeWorkersCache = vi.fn().mockResolvedValue({ configured: true, purged: true });
		const result = (await callAdmin(
			{ type: "form_submit", action_id: "purge_workers_cache", values: {} },
			{
				cache: {
					getObjectCacheStatus: vi.fn().mockResolvedValue({ configured: false }),
					getWorkersCacheStatus: vi.fn().mockResolvedValue({ configured: true }),
					purgeObjectCache: vi.fn(),
					purgeWorkersCache,
				},
			},
		)) as { toast?: { message: string; type: string } };

		expect(purgeWorkersCache).toHaveBeenCalledWith();
		expect(result.toast).toEqual({
			message: "Workers Cache cleared",
			type: "success",
		});
	});

	it("purges a path prefix from form values", async () => {
		const purgeWorkersCache = vi.fn().mockResolvedValue({
			configured: true,
			purged: true,
			pathPrefixes: ["/posts/hello"],
		});
		const result = (await callAdmin(
			{
				type: "form_submit",
				action_id: "purge_workers_cache_path",
				values: { path: "https://example.com/posts/hello?x=1" },
			},
			{
				cache: {
					getObjectCacheStatus: vi.fn().mockResolvedValue({ configured: false }),
					getWorkersCacheStatus: vi.fn().mockResolvedValue({ configured: true }),
					purgeObjectCache: vi.fn(),
					purgeWorkersCache,
				},
			},
		)) as { toast?: { message: string; type: string } };

		expect(purgeWorkersCache).toHaveBeenCalledWith({ pathPrefixes: ["/posts/hello"] });
		expect(result.toast).toEqual({
			message: "Workers Cache cleared for /posts/hello",
			type: "success",
		});
	});

	it("toasts on empty path", async () => {
		const purgeWorkersCache = vi.fn();
		const result = (await callAdmin(
			{
				type: "form_submit",
				action_id: "purge_workers_cache_path",
				values: { path: "  " },
			},
			{
				cache: {
					getObjectCacheStatus: vi.fn().mockResolvedValue({ configured: false }),
					getWorkersCacheStatus: vi.fn().mockResolvedValue({ configured: true }),
					purgeObjectCache: vi.fn(),
					purgeWorkersCache,
				},
			},
		)) as { toast?: { message: string; type: string } };

		expect(purgeWorkersCache).not.toHaveBeenCalled();
		expect(result.toast?.type).toBe("error");
		expect(result.toast?.message).toBe("Path is required");
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
	input: {
		type: string;
		page?: string;
		action_id?: string;
		values?: Record<string, unknown>;
	},
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
		plugin: { id: "troubleshooting", version: "0.1.2" },
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
