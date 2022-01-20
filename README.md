<h1 align="center"><code>fastify-cron</code></h1>

<div align="center">

[![NPM](https://img.shields.io/npm/v/fastify-cron?color=red)](https://www.npmjs.com/package/fastify-cron)
[![MIT License](https://img.shields.io/github/license/47ng/fastify-cron.svg?color=blue)](https://github.com/47ng/fastify-cron/blob/master/LICENSE)
[![Continuous Integration](https://github.com/47ng/fastify-cron/workflows/Continuous%20Integration/badge.svg?branch=next)](https://github.com/47ng/fastify-cron/actions)
[![Coverage Status](https://coveralls.io/repos/github/47ng/fastify-cron/badge.svg?branch=next)](https://coveralls.io/github/47ng/fastify-cron?branch=next)

</div>

<p align="center">
  Run <a href="https://www.npmjs.com/package/cron">cron</a> jobs alongside your <a href="https://www.fastify.io">Fastify</a> server.
</p>

<br/>

While running cron jobs in the same process as a service is not the best
recommended practice (according to the [Twelve Factor App](https://12factor.net/processes)),
it can be useful when prototyping and when implementing low-criticality features
on single-instance services (remember that when scaling horizontally, all your
jobs may run in parallel too, see [Scaling](#scaling)).

There is an existing discussion about this in [`fastify/fastify#1312`](https://github.com/fastify/fastify/issues/1312).

## Installation

```shell
$ yarn add fastify-cron
# or
$ npm i fastify-cron
```

## Usage

Register the plugin with your Fastify server, and define a list of jobs to be
created:

> _If (like me) you always forget the syntax for cron times,
> check out [crontab.guru](https://crontab.guru/)._

```ts
import Fastify from 'fastify'

// Import it this way to benefit from TypeScript typings
import fastifyCron from 'fastify-cron'

const server = Fastify()

server.register(fastifyCron, {
  jobs: [
    {
      // Only these two properties are required,
      // the rest is from the node-cron API:
      // https://github.com/kelektiv/node-cron#api
      cronTime: '0 0 * * *', // Everyday at midnight UTC

      // Note: the callbacks (onTick & onComplete) take the server
      // as an argument, as opposed to nothing in the node-cron API:
      onTick: async server => {
        await server.db.runSomeCleanupTask()
      }
    }
  ]
})

server.listen(() => {
  // By default, jobs are not running at startup
  server.cron.startAllJobs()
})
```

You can create other jobs later with `server.cron.createJob`:

```ts
server.cron.createJob({
  // Same properties as above
  cronTime: '0 0 * * *', // Everyday at midnight UTC
  onTick: () => {}
})
```

To interact with your jobs during the lifetime of your server, you can give
them names:

```ts
server.cron.createJob({
  name: 'foo',
  cronTime: '0 * * * *', // Every hour at X o'clock
  onTick: () => {}
})

// Later on, retrieve the job:
const fooJob = server.cron.getJobByName('foo')
fooJob.start()
```

Otherwise, you can access the list of jobs ordered by order of creation
at `server.cron.jobs`.

> **Warning**: if you mutate that list, you must take responsibility for manually
> shutting down the jobs you pull out.

## Cron Jobs Lifecycle

Cron jobs can be created either by passing properties to the `job` option when
registering the plugin, or when explicitly calling `server.cron.createJob`.

They are created by default in a stopped state, and are not automatically
started (one good place to do so would be in a post-listening hook, but
Fastify does not provide one).

### Starting jobs

The recommended moment to start your jobs is when the server is listening
(this way you can create test servers without cron jobs running around) :

```ts
const server = Fastify()

server.register(fastifyCron, {
  jobs: [
    // ...
  ]
})

server.listen(() => {
  server.cron.startAllJobs()
})
```

If you want to start a job immediately (synchronously) after its creation,
set the `start` property to `true` (this is part of
the [`cron` API](https://github.com/kelektiv/node-cron#api)):

```ts
// When registering the plugin:
server.register(fastifyCron, {
  jobs: [
    {
      cronTime: '0 0 * * *',
      onTick: () => {},
      start: true // Start job immediately
    }
  ]
})

// You can also act directly on the job object being returned:
const job = server.cron.createJob({ cronTime: '0 0 * * *', onTick: () => {} })
job.start()
```

If your job callback needs the server to be ready (all plugins loaded), it can
be inappropriate to start the job straight away. You can have it start
automatically when the server is ready by settings the `startWhenReady`
property to `true`:

```ts
server.register(fastifyCron, {
  jobs: [
    {
      name: 'foo',
      cronTime: '0 0 * * *',
      onTick: server => {
        server.db.doStruff()
      },
      startWhenReady: true
    }
  ]
})
```

### Stopping jobs

Jobs are stopped automatically when the server stops, in an `onClose` hook.

If you have running cron jobs and need to stop them all (eg: in a test
environment where the server is not listening):

```ts
test('some test', () => {
  // ...

  // Stop all cron jobs to let the test runner exit cleanly:
  server.cron.stopAllJobs()
})
```

## Scaling

When horizontal-scaling your applications (running multiple identical instances
in parallel), you'll probably want to make sure only one instance runs the cron
tasks.

If you have a way to uniquely identify an instance (eg: a number passed in the
environment), you could use that to only enable crons for this instance.

Example for [Clever Cloud](https://www.clever-cloud.com/doc/develop/env-variables/#what-is-the-instance_number-variable-used-for):

```ts
if (process.env.INSTANCE_NUMBER === 0) {
  server.register(fastifyCron, {
    jobs: [
      // ...
    ]
  })
}
```

## Conditionally running jobs

You may want to run certain jobs in development only, or under other conditions.

`fastify-cron` will ignore any falsy values in the `jobs` array, so you can do:

```ts
server.register(fastifyCron, {
  jobs: [
    process.env.ENABLE_DEV_JOB === 'true' && {
      name: 'devJob',
      cronTime: '* * * * *',
      onTick: server => {
        // ...
      }
    }
  ]
})
```

## Compatibility Notes

Some compatibility issues may arise with the [`cron` API](https://github.com/kelektiv/node-cron#api).

Possible issues (ticked if confirmed and unhandled):

- [ ] Adding callbacks to a job via `addCallback` may not result in the server being passed as an argument
- [ ] Using `fireOnTick` may lead to the same problem

## License

[MIT](https://github.com/47ng/fastify-cron/blob/master/LICENSE) - Made with ❤️ by [François Best](https://francoisbest.com)

Using this package at work ? [Sponsor me](https://github.com/sponsors/franky47) to help with support and maintenance.
