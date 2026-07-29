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

function objectClearButton(configured: boolean) {
	if (configured) {
		return {
			type: "button",
			label: "Clear object cache",
			action_id: "purge_object_cache",
			style: "primary",
		};
	}
	return {
		type: "button",
		label: "Clear object cache",
		action_id: "purge_object_cache",
		style: "secondary",
		disabled: true,
		title: "Object Cache Not Configured",
	};
}

function workersClearButton(configured: boolean) {
	if (configured) {
		return {
			type: "button",
			label: "Clear Workers Cache",
			action_id: "purge_workers_cache",
			style: "primary",
		};
	}
	return {
		type: "button",
		label: "Clear Workers Cache",
		action_id: "purge_workers_cache",
		style: "secondary",
		disabled: true,
		title: "Workers Cache Not Available",
	};
}

function renderTroubleshooting(
	configured: CacheConfigured,
	options?: {
		toast?: { message: string; type: "success" | "error" | "info" };
	},
) {
	return {
		blocks: [
			{ type: "header", text: "Troubleshooting" },
			{ type: "context", text: "Resolve EmDash shenanigans" },
			{ type: "divider" },
			{ type: "header", text: "CMS object cache" },
			{
				type: "section",
				text: "Clears EmDash’s optional KV/memory object cache (content queries, menus, settings, taxonomies).",
			},
			{
				type: "actions",
				elements: [objectClearButton(configured.object)],
			},
			{ type: "divider" },
			{ type: "header", text: "Workers Cache" },
			{
				type: "section",
				text: "Purges native Workers Caching.",
			},
			{
				type: "actions",
				elements: [workersClearButton(configured.workers)],
			},
		],
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

async function purgeWorkersCache(ctx: PluginContext) {
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

				if (interaction.type === "block_action" && interaction.action_id === "purge_object_cache") {
					return purgeObjectCache(ctx);
				}

				if (interaction.type === "block_action" && interaction.action_id === "purge_workers_cache") {
					return purgeWorkersCache(ctx);
				}

				return { blocks: [] };
			},
		},
	},
} satisfies SandboxedPlugin;

export default plugin;
