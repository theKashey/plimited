"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var pool_1 = require("./pool");
exports.limited = function (limit) {
    var pool = new pool_1.PLimited({ limit: limit });
    return function (callback) {
        var lock = pool.acquire();
        lock
            .then(function (worker) { return (Promise
            .resolve(callback)
            .then(worker.free)
            .catch(function (err) {
            worker.free();
            throw err;
        })); });
    };
};
