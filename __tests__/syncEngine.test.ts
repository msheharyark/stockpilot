import { MemoryRepository } from '../src/data/MemoryRepository';
import { MockRemoteApi } from '../src/sync/MockRemoteApi';
import { SyncEngine } from '../src/sync/SyncEngine';
import { movement, seedItems } from './fixtures';

async function setup(failureRate = 0) {
  const repo = new MemoryRepository();
  const api = new MockRemoteApi(seedItems(), { failureRate, random: () => 0.5 });
  await repo.applyServerItems(seedItems());
  let now = 1_000;
  const engine = new SyncEngine({ repo, api, now: () => now, random: () => 0.5 });
  return { repo, api, engine, advance: (ms: number) => (now += ms) };
}

describe('SyncEngine', () => {
  it('pushes pending movements and confirms server quantity', async () => {
    const { repo, engine } = await setup();
    await repo.recordMovement(movement({ itemId: 'i1', delta: -3 }));
    expect((await repo.getItem('i1'))!.quantity).toBe(7);

    const report = await engine.sync();

    expect(report).toEqual({ pushed: 1, rejected: [], failed: false });
    const item = (await repo.getItem('i1'))!;
    expect(item).toMatchObject({ quantity: 7, serverQuantity: 7 });
    expect(await repo.pendingCount()).toBe(0);
  });

  it('keeps work queued offline and backs off', async () => {
    const { repo, api, engine, advance } = await setup(1);
    await repo.recordMovement(movement({ itemId: 'i1', delta: -2 }));

    const report = await engine.sync();

    expect(report.failed).toBe(true);
    expect(await repo.pendingCount()).toBe(1);
    expect((await repo.getItem('i1'))!.quantity).toBe(8); // user still sees their change
    const [queued] = await repo.listMovements('i1');
    expect(queued.attempts).toBe(1);
    expect(queued.nextAttemptAt).toBeGreaterThan(1_000);

    api.failureRate = 0;
    advance(60_000);
    await engine.sync();
    expect(await repo.pendingCount()).toBe(0);
    expect((await repo.getItem('i1'))!.serverQuantity).toBe(8);
  });

  it('never applies a retried movement twice', async () => {
    const { repo, api, engine } = await setup();
    const m = movement({ itemId: 'i1', delta: -4 });
    await repo.recordMovement(m);
    // The server applied it, but the response was lost and the device still thinks it is pending.
    await api.pushMovements([m]);

    await engine.sync();

    expect((await repo.getItem('i1'))!).toMatchObject({ quantity: 6, serverQuantity: 6 });
  });

  it('rolls back a movement the server rejects', async () => {
    const { repo, api, engine } = await setup();
    await repo.recordMovement(movement({ itemId: 'i2', delta: -3 })); // looks fine locally (3 on hand)
    api.externalAdjust('i2', -2); // another device picked 2 meanwhile

    const report = await engine.sync();

    expect(report.rejected).toHaveLength(1);
    expect(report.rejected[0].reason).toMatch(/Insufficient stock/);
    expect((await repo.getItem('i2'))!).toMatchObject({ quantity: 1, serverQuantity: 1 });
  });

  it('rebases local pending work on top of changes from other devices', async () => {
    const { repo, api, engine } = await setup(1);
    await repo.recordMovement(movement({ itemId: 'i1', delta: 5, reason: 'receive' }));
    await engine.sync(); // push fails, movement stays pending

    api.failureRate = 0;
    api.externalAdjust('i1', -4);
    await repo.applyServerItems(await api.pullItems());

    expect((await repo.getItem('i1'))!).toMatchObject({ serverQuantity: 6, quantity: 11 });
  });

  it('ignores stale server snapshots', async () => {
    const { repo } = await setup();
    const [first] = seedItems();
    await repo.applyServerItems([{ ...first, quantity: 50, version: 3 }]);
    await repo.applyServerItems([{ ...first, quantity: 1, version: 2 }]);
    expect((await repo.getItem('i1'))!.serverQuantity).toBe(50);
  });

  it('shares one run between concurrent sync calls', async () => {
    const { repo, api, engine } = await setup();
    const push = jest.spyOn(api, 'pushMovements');
    await repo.recordMovement(movement({ itemId: 'i1', delta: -1 }));

    const [a, b] = await Promise.all([engine.sync(), engine.sync()]);

    expect(a).toBe(b);
    expect(push).toHaveBeenCalledTimes(1);
  });
});
