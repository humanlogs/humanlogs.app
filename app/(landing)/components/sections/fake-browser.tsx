"use client";

export const FakeBrowser = () => {
  return (
    <div className="bg-gray-100 rounded-t-xl border border-gray-200 border-b-0">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white rounded-t-xl">
        {/* Traffic lights */}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400" />
          <div className="w-3 h-3 rounded-full bg-yellow-400" />
          <div className="w-3 h-3 rounded-full bg-green-400" />
        </div>

        {/* Address bar */}
        <div className="flex-1 ml-2 bg-gray-50 rounded-md px-3 py-1.5 text-sm text-gray-500 flex items-center gap-2">
          <svg
            className="h-4 w-4 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          <span className="truncate">humanlogs.app/app</span>
        </div>
      </div>
    </div>
  );
};
