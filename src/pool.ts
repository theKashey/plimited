type ConstructorProps<T, K = T> = {
  limit: number;
  ttl: number;

  construct(index: number): T | Promise<T>;
  destruct(object: T, index: number): any | Promise<any>;

  onAcquire(object: T, index: number): any | Promise<any>;
  onFree(object: T, index: number): any | Promise<any>;

  getter(object: T): K;
};

type Resource<T> = {
  payload: T;
  mutex: Promise<any>;
  id: number;
  destructionTimeout?: number;
};

type Deferred<T> = {
  priority: number;
  resolve(res: T): void;
  reject(reason: string): void;
};

export type PooledResource<T> = {
  get(): T;
  free(): Promise<void>;
}

export type QueueLock<T> = {
  res: Resource<T>;
  q: Deferred<Resource<T>>;
  lock: Promise<void>;
  resolveLock(): void;
}

type AcquireParams = {
  timeout?: number;
  priority?: number;
}

const defaultProps: ConstructorProps<any> = {
  limit: 4,
  ttl: 0,
  construct: () => null,
  destruct: () => null,
  onAcquire: () => null,
  onFree: () => null,
  getter: (a:any) => a,
};

const TIMEOUT = "timeout";
const CLOSE = "closing plimited";
const unresolvedPromise: Promise<string> = new Promise(() => ({}));

const timedPromise = (tm: number): Promise<string> => new Promise(resolve => setTimeout(() => resolve(TIMEOUT), tm));

const deferred = (): [Promise<void>, () => void] => {
  let resolve = 0 as any;
  const lock = new Promise<void>(resolver => {
    resolve = resolver
  });
  return [lock, resolve];
};

export class PLimited<T, K = T> {
  private closing: boolean = false;
  private queue: Deferred<Resource<T>>[] = [];
  private pendingQueue: QueueLock<T>[] = [];
  private pool: Resource<T>[] = [];
  private objectsCreated: number = 0;
  private options: ConstructorProps<T, K> = defaultProps;

  constructor(options: Partial<ConstructorProps<T, K>>) {
    this.options = { ...defaultProps, ...options};
  }

  public async acquire(params: AcquireParams = {}): Promise<PooledResource<K>> {
    if (this.closing) {
      return Promise.reject('pool closed');
    }

    const {timeout = 0} = params;
    const push = this.acquireResource(params);
    const tm = timeout ? timedPromise(timeout) : unresolvedPromise;

    return Promise.race([push, tm])
      .then(async result => {
        if (result === TIMEOUT) {
          push.then(res => res.free());
          throw new Error(TIMEOUT);
        }
        return push;
      });
  }

  public getQueueDepth() {
    return this.queue.length;
  }

  public getPendingCount() {
    return this.pendingQueue.length;
  }

  public async close() {
    this.closing = true;

    this.queue.forEach(q => q.reject(CLOSE));

    await Promise.all(this.pendingQueue.map(({lock}) => lock));
    await this.destroyPool();
  }

  private async destroyPool() {
    await Promise.all(
      this.pool.map(
        async (res, index) => {
          clearTimeout(res.destructionTimeout);
          await res.mutex;
          await this.options.destruct!(res.payload, index);
        }
      )
    );
    this.pool = [];
  }

  private allocateResource() {
    if (this.getPendingCount() < this.options.limit && this.pool.length === 0) {
      const payload: Resource<T> = {
        payload: undefined as any,
        mutex: undefined as any,
        id: this.objectsCreated++
      };

      payload.mutex = Promise
        .resolve(this.options.construct!(payload.id))
        .then(result => {
          payload.payload = result;
        });

      this.returnResource(payload);
    }
  }

  private returnResource(resource: Resource<T>) {
    const pending = this.pendingQueue.find(({res}) => res === resource);
    this.pendingQueue = this.pendingQueue.filter(x => x !== pending);
    if (pending) {
      pending.resolveLock();
    }

    this.pool.push(resource);
    this.onResourceReady();

    // ttl
    if (this.options.ttl) {
      clearTimeout(resource.destructionTimeout);
      resource.destructionTimeout = window.setTimeout(() => {
        const index = this.pool.indexOf(resource);
        this.options.destruct!(resource.payload, resource.id);
        this.pool.splice(index, 1);
      }, this.options.ttl);
    }
  }

  private onResourceReady() {
    if (!this.closing) {
      while (this.pool.length && this.queue.length) {
        const q = this.queue.pop()!;
        const res = this.pool.pop()!;
        const [lock, resolveLock] = deferred();
        this.pendingQueue.push({res, q, lock, resolveLock});
        q!.resolve(res!);
      }
    }
  }

  private pushQueue({priority = 0}: AcquireParams): Promise<Resource<T>> {
    this.allocateResource();
    return new Promise((resolve, reject) => {
      this.queue.push({
        resolve,
        reject,
        priority
      });
      this.onResourceReady();
    })
  }

  private async acquireResource({priority = 0}: AcquireParams): Promise<PooledResource<K>> {
    return this.pushQueue({priority})
      .then(async res => {
        let open = true;
        window.clearTimeout(res.destructionTimeout);
        res.destructionTimeout = 0;

        await res.mutex;
        await this.options.onAcquire!(res.payload, res.id);

        const result: PooledResource<K> = {
          get: () => {
            if (open) {
              return this.options.getter!(res.payload);
            }
            throw new Error('plimited: resource already freed');
          },
          free: async () => {
            if (open) {
              open = false;
              await this.options.onFree!(res.payload, res.id);
              this.returnResource(res);
            } else {
              throw new Error('plimited: resource already freed');
            }
          }
        };
        return result;
      });
  }
}