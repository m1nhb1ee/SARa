import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { Dashboard } from "./pages/Dashboard";
import { DiagnosisSession } from "./pages/DiagnosisSession";
import { AnswerKey } from "./pages/AnswerKey";
import { Performance } from "./pages/Performance";
import { ComingSoon } from "./pages/ComingSoon";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: Dashboard },
      { path: "session/:caseId", Component: DiagnosisSession },
      { path: "answer-key/:caseId", Component: AnswerKey },
      { path: "performance", Component: Performance },
      { path: "*", Component: ComingSoon },
    ],
  },
]);