interface plimited {
    <T>(callback: () => Promise<T>): Promise<T>;
    close(): void;
}
export declare const limited: (limit: number) => plimited;
export {};
