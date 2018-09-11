import {limited, PLimited} from '../src';

describe('Specs', () => {
  const timedPromise = (tm: number): Promise<any> => new Promise(resolve => setTimeout(resolve, tm));

  describe('Limited', () => {
    it('concurrency', async () => {
      const limit = limited(10);
      let maxConcurent = 0;
      let current = 0;
      let passed = 0;

      await Promise.all(Array(100).fill(1).map(() => (
        limit(async () => {
          current++;
          maxConcurent = Math.max(maxConcurent, current);

          await timedPromise(Math.random() * 5);

          current--;
          passed++;
        })
      )));

      expect(passed).toBe(100);
      expect(maxConcurent).toBe(10);
      expect(current).toBe(0);
    });
  });


  describe('Pool', () => {
    it('concurrency', async () => {
      let constructions = 0;
      let destructions = 0;
      let aquired = 0;
      let freed = 0;

      interface Obj {
        index: number;
        constructions: number;
      }

      const limit = new PLimited({
        limit: 10,
        ttl: 10,

        construct: (index): Promise<Obj> => Promise.resolve({index, constructions: constructions++}),
        destruct: (obj, index) => {
          expect(obj.index).toBe(index);
          destructions++;
        },
        onAcquire: (obj: Obj) => {
          aquired++;
          return Promise.resolve(obj);
        },
        onFree: (obj: Obj) => {
          freed++;
          return Promise.resolve(obj);
        },
      });
      let maxConcurent = 0;
      let current = 0;
      let passed = 0;

      await Promise.all(Array(100).fill(1).map(async () => {
          const worker = await limit.acquire();
          current++;
          maxConcurent = Math.max(maxConcurent, current);

          await timedPromise(Math.random() * 5);

          current--;
          passed++;

          if (passed === 20) {
            expect(limit.getQueueDepth()).toBe(71);
            expect(limit.getPendingCount()).toBe(10);
          }

          worker.free();
        })
      );

      expect(passed).toBe(100);
      expect(maxConcurent).toBe(10);
      expect(current).toBe(0);

      expect(aquired).toBe(100);
      expect(freed).toBe(100);

      expect(constructions).toBe(10);
      expect(destructions).toBe(0);


      await timedPromise(20);

      expect(destructions).toBe(10);
    });

    it('free', async () => {
      let constructions = 0;
      let destructions = 0;

      const limit = new PLimited({
        limit: 10,
        ttl: 5,

        construct: (index) => ({index, constructions: constructions++}),
        destruct: () => {
          destructions++;
        },
      });

      const tick = async () => {
        const worker = await limit.acquire();

        await timedPromise(2);

        worker.free();
      };

      await Promise.all(Array(100).fill(1).map(tick));

      expect(constructions).toBe(10);
      expect(destructions).toBe(0);

      await timedPromise(1);
      tick();
      tick();
      await timedPromise(5);
      tick();
      tick();

      expect(destructions).toBe(8);

      const close = limit.close();
      expect(destructions).toBe(8);
      expect(limit.getPendingCount()).toBe(2);
      await close;
      expect(limit.getPendingCount()).toBe(0);
      expect(destructions).toBe(10);
    });
  });
});

