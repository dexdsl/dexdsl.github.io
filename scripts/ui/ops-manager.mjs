import React, { useEffect, useMemo, useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { computeWindow } from './rolodex.mjs';
import { listOpsTickets } from '../lib/ops-admin-api.mjs';

const KIND_TABS = ['all', 'submission', 'press', 'board', 'support'];

function toText(value) {
  return String(value || '').trim();
}

function truncate(value, max) {
  const text = toText(value);
  if (!text || text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1))}…`;
}

function formatTimestamp(value) {
  const text = toText(value);
  if (!text) return '-';
  return text.slice(0, 19).replace('T', ' ');
}

function normalizeRows(payload) {
  const rows = Array.isArray(payload?.tickets)
    ? payload.tickets
    : Array.isArray(payload?.items)
      ? payload.items
      : [];
  return rows.map((row) => ({
    id: toText(row.id || row.ticketId || row.submissionId),
    kind: toText(row.kind || row.type || 'ticket'),
    status: toText(row.status || row.state || '-'),
    title: toText(row.title || row.subject || row.summary || row.lookupCode || row.id),
    assignee: toText(row.assignee || row.assignedTo || ''),
    updatedAt: toText(row.updatedAt || row.updated_at || row.createdAt || row.created_at),
  })).filter((row) => row.id);
}

export function OpsManager({ onExit, width = 100, height = 24 }) {
  const env = process.env.DEX_OPS_ENV || process.env.DEX_POLLS_OPS_ENV || 'test';
  const [kindIndex, setKindIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [statusLine, setStatusLine] = useState('Loading ops queue…');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const kind = KIND_TABS[kindIndex] || 'all';

  const refresh = async () => {
    if (loading) return;
    setLoading(true);
    setStatusLine(`Loading ${kind} queue (${env})…`);
    try {
      const result = await listOpsTickets({ env, kind, limit: 50 });
      const nextRows = normalizeRows(result.payload);
      setRows(nextRows);
      setSelectedIndex(0);
      setStatusLine(`Loaded ${nextRows.length} ${kind} ticket(s) via ${result.apiBase}`);
    } catch (error) {
      setRows([]);
      setStatusLine(`Ops load failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [kindIndex]);

  useInput((input, key) => {
    if (key.escape || input === 'q') {
      if (typeof onExit === 'function') onExit();
      return;
    }
    if (input === 'r') {
      void refresh();
      return;
    }
    if (key.leftArrow) {
      setKindIndex((previous) => (previous - 1 + KIND_TABS.length) % KIND_TABS.length);
      return;
    }
    if (key.rightArrow) {
      setKindIndex((previous) => (previous + 1) % KIND_TABS.length);
      return;
    }
    if (key.upArrow) {
      setSelectedIndex((previous) => Math.max(0, previous - 1));
      return;
    }
    if (key.downArrow) {
      setSelectedIndex((previous) => Math.min(Math.max(0, rows.length - 1), previous + 1));
    }
  });

  const listHeight = Math.max(6, height - 9);
  const safeSelected = Math.max(0, Math.min(rows.length - 1, selectedIndex));
  const windowed = useMemo(() => computeWindow({
    total: rows.length,
    cursor: safeSelected,
    height: listHeight,
    pad: 2,
  }), [rows.length, safeSelected, listHeight]);
  const visibleRows = rows.slice(windowed.start, windowed.end);
  const titleWidth = Math.max(20, width - 62);
  const selectedRow = rows[safeSelected];

  return React.createElement(
    Box,
    { flexDirection: 'column', width, height },
    React.createElement(Text, { color: '#8f98a8' }, 'Ops Desk (←/→ queue, ↑/↓ select, r refresh, Esc exit)'),
    React.createElement(Text, { color: '#6e7688' }, `Env: ${env}  Commands: dex <submissions|press|board|support> show/reply/advance/assign`),
    React.createElement(Box, { marginTop: 1 },
      ...KIND_TABS.map((tab, index) => React.createElement(
        Text,
        index === kindIndex ? { key: tab, inverse: true } : { key: tab, color: '#d0d5df' },
        ` ${tab} `,
      )),
    ),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      rows.length
        ? visibleRows.map((row, localIndex) => {
          const absoluteIndex = windowed.start + localIndex;
          const selected = absoluteIndex === safeSelected;
          const line = `${truncate(row.id, 18).padEnd(18)} ${truncate(row.kind, 10).padEnd(10)} ${truncate(row.status, 11).padEnd(11)} ${truncate(row.title, titleWidth).padEnd(titleWidth)} ${formatTimestamp(row.updatedAt)}`;
          return React.createElement(Text, selected ? { key: row.id, inverse: true } : { key: row.id, color: '#d0d5df' }, `${selected ? '› ' : '  '}${line}`);
        })
        : [React.createElement(Text, { key: 'empty', color: '#8f98a8' }, loading ? 'Loading…' : 'No tickets returned.')],
    ),
    React.createElement(Box, { marginTop: 1, flexDirection: 'column' },
      selectedRow
        ? React.createElement(Text, { color: '#8f98a8' }, `Selected: dex ${selectedRow.kind === 'submission' ? 'submissions' : selectedRow.kind} show ${selectedRow.id}`)
        : null,
      React.createElement(Text, { color: loading ? '#f9e2af' : '#8f98a8' }, statusLine),
    ),
  );
}
