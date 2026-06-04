import { describe, it, expect, vi } from 'vitest';
import { EventQueue } from '../src/core/queue';

describe('EventQueue', () => {
  it('buffers until flush, then runs in order', () => {
    const calls: number[] = [];
    const q = new EventQueue();
    q.add(() => calls.push(1));
    q.add(() => calls.push(2));
    expect(calls).toEqual([]);
    q.flush();
    expect(calls).toEqual([1, 2]);
  });

  it('runs immediately after flush', () => {
    const fn = vi.fn();
    const q = new EventQueue();
    q.flush();
    q.add(fn);
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
