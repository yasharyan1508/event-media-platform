import { getCurrentUser } from "@/src/Library/dal"
import { EventForm } from "@/src/components/events/EventForm"
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card"

export default async function CreateEventPage() {
  const user = await getCurrentUser()

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-8">
      <Card className="shadow-lg border-muted/50">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold tracking-tight">Create New Event</CardTitle>
          <p className="text-sm text-muted-foreground">Fill in the details to publish your next great event.</p>
        </CardHeader>
        <CardContent>
          <EventForm type="Create" userId={user.id} />
        </CardContent>
      </Card>
    </div>
  )
}
