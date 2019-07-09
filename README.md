<div align="center">
  <h1>pLIMITED</h1>
  <br/>  
  <a href="https://travis-ci.org/theKashey/plimited">
     <img src="https://travis-ci.org/theKashey/plimited.svg?branch=master" alt="Build status">
  </a>
  
  <a href="https://www.npmjs.com/package/plimited">
   <img src="https://img.shields.io/npm/v/plimited.svg?style=flat-square" />
  </a>
  
  <a href="https://bundlephobia.com/result?p=plimited">
    <img src="https://img.shields.io/bundlephobia/minzip/plimited.svg" alt="bundle size">
  </a> 
  
  <br/>  
</div>  

-----
Promise? Pool? Promise Pool? Limited Execution? All-in-one

# API
> eveything is in TypeScript, by the way

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
  
  // optional life cycle methods
  // called on the first worker allocation
  onInit: (): sharedObject => allocateSomething(),
  // called on the last worker deallocation
  onIdle: (sharedObject) => deallocateSomething();
  
  // optional worker creators. called for each worker  
  constructor: (index, sharedObject) => createSomething(),
  destructor: (oldInstance, sharedObject) => destroy(oldInstance),
  
  // optional lifecycle events, called for each worker allocation
  onAcquire: (instance) => instance.prepare(),
  onFree: (instance) => instance.clean(),
  
  // you may hold something "complex" inside pool, and return a simpler API for the customer
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

2. __limited__ - concurrent execution controller.

```js
import {limited} from 'plimited'
const taskRunner = limited(10);

// would return N promises you can await for
// but execute no more than 10 tasks in concurrently
Promise.all(
  data.map(item => taskRunner(async () => anything(item)))
);

taskRunner.close();
```

# Handling exceptions
If, by any reason, worker become broken, for example puppetter might broke due to js exceptions on the page,
you might dispose it
```js
const worker = await pool.acquire();
//...
//something went wrong
await worker.regenerate(); // dispose the old worker, and create a new one
//...
worker.free();

// or
worker.drop(); // drop worker at once, no need to "free" it
```

# Examples
### Simple puppeteer, tab per worker
- Uses `onInit` to create `browser`
- creates a `page` on construction.
- destroys it on destruction
- Once all resources are freed - destroys the acquired browser.

```js
import puppeteer from 'puppeteer';
import {PLimited} from 'plimited';

const createBrowser = () => puppeteer.launch();

return new PLimited({
    limit: 10,
    ttl: 60000, // keep alive for a minute
    
    // per Pool handlers
    onInit: () => {
      // pool initilization - create a browser
      return createBrowser();
    },
    onIdle: (browser) => {
      // pool idle state(no active workers) - destroy the browser
      browser.close();
    },
    
    // worker contruction handlers
    construct: async (index, browser) => {
      // create a new page
      return await browser.newPage();     
    },
    destruct: async (page) => {
      page.close();
    }
  });
```

### Puppeteer, process per worker
Puppeteer is not 100% concurrent across "tabs", so sometimes it's better to create separated processes.
- creates a `browser` and a `page` on construction.
- destroys both on destruction
- returns only `page` for a customer
```js
import puppeteer from 'puppeteer';
import {PLimited} from 'plimited';

const createBrowser = () => puppeteer.launch();

return new PLimited({
    limit: 10,
    constructionLimit: 1, // allow only one puppeteer to "spin up" in a single point in time
    ttl: 60000, // keep alive for a moment
    construct: async () => {
      // create a browser
      const browser = await createBrowser();
      
      // create a new page
      const page = await browser.newPage();
     
      return { page, browser };
    },
    destruct: async ({ browser }) => {
      await browser.close();
    },
    // client needs only the "page" 
    getter: ({ page }) => page,
    onAcquire: async ({ page }) => {
      // initialization for every round
      await page.goto(`about:blank`, { waitUntil: 'load' })
      
      await page.setViewport({
        width: 1024,
        height: 768
      });
    },
  });
```

### Mysql connection pool
Easy, and reliable
```js
const mysql = require("mysql");
const {PLimited} = require("plimited");

const pool = new PLimited({
  limit: 10,
  ttl: 60 * 10,
  construct() {
    return mysql.createConnection({
      user: 'root',
      password: '',
      connection: ''
    })
  },

  destruct(conn) {
    conn.close();
  }
});
```

# Licence 
MIT
