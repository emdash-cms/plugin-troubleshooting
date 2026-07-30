/**
 * Troubleshooting — sandboxed plugin
 *
 * Admin page for resolving EmDash runtime issues (object cache + Workers
 * Caching today; more actions over time). Uses the host `cache:purge`
 * capability (`ctx.cache.*`).
 */

import type { PluginContext, SandboxedPlugin } from "emdash/plugin";

interface BlockInteraction {
	type: "page_load" | "block_action" | "form_submit";
	page?: string;
	action_id?: string;
	values?: Record<string, unknown>;
}

/** Paths that render the Troubleshooting screen (root is what Plugin Manager links to). */
const TROUBLESHOOTING_PAGES = new Set(["/", "/troubleshooting"]);

interface CacheConfigured {
	object: boolean;
	workers: boolean;
}

async function getConfigured(ctx: PluginContext): Promise<CacheConfigured> {
	const out: CacheConfigured = { object: false, workers: false };
	if (!ctx.cache) return out;

	try {
		const status = await ctx.cache.getObjectCacheStatus();
		out.object = status.configured;
	} catch {
		// leave false
	}

	try {
		if (typeof ctx.cache.getWorkersCacheStatus === "function") {
			const status = await ctx.cache.getWorkersCacheStatus();
			out.workers = status.configured;
		}
	} catch {
		// leave false
	}

	return out;
}

/**
 * Normalize a path or full URL to a Workers Caching path prefix.
 * Kept in the plugin so UI validation works even against older hosts.
 */
export function normalizePathPrefix(
	raw: string,
): { ok: true; path: string } | { ok: false; message: string } {
	const trimmed = raw.trim();
	if (trimmed.startsWith("//")) {
		return { ok: false, message: "Protocol-relative URLs are not allowed" };
	}
	if (!trimmed) {
		return { ok: false, message: "Path is required" };
	}

	let path: string;
	if (/^[a-zA-Z][a-zA-Z0-9+\-.]*:\/\//.test(trimmed)) {
		try {
			const url = new URL(trimmed);
			path = url.pathname || "/";
		} catch {
			return { ok: false, message: "Invalid URL" };
		}
	} else {
		const withoutHash = trimmed.split("#")[0] ?? trimmed;
		const withoutQuery = withoutHash.split("?")[0] ?? withoutHash;
		path = withoutQuery;
	}

	if (!path.startsWith("/")) {
		path = `/${path}`;
	}
	path = path.replace(/\/{2,}/g, "/");

	if (path.length > 2048) {
		return { ok: false, message: "Path is too long" };
	}

	return { ok: true, path };
}

function renderTroubleshooting(
	configured: CacheConfigured,
	options?: {
		toast?: { message: string; type: "success" | "error" | "info" };
		pathInitial?: string;
	},
) {
	const pathInitial = options?.pathInitial ?? "";

	const blocks: Array<Record<string, unknown>> = [
		{ type: "header", text: "Troubleshooting" },
		{ type: "context", text: "Resolve EmDash shenanigans" },
		{ type: "divider" },

		// —— CMS object cache ——
		{ type: "header", text: "CMS object cache" },
		{
			type: "context",
			text: "Clears EmDash’s optional KV/memory object cache (content queries, menus, settings, taxonomies).",
		},
	];

	if (configured.object) {
		blocks.push({
			type: "form",
			block_id: "object-cache",
			fields: [],
			submit: {
				label: "Clear object cache",
				action_id: "purge_object_cache",
			},
		});
	} else {
		blocks.push({
			type: "banner",
			variant: "default",
			title: "Object Cache Not Configured",
			description: "Enable with objectCache: kvCache({ binding: \"CACHE\" }) in astro.config.",
		});
	}

	blocks.push({ type: "divider" });

	// —— Workers Cache ——
	blocks.push(
		{ type: "header", text: "Workers Cache" },
		{
			type: "context",
			text: "Purges native Workers Caching",
		},
	);

	if (configured.workers) {
		blocks.push({
			type: "form",
			block_id: "workers-cache-all",
			fields: [],
			submit: {
				label: "Clear all Workers Cache",
				action_id: "purge_workers_cache",
			},
		});
		blocks.push({
			type: "form",
			block_id: "workers-cache-path",
			fields: [
				{
					type: "text_input",
					action_id: "path",
					label: "Path or URL",
					placeholder: "/posts/hello or https://example.com/posts/hello",
					initial_value: pathInitial,
				},
			],
			submit: {
				label: "Clear path",
				action_id: "purge_workers_cache_path",
			},
		});
		blocks.push({
			type: "context",
			text: "Path purge matches prefixes (e.g. /posts/hello also clears /posts/hello-world).",
		});
	} else {
		blocks.push({
			type: "banner",
			variant: "default",
			title: "Workers Cache Not Available",
			description:
				"Requires wrangler cache.enabled and a runtime with cache.purge (production Workers).",
		});
	}

	return {
		blocks,
		...(options?.toast ? { toast: options.toast } : {}),
	};
}

async function purgeObjectCache(ctx: PluginContext) {
	const configured = await getConfigured(ctx);

	if (!ctx.cache || !configured.object) {
		return renderTroubleshooting(configured, {
			toast: { message: "Object Cache Not Configured", type: "error" },
		});
	}

	try {
		const result = await ctx.cache.purgeObjectCache();
		const count = result.purged.length;
		const ns = count === 1 ? "namespace" : "namespaces";

		return renderTroubleshooting(
			{ ...configured, object: true },
			{
				toast: {
					message: `Object cache cleared (${count} ${ns})`,
					type: "success",
				},
			},
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		ctx.log.error("Object cache purge failed", error);
		return renderTroubleshooting(configured, {
			toast: { message: `Object cache purge failed: ${message}`, type: "error" },
		});
	}
}

async function purgeWorkersCacheAll(ctx: PluginContext) {
	const configured = await getConfigured(ctx);

	if (!ctx.cache || !configured.workers || typeof ctx.cache.purgeWorkersCache !== "function") {
		return renderTroubleshooting(configured, {
			toast: { message: "Workers Cache Not Available", type: "error" },
		});
	}

	try {
		const result = await ctx.cache.purgeWorkersCache();
		if (!result.configured || !result.purged) {
			return renderTroubleshooting(
				{ ...configured, workers: false },
				{
					toast: { message: "Workers Cache Not Available", type: "error" },
				},
			);
		}

		return renderTroubleshooting(
			{ ...configured, workers: true },
			{
				toast: {
					message: "Workers Cache cleared",
					type: "success",
				},
			},
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		ctx.log.error("Workers Cache purge failed", error);
		return renderTroubleshooting(configured, {
			toast: { message: `Workers Cache purge failed: ${message}`, type: "error" },
		});
	}
}

async function purgeWorkersCachePath(ctx: PluginContext, values?: Record<string, unknown>) {
	const configured = await getConfigured(ctx);
	const raw = typeof values?.path === "string" ? values.path : "";

	if (!ctx.cache || !configured.workers || typeof ctx.cache.purgeWorkersCache !== "function") {
		return renderTroubleshooting(configured, {
			toast: { message: "Workers Cache Not Available", type: "error" },
			pathInitial: raw,
		});
	}

	const normalized = normalizePathPrefix(raw);
	if (!normalized.ok) {
		return renderTroubleshooting(configured, {
			toast: { message: normalized.message, type: "error" },
			pathInitial: raw,
		});
	}

	try {
		const result = await ctx.cache.purgeWorkersCache({
			pathPrefixes: [normalized.path],
		});
		if (!result.configured || !result.purged) {
			return renderTroubleshooting(
				{ ...configured, workers: false },
				{
					toast: { message: "Workers Cache Not Available", type: "error" },
					pathInitial: raw,
				},
			);
		}

		return renderTroubleshooting(
			{ ...configured, workers: true },
			{
				toast: {
					message: `Workers Cache cleared for ${normalized.path}`,
					type: "success",
				},
				pathInitial: normalized.path,
			},
		);
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		ctx.log.error("Workers Cache path purge failed", error);
		return renderTroubleshooting(configured, {
			toast: { message: `Workers Cache purge failed: ${message}`, type: "error" },
			pathInitial: raw,
		});
	}
}

const plugin = {
	routes: {
		admin: {
			handler: async (routeCtx: { input: unknown }, ctx: PluginContext) => {
				const interaction = routeCtx.input as BlockInteraction;

				if (
					interaction.type === "page_load" &&
					interaction.page &&
					TROUBLESHOOTING_PAGES.has(interaction.page)
				) {
					const configured = await getConfigured(ctx);
					return renderTroubleshooting(configured);
				}

				// Form submits (primary path for structured sections)
				if (interaction.type === "form_submit") {
					if (interaction.action_id === "purge_object_cache") {
						return purgeObjectCache(ctx);
					}
					if (interaction.action_id === "purge_workers_cache") {
						return purgeWorkersCacheAll(ctx);
					}
					if (interaction.action_id === "purge_workers_cache_path") {
						return purgeWorkersCachePath(ctx, interaction.values);
					}
				}

				// Back-compat block_action buttons
				if (interaction.type === "block_action" && interaction.action_id === "purge_object_cache") {
					return purgeObjectCache(ctx);
				}
				if (
					interaction.type === "block_action" &&
					interaction.action_id === "purge_workers_cache"
				) {
					return purgeWorkersCacheAll(ctx);
				}

				return { blocks: [] };
			},
		},
	},
} satisfies SandboxedPlugin;

export default plugin;
