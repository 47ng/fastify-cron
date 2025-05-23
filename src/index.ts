import { CronJob, CronJobParameters } from 'cron'
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import fp from 'fastify-plugin'

export type Job = CronJob & {
  readonly name?: string
}

declare module 'fastify' {
  interface FastifyInstance {
    cron: CronDecorator
  }
}

export type Params = Omit<CronJobParameters, 'onTick' | 'onComplete'> & {
  onTick: (server: FastifyInstance) => void
  onComplete?: (server: FastifyInstance) => void
  startWhenReady?: boolean
  name?: string
}

export interface CronDecorator {
  readonly jobs: Job[]
  createJob: (params: Params) => Job
  getJobByName: (name: string) => Job | undefined
  startAllJobs: () => void
  stopAllJobs: () => void
}

export type FalsyValue = undefined | null | false

export interface Config {
  jobs?: (Params | FalsyValue)[]
}

const plugin: FastifyPluginAsync<Config> = async function fastifyCronPlugin(
  server,
  opts
) {
  const decorator: CronDecorator = {
    jobs: [],
    createJob: function createJob(params) {
      const innerParams: CronJobParameters = {
        ...params,
        onTick: () => params.onTick(server),
        onComplete: () =>
          typeof params.onComplete === 'function'
            ? () => params.onComplete!(server)
            : undefined
      }
      const job: Job = Object.assign(new CronJob(innerParams), {
        name: params.name
      })
      if (params.startWhenReady === true) {
        server.ready(() => job.start())
      }
      decorator.jobs.push(job)
      return job
    },
    getJobByName: function getJobByName(name) {
      return decorator.jobs.find(j => j.name === name)
    },
    startAllJobs: function startAllJobs() {
      decorator.jobs.forEach(job => job.start())
    },
    stopAllJobs: function stopAllJobs() {
      decorator.jobs.forEach(job => job.stop())
    }
  }
  for (const params of opts.jobs || []) {
    if (params) {
      decorator.createJob(params)
    }
  }

  server.decorate('cron', decorator)
  server.addHook('onClose', () => decorator.stopAllJobs())
}

export default fp(plugin, {
  name: 'fastify-cron',
  fastify: '4.x || 5.x'
})
