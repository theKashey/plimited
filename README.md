<div align="center">
  <h1>pLIMITED</h1>
  <br/>  
  <a href="https://travis-ci.org/theKashey/plimited">
     <img src="https://travis-ci.org/theKashey/plimited.svg?branch=master" alt="Build status">
  </a>
  
  <a href="https://www.npmjs.com/package/plimited">
   <img src="https://img.shields.io/npm/v/plimited.svg?style=flat-square" />
  </a>
  
  <br/>  
</div>  

-----
Promise? Pool? Promise Pool? Limited Execution? All-in-one

# API

1. __PLimited__ - classic promise based "connection pool"
```js
import {PLimited} from 'plimited';

const pool = PLimited({
  // create pool limited to 10 concurrent connections
  limit: 10,
  // create no more than 2 connection simultaneously
  constructionLimit: 2, 
  // close connection of unused for a minute
  ttl: 60,
  
  // optional creators
  constructor: () => createSomething(),
  destructor: (oldInstance) => destroy(oldInstance),
  
  // even more optional lifecycle events
  onAcquire: (instance) => instance.prepare(),
  onFree: (instance) => instance.clean(),
  
  // you may hold something "complex" inside pull, and return a simpler API
  getter: (instance) => instance.aLittlePartOfIt;
});
```

The usage itself it quite straightforward:
```js
  // acquire "worker"
  const worker = await pool.acquire();
  // use instance you `constructor` before
  worker.get().doSomething();
  // release it
  worker.free();
};
```
You dont have to `construct` something complex - it work as a async semaphore, like [async-sema](https://github.com/zeit/async-sema).

2. __limited__ - concurent execution controller.

```js
import {limited} from 'plimited'
const taskRunner = limited(10);

Promise.all( data.map(item => taskRunner(async () => anything(item))));

taskRunner.close();
```

# Licence 
MIT
