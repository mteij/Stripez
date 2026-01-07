/** @jsxImportSource hono/jsx */
import { Layout } from "./Layout";
import { Modals } from "./components/Modals";

export const Index = (props: { title?: string }) => {
  return (
    <Layout title={props.title}>
      <div className="w-full max-w-4xl bg-[#fdf8e9] shadow-2xl rounded-lg border-4 border-[#8c6b52] border-opacity-80 p-6 sm:p-10 md:p-14 relative flex-grow mx-auto">
        <div className="absolute top-2 left-2 w-12 h-12 border-t-4 border-l-4 border-[#a58467]"></div>
        <a
          href="https://webapps.astatine.utwente.nl/minnie/"
          target="_blank"
          rel="noopener noreferrer"
          className="absolute top-4 left-4 btn-ancient btn-minnie text-xs font-bold py-1 px-2 rounded-md"
        >
          Minnie
        </a>
        <div className="absolute top-2 right-2 w-12 h-12 border-t-4 border-r-4 border-[#a58467]"></div>
        <div className="absolute bottom-2 left-2 w-12 h-12 border-b-4 border-l-4 border-[#a58467]"></div>
        <div className="absolute bottom-2 right-2 w-12 h-12 border-b-4 border-r-4 border-[#a58467]"></div>

        <header className="text-center mb-4 pb-4">
          <h1
            id="main-title"
            className="font-cinzel-decorative text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-[#5c3d2e] tracking-wider"
          >
            <span id="main-title-text" className="app-fade app-fade-slow"></span>
            <span id="live-badge" className="live-badge hidden">
              <span className="live-dot"></span> LIVE
            </span>
          </h1>
          {/* Removed hardcoded Schikko Rules tagline to avoid flashing wrong brand */}
          <div
            id="countdown-container"
            className="mt-4 flex justify-center items-center gap-2"
          >
            <span
              id="countdown"
              className="font-cinzel-decorative text-xl text-red-700"
            ></span>
            <button
              id="edit-app-date-btn"
              className="btn-calendar-icon hidden"
              title="Edit Event Date"
            >
              &#x270E;
            </button>
          </div>

          {/* Stripe‑o‑meter (visible only during the event) */}
          <div id="stripe-o-meter" className="hidden mt-4">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="text-[#6f4e37] font-cinzel-decorative text-sm uppercase tracking-wider">
                Stripe‑o‑meter
              </span>
              <span className="text-xl">🍺</span>
            </div>
            <div className="stripe-meter">
              <div id="stripe-meter-fill" className="stripe-meter-fill"></div>
            </div>
            <div className="flex items-center justify-between mt-1 text-sm text-[#6f4e37]">
              <span id="stripe-meter-counts" className="font-bold"></span>
              <span id="stripe-meter-left" className="font-bold"></span>
            </div>
          </div>

          <div id="calendar-section" className="calendar-container">
            <div id="upcoming-event" className="upcoming-event-text">
              Loading upcoming activities...
            </div>
            <button
              id="full-agenda-btn"
              className="btn-calendar-icon"
              title="View Full Agenda"
            >
              &#x1F4C5;
            </button>
            <button
              id="edit-calendar-btn"
              className="btn-calendar-icon"
              title="Edit Calendar Link"
            >
              &#x270E;
            </button>
          </div>
        </header>

        <main>
          <ol className="roman-list text-base sm:text-lg md:text-xl leading-snug sm:leading-relaxed text-[#4a3024]">
            <li>
              The Schikko is chosen by sacred overbidding, each soul raising the
              burden until one alone dares bear it.
            </li>
            <li>
              All must obey the Schikko’s decrees, for his word is law within
              the circle.
            </li>
            <li>
              He who defies the rules shall drink the Golden Liquid, aka a
              Stripe, during the
              <span
                id="app-name-inline"
                className="opacity-0 transition-opacity duration-700"
              ></span>
              until penance is made.
            </li>
          </ol>

          <div
            id="show-decrees-container"
            className="flex justify-center items-center gap-4 mt-8"
          >
            <button
              id="show-decrees-btn"
              className="btn-subtle-decree font-cinzel-decorative font-bold py-2 px-4 rounded-md text-base cursor-pointer focus:outline-none flex items-center justify-center space-x-2"
              data-state="collapsed"
            >
              <span>Schikko's Decrees</span>
              <span className="decree-arrow"></span>
            </button>
            <button
              id="open-gemini-from-hub-btn"
              className="btn-oracle-invoke font-cinzel-decorative font-bold py-2 px-4 rounded-md text-base"
            >
              Oracle's Judgement
            </button>
            <button
              id="set-schikko-btn"
              className="btn-ancient font-cinzel-decorative font-bold py-2 px-4 rounded-md text-base hidden"
            >
              Set Schikko
            </button>
          </div>

          <div id="decrees-content" className="hidden mt-6">
            <div className="pt-4 border-t-4 border-dotted border-[#b9987e]">
              <div className="flex flex-col sm:flex-row items-center justify-end gap-2 mb-4">
                <input
                  type="text"
                  id="rule-search-input"
                  placeholder="Search decrees..."
                  className="flex-grow bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 h-11 text-md focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]"
                />
                <select
                  id="rule-tag-filter"
                  className="bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 h-11 text-md focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]"
                ></select>
                <button
                  id="add-decree-btn"
                  className="btn-ancient w-[44px] h-[44px] flex items-center justify-center rounded-md text-2xl font-bold hidden"
                  title="Add Decree"
                >
                  +
                </button>
                <button
                  id="bulk-edit-btn"
                  className="btn-ancient text-md h-11 px-3 rounded-md hidden flex items-center justify-center font-bold"
                  title="Open Bulk Editor"
                >
                  Bulk Edit
                </button>
                <button
                  id="edit-rules-btn"
                  className="btn-ancient text-md h-11 px-3 rounded-md hidden flex items-center justify-center"
                >
                  Edit Decrees
                </button>
              </div>

              <ol
                id="rules-list"
                className="roman-list text-lg md:text-xl leading-relaxed text-[#4a3024] space-y-5"
                start={4}
              ></ol>
            </div>
          </div>
        </main>

        <div className="section-divider"></div>

        <section id="punishment-ledger">
          <header className="text-center mb-8">
            <h2 className="font-cinzel-decorative text-3xl md:text-4xl font-bold text-[#5c3d2e]">
              The Ledger of Punishments
            </h2>
            <p className="text-md text-[#6f4e37] mt-1">
              A Record of Transgressions
            </p>
          </header>

          <div className="flex flex-wrap sm:flex-nowrap gap-4 mb-8">
            <button
              id="open-logbook-btn"
              className="btn-ancient flex-shrink-0 px-4 rounded-md text-2xl flex items-center justify-center"
              title="Open Logbook"
            >
              📖
            </button>
            <button
              id="open-randomizer-hub-btn"
              className="btn-ancient flex-shrink-0 px-4 rounded-md text-2xl flex items-center justify-center"
              title="Open Randomizers"
            >
              👑
            </button>
            <button
              id="open-drink-requests-btn"
              className="btn-ancient flex-shrink-0 px-4 rounded-md text-2xl flex items-center justify-center"
              title="Open Drink Requests"
            >
              ✔️
            </button>
            <input
              type="text"
              id="main-input"
              placeholder="Search or Inscribe Name..."
              className="flex-grow bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-3 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]"
              list="ledger-names"
            />
            <datalist id="ledger-names"></datalist>
            <button
              id="add-btn"
              className="btn-ancient w-[56px] h-[56px] flex items-center justify-center rounded-md text-3xl font-bold hidden"
              title="Inscribe Name"
            >
              +
            </button>
            <div className="flex-shrink-0 relative btn-ancient font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg">
              <span id="sort-button-text">Sort: A-Z</span>
              <select
                id="sort-select"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              >
                <option value="default">Default</option>
                <option value="asc">A-Z</option>
                <option value="desc">Z-A</option>
                <option value="stripes_desc">Most Stripes</option>
                <option value="stripes_asc">Least Stripes</option>
              </select>
            </div>
          </div>

          <div id="punishment-list" className="space-y-4">
            <div id="loading-state" className="text-center text-xl text-[#6f4e37]">
              Loading the sacred ledger...
            </div>
          </div>
        </section>

        <div className="section-divider"></div>

        <footer className="text-center mt-12 pt-6">
          <div id="schikko-login-container" className="mb-4 hidden">
            <button
              id="schikko-login-btn"
              className="text-[#6f4e37] hover:text-[#5c3d2e] transition-colors duration-300 font-bold underline"
            >
              Schikko Login
            </button>
          </div>
          <div id="app-info-footer" className="text-base text-[#4a3024] mt-4"></div>

          <div className="mt-6 flex justify-center items-center gap-2">
            <a
              href="https://github.com/MichielEijpe/schikko-rules"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#6f4e37] hover:text-[#5c3d2e] transition-colors duration-300"
              title="View on GitHub"
            >
              <svg
                aria-hidden="true"
                className="octicon octicon-mark-github"
                height="24"
                version="1.1"
                viewBox="0 0 16 16"
                width="24"
              >
                <path
                  fillRule="evenodd"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-2.01-.23-4.12-1-4.12-4.44 0-.98.35-1.78.92-2.42-.1-.23-.4-.96.09-2.42 0 0 .8-.24 2.64.92.76-.21 1.56-.31 2.36-.31.8 0 1.59.1 2.36.31 1.84-1.16 2.64-.92 2.64-.92.49 1.46.19 2.19.09 2.42.57.64.92 1.43.92 2.42 0 3.46-2.11 4.21-4.12 4.44.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.19 0 .21.15.46.55.38C13.71 14.53 16 11.54 16 8c0-4.42-3.58-8-8-8z"
                ></path>
              </svg>
            </a>
            <span
              id="app-version"
              className="text-xs text-[#6f4e37] font-cinzel-decorative"
            >
              vloading…
            </span>
          </div>
        </footer>
      </div>

      <Modals />
    </Layout>
  );
};
