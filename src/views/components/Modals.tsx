/** @jsxImportSource hono/jsx */
export const Modals = () => {
  return (
    <>
      <div
        id="agenda-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-3xl p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative modal-content">
          <button
            id="close-agenda-modal"
            className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
          >
            &times;
          </button>
          <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-6">
            Full Agenda
          </h2>
          <div
            id="agenda-content"
            className="space-y-4 max-h-[60vh] overflow-y-auto"
          ></div>
        </div>
      </div>

      <div
        id="stats-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-3xl p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative modal-content">
          <button
            id="close-stats-modal"
            className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
          >
            &times;
          </button>
          <h2
            id="stats-name"
            className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-6"
          >
            Statistics for...
          </h2>
          <div
            id="stats-filters"
            className="flex flex-col items-center gap-2 mb-4 font-cinzel-decorative text-[#5c3d2e]"
          >
            <label>
              <select
                id="stripe-filter-select"
                className="bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 text-md focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]"
              >
                <option value="total">Total Stripes</option>
                <option value="drunk">Drunk Stripes</option>
                <option value="left">Stripes Left</option>
              </select>
            </label>
            <p
              id="remaining-stripes-display"
              className="font-bold text-lg text-[#c0392b] mt-2"
            ></p>
          </div>
          <div className="w-full h-80">
            <canvas id="stripe-chart"></canvas>
          </div>
        </div>
      </div>

      <div
        id="dice-randomizer-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-xl p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative modal-content"
      >
        <button
          id="close-dice-randomizer-modal"
          className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
        >
          &times;
        </button>
        <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-6">
          Dice Roller
        </h2>

        <div
          id="dice-list-container"
          className="space-y-3 mb-4 max-h-48 overflow-y-auto pr-2"
        ></div>

        <div className="flex items-center justify-center gap-4 mt-2 mb-4">
          <button
            id="dice-spin-btn"
            className="btn-ancient font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg flex-grow"
          >
            Roll All Dice
          </button>
          <button
            id="add-dice-btn"
            className="btn-ancient w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-md text-3xl font-bold"
            title="Add Die"
          >
            +
          </button>
        </div>

        <div id="dice-roulette-results" className="mt-4 text-center"></div>

        <div
          id="dice-punishment-assign-container"
          className="mt-6 pt-4 border-t-2 border-dotted border-[#b9987e] hidden"
        >
          <p className="font-cinzel-decorative text-lg text-[#6f4e37] mb-2 text-center">
            Assign Rolled Stripes:
          </p>
          <label htmlFor="assign-person-select" className="sr-only">
            Select Person
          </label>
          <select
            id="assign-person-select"
            className="w-full bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 text-md focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52] mb-4"
          ></select>
          <button
            id="assign-stripes-btn"
            className="btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg w-full"
          >
            Assign Stripes
          </button>
        </div>
      </div>
      </div>

      <div
        id="wheel-randomizer-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-xl p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative modal-content">
          <button
            id="close-wheel-randomizer-modal"
            className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
          >
            &times;
          </button>
          <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-6">
            Punishment Wheel
          </h2>

          <div className="flex flex-col items-center gap-4">
            <div className="wheel-container relative">
              <canvas id="wheel-canvas" width="320" height="320"></canvas>
              <div className="wheel-pointer" aria-hidden="true"></div>
            </div>

            <button
              id="wheel-spin-btn"
              className="btn-ancient font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg"
            >
              Spin the Wheel
            </button>
            <div
              id="wheel-result"
              className="text-center text-xl text-[#6f4e37] min-h-[28px]"
            ></div>

            <div
              id="wheel-punishment-assign-container"
              className="mt-2 w-full hidden"
            >
              <p className="font-cinzel-decorative text-lg text-center text-[#6f4e37] mb-2">
                Apply Outcome:
              </p>
              <select
                id="wheel-assign-person-select"
                className="w-full bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 text-md focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52] mb-3"
              ></select>
              <button
                id="wheel-assign-apply-btn"
                className="btn-punishment w-full font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg"
              >
                Apply to Selected
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        id="list-randomizer-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-xl p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative modal-content">
          <button
            id="close-list-randomizer-modal"
            className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
          >
            &times;
          </button>
          <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-6">
            Name Selector/Shuffler
          </h2>

          <p className="block text-lg font-cinzel-decorative text-[#5c3d2e] mb-2 text-center">
            Names are loaded from the Ledger of Punishments.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <button
              id="shuffle-list-btn"
              className="btn-ancient flex-grow font-cinzel-decorative font-bold py-3 px-4 md:px-6 rounded-md text-base md:text-lg"
            >
              Shuffle Names
            </button>
            <button
              id="pick-random-item-btn"
              className="btn-ancient flex-grow font-cinzel-decorative font-bold py-3 px-4 md:px-6 rounded-md text-base md:text-lg"
            >
              Pick Random Name
            </button>
          </div>

          <div>
            <div
              id="list-output"
              className="bg-[#e9e2d7] border-2 border-[#b9987e] rounded-md p-4 min-h-[60px] text-lg text-[#4a3024] whitespace-pre-wrap hidden"
            ></div>
          </div>

          <div
            id="list-punishment-assign-container"
            className="mt-6 pt-4 border-t-2 border-dotted border-[#b9987e] hidden"
          >
            <p className="font-cinzel-decorative text-lg text-[#6f4e37] mb-2 text-center">
              Assign Stripes to Selected Name:
            </p>
            <div className="flex items-center justify-center gap-2">
              <label htmlFor="list-assign-amount-input" className="sr-only">
                Number of Stripes
              </label>
              <input
                type="number"
                id="list-assign-amount-input"
                defaultValue="1"
                min="1"
                className="w-24 text-center bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]"
              />
              <button
                id="list-assign-stripes-btn"
                className="btn-punishment font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg"
              >
                Assign Stripes
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        id="randomizer-hub-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-4xl p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative modal-content">
          <button
            id="close-randomizer-hub-modal"
            className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
          >
            &times;
          </button>
          <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-8">
            Choose Randomizer
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {/* Name Randomizer Card */}
            <div
              className="randomizer-card group cursor-pointer transform transition-all duration-300 hover:scale-105"
              data-randomizer="list"
            >
              <div className="bg-gradient-to-br from-[#e9e2d7] to-[#d5ccc0] border-2 border-[#b9987e] rounded-lg p-4 md:p-6 h-full shadow-lg hover:shadow-xl">
                <div className="text-center mb-4">
                  <div className="text-5xl mb-3">🎯</div>
                  <h3 className="font-cinzel-decorative text-xl text-[#5c3d2e] mb-2">
                    Name Randomizer
                  </h3>
                </div>
                <p className="text-[#6f4e37] text-sm mb-4 text-center">
                  Shuffle names or pick a random person from the ledger. Perfect
                  for fair selections!
                </p>
                <button className="btn-ancient font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg w-full mt-4 group-hover:bg-[#8c6b52] transition-colors">
                  Choose
                </button>
              </div>
            </div>

            {/* Dice Roller Card */}
            <div
              className="randomizer-card group cursor-pointer transform transition-all duration-300 hover:scale-105"
              data-randomizer="dice"
            >
              <div className="bg-gradient-to-br from-[#e9e2d7] to-[#d5ccc0] border-2 border-[#b9987e] rounded-lg p-4 md:p-6 h-full shadow-lg hover:shadow-xl">
                <div className="text-center mb-4">
                  <div className="text-5xl mb-3">🎲</div>
                  <h3 className="font-cinzel-decorative text-xl text-[#5c3d2e] mb-2">
                    Dice Roller
                  </h3>
                </div>
                <p className="text-[#6f4e37] text-sm mb-4 text-center">
                  Roll multiple dice with customizable sides. Great for random
                  punishments!
                </p>
                <button className="btn-ancient font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg w-full mt-4 group-hover:bg-[#8c6b52] transition-colors">
                  Choose
                </button>
              </div>
            </div>

            {/* Punishment Wheel Card */}
            <div
              className="randomizer-card group cursor-pointer transform transition-all duration-300 hover:scale-105"
              data-randomizer="wheel"
            >
              <div className="bg-gradient-to-br from-[#e9e2d7] to-[#d5ccc0] border-2 border-[#b9987e] rounded-lg p-4 md:p-6 h-full shadow-lg hover:shadow-xl">
                <div className="text-center mb-4">
                  <div className="text-5xl mb-3">🎡</div>
                  <h3 className="font-cinzel-decorative text-xl text-[#5c3d2e] mb-2">
                    Punishment Wheel
                  </h3>
                </div>
                <p className="text-[#6f4e37] text-sm mb-4 text-center">
                  Spin the wheel of fate! Random outcomes from stripes to dice
                  rolls.
                </p>
                <button className="btn-ancient font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg w-full mt-4 group-hover:bg-[#8c6b52] transition-colors">
                  Choose
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div
        id="gemini-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-xl p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative modal-content">
          <button
            id="close-gemini-modal"
            className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
          >
            &times;
          </button>
          <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-6">
            Seek the Oracle's Judgement
          </h2>

          <p className="block text-lg text-[#5c3d2e] mb-4 text-center">
            Describe the transgression below, and the Oracle shall decree the
            consequence.
          </p>

          <textarea
            id="gemini-input"
            rows={4}
            placeholder="e.g., 'Noud spoke ill of the Schikko during the sacred feast...'"
            className="w-full bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-3 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]"
          ></textarea>

          <div className="text-center mt-4">
            <button
              id="gemini-submit-btn"
              className="btn-ancient font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg"
            >
              Consult the Oracle
            </button>
          </div>

          <div
            id="gemini-output"
            className="mt-6 p-4 min-h-[60px] text-lg text-center font-bold text-[#c0392b] whitespace-pre-wrap hidden"
          ></div>
        </div>
      </div>

      <div
        id="drunk-stripes-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-sm p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative modal-content">
          <button
            id="close-drunk-stripes-modal"
            className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
          >
            &times;
          </button>
          <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-6">
            Pour the Golden Liquid
          </h2>

          <p className="block text-lg text-[#5c3d2e] mb-2 text-center">
            How many draughts were consumed?
          </p>
          <p
            id="available-stripes-display"
            className="text-sm text-[#6f4e37] text-center mb-4"
          ></p>

          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              id="decrement-beers-btn"
              className="btn-ancient text-2xl font-bold px-4 py-2 rounded-md"
            >
              -
            </button>
            <input
              type="number"
              id="how-many-beers-input"
              defaultValue="1"
              min="1"
              className="w-24 text-center bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]"
            />
            <button
              id="increment-beers-btn"
              className="btn-ancient text-2xl font-bold px-4 py-2 rounded-md"
            >
              +
            </button>
          </div>

          <div className="text-center">
            <button
              id="confirm-drunk-stripes-btn"
              className="btn-ancient font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg"
            >
              Confirm Draughts
            </button>
          </div>
        </div>
      </div>

      <div
        id="bulk-stripes-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-sm p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative modal-content">
          <button
            id="close-bulk-stripes-modal"
            className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
          >
            &times;
          </button>
          <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-6">
            Bulk Stripe Management
          </h2>

          <p className="block text-lg text-[#5c3d2e] mb-2 text-center">
            How many stripes to add or remove?
          </p>
          <p
            id="bulk-stripes-person-display"
            className="text-sm text-[#6f4e37] text-center mb-4"
          ></p>

          <div className="flex items-center justify-center gap-4 mb-6">
            <button
              id="decrement-bulk-stripes-btn"
              className="btn-ancient text-2xl font-bold px-4 py-2 rounded-md"
            >
              -
            </button>
            <input
              type="number"
              id="how-many-bulk-stripes-input"
              defaultValue="1"
              min="-50"
              max="50"
              className="w-24 text-center bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]"
            />
            <button
              id="increment-bulk-stripes-btn"
              className="btn-ancient text-2xl font-bold px-4 py-2 rounded-md"
            >
              +
            </button>
          </div>

          <div className="text-center">
            <button
              id="confirm-bulk-stripes-btn"
              className="btn-ancient font-cinzel-decorative font-bold py-3 px-6 rounded-md text-lg"
            >
              Confirm Stripes
            </button>
          </div>
        </div>
      </div>

      <div
        id="drink-requests-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-3xl p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative modal-content">
          <button
            id="close-drink-requests-modal"
            className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
          >
            &times;
          </button>
          <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-6">
            Drink Requests
          </h2>
          <div
            id="drink-requests-content"
            className="space-y-3 max-h-[60vh] overflow-y-auto"
          ></div>
        </div>
      </div>

      <div
        id="generic-alert-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-md p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative text-center modal-content">
          <h2
            id="alert-title"
            className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-4"
          >
            A Declaration!
          </h2>
          <p id="alert-message" className="text-lg text-[#4a3024] mb-6">
            Message from the scribes.
          </p>
          <button
            id="alert-ok-btn"
            className="btn-ancient font-cinzel-decorative font-bold py-2 px-6 rounded-md text-lg"
          >
            Acknowledge
          </button>
        </div>
      </div>

      <div
        id="generic-confirm-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-60 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-md p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative text-center modal-content">
          <h2
            id="confirm-title"
            className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-4"
          >
            A Query!
          </h2>
          <p id="confirm-message" className="text-lg text-[#4a3024] mb-6">
            The Oracle requires a decision.
          </p>
          <div className="flex justify-center gap-4">
            <button
              id="confirm-yes-btn"
              className="btn-ancient font-cinzel-decorative font-bold py-2 px-6 rounded-md text-lg"
            >
              Aye
            </button>
            <button
              id="confirm-no-btn"
              className="btn-subtle-decree font-cinzel-decorative font-bold py-2 px-6 rounded-md text-lg"
            >
              Nay
            </button>
          </div>
        </div>
      </div>

      <div
        id="generic-prompt-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-md p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative text-center modal-content">
          <h2
            id="prompt-title"
            className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-4"
          >
            An Inquiry!
          </h2>
          <p id="prompt-message" className="text-lg text-[#4a3024] mb-4">
            Speak thy mind.
          </p>
          <input
            type="text"
            id="prompt-input"
            className="w-full bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-3 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52] mb-6"
          />
          <div className="flex justify-center gap-4">
            <button
              id="prompt-ok-btn"
              className="btn-ancient font-cinzel-decorative font-bold py-2 px-6 rounded-md text-lg"
            >
              Inscribe
            </button>
            <button
              id="prompt-cancel-btn"
              className="btn-subtle-decree font-cinzel-decorative font-bold py-2 px-6 rounded-md text-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div
        id="schikko-login-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-md p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative text-center modal-content">
          <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-4">
            Schikko Authentication
          </h2>
          <p className="text-lg text-[#4a3024] mb-4">
            Enter the 6-digit code from your authenticator app.
          </p>
          <input
            type="password"
            id="schikko-password-input"
            className="w-full bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-3 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52] mb-6"
            placeholder="Code or admin key"
          />
          <div className="flex justify-center gap-4">
            <button
              id="schikko-login-submit-btn"
              className="btn-ancient font-cinzel-decorative font-bold py-2 px-6 rounded-md text-lg"
            >
              Enter
            </button>
            <button
              id="schikko-login-cancel-btn"
              className="btn-subtle-decree font-cinzel-decorative font-bold py-2 px-6 rounded-md text-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div
        id="set-schikko-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-md p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative text-center modal-content">
          <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-4">
            Claim the Title of Schikko
          </h2>
          <p className="text-lg text-[#4a3024] mb-4">
            Enter thy first name and last name. After claiming, scan the QR code
            that appears and use your authenticator app to generate 6-digit
            codes.
          </p>
          <input
            type="text"
            id="set-schikko-firstname-input"
            className="w-full bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-3 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52] mb-4"
            placeholder="First name"
          />
          <input
            type="text"
            id="set-schikko-lastname-input"
            className="w-full bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-3 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52] mb-4"
            placeholder="Last name"
          />
          <div className="flex justify-center gap-4">
            <button
              id="set-schikko-submit-btn"
              className="btn-ancient font-cinzel-decorative font-bold py-2 px-6 rounded-md text-lg"
            >
              Claim Title
            </button>
            <button
              id="set-schikko-cancel-btn"
              className="btn-subtle-decree font-cinzel-decorative font-bold py-2 px-6 rounded-md text-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div
        id="totp-setup-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-md p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative text-center modal-content">
          <button
            id="close-totp-setup-modal"
            className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
          >
            &times;
          </button>
          <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-4">
            Set Up Authenticator
          </h2>
          <p className="text-lg text-[#4a3024] mb-4">
            Scan this QR with Google Authenticator, 1Password, or similar. Then
            confirm with a 6‑digit code to claim the title.
          </p>
          <div id="totp-qr" className="flex items-center justify-center mb-4"></div>
          <div className="text-left bg-[#e9e2d7] border-2 border-[#b9987e] rounded-md p-4 mb-2">
            <p className="text-sm text-[#6f4e37]">
              <strong>Secret:</strong>
              <span id="totp-secret" className="break-all"></span>
            </p>
            <pre id="totp-manual" className="text-sm mt-2 whitespace-pre-wrap"></pre>
          </div>
          <div className="mt-4 text-left">
            <p className="text-md text-[#4a3024] mb-2">
              Enter the 6‑digit code from your authenticator app:
            </p>
            <input
              type="text"
              id="totp-code-input"
              inputMode="numeric"
              pattern="\\d{6}"
              maxLength={6}
              placeholder="6-digit code"
              className="w-full bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-3 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]"
            />
            <div className="flex justify-center gap-4 mt-4">
              <button
                id="totp-confirm-btn"
                className="btn-ancient font-cinzel-decorative font-bold py-2 px-6 rounded-md text-lg"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      </div>

      <div
        id="edit-rule-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-md p-5 md:p-8 rounded-lg border-4 border-[#8c6b52] relative text-center modal-content">
          <h2
            id="edit-rule-title"
            className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-4"
          >
            Edit Decree
          </h2>
          <div className="text-left">
            <label
              htmlFor="edit-rule-text-input"
              className="block text-lg text-[#4a3024] mb-2"
            >
              Decree Text:
            </label>
            <textarea
              id="edit-rule-text-input"
              rows={4}
              className="w-full bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-3 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52] mb-4"
            ></textarea>

            <label
              htmlFor="edit-rule-tags-input"
              className="block text-lg text-[#4a3024] mb-2"
            >
              Tags (comma-separated):
            </label>
            <input
              type="text"
              id="edit-rule-tags-input"
              placeholder="e.g., Event, Meeting"
              className="w-full bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-3 text-lg focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52] mb-4"
            />

            <div id="existing-tags-container" className="mb-6"></div>
          </div>
          <div className="flex justify-center gap-4">
            <button
              id="edit-rule-ok-btn"
              className="btn-ancient font-cinzel-decorative font-bold py-2 px-6 rounded-md text-lg"
            >
              Update
            </button>
            <button
              id="edit-rule-cancel-btn"
              className="btn-subtle-decree font-cinzel-decorative font-bold py-2 px-6 rounded-md text-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div
        id="bulk-edit-rules-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-4xl h-[90vh] rounded-lg border-4 border-[#8c6b52] relative flex flex-col p-5 md:p-8 modal-content">
          <button
            id="close-bulk-edit-modal"
            className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
          >
            &times;
          </button>
          <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-4 flex-shrink-0">
            Bulk Edit Decrees
          </h2>
          <p className="text-center text-md text-[#6f4e37] mb-4 flex-shrink-0">
            Edit all decrees below. Each line is a new decree. Use
            <strong>#tag</strong> to add tags. <br />
            <span className="text-red-600 font-bold text-sm">
              WARNING: This will replace all existing decrees!
            </span>
          </p>

          <textarea
            id="bulk-rules-input"
            className="flex-grow w-full bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-4 text-lg font-mono focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52] mb-6 resize-none"
          ></textarea>

          <div className="flex justify-center gap-4 flex-shrink-0">
            <button
              id="bulk-edit-save-btn"
              className="btn-ancient font-cinzel-decorative font-bold py-3 px-8 rounded-md text-xl"
            >
              Save All Decrees
            </button>
            <button
              id="bulk-edit-cancel-btn"
              className="btn-subtle-decree font-cinzel-decorative font-bold py-3 px-8 rounded-md text-xl"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>

      <div
        id="logbook-modal"
        className="hidden fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center p-4 z-50 modal-backdrop"
      >
        <div className="bg-[#fdf8e9] w-full max-w-4xl h-[90vh] rounded-lg border-4 border-[#8c6b52] relative flex flex-col overflow-y-auto modal-content">
          <div className="p-5 md:p-8">
            <button
              id="close-logbook-modal"
              className="absolute top-2 right-4 text-3xl font-bold text-[#5c3d2e] hover:text-red-700"
            >
              &times;
            </button>
            <h2 className="font-cinzel-decorative text-3xl text-center text-[#5c3d2e] mb-4 flex-shrink-0">
              The Scribe's Logbook
            </h2>
            <p className="text-center text-md text-[#6f4e37] mb-6 flex-shrink-0">
              A record of all deeds from the past 30 days.
            </p>

            <div className="flex flex-col md:flex-row gap-4 mb-4 flex-shrink-0">
              <input
                type="text"
                id="logbook-search-input"
                placeholder="Search logs..."
                className="flex-grow bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 text-md focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]"
              />
              <select
                id="logbook-filter-select"
                className="bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 text-md focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]"
              >
                <option value="all">All Actions</option>
                <option value="punishment">Punishments</option>
                <option value="rules">Decree Changes</option>
                <option value="ledger">Ledger Changes</option>
                <option value="schikko">Schikko Actions</option>
                <option value="guest">Guest Actions</option>
              </select>
              <select
                id="logbook-sort-select"
                className="bg-[#f5eeda] border-2 border-[#b9987e] rounded-md p-2 text-md focus:outline-none focus:border-[#8c6b52] focus:ring-1 focus:ring-[#8c6b52]"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
              </select>
            </div>

            <div className="w-full h-64 mb-4 flex-shrink-0">
              <canvas id="logbook-chart"></canvas>
            </div>

            <div id="logbook-content" className="flex-grow space-y-2 pr-2"></div>
          </div>
        </div>
      </div>
    </>
  );
};
