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

// create pool limited to 10 concurrent connections
const pool = PLimited({
  limit: 10,
  
  // optional creators
  constructor: () => createSomething(),
  destructor: (oldInstance) => destroy(oldInstance),
  
  // even more optional lifecycle events
  onAcquire: (instance) => instance.prepare(),
  onFree: (instance) => instance.clean(),
  
  // you may hold something "complex" inside pull, and return a simpler API
  getter: (instance) => instance.aLittlePartOfIt;
});

const task = async () => { 
  // acquire "worker"
  const worker = await pool.acquire();
  // use instance you `constructor` before
  worker.get().doSomething();
  // release it
  worker.free();
};
```

2. __limited__ - concurent execution controller.

```js
import {limited} from 'plimited'
const taskRunner = limited(10);

Promise.all( data.map(item => taskRunner(async () => anything(item))));

taskRunner.close();
```

# Licence 
MIT
