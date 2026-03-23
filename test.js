const { run, runModeA, runModeB, detectMode } = require('./engine.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (e) {
    console.log(`  ✗ ${name}`);
    console.log(`    → ${e.message}`);
    failed++;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertClose(a, b, label, tolerance = 0.01) {
  assert(Math.abs(a - b) < tolerance, `${label}: expected ${b}, got ${a}`);
}

// ── Base workshop input (Mode A) ──────────────────────────────────────────────
const baseInput = {
  repairs_per_year:      500,
  preparation_workers:   2,
  spray_painters:        2,
  amount_spraybooths:    1,
  labour_cost_per_hour:  45,
};

// ── Base + user product (enables consumption layer) ───────────────────────────
const inputWithProduct = {
  ...baseInput,
  user_product_usage_per_repair: 1.2,
  user_product_price_per_unit:   18,
  benchmark_usage_per_repair:    1.0,
};

// ── Full Mode B input ─────────────────────────────────────────────────────────
const inputModeB = {
  ...inputWithProduct,
  company_product_usage_per_repair: 0.9,
  company_product_price_per_unit:   22,
  improvement_factor:               1.2,
  investment_cost:                  3000,
};

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n● Mode detection');

test('detects Mode A when company data is missing', () => {
  assert(detectMode(baseInput) === 'A', 'should be A');
});

test('detects Mode B when all company data is present', () => {
  assert(detectMode(inputModeB) === 'B', 'should be B');
});

test('detects Mode A when only some company fields are present', () => {
  assert(detectMode({ ...baseInput, improvement_factor: 1.2 }) === 'A', 'should be A — missing other fields');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n● Derived benchmark values');

test('labour_available_hours derived correctly (240 × 8 × 0.85 = 1632)', () => {
  const out = runModeA(baseInput);
  assertClose(out.inputs_used.labour_available_hours, 1632, 'labour_available_hours');
});

test('booth_available_hours derived correctly (240 × 8 = 1920)', () => {
  const out = runModeA(baseInput);
  assertClose(out.inputs_used.booth_available_hours, 1920, 'booth_available_hours');
});

test('average_labour_time_per_repair = 3 + 2.5 = 5.5', () => {
  const out = runModeA(baseInput);
  assertClose(out.inputs_used.average_labour_time_per_repair, 5.5, 'labour_time');
});

test('current_cycle_time_per_repair = 3 + 2.5 + 2 = 7.5', () => {
  const out = runModeA(baseInput);
  assertClose(out.inputs_used.current_cycle_time_per_repair, 7.5, 'cycle_time');
});

test('labour_fraction = 5.5 / 7.5 = 0.7333', () => {
  const out = runModeA(baseInput);
  assertClose(out.inputs_used.labour_fraction, 0.7333, 'labour_fraction', 0.001);
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n● Operational layer');

test('repairs_per_day = 500 / 240 = 2.083', () => {
  const out = runModeA(baseInput);
  assertClose(out.results.repairs_per_day, 500 / 240, 'repairs_per_day');
});

test('prep_capacity_hours = 2 workers × 1632 = 3264', () => {
  const out = runModeA(baseInput);
  assertClose(out.results.prep_capacity_hours, 3264, 'prep_capacity_hours');
});

test('booth_capacity_hours uses booth_available_hours (1920), not labour hours', () => {
  const out = runModeA(baseInput);
  assertClose(out.results.booth_capacity_hours, 1 * 1920, 'booth_capacity_hours');
});

test('labour_hours_used = 500 × 5.5 = 2750', () => {
  const out = runModeA(baseInput);
  assertClose(out.results.labour_hours_used, 2750, 'labour_hours_used');
});

test('utilisation = 2750 / (4 × 1632)', () => {
  const out = runModeA(baseInput);
  const expected = 2750 / (4 * 1632);
  assertClose(out.results.utilisation, expected, 'utilisation');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n● Bottleneck layer');

test('system_throughput is MIN of prep/paint/booth', () => {
  const out = runModeA(baseInput);
  const r   = out.results;
  const expected = Math.min(r.prep_repairs_possible, r.paint_repairs_possible, r.booth_repairs_possible);
  assertClose(r.system_throughput_per_year, expected, 'system_throughput');
});

test('actual_repairs_completed is capped by system_throughput', () => {
  const out = runModeA(baseInput);
  const r   = out.results;
  assert(
    r.actual_repairs_completed <= r.system_throughput_per_year,
    `actual_repairs_completed (${r.actual_repairs_completed}) exceeds throughput (${r.system_throughput_per_year})`
  );
});

test('bottleneck_process is an array with at least one entry', () => {
  const out = runModeA(baseInput);
  assert(Array.isArray(out.results.bottleneck_process), 'should be array');
  assert(out.results.bottleneck_process.length >= 1, 'should have at least one bottleneck');
});

test('capacity_gap = throughput - repairs_per_year', () => {
  const out = runModeA(baseInput);
  const r   = out.results;
  assertClose(r.capacity_gap, r.system_throughput_per_year - 500, 'capacity_gap');
});

test('flow_efficiency = throughput / repairs_per_year', () => {
  const out = runModeA(baseInput);
  const r   = out.results;
  assertClose(r.flow_efficiency, r.system_throughput_per_year / 500, 'flow_efficiency');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n● Consumption layer');

test('consumption layer runs when user product data provided', () => {
  const out = runModeA(inputWithProduct);
  assert(out.results.cost_per_repair !== undefined, 'cost_per_repair should exist');
});

test('cost_per_repair = 1.2 × 18 = 21.6', () => {
  const out = runModeA(inputWithProduct);
  assertClose(out.results.cost_per_repair, 21.6, 'cost_per_repair');
});

test('total_material_cost uses actual_repairs_completed not repairs_per_year', () => {
  const out = runModeA(inputWithProduct);
  const r   = out.results;
  const expected = r.cost_per_repair * r.actual_repairs_completed;
  assertClose(r.total_material_cost_per_year, expected, 'total_material_cost');
});

test('booth_workload_hours NOT included in total_workload_hours', () => {
  const out = runModeA(inputWithProduct);
  const r   = out.results;
  const labourOnly = r.prep_workload_hours + r.paint_workload_hours;
  assertClose(r.total_workload_hours, labourOnly, 'total_workload_hours should exclude booth');
});

test('workload percentages sum to 100', () => {
  const out = runModeA(inputWithProduct);
  const r   = out.results;
  assertClose(r.prep_workload_pct + r.paint_workload_pct, 100, 'workload pct sum', 0.1);
});

test('deviation_pct positive when user uses more than benchmark', () => {
  const out = runModeA(inputWithProduct); // user=1.2, benchmark=1.0
  assert(out.results.deviation_pct > 0, `deviation_pct should be positive, got ${out.results.deviation_pct}`);
});

test('consumption layer skips gracefully when no user product data', () => {
  const out = runModeA(baseInput);
  assert(out.results.cost_per_repair === undefined, 'cost_per_repair should be undefined');
  assert(out.missing.some(m => m.layer === 'Consumption'), 'missing should flag Consumption layer');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n● Scenario classification');

test('utilisation_scenario is one of three valid values', () => {
  const out    = runModeA(baseInput);
  const valid  = ['Underutilised', 'Balanced', 'Overloaded'];
  assert(valid.includes(out.results.utilisation_scenario), `invalid scenario: ${out.results.utilisation_scenario}`);
});

test('system_status is Excess capacity when throughput > demand', () => {
  // low demand shop — should have excess capacity
  const out = runModeA({ ...baseInput, repairs_per_year: 100 });
  assert(out.results.system_status === 'Excess capacity', `got: ${out.results.system_status}`);
});

test('system_status is Under capacity when demand > throughput', () => {
  // extremely high demand — should exceed capacity
  const out = runModeA({ ...baseInput, repairs_per_year: 99999 });
  assert(out.results.system_status === 'Under capacity', `got: ${out.results.system_status}`);
});

test('savings_type is Cost saving when utilisation >= 0.90', () => {
  // force high utilisation: many repairs, few workers
  const out = runModeA({ ...baseInput, repairs_per_year: 5000 });
  const u   = out.results.utilisation;
  if (u >= 0.90) {
    assert(out.results.savings_type === 'Cost saving', `got: ${out.results.savings_type}`);
  } else {
    assert(out.results.savings_type === 'Capacity gain', `got: ${out.results.savings_type}`);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n● Mode B — optimized state');

test('Mode B runs Mode A first and includes all Mode A results', () => {
  const out = runModeB(inputModeB);
  assert(out.results.utilisation !== undefined,           'utilisation should exist');
  assert(out.results.system_throughput_per_year !== undefined, 'throughput should exist');
});

test('optimized_cycle_time < current_cycle_time when improvement_factor > 1', () => {
  const out = runModeB(inputModeB);
  assert(
    out.results.optimized_cycle_time_per_repair < out.inputs_used.current_cycle_time_per_repair,
    `optimized (${out.results.optimized_cycle_time_per_repair}) should be less than current (${out.inputs_used.current_cycle_time_per_repair})`
  );
});

test('optimized_utilisation < utilisation when improvement_factor > 1', () => {
  const out = runModeB(inputModeB);
  assert(
    out.results.optimized_utilisation < out.results.utilisation,
    `optimized_utilisation (${out.results.optimized_utilisation}) should be less than current (${out.results.utilisation})`
  );
});

test('labour_time_saved derived from stage times, not labour_fraction', () => {
  const out = runModeB(inputModeB);
  const r   = out.results;
  const inp = out.inputs_used;
  const expected = inp.average_labour_time_per_repair - r.optimized_labour_time_per_repair;
  assertClose(r.labour_time_saved_per_repair, expected, 'labour_time_saved_per_repair');
});

test('financial_savings uses total_labour_time_saved, not cycle time', () => {
  const out      = runModeB(inputModeB);
  const r        = out.results;
  const expected = r.total_labour_time_saved_per_year * inputModeB.labour_cost_per_hour;
  assertClose(r.financial_savings_per_year, expected, 'financial_savings_per_year');
});

test('fte_saved uses labour time only, not full cycle time', () => {
  const out      = runModeB(inputModeB);
  const r        = out.results;
  const expected = r.total_labour_time_saved_per_year / out.inputs_used.fte_hours_per_year;
  assertClose(r.fte_saved, expected, 'fte_saved');
});

test('net_value = financial_savings - additional_product_cost', () => {
  const out      = runModeB(inputModeB);
  const r        = out.results;
  const expected = r.financial_savings_per_year - r.additional_product_cost_per_year;
  assertClose(r.net_value, expected, 'net_value');
});

test('roi_pct = (net_value / investment_cost) × 100', () => {
  const out      = runModeB(inputModeB);
  const r        = out.results;
  const expected = (r.net_value / inputModeB.investment_cost) * 100;
  assertClose(r.roi_pct, expected, 'roi_pct');
});

test('recommendation is defined and is a string', () => {
  const out = runModeB(inputModeB);
  assert(typeof out.results.recommendation === 'string', 'recommendation should be a string');
});

test('investment_cost = 0 returns null roi and recommendation without crashing', () => {
  const out = runModeB({ ...inputModeB, investment_cost: 0 });
  assert(out.results.roi_pct === null, 'roi_pct should be null');
  assert(typeof out.results.recommendation === 'string', 'recommendation should still be a string');
});

test('Mode B flags missing when user product data absent', () => {
  const noProduct = {
    ...baseInput,
    company_product_usage_per_repair: 0.9,
    company_product_price_per_unit:   22,
    improvement_factor:               1.2,
    investment_cost:                  3000,
  };
  const out = runModeB(noProduct);
  assert(
    out.missing.some(m => m.layer.includes('Cost comparison')),
    'should flag missing cost comparison data'
  );
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n● Advanced input overrides');

test('user-supplied working_days_per_year overrides benchmark', () => {
  const out = runModeA({ ...baseInput, working_days_per_year: 200 });
  assertClose(out.inputs_used.working_days_per_year, 200, 'working_days_per_year');
  assert(out.data_sources.working_days_per_year === 'user', 'source should be user');
});

test('user-supplied labour_cost_per_hour overrides benchmark', () => {
  const out = runModeA({ ...baseInput, labour_cost_per_hour: 60 });
  assertClose(out.inputs_used.labour_cost_per_hour, 60, 'labour_cost_per_hour');
  assert(out.data_sources.labour_cost_per_hour === 'user', 'source should be user');
});

test('data_sources correctly labels benchmark vs user values', () => {
  const out = runModeA(baseInput);
  assert(out.data_sources.repairs_per_year === 'user', 'repairs_per_year should be user');
  assert(out.data_sources.average_preparation_time_per_repair === 'benchmark', 'prep time should be benchmark');
});

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n─────────────────────────────────────────');
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);
console.log(`  Total:  ${passed + failed}`);
if (failed === 0) {
  console.log('\n  ✓ All tests passed. Engine is correct.\n');
} else {
  console.log('\n  ✗ Fix failing tests before building UI.\n');
  process.exit(1);
}
