type TranscriptionPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function TranscriptionPage({
  params,
}: TranscriptionPageProps) {
  const { id } = await params;

  return (
    <div className="flex flex-col flex-1 p-8">
      <div className="w-full max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Transcription Details</h1>
          <p className="text-muted-foreground">ID: {id}</p>
        </div>

        <div className="bg-card rounded-lg border p-8">
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">
              Transcription details will be displayed here
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
