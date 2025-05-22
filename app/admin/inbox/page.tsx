import { fetchAdminInbox } from "@/lib/queries/bookings";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import { format } from "date-fns";

// Optional: Add revalidation
export const revalidate = 60; // Revalidate every 60 seconds

export default async function AdminInboxPage() {
  const pendingBookings = await fetchAdminInbox();

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">Booking Inbox</h1>
      <p className="text-muted-foreground mb-8">
        Review and manage new booking requests that are pending confirmation.
      </p>

      {pendingBookings.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              No pending bookings at the moment.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Pending Bookings ({pendingBookings.length})</CardTitle>
            <CardDescription>
              These bookings require your attention.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Car</TableHead>
                  <TableHead>Dates</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendingBookings.map((booking: any) => (
                  <TableRow key={booking.id}>
                    <TableCell>
                      <div className="font-medium">
                        {booking.customer.first_name} {booking.customer.last_name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {booking.customer.email}
                      </div>
                      {booking.customer.phone && (
                        <div className="text-sm text-muted-foreground">
                          {booking.customer.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>{booking.car.name}</TableCell>
                    <TableCell>
                      {format(new Date(booking.start_date), "MMM d, yyyy")} - {" "}
                      {format(new Date(booking.end_date), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell>
                      {new Intl.NumberFormat("en-US", {
                        style: "currency",
                        currency: booking.currency || "USD",
                      }).format(booking.total_price)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(booking.created_at), "MMM d, yyyy, p")}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                        {booking.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {/* Placeholder for actions like Approve/Reject or View Details */}
                      <Link href={`/admin/bookings/${booking.id}`} className="text-blue-600 hover:underline">
                        View Details
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 