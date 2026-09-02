import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./auth";
import { I18nProvider, useI18n } from "./i18n";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Songs from "./pages/Songs";
import New from "./pages/New";
import SongPage from "./pages/SongPage";
import PrintChart from "./pages/PrintChart";
import SheetMusic from "./pages/SheetMusic";
import Upload from "./pages/Upload";
import License from "./pages/License";
import Report from "./pages/Report";
import Library from "./pages/Library";
import Login from "./pages/Login";
import MySongs from "./pages/MySongs";
import Profile from "./pages/Profile";
import Transcribe from "./pages/Transcribe";
import EditSong from "./pages/EditSong";
import PreviewSubmission from "./pages/PreviewSubmission";
import Terms from "./pages/Terms";
import Writer from "./pages/Writer";
import CallForSongs from "./pages/CallForSongs";
import "./styles/style.css";

function NotFound() {
  const { t } = useI18n();
  return <main className="wrap"><p className="crumb" style={{ padding: "60px 0" }}>{t("Page not found.")} <Link to="/">{t("← Home")}</Link></p></main>;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/songs/:id/print" element={<PrintChart />} />
            <Route path="/songs/:id/sheet" element={<SheetMusic />} />
            <Route path="/preview/submission/:id" element={<PreviewSubmission />} />
            <Route element={<Layout />}>
              <Route path="/" element={<Home />} />
              <Route path="/songs" element={<Songs />} />
              <Route path="/new" element={<New />} />
              <Route path="/songs/:id" element={<SongPage />} />
              <Route path="/songs/:id/transcribe" element={<Transcribe />} />
              <Route path="/songs/:id/edit" element={<EditSong />} />
              <Route path="/upload" element={<Upload />} />
              <Route path="/license" element={<License />} />
              <Route path="/call-for-songs" element={<CallForSongs />} />
              <Route path="/report" element={<Report />} />
              <Route path="/library" element={<Library />} />
              <Route path="/login" element={<Login />} />
              <Route path="/my-songs" element={<MySongs />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/terms" element={<Terms />} />
              <Route path="/writers/:name" element={<Writer />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  </React.StrictMode>
);
