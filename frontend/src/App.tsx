import { useUser } from "@/features/user/use-user";
import { AuthenticatedLayout } from "@/layouts/authenticated";
import { Dashboard } from "@/views/private/dashboard";
import { LoginPage } from "@/views/public/login";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";

function App() {
  const { user } = useUser();
  const isAuthenticated = !!user.data;

  if (user.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        {!isAuthenticated ? (
          // Public routes (not authenticated)
          <>
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </>
        ) : (
          // Private routes (authenticated)
          <Route element={<AuthenticatedLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/login" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        )}
      </Routes>
    </BrowserRouter>
  );
}

export default App;
