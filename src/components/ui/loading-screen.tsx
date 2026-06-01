"use client"

interface LoadingScreenProps {
  icon: React.ComponentType<{ className?: string }>
  text: string
}

export function LoadingScreen({ icon: Icon, text }: LoadingScreenProps) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Icon className="h-8 w-8 animate-pulse text-primary" />
        <p className="text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}
