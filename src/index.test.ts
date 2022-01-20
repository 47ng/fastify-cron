import Fastify from 'fastify'
import 'jest-extended'
import fastifyCron from './index'

describe('Creating jobs at plugin registration time', () => {
  test('no config', async () => {
    const server = Fastify({ logger: false })
    await server.register(fastifyCron)
    await server.ready()
    expect(server.cron.jobs).toBeArrayOfSize(0)
  })

  test('jobs are not started after plugins are loaded', async () => {
    const server = Fastify({ logger: false })
    const spy = jest.fn()
    await server.register(fastifyCron, {
      jobs: [
        {
          cronTime: '* * * * *',
          onTick: spy
        }
      ]
    })
    await server.ready() // Wait for plugins to load
    expect(server.cron.jobs[0].running).toBeFalsy()
    expect(spy).not.toHaveBeenCalled()
  })

  test('start job when startWhenReady = true', async () => {
    const server = Fastify({ logger: false })
    const spy = jest.fn()
    await server.register(fastifyCron, {
      jobs: [
        {
          cronTime: '* * * * *',
          onTick: spy,
          startWhenReady: true
        }
      ]
    })
    await server.ready()
    expect(server.cron.jobs[0].running).toBeTrue()
    server.cron.stopAllJobs()
  })

  test('retrieve job by name', async () => {
    const server = Fastify({ logger: false })
    const spy = jest.fn()
    await server.register(fastifyCron, {
      jobs: [
        {
          name: 'foo',
          cronTime: '* * * * *',
          onTick: spy
        }
      ]
    })
    await server.ready()
    const job = server.cron.getJobByName('foo')
    expect(job).toBeDefined()
    expect(job!.running).toBeFalsy()
  })
})

describe('Creating jobs manually after registration', () => {
  test('jobs created after `ready` event should start automatically', async () => {
    const spy = jest.fn()
    const server = Fastify({ logger: false })
    await server.register(fastifyCron)
    await server.ready()
    server.cron.createJob({
      cronTime: '* * * * *',
      onTick: spy
    })

    // We still need to re-await here as job startup is asynchronous,
    // but all plugins have already been loaded at this point.
    await server.ready()
    expect(server.cron.jobs).toBeArrayOfSize(1)
    expect(server.cron.jobs[0].running).toBeFalsy()
    server.cron.stopAllJobs()
  })

  test('start job when startWhenReady = true', async () => {
    const server = Fastify({ logger: false })
    const spy = jest.fn()
    await server.register(fastifyCron)
    await server.ready() // Needed to have the decoration
    server.cron.createJob({
      cronTime: '* * * * *',
      onTick: spy,
      startWhenReady: true
    })
    await server.ready() // Will resolve immediately
    expect(server.cron.jobs[0].running).toBeTrue()
    server.cron.stopAllJobs()
  })

  test('retrieve job by name', async () => {
    jest.useFakeTimers('legacy')
    const server = Fastify({ logger: false })
    const spy = jest.fn()
    await server.register(fastifyCron)
    await server.ready()
    server.cron.createJob({
      name: 'foo',
      cronTime: '* * * * *',
      onTick: spy
    })
    await server.ready()
    const job = server.cron.getJobByName('foo')
    expect(job).toBeDefined()
    expect(job!.running).toBeFalsy()
  })

  test('falsy values are ignored in the jobs array', async () => {
    const server = Fastify({ logger: false })
    const spy = jest.fn()
    await server.register(fastifyCron, {
      jobs: [
        false && {
          name: 'foo',
          cronTime: '* * * * *',
          onTick: spy
        }
      ]
    })
    await server.ready()
    const job = server.cron.getJobByName('foo')
    expect(job).toBeUndefined()
  })
})
