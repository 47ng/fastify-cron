import fp from 'fastify-plugin';
import { FastifyPlugin } from 'fastify';
import { CronJob, CronJobParameters } from 'cron';

export type Job = CronJob & {
  readonly name?: string;
};

declare module 'fastify' {
  interface FastifyInstance {
    cron: CronDecorator;
  }
}

export type Params = Omit<CronJobParameters, 'onTick' | 'onComplete'> & {
  onTick<S>(server: S): void;
  onComplete?<S>(server: S): void;
  startWhenReady?: boolean;
  name?: string;
};

export interface CronDecorator {
  readonly jobs: Job[];
  createJob(params: Params): Job;
  getJobByName(name: string): Job | undefined;
  startAllJobs(): void;
  stopAllJobs(): void;
}

export interface Config {
  jobs?: Params[];
}

const plugin: FastifyPlugin<Config> = (server, opts, next) => {
  try {
    const decorator: CronDecorator = {
      jobs: [],
      createJob: function createJob(params) {
        const innerParams: CronJobParameters = {
          ...params,
          onTick: () => params.onTick(server),
          onComplete: () => (typeof params.onComplete === 'function' ? () => params.onComplete!(server) : undefined),
        };
        const job: Job = Object.assign(new CronJob(innerParams), {
          name: params.name,
        });
        if (params.startWhenReady === true) {
          server.ready(() => job.start());
        }
        decorator.jobs.push(job);
        return job;
      },
      getJobByName: function getJobByName(name) {
        return decorator.jobs.find((j) => j.name === name);
      },
      startAllJobs: function startAllJobs() {
        decorator.jobs.forEach((job) => job.start());
      },
      stopAllJobs: function stopAllJobs() {
        decorator.jobs.forEach((job) => job.stop());
      },
    };
    for (const params of opts.jobs || []) {
      decorator.createJob(params);
    }

    server.decorate('cron', decorator);
    server.addHook('onClose', () => decorator.stopAllJobs());
    next();
  } catch (error) {
    next(error);
  }
};

export default fp(plugin, {
  name: 'fastify-cron',
  fastify: '3.x',
});
