import React, { Suspense, lazy, useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  NavLink,
} from "react-router-dom";
import ErrorBoundary from "./components/ErrorBoundary";
import { DossierProvider } from "./hooks/useDossier";
import { initSmartPreloading } from "./utils/lazyImports";
import { backgroundProcessor } from "./services/backgroundProcessor";
import "./App.css";

// Lazy load components
const Upload = lazy(() => import("./components/Upload"));
const Screening = lazy(() => import("./components/Screening"));
const Review = lazy(() => import("./components/Review"));
const ProductChecker = lazy(() => import("./components/ProductChecker"));
const StandaloneChecker = lazy(() => import("./components/StandaloneChecker"));
const PerformanceTest = lazy(() => import("./components/PerformanceTest"));

function App() {
  useEffect(() => {
    initSmartPreloading();

    // Start initial background tasks
    backgroundProcessor.preloadComponents();

    // Cleanup on app unmount
    return () => {
      backgroundProcessor.clearHistory();
    };
  }, []);

  return (
    <ErrorBoundary>
      <DossierProvider>
        <Router>
          <Suspense
            fallback={
              <div style={{ padding: "20px", textAlign: "center" }}>
                Loading...
              </div>
            }
          >
            <Routes>
              {/* Standalone checker route */}
              <Route path="/checker" element={<StandaloneChecker />} />
              
              {/* Main app routes with navigation */}
              <Route path="/*" element={
                <div className="app">
                  <nav className="nav">
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <h1>ProgrammoCeuticals</h1>
                      <div className="nav-links">
                        <NavLink
                          to="/upload"
                          className={({ isActive }) =>
                            isActive ? "nav-link active" : "nav-link"
                          }
                        >
                          📤 Upload
                        </NavLink>
                        <NavLink
                          to="/screening"
                          className={({ isActive }) =>
                            isActive ? "nav-link active" : "nav-link"
                          }
                        >
                          🔍 Screening
                        </NavLink>
                        <NavLink
                          to="/review"
                          className={({ isActive }) =>
                            isActive ? "nav-link active" : "nav-link"
                          }
                        >
                          📋 Review
                        </NavLink>
                        <NavLink
                          to="/product-checker"
                          className={({ isActive }) =>
                            isActive ? "nav-link active" : "nav-link"
                          }
                        >
                          🔍 Product Checker
                        </NavLink>
                        <NavLink
                          to="/performance"
                          className={({ isActive }) =>
                            isActive ? "nav-link active" : "nav-link"
                          }
                        >
                          🚀 Performance
                        </NavLink>
                      </div>
                    </div>
                  </nav>
                  <main className="main-content">
                    <Routes>
                      <Route path="/" element={<Navigate to="/upload" replace />} />
                      <Route path="/upload" element={<Upload />} />
                      <Route path="/screening" element={<Screening />} />
                      <Route path="/review" element={<Review />} />
                      <Route path="/product-checker" element={<ProductChecker />} />
                      <Route path="/performance" element={<PerformanceTest />} />
                    </Routes>
                  </main>
                  <footer className="app-footer">
                    <p>Built by ProgrammoCeuticals</p>
                  </footer>
                </div>
              } />
            </Routes>
          </Suspense>
        </Router>
      </DossierProvider>
    </ErrorBoundary>
  );
}

export default App;
