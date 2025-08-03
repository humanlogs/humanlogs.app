import { useParams } from "react-router-dom";

export function TranscriptionApp() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="h-full flex flex-col">
      <div className="border-b pb-4 mb-6">
        <h1 className="text-2xl font-bold">Transcription</h1>
        <p className="text-muted-foreground">ID: {id}</p>
      </div>

      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="h-16 w-16 mx-auto rounded-full bg-muted flex items-center justify-center">
            <svg
              className="h-8 w-8 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold">Transcription App</h2>
          <p className="text-muted-foreground max-w-md">
            This is where the transcription interface will be implemented.
            Features will include audio playback, text editing, and export
            options.
          </p>
        </div>
      </div>
    </div>
  );
}
