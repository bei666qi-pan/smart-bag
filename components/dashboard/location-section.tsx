"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MapPin, Navigation, Shield, Clock } from "lucide-react"

const recentLocations = [
  { time: "14:30", location: "Classroom 3-B", status: "current" as const },
  { time: "12:15", location: "Cafeteria", status: "past" as const },
  { time: "10:00", location: "Library", status: "past" as const },
  { time: "08:30", location: "School Gate", status: "past" as const },
]

export function LocationSection() {
  return (
    <>
      {/* <!-- SECTION:LOCATION --> */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <MapPin className="h-5 w-5 text-foreground" />
          <h2 className="text-lg font-semibold text-foreground">Location</h2>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {/* Map Placeholder */}
          <Card className="lg:col-span-2 border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Navigation className="h-4 w-4" />
                Live Map
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative h-80 w-full overflow-hidden rounded-lg bg-muted">
                {/* Grid pattern background */}
                <div
                  className="absolute inset-0"
                  style={{
                    backgroundImage:
                      "linear-gradient(rgba(0,0,0,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.03) 1px, transparent 1px)",
                    backgroundSize: "24px 24px",
                  }}
                />
                {/* Center pin */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary shadow-lg">
                      <MapPin className="h-5 w-5 text-primary-foreground" />
                    </div>
                    <div className="h-6 w-px bg-primary/30" />
                    <div className="h-3 w-3 rounded-full bg-primary/20" />
                  </div>
                </div>
                {/* Overlay stats */}
                <div className="absolute left-3 top-3 flex flex-col gap-2">
                  <Badge variant="secondary" className="text-xs font-mono">
                    <Navigation className="mr-1.5 h-3 w-3" />
                    Speed: 0 km/h
                  </Badge>
                  <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                    <Shield className="mr-1.5 h-3 w-3" />
                    Zone: Safe
                  </Badge>
                </div>
                {/* Coordinates */}
                <div className="absolute bottom-3 right-3">
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    31.2304°N, 121.4737°E
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Location History */}
          <Card className="border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Clock className="h-4 w-4" />
                Location History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {recentLocations.map((loc, i) => (
                  <div key={i} className="flex items-start gap-3">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                      <div
                        className={`mt-1 h-2.5 w-2.5 rounded-full ${
                          loc.status === "current"
                            ? "bg-primary ring-4 ring-primary/10"
                            : "bg-muted-foreground/30"
                        }`}
                      />
                      {i < recentLocations.length - 1 && (
                        <div className="mt-1 h-8 w-px bg-border" />
                      )}
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {loc.location}
                      </span>
                      <span className="font-mono text-xs text-muted-foreground">
                        {loc.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      {/* <!-- /SECTION:LOCATION --> */}
    </>
  )
}
