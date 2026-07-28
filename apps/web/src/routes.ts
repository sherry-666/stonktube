import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  index('routes/home.tsx'),
  route('stocks', 'routes/stocks.tsx'),
  route('stocks/:ticker', 'routes/stocks.$ticker.tsx'),
  route('creators', 'routes/creators.tsx'),
  route('creators/:slug', 'routes/creators.$slug.tsx'),
] satisfies RouteConfig
