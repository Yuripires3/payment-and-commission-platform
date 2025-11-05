import { Suspense } from "react"
import DashboardContent from "./_components/DashboardContent"

export const dynamic = 'force-dynamic'
export const revalidate = 0
export const fetchCache = 'force-no-store'

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div className="p-6">
        <div className="space-y-6">
          <div>
            <div className="h-8 w-64 bg-gray-200 animate-pulse rounded mb-2" />
            <div className="h-4 w-96 bg-gray-200 animate-pulse rounded" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-32 bg-gray-200 animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    }>
      <DashboardContent />
    </Suspense>
  )
}
