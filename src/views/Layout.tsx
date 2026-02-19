/** @jsxImportSource hono/jsx */
import { html } from "hono/html";
import { type Child } from "hono/jsx";

export const Layout = (props: { children: Child; title?: string; version?: string }) => {
  return (
    <html lang="en" data-app-version={props.version || "0.0.0"}>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>{props.title || "Loading…"}</title>
        <meta name="application-name" content="" />
        <meta name="apple-mobile-web-app-title" content="" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="icon" type="image/png" href="/assets/favicon.png" />
        {/* Tailwind CSS with fallback */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            // Fallback for Tailwind CSS if CDN is blocked
            window.tailwindCSSFallback = function () {
              const style = document.createElement("style");
              style.textContent = \`
                      /* Basic Tailwind fallback styles */
                      .flex { display: flex; }
                      .flex-col { flex-direction: column; }
                      .flex-grow { flex-grow: 1; }
                      .flex-shrink-0 { flex-shrink: 0; }
                      .items-center { align-items: center; }
                      .justify-center { justify-content: center; }
                      .justify-between { justify-content: space-between; }
                      .gap-2 { gap: 0.5rem; }
                      .gap-4 { gap: 1rem; }
                      .hidden { display: none; }
                      .relative { position: relative; }
                      .absolute { position: absolute; }
                      .fixed { position: fixed; }
                      .inset-0 { top: 0; right: 0; bottom: 0; left: 0; }
                      .w-full { width: 100%; }
                      .h-full { height: 100%; }
                      .w-12 { width: 3rem; }
                      .h-12 { height: 3rem; }
                      .w-14 { width: 3.5rem; }
                      .h-14 { height: 3.5rem; }
                      .w-16 { width: 4rem; }
                      .h-16 { height: 4rem; }
                      .w-20 { width: 5rem; }
                      .h-20 { height: 5rem; }
                      .w-24 { width: 6rem; }
                      .h-24 { height: 6rem; }
                      .w-32 { width: 8rem; }
                      .h-32 { height: 8rem; }
                      .w-48 { width: 12rem; }
                      .h-48 { height: 12rem; }
                      .w-56 { width: 14rem; }
                      .h-56 { height: 14rem; }
                      .w-64 { width: 16rem; }
                      .h-64 { height: 16rem; }
                      .w-80 { width: 20rem; }
                      .h-80 { height: 20rem; }
                      .max-w-3xl { max-width: 48rem; }
                      .max-w-4xl { max-width: 56rem; }
                      .max-w-md { max-width: 28rem; }
                      .max-w-sm { max-width: 24rem; }
                      .max-w-xl { max-width: 36rem; }
                      .min-h-screen { min-height: 100vh; }
                      .p-2 { padding: 0.5rem; }
                      .p-3 { padding: 0.75rem; }
                      .p-4 { padding: 1rem; }
                      .p-6 { padding: 1.5rem; }
                      .p-8 { padding: 2rem; }
                      .px-2 { padding-left: 0.5rem; padding-right: 0.5rem; }
                      .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
                      .px-4 { padding-left: 1rem; padding-right: 1rem; }
                      .px-6 { padding-left: 1.5rem; padding-right: 1.5rem; }
                      .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
                      .py-3 { padding-top: 0.75rem; padding-bottom: 0.75rem; }
                      .py-4 { padding-top: 1rem; padding-bottom: 1rem; }
                      .py-6 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
                      .m-2 { margin: 0.5rem; }
                      .m-4 { margin: 1rem; }
                      .mt-2 { margin-top: 0.5rem; }
                      .mt-4 { margin-top: 1rem; }
                      .mt-6 { margin-top: 1.5rem; }
                      .mt-8 { margin-top: 2rem; }
                      .mb-2 { margin-bottom: 0.5rem; }
                      .mb-4 { margin-bottom: 1rem; }
                      .mb-6 { margin-bottom: 1.5rem; }
                      .mb-8 { margin-bottom: 2rem; }
                      .ml-2 { margin-left: 0.5rem; }
                      .ml-4 { margin-left: 1rem; }
                      .mr-2 { margin-right: 0.5rem; }
                      .mr-4 { margin-right: 1rem; }
                      .text-xs { font-size: 0.75rem; line-height: 1rem; }
                      .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
                      .text-base { font-size: 1rem; line-height: 1.5rem; }
                      .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
                      .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
                      .text-2xl { font-size: 1.5rem; line-height: 2rem; }
                      .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
                      .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
                      .text-5xl { font-size: 3rem; line-height: 1; }
                      .text-6xl { font-size: 3.75rem; line-height: 1; }
                      .font-bold { font-weight: 700; }
                      .font-cinzel-decorative { font-family: 'Cinzel Decorative', cursive; }
                      .font-medieval-sharp { font-family: 'MedievalSharp', cursive; }
                      .text-center { text-align: center; }
                      .text-left { text-align: left; }
                      .text-right { text-align: right; }
                      .rounded-md { border-radius: 0.375rem; }
                      .rounded-lg { border-radius: 0.5rem; }
                      .border { border-width: 1px; }
                      .border-2 { border-width: 2px; }
                      .border-4 { border-width: 4px; }
                      .border-t { border-top-width: 1px; }
                      .border-b { border-bottom-width: 1px; }
                      .border-l { border-left-width: 1px; }
                      .border-r { border-right-width: 1px; }
                      .border-dotted { border-style: dotted; }
                      .bg-transparent { background-color: transparent; }
                      .bg-black { background-color: rgb(0 0 0); }
                      .bg-opacity-70 { background-color: rgb(0 0 0 / 0.7); }
                      .cursor-pointer { cursor: pointer; }
                      .overflow-x-auto { overflow-x: auto; }
                      .overflow-y-auto { overflow-y: auto; }
                      .whitespace-nowrap { white-space: nowrap; }
                      .whitespace-pre-wrap { white-space: pre-wrap; }
                      .break-all { word-break: break-all; }
                      .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.5rem; }
                      .space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top: 0.75rem; }
                      .space-y-4 > :not([hidden]) ~ :not([hidden]) { margin-top: 1rem; }
                      .space-y-5 > :not([hidden]) ~ :not([hidden]) { margin-top: 1.25rem; }
                      .grid { display: grid; }
                      .grid-cols-1 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
                      .grid-cols-3 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
                      .transform { transform: translateX(var(--tw-translate-x, 0)) translateY(var(--tw-translate-y, 0)) rotate(var(--tw-rotate, 0)) skewX(var(--tw-skew-x, 0)) skewY(var(--tw-skew-y, 0)) scaleX(var(--tw-scale-x, 1)) scaleY(var(--tw-scale-y, 1)); }
                      .transition-all { transition-property: all; transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1); transition-duration: 150ms; }
                      .duration-300 { transition-duration: 300ms; }
                      .hover\\:scale-105:hover { --tw-scale-x: 1.05; --tw-scale-y: 1.05; }
                      .hover\\:bg-[#8c6b52]:hover { background-color: rgb(140 107 82); }
                      .hover\\:text-red-700:hover { color: rgb(185 28 28); }
                      .hover\\:text-red-800:hover { color: rgb(153 27 27); }
                      .hover\\:text-red-100:hover { color: rgb(254 226 226); }
                      .hover\\:bg-[#f5eeda]:hover { background-color: rgb(245 238 218); }
                      .focus\\:outline-none:focus { outline: 2px solid transparent; outline-offset: 2px; }
                      .focus\\:border-[#8c6b52]:focus { border-color: rgb(140 107 82); }
                      .focus\\:ring-1:focus { --tw-ring-offset-shadow: var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color); --tw-ring-shadow: var(--tw-ring-inset) 0 0 0 calc(1px + var(--tw-ring-offset-width)) var(--tw-ring-offset-color); box-shadow: var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000); }
                      .focus\\:ring-[#8c6b52]:focus { --tw-ring-color: rgb(140 107 82); }
                      @media (min-width: 640px) {
                          .sm\\:p-6 { padding: 1.5rem; }
                          .sm\\:text-lg { font-size: 1.125rem; line-height: 1.75rem; }
                          .sm\\:flex-row { flex-direction: row; }
                          .sm\\:flex-nowrap { flex-wrap: nowrap; }
                          .sm\\:inline { display: inline; }
                      }
                      @media (min-width: 768px) {
                          .md\\:p-12 { padding: 3rem; }
                          .md\\:text-xl { font-size: 1.25rem; line-height: 1.75rem; }
                          .md\\:text-2xl { font-size: 1.5rem; line-height: 2rem; }
                          .md\\:flex-row { flex-direction: row; }
                          .md\\:flex-nowrap { flex-wrap: nowrap; }
                      }
                      @media (min-width: 1024px) {
                          .lg\\:p-16 { padding: 4rem; }
                          .lg\\:text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
                          .lg\\:text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
                          .lg\\:text-5xl { font-size: 3rem; line-height: 1; }
                          .lg\\:text-6xl { font-size: 3.75rem; line-height: 1; }
                      }
                  \`;
              document.head.appendChild(style);
              console.warn("Tailwind CSS CDN blocked, using fallback styles");
            };
          `,
          }}
        />
        <script
          src="https://cdn.tailwindcss.com"
          onerror="window.tailwindCSSFallback()"
          data-critical="true"
        ></script>

        {/* Google Fonts with fallback */}
        <link
          href="https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@400;700&family=MedievalSharp&family=Lora:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap"
          rel="stylesheet"
          onerror="console.warn('Google Fonts blocked, using system fonts')"
          data-critical="true"
        />

        {/* Chart.js with fallback */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            window.chartJSFallback = function () {
              console.warn("Chart.js CDN blocked, charts will not be available");
              // Create a minimal Chart constructor to prevent errors
              window.Chart = function () {
                console.warn("Chart.js not loaded - charts disabled");
              };
            };
          `,
          }}
        />
        <script
          src="https://cdn.jsdelivr.net/npm/chart.js@4.4.3/dist/chart.umd.min.js"
          integrity="sha384-JUh163oCRItcbPme8pYnROHQMC6fNKTBWtRG3I3I0erJkzNgL7uxKlNwcrcFKeqF"
          crossorigin="anonymous"
          referrerpolicy="no-referrer"
          onerror="window.chartJSFallback()"
          data-critical="true"
        ></script>

        {/* Chart.js adapter with fallback */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            window.chartAdapterFallback = function () {
              console.warn(
                "Chart.js adapter CDN blocked, date charts may not work properly"
              );
            };
          `,
          }}
        />
        <script
          src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"
          integrity="sha384-cVMg8E3QFwTvGCDuK+ET4PD341jF3W8nO1auiXfuZNQkzbUUiBGLsIQUE+b1mxws"
          crossorigin="anonymous"
          referrerpolicy="no-referrer"
          onerror="window.chartAdapterFallback()"
        ></script>

        {/* ICAL.js with fallback */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            window.icalJSFallback = function () {
              console.warn(
                "ICAL.js CDN blocked, calendar functionality will be limited"
              );
              // Create a minimal ICAL object to prevent errors
              window.ICAL = {
                parse: function () {
                  return { components: [] };
                },
                Component: function () {
                  return {
                    getAllSubcomponents: function () {
                      return [];
                    },
                  };
                },
                Event: function () {
                  return {
                    isRecurring: function () {
                      return false;
                    },
                  };
                },
              };
            };
          `,
          }}
        />
        <script
          src="https://cdnjs.cloudflare.com/ajax/libs/ical.js/1.5.0/ical.min.js"
          integrity="sha512-0izBc1upGYnrS1u1MX7QR+sjFIxZWxLVdNI7cUoHHCutDr5ENjuQRZuS+v+3NFNGfwHSrPoHzBzED0rV651tGw=="
          crossorigin="anonymous"
          referrerpolicy="no-referrer"
          onerror="window.icalJSFallback()"
        ></script>

        <link rel="stylesheet" href="/style.css?v=1.0" />
        <link rel="stylesheet" href="/randomizer/randomizer.css" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
            /* Prevents the default arrow from showing on the details summary */
            summary::-webkit-details-marker {
              display: none;
            }
            summary {
              list-style-type: none;
            }
            /* CSS to control edit mode visibility */
            .rule-actions {
              display: none;
            }
            .rules-list-editing .rule-actions {
              display: flex;
            }
            /* Style to make edit mode more visible */
            #rules-list.rules-list-editing {
              background-color: rgba(185, 152, 126, 0.1);
              border: 2px dashed rgba(185, 152, 126, 0.5);
              border-radius: 8px;
              padding: 1rem;
            }
            /* Style for the range slider */
            input[type="range"] {
              -webkit-appearance: none;
              appearance: none; /* Added for compatibility */
              background: transparent;
              width: 100%;
              margin: 10px 0;
            }
            input[type="range"]:focus {
              outline: none;
            }
            input[type="range"]::-webkit-slider-thumb {
              -webkit-appearance: none;
              height: 24px;
              width: 16px;
              border-radius: 3px;
              background: #8c6b52;
              cursor: pointer;
              margin-top: -8px; /* You need to specify a margin in Chrome, but in Firefox and IE it is automatic */
              border: 2px solid #5c3d2e;
            }
            input[type="range"]::-webkit-slider-runnable-track {
              width: 100%;
              height: 8px;
              cursor: pointer;
              background: #b9987e;
              border-radius: 5px;
            }
          `,
          }}
        />
      </head>
      <body className="font-medieval-sharp text-gray-900 flex flex-col min-h-screen p-4 sm:p-6 lg:p-8 leading-relaxed">
        {props.children}

        {/* Global Loading Overlay */}
        <div
          id="loading-overlay"
          className="loading-overlay hidden"
          role="status"
          aria-live="polite"
          aria-label="Loading"
        >
          <div className="loading-box">
            <div className="loading-spinner" aria-hidden="true"></div>
            <div id="loading-text" className="loading-text">
              Loading...
            </div>
          </div>
        </div>

        {/* Service Worker */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            if ("serviceWorker" in navigator) {
              window.addEventListener("load", () => {
                navigator.serviceWorker.register("/sw.js").then(
                  (registration) => {
                    console.log(
                      "ServiceWorker registration successful with scope: ",
                      registration.scope
                    );
                    // Proactively check for an updated service worker on load
                    try {
                      registration.update();
                    } catch (e) {}
                  },
                  (err) => {
                    console.log("ServiceWorker registration failed: ", err);
                  }
                );
              });
      
              // Reload the page when the service worker tells us to
              navigator.serviceWorker.addEventListener("message", (event) => {
                if (event.data && event.data.type === "reload") {
                  window.location.reload();
                }
              });
      
              // Fallback: reload once when the controller changes to the new SW
              let refreshing = false;
              navigator.serviceWorker.addEventListener("controllerchange", () => {
                if (refreshing) return;
                refreshing = true;
                window.location.reload();
              });
            }
          `,
          }}
        />

        {/* Canvas Confetti with fallback */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            window.confettiFallback = function () {
              console.warn(
                "Canvas Confetti CDN blocked, celebration effects disabled"
              );
              // Create a minimal confetti function to prevent errors
              window.confetti = function () {
                console.log("Confetti effect blocked by extension");
              };
            };
          `,
          }}
        />
        <script
          src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js"
          onerror="window.confettiFallback()"
        ></script>

        {/* QRCode.js with fallback */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
            window.qrcodeFallback = function () {
              console.warn("QRCode.js CDN blocked, QR code generation disabled");
              // Create a minimal QRCode constructor to prevent errors
              window.QRCode = function () {
                console.warn("QRCode generation not available");
              };
            };
          `,
          }}
        />
        <script
          src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"
          crossorigin="anonymous"
          referrerpolicy="no-referrer"
          onerror="window.qrcodeFallback()"
        ></script>

        <script
          dangerouslySetInnerHTML={{
            __html: `
            // Global error handling and resource detection
            window.addEventListener(
              "error",
              function (e) {
                if (e.target.tagName === "SCRIPT" || e.target.tagName === "LINK") {
                  console.warn(
                    "External resource blocked or failed to load:",
                    e.target.src || e.target.href
                  );
                  
                  // Only show UI alert for resources marked as critical
                  if (!e.target.hasAttribute("data-critical")) {
                      return;
                  }
      
                  // Show user-friendly message about blocked resources
                  if (!window.resourceWarningShown) {
                    window.resourceWarningShown = true;
                    const warningDiv = document.createElement("div");
                    warningDiv.style.cssText = \`
                              position: fixed;
                              top: 10px;
                              right: 10px;
                              background: #f8d7da;
                              color: #721c24;
                              padding: 10px 15px;
                              border-radius: 5px;
                              border: 1px solid #f5c6cb;
                              font-size: 14px;
                              z-index: 10000;
                              max-width: 300px;
                              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                          \`;
                    warningDiv.innerHTML = \`
                              <strong>Resource Blocked</strong><br>
                              Some external resources were blocked by your browser extensions.
                              The app will continue to work with limited functionality.
                              <button onclick="this.parentElement.remove()" style="
                                  background: #721c24;
                                  color: white;
                                  border: none;
                                  padding: 2px 8px;
                                  border-radius: 3px;
                                  margin-left: 10px;
                                  cursor: pointer;
                              ">×</button>
                          \`;
                    document.body.appendChild(warningDiv);
      
                    // Auto-remove after 10 seconds
                    setTimeout(() => {
                      if (warningDiv.parentElement) {
                        warningDiv.remove();
                      }
                    }, 10000);
                  }
                }
              },
              true
            );
      
            // Check for critical dependencies and provide fallbacks
            function checkDependencies() {
              const checks = [
                {
                  name: "Chart.js",
                  check: () => typeof window.Chart !== "undefined",
                  fallback: window.chartJSFallback,
                },
                {
                  name: "ICAL.js",
                  check: () => typeof window.ICAL !== "undefined",
                  fallback: window.icalJSFallback,
                },
                {
                  name: "Confetti",
                  check: () => typeof window.confetti !== "undefined",
                  fallback: window.confettiFallback,
                },
                {
                  name: "QRCode",
                  check: () => typeof window.QRCode !== "undefined",
                  fallback: window.qrcodeFallback,
                },
              ];
      
              checks.forEach((dep) => {
                if (!dep.check()) {
                  console.warn(\`\${dep.name} not available, applying fallback\`);
                  if (typeof dep.fallback === "function") {
                    dep.fallback();
                  }
                }
              });
            }
      
            // Run dependency checks after DOM is loaded
            if (document.readyState === "loading") {
              document.addEventListener("DOMContentLoaded", checkDependencies);
            } else {
              checkDependencies();
            }
      
            // Add button click error handling
            document.addEventListener("click", function (e) {
              const button = e.target.closest("button");
              if (button && button.onclick) {
                const originalHandler = button.onclick;
                button.onclick = function (event) {
                  try {
                    return originalHandler.call(this, event);
                  } catch (error) {
                    console.error("Button click error:", error);
                    // Show user-friendly error message
                    const errorMsg = document.createElement("div");
                    errorMsg.style.cssText = \`
                                  position: fixed;
                                  bottom: 20px;
                                  left: 50%;
                                  transform: translateX(-50%);
                                  background: #f8d7da;
                                  color: #721c24;
                                  padding: 10px 20px;
                                  border-radius: 5px;
                                  border: 1px solid #f5c6cb;
                                  font-size: 14px;
                                  z-index: 10000;
                                  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
                              \`;
                    errorMsg.textContent =
                      "Action failed. Some features may be limited due to blocked resources.";
                    document.body.appendChild(errorMsg);
      
                    // Auto-remove after 3 seconds
                    setTimeout(() => {
                      if (errorMsg.parentElement) {
                        errorMsg.remove();
                      }
                    }, 3000);
      
                    return false;
                  }
                };
              }
            });
          `,
          }}
        />
        <script
          src="/js/main.js?v=1.4"
          type="module"
          data-critical="true"
        ></script>
      </body>
    </html>
  );
};
