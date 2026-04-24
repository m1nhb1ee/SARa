import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { Dashboard } from "./pages/Dashboard";
import { CaseListPage } from "./pages/CaseListPage";
import { PracticePage } from "./pages/PracticePage";
import { DiagnosisTrainingPage } from "./pages/DiagnosisTrainingPage";
import { DiagnosisSession } from "./pages/DiagnosisSession";
import { AnswerKey } from "./pages/AnswerKey";
import { Performance } from "./pages/Performance";
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
      { path: "cases", Component: CaseListPage },
      { path: "practice", Component: PracticePage },
      { path: "training/:caseId", Component: DiagnosisTrainingPage },
      { path: "session/:caseId", Component: DiagnosisSession },
      { path: "answer-key/:caseId", Component: AnswerKey },
      { path: "performance", Component: Performance },
      { path: "*", Component: ComingSoon },
    ],
  },
]);