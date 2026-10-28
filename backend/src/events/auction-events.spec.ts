import { Logger } from '@nestjs/common';
import { AuctionEvents, type AuctionEvent } from './auction-events.js';
const event: AuctionEvent = {
  type: 'bid.accepted',
  lotId: 'public-lot-id',
  bidId: 'public-bid-id',
  endTime: '2030-01-01T12:00:00.000Z',
};
describe('Auction Observer', () => {
  it('supports subscriptions, unsubscribe and shutdown cleanup', () => {
    const events = new AuctionEvents(),
      first = vi.fn(),
      second = vi.fn();
    const unsubscribe = events.subscribe(first);
    events.subscribe(second);
    events.publish(event);
    unsubscribe();
    events.publish(event);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(2);
    events.onModuleDestroy();
    events.publish(event);
    expect(second).toHaveBeenCalledTimes(2);
  });
  it('isolates synchronous and asynchronous listener failures', async () => {
    const warning = vi
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => {});
    try {
      const events = new AuctionEvents(),
        healthy = vi.fn();
      events.subscribe(() => {
        throw new Error('Broken transport');
      });
      events.subscribe(() =>
        Promise.reject(new Error('Disconnected transport')),
      );
      events.subscribe(healthy);
      expect(() => events.publish(event)).not.toThrow();
      await Promise.resolve();
      expect(healthy).toHaveBeenCalledExactlyOnceWith(event);
      expect(warning).toHaveBeenCalledTimes(2);
    } finally {
      warning.mockRestore();
    }
  });
  it('publishes immutable public fields only', () => {
    const events = new AuctionEvents(),
      observer = vi.fn();
    events.subscribe(observer);
    const extended = {
      ...event,
      bidderId: 'private-account',
      idempotencyKey: 'private-key',
    };
    events.publish(extended);
    const delivered = observer.mock.calls[0][0];
    expect(delivered).toEqual(event);
    expect(Object.isFrozen(delivered)).toBe(true);
  });
});
