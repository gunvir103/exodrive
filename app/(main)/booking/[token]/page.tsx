import { createSupabaseServerClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDate, formatCurrency } from '@/lib/utils/date-utils';

interface BookingDetailsPageProps {
  params: {
    token: string;
  };
}

async function getBookingDetails(token: string) {
  const cookieStore = cookies();
  const supabase = createSupabaseServerClient(cookieStore);

  // 1. Fetch the token details
  const { data: tokenData, error: tokenError } = await supabase
    .from('booking_secure_tokens')
    .select('booking_id, expires_at')
    .eq('token', token)
    .single();

  if (tokenError || !tokenData) {
    return null;
  }

  // 2. Check if token is expired
  if (new Date(tokenData.expires_at) < new Date()) {
    return { error: 'expired_token' };
  }

  // 3. Fetch booking details using booking_id
  const { data: bookingData, error: bookingError } = await supabase
    .from('bookings')
    .select(`
      id,
      start_date,
      end_date,
      total_price,
      currency,
      overall_status,
      payment_status,
      contract_status,
      created_at,
      notes,
      cars (
        name,
        slug,
        category,
        car_images (url, alt, is_primary)
      ),
      customers (
        first_name,
        last_name,
        email
      )
    `)
    .eq('id', tokenData.booking_id)
    .single();

  if (bookingError || !bookingData) {
    return null;
  }
  
  // Filter for primary car image
  const primaryImage = bookingData.cars?.car_images.find(img => img.is_primary) || bookingData.cars?.car_images[0];

  return {
    ...bookingData,
    cars: {
        ...bookingData.cars,
        primary_image_url: primaryImage?.url,
        primary_image_alt: primaryImage?.alt || bookingData.cars?.name
    }
  };
}

export default async function BookingDetailsPage({ params }: BookingDetailsPageProps) {
  const booking = await getBookingDetails(params.token);

  if (!booking) {
    notFound(); // Triggers 404 page
  }

  if (booking.error === 'expired_token') {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Link Expired</CardTitle>
            <CardDescription>The link to view this booking has expired. Please contact support if you need assistance.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <Card className="max-w-4xl mx-auto shadow-lg">
        <CardHeader className="bg-muted/50 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle className="text-3xl font-bold">Booking Confirmation</CardTitle>
              <CardDescription className="text-lg text-muted-foreground">
                Thank you for your booking! Here are your details.
              </CardDescription>
            </div>
            <Badge variant={booking.overall_status === 'completed' ? 'success' : (booking.overall_status?.startsWith('pending') ? 'warning' : 'default')} 
                   className="text-sm px-3 py-1">
              Status: {booking.overall_status?.replace('_', ' ').toUpperCase()}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6 space-y-8">
          <section>
            <h2 className="text-xl font-semibold mb-4 text-primary">Vehicle Details</h2>
            <div className="grid md:grid-cols-2 gap-6 items-center">
              <div>
                {booking.cars?.primary_image_url && (
                  <img 
                    src={booking.cars.primary_image_url}
                    alt={booking.cars.primary_image_alt || 'Vehicle image'}
                    width={600}
                    height={400}
                    className="rounded-lg object-cover aspect-[3/2]"
                  />
                )}
              </div>
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">{booking.cars?.name}</h3>
                <p className="text-muted-foreground">Category: {booking.cars?.category}</p>
                <p className="text-muted-foreground">Booking ID: <span className="font-medium text-foreground">{booking.id}</span></p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-primary">Rental Period</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium">{formatDate(booking.start_date)}</TableCell>
                  <TableCell className="font-medium">{formatDate(booking.end_date)}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-primary">Customer Information</h2>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Name</p>
                <p className="font-medium">{booking.customers?.first_name} {booking.customers?.last_name}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{booking.customers?.email}</p>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4 text-primary">Payment Details</h2>
            <div className="grid sm:grid-cols-2 gap-4">
                <div>
                    <p className="text-sm text-muted-foreground">Total Price</p>
                    <p className="font-medium text-lg">{formatCurrency(booking.total_price || 0, booking.currency || 'USD')}</p>
                </div>
                <div>
                    <p className="text-sm text-muted-foreground">Payment Status</p>
                    <Badge variant={booking.payment_status === 'captured' ? 'success' : (booking.payment_status === 'pending' ? 'warning' : 'default') } className="capitalize">
                        {booking.payment_status?.replace('_', ' ')}
                    </Badge>
                </div>
            </div>
            {booking.notes && (
                <div className="mt-4">
                    <p className="text-sm text-muted-foreground">Booking Notes</p>
                    <p className="font-medium bg-stone-100 p-3 rounded-md dark:bg-stone-800">{booking.notes}</p>
                </div>
            )}
          </section>

          <section className="text-center text-sm text-muted-foreground pt-6">
            <p>Booking made on: {formatDate(booking.created_at)}</p>
            <p>If you have any questions, please contact support.</p>
          </section>
        </CardContent>
      </Card>
    </div>
  );
} 