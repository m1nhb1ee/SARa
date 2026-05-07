import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { Dashboard } from "./pages/Dashboard";
import { WelcomePage } from "./pages/WelcomePage";
import { PracticePage } from "./pages/PracticePage";
import { UploadPage } from "./pages/UploadPage";
import { DiagnosisTrainingPage } from "./pages/DiagnosisTrainingPage";
import { DiagnosisSession } from "./pages/DiagnosisSession";
import { AnswerKey } from "./pages/AnswerKey";
import { ProfilePage } from "./pages/Performance";
import { SwapPage } from "./pages/SwapPage";
import { SwapSessionPage } from "./pages/SwapSessionPage";
import { ComingSoon } from "./pages/ComingSoon";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/register",
    Component: RegisterPage,
  },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: "home", Component: WelcomePage },
      { path: "upload", Component: UploadPage },
      { path: "practice", Component: PracticePage },
      { path: "training/:caseId", Component: DiagnosisTrainingPage },
      { path: "session/:caseId", Component: DiagnosisSession },
      { path: "answer-key/:caseId", Component: AnswerKey },
      { path: "swap", Component: SwapPage },
      { path: "swap/session/:sessionId", Component: SwapSessionPage },
      { path: "performance", Component: ProfilePage },
      { path: "*", Component: ComingSoon },
    ],
  },
]);
