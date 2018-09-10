"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var defaultProps = {
    limit: 4,
    ttl: 0,
    construct: function () { return null; },
    destruct: function () { return null; },
    onAcquire: function () { return null; },
    onFree: function () { return null; },
};
var TIMEOUT = "timeout";
var CLOSE = "closing plimited";
var unresolvedPromise = new Promise(function () { return ({}); });
var timedPromise = function (tm) { return new Promise(function (resolve) { return setTimeout(function () { return resolve(TIMEOUT); }, tm); }); };
var PLimited = (function () {
    function PLimited(options) {
        this.pending = 0;
        this.closing = false;
        this.queue = [];
        this.pool = [];
        this.objectsCreated = 0;
        this.options = defaultProps;
        this.options = Object.assign({}, defaultProps, options);
    }
    PLimited.prototype.close = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this.closing = true;
                        this.queue.forEach(function (q) { return q.reject(CLOSE); });
                        return [4, this.destroyPool()];
                    case 1:
                        _a.sent();
                        return [2];
                }
            });
        });
    };
    PLimited.prototype.destroyPool = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4, Promise.all(this.pool.map(function (res, index) { return __awaiter(_this, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                switch (_a.label) {
                                    case 0:
                                        clearTimeout(res.destructionTimeout);
                                        return [4, res.mutex];
                                    case 1:
                                        _a.sent();
                                        return [4, this.options.destruct(res.payload, index)];
                                    case 2:
                                        _a.sent();
                                        return [2];
                                }
                            });
                        }); }))];
                    case 1:
                        _a.sent();
                        this.pool = [];
                        return [2];
                }
            });
        });
    };
    PLimited.prototype.allocateResource = function () {
        if (this.pending < this.options.limit && this.pool.length === 0) {
            var payload_1 = {
                payload: undefined,
                mutex: undefined,
                id: this.objectsCreated++
            };
            payload_1.mutex = Promise
                .resolve(this.options.construct(payload_1.id))
                .then(function (result) {
                payload_1.payload = result;
            });
            this.returnResource(payload_1);
        }
    };
    PLimited.prototype.returnResource = function (resource) {
        var _this = this;
        this.pool.push(resource);
        this.onResourceReady();
        if (this.options.ttl) {
            clearTimeout(resource.destructionTimeout);
            resource.destructionTimeout = window.setTimeout(function () {
                var index = _this.pool.indexOf(resource);
                _this.options.destruct(resource.payload, resource.id);
                _this.pool.splice(index, 1);
            }, this.options.ttl);
        }
    };
    PLimited.prototype.onResourceReady = function () {
        while (this.pool.length && this.queue.length) {
            var q = this.queue.pop();
            var res = this.pool.pop();
            q.resolve(res);
        }
    };
    PLimited.prototype.pushQueue = function (_a) {
        var _this = this;
        var _b = _a.priority, priority = _b === void 0 ? 0 : _b;
        this.allocateResource();
        if (this.pool.length) {
            this.pending++;
            return Promise.resolve(this.pool.pop());
        }
        else {
            return new Promise(function (resolve, reject) {
                _this.queue.push({
                    resolve: resolve,
                    reject: reject,
                    priority: priority
                });
                _this.onResourceReady();
            });
        }
    };
    PLimited.prototype.acquireResource = function (_a) {
        var _b = _a.priority, priority = _b === void 0 ? 0 : _b;
        return __awaiter(this, void 0, void 0, function () {
            var _this = this;
            return __generator(this, function (_c) {
                return [2, this.pushQueue({ priority: priority })
                        .then(function (res) { return __awaiter(_this, void 0, void 0, function () {
                        var open, result;
                        var _this = this;
                        return __generator(this, function (_a) {
                            switch (_a.label) {
                                case 0:
                                    open = true;
                                    this.pending++;
                                    window.clearTimeout(res.destructionTimeout);
                                    res.destructionTimeout = 0;
                                    return [4, res.mutex];
                                case 1:
                                    _a.sent();
                                    return [4, this.options.onAcquire(res.payload, res.id)];
                                case 2:
                                    _a.sent();
                                    result = {
                                        get: function () {
                                            if (open) {
                                                return res.payload;
                                            }
                                            throw new Error('plimited: resource already freed');
                                        },
                                        free: function () { return __awaiter(_this, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0:
                                                        if (!open) return [3, 2];
                                                        this.pending--;
                                                        open = false;
                                                        return [4, this.options.onFree(res.payload, res.id)];
                                                    case 1:
                                                        _a.sent();
                                                        this.returnResource(res);
                                                        return [3, 3];
                                                    case 2: throw new Error('plimited: resource already freed');
                                                    case 3: return [2];
                                                }
                                            });
                                        }); }
                                    };
                                    return [2, result];
                            }
                        });
                    }); })];
            });
        });
    };
    PLimited.prototype.acquire = function (params) {
        if (params === void 0) { params = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var _a, timeout, push, tm;
            var _this = this;
            return __generator(this, function (_b) {
                if (this.closing) {
                    return [2, Promise.reject('pool closed')];
                }
                _a = params.timeout, timeout = _a === void 0 ? 0 : _a;
                push = this.acquireResource(params);
                tm = timeout ? timedPromise(timeout) : unresolvedPromise;
                return [2, Promise.race([push, tm])
                        .then(function (result) { return __awaiter(_this, void 0, void 0, function () {
                        return __generator(this, function (_a) {
                            if (result === TIMEOUT) {
                                push.then(function (res) { return res.free(); });
                                throw new Error(TIMEOUT);
                            }
                            return [2, push];
                        });
                    }); })];
            });
        });
    };
    PLimited.prototype.getQueueDepth = function () {
        return this.queue.length;
    };
    PLimited.prototype.getPendingCount = function () {
        return this.pending;
    };
    return PLimited;
}());
exports.PLimited = PLimited;
