type ConstructorProps<T, K, Z = undefined> = {
  /**
   * maximum simultaneous workers
   * once you reach this limit - tasks would start to queue
   */
  limit: number;
  /**
   * maximum simultaneous workers in construction
   * it might be useful to open, for example, only one connection to the database at once
   * even if you could have 100 simultaneously
   */
  constructionLimit: number;
  /**
   * TimeToLife for the unused worker
   * after this time it would be destoyed
   */
  ttl: number;

  onInit(): Z | Promise<Z>;
  onIdle(data: Z): void;

  /**
   * Callback to construct a worker
   */
  construct(index: number, shared: Z): T | Promise<T>;
  /**
   * Callback to destruct a worker
   */
  destruct(worker: T, index: number): any | Promise<any>;

  /**
   * Callback when someone allocates a worker
   */
  onAcquire(worker: T, index: number): any | Promise<any>;
  /**
   * Callback when someone frees a worker
   */
  onFree(worker: T, index: number): any | Promise<any>;

  /**
   * Mapper to a custom representation
   */
  getter(worker: T): K;
};

type Resource<T> = {
  payload: T;
  mutex: Promise<any>;
  id: number;
  destructionTimeout?: any;
};

type Deferred<T> = {
  priority: number;
  resolve(res: T): void;
  reject(reason: string): void;
};

export type PooledResource<T> = {
  /**
   * returns an allocated resource
   */
  get(): T;
  /**
   * frees an allocated resource, returning it to the pool
   */
  free(): Promise<void>;
  /**
   * destroys the current resource, pool would create a new one
   */
  drop(): void;
  /**
   * destroys existing resource and allocates a new one
   */
  regenerate(): Promise<void>;
};

export type QueueLock<T> = {
  res: Resource<T>;
  q: Deferred<Resource<T>>;
  lock: Promise<void>;
  resolveLock(): void;
};

type AcquireParams = {
  timeout?: number;
  priority?: number;
};

const defaultProps: ConstructorProps<any, any, any> = {
  limit: 4,
  constructionLimit: Infinity,
  ttl: 0,
  onInit: () => ({}),
  onIdle: () => null,
  construct: () => null,
  destruct: () => null,
  onAcquire: () => null,
  onFree: () => null,
  getter: (a: any) => a
};

const TIMEOUT = 'timeout';
const CLOSE = 'closing plimited';
const unresolvedPromise: Promise<string> = new Promise(() => ({}));

const timedPromise = (tm: number): Promise<string> =>
  new Promise(resolve => setTimeout(() => resolve(TIMEOUT), tm));

const deferred = (): [Promise<void>, () => void] => {
  let resolve = 0 as any;
  const lock = new Promise<void>(resolver => {
    resolve = resolver;
  });
  return [lock, resolve];
};

export class PLimited<T, K = T, Z = undefined> {
  private closing: boolean = false;
  private queue: Deferred<Resource<T>>[] = [];
  private pendingQueue: QueueLock<T>[] = [];
  private pendingConstructions: any[] = [];
  private pool: Resource<T>[] = [];
  private objectsCreated: number = 0;
  private options: ConstructorProps<T, K, Z> = defaultProps;
  private shared: Promise<Z> = undefined as any;
  private workerCount: number = 0;

  constructor(options: Partial<ConstructorProps<T, K, Z>>) {
    this.options = {...defaultProps, ...options};
  }

  /**
   * Will give you a resource. Sooner or later
   * @param params
   */
  public async acquire(params: AcquireParams = {}): Promise<PooledResource<K>> {
    if (this.closing) {
      return Promise.reject('pool closed');
    }

    const {timeout = 0} = params;
    const push = this.acquireResource(params);
    const tm = timeout ? timedPromise(timeout) : unresolvedPromise;

    return Promise.race([push, tm]).then(async result => {
      if (result === TIMEOUT) {
        push.then(res => res.free());
        throw new Error(TIMEOUT);
      }
      return push;
    });
  }

  /**
   * closes pool
   */
  public async close() {
    this.closing = true;

    this.queue.forEach(q => q.reject(CLOSE));

    await Promise.all(this.pendingQueue.map(({lock}) => lock));
    await this.destroyPool();
  }

  public getQueueDepth() {
    return this.queue.length;
  }

  public getPendingCount() {
    return this.pendingQueue.length;
  }

  private async getSharedObject(): Promise<Z> {
    if (this.workerCount === 0) {
      this.shared = Promise.resolve(this.options.onInit());
      this.shared.then( shared => {
        if (!shared) {
          throw new Error('onInit should return a value');
        }
      });
    }

    return this.shared;
  }

  private async tryReleaseSharedObject() {
    if (!this.workerCount && this.shared) {
      const shared = this.shared;
      this.shared = undefined as any;
      this.options.onIdle(await shared);
    }
  }

  private async destroyPool() {
    await Promise.all(
      this.pool.map(async (res) => {
        clearTimeout(res.destructionTimeout);
        await res.mutex;
        await this.freeResource(res);
      })
    );
    this.pool = [];
  }

  private allocateResource() {
    if (
      // not exceed limits
      this.getPendingCount() < this.options.limit &&
      // dont have anything free in the pool (TODO: preheat?)
      this.pool.length === 0 &&
      // below the construction limit
      this.pendingConstructions.length < this.options.constructionLimit
    ) {
      const payload: Resource<T> = {
        payload: undefined as any,
        mutex: undefined as any,
        id: this.objectsCreated++
      };

      payload.mutex = this.getSharedObject()
        .then(shared => this.options.construct(payload.id, shared))
        .then(
          result => {
            this.pendingConstructions = this.pendingConstructions.filter(x => x !== payload.mutex);
            payload.payload = result;
            if (this.getQueueDepth()) {
              this.allocateResource();
            }
          }
        );
      this.workerCount++;
      this.pendingConstructions.push(payload.mutex);

      this.returnResource(payload);
    }
  }

  private freeResource(resource: Resource<T>) {
    this.options.destruct(resource.payload, resource.id);
    this.workerCount--;
    this.tryReleaseSharedObject();
  }

  private destroyResource(resource: Resource<T>) {
    if (this.options.ttl) {
      clearTimeout(resource.destructionTimeout);
    }
    const index = this.pool.indexOf(resource);
    if (index >= 0) {
      this.pool.splice(index, 1);
    }

    this.freeResource(resource);
  }

  private returnResource(resource: Resource<T>, trashResource = false) {
    const pending = this.pendingQueue.find(({res}) => res === resource);
    this.pendingQueue = this.pendingQueue.filter(x => x !== pending);
    if (pending) {
      pending.resolveLock();
    }

    if (trashResource) {
      this.destroyResource(resource);
    } else {
      this.pool.push(resource);
    }

    // ttl
    if (this.options.ttl) {
      clearTimeout(resource.destructionTimeout);
      resource.destructionTimeout = setTimeout(() => this.destroyResource(resource), this.options.ttl);
    }

    this.onResourceReady();
  }

  private onResourceReady() {
    if (!this.closing) {
      while (this.pool.length && this.queue.length) {
        const q = this.queue.shift()!;
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
      this.queue[priority >= 1 ? 'unshift' : 'push']({
        resolve,
        reject,
        priority
      });
      this.onResourceReady();
    });
  }

  private async acquireResource({
                                  priority = 0
                                }: AcquireParams): Promise<PooledResource<K>> {
    return this.pushQueue({priority})
      .then(async initialResource => {
        let res = initialResource;
        let open = true;
        clearTimeout(res.destructionTimeout);
        res.destructionTimeout = 0;

        await res.mutex;
        await this.options.onAcquire(res.payload, res.id);

        const result: PooledResource<K> = {
          get: () => {
            if (open) {
              return this.options.getter(res.payload);
            }
            throw new Error('plimited: resource already freed');
          },
          free: async () => {
            if (open) {
              open = false;
              await this.options.onFree(res.payload, res.id);
              this.returnResource(res);
            } else {
              throw new Error('plimited: resource already freed');
            }
          },
          drop: async () => {
            open = false;
            this.options.onFree(res.payload, res.id);
            this.returnResource(res, true);
          },
          regenerate: async () => {
            open = false;
            await this.options.onFree(res.payload, res.id);
            const newRes = this.pushQueue({priority: 1});
            this.returnResource(res, true);
            this.allocateResource();
            res = await newRes;
            open = true;
          }
        }
        return result;
      });
  }
}
