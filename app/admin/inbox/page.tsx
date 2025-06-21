"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search, 
  Mail, 
  MailOpen, 
  MousePointerClick, 
  AlertCircle,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronLeft,
  ChevronRight,
  RefreshCw
} from "lucide-react";
import { format } from "date-fns";
import { useAuth } from "@/components/auth-provider";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface InboxEmail {
  id: string;
  resend_email_id: string;
  last_event_type: string;
  created_at: string;
  last_event_at: string;
  recipient_email: string;
  sender_email: string;
  subject: string;
  booking_id: string | null;
  tags: any;
  bounce_type: string | null;
  bounce_description: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  raw_payload: any;
  booking?: {
    id: string;
    customer: {
      name: string;
    }
  }
}

export default function InboxPage() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const [emails, setEmails] = useState<InboxEmail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState("all");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/admin/login");
    } else if (user?.user_metadata?.role !== "admin") {
      router.push("/");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (user?.user_metadata?.role === "admin") {
      fetchEmails();
    }
  }, [user, currentPage, searchTerm, activeTab]);

  const fetchEmails = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: currentPage.toString(),
        search: searchTerm,
        status: activeTab
      });

      const response = await fetch(`/api/admin/inbox?${params}`);
      if (!response.ok) {
        throw new Error("Failed to fetch emails");
      }

      const data = await response.json();
      setEmails(data.emails);
      setTotalPages(data.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchEmails();
  };

  const getStatusIcon = (email: InboxEmail) => {
    switch (email.last_event_type) {
      case "email.delivered":
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "email.opened":
        return <MailOpen className="h-4 w-4 text-blue-500" />;
      case "email.clicked":
        return <MousePointerClick className="h-4 w-4 text-purple-500" />;
      case "email.bounced":
      case "email.delivery_failed":
        return <XCircle className="h-4 w-4 text-red-500" />;
      case "email.complained":
        return <AlertCircle className="h-4 w-4 text-orange-500" />;
      default:
        return <Mail className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusBadge = (email: InboxEmail) => {
    const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      "email.sent": { label: "Sent", variant: "secondary" },
      "email.delivered": { label: "Delivered", variant: "default" },
      "email.opened": { label: "Opened", variant: "default" },
      "email.clicked": { label: "Clicked", variant: "default" },
      "email.bounced": { label: "Bounced", variant: "destructive" },
      "email.delivery_failed": { label: "Failed", variant: "destructive" },
      "email.complained": { label: "Spam", variant: "destructive" }
    };

    const status = statusMap[email.last_event_type] || { label: "Unknown", variant: "outline" as const };
    return <Badge variant={status.variant}>{status.label}</Badge>;
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading...</span>
      </div>
    );
  }

  if (!user || user.user_metadata?.role !== "admin") {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Email Inbox</h1>
        <Button 
          onClick={handleRefresh} 
          variant="outline"
          disabled={refreshing}
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <div className="flex items-center space-x-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search emails..."
            className="w-full pl-8"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value);
        setCurrentPage(1);
      }}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="delivered">Delivered</TabsTrigger>
          <TabsTrigger value="opened">Opened</TabsTrigger>
          <TabsTrigger value="clicked">Clicked</TabsTrigger>
          <TabsTrigger value="failed">Failed</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-2">Loading emails...</span>
            </div>
          ) : error ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : emails.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Mail className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No emails found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {emails.map((email) => (
                <Card key={email.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="mt-1">
                          {getStatusIcon(email)}
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <h3 className="font-medium">{email.subject || "No subject"}</h3>
                              <p className="text-sm text-muted-foreground">
                                To: {email.recipient_email}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                From: {email.sender_email}
                              </p>
                            </div>
                            <div className="flex items-center space-x-2">
                              {getStatusBadge(email)}
                              {email.booking && (
                                <Badge variant="outline">
                                  Booking: {email.booking.customer.name}
                                </Badge>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                            <span>Sent: {format(new Date(email.created_at), "MMM d, yyyy h:mm a")}</span>
                            {email.opened_at && (
                              <span>Opened: {format(new Date(email.opened_at), "MMM d, h:mm a")}</span>
                            )}
                            {email.clicked_at && (
                              <span>Clicked: {format(new Date(email.clicked_at), "MMM d, h:mm a")}</span>
                            )}
                          </div>

                          {email.bounce_description && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription>
                                Bounce: {email.bounce_description}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </div>
                      
                      {email.booking_id && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => router.push(`/admin/bookings/${email.booking_id}`)}
                          className="ml-4"
                        >
                          View Booking
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <Button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                variant="outline"
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                variant="outline"
              >
                Next
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}