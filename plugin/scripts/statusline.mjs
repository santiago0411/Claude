#!/usr/bin/env node
// lean-kit status line (terminal only; the desktop app has its own usage ring):
// model · context tokens, colored green < 100K, yellow < 200K, red above · 5-hour and 7-day plan usage.
let raw = '';
process.stdin.on('data', (d) => (raw += d)).on('end', () => {
  let s = {};
  try {
    s = JSON.parse(raw);
  } catch {
    // Print what we can.
  }
  const tokens = s.context_window?.total_input_tokens ?? 0;
  const color = tokens >= 200e3 ? 31 : tokens >= 100e3 ? 33 : 32;
  const parts = [s.model?.display_name ?? 'Claude', `\x1b[${color}mctx ${Math.round(tokens / 1000)}K\x1b[0m`];
  const five = s.rate_limits?.five_hour?.used_percentage;
  const week = s.rate_limits?.seven_day?.used_percentage;
  if (five != null) parts.push(`5h ${Math.round(five)}%`);
  if (week != null) parts.push(`7d ${Math.round(week)}%`);
  process.stdout.write(parts.join(' · '));
});
