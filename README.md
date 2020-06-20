# `fastify-cron`

[![NPM](https://img.shields.io/npm/v/fastify-cron?color=red)](https://www.npmjs.com/package/fastify-cron)
[![MIT License](https://img.shields.io/github/license/47ng/fastify-cron.svg?color=blue)](https://github.com/47ng/fastify-cron/blob/master/LICENSE)
[![Travis CI Build](https://img.shields.io/travis/com/47ng/fastify-cron.svg)](https://travis-ci.com/47ng/fastify-cron)
[![Dependabot Status](https://api.dependabot.com/badges/status?host=github&repo=47ng/fastify-cron)](https://dependabot.com)
[![Average issue resolution time](https://isitmaintained.com/badge/resolution/47ng/fastify-cron.svg)](https://isitmaintained.com/project/47ng/fastify-cron)
[![Number of open issues](https://isitmaintained.com/badge/open/47ng/fastify-cron.svg)](https://isitmaintained.com/project/47ng/fastify-cron)

Run [cron](https://www.npmjs.com/package/cron) jobs alongside your [Fastify](https://www.fastify.io) server.

While running cron jobs in the same process as a service is not the best
recommended practice (according to the [Twelve Factor App](https://12factor.net/processes)),
it can be useful when prototyping and when implementing low-criticality features
on single-instance services (remember that when scaling horizontally, all your
jobs may run in parallel too).

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
      onTick: async (server) => {
        await server.db.runSomeCleanupTask()
      },
    },
  ],
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
  onTick: () => {},
})
```

To interact with your jobs during the lifetime of your server, you can give
them names:

```ts
server.cron.createJob({
  name: 'foo',
  cronTime: '0 * * * *', // Every hour at X o'clock
  onTick: () => {},
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
  ],
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
      start: true, // Start job immediately
    },
  ],
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
      onTick: (server) => {
        server.db.doStruff()
      },
      startWhenReady: true,
    },
  ],
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

## Compatibility Notes

Some compatibility issues may arise with the [`cron` API](https://github.com/kelektiv/node-cron#api).

Possible issues (ticked if confirmed and unhandled):

- [ ] Adding callbacks to a job via `addCallback` may not result in the server being passed as an argument
- [ ] Using `fireOnTick` may lead to the same problem

## License

[MIT](https://github.com/47ng/fastify-cron/blob/master/LICENSE) - Made with ❤️ by [François Best](https://francoisbest.com) - [Donations welcome](https://paypal.me/francoisbest?locale.x=fr_FR) 🙏
