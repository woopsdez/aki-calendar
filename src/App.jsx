import { HashRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import EventPage from "./pages/EventPage";

// HashRouter を使う理由：GitHub Pages のような純静的ホスティングでも
// /e/xxx の直リンクが 404 にならない（URLは /#/e/xxx になる）。
// Vercel等でクリーンURLにしたくなったら BrowserRouter + リライト設定へ。
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/e/:id" element={<EventPage />} />
      </Routes>
    </HashRouter>
  );
}
