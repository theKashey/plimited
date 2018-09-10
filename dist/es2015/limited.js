import { PLimited } from "./pool";
export var limited = function (limit) {
    var pool = new PLimited({ limit: limit });
    var runner = function (callback) {
        var lock = pool.acquire();
        return lock
            .then(function (worker) { return (Promise
            .resolve(callback())
            .then(worker.free)
            .catch(function (err) {
            worker.free();
            throw err;
        })); });
    };
    runner.close = function () { return pool.close(); };
    return runner;
};
