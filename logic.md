## System Purpose

The Bodyshop Efficiency System is designed to evaluate and improve workshop performance by translating operational inputs into clear, actionable business insights.

The system serves four primary functions:

### 1. Diagnostic Framework
Provide a structured analysis of the current bodyshop operations by quantifying key performance indicators such as repair volume, time per repair, and resource utilization.

### 2. Operational Insight
Generate clear insights into how the workshop is currently performing, highlighting efficiency levels, throughput, and productivity in measurable terms.

### 3. Bottleneck Analysis
Identify constraints and inefficiencies within the workflow that limit output, increase repair time, or reduce overall operational capacity.

### 4. ROI Estimation
Calculate the financial impact of process improvements, new products, or workflow changes by estimating time savings, cost differences, and net financial value.


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## System Core Logic

The system is designed to compare:

- Current State (user workshop reality, using user-supplied product data)
- Optimized State (using internal company product data)

Benchmarks are NOT used as a comparison target, but as a reconstruction layer to complete missing operational data.

---

### Data Flow

1. User provides operational inputs and current product data
2. System reconstructs full current operational model using benchmarks for any missing values
3. Internal company data is applied to simulate the optimized state
4. System calculates delta between current and optimized

---

### Modeling Rule

Benchmarks are ONLY used for:
- missing values
- default assumptions
- structural completion

Benchmarks are NEVER used for:
- final comparison
- ROI calculations
- decision output

---

### Data Availability Modes

The system operates in two modes depending on whether internal company data is available. The system must detect which mode applies at runtime and execute only the layers that are fully resolvable.

---

#### Mode A — Diagnostic Only (no company data)

**Requires:** User input + benchmarks only

**Produces:** Full current-state analysis. No optimized state, no ROI, no delta.

```
Available layers and models:

✅ Operational Layer — models 1–7 (demand, capacity, labour utilisation)
✅ Bottleneck Layer — models 2–7 (throughput, bottleneck detection, capacity gap,
                                   actual_repairs_completed)
✅ Operational Layer — model 8 (flow efficiency)
✅ Consumption Layer — models 1–4, 6 (usage, cost, workload distribution, deviation)
   ⚠️  Model 5 (Process Cost Contribution) requires total_workload_hours from model 4 — run 4 first
✅ Logic Layer — models 1, 2, 3, 6, 7
   (utilisation classification, booth classification, system status,
    consumption classification, combined scenario)

❌ Operational Layer — models 7b, 7c (optimized utilisation — needs improvement_factor)
❌ Bottleneck Layer — model 8 (constraint shift — needs improvement_factor)
❌ Impact Layer — all models (need company product data and improvement_factor)
❌ Logic Layer — models 4, 5 (savings type, recommendation — need Impact Layer outputs)
❌ ROI output
```

**Output to user:** Current state diagnostic report — utilisation, bottleneck identification, capacity gap, material cost baseline, benchmark deviation. Clearly communicates that optimization comparison is not yet available.

---

#### Mode B — Full Comparison (company data available)

**Requires:** User input + benchmarks + internal company data

**Produces:** Full current vs optimized comparison including ROI.

```
Full execution order:

1. Data Source Layer
   (User Input + Benchmarks + Internal Company Data)

2. Operational Layer — models 1–7d
   [produces: prep_capacity_hours, paint_capacity_hours,
    booth_capacity_hours, labour_hours_available, utilisation]

3. Bottleneck Layer — models 2–7
   [depends on: capacity hours from step 2]
   [produces: system_throughput_per_year, actual_repairs_completed,
    capacity_gap, bottleneck_process]
   Internal order: 2→3→4→5→6→7→1
   (model 1 depends on model 5 at runtime despite appearing first in the document)

4. Operational Layer — model 8 (Flow Efficiency)
   [depends on: system_throughput_per_year from step 3]

5. Consumption Layer — models 1–6
   Internal order: model 4 before model 5

6. Impact Layer — models 0–8
   [depends on: actual_repairs_completed, improvement_factor,
    company product data]

7. Bottleneck Layer — model 8 (Constraint Shift)
   [depends on: improvement_factor from company data]

8. Logic Layer — all models
   [depends on: utilisation, optimized_utilisation, deviation_pct,
    capacity_gap, net_value, roi_pct]

9. ROI + Output
```

---

#### Mode Detection Rule

```
IF all of the following are available:
  - product_usage_per_repair
  - product_price_per_unit
  - improvement_factor (or stage-specific equivalents)
  - investment_cost
THEN mode = "Full Comparison"
ELSE mode = "Diagnostic Only"
```

If partial company data is available (e.g. product pricing but no improvement factor), the system runs Mode A and clearly marks which additional inputs are needed to unlock Mode B.

> ⚠️ The system must never silently skip a model or return a null output without communicating to the user why that output is unavailable and what input is needed to resolve it.

---

### Cycle Time Duality — Authoritative Rule

This system uses two distinct time measures for repair work. Using the wrong one in a formula is a calculation error.

| Variable | Value | What it measures | Used in |
|---|---|---|---|
| `average_labour_time_per_repair` | 5.5h | Direct labour only (prep + paint). Booth drying time is excluded — it does not consume billable labour hours. | Labour utilisation, labour demand, FTE |
| `current_cycle_time_per_repair` | 7.5h | Total elapsed time per repair including booth occupancy (prep + paint + booth). | Throughput scheduling, time savings, financial impact |

**Rule:** Financial savings from time reduction are calculated on `labour_time_saved_per_repair` (5.5h base), not `cycle_time_saved_per_repair` (7.5h base). Applying `labour_cost_per_hour` to booth time savings overstates savings because the painter is not necessarily billing during the booth drying phase.

**labour_fraction** is the ratio of billable labour time to total cycle time:
```
labour_fraction = average_labour_time_per_repair / current_cycle_time_per_repair
               = 5.5 / 7.5 = 0.733
```
This is used in the Impact Layer to correctly attribute financial savings only to the labour portion of time saved.

---

### Canonical Variable Names

The following names are the single authoritative standard. All layers must use exactly these names.

| Concept | Canonical Name |
|---|---|
| User's current product usage per repair | `user_product_usage_per_repair` |
| User's current product price per unit | `user_product_price_per_unit` |
| Company product usage per repair | `product_usage_per_repair` |
| Company product price per unit | `product_price_per_unit` |
| User's current material cost per repair | `cost_per_repair` |
| Company (optimized) material cost per repair | `optimized_cost_per_repair` |
| Improvement factor | `improvement_factor` |
| Current cycle time (scheduling) | `current_cycle_time_per_repair` |
| Optimized cycle time (scheduling) | `optimized_cycle_time_per_repair` |
| Labour time saved per repair | `labour_time_saved_per_repair` |
| Labour available hours per worker per year | `labour_available_hours` |
| Booth available hours per booth per year | `booth_available_hours` |

> ⚠️ `usage_per_repair_product`, `improved_factor`, `new_cost_per_repair`, `current_cost_per_repair` are legacy naming errors. Treat any occurrence as the canonical equivalent above.

---

### Final Comparison

ALL outputs must be based on:

```
delta = optimized_state - current_state
```


_____________________


## Logic Layer

### Scenario Classification

This layer interprets calculated metrics and classifies the workshop into clear operational scenarios.
All inputs to this layer are produced by earlier layers — this layer only classifies, never calculates.

---

### 1. Utilisation Classification Model
**Purpose:** Classify workshop labour utilisation — applied to both current and optimized state.

**Formula:**
```
IF utilisation < 0.70  → utilisation_scenario = "Underutilised"
IF utilisation >= 0.70 AND utilisation <= 0.90 → utilisation_scenario = "Balanced"
IF utilisation > 0.90  → utilisation_scenario = "Overloaded"
```

Apply the same thresholds to `optimized_utilisation` → `optimized_utilisation_scenario`.

**Output:**
- `utilisation_scenario`
- `optimized_utilisation_scenario`

**Insight:**
- Underutilised → unused capacity, growth opportunity
- Balanced → optimal efficiency range
- Overloaded → system under pressure, risk of delays and bottlenecks

---

### 2. Booth Utilisation Classification Model
**Formula:**
```
IF booth_utilisation < 0.70  → booth_utilisation_scenario = "Underutilised"
IF booth_utilisation >= 0.70 AND booth_utilisation <= 0.90 → booth_utilisation_scenario = "Balanced"
IF booth_utilisation > 0.90  → booth_utilisation_scenario = "Overloaded"
```

**Output:** `booth_utilisation_scenario`

**Insight:** A workshop can show balanced labour utilisation while booths are overloaded. This model catches that divergence.

---

### 3. System Status Model
**Formula:**
```
IF capacity_gap >= 0 → system_status = "Excess capacity"
IF capacity_gap < 0  → system_status = "Under capacity"
```

**Output:** `system_status`

---

### 4. Savings Type Classification Model
**Mode:** Requires Mode B (`utilisation` is available in Mode A, but this model feeds the Impact Layer output presentation which only exists in Mode B).
**Purpose:** Determine whether time savings translate to real cost reduction or capacity gains.

**Formula:**
```
IF utilisation >= 0.90 → savings_type = "Cost saving"
IF utilisation < 0.90  → savings_type = "Capacity gain"
```

**Output:** `savings_type`

**Insight:**
- Cost saving (≥90% utilisation) → the workshop is fully loaded; freed time directly reduces labour cost or overtime
- Capacity gain (<90% utilisation) → the workshop has slack; freed time creates potential for more repairs but does not directly reduce cost
- The financial savings formula produces the same number regardless; this classification tells the output layer how to present and label the result to the user

> ℹ️ Threshold rationale: the binary 1.0 cutoff was replaced with 0.90. In practice, a shop running at 90–99% utilisation is already incurring overtime or prioritisation costs, so time savings translate to real money. Shops below 90% are converting time savings into capacity headroom, not direct cost reduction.

**Output layer rule:**
```
IF savings_type = "Cost saving"   → present financial_savings_per_year as "Labour cost reduction"
IF savings_type = "Capacity gain" → present financial_savings_per_year as "Equivalent capacity value"
                                    AND add note: "Realised only if additional repair volume is captured"
```

---

### 5. Recommendation Signal Model
**Mode:** Requires Mode B (`net_value` and `roi_pct` are only available in Mode B).
**Purpose:** Provide an explicit go/no-go signal based on net value and ROI.

**Formula:**
```
IF investment_cost = 0 AND net_value > 0  → recommendation = "Adopt — no cost, positive return"
IF investment_cost = 0 AND net_value <= 0 → recommendation = "Do not adopt — no benefit"
IF investment_cost > 0 AND roi_pct > 0    → recommendation = "Positive ROI — recommend adoption"
IF investment_cost > 0 AND roi_pct <= 0   → recommendation = "Negative ROI — do not recommend"
```

**Output:** `recommendation`

**Insight:** Prevents the system from silently outputting a negative ROI without a clear signal. The recommendation flag is the authoritative output for the decision layer.

---

### 6. Consumption Classification Model
**Formula:**
```
IF deviation_pct > 0  → consumption_scenario = "Consumption-heavy"
IF deviation_pct <= 0 → consumption_scenario = "Efficient"
```

**Note on sign convention:** `deviation_pct` is positive when the user uses MORE than benchmark (inefficient). This is the inverse of the general delta convention (positive = improvement). Downstream logic must handle this explicitly.

**Output:** `consumption_scenario`

---

### 7. Combined Scenario Interpretation (Optional)
**Logic:**
```
IF utilisation < 0.70 AND deviation_pct > 0  → "Low utilisation + high waste"
IF utilisation > 0.90 AND deviation_pct > 0  → "Overloaded + inefficient"
IF utilisation >= 0.70 AND utilisation <= 0.90 AND deviation_pct <= 0 → "Optimised operation"
```

**Output:** `combined_scenario`


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Data Source Layer

### User Input

This section defines all variables provided by the user to represent the current state of their workshop and their current product.

---

### 1. Repairs per Year
**Source:** User input

**Output:** `repairs_per_year` (repairs/year)

**Insight:** This is requested repair volume, not actual completed volume. See `actual_repairs_completed` in the Bottleneck Layer for the capacity-constrained figure.

---

### 2. Preparation Workers
**Source:** User input

**Output:** `preparation_workers` (workers)

---

### 3. Spray Painters
**Source:** User input

**Output:** `spray_painters` (workers)

---

### 4. Booths
**Source:** User input

**Output:** `amount_spraybooths` (units)

---

### 5. Labour Cost per Hour
**Source:** User input (advanced override available)

**Default fallback:** Use benchmark `labour_cost_per_hour` if not provided.

**Output:** `labour_cost_per_hour` (currency/hour)

---

### 6. Working Days per Year
**Source:** User input (advanced override available)

**Default:** `working_days_per_year = 240`

**Output:** `working_days_per_year` (days/year)

---

### 7. User Product Usage per Repair
**Purpose:** Define how much of the user's current product they use per repair.

**Source:** User input (advanced override available)

**Default fallback:** Use `benchmark_usage_per_repair` if not provided.

**Output:** `user_product_usage_per_repair` (units/repair)

**Insight:** This is the user's current-state consumption. It is the correct baseline for the Consumption Layer and for the benchmark deviation calculation. It is distinct from `product_usage_per_repair` (the company's product), which belongs to the optimized state.

---

### 8. User Product Price per Unit
**Purpose:** Define the cost per unit of the user's current product.

**Source:** User input (advanced override available)

**Default fallback:** Use `benchmark_usage_per_repair` × estimated market rate if not provided.

**Output:** `user_product_price_per_unit` (currency/unit)

**Insight:** Used to calculate the user's current material cost per repair. Distinct from `product_price_per_unit` (company product price).

_____________________


### Industry Benchmarks

This section defines standardised reference values used when user data is unavailable.

> ⚠️ Advanced Input Override: All values marked [overridable] can be replaced by user-supplied values. When overridden, the benchmark value is not used for that variable.

---

### 1. Average Labour Time per Repair
**Purpose:** Standard direct labour time per repair (prep + paint only).

**Source:** Benchmark data [overridable]

**Formula:**
```
average_labour_time_per_repair = average_preparation_time_per_repair + average_paint_time_per_repair
                               = 3 + 2.5 = 5.5
```

**Output:** `average_labour_time_per_repair` (hours/repair) = 5.5

**Insight:** Booth cycle time is NOT included — it represents equipment occupancy, not billable labour time. Used for labour utilisation and labour demand calculations only.

> ⚠️ `total_time_per_repair` was previously defined as a separate benchmark with the same formula and value. It has been removed. `average_labour_time_per_repair` is the single canonical variable for labour time per repair.

---

### 2. Preparation Time per Repair
**Source:** Benchmark data [overridable]

**Formula:** `average_preparation_time_per_repair = 3`

**Output:** `average_preparation_time_per_repair` (hours/repair)

---

### 3. Paint Time per Repair
**Source:** Benchmark data [overridable]

**Formula:** `average_paint_time_per_repair = 2.5`

**Output:** `average_paint_time_per_repair` (hours/repair)

---

### 4. Booth Cycle Time per Repair
**Source:** Benchmark data [overridable]

**Formula:** `average_booth_cycle_time_per_repair = 2`

**Output:** `average_booth_cycle_time_per_repair` (hours/repair)

**Insight:** Total booth occupancy per repair including active painting and curing/drying time.

> ⚠️ Booth cycle time is used only for booth throughput and booth utilisation calculations. It must NOT be added to `total_workload_hours` (double-counting), and booth time savings must NOT be valued at `labour_cost_per_hour` without applying `labour_fraction` (financial overstatement).

---

### 5. Benchmark Usage per Repair
**Purpose:** Industry reference for material usage per repair, used for deviation comparison.

**Source:** Benchmark data [overridable]

**Output:** `benchmark_usage_per_repair` (units/repair)

---

### 6. Working Days per Year
**Formula:** `working_days_per_year = 5 days/week × 48 weeks = 240`

**Output:** `working_days_per_year` (days/year)

---

### 7. Labour Available Hours per Year
**Purpose:** Active production hours per labour worker per year.

**Source:** Benchmark data [overridable]

**Formula:**
```
labour_available_hours = working_days_per_year × 8h × 0.85
                       = 240 × 8 × 0.85 = 1,632
```

**Output:** `labour_available_hours` (hours/year/worker) = 1,632

**Insight:** 15% efficiency reduction accounts for breaks, setup, cleaning, and minor downtime. Used for all labour capacity calculations.

---

### 8. Booth Available Hours per Year
**Purpose:** Operating hours per booth per year.

**Source:** Benchmark data [overridable]

**Formula:**
```
booth_available_hours = working_days_per_year × 8h
                      = 240 × 8 = 1,920
```

**Output:** `booth_available_hours` (hours/year/booth) = 1,920

**Insight:** Booths are equipment — they do not take breaks. Full shift hours are available. Override this if the workshop runs reduced booth hours.

> ⚠️ `booth_available_hours` (1,920h) ≠ `labour_available_hours` (1,632h). Using labour hours for booth capacity understates booth throughput and artificially inflates booth utilisation.

---

### 9. FTE Hours per Year
**Purpose:** Contractual hours per FTE — used only for FTE workforce conversion.

**Formula:** `fte_hours_per_year = 1,800`

**Output:** `fte_hours_per_year` (hours/year) = 1,800

**Insight:** ≈ 37.5h/week × 48 weeks. Used exclusively in the FTE model. Not interchangeable with `labour_available_hours`.

> ⚠️ Hours summary:
> - `labour_available_hours` (1,632h) → capacity, utilisation, throughput
> - `booth_available_hours` (1,920h) → booth capacity, booth utilisation
> - `fte_hours_per_year` (1,800h) → FTE conversion only

---

### 10. Labour Cost per Hour (Benchmark)
**Purpose:** Reference labour cost when user does not supply one.

**Source:** Benchmark [overridable — user input takes precedence]

**Definition:** Salary + taxes + overhead

**Output:** `labour_cost_per_hour` (currency/hour)

_____________________


## Data Source Layer

### Internal Company Data

This section contains proprietary data based on the company's products, testing, and performance measurements.
It defines the optimized state — how the workshop would perform using the company's product.

---

### 1. Product Usage per Repair
**Purpose:** How much of the company's product is used per repair.

**Source:** Internal company data

**Output:** `product_usage_per_repair` (units/repair)

**Insight:** Used in the Impact Layer to calculate `optimized_cost_per_repair`. Compared against `user_product_usage_per_repair` to measure material efficiency gain.

---

### 2. Product Price per Unit
**Source:** Internal company data

**Output:** `product_price_per_unit` (currency/unit)

---

### 3. Improvement Factor
**Purpose:** How much faster or more efficient the process becomes with the company product.

**Source:** Internal company data (stage-specific where available)

**Canonical formula:**
```
new_time = old_time / improvement_factor
```

**Example:** `improvement_factor = 1.2` → 20% faster → `new_time = old_time / 1.2`

**Stage-specific factors (preferred when available):**
```
prep_improvement_factor   (ratio, default = improvement_factor if not specified)
paint_improvement_factor  (ratio, default = improvement_factor if not specified)
booth_improvement_factor  (ratio, default = improvement_factor if not specified)
```

When only a single `improvement_factor` is provided, it is applied uniformly to all stages. This is an approximation — see the Assumptions section.

**Output:**
- `improvement_factor` (ratio, > 1.0 = improvement)
- `prep_improvement_factor` (ratio)
- `paint_improvement_factor` (ratio)
- `booth_improvement_factor` (ratio)

> ⚠️ `improvement_factor` appears in three contexts: the Impact Layer (applied to labour time, 5.5h base), the Operational Layer (applied to labour time, same base), and the Constraint Shift Model (applied to one stage only). All three must use the same factor value. If stage-specific factors are defined, use the relevant stage factor in each context.

---

### 4. Investment Cost
**Purpose:** Total annualised cost of adopting the company's product.

**Source:** Internal company data

**Definition:** Annualised cost only. Express as cost per year. Includes product cost differential, training, tooling, or transition costs amortised over the expected adoption period.

**Output:** `investment_cost` (currency/year)

**Insight:** Used as the denominator in the ROI model.

> ⚠️ `investment_cost` must be expressed as an annualised figure. A one-time cost of €10,000 amortised over 3 years = `investment_cost = 3,333/year`. Using a one-time cost directly in the ROI formula against annual `net_value` produces a misleading result.

> ⚠️ If `investment_cost = 0` (product costs the same or less), the ROI formula divides by zero. Handle via the Recommendation Signal Model in the Logic Layer, which detects this case and routes to a non-formula conclusion.

> ⚠️ If `investment_cost` is not available from internal data, it must be requested as a user input before the ROI model runs.

---

### 🔗 Integration with System

This layer directly feeds:
- `optimized_cycle_time_per_repair` (Impact Layer)
- `optimized_cost_per_repair` (Impact Layer)
- `new_prep/paint/booth_time` (Constraint Shift Model)
- `optimized_labour_time_per_repair` (Operational Layer 7b)
- `roi_pct` (Impact Layer ROI Model)

---

### 💡 Strategic Insight

- Benchmarks = industry average
- User input = current state (with user product data)
- Internal data = optimized state (with company product data)

This creates a clean three-way comparison: **Current vs Optimized vs Benchmark**


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Diagnostic Framework

### Operational Layer

This layer evaluates workshop capacity, demand, and utilisation for both current and optimized states.

**Execution split:**
- Models 1–7d run in step 2 of the Execution Order (before Bottleneck Layer)
- Model 8 (Flow Efficiency) runs in step 4 (after Bottleneck Layer)

---

### 1. Demand Model
**Formula:**
```
repairs_per_day = repairs_per_year / working_days_per_year
```

**Output:** `repairs_per_day` (repairs/day)

---

### 2. Prep Capacity Model
**Formula:**
```
prep_capacity_hours = preparation_workers × labour_available_hours
```

**Output:** `prep_capacity_hours` (hours/year)

---

### 3. Paint Capacity Model
**Formula:**
```
paint_capacity_hours = spray_painters × labour_available_hours
```

**Output:** `paint_capacity_hours` (hours/year)

---

### 4. Booth Capacity Model
**Formula:**
```
booth_capacity_hours = amount_spraybooths × booth_available_hours
```

**Output:** `booth_capacity_hours` (hours/year)

**Insight:** Uses `booth_available_hours` (1,920h), not `labour_available_hours` (1,632h).

---

### 5. Labour Availability Model
**Formula:**
```
labour_hours_available = (preparation_workers + spray_painters) × labour_available_hours
```

**Output:** `labour_hours_available` (hours/year)

---

### 6. Labour Demand — Current State
**Formula:**
```
labour_hours_used = repairs_per_year × average_labour_time_per_repair
```

**Output:** `labour_hours_used` (hours/year)

---

### 7. Labour Utilisation — Current State
**Formula:**
```
utilisation = labour_hours_used / labour_hours_available
```

**Output:** `utilisation` (ratio)

**Thresholds:** <0.70 underutilised | 0.70–0.90 optimal | >0.90 overloaded

---

### 7b. Labour Demand — Optimized State
**Mode:** Requires Mode B (company data — `improvement_factor` must be available).
**Formula:**
```
optimized_labour_time_per_repair = average_labour_time_per_repair / improvement_factor

optimized_labour_hours_used = actual_repairs_completed × optimized_labour_time_per_repair
```

**Output:**
- `optimized_labour_time_per_repair` (hours/repair)
- `optimized_labour_hours_used` (hours/year)

> ⚠️ Uses `actual_repairs_completed`, not `repairs_per_year`. If the shop is under capacity, only the repairs it can actually complete are relevant for labour demand.

---

### 7c. Labour Utilisation — Optimized State
**Mode:** Requires Mode B.
**Formula:**
```
optimized_utilisation = optimized_labour_hours_used / labour_hours_available
```

**Output:** `optimized_utilisation` (ratio)

**Insight:** If the ROI layer shows improvement but `optimized_utilisation` equals `utilisation`, the improvement factor is not being applied consistently — check the model chain.

---

### 7d. Booth Utilisation Model
**Formula:**
```
booth_hours_used = repairs_per_year × average_booth_cycle_time_per_repair
booth_utilisation = booth_hours_used / booth_capacity_hours
```

**Output:**
- `booth_hours_used` (hours/year)
- `booth_utilisation` (ratio)

---

### 8. Flow Efficiency Model
**Purpose:** Measure system capacity relative to demand.

**Formula:**
```
flow_efficiency = system_throughput_per_year / repairs_per_year
```

**Output:** `flow_efficiency` (ratio)

**Insight:**
- >1.0 → system can handle more than current demand
- <1.0 → system cannot keep up with demand

> ⚠️ The previous two-step daily conversion (`system_throughput_per_day / repairs_per_day`) is mathematically equivalent to this formula — `working_days_per_year` cancels out. The simplified form is used here.

> ⚠️ Requires `system_throughput_per_year` from the Bottleneck Layer. Execute after step 3 of the Execution Order.


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Bottleneck Analysis

### Bottleneck Layer

This layer identifies system constraints and calculates maximum throughput.

**Internal execution order:**
```
Step 1: models 2–4 (stage throughput — depends on capacity hours from Operational Layer)
Step 2: model 5 (system throughput — depends on models 2–4)
Step 3: model 6 (bottleneck detection — depends on model 5)
Step 4: model 7 (capacity gap — depends on model 5)
Step 5: model 1 (actual repairs completed — depends on model 5)
Step 6: model 8 (constraint shift — depends on models 2–6)
```

---

### 1. Actual Repairs Completed
**Purpose:** The realistic workshop output — demand capped by system capacity.

**Formula:**
```
actual_repairs_completed = MIN(repairs_per_year, system_throughput_per_year)
```

**Output:** `actual_repairs_completed` (repairs/year)

**Insight:** `repairs_per_year` is what the workshop wants to complete. `actual_repairs_completed` is what it can. All impact and financial calculations use `actual_repairs_completed` as the volume base, not `repairs_per_year`.

> ⚠️ Executes after model 5 at runtime despite appearing first here.

---

### 2. Prep Throughput
**Formula:**
```
prep_repairs_possible = prep_capacity_hours / average_preparation_time_per_repair
```

**Output:** `prep_repairs_possible` (repairs/year)

---

### 3. Paint Throughput
**Formula:**
```
paint_repairs_possible = paint_capacity_hours / average_paint_time_per_repair
```

**Output:** `paint_repairs_possible` (repairs/year)

---

### 4. Booth Throughput
**Formula:**
```
booth_repairs_possible = booth_capacity_hours / average_booth_cycle_time_per_repair
```

**Output:** `booth_repairs_possible` (repairs/year)

---

### 5. System Throughput
**Formula:**
```
system_throughput_per_year = MIN(prep_repairs_possible, paint_repairs_possible, booth_repairs_possible)
```

**Output:** `system_throughput_per_year` (repairs/year)

**Insight:** The binding constraint. Passed to Operational Layer model 8 and used to derive `actual_repairs_completed`.

---

### 6. Bottleneck Detection
**Formula:**
```
bottleneck_process = all stages where stage_repairs_possible == system_throughput_per_year
```

If multiple stages share the minimum, all are reported as co-bottlenecks.

**Output:** `bottleneck_process` (Preparation / Painting / Booth / co-bottleneck list)

---

### 7. Capacity Gap
**Formula:**
```
capacity_gap = system_throughput_per_year - repairs_per_year
```

**Output:** `capacity_gap` (repairs/year)

**Insight:**
- Positive → unused capacity (growth potential)
- Negative → demand exceeds capacity (repairs lost or backlogged)

---

### 8. Constraint Shift Model
**Mode:** Requires Mode B (company data). Skipped in Mode A.

**Purpose:** Simulate applying the improvement factor to the bottleneck stage and reveal the next constraint.

**Formula:**
```
IF bottleneck_process == Preparation:
  new_prep_time  = average_preparation_time_per_repair / prep_improvement_factor
  new_prep       = prep_capacity_hours / new_prep_time
  new_paint      = paint_repairs_possible
  new_booth      = booth_repairs_possible

IF bottleneck_process == Painting:
  new_paint_time = average_paint_time_per_repair / paint_improvement_factor
  new_paint      = paint_capacity_hours / new_paint_time
  new_prep       = prep_repairs_possible
  new_booth      = booth_repairs_possible

IF bottleneck_process == Booth:
  new_booth_time = average_booth_cycle_time_per_repair / booth_improvement_factor
  new_booth      = booth_capacity_hours / new_booth_time
  new_prep       = prep_repairs_possible
  new_paint      = paint_repairs_possible

new_system_throughput = MIN(new_prep, new_paint, new_booth)

next_bottleneck = all stages where new_stage_repairs_possible == new_system_throughput
```

**Output:**
- `new_system_throughput` (repairs/year)
- `next_bottleneck`

**Insight:** If only a single `improvement_factor` is defined (not stage-specific), use it as the factor for whichever stage is the bottleneck. The improvement is scoped to the bottleneck stage only in this model — consistent with how real process improvements work.


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Consumption Analysis

### Consumption Layer (User Baseline)

This layer calculates material usage and cost based on the user's current product. All calculations here use `user_product_usage_per_repair` and `user_product_price_per_unit`, not the company product variables.

**Execution order within layer:**
Model 4 (Workload Distribution) must run before Model 5 (Process Cost Contribution).

---

### 1. Material Usage Model
**Formula:**
```
annual_material_usage = actual_repairs_completed × user_product_usage_per_repair
```

**Output:** `annual_material_usage` (units/year)

> ⚠️ Uses `actual_repairs_completed`, not `repairs_per_year`. Usage is based on repairs the shop can actually complete.

---

### 2. Cost per Repair Model
**Formula:**
```
cost_per_repair = user_product_usage_per_repair × user_product_price_per_unit
```

**Output:** `cost_per_repair` (currency/repair)

**Insight:** This is the user's actual current cost per repair with their current product.

---

### 3. Total Material Cost Model
**Formula:**
```
total_material_cost_per_year = cost_per_repair × actual_repairs_completed
```

**Validation (must match):**
```
total_material_cost_per_year = user_product_price_per_unit × annual_material_usage
```

**Output:** `total_material_cost_per_year` (currency/year)

---

### 4. Workload Distribution Model

**Step 1 – Hours per process:**
```
prep_workload_hours  = actual_repairs_completed × average_preparation_time_per_repair
paint_workload_hours = actual_repairs_completed × average_paint_time_per_repair
booth_workload_hours = actual_repairs_completed × average_booth_cycle_time_per_repair
```

**Step 2 – Total labour workload (prep + paint only):**
```
total_workload_hours = prep_workload_hours + paint_workload_hours
```

> ⚠️ `booth_workload_hours` is calculated for reference but NOT added to `total_workload_hours`. Booth time is equipment occupancy, not additive labour.

**Step 3 – Distribution (%):**
```
prep_workload_pct  = (prep_workload_hours / total_workload_hours) × 100
paint_workload_pct = (paint_workload_hours / total_workload_hours) × 100
```

**Output:**
- `prep_workload_hours`, `paint_workload_hours`, `booth_workload_hours` (hours/year)
- `total_workload_hours` (hours/year) [prep + paint only]
- `prep_workload_pct`, `paint_workload_pct` (%)

---

### 5. Process Cost Contribution Model (Estimated)

> ⚠️ Depends on Model 4. Run Model 4 first.

**Step 1 – Workload share (ratios, not %):**
```
prep_workload_share  = prep_workload_hours / total_workload_hours
paint_workload_share = paint_workload_hours / total_workload_hours
```

**Step 2 – Cost allocation:**
```
prep_cost  = total_material_cost_per_year × prep_workload_share
paint_cost = total_material_cost_per_year × paint_workload_share
```

**Step 3 – Contribution (%):**
```
prep_cost_contribution  = prep_workload_share × 100
paint_cost_contribution = paint_workload_share × 100
```

**Output:** `prep_cost_contribution` (%), `paint_cost_contribution` (%)

> ⚠️ Assumption: material usage scales proportionally with time per process. Approximation only — refine if process-level material data becomes available.

---

### 6. Benchmark Deviation Model
**Mode:** Mode A (runs without company data). Requires `user_product_usage_per_repair` — if not provided by user, falls back to `benchmark_usage_per_repair`, in which case `deviation_pct = 0` and no deviation insight is available.
**Formula:**
```
deviation_pct = ((user_product_usage_per_repair - benchmark_usage_per_repair) / benchmark_usage_per_repair) × 100
```

**Output:** `deviation_pct` (%)

**Insight:**
- Positive → user uses MORE than benchmark (inefficient)
- Negative → user uses LESS than benchmark (efficient)

> ⚠️ This now correctly compares the user's actual current product usage against the benchmark — not the company product against the benchmark.

> ⚠️ Sign convention: positive = worse. Inverse of the general delta convention. Handle explicitly in downstream logic.

---

## Important Modeling Rules

- Use `actual_repairs_completed` (not `repairs_per_year`) as the volume base in all cost, usage, and workload calculations
- `cost_per_repair` always refers to user's current product cost; `optimized_cost_per_repair` always refers to company product cost
- `booth_workload_hours` must NOT be included in `total_workload_hours`
- `booth_capacity_hours` must use `booth_available_hours` (1,920h), not `labour_available_hours` (1,632h)
- Financial savings are calculated on labour time saved only — apply `labour_fraction` before multiplying by `labour_cost_per_hour`
- Model 4 (Workload Distribution) must execute before Model 5 (Process Cost Contribution)
- Variable names must match the canonical table in System Core Logic exactly


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Impact Analysis

### Impact Layer

**Mode:** Requires Mode B (all models in this layer depend on company product data and `improvement_factor`). Entirely skipped in Mode A.

This layer translates process improvements into time savings, financial impact, and capacity gains.

> ⚠️ All volume-based calculations in this layer use `actual_repairs_completed`, not `repairs_per_year`. Calculating impact on more repairs than the system can complete overstates results.

---

### 0. Cycle Time and Labour Fraction Definitions

These variables must be calculated first. All other models in this layer depend on them.

**Current cycle time (scheduling):**
```
current_cycle_time_per_repair = average_preparation_time_per_repair
                               + average_paint_time_per_repair
                               + average_booth_cycle_time_per_repair
                               = 3 + 2.5 + 2 = 7.5h
```

**Optimized cycle time (scheduling):**
```
optimized_prep_time   = average_preparation_time_per_repair / prep_improvement_factor
optimized_paint_time  = average_paint_time_per_repair / paint_improvement_factor
optimized_booth_time  = average_booth_cycle_time_per_repair / booth_improvement_factor

optimized_cycle_time_per_repair = optimized_prep_time + optimized_paint_time + optimized_booth_time
```

> If only a single `improvement_factor` is provided (not stage-specific), apply it uniformly:
> `optimized_cycle_time_per_repair = current_cycle_time_per_repair / improvement_factor`

**Labour fraction:**
```
labour_fraction = average_labour_time_per_repair / current_cycle_time_per_repair
               = 5.5 / 7.5 = 0.733
```

**Output:**
- `current_cycle_time_per_repair` (hours/repair) = 7.5
- `optimized_cycle_time_per_repair` (hours/repair)
- `labour_fraction` (ratio) = 0.733

---

### 1. Cycle Time Saved per Repair
**Formula:**
```
cycle_time_saved_per_repair = current_cycle_time_per_repair - optimized_cycle_time_per_repair
```

**Output:** `cycle_time_saved_per_repair` (hours/repair)

---

### 2. Labour Time Saved per Repair
**Purpose:** Extract only the labour-billable portion of cycle time saved.

**Formula:**
```
labour_time_saved_per_repair = cycle_time_saved_per_repair × labour_fraction
```

**Output:** `labour_time_saved_per_repair` (hours/repair)

**Insight:** This is the time saving that can legitimately be valued at `labour_cost_per_hour`. Booth drying time is not labour time — applying labour cost to it overstates financial savings.

---

### 3. Total Time Saved Model
**Formula:**
```
total_cycle_time_saved_per_year  = cycle_time_saved_per_repair × actual_repairs_completed
total_labour_time_saved_per_year = labour_time_saved_per_repair × actual_repairs_completed
```

**Output:**
- `total_cycle_time_saved_per_year` (hours/year) [used for throughput and FTE]
- `total_labour_time_saved_per_year` (hours/year) [used for financial savings]

---

### 4. FTE Model
**Formula:**
```
fte_saved = total_cycle_time_saved_per_year / fte_hours_per_year
```

**Output:** `fte_saved` (FTE)

**Insight:** Uses full cycle time (not labour-only) because FTE is a headcount proxy for overall time freed up, not just billable time. Uses contractual hours (1,800h) as the FTE basis.

---

### 5. Financial Savings Model
**Formula:**
```
financial_savings_per_year = total_labour_time_saved_per_year × labour_cost_per_hour
```

**Output:** `financial_savings_per_year` (currency/year)

**Insight:** Uses `total_labour_time_saved_per_year` — labour-fraction-adjusted — to avoid attributing labour cost to booth drying time. How this figure is presented depends on `savings_type` from the Logic Layer (cost reduction vs capacity gain).

---

### 6. Optimized Cost per Repair
**Formula:**
```
optimized_cost_per_repair = product_usage_per_repair × product_price_per_unit
```

**Output:** `optimized_cost_per_repair` (currency/repair)

**Insight:** This is the company product cost per repair. Compared against `cost_per_repair` (user's current product cost) to calculate the cost delta.

---

### 7. Cost-Time Tradeoff Model
**Step 1 – Product cost delta:**
```
additional_product_cost_per_year = (optimized_cost_per_repair - cost_per_repair) × actual_repairs_completed
```

[Positive = company product costs more per repair; Negative = company product costs less]

**Step 2 – Net value:**
```
net_value = financial_savings_per_year - additional_product_cost_per_year
```

**Output:**
- `additional_product_cost_per_year` (currency/year)
- `net_value` (currency/year)

---

### 8. ROI Model
**Formula:**
```
IF investment_cost = 0:
  roi_pct = undefined → route to Recommendation Signal Model
ELSE:
  roi_pct = (net_value / investment_cost) × 100
```

**Output:** `roi_pct` (%) or `undefined`

**Insight:** `investment_cost` must be annualised. See Internal Company Data section 4 for definition. If `investment_cost = 0`, the ROI formula is undefined — use the Recommendation Signal Model in the Logic Layer to handle this case.


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Known Assumptions and Limitations

The following assumptions are built into the current model. They are documented here explicitly so that implementers and users understand where results may diverge from reality.

| Assumption | Risk | Notes |
|---|---|---|
| Single `improvement_factor` applied uniformly | High | A product improving prep drying does not speed up hand sanding at the same rate. Use stage-specific factors when product data allows. |
| Single average repair time | High | Mix of minor/major repairs produces different real-world numbers. See Advanced Notes for future segmentation approach. |
| `labour_fraction` (0.733) applied as a fixed ratio | Medium | In practice the overlap between active painting and booth drying varies by repair type and product. |
| Linear throughput scaling | Medium | Doubling workers doubles capacity — no coordination overhead or physical space constraints modeled. |
| `labour_available_hours` 0.85 efficiency factor is uniform | Low–Medium | Prep workers and painters may have meaningfully different idle patterns. |
| Booth runs full shift hours (1,920h) without maintenance | Medium | Filter changes, calibration, failures — a booth-specific availability factor may be warranted. Override via advanced input. |
| `working_days_per_year = 240` | Low | Region-dependent. Some markets run 6-day weeks. Override via user input. |
| Material cost scales linearly with usage | Low | No volume discounts, wastage factors, or setup costs modeled. |
| `savings_type` threshold at 0.90 utilisation | Medium | Threshold is a reasonable approximation. Actual crossover point depends on overtime policy and outsourcing costs. |


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Advanced Notes

### Stage-Specific Improvement Factors
Stage-specific improvement factors (`prep_improvement_factor`, `paint_improvement_factor`, `booth_improvement_factor`) are the preferred mode when internal company data supports them. The single `improvement_factor` fallback is an approximation for cases where only aggregate performance data is available. Upgrade to stage-specific factors as product data matures.

### Repair Type Segmentation (Future Version)
The current model uses a single average repair time. A future version should support:
```
repair_types = [small, medium, heavy]
```
with separate cycle times, labour fractions, and volumes per type — enabling accurate throughput and utilisation modeling for mixed-volume workshops.


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
## System Purpose

The Bodyshop Efficiency System is designed to evaluate and improve workshop performance by translating operational inputs into clear, actionable business insights.

The system serves four primary functions:

### 1. Diagnostic Framework
Provide a structured analysis of the current bodyshop operations by quantifying key performance indicators such as repair volume, time per repair, and resource utilization.

### 2. Operational Insight
Generate clear insights into how the workshop is currently performing, highlighting efficiency levels, throughput, and productivity in measurable terms.

### 3. Bottleneck Analysis
Identify constraints and inefficiencies within the workflow that limit output, increase repair time, or reduce overall operational capacity.

### 4. ROI Estimation
Calculate the financial impact of process improvements, new products, or workflow changes by estimating time savings, cost differences, and net financial value.


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------

## System Core Logic

The system is designed to compare:

- Current State (user workshop reality, using user-supplied product data)
- Optimized State (using internal company product data)

Benchmarks are NOT used as a comparison target, but as a reconstruction layer to complete missing operational data.

---

### Data Flow

1. User provides operational inputs and current product data
2. System reconstructs full current operational model using benchmarks for any missing values
3. Internal company data is applied to simulate the optimized state
4. System calculates delta between current and optimized

---

### Modeling Rule

Benchmarks are ONLY used for:
- missing values
- default assumptions
- structural completion

Benchmarks are NEVER used for:
- final comparison
- ROI calculations
- decision output

---

### Data Availability Modes

The system operates in two modes depending on whether internal company data is available. The system must detect which mode applies at runtime and execute only the layers that are fully resolvable.

---

#### Mode A — Diagnostic Only (no company data)

**Requires:** User input + benchmarks only

**Produces:** Full current-state analysis. No optimized state, no ROI, no delta.

```
Available layers and models:

✅ Operational Layer — models 1–7 (demand, capacity, labour utilisation)
✅ Bottleneck Layer — models 2–7 (throughput, bottleneck detection, capacity gap,
                                   actual_repairs_completed)
✅ Operational Layer — model 8 (flow efficiency)
✅ Consumption Layer — models 1–4, 6 (usage, cost, workload distribution, deviation)
   ⚠️  Model 5 (Process Cost Contribution) requires total_workload_hours from model 4 — run 4 first
✅ Logic Layer — models 1, 2, 3, 6, 7
   (utilisation classification, booth classification, system status,
    consumption classification, combined scenario)

❌ Operational Layer — models 7b, 7c (optimized utilisation — needs improvement_factor)
❌ Bottleneck Layer — model 8 (constraint shift — needs improvement_factor)
❌ Impact Layer — all models (need company product data and improvement_factor)
❌ Logic Layer — models 4, 5 (savings type, recommendation — need Impact Layer outputs)
❌ ROI output
```

**Output to user:** Current state diagnostic report — utilisation, bottleneck identification, capacity gap, material cost baseline, benchmark deviation. Clearly communicates that optimization comparison is not yet available.

---

#### Mode B — Full Comparison (company data available)

**Requires:** User input + benchmarks + internal company data

**Produces:** Full current vs optimized comparison including ROI.

```
Full execution order:

1. Data Source Layer
   (User Input + Benchmarks + Internal Company Data)

2. Operational Layer — models 1–7d
   [produces: prep_capacity_hours, paint_capacity_hours,
    booth_capacity_hours, labour_hours_available, utilisation]

3. Bottleneck Layer — models 2–7
   [depends on: capacity hours from step 2]
   [produces: system_throughput_per_year, actual_repairs_completed,
    capacity_gap, bottleneck_process]
   Internal order: 2→3→4→5→6→7→1
   (model 1 depends on model 5 at runtime despite appearing first in the document)

4. Operational Layer — model 8 (Flow Efficiency)
   [depends on: system_throughput_per_year from step 3]

5. Consumption Layer — models 1–6
   Internal order: model 4 before model 5

6. Impact Layer — models 0–8
   [depends on: actual_repairs_completed, improvement_factor,
    company product data]

7. Bottleneck Layer — model 8 (Constraint Shift)
   [depends on: improvement_factor from company data]

8. Logic Layer — all models
   [depends on: utilisation, optimized_utilisation, deviation_pct,
    capacity_gap, net_value, roi_pct]

9. ROI + Output
```

---

#### Mode Detection Rule

```
IF all of the following are available:
  - product_usage_per_repair
  - product_price_per_unit
  - improvement_factor (or stage-specific equivalents)
  - investment_cost
THEN mode = "Full Comparison"
ELSE mode = "Diagnostic Only"
```

If partial company data is available (e.g. product pricing but no improvement factor), the system runs Mode A and clearly marks which additional inputs are needed to unlock Mode B.

> ⚠️ The system must never silently skip a model or return a null output without communicating to the user why that output is unavailable and what input is needed to resolve it.

---

### Cycle Time Duality — Authoritative Rule

This system uses two distinct time measures for repair work. Using the wrong one in a formula is a calculation error.

| Variable | Value | What it measures | Used in |
|---|---|---|---|
| `average_labour_time_per_repair` | 5.5h | Direct labour only (prep + paint). Booth drying time is excluded — it does not consume billable labour hours. | Labour utilisation, labour demand, FTE |
| `current_cycle_time_per_repair` | 7.5h | Total elapsed time per repair including booth occupancy (prep + paint + booth). | Throughput scheduling, time savings, financial impact |

**Rule:** Financial savings from time reduction are calculated on `labour_time_saved_per_repair` (5.5h base), not `cycle_time_saved_per_repair` (7.5h base). Applying `labour_cost_per_hour` to booth time savings overstates savings because the painter is not necessarily billing during the booth drying phase.

**labour_fraction** is the ratio of billable labour time to total cycle time:
```
labour_fraction = average_labour_time_per_repair / current_cycle_time_per_repair
               = 5.5 / 7.5 = 0.733
```
This is used in the Impact Layer to correctly attribute financial savings only to the labour portion of time saved.

---

### Canonical Variable Names

The following names are the single authoritative standard. All layers must use exactly these names.

| Concept | Canonical Name |
|---|---|
| User's current product usage per repair | `user_product_usage_per_repair` |
| User's current product price per unit | `user_product_price_per_unit` |
| Company product usage per repair | `product_usage_per_repair` |
| Company product price per unit | `product_price_per_unit` |
| User's current material cost per repair | `cost_per_repair` |
| Company (optimized) material cost per repair | `optimized_cost_per_repair` |
| Improvement factor | `improvement_factor` |
| Current cycle time (scheduling) | `current_cycle_time_per_repair` |
| Optimized cycle time (scheduling) | `optimized_cycle_time_per_repair` |
| Labour time saved per repair | `labour_time_saved_per_repair` |
| Labour available hours per worker per year | `labour_available_hours` |
| Booth available hours per booth per year | `booth_available_hours` |

> ⚠️ `usage_per_repair_product`, `improved_factor`, `new_cost_per_repair`, `current_cost_per_repair` are legacy naming errors. Treat any occurrence as the canonical equivalent above.

---

### Final Comparison

ALL outputs must be based on:

```
delta = optimized_state - current_state
```


_____________________


## Logic Layer

### Scenario Classification

This layer interprets calculated metrics and classifies the workshop into clear operational scenarios.
All inputs to this layer are produced by earlier layers — this layer only classifies, never calculates.

---

### 1. Utilisation Classification Model
**Purpose:** Classify workshop labour utilisation — applied to both current and optimized state.

**Formula:**
```
IF utilisation < 0.70  → utilisation_scenario = "Underutilised"
IF utilisation >= 0.70 AND utilisation <= 0.90 → utilisation_scenario = "Balanced"
IF utilisation > 0.90  → utilisation_scenario = "Overloaded"
```

Apply the same thresholds to `optimized_utilisation` → `optimized_utilisation_scenario`.

**Output:**
- `utilisation_scenario`
- `optimized_utilisation_scenario`

**Insight:**
- Underutilised → unused capacity, growth opportunity
- Balanced → optimal efficiency range
- Overloaded → system under pressure, risk of delays and bottlenecks

---

### 2. Booth Utilisation Classification Model
**Formula:**
```
IF booth_utilisation < 0.70  → booth_utilisation_scenario = "Underutilised"
IF booth_utilisation >= 0.70 AND booth_utilisation <= 0.90 → booth_utilisation_scenario = "Balanced"
IF booth_utilisation > 0.90  → booth_utilisation_scenario = "Overloaded"
```

**Output:** `booth_utilisation_scenario`

**Insight:** A workshop can show balanced labour utilisation while booths are overloaded. This model catches that divergence.

---

### 3. System Status Model
**Formula:**
```
IF capacity_gap >= 0 → system_status = "Excess capacity"
IF capacity_gap < 0  → system_status = "Under capacity"
```

**Output:** `system_status`

---

### 4. Savings Type Classification Model
**Mode:** Requires Mode B (`utilisation` is available in Mode A, but this model feeds the Impact Layer output presentation which only exists in Mode B).
**Purpose:** Determine whether time savings translate to real cost reduction or capacity gains.

**Formula:**
```
IF utilisation >= 0.90 → savings_type = "Cost saving"
IF utilisation < 0.90  → savings_type = "Capacity gain"
```

**Output:** `savings_type`

**Insight:**
- Cost saving (≥90% utilisation) → the workshop is fully loaded; freed time directly reduces labour cost or overtime
- Capacity gain (<90% utilisation) → the workshop has slack; freed time creates potential for more repairs but does not directly reduce cost
- The financial savings formula produces the same number regardless; this classification tells the output layer how to present and label the result to the user

> ℹ️ Threshold rationale: the binary 1.0 cutoff was replaced with 0.90. In practice, a shop running at 90–99% utilisation is already incurring overtime or prioritisation costs, so time savings translate to real money. Shops below 90% are converting time savings into capacity headroom, not direct cost reduction.

**Output layer rule:**
```
IF savings_type = "Cost saving"   → present financial_savings_per_year as "Labour cost reduction"
IF savings_type = "Capacity gain" → present financial_savings_per_year as "Equivalent capacity value"
                                    AND add note: "Realised only if additional repair volume is captured"
```

---

### 5. Recommendation Signal Model
**Mode:** Requires Mode B (`net_value` and `roi_pct` are only available in Mode B).
**Purpose:** Provide an explicit go/no-go signal based on net value and ROI.

**Formula:**
```
IF investment_cost = 0 AND net_value > 0  → recommendation = "Adopt — no cost, positive return"
IF investment_cost = 0 AND net_value <= 0 → recommendation = "Do not adopt — no benefit"
IF investment_cost > 0 AND roi_pct > 0    → recommendation = "Positive ROI — recommend adoption"
IF investment_cost > 0 AND roi_pct <= 0   → recommendation = "Negative ROI — do not recommend"
```

**Output:** `recommendation`

**Insight:** Prevents the system from silently outputting a negative ROI without a clear signal. The recommendation flag is the authoritative output for the decision layer.

---

### 6. Consumption Classification Model
**Formula:**
```
IF deviation_pct > 0  → consumption_scenario = "Consumption-heavy"
IF deviation_pct <= 0 → consumption_scenario = "Efficient"
```

**Note on sign convention:** `deviation_pct` is positive when the user uses MORE than benchmark (inefficient). This is the inverse of the general delta convention (positive = improvement). Downstream logic must handle this explicitly.

**Output:** `consumption_scenario`

---

### 7. Combined Scenario Interpretation (Optional)
**Logic:**
```
IF utilisation < 0.70 AND deviation_pct > 0  → "Low utilisation + high waste"
IF utilisation > 0.90 AND deviation_pct > 0  → "Overloaded + inefficient"
IF utilisation >= 0.70 AND utilisation <= 0.90 AND deviation_pct <= 0 → "Optimised operation"
```

**Output:** `combined_scenario`


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Data Source Layer

### User Input

This section defines all variables provided by the user to represent the current state of their workshop and their current product.

---

### 1. Repairs per Year
**Source:** User input

**Output:** `repairs_per_year` (repairs/year)

**Insight:** This is requested repair volume, not actual completed volume. See `actual_repairs_completed` in the Bottleneck Layer for the capacity-constrained figure.

---

### 2. Preparation Workers
**Source:** User input

**Output:** `preparation_workers` (workers)

---

### 3. Spray Painters
**Source:** User input

**Output:** `spray_painters` (workers)

---

### 4. Booths
**Source:** User input

**Output:** `amount_spraybooths` (units)

---

### 5. Labour Cost per Hour
**Source:** User input (advanced override available)

**Default fallback:** Use benchmark `labour_cost_per_hour` if not provided.

**Output:** `labour_cost_per_hour` (currency/hour)

---

### 6. Working Days per Year
**Source:** User input (advanced override available)

**Default:** `working_days_per_year = 240`

**Output:** `working_days_per_year` (days/year)

---

### 7. User Product Usage per Repair
**Purpose:** Define how much of the user's current product they use per repair.

**Source:** User input (advanced override available)

**Default fallback:** Use `benchmark_usage_per_repair` if not provided.

**Output:** `user_product_usage_per_repair` (units/repair)

**Insight:** This is the user's current-state consumption. It is the correct baseline for the Consumption Layer and for the benchmark deviation calculation. It is distinct from `product_usage_per_repair` (the company's product), which belongs to the optimized state.

---

### 8. User Product Price per Unit
**Purpose:** Define the cost per unit of the user's current product.

**Source:** User input (advanced override available)

**Default fallback:** Use `benchmark_usage_per_repair` × estimated market rate if not provided.

**Output:** `user_product_price_per_unit` (currency/unit)

**Insight:** Used to calculate the user's current material cost per repair. Distinct from `product_price_per_unit` (company product price).

_____________________


### Industry Benchmarks

This section defines standardised reference values used when user data is unavailable.

> ⚠️ Advanced Input Override: All values marked [overridable] can be replaced by user-supplied values. When overridden, the benchmark value is not used for that variable.

---

### 1. Average Labour Time per Repair
**Purpose:** Standard direct labour time per repair (prep + paint only).

**Source:** Benchmark data [overridable]

**Formula:**
```
average_labour_time_per_repair = average_preparation_time_per_repair + average_paint_time_per_repair
                               = 3 + 2.5 = 5.5
```

**Output:** `average_labour_time_per_repair` (hours/repair) = 5.5

**Insight:** Booth cycle time is NOT included — it represents equipment occupancy, not billable labour time. Used for labour utilisation and labour demand calculations only.

> ⚠️ `total_time_per_repair` was previously defined as a separate benchmark with the same formula and value. It has been removed. `average_labour_time_per_repair` is the single canonical variable for labour time per repair.

---

### 2. Preparation Time per Repair
**Source:** Benchmark data [overridable]

**Formula:** `average_preparation_time_per_repair = 3`

**Output:** `average_preparation_time_per_repair` (hours/repair)

---

### 3. Paint Time per Repair
**Source:** Benchmark data [overridable]

**Formula:** `average_paint_time_per_repair = 2.5`

**Output:** `average_paint_time_per_repair` (hours/repair)

---

### 4. Booth Cycle Time per Repair
**Source:** Benchmark data [overridable]

**Formula:** `average_booth_cycle_time_per_repair = 2`

**Output:** `average_booth_cycle_time_per_repair` (hours/repair)

**Insight:** Total booth occupancy per repair including active painting and curing/drying time.

> ⚠️ Booth cycle time is used only for booth throughput and booth utilisation calculations. It must NOT be added to `total_workload_hours` (double-counting), and booth time savings must NOT be valued at `labour_cost_per_hour` without applying `labour_fraction` (financial overstatement).

---

### 5. Benchmark Usage per Repair
**Purpose:** Industry reference for material usage per repair, used for deviation comparison.

**Source:** Benchmark data [overridable]

**Output:** `benchmark_usage_per_repair` (units/repair)

---

### 6. Working Days per Year
**Formula:** `working_days_per_year = 5 days/week × 48 weeks = 240`

**Output:** `working_days_per_year` (days/year)

---

### 7. Labour Available Hours per Year
**Purpose:** Active production hours per labour worker per year.

**Source:** Benchmark data [overridable]

**Formula:**
```
labour_available_hours = working_days_per_year × 8h × 0.85
                       = 240 × 8 × 0.85 = 1,632
```

**Output:** `labour_available_hours` (hours/year/worker) = 1,632

**Insight:** 15% efficiency reduction accounts for breaks, setup, cleaning, and minor downtime. Used for all labour capacity calculations.

---

### 8. Booth Available Hours per Year
**Purpose:** Operating hours per booth per year.

**Source:** Benchmark data [overridable]

**Formula:**
```
booth_available_hours = working_days_per_year × 8h
                      = 240 × 8 = 1,920
```

**Output:** `booth_available_hours` (hours/year/booth) = 1,920

**Insight:** Booths are equipment — they do not take breaks. Full shift hours are available. Override this if the workshop runs reduced booth hours.

> ⚠️ `booth_available_hours` (1,920h) ≠ `labour_available_hours` (1,632h). Using labour hours for booth capacity understates booth throughput and artificially inflates booth utilisation.

---

### 9. FTE Hours per Year
**Purpose:** Contractual hours per FTE — used only for FTE workforce conversion.

**Formula:** `fte_hours_per_year = 1,800`

**Output:** `fte_hours_per_year` (hours/year) = 1,800

**Insight:** ≈ 37.5h/week × 48 weeks. Used exclusively in the FTE model. Not interchangeable with `labour_available_hours`.

> ⚠️ Hours summary:
> - `labour_available_hours` (1,632h) → capacity, utilisation, throughput
> - `booth_available_hours` (1,920h) → booth capacity, booth utilisation
> - `fte_hours_per_year` (1,800h) → FTE conversion only

---

### 10. Labour Cost per Hour (Benchmark)
**Purpose:** Reference labour cost when user does not supply one.

**Source:** Benchmark [overridable — user input takes precedence]

**Definition:** Salary + taxes + overhead

**Output:** `labour_cost_per_hour` (currency/hour)

_____________________


## Data Source Layer

### Internal Company Data

This section contains proprietary data based on the company's products, testing, and performance measurements.
It defines the optimized state — how the workshop would perform using the company's product.

---

### 1. Product Usage per Repair
**Purpose:** How much of the company's product is used per repair.

**Source:** Internal company data

**Output:** `product_usage_per_repair` (units/repair)

**Insight:** Used in the Impact Layer to calculate `optimized_cost_per_repair`. Compared against `user_product_usage_per_repair` to measure material efficiency gain.

---

### 2. Product Price per Unit
**Source:** Internal company data

**Output:** `product_price_per_unit` (currency/unit)

---

### 3. Improvement Factor
**Purpose:** How much faster or more efficient the process becomes with the company product.

**Source:** Internal company data (stage-specific where available)

**Canonical formula:**
```
new_time = old_time / improvement_factor
```

**Example:** `improvement_factor = 1.2` → 20% faster → `new_time = old_time / 1.2`

**Stage-specific factors (preferred when available):**
```
prep_improvement_factor   (ratio, default = improvement_factor if not specified)
paint_improvement_factor  (ratio, default = improvement_factor if not specified)
booth_improvement_factor  (ratio, default = improvement_factor if not specified)
```

When only a single `improvement_factor` is provided, it is applied uniformly to all stages. This is an approximation — see the Assumptions section.

**Output:**
- `improvement_factor` (ratio, > 1.0 = improvement)
- `prep_improvement_factor` (ratio)
- `paint_improvement_factor` (ratio)
- `booth_improvement_factor` (ratio)

> ⚠️ `improvement_factor` appears in three contexts: the Impact Layer (applied to labour time, 5.5h base), the Operational Layer (applied to labour time, same base), and the Constraint Shift Model (applied to one stage only). All three must use the same factor value. If stage-specific factors are defined, use the relevant stage factor in each context.

---

### 4. Investment Cost
**Purpose:** Total annualised cost of adopting the company's product.

**Source:** Internal company data

**Definition:** Annualised cost only. Express as cost per year. Includes product cost differential, training, tooling, or transition costs amortised over the expected adoption period.

**Output:** `investment_cost` (currency/year)

**Insight:** Used as the denominator in the ROI model.

> ⚠️ `investment_cost` must be expressed as an annualised figure. A one-time cost of €10,000 amortised over 3 years = `investment_cost = 3,333/year`. Using a one-time cost directly in the ROI formula against annual `net_value` produces a misleading result.

> ⚠️ If `investment_cost = 0` (product costs the same or less), the ROI formula divides by zero. Handle via the Recommendation Signal Model in the Logic Layer, which detects this case and routes to a non-formula conclusion.

> ⚠️ If `investment_cost` is not available from internal data, it must be requested as a user input before the ROI model runs.

---

### 🔗 Integration with System

This layer directly feeds:
- `optimized_cycle_time_per_repair` (Impact Layer)
- `optimized_cost_per_repair` (Impact Layer)
- `new_prep/paint/booth_time` (Constraint Shift Model)
- `optimized_labour_time_per_repair` (Operational Layer 7b)
- `roi_pct` (Impact Layer ROI Model)

---

### 💡 Strategic Insight

- Benchmarks = industry average
- User input = current state (with user product data)
- Internal data = optimized state (with company product data)

This creates a clean three-way comparison: **Current vs Optimized vs Benchmark**


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Diagnostic Framework

### Operational Layer

This layer evaluates workshop capacity, demand, and utilisation for both current and optimized states.

**Execution split:**
- Models 1–7d run in step 2 of the Execution Order (before Bottleneck Layer)
- Model 8 (Flow Efficiency) runs in step 4 (after Bottleneck Layer)

---

### 1. Demand Model
**Formula:**
```
repairs_per_day = repairs_per_year / working_days_per_year
```

**Output:** `repairs_per_day` (repairs/day)

---

### 2. Prep Capacity Model
**Formula:**
```
prep_capacity_hours = preparation_workers × labour_available_hours
```

**Output:** `prep_capacity_hours` (hours/year)

---

### 3. Paint Capacity Model
**Formula:**
```
paint_capacity_hours = spray_painters × labour_available_hours
```

**Output:** `paint_capacity_hours` (hours/year)

---

### 4. Booth Capacity Model
**Formula:**
```
booth_capacity_hours = amount_spraybooths × booth_available_hours
```

**Output:** `booth_capacity_hours` (hours/year)

**Insight:** Uses `booth_available_hours` (1,920h), not `labour_available_hours` (1,632h).

---

### 5. Labour Availability Model
**Formula:**
```
labour_hours_available = (preparation_workers + spray_painters) × labour_available_hours
```

**Output:** `labour_hours_available` (hours/year)

---

### 6. Labour Demand — Current State
**Formula:**
```
labour_hours_used = repairs_per_year × average_labour_time_per_repair
```

**Output:** `labour_hours_used` (hours/year)

---

### 7. Labour Utilisation — Current State
**Formula:**
```
utilisation = labour_hours_used / labour_hours_available
```

**Output:** `utilisation` (ratio)

**Thresholds:** <0.70 underutilised | 0.70–0.90 optimal | >0.90 overloaded

---

### 7b. Labour Demand — Optimized State
**Mode:** Requires Mode B (company data — `improvement_factor` must be available).
**Formula:**
```
optimized_labour_time_per_repair = average_labour_time_per_repair / improvement_factor

optimized_labour_hours_used = actual_repairs_completed × optimized_labour_time_per_repair
```

**Output:**
- `optimized_labour_time_per_repair` (hours/repair)
- `optimized_labour_hours_used` (hours/year)

> ⚠️ Uses `actual_repairs_completed`, not `repairs_per_year`. If the shop is under capacity, only the repairs it can actually complete are relevant for labour demand.

---

### 7c. Labour Utilisation — Optimized State
**Mode:** Requires Mode B.
**Formula:**
```
optimized_utilisation = optimized_labour_hours_used / labour_hours_available
```

**Output:** `optimized_utilisation` (ratio)

**Insight:** If the ROI layer shows improvement but `optimized_utilisation` equals `utilisation`, the improvement factor is not being applied consistently — check the model chain.

---

### 7d. Booth Utilisation Model
**Formula:**
```
booth_hours_used = repairs_per_year × average_booth_cycle_time_per_repair
booth_utilisation = booth_hours_used / booth_capacity_hours
```

**Output:**
- `booth_hours_used` (hours/year)
- `booth_utilisation` (ratio)

---

### 8. Flow Efficiency Model
**Purpose:** Measure system capacity relative to demand.

**Formula:**
```
flow_efficiency = system_throughput_per_year / repairs_per_year
```

**Output:** `flow_efficiency` (ratio)

**Insight:**
- >1.0 → system can handle more than current demand
- <1.0 → system cannot keep up with demand

> ⚠️ The previous two-step daily conversion (`system_throughput_per_day / repairs_per_day`) is mathematically equivalent to this formula — `working_days_per_year` cancels out. The simplified form is used here.

> ⚠️ Requires `system_throughput_per_year` from the Bottleneck Layer. Execute after step 3 of the Execution Order.


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Bottleneck Analysis

### Bottleneck Layer

This layer identifies system constraints and calculates maximum throughput.

**Internal execution order:**
```
Step 1: models 2–4 (stage throughput — depends on capacity hours from Operational Layer)
Step 2: model 5 (system throughput — depends on models 2–4)
Step 3: model 6 (bottleneck detection — depends on model 5)
Step 4: model 7 (capacity gap — depends on model 5)
Step 5: model 1 (actual repairs completed — depends on model 5)
Step 6: model 8 (constraint shift — depends on models 2–6)
```

---

### 1. Actual Repairs Completed
**Purpose:** The realistic workshop output — demand capped by system capacity.

**Formula:**
```
actual_repairs_completed = MIN(repairs_per_year, system_throughput_per_year)
```

**Output:** `actual_repairs_completed` (repairs/year)

**Insight:** `repairs_per_year` is what the workshop wants to complete. `actual_repairs_completed` is what it can. All impact and financial calculations use `actual_repairs_completed` as the volume base, not `repairs_per_year`.

> ⚠️ Executes after model 5 at runtime despite appearing first here.

---

### 2. Prep Throughput
**Formula:**
```
prep_repairs_possible = prep_capacity_hours / average_preparation_time_per_repair
```

**Output:** `prep_repairs_possible` (repairs/year)

---

### 3. Paint Throughput
**Formula:**
```
paint_repairs_possible = paint_capacity_hours / average_paint_time_per_repair
```

**Output:** `paint_repairs_possible` (repairs/year)

---

### 4. Booth Throughput
**Formula:**
```
booth_repairs_possible = booth_capacity_hours / average_booth_cycle_time_per_repair
```

**Output:** `booth_repairs_possible` (repairs/year)

---

### 5. System Throughput
**Formula:**
```
system_throughput_per_year = MIN(prep_repairs_possible, paint_repairs_possible, booth_repairs_possible)
```

**Output:** `system_throughput_per_year` (repairs/year)

**Insight:** The binding constraint. Passed to Operational Layer model 8 and used to derive `actual_repairs_completed`.

---

### 6. Bottleneck Detection
**Formula:**
```
bottleneck_process = all stages where stage_repairs_possible == system_throughput_per_year
```

If multiple stages share the minimum, all are reported as co-bottlenecks.

**Output:** `bottleneck_process` (Preparation / Painting / Booth / co-bottleneck list)

---

### 7. Capacity Gap
**Formula:**
```
capacity_gap = system_throughput_per_year - repairs_per_year
```

**Output:** `capacity_gap` (repairs/year)

**Insight:**
- Positive → unused capacity (growth potential)
- Negative → demand exceeds capacity (repairs lost or backlogged)

---

### 8. Constraint Shift Model
**Mode:** Requires Mode B (company data). Skipped in Mode A.

**Purpose:** Simulate applying the improvement factor to the bottleneck stage and reveal the next constraint.

**Formula:**
```
IF bottleneck_process == Preparation:
  new_prep_time  = average_preparation_time_per_repair / prep_improvement_factor
  new_prep       = prep_capacity_hours / new_prep_time
  new_paint      = paint_repairs_possible
  new_booth      = booth_repairs_possible

IF bottleneck_process == Painting:
  new_paint_time = average_paint_time_per_repair / paint_improvement_factor
  new_paint      = paint_capacity_hours / new_paint_time
  new_prep       = prep_repairs_possible
  new_booth      = booth_repairs_possible

IF bottleneck_process == Booth:
  new_booth_time = average_booth_cycle_time_per_repair / booth_improvement_factor
  new_booth      = booth_capacity_hours / new_booth_time
  new_prep       = prep_repairs_possible
  new_paint      = paint_repairs_possible

new_system_throughput = MIN(new_prep, new_paint, new_booth)

next_bottleneck = all stages where new_stage_repairs_possible == new_system_throughput
```

**Output:**
- `new_system_throughput` (repairs/year)
- `next_bottleneck`

**Insight:** If only a single `improvement_factor` is defined (not stage-specific), use it as the factor for whichever stage is the bottleneck. The improvement is scoped to the bottleneck stage only in this model — consistent with how real process improvements work.


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Consumption Analysis

### Consumption Layer (User Baseline)

This layer calculates material usage and cost based on the user's current product. All calculations here use `user_product_usage_per_repair` and `user_product_price_per_unit`, not the company product variables.

**Execution order within layer:**
Model 4 (Workload Distribution) must run before Model 5 (Process Cost Contribution).

---

### 1. Material Usage Model
**Formula:**
```
annual_material_usage = actual_repairs_completed × user_product_usage_per_repair
```

**Output:** `annual_material_usage` (units/year)

> ⚠️ Uses `actual_repairs_completed`, not `repairs_per_year`. Usage is based on repairs the shop can actually complete.

---

### 2. Cost per Repair Model
**Formula:**
```
cost_per_repair = user_product_usage_per_repair × user_product_price_per_unit
```

**Output:** `cost_per_repair` (currency/repair)

**Insight:** This is the user's actual current cost per repair with their current product.

---

### 3. Total Material Cost Model
**Formula:**
```
total_material_cost_per_year = cost_per_repair × actual_repairs_completed
```

**Validation (must match):**
```
total_material_cost_per_year = user_product_price_per_unit × annual_material_usage
```

**Output:** `total_material_cost_per_year` (currency/year)

---

### 4. Workload Distribution Model

**Step 1 – Hours per process:**
```
prep_workload_hours  = actual_repairs_completed × average_preparation_time_per_repair
paint_workload_hours = actual_repairs_completed × average_paint_time_per_repair
booth_workload_hours = actual_repairs_completed × average_booth_cycle_time_per_repair
```

**Step 2 – Total labour workload (prep + paint only):**
```
total_workload_hours = prep_workload_hours + paint_workload_hours
```

> ⚠️ `booth_workload_hours` is calculated for reference but NOT added to `total_workload_hours`. Booth time is equipment occupancy, not additive labour.

**Step 3 – Distribution (%):**
```
prep_workload_pct  = (prep_workload_hours / total_workload_hours) × 100
paint_workload_pct = (paint_workload_hours / total_workload_hours) × 100
```

**Output:**
- `prep_workload_hours`, `paint_workload_hours`, `booth_workload_hours` (hours/year)
- `total_workload_hours` (hours/year) [prep + paint only]
- `prep_workload_pct`, `paint_workload_pct` (%)

---

### 5. Process Cost Contribution Model (Estimated)

> ⚠️ Depends on Model 4. Run Model 4 first.

**Step 1 – Workload share (ratios, not %):**
```
prep_workload_share  = prep_workload_hours / total_workload_hours
paint_workload_share = paint_workload_hours / total_workload_hours
```

**Step 2 – Cost allocation:**
```
prep_cost  = total_material_cost_per_year × prep_workload_share
paint_cost = total_material_cost_per_year × paint_workload_share
```

**Step 3 – Contribution (%):**
```
prep_cost_contribution  = prep_workload_share × 100
paint_cost_contribution = paint_workload_share × 100
```

**Output:** `prep_cost_contribution` (%), `paint_cost_contribution` (%)

> ⚠️ Assumption: material usage scales proportionally with time per process. Approximation only — refine if process-level material data becomes available.

---

### 6. Benchmark Deviation Model
**Mode:** Mode A (runs without company data). Requires `user_product_usage_per_repair` — if not provided by user, falls back to `benchmark_usage_per_repair`, in which case `deviation_pct = 0` and no deviation insight is available.
**Formula:**
```
deviation_pct = ((user_product_usage_per_repair - benchmark_usage_per_repair) / benchmark_usage_per_repair) × 100
```

**Output:** `deviation_pct` (%)

**Insight:**
- Positive → user uses MORE than benchmark (inefficient)
- Negative → user uses LESS than benchmark (efficient)

> ⚠️ This now correctly compares the user's actual current product usage against the benchmark — not the company product against the benchmark.

> ⚠️ Sign convention: positive = worse. Inverse of the general delta convention. Handle explicitly in downstream logic.

---

## Important Modeling Rules

- Use `actual_repairs_completed` (not `repairs_per_year`) as the volume base in all cost, usage, and workload calculations
- `cost_per_repair` always refers to user's current product cost; `optimized_cost_per_repair` always refers to company product cost
- `booth_workload_hours` must NOT be included in `total_workload_hours`
- `booth_capacity_hours` must use `booth_available_hours` (1,920h), not `labour_available_hours` (1,632h)
- Financial savings are calculated on labour time saved only — apply `labour_fraction` before multiplying by `labour_cost_per_hour`
- Model 4 (Workload Distribution) must execute before Model 5 (Process Cost Contribution)
- Variable names must match the canonical table in System Core Logic exactly


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Impact Analysis

### Impact Layer

**Mode:** Requires Mode B (all models in this layer depend on company product data and `improvement_factor`). Entirely skipped in Mode A.

This layer translates process improvements into time savings, financial impact, and capacity gains.

> ⚠️ All volume-based calculations in this layer use `actual_repairs_completed`, not `repairs_per_year`. Calculating impact on more repairs than the system can complete overstates results.

---

### 0. Cycle Time and Labour Fraction Definitions

These variables must be calculated first. All other models in this layer depend on them.

**Current cycle time (scheduling):**
```
current_cycle_time_per_repair = average_preparation_time_per_repair
                               + average_paint_time_per_repair
                               + average_booth_cycle_time_per_repair
                               = 3 + 2.5 + 2 = 7.5h
```

**Optimized cycle time (scheduling):**
```
optimized_prep_time   = average_preparation_time_per_repair / prep_improvement_factor
optimized_paint_time  = average_paint_time_per_repair / paint_improvement_factor
optimized_booth_time  = average_booth_cycle_time_per_repair / booth_improvement_factor

optimized_cycle_time_per_repair = optimized_prep_time + optimized_paint_time + optimized_booth_time
```

> If only a single `improvement_factor` is provided (not stage-specific), apply it uniformly:
> `optimized_cycle_time_per_repair = current_cycle_time_per_repair / improvement_factor`

**Labour fraction:**
```
labour_fraction = average_labour_time_per_repair / current_cycle_time_per_repair
               = 5.5 / 7.5 = 0.733
```

**Output:**
- `current_cycle_time_per_repair` (hours/repair) = 7.5
- `optimized_cycle_time_per_repair` (hours/repair)
- `labour_fraction` (ratio) = 0.733

---

### 1. Cycle Time Saved per Repair
**Formula:**
```
cycle_time_saved_per_repair = current_cycle_time_per_repair - optimized_cycle_time_per_repair
```

**Output:** `cycle_time_saved_per_repair` (hours/repair)

---

### 2. Labour Time Saved per Repair
**Purpose:** Extract only the labour-billable portion of cycle time saved.

**Formula:**
```
labour_time_saved_per_repair = cycle_time_saved_per_repair × labour_fraction
```

**Output:** `labour_time_saved_per_repair` (hours/repair)

**Insight:** This is the time saving that can legitimately be valued at `labour_cost_per_hour`. Booth drying time is not labour time — applying labour cost to it overstates financial savings.

---

### 3. Total Time Saved Model
**Formula:**
```
total_cycle_time_saved_per_year  = cycle_time_saved_per_repair × actual_repairs_completed
total_labour_time_saved_per_year = labour_time_saved_per_repair × actual_repairs_completed
```

**Output:**
- `total_cycle_time_saved_per_year` (hours/year) [used for throughput and FTE]
- `total_labour_time_saved_per_year` (hours/year) [used for financial savings]

---

### 4. FTE Model
**Formula:**
```
fte_saved = total_cycle_time_saved_per_year / fte_hours_per_year
```

**Output:** `fte_saved` (FTE)

**Insight:** Uses full cycle time (not labour-only) because FTE is a headcount proxy for overall time freed up, not just billable time. Uses contractual hours (1,800h) as the FTE basis.

---

### 5. Financial Savings Model
**Formula:**
```
financial_savings_per_year = total_labour_time_saved_per_year × labour_cost_per_hour
```

**Output:** `financial_savings_per_year` (currency/year)

**Insight:** Uses `total_labour_time_saved_per_year` — labour-fraction-adjusted — to avoid attributing labour cost to booth drying time. How this figure is presented depends on `savings_type` from the Logic Layer (cost reduction vs capacity gain).

---

### 6. Optimized Cost per Repair
**Formula:**
```
optimized_cost_per_repair = product_usage_per_repair × product_price_per_unit
```

**Output:** `optimized_cost_per_repair` (currency/repair)

**Insight:** This is the company product cost per repair. Compared against `cost_per_repair` (user's current product cost) to calculate the cost delta.

---

### 7. Cost-Time Tradeoff Model
**Step 1 – Product cost delta:**
```
additional_product_cost_per_year = (optimized_cost_per_repair - cost_per_repair) × actual_repairs_completed
```

[Positive = company product costs more per repair; Negative = company product costs less]

**Step 2 – Net value:**
```
net_value = financial_savings_per_year - additional_product_cost_per_year
```

**Output:**
- `additional_product_cost_per_year` (currency/year)
- `net_value` (currency/year)

---

### 8. ROI Model
**Formula:**
```
IF investment_cost = 0:
  roi_pct = undefined → route to Recommendation Signal Model
ELSE:
  roi_pct = (net_value / investment_cost) × 100
```

**Output:** `roi_pct` (%) or `undefined`

**Insight:** `investment_cost` must be annualised. See Internal Company Data section 4 for definition. If `investment_cost = 0`, the ROI formula is undefined — use the Recommendation Signal Model in the Logic Layer to handle this case.


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Known Assumptions and Limitations

The following assumptions are built into the current model. They are documented here explicitly so that implementers and users understand where results may diverge from reality.

| Assumption | Risk | Notes |
|---|---|---|
| Single `improvement_factor` applied uniformly | High | A product improving prep drying does not speed up hand sanding at the same rate. Use stage-specific factors when product data allows. |
| Single average repair time | High | Mix of minor/major repairs produces different real-world numbers. See Advanced Notes for future segmentation approach. |
| `labour_fraction` (0.733) applied as a fixed ratio | Medium | In practice the overlap between active painting and booth drying varies by repair type and product. |
| Linear throughput scaling | Medium | Doubling workers doubles capacity — no coordination overhead or physical space constraints modeled. |
| `labour_available_hours` 0.85 efficiency factor is uniform | Low–Medium | Prep workers and painters may have meaningfully different idle patterns. |
| Booth runs full shift hours (1,920h) without maintenance | Medium | Filter changes, calibration, failures — a booth-specific availability factor may be warranted. Override via advanced input. |
| `working_days_per_year = 240` | Low | Region-dependent. Some markets run 6-day weeks. Override via user input. |
| Material cost scales linearly with usage | Low | No volume discounts, wastage factors, or setup costs modeled. |
| `savings_type` threshold at 0.90 utilisation | Medium | Threshold is a reasonable approximation. Actual crossover point depends on overtime policy and outsourcing costs. |


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------


## Advanced Notes

### Stage-Specific Improvement Factors
Stage-specific improvement factors (`prep_improvement_factor`, `paint_improvement_factor`, `booth_improvement_factor`) are the preferred mode when internal company data supports them. The single `improvement_factor` fallback is an approximation for cases where only aggregate performance data is available. Upgrade to stage-specific factors as product data matures.

### Repair Type Segmentation (Future Version)
The current model uses a single average repair time. A future version should support:
```
repair_types = [small, medium, heavy]
```
with separate cycle times, labour fractions, and volumes per type — enabling accurate throughput and utilisation modeling for mixed-volume workshops.


--------------------------------------------------------------------------------------------------------------------------------------------------------------------------
