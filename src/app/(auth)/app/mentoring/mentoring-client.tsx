"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { MentorExpert, MentoringSession } from "@/lib/mentoring/mentoring-store"
import { listExpertMentors, getSessionTypeLabel } from "@/lib/mentoring/mentoring-store"
import { Calendar, Clock, GraduationCap, Plus, User } from "lucide-react"
import { useEffect, useState } from "react"

const sessionTypes = ["fundraising", "growth", "operations", "financial", "product"] as const

export function MentoringClient() {
  const [sessions, setSessions] = useState<MentoringSession[]>([])
  const [experts, setExperts] = useState<MentorExpert[]>([])
  const [loading, setLoading] = useState(true)
  const [bookOpen, setBookOpen] = useState(false)
  const [booking, setBooking] = useState(false)
  const [bookType, setBookType] = useState<string>("")
  const [bookMentorId, setBookMentorId] = useState<string>("")

  useEffect(() => {
    Promise.all([
      fetch("/api/mentoring/sessions").then((r) => r.json()),
      fetch("/api/mentoring/experts").then((r) => r.json()),
    ]).then(([sessionsRes, expertsRes]) => {
      setSessions(sessionsRes.sessions || [])
      setExperts(expertsRes.experts || listExpertMentors())
      setLoading(false)
    })
  }, [])

  async function handleBook() {
    if (!bookType) return
    setBooking(true)
    const mentor = bookMentorId ? experts.find((e) => e.id === bookMentorId) : null
    try {
      const res = await fetch("/api/mentoring/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: bookType,
          mentorId: mentor?.id || null,
          mentorName: mentor?.name || null,
          mentorExpertise: mentor?.expertise || null,
          price: mentor?.pricePerSession || null,
          scheduledAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      })
      const data = await res.json()
      if (data.session) {
        setSessions((prev) => [data.session, ...prev])
        setBookOpen(false)
        setBookType("")
        setBookMentorId("")
      }
    } catch {
      // ignore
    }
    setBooking(false)
  }

  async function handleCancel(sessionId: string) {
    try {
      const res = await fetch(`/api/mentoring/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      })
      const data = await res.json()
      if (data.session) {
        setSessions((prev) => prev.map((s) => (s.id === sessionId ? data.session : s)))
      }
    } catch {
      // ignore
    }
  }

  const upcoming = sessions.filter((s) => s.status === "scheduled")
  const past = sessions.filter((s) => s.status !== "scheduled")

  if (loading) {
    return <div className="text-sm text-muted-foreground py-8 text-center">Loading...</div>
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Your Sessions {upcoming.length > 0 && `(${upcoming.length} upcoming)`}
          </h2>
          <p className="text-sm text-muted-foreground">Book a mentoring session or review past ones.</p>
        </div>
        <Dialog open={bookOpen} onOpenChange={setBookOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Book session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Book a Mentoring Session</DialogTitle>
              <DialogDescription>
                Choose a session type and optional mentor. Sessions are 60 minutes via video call.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Session type</p>
                <Select value={bookType} onValueChange={setBookType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessionTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {getSessionTypeLabel(t)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">Mentor (optional)</p>
                <Select value={bookMentorId} onValueChange={setBookMentorId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Any available mentor" />
                  </SelectTrigger>
                  <SelectContent>
                    {experts.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {e.name} — {e.expertise}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setBookOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleBook} disabled={!bookType || booking}>
                {booking ? "Booking..." : "Confirm booking"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No sessions yet</CardTitle>
            <CardDescription>
              Book your first mentoring session to get expert guidance on fundraising, growth, operations,
              financial planning, or product development.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Upcoming</h3>
              {upcoming.map((session) => {
                const mentor = experts.find((e) => e.name === session.mentorName)
                return (
                  <Card key={session.id}>
                    <CardContent className="flex items-start justify-between p-6">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <GraduationCap className="h-4 w-4 text-primary" />
                          <span className="font-medium text-foreground">
                            {getSessionTypeLabel(session.type)}
                          </span>
                        </div>
                        {session.mentorName && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <User className="h-3.5 w-3.5" />
                            {session.mentorName}
                          </div>
                        )}
                        {session.scheduledAt && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Calendar className="h-3.5 w-3.5" />
                            {new Date(session.scheduledAt).toLocaleDateString("en-US", {
                              weekday: "long",
                              year: "numeric",
                              month: "long",
                              day: "numeric",
                            })}
                          </div>
                        )}
                        {session.duration && (
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Clock className="h-3.5 w-3.5" />
                            {session.duration} minutes
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {session.price && (
                          <span className="text-sm font-medium text-foreground">
                            €{(session.price / 100).toFixed(2)}
                          </span>
                        )}
                        <Button variant="outline" size="sm" onClick={() => handleCancel(session.id)}>
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground">Past</h3>
              {past.map((session) => (
                <Card key={session.id}>
                  <CardContent className="flex items-start justify-between p-6">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {getSessionTypeLabel(session.type)}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${
                          session.status === "completed"
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {session.status}
                        </span>
                      </div>
                      {session.mentorName && (
                        <p className="text-sm text-muted-foreground pl-6">{session.mentorName}</p>
                      )}
                      {session.scheduledAt && (
                        <p className="text-sm text-muted-foreground pl-6">
                          {new Date(session.scheduledAt).toLocaleDateString("en-US", {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}
