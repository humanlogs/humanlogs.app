export default () => {
  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-gray-100 p-4">
      <h1 className="text-3xl font-bold text-gray-800">Server Overload</h1>
      <p className="text-lg text-gray-600">
        Our servers are currently experiencing high traffic. Please try again
        later.
      </p>
      <a href="/app/login" className="text-blue-500 hover:underline">
        Go back to Home
      </a>
    </div>
  );
};
