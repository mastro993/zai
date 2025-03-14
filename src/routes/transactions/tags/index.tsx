import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/transactions/tags/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/transactions/tags/"!</div>
}
