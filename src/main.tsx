import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { AuthProvider } from "./auth";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import Songs from "./pages/Songs";
import SongPage from "./pages/SongPage";
import PrintChart from "./pages/PrintChart";
import Upload from "./pages/Upload";
import License from "./pages/License";
import Report from "./pages/Report";
import Login from "./pages/Login";
import MySongs from "./pages/MySongs";
import Admin from "./pages/Admin";
import "./styles/style.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/songs/:id/print" element={<PrintChart />} />
          <Route element={<Layout />}>
            <Route path="/" element={<Home />} />
            <Route path="/songs" element={<Songs />} />
            <Route path="/songs/:id" element={<SongPage />} />
            <Route path="/upload" element={<Upload />} />
            <Route path="/license" element={<License />} />
            <Route path="/report" element={<Report />} />
            <Route path="/login" element={<Login />} />
            <Route path="/my-songs" element={<MySongs />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="*" element={<main className="wrap"><p className="crumb" style={{ padding: "60px 0" }}>Page not found. <Link to="/">← Home</Link></p></main>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  </React.StrictMode>
);
