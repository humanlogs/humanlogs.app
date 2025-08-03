import { Button } from "../../components/ui/button";

export function Dashboard() {
  return (
    <div className="h-full flex flex-col items-center justify-center">
      <div className="text-center space-y-6 max-w-md">
        <div className="h-20 w-20 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
          <svg
            className="h-10 w-10 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
            />
          </svg>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Start a new transcription</h1>
          <p className="text-muted-foreground">
            or choose from your recent transcriptions on the left bar
          </p>
        </div>

        <Button size="lg" className="px-8">
          Upload Audio File
        </Button>
      </div>
    </div>
  );
}
