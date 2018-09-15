import {PLimited} from "./pool";

interface Limited {
  <T>(callback: () => Promise<T>): Promise<T>;

  close(): void;
}

export const limited = (limit: number): Limited => {
  const pool = new PLimited({limit});

  const runner: Limited = ((callback: () => Promise<any>) => {
    const lock = pool.acquire();
    return lock
      .then(worker => (
          Promise
            .resolve(callback())
            .then(worker.free)
            .catch(err => {
              worker.free();
              throw err;
            })
        )
      )
  }) as any;

  runner.close = () => pool.close();

  return runner;
};