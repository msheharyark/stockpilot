import { MockRemoteApi } from './MockRemoteApi';
import { seedCatalog } from './seed';

/**
 * The demo talks to an in-process mock server with realistic latency.
 * `failureRate` can be raised from the UI to demo offline behaviour.
 */
export const backend = new MockRemoteApi(seedCatalog(), { latencyMs: 600 });
