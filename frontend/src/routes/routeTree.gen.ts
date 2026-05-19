import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router'
import { Root } from '../App'
import Layout from './_authenticated'
import { ClusterOverview } from './cluster-overview'
import Nodes from './nodes'
import Jobs from './jobs'
import Partitions from './partitions'
import JobDetail from './_authenticated/jobs.$jobId'
import History from './history'
import GpuMonitoring from './gpu'

const rootRoute = createRootRoute({ component: Root })

// Pathless layout route — wraps all pages with the nav header
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: '_authenticated',
  component: Layout,
})

const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/',
  component: ClusterOverview,
})

const nodesRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/nodes',
  component: Nodes,
})

const partitionsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/partitions',
  component: Partitions,
})

const jobsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/jobs',
  component: Jobs,
})

const jobDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/jobs/$jobId',
  component: JobDetail,
})

const historyRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/history',
  component: History,
})

const gpuRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/gpu',
  component: GpuMonitoring,
})

export const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([
    indexRoute,
    nodesRoute,
    partitionsRoute,
    gpuRoute,
    jobsRoute,
    jobDetailRoute,
    historyRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
