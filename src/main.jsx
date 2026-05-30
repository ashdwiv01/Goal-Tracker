import React from "react";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import CareerTracker from "../career_tracker.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <CareerTracker />
  </StrictMode>
);
