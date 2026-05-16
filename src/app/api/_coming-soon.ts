import { NextResponse } from "next/server"

export function comingSoonResponse(feature: string) {
  return NextResponse.json(
    {
      status: "coming_soon",
      feature,
      message: `${feature} is planned but not available yet.`,
    },
    { status: 501 },
  )
}
