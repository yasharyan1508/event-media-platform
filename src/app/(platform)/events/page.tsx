import { getCurrentUser } from "@/src/Library/dal"
import { prisma } from "@/src/Library/prisma"
import { Button } from "@/src/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card"
import Link from "next/link"

export default async function EventsDashboard() {
  // Enforce auth
  await getCurrentUser()

  // Fetch events
  const events = await prisma.event.findMany({
    orderBy: { createdAt: "desc" },
  })

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Events Dashboard</h1>
        <Button asChild className="w-full sm:w-auto">
          <Link href="/events/create">Create New Event</Link>
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 border rounded-lg bg-muted/20 text-center">
          <h3 className="text-2xl font-semibold mb-2">No events found</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            You haven't created any events yet. Get started by creating your first event to share with the community.
          </p>
          <Button asChild size="lg">
            <Link href="/events/create">Create Your First Event</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.map((event) => (
            <Card key={event.id} className="overflow-hidden flex flex-col group hover:shadow-lg transition-shadow">
              <div className="relative w-full h-48 bg-muted border-b">
                {event.imageUrl ? (
                  <img
                    src={event.imageUrl}
                    alt={event.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground bg-muted/50">
                    <span className="text-sm font-medium">No Cover Image</span>
                  </div>
                )}
              </div>
              <CardHeader className="pb-3">
                <CardTitle className="text-xl line-clamp-1">{event.title}</CardTitle>
                <div className="text-sm font-medium text-primary mt-1">
                  {new Date(event.startDateTime).toLocaleDateString(undefined, { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </div>
              </CardHeader>
              <CardContent className="flex-grow flex flex-col justify-between">
                <p className="text-muted-foreground line-clamp-2 text-sm mb-4">
                  {event.location}
                </p>
                <div className="flex items-center justify-between mt-auto pt-4 border-t">
                  <span className={`font-semibold ${event.isFree ? 'text-green-600 dark:text-green-400' : 'text-foreground'}`}>
                    {event.isFree ? "FREE" : `$${event.price}`}
                  </span>
                  <Button variant="outline" size="sm">View Details</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
