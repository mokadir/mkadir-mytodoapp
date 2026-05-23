import { useState } from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import { ToastProvider } from "./components/Toast";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { Dashboard } from "./pages/Dashboard";


type AuthView = "login" | "register";

function AuthGate() {
  const [view, setView] = useState<AuthView>("login");
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) {
    return <Dashboard />;
  }

  if (view === "register") {
    return (
      <RegisterPage
        onSwitchToLogin={() => setView("login")}
      />
    );
  }

  return (
    <LoginPage
      onSwitchToRegister={() => setView("register")}
    />
  );
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <AuthGate />
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}


export default App;
