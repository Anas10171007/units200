import { useEffect, useState } from 'react';
import { Platform, Pressable, ScrollView, StatusBar, Text, TextInput, View, StyleSheet } from 'react-native';
import { Cycle, Forecast, LIMIT, checkReading, dayNum, forecast, isoDate, replaceMeter, validIso } from './src/forecast';
import { Data, empty, load, save } from './src/store';

const C = { ink: '#12201C', paper: '#F2F5F1', card: '#FFFFFF', green: '#1E7B5C', amber: '#C98A14', alarm: '#C42B55', muted: '#5E6F69', line: '#D3DBD6' };
const tone = { safe: C.green, watch: C.amber, 'over-risk': C.alarm, 'already-over': C.alarm } as const;
const n0 = (x: number) => String(Math.round(x));
const n1 = (x: number) => (Math.round(x * 10) / 10).toString();
const today = () => isoDate(new Date());

function Gauge({ f }: { f: Extract<Forecast, { ok: true }> }) {
  const max = Math.max(250, f.high * 1.1);
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%` as `${number}%`;
  return (
    <View style={{ marginTop: 18 }}>
      <View style={s.track}>
        <View style={[s.range, { left: pct(f.low), width: `${Math.min(100, ((f.high - f.low) / max) * 100)}%` as `${number}%`, backgroundColor: tone[f.status] + '40' }]} />
        <View style={[s.used, { width: pct(f.used), backgroundColor: tone[f.status] }]} />
        <View style={[s.limit, { left: pct(LIMIT) }]} />
      </View>
      <View style={{ height: 22 }}>
        <Text style={[s.small, { position: 'absolute', left: pct(LIMIT), marginLeft: -14, fontWeight: '700', color: C.ink }]}>200</Text>
      </View>
      <Text style={s.small}>Solid bar: units used so far. Shaded: estimated range by the next bill.</Text>
    </View>
  );
}

function Home({ d, go }: { d: Data; go: (v: string) => void }) {
  const c = d.cycle;
  if (!c) return (
    <View style={s.card}>
      <Text style={s.h1}>Know before the bill does</Text>
      <Text style={s.body}>Enter the reading from your last bill and today's meter reading. We estimate your units by the next bill and tell you if 200 is at risk.</Text>
      <Btn label="Start your first cycle" onPress={() => go('cycle')} />
    </View>
  );
  const f = forecast(c, today());
  const last = c.readings.length ? c.readings[c.readings.length - 1] : null;
  const head = !f.ok ? (f.reason === 'no-readings' ? 'Add a reading to see your forecast' : 'Add a reading from a later day')
    : f.status === 'safe' ? `On track for about ${n0(f.projected)} units`
    : f.status === 'watch' ? 'Close to 200. You could go over'
    : f.status === 'over-risk' ? 'Heading past 200 units'
    : `You have already used ${n0(f.used)} units`;
  return (
    <View>
      {f.ok && f.status !== 'safe' && (
        <View style={[s.banner, { borderColor: tone[f.status] }]}>
          <Text style={[s.bannerT, { color: tone[f.status] }]}>200-unit warning</Text>
          <Text style={s.body}>{f.status === 'watch' ? 'Your estimate could reach 200 units.' : 'Your forecast is above 200 units.'} This is an estimate, not a bill. Check your meter and enter a current reading. Billing rules can change, so confirm them with your electricity company.</Text>
        </View>
      )}
      <View style={s.card}>
        <Text style={s.small}>Forecast · cycle ends {c.endDate}</Text>
        <Text style={[s.h1, f.ok && { color: tone[f.status] }]}>{head}</Text>
        {f.ok && <>
          <Text style={s.body}>Estimate {n0(f.low)}–{n0(f.high)} units · {f.confidence} confidence</Text>
          <Gauge f={f} />
          {f.outdated && <Text style={[s.body, { color: C.amber }]}>Your last reading is more than 7 days old, so this may be out of date.</Text>}
        </>}
      </View>
      {f.ok && f.dailyBudget !== null && (
        <View style={s.card}>
          <Text style={s.small}>To stay at or under 200</Text>
          <Text style={s.big}>{n1(f.dailyBudget)} <Text style={s.small}>units/day</Text></Text>
          <Text style={s.body}>for the next {f.remainingDays} days. You are using about {n1(f.rate)} a day now. This guidance does not guarantee your final bill.</Text>
        </View>
      )}
      <View style={s.card}>
        <Text style={s.small}>Entered reading (from your meter)</Text>
        <Text style={s.big}>{(last ?? c.opening).value}</Text>
        <Text style={s.body}>{last ? `Entered on ${last.date}` : `Opening reading on ${c.opening.date}`}</Text>
      </View>
      <Btn label="Add a reading" onPress={() => go('reading')} />
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Btn ghost label="New cycle" onPress={() => go('cycle')} />
        <Btn ghost label="History" onPress={() => go('history')} />
      </View>
    </View>
  );
}

function ReadingForm({ d, set, back }: { d: Data; set: (d: Data) => void; back: () => void }) {
  const c = d.cycle as Cycle;
  const [val, setVal] = useState(''), [date, setDate] = useState(today()), [err, setErr] = useState(''), [lower, setLower] = useState(false), [oldFinal, setOldFinal] = useState('');
  const r = { date, value: Number(val) };
  const submit = () => {
    const chk = checkReading(c, r, today());
    if (chk.ok) { set({ ...d, cycle: { ...c, readings: [...c.readings, r] } }); return back(); }
    setErr(chk.message); setLower(chk.kind === 'lower');
  };
  const replaced = () => {
    const of = oldFinal.trim() === '' ? null : Number(oldFinal);
    if (of !== null && !(of >= c.opening.value)) return setErr('The old meter’s final reading must be at least the opening reading.');
    set({ ...d, cycle: replaceMeter(c, of, r), history: [...d.history] }); back();
  };
  return (
    <View style={s.card}>
      <Text style={s.h1}>Add a reading</Text>
      <Field label="Meter reading (units)" value={val} onChange={setVal} numeric />
      <Field label="Date of this reading (YYYY-MM-DD)" value={date} onChange={setDate} />
      {!!err && <Text style={s.err}>{err}</Text>}
      {lower ? (
        <View>
          <Text style={s.body}>Did you mistype it, or was your meter replaced?</Text>
          <Field label="Final reading on the old meter (optional)" value={oldFinal} onChange={setOldFinal} numeric />
          <Btn label="My meter was replaced" onPress={replaced} />
          <Btn ghost label="Fix the number" onPress={() => { setLower(false); setErr(''); }} />
        </View>
      ) : <Btn label="Save reading" onPress={submit} />}
      <Btn ghost label="Cancel" onPress={back} />
    </View>
  );
}

function CycleForm({ d, set, back }: { d: Data; set: (d: Data) => void; back: () => void }) {
  const [val, setVal] = useState(''), [od, setOd] = useState(today()), [ed, setEd] = useState(''), [err, setErr] = useState('');
  const submit = () => {
    if (val.trim() === '' || !(Number(val) >= 0)) return setErr('Enter the opening reading from your last bill.');
    if (!validIso(od) || !validIso(ed)) return setErr('Enter both dates as YYYY-MM-DD.');
    if (dayNum(ed) <= dayNum(od)) return setErr('The next bill date must be after the opening date.');
    const next: Cycle = { opening: { date: od, value: Number(val) }, readings: [], endDate: ed, carriedUnits: 0 };
    set({ cycle: next, history: d.cycle ? [...d.history, d.cycle] : d.history }); back();
  };
  return (
    <View style={s.card}>
      <Text style={s.h1}>{d.cycle ? 'Start a new cycle' : 'Start your first cycle'}</Text>
      <Text style={s.body}>Use the previous reading and date printed on your last bill.</Text>
      <Field label="Opening reading (units)" value={val} onChange={setVal} numeric />
      <Field label="Opening date (YYYY-MM-DD)" value={od} onChange={setOd} />
      <Field label="Next bill date (YYYY-MM-DD)" value={ed} onChange={setEd} />
      {!!err && <Text style={s.err}>{err}</Text>}
      <Btn label="Save cycle" onPress={submit} />
      {d.cycle && <Btn ghost label="Cancel" onPress={back} />}
    </View>
  );
}

function History({ d, back }: { d: Data; back: () => void }) {
  const all = [...(d.cycle ? [d.cycle] : []), ...[...d.history].reverse()];
  return (
    <View>
      <Text style={[s.h1, { marginBottom: 8 }]}>History</Text>
      {all.length === 0 && <Text style={s.body}>No cycles yet.</Text>}
      {all.map((c, i) => {
        const last = c.readings.length ? c.readings[c.readings.length - 1] : c.opening;
        return (
          <View key={i} style={s.card}>
            <Text style={s.small}>{c.opening.date} to {c.endDate}{i === 0 && d.cycle ? ' · current' : ''}</Text>
            <Text style={s.big}>{n0(c.carriedUnits + last.value - c.opening.value)} <Text style={s.small}>units so far</Text></Text>
            <Text style={s.body}>{c.readings.length} readings entered{c.carriedUnits ? ' · includes an earlier meter' : ''}</Text>
          </View>
        );
      })}
      <Btn ghost label="Back" onPress={back} />
    </View>
  );
}

const Field = ({ label, value, onChange, numeric }: { label: string; value: string; onChange: (t: string) => void; numeric?: boolean }) => (
  <View style={{ marginTop: 12 }}>
    <Text style={s.small}>{label}</Text>
    <TextInput style={s.input} value={value} onChangeText={onChange} keyboardType={numeric ? 'numeric' : 'default'} autoCapitalize="none" />
  </View>
);
const Btn = ({ label, onPress, ghost }: { label: string; onPress: () => void; ghost?: boolean }) => (
  <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.btn, ghost && s.ghost, pressed && { opacity: 0.7 }, ghost && { flex: 1 }]}>
    <Text style={[s.btnT, ghost && { color: C.ink }]}>{label}</Text>
  </Pressable>
);

export default function App() {
  const [d, setD] = useState<Data>(empty), [ready, setReady] = useState(false), [view, setView] = useState('home');
  useEffect(() => { load().then((x) => { setD(x); setReady(true); }); }, []);
  const set = (x: Data) => { setD(x); save(x); };
  const back = () => setView('home');
  return (
    <ScrollView style={{ backgroundColor: C.paper }} contentContainerStyle={s.page}>
      <Text style={s.brand}>Units200</Text>
      {!ready ? <Text style={s.body}>Loading…</Text>
        : view === 'reading' && d.cycle ? <ReadingForm d={d} set={set} back={back} />
        : view === 'cycle' ? <CycleForm d={d} set={set} back={back} />
        : view === 'history' ? <History d={d} back={back} />
        : <Home d={d} go={setView} />}
      <Text style={s.foot}>Forecasts are estimates based on readings you enter. They are not measured values or a bill.</Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  page: { padding: 18, paddingTop: (Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 48) + 12, gap: 12 },
  brand: { fontSize: 15, fontWeight: '800', color: C.green, letterSpacing: 0.3 },
  card: { backgroundColor: C.card, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: C.line, gap: 4 },
  h1: { fontSize: 24, fontWeight: '800', color: C.ink, lineHeight: 30 },
  big: { fontSize: 34, fontWeight: '800', color: C.ink, fontVariant: ['tabular-nums'] },
  body: { fontSize: 15, color: C.ink, lineHeight: 22, marginTop: 4 },
  small: { fontSize: 13, color: C.muted },
  err: { color: C.alarm, fontSize: 14, marginTop: 10 },
  input: { borderWidth: 1, borderColor: C.line, borderRadius: 10, padding: 12, fontSize: 18, color: C.ink, backgroundColor: C.paper, marginTop: 4 },
  btn: { backgroundColor: C.ink, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 12 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.ink },
  btnT: { color: '#fff', fontSize: 16, fontWeight: '700' },
  banner: { borderWidth: 2, borderRadius: 14, padding: 14, backgroundColor: C.card },
  bannerT: { fontSize: 16, fontWeight: '800' },
  track: { height: 22, borderRadius: 11, backgroundColor: C.line, overflow: 'hidden' },
  range: { position: 'absolute', top: 0, bottom: 0 },
  used: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  limit: { position: 'absolute', top: 0, bottom: 0, width: 3, backgroundColor: C.ink },
  foot: { fontSize: 12, color: C.muted, textAlign: 'center', marginTop: 8 },
});
