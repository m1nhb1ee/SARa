import { RouterProvider } from "react-router";
import { router } from "./routes";
import { AuthProvider } from "@/api/authContext";
import "../styles/fonts.css";

export default function App() {
  return (
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  );
}
