"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pool_1 = require("./pool");
exports.limited = function (limit) {
    var pool = new pool_1.PLimited({ limit: limit });
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
