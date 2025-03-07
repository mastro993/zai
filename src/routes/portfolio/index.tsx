import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/portfolio/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/portfolio/"!</div>
}
