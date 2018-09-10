declare type ConstructorProps<T> = {
    limit: number;
    ttl?: number;
    construct?(index: number): T | Promise<T>;
    destruct?(object: T, index: number): any | Promise<any>;
    onAcquire?(object: T, index: number): any | Promise<any>;
    onFree?(object: T, index: number): any | Promise<any>;
};
export declare type PooledResource<T> = {
    get(): T;
    free(): Promise<void>;
};
declare type AcquireParams = {
    timeout?: number;
    priority?: number;
};
export declare class PLimited<T> {
    private pending;
    private closing;
    private queue;
    private pool;
    private objectsCreated;
    private options;
    constructor(options: ConstructorProps<T>);
    close(): Promise<void>;
    private destroyPool;
    allocateResource(): void;
    private returnResource;
    private onResourceReady;
    private pushQueue;
    private acquireResource;
    acquire(params?: AcquireParams): Promise<PooledResource<T>>;
    getQueueDepth(): number;
    getPendingCount(): number;
}
export {};
