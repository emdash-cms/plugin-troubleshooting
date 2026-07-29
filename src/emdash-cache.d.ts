/**
 * Temporary augmentation until emdash ≥ 0.32.0 publishes CacheAccess on
 * PluginContext. Safe to delete once the peer dependency is satisfied by
 * a released package that already includes these types.
 */
import "emdash/plugin";

declare module "emdash/plugin" {
	interface ObjectCacheStatus {
		configured: boolean;
		active?: boolean;
	}

	interface ObjectCachePurgeResult {
		configured: boolean;
		active: boolean;
		purged: string[];
	}

	interface CacheAccess {
		getObjectCacheStatus(): Promise<ObjectCacheStatus>;
		purgeObjectCache(namespaces?: string[]): Promise<ObjectCachePurgeResult>;
	}

	interface PluginContext {
		cache?: CacheAccess;
	}
}
