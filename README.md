# SimuLab

A browser-only simulation learning laboratory built with React, TypeScript, Vite, Tailwind CSS, Recharts and ExcelJS. No account, backend, database, Python runtime or external API is used by the application.

## Run locally

Requires Node.js 22.12+ (or 24) and npm.

```sh
npm ci
npm run dev
```

Open the Local URL printed by Vite, normally http://127.0.0.1:5173. On Windows, use `npm.cmd` if PowerShell blocks or stalls `npm.ps1`.

```sh
npm test
npm run build
npm run preview
```

The production output is `dist/`. Serve it over HTTP; do not open the built HTML as a file URL.

## GitHub Pages

1. Create a GitHub repository and push this project to its `main` branch, including `package-lock.json`.
2. In Settings → Pages → Build and deployment, select **GitHub Actions**.
3. The included `.github/workflows/deploy.yml` installs locked dependencies, runs tests, builds, and deploys `dist/`.
4. The deployment job reports the live Pages URL. Enable Pages before running the workflow. Repository/environment permissions may require an administrator.

Vite uses `base: './'` for both repository and root Pages paths. Navigation stays inside the application without server routes, avoiding deep-link 404s. No hosting credentials are included. This workspace has not been published to a GitHub repository by the application setup.

## Features

- Responsive nine-section workspace, dark/light themes, English/Arabic controls and RTL layout, fullscreen mode, reduced-motion support.
- Animated coin and accurate pip-grid die, one result per click, complete cell formulas, and live one-sheet XLSX simulations.
- Editable discrete distributions, CDM/CDF intervals, reproducible seeded FCFS simulation, first-arrival convention, step mode and clickable formula inspector with Arabic explanations.
- Shared or independent two-server queues with alternate, random or earliest-available routing.
- Exponential M/M/1 simulation and steady-state comparisons; unstable systems support finite simulation only.
- Waiting/service, arrival, queue length and server timeline charts; play/pause and scrub the queue animation.
- Birthday paradox page: pick a group size (2–100), fill a room with random birthdays and see who matches, compare your running tally and a 1,000-room simulation with the exact probability, and follow the probability curve.
- Seven Excel lessons, downloadable examples and editable manual practice problems.
- One-sheet live queue workbooks with RAND, VLOOKUP, server-routing formulas, statistics and a formula guide. F9 regenerates the simulation.

## Academic conventions and references

The provided screenshot (`لقطة الشاشة 2026-10-21 102001.png`) supplies the default single-server distributions: IAT 1–8 with probability .125 each; ST 1–6 with probabilities .10, .20, .30, .25, .10, .05. Its terminology NC, IAT, AT, ST, SS, ES, T in Q, T in S, Idle T S is retained. Its ten observed rows are an example, not a random seed that can be recovered.

The supplied one-page PDF (`طابور الصفين.pdf`) gives IAT [1,2,3,4] with probabilities [.25,.40,.20,.15], Ahmad ST [2,3,4,5] with [.30,.28,.25,.17], and Bakur ST [3,4,5,6] with [.35,.25,.20,.20]. These are the two-server defaults. It does not state a routing/tie rule. The app explicitly assumes A when both servers are idle or tied; otherwise an idle server or the earliest available is selected. Independent routing is selectable; “earliest available” uses known server completion times, not queue lengths.

Printed PDF intervals use rounded three-decimal endpoints. The implementation uses continuous half-open intervals `[lower, upper)` with random numbers in `[0,1)`, avoiding rounded gaps. CDM is the **lower** cumulative bound. Zero probability rows are skipped. Distribution sums are checked within 1e-8.

The server starts free at time zero. Discrete runs can start at zero or after a sampled IAT. M/M/1 always samples its first IAT. FCFS preserves customer order, including simultaneous arrivals. Service completion occurs before another arrival is counted as waiting at the same instant. Waiting is the interval `[AT,SS)`; zero waits are excluded.

The observation horizon is time zero through the last service completion. Total idle includes initial idle and, for two servers, terminal idle up to that common horizon. Aggregate two-server idle ratio divides idle server-time by `2 × horizon`. Per-server utilization uses its own busy time divided by the common horizon.

The professor’s **Server Effectiveness = Total Idle / Total Simulation Time** is preserved and explicitly labeled **idle ratio**, not utilization. Actual utilization is `1 − idle ratio`. For a zero-length horizon, ratios are reported as zero by convention; they have no physical interpretation.

M/M/1 theoretical measures require positive finite rates and λ < μ. Rates must share a time unit. Finite simulation starts empty, has no warm-up deletion or confidence intervals, and drains all arrivals before measuring its horizon. Consequently finite L, Lq, W and Wq estimates can differ from steady-state theory. L and Lq use time-integrated customer occupancy divided by the horizon. This is distinct from the user-defined discrete queue model.

## Workbook behavior

Every download contains exactly **one worksheet**. Inputs, simulation cells, statistics and the formula guide are together on that sheet. `src/excelFormulas.ts` is shared by the website and exporter, so the displayed cell addresses and formulas match the downloaded file.

- Coin: `B4=RAND()`; `B6=IF(B4<0.5,"Heads / صورة","Tails / كتابة")`.
- Dice: `B4=RANDBETWEEN(1,6)`; all nine cells in `B7:D9` contain IF/AND formulas that reference B4. The complete formulas, including the two always-empty pip positions, are shown on the website and worksheet.
- Discrete queues: RAND samples are mapped through ascending lower CDM bounds using `VLOOKUP(...,2,TRUE)`. Cumulative bounds, service times, server assignment, arrival/start/end times, waiting, idle and summary measures all recalculate. Editing the blue time/probability inputs updates the simulation. Probabilities must still sum to one; invalid inputs are flagged and dependent lookup calculations return #N/A.
- Two servers: visible previous/updated availability columns carry server state between customers. Shared and independent routing recalculate with each F9. U3 chooses shared/independent; U4 chooses alternate/random/shortest.
- M/M/1: `-LN(1-RAND())/rate` generates exponential times, with live rates in U5/U6 and stability-guarded theory. VLOOKUP is intentionally not used for exponential sampling.

Press **F9** (or **Fn+F9**) in desktop Excel. No VBA or macro permission is needed. Excel's random numbers are independent of the website seed, so each recalculation produces a new experiment. Customer count fixes the exported number of rows; generate a new download to change that count or add distribution rows. Large queues may take longer to recalculate, particularly the queue-length COUNTIFS column.

ExcelJS does not generate chart objects. Select simulation columns and use Excel Insert → Chart if desired. Formulas are stored in Excel's invariant syntax; when typing formulas manually, some regional Excel settings require semicolons instead of commas.
## Structure

`src/engine.ts`: pure probability, random and queue models. `src/export.ts`: lazy-loaded workbook generation. `src/content.ts`: lessons. `src/App.tsx`: reusable UI, chart, distribution and lesson components. `src/birthday.ts` / `src/Birthday.tsx`: birthday paradox math and page. `src/style.css`: theme, layout, animation and responsive styles. `src/engine.test.ts`: deterministic academic test cases.

## Practical limits

Queue runs are capped at 10,000 customers. Queue tables show the first 500 rows, customer charts the first 200, and Gantt timelines the first 80 per server; metrics and queue exports use all rows. Coin and dice each show one result and have no batch-trial controls. Queue playback shows at most 12 waiting customer markers while displaying the complete count. Reports are session-only and the most recent queue report replaces the previous one. Language/theme preferences are stored locally. Technical symbols, spreadsheet function names and some educational text remain English alongside Arabic UI/explanations. No certification of accessibility or cross-browser/device compatibility is claimed; test your target browsers before institutional deployment.

Reference discrepancy: the screenshot's service CDM entries do not consistently equal the cumulative sum of its displayed probabilities (for example, row 3 shows .5 rather than .3). SimuLab preserves the displayed probabilities and calculates mathematically consistent CDM bounds: 0, .1, .3, .6, .85, .95. This discrepancy is not treated as an alternative lookup rule.


## Verification

22 automated tests pass, including one-sheet XLSX round trips and formula/address consistency. Native Microsoft Excel recalculation was checked for single queue, two-server routing, M/M/1, coin thresholds and all six dice pip arrangements. The dice workbook was also downloaded from the running website and inspected. The development watcher ignores temporary Excel files to avoid Windows file-lock crashes. Large dependency chunks produce a non-fatal Vite size warning; ExcelJS is loaded only when exporting.
