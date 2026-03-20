export default function NewTranscriptionPage() {
  return (
    <div className="flex flex-col flex-1 p-8">
      <div className="w-full max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">New Transcription</h1>
          <p className="text-muted-foreground">
            Upload an audio file to create a new transcription
          </p>
        </div>

        <div className="bg-card rounded-lg border p-8">
          <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
            <p className="text-muted-foreground">
              Transcription form will be implemented here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
