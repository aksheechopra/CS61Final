import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function ActivityHeatmap({ logDates = [] }) {
  const colorFor = (n) => {
    if (n === 0) return '#E2E8F0';
    if (n === 1) return '#A7F3D0';
    if (n === 2) return '#6EE7B7';
    if (n === 3) return '#34D399';
    return '#10B981';
  };

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const start = new Date(today);

  // did this so every col is a clean Sun-Sat week
  start.setDate(today.getDate() - (12 * 7 - 1 - (6 - today.getDay())));

  const counts = new Map();
  logDates.forEach((raw) => {
    const d = new Date(raw);
    d.setHours(0, 0, 0, 0);
    if (d < start || d > today) return;
    const k = d.toDateString();
    counts.set(k, (counts.get(k) || 0) + 1);
  });

  const weeks = Array.from({ length: 12 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const date = new Date(start);
      date.setDate(start.getDate() + w * 7 + d);
      return {
        key: date.toDateString(),
        count: counts.get(date.toDateString()) || 0,
        future: date > today,
      };
    })
  );

  const active = counts.size;

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Text style={styles.title}>Activity</Text>
        <Text style={styles.sub}>{active} active {active === 1 ? 'day' : 'days'} · 12 weeks</Text>
      </View>

      <View style={styles.grid}>
        {weeks.map((week, wi) => (
          <View key={wi} style={styles.col}>
            {week.map((c) => (
              <View key={c.key} style={[styles.cell, {
                backgroundColor: c.future ? 'transparent' : colorFor(c.count),
                opacity: c.future ? 0 : 1,
              }]} />
            ))}
          </View>
        ))}
      </View>

      <View style={styles.foot}>
        <Text style={styles.axis}>{start.toLocaleDateString('en-US', { month: 'short' })}</Text>
        <View style={styles.legend}>
          <Text style={styles.legendText}>Less</Text>
          {[0, 1, 2, 3, 4].map((n) => (
            <View key={n} style={[styles.legendCell, { backgroundColor: colorFor(n) }]} />
          ))}
          <Text style={styles.legendText}>More</Text>
        </View>
        <Text style={styles.axis}>{today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 20, marginBottom: 20, shadowColor: '#94A3B8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 3 },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 },
  title: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  sub: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  grid: { flexDirection: 'row', alignSelf: 'center', gap: 4 },
  col: { flexDirection: 'column', gap: 4 },
  cell: { width: 14, height: 14, borderRadius: 3 },
  foot: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14 },
  axis: { fontSize: 11, color: '#94A3B8', fontWeight: '600' },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendText: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  legendCell: { width: 10, height: 10, borderRadius: 2 },
});
