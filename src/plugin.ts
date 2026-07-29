/**
 * Troubleshooting — sandboxed plugin
 *
 * Admin page for resolving EmDash runtime issues (object cache today;
 * more actions over time). Object-cache clear uses the host `cache:purge`
 * capability (`ctx.cache.purgeObjectCache` / `getObjectCacheStatus`).
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

async function getConfigured(ctx: PluginContext): Promise<boolean> {
	if (!ctx.cache) return false;
	try {
		const status = await ctx.cache.getObjectCacheStatus();
		return status.configured;
	} catch {
		return false;
	}
}

function clearButton(configured: boolean) {
	if (configured) {
		return {
			type: "button",
			label: "Clear object cache",
			action_id: "purge_object_cache",
			style: "primary",
		};
	}
	// Secondary + disabled greys out more clearly than a faded primary.
	return {
		type: "button",
		label: "Clear object cache",
		action_id: "purge_object_cache",
		style: "secondary",
		disabled: true,
		title: "Object Cache Not Configured",
	};
}

function renderTroubleshooting(
	configured: boolean,
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
				elements: [clearButton(configured)],
			},
		],
		...(options?.toast ? { toast: options.toast } : {}),
	};
}

async function purgeObjectCache(ctx: PluginContext) {
	const configured = await getConfigured(ctx);

	if (!ctx.cache || !configured) {
		return renderTroubleshooting(false, {
			toast: { message: "Object Cache Not Configured", type: "error" },
		});
	}

	try {
		const result = await ctx.cache.purgeObjectCache();
		const count = result.purged.length;
		const ns = count === 1 ? "namespace" : "namespaces";

		return renderTroubleshooting(true, {
			toast: {
				message: `Object cache cleared (${count} ${ns})`,
				type: "success",
			},
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : "Unknown error";
		ctx.log.error("Object cache purge failed", error);
		return renderTroubleshooting(configured, {
			toast: { message: `Object cache purge failed: ${message}`, type: "error" },
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

				return { blocks: [] };
			},
		},
	},
} satisfies SandboxedPlugin;

export default plugin;
